import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Link2Off,
  Loader2,
  RefreshCw,
  Save,
  Unplug,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

type ClienteMetaRow = {
  id: string;
  nome: string;
  page_id: string | null;
  page_name: string | null;
  ad_account_id: string | null;
  connected_at: string | null;
  expires_at: string | null;
  connected: boolean;
  hasToken: boolean;
};

export const Route = createFileRoute("/_authenticated/admin/config-meta")({
  component: ConfigMetaPage,
  head: () => ({ meta: [{ title: "Conectar Meta BM — Admin" }] }),
});

type MetaExtras = {
  access_token?: string;
  page_id?: string;
  page_name?: string;
  ad_account_id?: string;
  ad_account_name?: string | null;
  expires_at?: string;
  connected_at?: string;
  leadgen_subscribed?: boolean;
  connected_via?: "oauth" | "token";
  campanhas?: CampanhaPermitida[] | null;
};

type CampanhaPermitida = { id: string; nome?: string | null };

type CampanhaDisponivel = {
  id: string;
  nome: string;
  investimento: number;
  selecionada: boolean;
  status?: string;
};

type MetaInspectPage = { id: string; name: string };
type MetaInspectAccount = { id: string; name: string; amount_spent?: number };

const META_APP_ID = import.meta.env.VITE_META_APP_ID as string | undefined;
const META_LOGIN_CONFIG_ID = import.meta.env.VITE_META_LOGIN_CONFIG_ID as string | undefined;
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) as
  string | undefined;

async function invokeErrorMessage(error: unknown, fallback: string) {
  const ctx =
    error && typeof error === "object" && "context" in error
      ? (error as { context?: { json?: () => Promise<unknown> } }).context
      : undefined;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = (await ctx.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      /* ignore */
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function buildOAuthUrl(clienteId: string) {
  if (!META_APP_ID || !SUPABASE_URL) return null;
  const redirectUri = `${SUPABASE_URL}/functions/v1/meta-oauth-callback`;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    override_default_response_type: "true",
    state: origin ? `${clienteId}::${origin}` : clienteId,
  });
  if (META_LOGIN_CONFIG_ID) {
    params.set("config_id", META_LOGIN_CONFIG_ID);
  } else {
    params.set(
      "scope",
      "leads_retrieval,ads_read,pages_show_list,pages_read_engagement,pages_manage_metadata,pages_manage_ads,business_management",
    );
  }
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

function ConfigMetaPage() {
  const queryClient = useQueryClient();
  const { data: clientes = [], isLoading: loadingClientes } = useClientesOptions();
  const [clienteId, setClienteId] = useState<string>("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingLeads, setSyncingLeads] = useState(false);
  const [adAccountId, setAdAccountId] = useState("");
  const [painelAberto, setPainelAberto] = useState(false);
  const [setupAberto, setSetupAberto] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [inspectedPages, setInspectedPages] = useState<MetaInspectPage[]>([]);
  const [inspectedAccounts, setInspectedAccounts] = useState<MetaInspectAccount[]>([]);
  const [pickedPageId, setPickedPageId] = useState("");
  const [pickedAccountId, setPickedAccountId] = useState("");
  const [manualPageId, setManualPageId] = useState("");
  const [tokenMeName, setTokenMeName] = useState<string | null>(null);
  const [campanhas, setCampanhas] = useState<CampanhaDisponivel[] | null>(null);
  const [carregandoCampanhas, setCarregandoCampanhas] = useState(false);
  const [salvandoCampanhas, setSalvandoCampanhas] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("cliente_id");
    if (fromUrl) {
      setClienteId(fromUrl);
      setPainelAberto(true);
    }
  }, []);

  useEffect(() => {
    if (!clienteId && clientes[0]?.id) {
      setClienteId(clientes[0].id);
    }
  }, [clientes, clienteId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const meta = params.get("meta");
    if (meta === "connected") {
      toast.success("Meta Business conectado.");
      const fromUrl = params.get("cliente_id");
      if (fromUrl) setClienteId(fromUrl);
      setPainelAberto(true);
      void queryClient.invalidateQueries({ queryKey: ["cliente-meta"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "meta-conexoes"] });
    } else if (meta === "error") {
      toast.error(`Falha ao conectar Meta (${params.get("reason") ?? "erro"}).`);
      setPainelAberto(true);
    }
  }, [queryClient]);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente-meta", clienteId],
    enabled: Boolean(clienteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, dados_extras")
        .eq("id", clienteId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: conexoes = [], isLoading: loadingConexoes } = useQuery({
    queryKey: ["admin", "meta-conexoes"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, dados_extras")
        .order("nome");
      if (error) throw error;

      return (data ?? []).map((row) => {
        const extras = (row.dados_extras ?? {}) as { meta?: MetaExtras };
        const m = extras.meta;
        const connected = Boolean(m?.access_token && m?.page_id);
        const hasToken = Boolean(m?.user_access_token || m?.access_token);
        return {
          id: row.id,
          nome: row.nome,
          page_id: m?.page_id ?? null,
          page_name: m?.page_name ?? null,
          ad_account_id: m?.ad_account_id ?? null,
          connected_at: m?.connected_at ?? null,
          expires_at: m?.expires_at ?? null,
          connected,
          hasToken,
        } satisfies ClienteMetaRow;
      });
    },
  });

  const conectados = useMemo(() => conexoes.filter((c) => c.connected), [conexoes]);
  const pendentes = useMemo(() => conexoes.filter((c) => !c.connected), [conexoes]);

  const meta = useMemo(() => {
    const extras = (cliente?.dados_extras ?? {}) as { meta?: MetaExtras };
    return extras.meta ?? null;
  }, [cliente]);

  useEffect(() => {
    setAdAccountId(meta?.ad_account_id ?? "");
  }, [meta?.ad_account_id]);

  useEffect(() => {
    setCampanhas(null);
    setSelecionadas(
      new Set((meta?.campanhas ?? []).map((c) => String(c?.id ?? "")).filter(Boolean)),
    );
  }, [clienteId, meta?.campanhas]);

  const oauthUrl = clienteId ? buildOAuthUrl(clienteId) : null;
  const hasToken = Boolean(meta?.user_access_token || meta?.access_token);
  const connected = Boolean(meta?.access_token && meta?.page_id);
  const clienteNome = cliente?.nome ?? clientes.find((c) => c.id === clienteId)?.nome ?? "—";

  function selecionarCliente(id: string) {
    setClienteId(id);
    setPainelAberto(true);
  }

  async function saveAdAccount() {
    if (!clienteId || !cliente) return;
    setSavingAccount(true);
    try {
      const extras = ((cliente.dados_extras as Record<string, unknown> | null) ?? {}) as Record<
        string,
        unknown
      >;
      const prevMeta = {
        ...((extras.meta as Record<string, unknown> | undefined) ?? {}),
      };
      // Não reexpor catálogo da BM se ainda existir em dados antigos.
      delete prevMeta.ad_accounts;
      delete prevMeta.pages;
      const nextMeta = {
        ...prevMeta,
        ad_account_id: adAccountId.trim() || null,
      };
      const { error } = await supabase
        .from("clientes")
        .update({ dados_extras: { ...extras, meta: nextMeta } as Json })
        .eq("id", clienteId);
      if (error) throw error;
      toast.success("Ad Account ID salvo.");
      setCampanhas(null);
      void queryClient.invalidateQueries({ queryKey: ["cliente-meta", clienteId] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "meta-conexoes"] });
    } catch {
      toast.error("Não foi possível salvar o Ad Account ID.");
    } finally {
      setSavingAccount(false);
    }
  }

  async function carregarCampanhas() {
    if (!clienteId) return;
    setCarregandoCampanhas(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta_list_campaigns", {
        body: { cliente_id: clienteId, days: 90 },
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string; campanhas?: CampanhaDisponivel[] };
      if (!payload?.ok) throw new Error(payload?.error || "Não foi possível listar campanhas.");
      setCampanhas(payload.campanhas ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message.slice(0, 180) : "Falha ao listar campanhas.");
    } finally {
      setCarregandoCampanhas(false);
    }
  }

  function alternarCampanha(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function salvarCampanhas() {
    if (!clienteId || !cliente) return;
    setSalvandoCampanhas(true);
    try {
      const extras = ((cliente.dados_extras as Record<string, unknown> | null) ?? {}) as Record<
        string,
        unknown
      >;
      const prevMeta = { ...((extras.meta as Record<string, unknown> | undefined) ?? {}) };
      const nome = (id: string) => campanhas?.find((c) => c.id === id)?.nome ?? null;
      const nextMeta = {
        ...prevMeta,
        campanhas: [...selecionadas].map((id) => ({ id, nome: nome(id) })),
      };
      const { error } = await supabase
        .from("clientes")
        .update({ dados_extras: { ...extras, meta: nextMeta } as Json })
        .eq("id", clienteId);
      if (error) throw error;
      toast.success(
        selecionadas.size === 0
          ? "Nenhuma campanha liberada — o sync não importa nada para este cliente."
          : `${selecionadas.size} campanha(s) liberada(s) para ${clienteNome}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["cliente-meta", clienteId] });
    } catch {
      toast.error("Não foi possível salvar as campanhas.");
    } finally {
      setSalvandoCampanhas(false);
    }
  }

  async function syncLeadsFromForms() {
    if (!clienteId) return;
    if (!meta?.page_id || !meta?.access_token) {
      toast.error("Conecte a página Meta antes de importar leads.");
      return;
    }
    setSyncingLeads(true);
    try {
      const { data, error } = await Promise.race([
        supabase.functions.invoke("sync_meta_leads", {
          body: { cliente_id: clienteId, days: 90 },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "A importação passou de 1 minuto. Atualize a lista de leads — o que já chegou está no CRM — e clique de novo se ainda faltar.",
                ),
              ),
            60_000,
          ),
        ),
      ]);
      if (error) throw error;
      const payload = data as {
        ok?: boolean;
        error?: string;
        resultados?: Array<{
          inseridos?: number;
          atualizados?: number;
          ignorados?: number;
          erros?: number;
          erro?: string;
          forms?: number;
          formErrors?: string[];
          motivo?: string;
          truncated?: boolean;
        }>;
      };
      if (!payload?.ok) throw new Error(payload?.error || "Importação falhou.");
      const first = payload.resultados?.[0];
      if (first?.erro) {
        const needsPerm = /permission|pages_manage_ads|leads_retrieval|#200/i.test(first.erro);
        toast.error(
          needsPerm
            ? "Meta sem permissão para ler formulários. Reconecte o Meta BM (aceite as novas permissões) e tente de novo."
            : first.erro.slice(0, 180),
        );
      } else if (first?.motivo === "campanhas_nao_selecionadas") {
        toast.warning("Nenhuma campanha liberada para este cliente", {
          description:
            "Marque só as campanhas dele antes de importar leads. Sem isso o CRM mistura formulários da mesma página.",
        });
      } else if (first?.truncated) {
        toast.success(
          `${first.inseridos ?? 0} lead(s) importado(s) nesta rodada. Clique de novo para continuar o restante.`,
        );
      } else if ((first?.inseridos ?? 0) === 0 && (first?.atualizados ?? 0) === 0) {
        toast.message("Nenhum lead novo importado", {
          description:
            (first?.forms ?? 0) === 0
              ? "Nenhum formulário Lead Ads encontrado nesta página."
              : `${first?.ignorados ?? 0} já estavam no CRM ou fora do período (90 dias).`,
        });
      } else {
        const parts = [
          (first?.inseridos ?? 0) > 0 ? `${first!.inseridos} novo(s)` : null,
          (first?.atualizados ?? 0) > 0
            ? `${first!.atualizados} com atribuição Meta atualizada`
            : null,
        ].filter(Boolean);
        toast.success(parts.join(" · ") || "Importação concluída");
      }
      void queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard-clientes"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard-tabgha"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível importar leads.");
    } finally {
      setSyncingLeads(false);
    }
  }

  async function syncMetrics() {
    if (!clienteId) return;
    if (!adAccountId.trim() && !meta?.ad_account_id) {
      toast.error("Informe e salve o Ad Account ID antes de sincronizar.");
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync_ads_metrics", {
        body: { cliente_id: clienteId, days: 30 },
      });
      if (error) throw error;
      const payload = data as {
        ok?: boolean;
        error?: string;
        resultados?: Array<{
          meta?: {
            inseridos?: number;
            erro?: string;
            erros?: string[];
            motivo?: string;
            auto_switched?: boolean;
            linhas_descartadas?: number;
            ad_account_id?: string;
            motivo?: string;
          };
        }>;
      };
      if (!payload?.ok) throw new Error(payload?.error || "Sync falhou.");
      const first = payload.resultados?.[0]?.meta;
      if (first?.erro || first?.erros?.length) {
        toast.error(`Sync com erros: ${first?.erro ?? first?.erros?.[0]}`);
      } else if (first?.motivo === "campanhas_nao_selecionadas") {
        toast.warning("Nenhuma campanha liberada para este cliente", {
          description:
            "Liste as campanhas da conta e marque só as deste cliente. Sem isso o sync não importa nada — é o que impede o gasto da IAplicada/Tabgha aparecer no portal dele.",
        });
      } else if (first?.motivo === "ad_account_missing") {
        toast.warning("Ad Account não informado", {
          description: "Informe e salve o Ad Account deste cliente antes de sincronizar.",
        });
      } else if ((first?.inseridos ?? 0) === 0) {
        toast.message("Sync ok, mas sem insights no período", {
          description:
            first?.motivo === "no_insights_in_range"
              ? "Confira se o Ad Account certo está selecionado e se houve gasto nos últimos 30 dias nas campanhas liberadas."
              : "Nenhuma linha inserida. Verifique o Ad Account ID.",
        });
      } else {
        toast.success(
          `Métricas sincronizadas (${first?.inseridos ?? 0} linhas nos últimos 30 dias).`,
          (first?.linhas_descartadas ?? 0) > 0
            ? {
                description: `${first!.linhas_descartadas} linha(s) de campanhas não liberadas foram ignoradas.`,
              }
            : undefined,
        );
      }
      void queryClient.invalidateQueries({ queryKey: ["meta-ads-db"] });
      void queryClient.invalidateQueries({ queryKey: ["cliente-meta", clienteId] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "meta-conexoes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível sincronizar.");
    } finally {
      setSyncing(false);
    }
  }

  async function inspectToken() {
    const token = tokenInput.trim();
    if (!token && !hasToken) {
      toast.error("Cole o token da Meta antes de validar.");
      return;
    }
    setInspecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-connect-token", {
        body: {
          action: "inspect",
          access_token: token || undefined,
          cliente_id: clienteId,
        },
      });
      if (error) throw new Error(await invokeErrorMessage(error, error.message));
      const payload = data as {
        ok?: boolean;
        error?: string;
        me?: { id?: string; name?: string };
        pages?: MetaInspectPage[];
        ad_accounts?: MetaInspectAccount[];
      };
      if (!payload?.ok) throw new Error(payload?.error || "Token inválido.");
      const pages = payload.pages ?? [];
      const accounts = payload.ad_accounts ?? [];
      setInspectedPages(pages);
      setInspectedAccounts(accounts);
      setPickedPageId(
        meta?.page_id && pages.some((p) => p.id === meta.page_id) ? meta.page_id : "",
      );
      const savedAccount = (meta?.ad_account_id ?? "").replace(/^act_/, "");
      setPickedAccountId(
        savedAccount && accounts.some((a) => a.id === savedAccount) ? savedAccount : "",
      );
      setTokenMeName(payload.me?.name ?? payload.me?.id ?? "Token válido");
      if (pages.length === 0 && accounts.length === 0) {
        toast.message("Token válido, mas sem páginas/contas listadas", {
          description: "Informe page_id e Ad Account ID manualmente abaixo.",
        });
      } else {
        toast.success(
          "Token válido. Escolha a página e a Ad Account DESTE cliente — não a da IAplicada.",
        );
      }
    } catch (e) {
      setInspectedPages([]);
      setInspectedAccounts([]);
      setTokenMeName(null);
      toast.error(e instanceof Error ? e.message : "Não foi possível validar o token.");
    } finally {
      setInspecting(false);
    }
  }

  async function saveTokenConnection() {
    const token = tokenInput.trim();
    const pageId = pickedPageId.trim() || manualPageId.trim() || meta?.page_id || "";
    const accountId = pickedAccountId.trim() || adAccountId.trim() || meta?.ad_account_id || "";
    if (!clienteId) return;
    if (!token && !hasToken) {
      toast.error("Cole o token da Meta.");
      return;
    }
    if (!pageId) {
      toast.error("Informe a página Meta deste cliente.");
      return;
    }
    setSavingToken(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-connect-token", {
        body: {
          action: "save",
          cliente_id: clienteId,
          access_token: token || undefined,
          page_id: pageId,
          ad_account_id: accountId || undefined,
        },
      });
      if (error) throw new Error(await invokeErrorMessage(error, error.message));
      const payload = data as {
        ok?: boolean;
        error?: string;
        page_name?: string;
        ad_account_id?: string;
      };
      if (!payload?.ok) throw new Error(payload?.error || "Falha ao salvar conexão.");
      if (payload.ad_account_id) setAdAccountId(payload.ad_account_id);
      setTokenInput("");
      setInspectedPages([]);
      setInspectedAccounts([]);
      setTokenMeName(null);
      toast.success(`Meta conectada${payload.page_name ? ` · ${payload.page_name}` : ""}.`);
      void queryClient.invalidateQueries({ queryKey: ["cliente-meta", clienteId] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "meta-conexoes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a conexão.");
    } finally {
      setSavingToken(false);
    }
  }

  async function disconnect() {
    if (!clienteId || !cliente) return;
    setDisconnecting(true);
    try {
      const extras = { ...((cliente.dados_extras as object) ?? {}) } as Record<string, Json>;
      delete extras.meta;
      const { error } = await supabase
        .from("clientes")
        .update({ dados_extras: extras as Json })
        .eq("id", clienteId);
      if (error) throw error;
      toast.success("Meta desconectado.");
      void queryClient.invalidateQueries({ queryKey: ["cliente-meta", clienteId] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "meta-conexoes"] });
    } catch {
      toast.error("Não foi possível desconectar.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="w-full min-h-full space-y-6 px-6 py-6 lg:px-8">
      <header className="w-full animate-fade-up">
        <h1 className="text-xl font-bold tracking-tight">Conexões Meta</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Uma BM/conta costuma ter campanhas da agência e de várias clínicas. Conecte o token,
          escolha a Ad Account e marque só as campanhas deste cliente. Sem essa lista o sync não
          importa nada — para o gasto da IAplicada não vazar no portal errado.
        </p>
      </header>

      <section className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Carteira
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Clientes e Meta</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-emerald-700">{conectados.length}</span> conectados
            {" · "}
            <span className="font-semibold text-slate-700">{pendentes.length}</span> pendentes
          </p>
        </div>

        {loadingConexoes ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando conexões…
          </div>
        ) : conexoes.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:grid">
              <span>Cliente</span>
              <span>Página Meta</span>
              <span>Ad Account</span>
              <span className="text-right">Status</span>
            </div>
            <ul className="divide-y divide-border">
              {conexoes.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => selecionarCliente(row.id)}
                    className={cn(
                      "grid w-full grid-cols-1 gap-1 px-4 py-3 text-left transition-colors hover:bg-secondary/40 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] sm:items-center sm:gap-3",
                      row.id === clienteId && painelAberto && "bg-sky-50/80 hover:bg-sky-50",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{row.nome}</p>
                      {row.connected_at ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Conectado em {new Date(row.connected_at).toLocaleDateString("pt-BR")}
                        </p>
                      ) : null}
                    </div>
                    <div className="min-w-0 text-sm text-muted-foreground">
                      {row.connected ? (
                        <>
                          <p className="truncate font-medium text-slate-800">
                            {row.page_name ?? "Página Meta"}
                          </p>
                          <p className="truncate font-mono text-[11px]">page_id {row.page_id}</p>
                        </>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </div>
                    <div className="min-w-0 text-sm text-muted-foreground">
                      {row.ad_account_id ? (
                        <span className="font-mono text-xs">{row.ad_account_id}</span>
                      ) : (
                        <span className="text-xs">{row.connected ? "não informado" : "—"}</span>
                      )}
                    </div>
                    <div className="sm:justify-self-end">
                      {row.connected ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Conectado
                        </span>
                      ) : row.hasToken ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                          Token salvo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                          <Link2Off className="h-3.5 w-3.5" />
                          Pendente
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <button
          type="button"
          onClick={() => setPainelAberto((v) => !v)}
          className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/30 sm:px-6"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Gerenciar conexão
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">
              {clienteNome}
              {connected ? (
                <span className="ml-2 font-normal text-emerald-700">
                  · {meta?.page_name ?? "Meta conectada"}
                </span>
              ) : (
                <span className="ml-2 font-normal text-muted-foreground">· sem conexão</span>
              )}
            </p>
            {connected && meta?.ad_account_id ? (
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                act {meta.ad_account_id}
              </p>
            ) : null}
          </div>
          {connected ? (
            <span className="hidden shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 sm:inline-flex">
              Conectado
            </span>
          ) : (
            <span className="hidden shrink-0 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground sm:inline-flex">
              Pendente
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
              painelAberto && "rotate-180",
            )}
          />
        </button>

        {painelAberto ? (
          <div className="space-y-5 border-t border-border px-5 py-5 sm:px-6">
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente</Label>
              {loadingClientes ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <select
                  id="cliente"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="w-full max-w-md rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
                >
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando…
              </div>
            ) : hasToken ? (
              <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    {connected ? "Conectado" : "Token salvo"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {meta?.page_name ?? (connected ? "Página Meta" : "Escolha a página deste cliente")}
                    {meta?.page_id ? ` · page_id ${meta.page_id}` : ""}
                  </p>
                  {meta?.expires_at ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Expira em {new Date(meta.expires_at).toLocaleString("pt-BR")}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Token sem expiração visível
                      {meta?.connected_via === "token" ? " · conectado via System User/token" : ""}
                    </p>
                  )}
                  {!connected ? (
                    <p className="mt-2 text-xs text-amber-800">
                      O token está gravado neste cliente. Carregue os ativos e marque a página e a
                      Ad Account dele — nunca a da IAplicada/Tabgha se aparecer na lista.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-xl border border-sky-200/80 bg-white/80 p-4">
                  <p className="text-sm font-medium text-slate-900">Atualizar token</p>
                  <p className="text-xs text-muted-foreground">
                    Cole um token novo se faltar permissão de formulário (leads_retrieval). Página,
                    conta e campanhas já salvas permanecem.
                  </p>
                  <Textarea
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="EAAxxxxxxx…"
                    className="min-h-[72px] font-mono text-xs"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    className="rounded-xl bg-sky-600 hover:bg-sky-700"
                    disabled={savingToken || !tokenInput.trim()}
                    onClick={() => void saveTokenConnection()}
                  >
                    {savingToken ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar token
                  </Button>
                </div>

                <div className="space-y-3 rounded-xl border border-emerald-200/80 bg-white/70 p-4">
                  <p className="text-sm font-medium text-slate-900">Página e Ad Account deste cliente</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      disabled={inspecting}
                      onClick={() => void inspectToken()}
                    >
                      {inspecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Carregar páginas e contas
                    </Button>
                    <Button
                      type="button"
                      className="rounded-xl bg-sky-600 hover:bg-sky-700"
                      disabled={savingToken}
                      onClick={() => void saveTokenConnection()}
                    >
                      {savingToken ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Salvar página/conta
                    </Button>
                  </div>
                  {inspectedPages.length > 0 ? (
                    <div className="space-y-2">
                      <Label htmlFor="meta-page-saved">Página deste cliente</Label>
                      <select
                        id="meta-page-saved"
                        value={pickedPageId}
                        onChange={(e) => setPickedPageId(e.target.value)}
                        className="w-full max-w-lg rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
                      >
                        <option value="">Selecione a página deste cliente</option>
                        {inspectedPages.map((page) => (
                          <option key={page.id} value={page.id}>
                            {page.name} · {page.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="manual-page-saved">Page ID</Label>
                      <Input
                        id="manual-page-saved"
                        value={manualPageId}
                        onChange={(e) => setManualPageId(e.target.value)}
                        placeholder="ID da Página do Facebook"
                        className="max-w-lg"
                      />
                    </div>
                  )}
                  {inspectedAccounts.length > 0 ? (
                    <div className="space-y-2">
                      <Label htmlFor="meta-ad-account-saved">Ad Account deste cliente</Label>
                      <select
                        id="meta-ad-account-saved"
                        value={pickedAccountId}
                        onChange={(e) => {
                          setPickedAccountId(e.target.value);
                          setAdAccountId(e.target.value);
                        }}
                        className="w-full max-w-lg rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
                      >
                        <option value="">Selecione a Ad Account deste cliente</option>
                        {inspectedAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} · act_{account.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adAccount">Ad Account deste cliente</Label>
                  <div className="max-w-lg rounded-xl border border-emerald-200/80 bg-white/70 px-3 py-2.5 text-sm">
                    <p className="font-medium text-slate-900">
                      {meta?.ad_account_name?.trim() || "Conta vinculada"}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      act_{adAccountId.trim() || meta?.ad_account_id || "—"}
                    </p>
                  </div>
                  <Input
                    id="adAccount"
                    value={adAccountId}
                    onChange={(e) => setAdAccountId(e.target.value)}
                    placeholder="ID da Ad Account (somente desta clínica)"
                    className="w-full max-w-lg"
                    autoComplete="off"
                  />
                  <div className="flex max-w-lg flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void saveAdAccount()}
                      disabled={savingAccount || !adAccountId.trim()}
                      className="shrink-0"
                    >
                      {savingAccount ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Salvar Ad Account
                    </Button>
                  </div>
                  <p className="max-w-lg text-xs text-muted-foreground">
                    Informe só a conta deste cliente. O servidor nunca escolhe nem troca a conta
                    sozinho.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label>Campanhas deste cliente</Label>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        selecionadas.size > 0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-800",
                      )}
                    >
                      {selecionadas.size > 0
                        ? `${selecionadas.size} liberada(s)`
                        : "nenhuma liberada"}
                    </span>
                  </div>

                  {selecionadas.size === 0 ? (
                    <p className="max-w-lg text-xs text-amber-700">
                      Enquanto nenhuma campanha estiver marcada, o sync não importa métrica para{" "}
                      {clienteNome}. Sem a lista não dá para separar o que é dele do que é da
                      IAplicada/Tabgha na mesma conta.
                    </p>
                  ) : null}

                  <div className="flex max-w-lg flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void carregarCampanhas()}
                      disabled={carregandoCampanhas || !(adAccountId.trim() || meta?.ad_account_id)}
                      className="shrink-0"
                    >
                      {carregandoCampanhas ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Listar campanhas da conta
                    </Button>
                    {campanhas ? (
                      <Button
                        onClick={() => void salvarCampanhas()}
                        disabled={salvandoCampanhas}
                        className="shrink-0"
                      >
                        {salvandoCampanhas ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Salvar seleção
                      </Button>
                    ) : null}
                  </div>

                  {campanhas ? (
                    campanhas.length === 0 ? (
                      <p className="max-w-lg text-xs text-muted-foreground">
                        Nenhuma campanha ativa/pausada nem com veiculação nos últimos 90 dias nesta
                        conta.
                      </p>
                    ) : (
                      <ul className="max-h-72 max-w-lg divide-y divide-emerald-200/70 overflow-y-auto rounded-xl border border-emerald-200/80 bg-white/70">
                        {campanhas.map((c) => (
                          <li key={c.id}>
                            <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm hover:bg-emerald-50/60">
                              <input
                                type="checkbox"
                                checked={selecionadas.has(c.id)}
                                onChange={() => alternarCampanha(c.id)}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-slate-900">
                                  {c.nome}
                                </span>
                                <span className="block font-mono text-[11px] text-muted-foreground">
                                  {c.id}
                                  {c.status ? ` · ${c.status}` : ""} ·{" "}
                                  {c.investimento.toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })}{" "}
                                  em 90d
                                </span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="rounded-xl bg-sky-600 hover:bg-sky-700"
                    disabled={syncing || !(adAccountId.trim() || meta?.ad_account_id)}
                    onClick={() => void syncMetrics()}
                  >
                    {syncing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sincronizar métricas (30d)
                  </Button>
                  <Button
                    variant="secondary"
                    className="rounded-xl"
                    disabled={syncingLeads || selecionadas.size === 0}
                    onClick={() => void syncLeadsFromForms()}
                  >
                    {syncingLeads ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Users className="mr-2 h-4 w-4" />
                    )}
                    Importar leads dos formulários
                  </Button>
                  {oauthUrl ? (
                    <Button asChild variant="outline" className="rounded-xl">
                      <a href={oauthUrl}>
                        Reconectar
                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                    disabled={disconnecting}
                    onClick={() => void disconnect()}
                  >
                    {disconnecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Unplug className="mr-2 h-4 w-4" />
                    )}
                    Desconectar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-5 text-sm text-muted-foreground">
                  <Link2Off className="mb-2 h-5 w-5" />
                  Nenhuma conexão Meta para este cliente. Use o login da Meta ou cole um token da
                  BM (mesmo padrão que funciona no Focus).
                </div>

                <div className="space-y-3 rounded-xl border border-border p-4">
                  <p className="text-sm font-semibold text-foreground">Login Meta Business</p>
                  <p className="text-xs text-muted-foreground">
                    Abre o Facebook para autorizar a BM desta clínica. Se aparecer “Feature
                    Unavailable”, o app ainda não tem Facebook Login for Business — use o token
                    abaixo.
                  </p>
                  {oauthUrl ? (
                    <Button asChild className="rounded-xl bg-sky-600 hover:bg-sky-700">
                      <a href={oauthUrl}>
                        Conectar Meta Business
                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : (
                    <p className="text-sm text-amber-700">
                      Configure <code>VITE_META_APP_ID</code> no .env e os secrets{" "}
                      <code>META_APP_ID</code> / <code>META_APP_SECRET</code> no Supabase.
                    </p>
                  )}
                  {!META_LOGIN_CONFIG_ID ? (
                    <p className="text-xs text-amber-700">
                      Sem <code>VITE_META_LOGIN_CONFIG_ID</code>: o diálogo usa Login antigo e
                      costuma falhar em app Business. Crie a configuração em Meta Developers →
                      Facebook Login for Business e coloque o ID no .env.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
                  <p className="text-sm font-semibold text-foreground">Conectar com token</p>
                  <p className="text-xs text-muted-foreground">
                    Gere um token de System User na BM da clínica (ou da Tabgha, se a conta de
                    anúncios estiver nela) com <code>ads_read</code>, <code>leads_retrieval</code>{" "}
                    e permissões de páginas. Cole aqui, valide e escolha a página/Ad Account deste
                    cliente.
                  </p>
                  <Textarea
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="EAAxxxxxxx…"
                    className="min-h-[88px] font-mono text-xs"
                    autoComplete="off"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      disabled={inspecting || (!tokenInput.trim() && !hasToken)}
                      onClick={() => void inspectToken()}
                    >
                      {inspecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Validar token
                    </Button>
                    <Button
                      type="button"
                      className="rounded-xl bg-sky-600 hover:bg-sky-700"
                      disabled={savingToken || (!tokenInput.trim() && !hasToken)}
                      onClick={() => void saveTokenConnection()}
                    >
                      {savingToken ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Salvar conexão
                    </Button>
                  </div>
                  {tokenMeName ? (
                    <p className="text-xs text-emerald-700">Token de {tokenMeName}</p>
                  ) : null}
                  {inspectedPages.length > 0 ? (
                    <div className="space-y-2">
                      <Label htmlFor="meta-page">Página deste cliente</Label>
                      <select
                        id="meta-page"
                        value={pickedPageId}
                        onChange={(e) => setPickedPageId(e.target.value)}
                        className="w-full max-w-lg rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
                      >
                        <option value="">Selecione a página deste cliente</option>
                        {inspectedPages.map((page) => (
                          <option key={page.id} value={page.id}>
                            {page.name} · {page.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="manual-page">Page ID (se a lista vier vazia)</Label>
                      <Input
                        id="manual-page"
                        value={manualPageId}
                        onChange={(e) => setManualPageId(e.target.value)}
                        placeholder="ID da Página do Facebook"
                        className="max-w-lg"
                      />
                    </div>
                  )}
                  {inspectedAccounts.length > 0 ? (
                    <div className="space-y-2">
                      <Label htmlFor="meta-ad-account">Ad Account deste cliente</Label>
                      <select
                        id="meta-ad-account"
                        value={pickedAccountId}
                        onChange={(e) => setPickedAccountId(e.target.value)}
                        className="w-full max-w-lg rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
                      >
                        <option value="">Selecione a Ad Account deste cliente</option>
                        {inspectedAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} · act_{account.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="manual-ad-account">Ad Account ID</Label>
                      <Input
                        id="manual-ad-account"
                        value={adAccountId}
                        onChange={(e) => setAdAccountId(e.target.value)}
                        placeholder="ex.: 1234567890"
                        className="max-w-lg"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <button
          type="button"
          onClick={() => setSetupAberto((v) => !v)}
          className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-secondary/30 sm:px-6"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Setup técnico Meta</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Permissões, webhook e secrets — só se precisar configurar o app Developers
            </p>
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
              setupAberto && "rotate-180",
            )}
          />
        </button>
        {setupAberto ? (
          <div className="border-t border-border px-5 py-4 text-sm leading-relaxed text-muted-foreground sm:px-6">
            <ol className="list-decimal space-y-2 pl-4">
              <li>App Business em developers.facebook.com (conta IAplicada)</li>
              <li>
                Use <strong>Facebook Login for Business</strong> (não o Login de consumidor). Crie
                uma configuração com as permissões abaixo e coloque o ID em{" "}
                <code>VITE_META_LOGIN_CONFIG_ID</code>
              </li>
              <li>
                Permissões: <code>leads_retrieval</code>, <code>ads_read</code>,{" "}
                <code>pages_show_list</code>, <code>pages_manage_ads</code>,{" "}
                <code>pages_manage_metadata</code>, <code>business_management</code>
              </li>
              <li className="break-all">
                Valid OAuth Redirect URI:{" "}
                <code>{SUPABASE_URL}/functions/v1/meta-oauth-callback</code>
              </li>
              <li>
                Secrets no Supabase: <code>META_APP_ID</code>, <code>META_APP_SECRET</code>,{" "}
                <code>META_WEBHOOK_VERIFY_TOKEN</code>
              </li>
              <li>
                Webhooks · Page · <code>leadgen</code>. Callback:{" "}
                <code className="break-all">{SUPABASE_URL}/functions/v1/webhook_meta_lead</code>
              </li>
              <li>
                Atalho que já funciona hoje: token de System User da BM → Validar token → escolher
                página e Ad Account deste cliente
              </li>
              <li>
                Depois de conectar, <strong>Sincronizar métricas</strong> e{" "}
                <strong>Importar leads dos formulários</strong>
              </li>
            </ol>
          </div>
        ) : null}
      </section>
    </div>
  );
}
