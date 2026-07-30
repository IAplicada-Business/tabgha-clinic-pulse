import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CalendarGrid, type CalEvent } from "@/components/CalendarGrid";

export const Route = createFileRoute("/_authenticated/cliente/calendario")({
  component: CalendarioPage,
  head: () => ({ meta: [{ title: "Calendário — Portal" }] }),
});

function CalendarioPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;
  const [refMonth, setRefMonth] = useState(new Date());

  const from = startOfMonth(refMonth).toISOString().slice(0, 10);
  const to = endOfMonth(refMonth).toISOString().slice(0, 10);

  const { data: events = [], isLoading } = useQuery<CalEvent[]>({
    queryKey: ["cliente", "calendario", clienteId, from, to],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const [agRes, contRes] = await Promise.all([
        supabase
          .from("agendamentos")
          .select("id, titulo, inicio, tipo")
          .eq("cliente_id", clienteId!)
          .eq("visivel_cliente", true)
          .gte("inicio", from)
          .lte("inicio", to)
          .order("inicio"),
        supabase
          .from("conteudos")
          .select("id, titulo, data_postagem, rede, tipo")
          .eq("cliente_id", clienteId!)
          .not("data_postagem", "is", null)
          .gte("data_postagem", from)
          .lte("data_postagem", to)
          .order("data_postagem"),
      ]);

      const items: CalEvent[] = [];

      (agRes.data ?? []).forEach((a) =>
        items.push({
          id: a.id,
          date: a.inicio!.slice(0, 10),
          title: a.titulo ?? "Reunião",
          type: a.tipo?.toLowerCase().includes("grav") ? "gravacao" : "agendamento",
          sub: a.tipo ?? undefined,
        }),
      );

      (contRes.data ?? []).forEach((c) =>
        items.push({
          id: c.id,
          date: c.data_postagem!,
          title: c.titulo ?? "Conteúdo",
          type: "conteudo",
          sub: [c.rede, c.tipo].filter(Boolean).join(" · "),
        }),
      );

      return items.sort((a, b) => a.date.localeCompare(b.date));
    },
  });

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Page header */}
      <header className="animate-fade-up">
        <h1 className="text-xl font-bold tracking-tight">Calendário</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Gravações, reuniões e conteúdos agendados</p>
      </header>

      {/* KPI strip */}
      <div
        className="card-lift animate-fade-up rounded-2xl border border-border bg-card px-5 pt-5 pb-4 shadow-[0_1px_3px_rgba(15,27,53,0.04)] flex flex-col"
        style={{ animationDelay: "75ms" }}
      >
        <span className="text-[9px] font-black tracking-[0.16em] text-muted-foreground/40 mb-4">01</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Eventos no mês</span>
        <span className="text-[2.4rem] font-black tracking-tight leading-none animate-numeric-pop mt-auto">
          {isLoading ? "—" : events.length}
        </span>
        <div className="mt-3 h-0.5 w-full rounded-full bg-sky-500" />
      </div>

      {/* Calendar panel — light card, same as admin */}
      <div
        className="animate-fade-up rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]"
        style={{ animationDelay: "150ms" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Agenda do mês</p>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <CalendarGrid events={events} onMonthChange={setRefMonth} />
        )}
      </div>
    </div>
  );
}
