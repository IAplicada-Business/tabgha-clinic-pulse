import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalEvent = {
  id: string;
  date: string;
  title: string;
  type: "conteudo" | "agendamento" | "gravacao";
  sub?: string;
};

const TYPE_COLOR: Record<string, string> = {
  conteudo:    "bg-sky-100 text-sky-700",
  agendamento: "bg-amber-100 text-amber-700",
  gravacao:    "bg-emerald-100 text-emerald-700",
};

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function mondayFirst(d: Date) {
  const day = getDay(d);
  return day === 0 ? 6 : day - 1;
}

type Props = {
  events: CalEvent[];
  filters?: React.ReactNode;
  onMonthChange?: (month: Date) => void;
};

export function CalendarGrid({ events, filters, onMonthChange }: Props) {
  const [month, setMonth] = useState(new Date());

  const navMonth = (delta: number) =>
    setMonth((m) => {
      const n = new Date(m);
      n.setMonth(n.getMonth() + delta);
      onMonthChange?.(n);
      return n;
    });

  const firstDay = startOfMonth(month);
  const lastDay = endOfMonth(month);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });

  const leadingEmpty = mondayFirst(firstDay);
  const trailingEmpty = (7 - ((leadingEmpty + days.length) % 7)) % 7;

  const eventsForDay = (d: Date) =>
    events.filter((e) => {
      const eDate = new Date(e.date.slice(0, 10) + "T00:00:00");
      return isSameDay(eDate, d);
    });

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-semibold capitalize">
            {format(month, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { const n = new Date(); setMonth(n); onMonthChange?.(n); }}>
            Hoje
          </Button>
        </div>
        {filters && <div className="flex items-center gap-2">{filters}</div>}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400 inline-block" />Conteúdo</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />Reunião/agendamento</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />Gravação</span>
      </div>

      {/* Grid */}
      <div className="rounded-2xl border border-border overflow-hidden shadow-[var(--shadow-card)]">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-secondary/60">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
              {wd}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 border-t border-border">
          {Array.from({ length: leadingEmpty }).map((_, i) => (
            <div key={`l${i}`} className="min-h-[80px] border-b border-r border-border/60 bg-secondary/20" />
          ))}

          {days.map((day, idx) => {
            const dayEvents = eventsForDay(day);
            const today = isToday(day);
            const isLast = leadingEmpty + idx === leadingEmpty + days.length - 1;
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[80px] p-1.5 border-b border-r border-border/60 transition-colors duration-150 hover:bg-secondary/30",
                  today && "bg-gradient-to-br from-sky-50 to-transparent ring-1 ring-inset ring-primary/15",
                  isLast && "border-r-0",
                )}
              >
                <div className={cn(
                  "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold transition-colors",
                  today ? "bg-primary text-primary-foreground shadow-[var(--shadow-xs)]" : "text-foreground",
                )}>
                  {format(day, "d")}
                </div>
                <div className="flex flex-col gap-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      title={ev.title + (ev.sub ? ` · ${ev.sub}` : "")}
                      className={cn(
                        "truncate rounded-md px-1.5 py-0.5 text-[10px] leading-tight font-medium",
                        TYPE_COLOR[ev.type] ?? "bg-secondary text-muted-foreground",
                      )}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1.5">+{dayEvents.length - 3} mais</div>
                  )}
                </div>
              </div>
            );
          })}

          {Array.from({ length: trailingEmpty }).map((_, i) => (
            <div key={`t${i}`} className={cn("min-h-[80px] border-b border-r border-border/60 bg-secondary/20", i === trailingEmpty - 1 && "border-r-0")} />
          ))}
        </div>
      </div>
    </div>
  );
}
