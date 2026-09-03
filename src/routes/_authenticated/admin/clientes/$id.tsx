import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  ArrowLeft,
  Sparkles,
  Save,
  RefreshCw,
  ChevronDown,
  Stethoscope,
  Trash2,
  Mic,
  MicOff,
  FileText,
  Upload,
  UserPlus,
  MessageSquare,
  Bot,
  Gauge,
  Radio,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import {
  deleteClienteAdmin,
  updateClienteAdmin,
} from "@/functions/clientes/createClientWithAccess.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Json, Tables } from "@/integrations/supabase/types";
import { WhatsappConnectCard } from "@/components/whatsapp/WhatsappConnectCard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CreateLeadDialog } from "@/components/crm/CreateLeadDialog";
import { LeadDetailDialog } from "@/components/crm/LeadDetailDialog";
import type { Lead as CrmLead } from "@/hooks/useLeads";
import { syncAgenteAtivoInstances } from "@/lib/pietro";

export const Route = createFileRoute("/_authenticated/admin/clientes/$id")({
  component: ClienteFichaPage,
  head: () => ({ meta: [{ title: "Ficha do cliente · Tabgha OS" }] }),
});

type Cliente = Tables<"clientes">;
type Lead = Tables<"leads">;
type Conteudo = Tables<"conteudos">;

// ── Helpers ────────────────────────────────────────────────────────────────────

function SectionHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "mt-6 mb-3 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1.5",
        className,
      )}
    >
      {children}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

// ── Tab: Cadastro ─────────────────────────────────────────────────────────────
function TabCadastro({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();
  const [diagOpen, setDiagOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      nome: cliente.nome,
      email: cliente.email ?? "",
      telefone: cliente.telefone ?? "",
      cnpj: cliente.cnpj ?? "",
      razao_social: cliente.razao_social ?? "",
      especialidade: cliente.especialidade ?? "",
      status: cliente.status,
    },
  });

  useEffect(() => {
    form.reset({
      nome: cliente.nome,
      email: cliente.email ?? "",
      telefone: cliente.telefone ?? "",
      cnpj: cliente.cnpj ?? "",
      razao_social: cliente.razao_social ?? "",
      especialidade: cliente.especialidade ?? "",
      status: cliente.status,
    });
  }, [cliente, form]);

  const { data: quickStats } = useQuery({
    queryKey: ["admin", "cliente", cliente.id, "quick-stats"],
    staleTime: 120_000,
    queryFn: async () => {
      const [leadsTotal, leadsConv, conteudosTotal, conteudosAprov] = await Promise.all([
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", cliente.id),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", cliente.id)
          .eq("status", "convertido"),
        supabase
          .from("conteudos")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", cliente.id),
        supabase
          .from("conteudos")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", cliente.id)
          .eq("status", "aprovacao"),
      ]);
      return {
        leads: leadsTotal.count ?? 0,
        convertidos: leadsConv.count ?? 0,
        conteudos: conteudosTotal.count ?? 0,
        aprovacao: conteudosAprov.count ?? 0,
      };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const values = form.getValues();
      if (!values.nome.trim()) throw new Error("Nome é obrigatório.");
      await updateClienteAdmin({
        id: cliente.id,
        nome: values.nome,
        email: values.email,
        telefone: values.telefone,
        cnpj: values.cnpj,
        razao_social: values.razao_social,
        especialidade: values.especialidade,
        status: values.status,
      });
    },
    onSuccess: () => {
      toast.success("Dados atualizados.");
      void qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] });
      void qc.invalidateQueries({ queryKey: ["admin", "clientes"] });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar."),
  });

  const extras = (cliente.dados_extras ?? {}) as Record<string, unknown>;
  const redesData = extras.redes as Record<string, string> | undefined;
  const redesConectadas = redesData ? Object.values(redesData).filter(Boolean).length : 0;
  const diagPreenchido = !!cliente.diagnostico;

  return (
    <div className="py-5 space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_268px]">
        {/* ── Campos em card estilizado ── */}
        <form onSubmit={form.handleSubmit(() => save.mutate())}>
          <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
            {/* Identificação */}
            <div className="px-5 pt-5 pb-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Identificação
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nome">
                  <Input {...form.register("nome")} />
                </Field>
                <Field label="Email do consultório">
                  <Input type="email" {...form.register("email")} />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Se existir login de portal com o email antigo, ele também é atualizado no Auth —
                    assim você consegue liberar o email certo para outro usuário.
                  </p>
                </Field>
                <Field label="Telefone">
                  <Input {...form.register("telefone")} />
                </Field>
                <Field label="Especialidade">
                  <Input {...form.register("especialidade")} />
                </Field>
              </div>
            </div>

            {/* Dados fiscais */}
            <div className="border-t border-border px-5 py-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Dados fiscais
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="CNPJ">
                  <Input {...form.register("cnpj")} />
                </Field>
                <Field label="Razão Social">
                  <Input {...form.register("razao_social")} />
                </Field>
              </div>
            </div>

            {/* Status + ação */}
            <div className="border-t border-border px-5 py-4 flex items-end gap-4">
              <div className="w-48">
                <Field label="Status">
                  <Select
                    value={form.watch("status")}
                    onValueChange={(v) => form.setValue("status", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["onboarding", "ativo", "pausa", "inativo"].map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Button type="submit" disabled={save.isPending} className="mb-0.5">
                {save.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </form>

        {/* ── Sidebar de resumo ── */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Resumo da conta
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-secondary/60 p-3 text-center">
                <p className="text-2xl font-extrabold tracking-tight">{quickStats?.leads ?? "—"}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">leads total</p>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                <p className="text-2xl font-extrabold tracking-tight text-emerald-600">
                  {quickStats?.convertidos ?? "—"}
                </p>
                <p className="mt-0.5 text-[10px] text-emerald-700">convertidos</p>
              </div>
              <div className="rounded-xl bg-secondary/60 p-3 text-center">
                <p className="text-2xl font-extrabold tracking-tight">
                  {quickStats?.conteudos ?? "—"}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">conteúdos</p>
              </div>
              {(quickStats?.aprovacao ?? 0) > 0 ? (
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                  <p className="text-2xl font-extrabold tracking-tight text-amber-600">
                    {quickStats!.aprovacao}
                  </p>
                  <p className="mt-0.5 text-[10px] text-amber-700">aguard. aprovação</p>
                </div>
              ) : (
                <div className="rounded-xl bg-secondary/60 p-3 text-center">
                  <p className="text-2xl font-extrabold tracking-tight text-emerald-500">✓</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">sem pendências</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Informações
            </p>
            <div className="space-y-2.5 text-xs">
              {cliente.criado_em && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cadastro</span>
                  <span className="font-medium">
                    {format(new Date(cliente.criado_em), "dd MMM yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}
              {redesConectadas > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Redes conectadas</span>
                  <span className="font-medium text-emerald-600">{redesConectadas}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {cliente.id.slice(0, 8)}…
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Diagnóstico colapsável ── */}
      <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
        <button
          type="button"
          onClick={() => setDiagOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-secondary/30 transition-colors"
        >
          <div className="icon-chip icon-chip-blue h-8 w-8 shrink-0">
            <Stethoscope className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Diagnóstico estratégico</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {diagPreenchido
                ? "Publicado no portal — envie nova fonte para regenerar"
                : "Cole a transcrição ou anexe arquivo para gerar e publicar"}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              diagPreenchido ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700",
            )}
          >
            {diagPreenchido ? "Publicado" : "Pendente"}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              diagOpen && "rotate-180",
            )}
          />
        </button>
        <div className={cn("border-t border-border px-5", diagOpen ? "block" : "hidden")}>
          <TabDiagnostico cliente={cliente} />
        </div>
      </div>
    </div>
  );
}

// ── DiagnosticoData types ─────────────────────────────────────────────────────
type DiagnosticoData = {
  resumo: string;
  perfil: {
    especialidade: string;
    cidade: string;
    tempo_mercado: string;
    publico_alvo: string;
    ticket_medio: string;
    diferencial: string;
  };
  jornada: {
    canais_aquisicao: string;
    funil: string;
    objecoes: string;
    taxa_agendamento: string;
    taxa_conversao: string;
  };
  dores: { principais: string; marketing: string; operacional: string };
  concorrentes: string;
  /** Interno Tabgha — sugestões de demanda; NÃO exibir no portal do médico */
  demandas_sugeridas: string;
  gerado_em?: string;
};

const EMPTY_DIAG: DiagnosticoData = {
  resumo: "",
  perfil: {
    especialidade: "",
    cidade: "",
    tempo_mercado: "",
    publico_alvo: "",
    ticket_medio: "",
    diferencial: "",
  },
  jornada: {
    canais_aquisicao: "",
    funil: "",
    objecoes: "",
    taxa_agendamento: "",
    taxa_conversao: "",
  },
  dores: { principais: "", marketing: "", operacional: "" },
  concorrentes: "",
  demandas_sugeridas: "",
};

function parseDiag(raw: unknown): DiagnosticoData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_DIAG;
  const r = raw as Record<string, unknown>;
  const perfil =
    r.perfil && typeof r.perfil === "object" && !Array.isArray(r.perfil)
      ? (r.perfil as Record<string, unknown>)
      : {};
  const jornada =
    r.jornada && typeof r.jornada === "object" && !Array.isArray(r.jornada)
      ? (r.jornada as Record<string, unknown>)
      : {};
  const dores =
    r.dores && typeof r.dores === "object" && !Array.isArray(r.dores)
      ? (r.dores as Record<string, unknown>)
      : {};
  const demandasRaw = r.demandas_sugeridas ?? r.plano_acao;
  return {
    resumo: typeof r.resumo === "string" ? r.resumo : "",
    perfil: {
      especialidade: String(perfil.especialidade ?? ""),
      cidade: String(perfil.cidade ?? ""),
      tempo_mercado: String(perfil.tempo_mercado ?? ""),
      publico_alvo: String(perfil.publico_alvo ?? ""),
      ticket_medio: String(perfil.ticket_medio ?? ""),
      diferencial: String(perfil.diferencial ?? ""),
    },
    jornada: {
      canais_aquisicao: String(jornada.canais_aquisicao ?? ""),
      funil: String(jornada.funil ?? ""),
      objecoes: String(jornada.objecoes ?? ""),
      taxa_agendamento: String(jornada.taxa_agendamento ?? ""),
      taxa_conversao: String(jornada.taxa_conversao ?? ""),
    },
    dores: {
      principais: String(dores.principais ?? ""),
      marketing: String(dores.marketing ?? ""),
      operacional: String(dores.operacional ?? ""),
    },
    concorrentes:
      typeof r.concorrentes === "string"
        ? r.concorrentes
        : Array.isArray(r.concorrentes)
          ? r.concorrentes.join("\n")
          : "",
    demandas_sugeridas:
      typeof demandasRaw === "string"
        ? demandasRaw
        : Array.isArray(demandasRaw)
          ? demandasRaw
              .map((a: unknown) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
              .join("\n")
          : "",
    gerado_em: typeof r.gerado_em === "string" ? r.gerado_em : undefined,
  };
}

function diagPreenchidoCheck(d: DiagnosticoData) {
  return Boolean(d.resumo.trim() || d.perfil.especialidade.trim() || d.dores.principais.trim());
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((ev: {
        resultIndex: number;
        results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
      }) => void)
    | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

async function invokeDiagnosticoEdge(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("gerar_diagnostico", { body });
  const payload = data as {
    error?: string;
    detail?: string;
    diagnostico?: unknown;
    plano_acao?: string;
    demandas_sugeridas?: string;
  } | null;

  if (error) {
    let fromContext: string | undefined;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const bodyJson = (await ctx.clone().json()) as { error?: string };
        fromContext = bodyJson?.error;
      }
    } catch {
      /* ignore */
    }
    const msg = payload?.error || fromContext || error.message || "Falha ao chamar a IA.";
    if (msg.includes("ANTHROPIC_API_KEY")) {
      throw new Error("IA indisponível: configure ANTHROPIC_API_KEY no Supabase.");
    }
    throw new Error(msg);
  }
  if (payload?.error) {
    throw new Error(payload.error);
  }
  return payload;
}

function PreviewField({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

// ── Tab: Diagnóstico ──────────────────────────────────────────────────────────
function TabDiagnostico({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();
  const [d, setD] = useState<DiagnosticoData>(() => parseDiag(cliente.diagnostico));
  const [generating, setGenerating] = useState(false);
  const [structuringActions, setStructuringActions] = useState(false);
  const [transcricao, setTranscricao] = useState("");
  const [fonteUrl, setFonteUrl] = useState("");
  const [genError, setGenError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [acoesError, setAcoesError] = useState<string | null>(null);
  const [notasBrutas, setNotasBrutas] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const notasBrutasRef = useRef("");
  const autoEstruturarRef = useRef(false);

  function appendNotasBrutas(chunk: string) {
    const text = chunk.trim();
    if (!text) return;
    const next = notasBrutasRef.current.trim() ? `${notasBrutasRef.current.trim()} ${text}` : text;
    notasBrutasRef.current = next;
    setNotasBrutas(next);
  }

  async function persistDiagnostico(next: DiagnosticoData) {
    const toSave = {
      ...next,
      plano_acao: next.demandas_sugeridas,
    };
    const { error } = await supabase
      .from("clientes")
      .update({ diagnostico: toSave as never })
      .eq("id", cliente.id);
    if (error) throw error;
    void qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] });
    void qc.invalidateQueries({ queryKey: ["cliente", "diagnostico"] });
  }

  async function gerarEPublicar(opts?: { transcricaoOverride?: string; urlOverride?: string }) {
    const fonte = (opts?.transcricaoOverride ?? transcricao).trim();
    const url = (opts?.urlOverride ?? fonteUrl).trim();
    if (!fonte && !url) {
      setGenError("Cole a transcrição, anexe um arquivo ou informe um link HTML.");
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const payload = await invokeDiagnosticoEdge({
        mode: "diagnostico",
        nome: cliente.nome,
        especialidade: cliente.especialidade ?? undefined,
        cidade: d.perfil.cidade || undefined,
        transcricao: fonte || undefined,
        fonte_url: url || undefined,
      });
      if (!payload?.diagnostico) {
        throw new Error("A IA não retornou o diagnóstico.");
      }
      const next = {
        ...parseDiag(payload.diagnostico),
        demandas_sugeridas: d.demandas_sugeridas,
        gerado_em: new Date().toISOString(),
      };
      setD(next);
      await persistDiagnostico(next);
      toast.success("Diagnóstico gerado e publicado no portal do cliente.");
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Erro ao gerar diagnóstico. Verifique a ANTHROPIC_API_KEY no Supabase.";
      setGenError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function onTranscriptFile(file: File | null) {
    if (!file) return;
    const ok =
      file.type.startsWith("text/") ||
      file.type.includes("html") ||
      /\.(txt|md|markdown|csv|json|html|htm)$/i.test(file.name);
    if (!ok) {
      toast.error("Envie texto ou HTML (.txt, .md, .html). PDF/Word em breve.");
      return;
    }
    try {
      const text = await file.text();
      const merged = transcricao ? `${transcricao.trim()}\n\n${text.trim()}` : text.trim();
      setTranscricao(merged);
      toast.message(`Arquivo “${file.name}” carregado — gerando diagnóstico…`);
      await gerarEPublicar({ transcricaoOverride: merged });
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  }

  async function estruturarDemandasComIA(notasOverride?: string) {
    const notas = notasOverride?.trim() || notasBrutasRef.current.trim() || notasBrutas.trim();
    if (!diagPreenchidoCheck(d) && !notas) {
      const msg = "Gere o diagnóstico antes (ou digite notas) para sugerir demandas.";
      setAcoesError(msg);
      toast.error(msg);
      return;
    }
    setStructuringActions(true);
    setAcoesError(null);
    try {
      const payload = await invokeDiagnosticoEdge({
        mode: "acoes",
        nome: cliente.nome,
        especialidade: cliente.especialidade ?? d.perfil.especialidade,
        cidade: d.perfil.cidade || undefined,
        notas_acoes: notas || undefined,
        diagnostico_atual: d,
        transcricao: transcricao.trim() || undefined,
      });
      const demandas = payload?.demandas_sugeridas || payload?.plano_acao;
      if (!demandas) throw new Error("A IA não retornou demandas.");
      const next = { ...d, demandas_sugeridas: demandas };
      setD(next);
      setNotasBrutas("");
      notasBrutasRef.current = "";
      await persistDiagnostico(next);
      toast.success("Sugestões de demanda salvas (só visão Tabgha — não vão ao portal).");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao sugerir demandas.";
      setAcoesError(msg);
      toast.error(msg);
    } finally {
      setStructuringActions(false);
    }
  }

  function stopDictation(shouldEstruturar: boolean) {
    autoEstruturarRef.current = shouldEstruturar;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }

  function startDictation() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      toast.error("Seu navegador não suporta ditado por áudio. Use Chrome ou Edge.");
      return;
    }
    if (listening && recRef.current) {
      stopDictation(true);
      return;
    }

    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      let chunk = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const row = ev.results[i];
        if (row.isFinal) chunk += row[0].transcript;
      }
      appendNotasBrutas(chunk);
    };
    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error !== "aborted" && ev.error !== "no-speech") {
        toast.error(`Áudio: ${ev.error}`);
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (autoEstruturarRef.current) {
        autoEstruturarRef.current = false;
        const notas = notasBrutasRef.current.trim();
        if (notas) {
          toast.message("Gerando sugestões de demanda…");
          void estruturarDemandasComIA(notas);
        } else {
          toast.error("Não captamos áudio. Tente de novo ou digite as notas.");
        }
      }
    };
    recRef.current = rec;
    autoEstruturarRef.current = false;
    rec.start();
    setListening(true);
    setAcoesError(null);
    toast.message("Ouvindo… ao parar, sugerimos demandas internas com base no diagnóstico.");
  }

  const filled = diagPreenchidoCheck(d);

  return (
    <div className="space-y-5 py-5">
      <div className="space-y-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-5">
        <div>
          <p className="text-sm font-bold text-primary">Fonte → diagnóstico publicado</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Cole a transcrição, anexe .txt/.html ou informe um link. A IA gera o diagnóstico
            consolidado e já publica no portal do médico. Campos manuais redundantes foram
            removidos.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Transcrição ou texto
            </Label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-secondary/50">
              <Upload className="h-3.5 w-3.5" />
              Anexar arquivo
              <input
                type="file"
                accept=".txt,.md,.markdown,.csv,.html,.htm,text/plain,text/html"
                className="hidden"
                onChange={(e) => void onTranscriptFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <Textarea
            rows={6}
            value={transcricao}
            onChange={(e) => setTranscricao(e.target.value)}
            placeholder="Cole aqui a transcrição da reunião / discovery…"
            className="resize-y font-mono text-xs leading-relaxed"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Link HTML (opcional)</Label>
          <Input
            value={fonteUrl}
            onChange={(e) => setFonteUrl(e.target.value)}
            placeholder="https://… página ou export com o conteúdo da reunião"
            className="text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void gerarEPublicar()} disabled={generating} className="gap-2">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando e publicando…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {filled ? "Regenerar e publicar" : "Gerar e publicar no portal"}
              </>
            )}
          </Button>
        </div>

        {genError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {genError}
          </div>
        ) : null}
      </div>

      {filled ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-sky-700">
                Visão do cliente (publicada)
              </p>
              {d.gerado_em ? (
                <p className="text-[10px] text-muted-foreground">
                  Gerado em {new Date(d.gerado_em).toLocaleString("pt-BR")}
                </p>
              ) : null}
            </div>
            {d.resumo ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {d.resumo}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem resumo narrativo — regenere para consolidar a leitura do médico.
              </p>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <PreviewField label="Público-alvo" value={d.perfil.publico_alvo} />
              <PreviewField label="Diferencial" value={d.perfil.diferencial} />
              <PreviewField label="Canais" value={d.jornada.canais_aquisicao} />
              <PreviewField label="Funil" value={d.jornada.funil} />
              <PreviewField label="Dores (paciente)" value={d.dores.principais} />
              <PreviewField label="Dores (marketing)" value={d.dores.marketing} />
              <div className="sm:col-span-2">
                <PreviewField label="Concorrentes & posicionamento" value={d.concorrentes} />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/40 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/70 px-5 py-3">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-amber-800">
                  Sugestões de demanda (interno Tabgha)
                </p>
                <p className="mt-0.5 text-[11px] text-amber-900/70">
                  Não aparece no portal do médico — use para incluir demandas neste cliente.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={listening ? "destructive" : "default"}
                  className="gap-1.5"
                  disabled={structuringActions}
                  onClick={() => {
                    if (listening) stopDictation(true);
                    else startDictation();
                  }}
                >
                  {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {listening ? "Parar e sugerir" : "Falar notas"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  disabled={structuringActions || listening}
                  onClick={() => void estruturarDemandasComIA()}
                >
                  {structuringActions ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Sugerir a partir do diagnóstico
                </Button>
              </div>
            </div>
            <div className="space-y-3 p-5">
              <Textarea
                rows={3}
                value={notasBrutas}
                onChange={(e) => {
                  setNotasBrutas(e.target.value);
                  notasBrutasRef.current = e.target.value;
                }}
                placeholder="Notas opcionais da equipe (ex.: priorizar joelho, revisar WhatsApp)…"
                className="resize-none text-sm"
              />
              <Textarea
                rows={6}
                value={d.demandas_sugeridas}
                onChange={(e) => setD((prev) => ({ ...prev, demandas_sugeridas: e.target.value }))}
                placeholder={"1. …\n2. …"}
                className="resize-none font-mono text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  void persistDiagnostico(d)
                    .then(() => toast.success("Demandas internas atualizadas."))
                    .catch((err: Error) => toast.error(err.message));
                }}
              >
                <Save className="h-3.5 w-3.5" />
                Salvar demandas
              </Button>
              {listening ? (
                <p className="animate-pulse text-xs font-medium text-rose-700">Gravando…</p>
              ) : null}
              {acoesError ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {acoesError}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Ainda sem diagnóstico publicado. Envie a fonte acima para gerar.
        </p>
      )}
    </div>
  );
}

// ── Tab: Leads ────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  novo: "Novo",
  em_conversa: "Em conversa",
  interessado: "Interessado",
  agendado: "Agendado",
  atendido: "Atendido",
  convertido: "Convertido",
  perdido: "Perdido",
};

const STATUS_BADGE: Record<string, string> = {
  novo: "bg-blue-100 text-blue-700",
  em_conversa: "bg-amber-100 text-amber-700",
  interessado: "bg-violet-100 text-violet-700",
  agendado: "bg-cyan-100 text-cyan-700",
  atendido: "bg-teal-100 text-teal-700",
  convertido: "bg-green-100 text-green-700",
  perdido: "bg-slate-100 text-slate-600",
};

const LEADS_PIPELINE = [
  "novo",
  "em_conversa",
  "interessado",
  "agendado",
  "atendido",
  "convertido",
  "perdido",
] as const;

function TabLeads({ clienteId }: { clienteId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["admin", "cliente", clienteId, "leads"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CrmLead[];
    },
  });

  const selected = selectedId ? (leads.find((l) => l.id === selectedId) ?? null) : null;

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const funnelStats = LEADS_PIPELINE.map((s) => ({
    s,
    label: STATUS_LABELS[s],
    count: leads.filter((l) => l.status === s).length,
    color: STATUS_BADGE[s],
  })).filter(({ count }) => count > 0);

  return (
    <div className="py-5">
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{leads.length} leads</span>
            <span className="text-xs text-muted-foreground">
              — {leads.filter((l) => l.status === "convertido").length} convertidos
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            className="rounded-xl"
            onClick={() => setShowCreate(true)}
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Novo lead
          </Button>
        </div>
        {funnelStats.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {funnelStats.map(({ s, label, count, color }) => (
              <div
                key={s}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 shadow-[var(--shadow-xs)]"
              >
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", color)}>
                  {label}
                </span>
                <span className="text-sm font-bold">{count}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Clique em um lead para ver, editar, anotar ou excluir.
        </p>
      </div>

      {leads.length === 0 ? (
        <div className="py-4">
          <EmptyState
            title="Nenhum lead"
            description="Cadastre manualmente ou importe via Meta Ads / WhatsApp."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
                  {["Nome", "Contato", "Canal", "Status", "Data"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {leads.map((l) => (
                  <tr
                    key={l.id}
                    className="cursor-pointer transition-colors hover:bg-secondary/40"
                    onClick={() => setSelectedId(l.id)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{l.nome ?? "Sem nome"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {l.telefone ?? l.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-muted-foreground">
                      {l.canal ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                          STATUS_BADGE[l.status] ?? "bg-slate-100 text-slate-600",
                        )}
                      >
                        {STATUS_LABELS[l.status] ?? l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {format(new Date(l.criado_em), "dd MMM yyyy", { locale: ptBR })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected ? <LeadDetailDialog lead={selected} onClose={() => setSelectedId(null)} /> : null}

      <CreateLeadDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        clienteId={clienteId}
        onCreated={(lead) => setSelectedId(lead.id)}
      />
    </div>
  );
}

// ── Tab: Conteúdo ─────────────────────────────────────────────────────────────
const CONTEUDO_STATUS_BADGE: Record<string, string> = {
  briefing: "bg-slate-100 text-slate-600",
  roteiro: "bg-blue-100 text-blue-700",
  producao: "bg-yellow-100 text-yellow-700",
  aprovacao: "bg-orange-100 text-orange-700",
  agendado: "bg-indigo-100 text-indigo-700",
  postado: "bg-green-100 text-green-700",
};

const CONTEUDO_PIPELINE = [
  "briefing",
  "roteiro",
  "producao",
  "aprovacao",
  "agendado",
  "postado",
] as const;

const CONTEUDO_STATUS_LABEL: Record<string, string> = {
  briefing: "Briefing",
  roteiro: "Roteiro",
  producao: "Produção",
  aprovacao: "Aprovação",
  agendado: "Agendado",
  postado: "Postado",
};

function TabConteudo({ clienteId }: { clienteId: string }) {
  const { data: conteudos = [], isLoading } = useQuery({
    queryKey: ["admin", "cliente", clienteId, "conteudos"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conteudos")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("data_postagem", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (conteudos.length === 0)
    return (
      <div className="py-8">
        <EmptyState
          title="Nenhum conteúdo"
          description="Crie conteúdos em Estratégia > Calendário."
        />
      </div>
    );

  const pipelineStats = CONTEUDO_PIPELINE.map((s) => ({
    s,
    label: CONTEUDO_STATUS_LABEL[s],
    count: conteudos.filter((c) => c.status === s).length,
    color: CONTEUDO_STATUS_BADGE[s],
  })).filter(({ count }) => count > 0);

  return (
    <div className="py-5">
      <div className="mb-4 space-y-3">
        <span className="text-sm font-semibold">{conteudos.length} conteúdos</span>
        {pipelineStats.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pipelineStats.map(({ s, label, count, color }) => (
              <div
                key={s}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 shadow-[var(--shadow-xs)]"
              >
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", color)}>
                  {label}
                </span>
                <span className="text-sm font-bold">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
                {["Título", "Rede", "Tipo", "Status", "Postagem"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {conteudos.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-secondary/40">
                  <td className="px-4 py-3 font-medium max-w-[260px] truncate">
                    {c.titulo ?? "Sem título"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs capitalize">
                    {c.rede ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs capitalize">
                    {c.tipo ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
                        CONTEUDO_STATUS_BADGE[c.status] ?? "bg-slate-100 text-slate-600",
                      )}
                    >
                      {CONTEUDO_STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {c.data_postagem
                      ? format(new Date(c.data_postagem), "dd MMM yyyy", { locale: ptBR })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Conexões ─────────────────────────────────────────────────────────────
function TabConexoes({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();
  const extras = (cliente.dados_extras ?? {}) as Record<string, unknown>;
  const agenteIa = (extras.agente_ia ?? {}) as Record<string, string>;
  const automacoes = (extras.automacoes ?? {}) as Record<string, unknown>;
  const zapi = (automacoes.zapi ?? {}) as Record<string, unknown>;

  const [metodo, setMetodo] = useState(agenteIa.metodo_qualificacao ?? "");
  const [tom, setTom] = useState(agenteIa.tom ?? "acolhedor, claro e profissional");
  const [nomeAgente, setNomeAgente] = useState(agenteIa.nome_agente ?? "assistente");
  const [systemPrompt, setSystemPrompt] = useState(agenteIa.system_prompt ?? "");
  const [agenteAtivo, setAgenteAtivo] = useState(
    zapi.agente_ativo === true || zapi.agente_ativo === "true",
  );
  const [jsonOpen, setJsonOpen] = useState(false);
  const [json, setJson] = useState(JSON.stringify(extras, null, 2));
  const [jsonError, setJsonError] = useState("");
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    setMetodo(agenteIa.metodo_qualificacao ?? "");
    setTom(agenteIa.tom ?? "acolhedor, claro e profissional");
    setNomeAgente(agenteIa.nome_agente ?? "assistente");
    setSystemPrompt(agenteIa.system_prompt ?? "");
    setAgenteAtivo(zapi.agente_ativo === true || zapi.agente_ativo === "true");
    setJson(JSON.stringify(extras, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when cliente payload changes
  }, [cliente.id, cliente.dados_extras]);

  const saveAgente = useMutation({
    mutationFn: async () => {
      const base = (cliente.dados_extras ?? {}) as Record<string, unknown>;
      const baseAutomacoes = (base.automacoes ?? {}) as Record<string, unknown>;
      const baseZapi = (baseAutomacoes.zapi ?? {}) as Record<string, unknown>;
      const novoExtras = {
        ...base,
        agente_ia: {
          ...((base.agente_ia as object) ?? {}),
          system_prompt: systemPrompt.trim() || null,
          metodo_qualificacao: metodo.trim() || null,
          tom: tom.trim() || "acolhedor, claro e profissional",
          nome_agente: nomeAgente.trim() || "assistente",
        },
        automacoes: {
          ...baseAutomacoes,
          zapi: {
            ...baseZapi,
            agente_ativo: agenteAtivo,
          },
        },
      };

      const { error } = await supabase
        .from("clientes")
        .update({ dados_extras: novoExtras as Json })
        .eq("id", cliente.id);
      if (error) throw error;

      // Mesma flag que o Cérebro Pietro → aba Clientes grava (fonte lida pelo whatsapp-inbound).
      await syncAgenteAtivoInstances(cliente.id, agenteAtivo);

      setJson(JSON.stringify(novoExtras, null, 2));
    },
    onSuccess: () => {
      toast.success("Agente WhatsApp salvo.");
      void qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] });
      void qc.invalidateQueries({ queryKey: ["admin", "pietro-clientes"] });
      setJsonError("");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setJsonError(e.message);
    },
  });

  const saveJson = useMutation({
    mutationFn: async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error("JSON inválido.");
      }
      const { error } = await supabase
        .from("clientes")
        .update({ dados_extras: parsed as Json })
        .eq("id", cliente.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("JSON salvo.");
      void qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] });
      setJsonError("");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setJsonError(e.message);
    },
  });

  const [instanceId, setInstanceId] = useState("");
  const [instanceToken, setInstanceToken] = useState("");
  const [clientToken, setClientToken] = useState("");

  const { data: wppInstance } = useQuery({
    queryKey: ["admin", "cliente", cliente.id, "wpp-instance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_id, token, status, phone, dados_extras")
        .eq("cliente_id", cliente.id)
        .order("atualizado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: ops } = useQuery({
    queryKey: ["admin", "cliente", cliente.id, "wpp-ops"],
    queryFn: async () => {
      const { data: convs, error } = await supabase
        .from("whatsapp_conversations")
        .select("id, bot_score, owner_state")
        .eq("cliente_id", cliente.id);
      if (error) throw error;
      const ids = (convs ?? []).map((c) => c.id);
      let botMsgs = 0;
      if (ids.length > 0) {
        const { count, error: msgErr } = await supabase
          .from("whatsapp_messages")
          .select("id", { count: "exact", head: true })
          .in("conversation_id", ids)
          .eq("sender_type", "bot");
        if (msgErr) throw msgErr;
        botMsgs = count ?? 0;
      }
      const scores = (convs ?? [])
        .map((c) => c.bot_score)
        .filter((n): n is number => typeof n === "number");
      const avgScore =
        scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      return {
        conversations: convs?.length ?? 0,
        botMsgs,
        avgScore,
        withBot: (convs ?? []).filter((c) => c.owner_state === "bot").length,
      };
    },
  });

  useEffect(() => {
    if (!wppInstance) return;
    setInstanceId(wppInstance.instance_id ?? "");
    setInstanceToken(wppInstance.token ?? "");
    const ex = (wppInstance.dados_extras ?? {}) as Record<string, string>;
    setClientToken(ex.client_token ?? "");
  }, [wppInstance]);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-inbound`;

  const saveInstance = useMutation({
    mutationFn: async () => {
      if (!instanceId.trim() || !instanceToken.trim() || !clientToken.trim()) {
        throw new Error("Instance ID, Token e Client-Token são obrigatórios.");
      }
      const keepStatus =
        wppInstance?.status === "connected" || wppInstance?.status === "connecting"
          ? wppInstance.status
          : "disconnected";
      const payload = {
        cliente_id: cliente.id,
        provider: "zapi" as const,
        instance_id: instanceId.trim(),
        token: instanceToken.trim(),
        status: keepStatus,
        dados_extras: {
          ...((wppInstance?.dados_extras as object) ?? {}),
          client_token: clientToken.trim() || null,
          agente_ativo: agenteAtivo,
        },
      };
      if (wppInstance?.id) {
        const { error } = await supabase
          .from("whatsapp_instances")
          .update(payload)
          .eq("id", wppInstance.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("whatsapp_instances").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Credenciais Z-API salvas. Agora gere o QR e escaneie.");
      void qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id, "wpp-instance"] });
      void qc.invalidateQueries({ queryKey: ["whatsapp-connect", cliente.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasZapiInstance = Boolean(wppInstance?.instance_id && wppInstance?.token);
  const wppConnected = wppInstance?.status === "connected";
  const agentLive = hasZapiInstance && wppConnected && agenteAtivo;

  const steps = [
    {
      ok: hasZapiInstance,
      label: "1. Credenciais Z-API",
      detail: hasZapiInstance ? "Instância salva" : "Cole Instance ID + Token (só admin)",
    },
    {
      ok: wppConnected,
      label: "2. WhatsApp online",
      detail: wppConnected
        ? `Conectado${wppInstance?.phone ? ` · ${wppInstance.phone}` : ""}`
        : "Gerar QR e escanear com o celular do consultório",
    },
    {
      ok: agenteAtivo,
      label: "3. Agente ligado",
      detail: agenteAtivo
        ? "Pietro responde nas conversas do bot"
        : "Ative o switch e salve o agente",
    },
  ];

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      toast.success("Webhook copiado.");
      setTimeout(() => setCopiedWebhook(false), 1500);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <div className="space-y-5 py-5">
      <div>
        <h3 className="text-base font-semibold tracking-tight">WhatsApp & agente Pietro</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Esta aba é só para o canal de atendimento. Meta Ads fica em{" "}
          <Link
            to="/admin/config-meta"
            className="font-medium text-sky-700 underline-offset-2 hover:underline"
          >
            Conectar Meta BM
          </Link>
          . Depois de conectar, as conversas aparecem em Atendimento; insights e tempo no funil
          ficam em Leads / ROI.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.label}
            className={cn(
              "rounded-xl border px-4 py-3",
              s.ok ? "border-emerald-200 bg-emerald-50/70" : "border-border bg-card",
            )}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
            <p
              className={cn(
                "mt-1 text-sm font-medium",
                s.ok ? "text-emerald-800" : "text-foreground",
              )}
            >
              {s.ok ? "Pronto" : "Pendente"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{s.detail}</p>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "rounded-xl border px-4 py-3 text-sm",
          agentLive
            ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
            : "border-amber-200 bg-amber-50/70 text-amber-950",
        )}
      >
        {agentLive ? (
          <p>
            <strong>Agente no ar.</strong> Mensagens novas no WhatsApp entram no Atendimento; o
            Pietro responde com o tom e a metodologia salvos abaixo, gera score/notas e move o lead
            no funil quando fizer sentido.
          </p>
        ) : (
          <p>
            <strong>Ainda não está respondendo sozinho.</strong> Complete os 3 passos. Credenciais
            Z-API fazem sentido (é o provedor real do WhatsApp neste produto) — sem elas o QR não
            existe.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link to="/admin/atendimento">Abrir Atendimento</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link to="/admin/leads" search={{ cliente: cliente.id, periodo: 30, canal: "", q: "" }}>
              Ver funil de leads
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Conversas", value: ops?.conversations ?? 0, icon: MessageSquare, tint: "blue" as const },
          { label: "Msgs do bot", value: ops?.botMsgs ?? 0, icon: Bot, tint: "sky" as const },
          {
            label: "Score médio IA",
            value: ops?.avgScore != null ? ops.avgScore : "—",
            icon: Gauge,
            tint: "violet" as const,
          },
          { label: "Com bot ativo", value: ops?.withBot ?? 0, icon: Radio, tint: "green" as const },
        ].map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            tint={kpi.tint}
            format="raw"
            loading={!ops}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
                Credenciais Z-API (só Tabgha)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Passo técnico do admin: cola Instance ID + Token da Z-API deste consultório. O
                médico só escaneia o QR depois disso.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Instance ID</Label>
              <Input
                value={instanceId}
                onChange={(e) => setInstanceId(e.target.value)}
                placeholder="ID da instância na Z-API"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Token</Label>
              <Input
                value={instanceToken}
                onChange={(e) => setInstanceToken(e.target.value)}
                placeholder="Token da instância"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Client-Token</Label>
              <Input
                value={clientToken}
                onChange={(e) => setClientToken(e.target.value)}
                placeholder="Token de segurança da conta Z-API"
                autoComplete="off"
              />
            </div>
            <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Webhook Receive (Z-API)
              </p>
              <code className="mt-1 block break-all text-[11px] text-foreground">{webhookUrl}</code>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-1 h-7 px-2 text-xs"
                onClick={() => void copyWebhook()}
              >
                {copiedWebhook ? "Copiado" : "Copiar webhook"}
              </Button>
            </div>
            <Button
              size="sm"
              onClick={() => saveInstance.mutate()}
              disabled={saveInstance.isPending}
              className="gap-2"
            >
              {saveInstance.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar credenciais
            </Button>
          </div>

          <WhatsappConnectCard clienteId={cliente.id} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-sky-100 bg-sky-50/60 px-5 py-3">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-sky-700">
              Pietro · o que ele fala e como
            </p>
          </div>
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Agente ativo</p>
                <p className="text-xs text-muted-foreground">
                  Com WhatsApp online, o Pietro responde sozinho nas conversas do bot.
                </p>
              </div>
              <Switch checked={agenteAtivo} onCheckedChange={setAgenteAtivo} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="nome-agente">Nome do agente</Label>
                <Input
                  id="nome-agente"
                  value={nomeAgente}
                  onChange={(e) => setNomeAgente(e.target.value)}
                  placeholder="assistente"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tom-agente">Tom / entonação</Label>
                <Input
                  id="tom-agente"
                  value={tom}
                  onChange={(e) => setTom(e.target.value)}
                  placeholder="acolhedor, claro e profissional"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Como as mensagens nascem</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>
                  Prompt, modelo e parâmetros globais (Método 7 Fontes) ficam em{" "}
                  <Link
                    to="/admin/cerebro-pietro"
                    className="font-medium text-sky-700 underline-offset-2 hover:underline"
                  >
                    Cérebro Pietro
                  </Link>
                  . O campo abaixo sobrepõe o prompt global só para este cliente.
                </li>
                <li>Não é template fixo: o Pietro gera respostas curtas em português.</li>
                <li>
                  Gatilhos de emergência, pedido de humano ou cancelamento passam para a equipe no
                  Atendimento, sempre.
                </li>
                <li>
                  Score (0–100), Fontes tocadas, maturidade e agendamento sugerido aparecem na
                  conversa e no detalhe do lead.
                </li>
              </ul>
            </div>

            <div className="space-y-1">
              <Label htmlFor="system-prompt-agente">Prompt do sistema (só este cliente)</Label>
              <Textarea
                id="system-prompt-agente"
                rows={8}
                placeholder="Vazio = usa o prompt global do Cérebro Pietro."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="resize-y font-mono text-[12px]"
              />
              <p className="text-[11px] text-muted-foreground">
                Vazio = prompt global. Preenchido = substitui o global por completo para este
                cliente (o formato de saída é acrescentado automaticamente).
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="metodo-agente">Metodologia de qualificação (modo legado)</Label>
              <Textarea
                id="metodo-agente"
                rows={4}
                placeholder="Ex.: (1) o que busca (2) urgência (3) fit com a clínica (4) disposição para agendar. Sem interrogatório."
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
                className="resize-none text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Nome, tom e metodologia só valem quando não há prompt de sistema (global nem deste
                cliente). O placeholder cinza não é dado salvo.
              </p>
            </div>

            {jsonError ? <p className="text-xs text-destructive">{jsonError}</p> : null}
            <Button
              size="sm"
              onClick={() => saveAgente.mutate()}
              disabled={saveAgente.isPending}
              className="gap-2"
            >
              {saveAgente.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar agente
            </Button>
          </div>
        </div>
      </div>

      <Collapsible open={jsonOpen} onOpenChange={setJsonOpen}>
        <div className="rounded-2xl border border-border bg-card">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between px-5 py-3 text-left"
            >
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
                  Avançado · JSON técnico
                </p>
                <p className="text-xs text-muted-foreground">
                  Só para suporte. Prefira os formulários acima.
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  jsonOpen && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 border-t border-border px-5 py-4">
              <Textarea
                className="resize-none font-mono text-xs"
                rows={8}
                value={json}
                onChange={(e) => {
                  setJson(e.target.value);
                  setJsonError("");
                }}
              />
              {jsonError ? <p className="text-xs text-destructive">{jsonError}</p> : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => saveJson.mutate()}
                disabled={saveJson.isPending}
                className="gap-2"
              >
                {saveJson.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar JSON
              </Button>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function ClienteFichaPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["admin", "cliente", id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const excluir = useMutation({
    mutationFn: () => deleteClienteAdmin(id),
    onSuccess: () => {
      toast.success("Cliente excluído.");
      void qc.invalidateQueries({ queryKey: ["admin", "clientes"] });
      void navigate({ to: "/admin/clientes" });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível excluir."),
  });

  if (isLoading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );

  if (!cliente) return <EmptyState title="Cliente não encontrado" />;

  const statusColor: Record<string, string> = {
    ativo: "bg-green-100 text-green-700 border-green-200",
    onboarding: "bg-blue-100 text-blue-700 border-blue-200",
    pausa: "bg-amber-100 text-amber-700 border-amber-200",
    inativo: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <div className="px-6 py-6">
      {/* Page header */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/clientes"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight truncate">{cliente.nome}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{cliente.especialidade ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize",
              statusColor[cliente.status] ?? "bg-muted text-muted-foreground",
            )}
          >
            {cliente.status}
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-rose-200 text-rose-700 hover:bg-rose-50"
                disabled={excluir.isPending}
              >
                {excluir.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso remove <strong>{cliente.nome}</strong> e dados vinculados (leads, conteúdos,
                  etc.). Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-rose-600 hover:bg-rose-700"
                  onClick={() => excluir.mutate()}
                >
                  Excluir definitivamente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="cadastro">
        <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent h-auto p-0 gap-0">
          {["cadastro", "leads", "conteudo", "conexoes"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent capitalize"
            >
              {tab === "conexoes"
                ? "Conexões"
                : tab === "conteudo"
                  ? "Conteúdo"
                  : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="cadastro">
          <TabCadastro cliente={cliente} />
        </TabsContent>
        <TabsContent value="leads">
          <TabLeads clienteId={cliente.id} />
        </TabsContent>
        <TabsContent value="conteudo">
          <TabConteudo clienteId={cliente.id} />
        </TabsContent>
        <TabsContent value="conexoes">
          <TabConexoes cliente={cliente} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
