import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CalendarDays } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { CalendarGrid, type CalEvent } from "@/components/CalendarGrid";
import { KpiCard } from "@/components/ui/kpi-card";

export const Route = createFileRoute("/_authenticated/admin/calendario")({
  component: CalendarioAdminPage,
  head: () => ({ meta: [{ title: "Calendário — Tabgha Admin" }] }),
});

function CalendarioAdminPage() {
  const [filterCliente, setFilterCliente] = useState("");
  const [refMonth, setRefMonth] = useState(new Date());
  const { data: clientesOptions = [] } = useClientesOptions();

  const from = startOfMonth(refMonth).toISOString().slice(0, 10);
  const to = endOfMonth(refMonth).toISOString().slice(0, 10);

  const { data: events = [], isLoading } = useQuery<CalEvent[]>({
    queryKey: ["admin", "calendario", from, to, filterCliente],
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("conteudos")
        .select("id, titulo, data_postagem, rede, tipo")
        .not("data_postagem", "is", null)
        .gte("data_postagem", from)
        .lte("data_postagem", to);

      if (filterCliente) q = q.eq("cliente_id", filterCliente);

      const { data, error } = await q.order("data_postagem");
      if (error) throw error;

      return (data ?? []).map((c) => ({
        id: c.id,
        date: c.data_postagem!,
        title: c.titulo ?? "Conteúdo",
        type: c.tipo?.toLowerCase().includes("grav")
          ? ("gravacao" as const)
          : ("conteudo" as const),
        sub: [c.rede, c.tipo].filter(Boolean).join(" · "),
      }));
    },
  });

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Page header */}
      <header className="animate-fade-up" style={{ animationDelay: "0ms" }}>
        <span className="eyebrow-pill">Conteúdo</span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight leading-none">Calendário editorial</h1>
        <p className="text-xs text-muted-foreground mt-2">Conteúdos agendados de todos os clientes</p>
      </header>

      {/* KPI strip — total events for the month */}
      <div className="animate-fade-up max-w-full sm:max-w-xs" style={{ animationDelay: "75ms" }}>
        <KpiCard
          label="Conteúdos no mês"
          value={events.length}
          icon={CalendarDays}
          tint="violet"
          format="raw"
          loading={isLoading}
        />
      </div>

      {/* Calendar panel */}
      <div
        className="animate-fade-up rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
        style={{ animationDelay: "150ms" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
          Agenda de publicações
        </p>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <CalendarGrid
            events={events}
            onMonthChange={setRefMonth}
            filters={
              <select
                value={filterCliente}
                onChange={(e) => setFilterCliente(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Todos os clientes</option>
                {clientesOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            }
          />
        )}
      </div>
    </div>
  );
}
