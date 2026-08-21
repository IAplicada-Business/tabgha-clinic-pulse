import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Search, Users, UserCheck, UserPlus, Layers } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { CredentialsDialog, type AccessCredentials } from "@/components/usuarios/CredentialsDialog";
import { ProvisionalPasswordField } from "@/components/usuarios/ProvisionalPasswordField";
import { createClientWithAccess } from "@/functions/clientes/createClientWithAccess.functions";
import { provisionalPassword } from "@/lib/provisional-password";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/clientes/")({
  component: ClientesAdminPage,
  head: () => ({ meta: [{ title: "Clientes — Tabgha Admin" }] }),
});

type Cliente = Tables<"clientes"> & { leads_count: number };

const STATUS_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  ativo: "Ativo",
  pausa: "Pausa",
  inativo: "Inativo",
};
const STATUS_COLORS: Record<string, string> = {
  onboarding: "bg-blue-100 text-blue-700",
  ativo: "bg-green-100 text-green-700",
  pausa: "bg-yellow-100 text-yellow-700",
  inativo: "bg-slate-100 text-slate-600",
};
const STATUS_DOT: Record<string, string> = {
  onboarding: "bg-blue-500",
  ativo: "bg-emerald-500",
  pausa: "bg-yellow-500",
  inativo: "bg-slate-400",
};

const newClientSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("Email inválido"),
  cnpj: z.string().optional(),
  especialidade: z.string().optional(),
  gerar_acesso_portal: z.boolean().default(true),
});
type NewClientForm = z.infer<typeof newClientSchema>;

function NovoClienteDialog({
  open,
  onClose,
  onCredentials,
}: {
  open: boolean;
  onClose: () => void;
  onCredentials: (c: AccessCredentials) => void;
}) {
  const qc = useQueryClient();
  const form = useForm<NewClientForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(newClientSchema) as any,
    defaultValues: {
      nome: "",
      email: "",
      cnpj: "",
      especialidade: "",
      gerar_acesso_portal: true,
    },
  });

  const gerarAcesso = form.watch("gerar_acesso_portal");

  const criar = useMutation({
    mutationFn: (data: NewClientForm) => createClientWithAccess({ data }),
    onSuccess: (result) => {
      toast.success(
        result.portal
          ? "Consultório criado e acesso ao portal gerado."
          : "Consultório criado (sem login).",
      );
      if (result.portal) {
        onCredentials({
          email: result.portal.email,
          temporary_password: result.portal.temporary_password,
          reused_existing: result.portal.reused_existing,
          role: "cliente",
        });
      }
      void qc.invalidateQueries({ queryKey: ["admin", "clientes"] });
      void qc.invalidateQueries({ queryKey: ["admin", "team"] });
      onClose();
      form.reset({
        nome: "",
        email: "",
        cnpj: "",
        especialidade: "",
        gerar_acesso_portal: true,
      });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível criar o cliente."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((d) => criar.mutate(d))} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome do consultório / médico</Label>
            <Input placeholder="Dr. Pedro Souza" {...form.register("nome")} />
            {form.formState.errors.nome && (
              <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" placeholder="dr.pedro@email.com" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Se gerar acesso ao portal, este email será o login.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Especialidade</Label>
              <Input placeholder="Ortopedia" {...form.register("especialidade")} />
            </div>
            <div className="space-y-1">
              <Label>CNPJ</Label>
              <Input placeholder="00.000.000/0000-00" {...form.register("cnpj")} />
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <Checkbox
              id="gerar-portal"
              checked={gerarAcesso}
              onCheckedChange={(c) => form.setValue("gerar_acesso_portal", c === true)}
            />
            <Label
              htmlFor="gerar-portal"
              className="cursor-pointer text-sm leading-snug font-normal"
            >
              Gerar acesso ao portal agora
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Cria login com a senha provisória {provisionalPassword()}.
              </span>
            </Label>
          </div>
          {gerarAcesso ? <ProvisionalPasswordField /> : null}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={criar.isPending}>
              {criar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClientesAdminPage() {
  const [showNew, setShowNew] = useState(false);
  const [credentials, setCredentials] = useState<AccessCredentials | null>(null);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["admin", "clientes"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*, leads(id)").order("nome");
      if (error) throw error;
      return (data ?? []).map((c) => ({
        ...c,
        leads_count: Array.isArray(c.leads) ? c.leads.length : 0,
      })) as Cliente[];
    },
  });

  const filtered = clientes.filter((c) => {
    const matchStatus = filtroStatus === "todos" || c.status === filtroStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q || c.nome.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // KPI counts
  const totalAtivos = clientes.filter((c) => c.status === "ativo").length;
  const totalOnboarding = clientes.filter((c) => c.status === "onboarding").length;
  const totalCarteira = clientes.filter((c) =>
    ["ativo", "onboarding"].includes(c.status),
  ).length;
  const totalLeads = clientes.reduce((acc, c) => acc + c.leads_count, 0);

  const kpiCards = [
    { label: "Na carteira", value: totalCarteira, icon: Users, tint: "blue" as const },
    { label: "Ativos", value: totalAtivos, icon: UserCheck, tint: "green" as const },
    { label: "Em Onboarding", value: totalOnboarding, icon: UserPlus, tint: "sky" as const },
    { label: "Total de Leads", value: totalLeads, icon: Layers, tint: "violet" as const },
  ];

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 animate-fade-up">
        <div>
          <span className="eyebrow-pill">CRM</span>
          <h1 className="mt-2 text-xl font-bold tracking-tight">Clientes</h1>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo cliente
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpiCards.map((kpi, i) => (
          <div key={kpi.label} className="animate-fade-up" style={{ animationDelay: `${i * 75}ms` }}>
            <KpiCard label={kpi.label} value={kpi.value} icon={kpi.icon} tint={kpi.tint} format="raw" />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] animate-fade-up"
        style={{ animationDelay: "300ms" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Filtros
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="segmented">
            {["todos", "onboarding", "ativo", "pausa", "inativo"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFiltroStatus(s)}
                data-active={filtroStatus === s}
                className="segmented-item capitalize"
              >
                {s === "todos" ? "Todos" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Client List */}
      <div
        className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] animate-fade-up"
        style={{ animationDelay: "375ms" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Lista de clientes{" "}
          {filtered.length !== clientes.length &&
            `· ${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}`}
        </p>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Plus className="h-6 w-6" />}
            title="Nenhum cliente encontrado"
            action={
              clientes.length === 0
                ? { label: "Criar primeiro cliente", onClick: () => setShowNew(true) }
                : undefined
            }
          />
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {filtered.map((c, i) => (
              <Link
                key={c.id}
                to={`/admin/clientes/${c.id}` as any}
                className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors"
              >
                <span className="hidden text-[10px] font-black text-muted-foreground/30 tabular-nums w-5 shrink-0 sm:inline">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="icon-chip icon-chip-blue h-9 w-9 shrink-0 text-[11px] font-bold">
                  {c.nome.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.especialidade ?? "—"} · {c.email ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {c.leads_count} leads
                  </span>
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[c.status] ?? "bg-muted text-muted-foreground"}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[c.status] ?? "bg-slate-400"}`}
                    />
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <NovoClienteDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onCredentials={setCredentials}
      />
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}
