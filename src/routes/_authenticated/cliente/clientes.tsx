import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserCheck, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/cliente/clientes")({
  component: ClientesPage,
  head: () => ({ meta: [{ title: "Pacientes — Portal" }] }),
});

function ClientesPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;
  const [search, setSearch] = useState("");

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ["cliente", "pacientes", clienteId],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, nome, email, telefone, canal, criado_em")
        .eq("cliente_id", clienteId!)
        .eq("status", "convertido")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = pacientes.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.nome?.toLowerCase().includes(q) || p.telefone?.includes(q) || p.email?.toLowerCase().includes(q);
  });

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="text-xl font-bold tracking-tight">Pacientes</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Leads convertidos em pacientes do consultório.</p>
      </div>

      {/* KPI Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className="card-lift animate-fade-up rounded-2xl border border-border bg-card px-5 pt-5 pb-4 shadow-[0_1px_3px_rgba(15,27,53,0.04)] flex flex-col"
          style={{ animationDelay: "75ms" }}
        >
          <span className="text-[9px] font-black tracking-[0.16em] text-muted-foreground/40 mb-4">01</span>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total de Pacientes</p>
          <p className="text-[2.4rem] font-black tracking-tight leading-none animate-numeric-pop mt-auto text-primary">
            {isLoading ? "—" : pacientes.length}
          </p>
          <div className="mt-3 h-0.5 w-full rounded-full bg-primary" />
        </div>

        <div
          className="card-lift animate-fade-up rounded-2xl border border-border bg-card px-5 pt-5 pb-4 shadow-[0_1px_3px_rgba(15,27,53,0.04)] flex flex-col"
          style={{ animationDelay: "150ms" }}
        >
          <span className="text-[9px] font-black tracking-[0.16em] text-muted-foreground/40 mb-4">02</span>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Resultado da Busca</p>
          <p className="text-[2.4rem] font-black tracking-tight leading-none animate-numeric-pop mt-auto text-primary">
            {isLoading ? "—" : filtered.length}
          </p>
          <div className="mt-3 h-0.5 w-full rounded-full bg-primary/40" />
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm animate-fade-up" style={{ animationDelay: "225ms" }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome, telefone…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="h-6 w-6" />}
          title={search ? "Nenhum resultado" : "Nenhum paciente ainda"}
          description={search ? "Tente outro termo." : "Pacientes aparecem quando um lead é convertido."}
        />
      ) : (
        <div
          className="animate-fade-up rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(15,27,53,0.04)] overflow-hidden"
          style={{ animationDelay: "300ms" }}
        >
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lista de Pacientes</p>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors"
              >
                <span className="text-[10px] font-black text-muted-foreground/30 tabular-nums w-5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {(p.nome ?? "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.nome ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{p.telefone ?? p.email ?? "—"}</p>
                </div>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-green-100 text-green-700 shrink-0">
                  Paciente
                </span>
                <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                  {format(new Date(p.criado_em), "dd MMM yyyy", { locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
