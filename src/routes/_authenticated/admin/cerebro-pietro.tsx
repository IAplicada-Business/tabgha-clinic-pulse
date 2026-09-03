import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Loader2, Save, Radio, Bot, MessageSquare, Gauge } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PIETRO_FALLBACK,
  PIETRO_MODEL_OPTIONS,
  loadPietroDefaults,
  readAgenteAtivo,
  saveAgenteAtivo,
  savePietroDefaults,
  type PietroDefaults,
} from "@/lib/pietro";

export const Route = createFileRoute("/_authenticated/admin/cerebro-pietro")({
  component: CerebroPietroPage,
  head: () => ({ meta: [{ title: "Cérebro Pietro · Tabgha OS" }] }),
});

const TABS = ["Agente", "Clientes"] as const;
type Tab = (typeof TABS)[number];

function CerebroPietroPage() {
  const [tab, setTab] = useState<Tab>("Agente");

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="animate-fade-up">
        <span className="eyebrow-pill">Atendimento · IA</span>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Brain className="h-6 w-6 text-sky-700" />
          Cérebro Pietro
        </h1>
        <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
          Prompt e parâmetros globais do agente de WhatsApp (Método 7 Fontes). O liga/desliga é por
          cliente — o mesmo switch que existe na ficha do cliente, aba Conexões.
        </p>
      </div>

      <div className="segmented animate-fade-up" style={{ animationDelay: "150ms" }}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            data-active={tab === t ? "true" : undefined}
            className="segmented-item"
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Agente" ? <TabAgente /> : <TabClientes />}
    </div>
  );
}

// ── Aba Agente: prompt + parâmetros globais ───────────────────────────────────

function TabAgente() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "pietro-defaults"],
    queryFn: loadPietroDefaults,
  });

  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState<string>(PIETRO_FALLBACK.model);
  const [maxHistory, setMaxHistory] = useState(String(PIETRO_FALLBACK.max_history));
  const [temperature, setTemperature] = useState(String(PIETRO_FALLBACK.temperature));
  const [maxTokens, setMaxTokens] = useState(String(PIETRO_FALLBACK.max_tokens));
  const [reengageHours, setReengageHours] = useState(String(PIETRO_FALLBACK.reengage_hours));
  const [handoffScore, setHandoffScore] = useState(String(PIETRO_FALLBACK.handoff_score));
  const [handoffMessage, setHandoffMessage] = useState(PIETRO_FALLBACK.handoff_message);

  useEffect(() => {
    if (!data) return;
    setSystemPrompt(data.system_prompt ?? "");
    setModel(data.model ?? PIETRO_FALLBACK.model);
    setMaxHistory(String(data.max_history ?? PIETRO_FALLBACK.max_history));
    setTemperature(String(data.temperature ?? PIETRO_FALLBACK.temperature));
    setMaxTokens(String(data.max_tokens ?? PIETRO_FALLBACK.max_tokens));
    setReengageHours(String(data.reengage_hours ?? PIETRO_FALLBACK.reengage_hours));
    setHandoffScore(String(data.handoff_score ?? PIETRO_FALLBACK.handoff_score));
    setHandoffMessage(data.handoff_message ?? PIETRO_FALLBACK.handoff_message);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const num = (raw: string, min: number, max: number, fallback: number) => {
        const n = Number(raw);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
      };
      const patch: PietroDefaults = {
        system_prompt: systemPrompt.trim() || null,
        model,
        max_history: Math.round(num(maxHistory, 6, 60, PIETRO_FALLBACK.max_history)),
        temperature: num(temperature, 0, 1, PIETRO_FALLBACK.temperature),
        max_tokens: Math.round(num(maxTokens, 100, 2000, PIETRO_FALLBACK.max_tokens)),
        reengage_hours: num(reengageHours, 0, 72, PIETRO_FALLBACK.reengage_hours),
        handoff_score: Math.round(num(handoffScore, 0, 100, PIETRO_FALLBACK.handoff_score)),
        handoff_message: handoffMessage.trim() || PIETRO_FALLBACK.handoff_message,
      };
      await savePietroDefaults(patch);
    },
    onSuccess: () => {
      toast.success("Cérebro Pietro salvo. Vale para todas as próximas respostas.");
      void qc.invalidateQueries({ queryKey: ["admin", "pietro-defaults"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const promptEmpty = !systemPrompt.trim();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-sky-100 bg-sky-50/60 px-5 py-3">
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-sky-700">
            Prompt do sistema · global
          </p>
        </div>
        <div className="space-y-3 p-5">
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={26}
            className="resize-y font-mono text-[12px] leading-relaxed"
            placeholder="Cole aqui o prompt do agente (identidade, tom, Método 7 Fontes, fluxo, regras de passagem para humano)…"
          />
          <p className="text-[11px] text-muted-foreground">
            O formato de saída (JSON com reply, score, fontes tocadas, maturidade etc.) é
            acrescentado automaticamente pelo backend — não precisa incluir aqui.{" "}
            {promptEmpty
              ? "Vazio = modo legado (nome/tom/metodologia por cliente, prompt genérico intenção·urgência·fit·capacidade)."
              : "Um cliente pode ter prompt próprio na ficha (Conexões), que sobrepõe este."}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
            Parâmetros técnicos
          </p>

          <div className="space-y-1">
            <Label>Modelo</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIETRO_MODEL_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="max-history">Janela (msgs)</Label>
              <Input
                id="max-history"
                type="number"
                min={6}
                max={60}
                value={maxHistory}
                onChange={(e) => setMaxHistory(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="temperature">Temperatura</Label>
              <Input
                id="temperature"
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="max-tokens">Máx. tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                min={100}
                max={2000}
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reengage">Reengajar após (h)</Label>
              <Input
                id="reengage"
                type="number"
                min={0}
                max={72}
                step={0.5}
                value={reengageHours}
                onChange={(e) => setReengageHours(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="handoff-score">Score p/ handoff</Label>
              <Input
                id="handoff-score"
                type="number"
                min={0}
                max={100}
                value={handoffScore}
                onChange={(e) => setHandoffScore(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="handoff-message">Mensagem de passagem p/ humano</Label>
            <Input
              id="handoff-message"
              value={handoffMessage}
              onChange={(e) => setHandoffMessage(e.target.value)}
            />
          </div>

          <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
            <li>Janela: últimas N mensagens enviadas ao modelo (6–60).</li>
            <li>Reengajar: lead em silêncio há N horas recebe 1 mensagem do bot (0 desliga).</li>
            <li>Score p/ handoff: a partir da 3ª mensagem, score ≥ N passa para humano.</li>
            <li>
              Gatilhos de emergência/humano/cancelamento passam sempre, independente do prompt.
            </li>
          </ul>

          <Button
            size="sm"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="w-full gap-2"
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Cérebro Pietro
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Aba Clientes: status + liga/desliga por cliente ───────────────────────────

type ClienteRow = {
  id: string;
  nome: string;
  especialidade: string | null;
  status: string;
  dados_extras: Record<string, unknown> | null;
  instance: {
    id: string;
    status: string;
    phone: string | null;
    dados_extras: Record<string, unknown> | null;
  } | null;
  agenteAtivo: boolean;
  promptProprio: boolean;
  conversas: number;
  comBot: number;
};

const INSTANCE_LABEL: Record<string, string> = {
  connected: "Conectado",
  connecting: "Conectando",
  disconnected: "Desconectado",
  error: "Erro",
};

function TabClientes() {
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery<ClienteRow[]>({
    queryKey: ["admin", "pietro-clientes"],
    queryFn: async () => {
      const [{ data: clientes, error }, { data: instances }, { data: convs }] = await Promise.all([
        supabase
          .from("clientes")
          .select("id, nome, especialidade, status, dados_extras")
          .in("status", ["ativo", "onboarding"])
          .order("nome"),
        supabase
          .from("whatsapp_instances")
          .select("id, cliente_id, status, phone, dados_extras, atualizado_em")
          .order("atualizado_em", { ascending: false }),
        supabase.from("whatsapp_conversations").select("cliente_id, owner_state"),
      ]);
      if (error) throw error;

      type ClienteRaw = {
        id: string;
        nome: string;
        especialidade: string | null;
        status: string;
        dados_extras: unknown;
      };
      type InstanceRaw = {
        id: string;
        cliente_id: string;
        status: string;
        phone: string | null;
        dados_extras: unknown;
      };
      type ConvRaw = { cliente_id: string; owner_state: string | null };
      const clientesRaw = (clientes ?? []) as ClienteRaw[];
      const instancesRaw = (instances ?? []) as InstanceRaw[];
      const convsRaw = (convs ?? []) as ConvRaw[];

      return clientesRaw.map((c) => {
        const extras = (c.dados_extras ?? {}) as Record<string, unknown>;
        const agenteIa = (extras.agente_ia ?? {}) as Record<string, unknown>;
        const inst = instancesRaw.find((i) => i.cliente_id === c.id) ?? null;
        const instExtras = (inst?.dados_extras ?? null) as Record<string, unknown> | null;
        const mine = convsRaw.filter((x) => x.cliente_id === c.id);
        return {
          id: c.id,
          nome: c.nome,
          especialidade: c.especialidade,
          status: c.status,
          dados_extras: extras,
          instance: inst
            ? { id: inst.id, status: inst.status, phone: inst.phone, dados_extras: instExtras }
            : null,
          agenteAtivo: readAgenteAtivo(instExtras, extras),
          promptProprio: Boolean(String(agenteIa.system_prompt ?? "").trim()),
          conversas: mine.length,
          comBot: mine.filter((x) => x.owner_state === "bot").length,
        };
      });
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      await saveAgenteAtivo(id, ativo);
    },
    onSuccess: (_, vars) => {
      toast.success(vars.ativo ? "Agente ligado." : "Agente desligado.");
      void qc.invalidateQueries({ queryKey: ["admin", "pietro-clientes"] });
      void qc.invalidateQueries({ queryKey: ["admin", "cliente", vars.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = {
    ligados: rows.filter((r) => r.agenteAtivo).length,
    online: rows.filter((r) => r.instance?.status === "connected").length,
    conversas: rows.reduce((s, r) => s + r.conversas, 0),
    comBot: rows.reduce((s, r) => s + r.comBot, 0),
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Agentes ligados"
          value={totals.ligados}
          icon={Bot}
          tint="sky"
          format="raw"
        />
        <KpiCard
          label="WhatsApp online"
          value={totals.online}
          icon={Radio}
          tint="green"
          format="raw"
        />
        <KpiCard
          label="Conversas"
          value={totals.conversas}
          icon={MessageSquare}
          tint="blue"
          format="raw"
        />
        <KpiCard
          label="Com bot ativo"
          value={totals.comBot}
          icon={Gauge}
          tint="violet"
          format="raw"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Por cliente
        </p>
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
                  {["Cliente", "WhatsApp", "Prompt", "Conversas", "Agente", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((r) => {
                  const instStatus = r.instance?.status ?? "none";
                  const online = instStatus === "connected";
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-secondary/40">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.nome}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.especialidade ?? "—"} · {r.status}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {r.instance ? (
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                              online
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700",
                            )}
                          >
                            {INSTANCE_LABEL[instStatus] ?? instStatus}
                            {r.instance.phone ? ` · ${r.instance.phone}` : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem instância</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {r.promptProprio ? (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                            próprio
                          </span>
                        ) : (
                          "global"
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {r.conversas}
                        <span className="text-xs text-muted-foreground"> · {r.comBot} bot</span>
                      </td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={r.agenteAtivo}
                          disabled={toggle.isPending}
                          onCheckedChange={(v) => toggle.mutate({ id: r.id, ativo: v })}
                          aria-label={`Agente ${r.nome}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                          <Link to="/admin/clientes/$id" params={{ id: r.id }}>
                            Abrir ficha
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Nenhum cliente ativo.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          O agente só responde quando: instância Z-API salva + WhatsApp conectado + switch ligado.
          Credenciais e QR ficam na ficha do cliente → Conexões.
        </p>
      </div>
    </div>
  );
}
