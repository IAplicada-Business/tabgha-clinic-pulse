import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  ArrowLeft,
  Save,
  Stethoscope,
  Trash2,
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
import { CreateLeadDialog } from "@/components/crm/CreateLeadDialog";
import { LeadDetailDialog } from "@/components/crm/LeadDetailDialog";
import type { Lead as CrmLead } from "@/hooks/useLeads";
import { syncAgenteAtivoInstances } from "@/lib/pietro";
import { CRIATIVO_STATUS, STATUS_CLASS, STATUS_LABEL, type CriativoStatus } from "@/lib/biblioteca";

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

const ABAS_CLIENTE = [
  { valor: "cadastro", label: "Cadastro" },
  { valor: "leads", label: "Leads" },
  { valor: "conteudo", label: "Conteúdo" },
  { valor: "conexoes", label: "Conexões" },
] as const;

// ── Tab: Cadastro ─────────────────────────────────────────────────────────────
function TabCadastro({ cliente }: { cliente: Cliente }) {
  const qc = useQueryClient();

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
          .eq("status", "pendente_aprovacao"),
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

      <DiagnosticoResumoCard clienteId={cliente.id} />
    </div>
  );
}

// ── Diagnóstico 7 Fontes: resumo + atalho ─────────────────────────────────────
// A ficha não edita diagnóstico. O caminho é um só: o médico responde as 35
// perguntas no portal e a equipe gera o relatório em /admin/diagnosticos.

function DiagnosticoResumoCard({ clienteId }: { clienteId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "cliente", clienteId, "diagnostico-resumo"],
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: geral }, { data: rel }] = await Promise.all([
        supabase
          .from("vw_diagnostico_score_geral")
          .select("score_geral, respostas_total")
          .eq("cliente_id", clienteId)
          .maybeSingle(),
        supabase
          .from("diagnostico_relatorios")
          .select("gerado_em")
          .eq("cliente_id", clienteId)
          .maybeSingle(),
      ]);
      return {
        score: geral?.score_geral ?? null,
        respostas: geral?.respostas_total ?? 0,
        relatorioEm: rel?.gerado_em ?? null,
      };
    },
  });

  const respostas = data?.respostas ?? 0;
  const situacao = data?.relatorioEm
    ? { texto: "Relatório gerado", classe: "bg-emerald-100 text-emerald-700" }
    : respostas > 0
      ? { texto: "Respondendo", classe: "bg-sky-100 text-sky-700" }
      : { texto: "Não iniciado", classe: "bg-amber-100 text-amber-800" };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-[var(--shadow-card)]">
      <div className="icon-chip icon-chip-blue h-8 w-8 shrink-0">
        <Stethoscope className="h-4 w-4" />
      </div>

      <div className="min-w-[220px] flex-1">
        <p className="text-sm font-semibold">Diagnóstico 7 Fontes</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          O médico responde no portal dele; a equipe gera o relatório em Diagnósticos.
        </p>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div className="text-right">
            <p className="text-lg font-extrabold tabular-nums">
              {data?.score != null ? Math.round(Number(data.score)) : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">{respostas} respostas</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              situacao.classe,
            )}
          >
            {situacao.texto}
          </span>
        </>
      )}

      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link to="/admin/diagnosticos">Abrir Diagnósticos</Link>
      </Button>
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
// Rótulos e cores vêm de @/lib/biblioteca — mesma fonte da Biblioteca Criativa,
// da Estratégia e do portal do médico. Não se declara um segundo vocabulário.
const CONTEUDO_PIPELINE = CRIATIVO_STATUS;

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
    label: STATUS_LABEL[s],
    count: conteudos.filter((c) => c.status === s).length,
    color: STATUS_CLASS[s],
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
                        STATUS_CLASS[c.status as CriativoStatus] ?? "bg-slate-100 text-slate-600",
                      )}
                    >
                      {STATUS_LABEL[c.status as CriativoStatus] ?? c.status}
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
  const [agenteError, setAgenteError] = useState("");
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    setMetodo(agenteIa.metodo_qualificacao ?? "");
    setTom(agenteIa.tom ?? "acolhedor, claro e profissional");
    setNomeAgente(agenteIa.nome_agente ?? "assistente");
    setSystemPrompt(agenteIa.system_prompt ?? "");
    setAgenteAtivo(zapi.agente_ativo === true || zapi.agente_ativo === "true");
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
    },
    onSuccess: () => {
      toast.success("Agente WhatsApp salvo.");
      void qc.invalidateQueries({ queryKey: ["admin", "cliente", cliente.id] });
      void qc.invalidateQueries({ queryKey: ["admin", "pietro-clientes"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setAgenteError(e.message);
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

            {agenteError ? <p className="text-xs text-destructive">{agenteError}</p> : null}
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
        {/* Mesmo segmented do resto do sistema (Cérebro, Financeiro, Nutrição,
            portal do médico) — as subabas estavam com um sublinhado próprio. */}
        <TabsList className="segmented h-auto w-full justify-start sm:w-fit">
          {ABAS_CLIENTE.map((aba) => (
            <TabsTrigger key={aba.valor} value={aba.valor} className="segmented-item">
              {aba.label}
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
