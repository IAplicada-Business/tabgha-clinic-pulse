import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Search, CheckCircle2, Clock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KpiCard } from "@/components/ui/kpi-card";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/estrategia")({
  component: EstrategiaPage,
  head: () => ({ meta: [{ title: "Estratégia editorial · Tabgha OS" }] }),
});

type Conteudo = Tables<"conteudos"> & { clientes?: { nome: string } | null };

const COLUMNS: { key: string; label: string; color: string; accent: string }[] = [
  {
    key: "briefing",
    label: "Briefing",
    color: "bg-slate-100 text-slate-600",
    accent: "bg-slate-400",
  },
  { key: "roteiro", label: "Roteiro", color: "bg-blue-100 text-blue-700", accent: "bg-blue-500" },
  {
    key: "producao",
    label: "Produção",
    color: "bg-amber-100 text-amber-700",
    accent: "bg-amber-500",
  },
  { key: "aprovacao", label: "Aprovação", color: "bg-red-100 text-red-700", accent: "bg-red-500" },
  {
    key: "agendado",
    label: "Agendado",
    color: "bg-violet-100 text-violet-700",
    accent: "bg-violet-500",
  },
  {
    key: "postado",
    label: "Postado",
    color: "bg-green-100 text-green-700",
    accent: "bg-emerald-500",
  },
];

const REDES = ["Instagram", "Facebook", "TikTok", "YouTube", "LinkedIn", "WhatsApp"];
const TIPOS = ["Post", "Reels", "Story", "Carrossel", "Vídeo", "Live"];

function statusColor(status: string) {
  return COLUMNS.find((c) => c.key === status)?.color ?? "bg-slate-100 text-slate-600";
}

function NovoConteudoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: clientes = [] } = useClientesOptions();
  const [form, setForm] = useState({
    cliente_id: "",
    titulo: "",
    rede: "",
    tipo: "",
    data_postagem: "",
    roteiro: "",
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("conteudos").insert({
        cliente_id: form.cliente_id,
        titulo: form.titulo || null,
        rede: form.rede || null,
        tipo: form.tipo || null,
        data_postagem: form.data_postagem || null,
        roteiro: form.roteiro || null,
        status: "briefing",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conteúdo criado.");
      qc.invalidateQueries({ queryKey: ["admin", "estrategia", "conteudos"] });
      onClose();
      setForm({ cliente_id: "", titulo: "", rede: "", tipo: "", data_postagem: "", roteiro: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo conteúdo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Cliente *</Label>
            <select
              value={form.cliente_id}
              onChange={(e) => set("cliente_id", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Título</Label>
            <Input
              className="mt-1"
              value={form.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              placeholder="Ex: Reels — artroscopia explicada"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rede</Label>
              <select
                value={form.rede}
                onChange={(e) => set("rede", e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione…</option>
                {REDES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Tipo</Label>
              <select
                value={form.tipo}
                onChange={(e) => set("tipo", e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione…</option>
                {TIPOS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label>Data de postagem</Label>
            <Input
              type="date"
              className="mt-1"
              value={form.data_postagem}
              onChange={(e) => set("data_postagem", e.target.value)}
            />
          </div>
          <div>
            <Label>Roteiro / briefing</Label>
            <textarea
              value={form.roteiro}
              onChange={(e) => set("roteiro", e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Descreva o conteúdo..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => criar.mutate()} disabled={!form.cliente_id || criar.isPending}>
            {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConteudoCard({
  item,
  onMove,
}: {
  item: Conteudo;
  onMove: (id: string, status: string) => void;
}) {
  const nextStatuses = COLUMNS.filter((c) => c.key !== item.status);
  const dataStr = item.data_postagem
    ? new Date(item.data_postagem + "T00:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
    : null;

  return (
    <div className="card-lift animate-fade-up rounded-xl border border-border bg-card p-3.5 space-y-2.5 shadow-[var(--shadow-card)]">
      <p className="text-[12.5px] font-semibold leading-snug">{item.titulo ?? "(sem título)"}</p>
      <p className="text-[11px] text-muted-foreground">{item.clientes?.nome ?? "—"}</p>
      <div className="flex flex-wrap gap-1">
        {item.rede && (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
            {item.rede}
          </span>
        )}
        {item.tipo && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {item.tipo}
          </span>
        )}
        {dataStr && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {dataStr}
          </span>
        )}
      </div>
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) onMove(item.id, e.target.value);
        }}
        className="w-full rounded-lg border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground cursor-pointer"
      >
        <option value="">Mover para…</option>
        {nextStatuses.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function EstrategiaPage() {
  const qc = useQueryClient();
  const [novoOpen, setNovoOpen] = useState(false);
  const [filterCliente, setFilterCliente] = useState("");
  const [filterRede, setFilterRede] = useState("");
  const [search, setSearch] = useState("");

  const { data: clientesOptions = [] } = useClientesOptions();

  const { data: conteudos = [], isLoading } = useQuery<Conteudo[]>({
    queryKey: ["admin", "estrategia", "conteudos"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conteudos")
        .select("*, clientes(nome)")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Conteudo[];
    },
  });

  const mover = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("conteudos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "estrategia", "conteudos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = conteudos.filter((c) => {
    if (filterCliente && c.cliente_id !== filterCliente) return false;
    if (filterRede && c.rede !== filterRede) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !(c.titulo ?? "").toLowerCase().includes(s) &&
        !(c.clientes?.nome ?? "").toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  const byStatus = (status: string) => filtered.filter((c) => c.status === status);

  // KPI counts for summary bar
  const totalPostado = conteudos.filter((c) => c.status === "postado").length;
  const totalAprovacao = conteudos.filter((c) => c.status === "aprovacao").length;
  const totalProducao = conteudos.filter((c) => c.status === "producao").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="space-y-3 border-b border-border px-6 py-4">
        <div>
          <span className="eyebrow-pill">Estratégia</span>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Pipeline Editorial</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Acompanhe cada conteúdo por etapa</p>
        </div>
        <Button size="sm" onClick={() => setNovoOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Novo conteúdo
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 px-6 pt-4 pb-2 sm:grid-cols-3">
        {[
          { label: "Postados", value: totalPostado, icon: CheckCircle2, tint: "green" as const, delay: 0 },
          { label: "Em aprovação", value: totalAprovacao, icon: Clock, tint: "rose" as const, delay: 75 },
          { label: "Em produção", value: totalProducao, icon: Pencil, tint: "amber" as const, delay: 150 },
        ].map((kpi) => (
          <div key={kpi.label} className="animate-fade-up" style={{ animationDelay: kpi.delay + "ms" }}>
            <KpiCard label={kpi.label} value={kpi.value} icon={kpi.icon} tint={kpi.tint} format="raw" />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-border bg-secondary/20">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 w-48 text-xs"
            placeholder="Buscar título ou cliente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
        <select
          value={filterRede}
          onChange={(e) => setFilterRede(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">Todas as redes</option>
          {REDES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <span className="ml-auto text-[11px] font-medium text-muted-foreground">
          <span className="font-bold text-foreground">{filtered.length}</span> conteúdo
          {filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="flex justify-center items-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-5">
          <div className="flex gap-3 h-full" style={{ minWidth: "min(100%, 900px)" }}>
            {COLUMNS.map((col, colIdx) => {
              const cards = byStatus(col.key);
              return (
                <div
                  key={col.key}
                  className="animate-fade-up flex-1 min-w-[160px] flex flex-col rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden"
                  style={{ animationDelay: colIdx * 50 + "ms" }}
                >
                  {/* Column header */}
                  <div className="px-3.5 pt-3.5 pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${col.color}`}
                      >
                        {col.label}
                      </span>
                      <span className="text-[10px] font-black tabular-nums text-muted-foreground/50">
                        {String(cards.length).padStart(2, "0")}
                      </span>
                    </div>
                    {/* Accent bar */}
                    <div className={`mt-2.5 h-0.5 w-full rounded-full ${col.accent} opacity-60`} />
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 overflow-y-auto flex-1 p-2.5">
                    {cards.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border py-6 text-center text-[11px] text-muted-foreground/60">
                        vazio
                      </div>
                    ) : (
                      cards.map((c) => (
                        <ConteudoCard
                          key={c.id}
                          item={c}
                          onMove={(id, status) => mover.mutate({ id, status })}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <NovoConteudoDialog open={novoOpen} onClose={() => setNovoOpen(false)} />
    </div>
  );
}
