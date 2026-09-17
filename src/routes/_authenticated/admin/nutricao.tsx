import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Loader2, Save, Send, Sprout } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOTIVO_LABELS, PIPELINE, STATUS_LABELS } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import {
  NUTRICAO_FALLBACK,
  SEQUENCIAS,
  SEQUENCIA_LETRA,
  SEQUENCIA_NOME,
  SEQUENCIA_RESUMO,
  VARIAVEIS,
  lerNutricaoCliente,
  loadNutricaoConfig,
  renderNutricaoTexto,
  saveNutricaoCliente,
  saveNutricaoConfig,
  varsDeExemplo,
  varsDoCliente,
  variaveisUsadas,
  type NutricaoCliente,
  type NutricaoConfig,
  type SequenciaKey,
} from "@/lib/nutricao";

export const Route = createFileRoute("/_authenticated/admin/nutricao")({
  component: NutricaoPage,
  head: () => ({ meta: [{ title: "Nutrição de leads · Tabgha OS" }] }),
});

type ClienteNutricao = {
  id: string;
  nome: string;
  especialidade: string | null;
  nutricao: NutricaoCliente;
  conectado: boolean;
};

function NutricaoPage() {
  const [seq, setSeq] = useState<SequenciaKey>("seq_a");
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["admin", "nutricao-config"],
    queryFn: loadNutricaoConfig,
  });

  const { data: clientes = [] } = useQuery<ClienteNutricao[]>({
    queryKey: ["admin", "nutricao-clientes"],
    queryFn: async () => {
      const [{ data: rows, error }, { data: instances }] = await Promise.all([
        supabase
          .from("clientes")
          .select("id, nome, especialidade, dados_extras")
          .in("status", ["ativo", "onboarding"])
          .order("nome"),
        supabase.from("whatsapp_instances").select("cliente_id").eq("status", "connected"),
      ]);
      if (error) throw error;
      const conectados = new Set((instances ?? []).map((i) => i.cliente_id));
      return (rows ?? []).map((c) => ({
        id: c.id,
        nome: c.nome,
        especialidade: c.especialidade,
        nutricao: lerNutricaoCliente(c.dados_extras),
        conectado: conectados.has(c.id),
      }));
    },
  });

  const [rascunho, setRascunho] = useState<NutricaoConfig>(NUTRICAO_FALLBACK);
  useEffect(() => {
    if (config) setRascunho(config);
  }, [config]);

  const salvar = useMutation({
    mutationFn: () => saveNutricaoConfig(rascunho),
    onSuccess: () => {
      toast.success("Sequências salvas. Vale para os próximos disparos.");
      void qc.invalidateQueries({ queryKey: ["admin", "nutricao-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const atual = rascunho.sequencias[seq];
  const patch = (p: Partial<typeof atual>) =>
    setRascunho((r) => ({
      ...r,
      sequencias: { ...r.sequencias, [seq]: { ...r.sequencias[seq], ...p } },
    }));

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="animate-fade-up flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow-pill">Automações · WhatsApp</span>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Sprout className="h-6 w-6 text-emerald-700" />
            Nutrição de leads
          </h1>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Três sequências automáticas de WhatsApp. O gatilho usa os status do funil que já existem
            — nada de status paralelo. O envio respeita o fuso do cliente.
          </p>
        </div>
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="gap-2">
          {salvar.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar sequências
        </Button>
      </div>

      <div
        className="animate-fade-up flex flex-wrap items-center gap-3"
        style={{ animationDelay: "75ms" }}
      >
        <div className="segmented">
          {SEQUENCIAS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeq(s)}
              data-active={seq === s ? "true" : undefined}
              className="segmented-item"
            >
              Sequência {SEQUENCIA_LETRA[s]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <Label htmlFor="hora-envio" className="text-xs">
            Disparo às
          </Label>
          <Input
            id="hora-envio"
            type="number"
            min={0}
            max={23}
            value={String(rascunho.hora_envio)}
            onChange={(e) =>
              setRascunho((r) => ({
                ...r,
                hora_envio: Math.max(0, Math.min(23, Number(e.target.value) || 0)),
              }))
            }
            className="h-7 w-16 text-xs"
          />
          <span className="text-xs text-muted-foreground">h · {rascunho.timezone}</span>
        </div>
      </div>

      {/* Blocos em largura cheia, do mais enxuto para o mais denso: gatilho (uma
          faixa), mensagens (o editor, que é o miolo da tela), teste (uma faixa)
          e clientes. Duas colunas de alturas diferentes deixavam metade da
          página vazia. */}
      <div className="animate-fade-up space-y-4" style={{ animationDelay: "150ms" }}>
        <GatilhoCard seq={seq} config={atual} onChange={patch} />
        <MensagensCard seq={seq} config={atual} onChange={patch} />
        <TesteCard seq={seq} textos={atual.mensagens.map((m) => m.texto)} clientes={clientes} />
        <ClientesCard clientes={clientes} config={rascunho} />
      </div>
    </div>
  );
}

// ── Gatilho ──────────────────────────────────────────────────────────────────

function GatilhoCard({
  seq,
  config,
  onChange,
}: {
  seq: SequenciaKey;
  config: NutricaoConfig["sequencias"][SequenciaKey];
  onChange: (p: Partial<NutricaoConfig["sequencias"][SequenciaKey]>) => void;
}) {
  const temCampoExtra = seq === "seq_a" || seq === "seq_b";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/30 px-5 py-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
            Sequência {SEQUENCIA_LETRA[seq]}
          </p>
          <p className="text-sm font-semibold">{SEQUENCIA_NOME[seq]}</p>
          <p className="text-[11px] text-muted-foreground">{SEQUENCIA_RESUMO[seq]}</p>
        </div>
        <label className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground">
            {config.ativo ? "Ativa" : "Desligada"}
          </span>
          <Switch checked={config.ativo} onCheckedChange={(v) => onChange({ ativo: v })} />
        </label>
      </div>

      {/* flex-1 faz os campos dividirem a linha inteira — sem coluna sobrando */}
      <div className="flex flex-wrap items-start gap-4 p-5">
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label>Status disparador</Label>
          <Select
            value={config.gatilho_status}
            onValueChange={(v) => onChange({ gatilho_status: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE.map((st) => (
                <SelectItem key={st} value={st}>
                  {STATUS_LABELS[st]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {seq === "seq_a" ? (
          <div className="min-w-[200px] flex-1 space-y-1">
            <Label>Motivo da perda</Label>
            <Select
              value={config.gatilho_motivo_perda ?? "__todos"}
              onValueChange={(v) => onChange({ gatilho_motivo_perda: v === "__todos" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos">Qualquer motivo</SelectItem>
                {Object.entries(MOTIVO_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              O “perdido sem plano” do briefing: status Perdido + motivo Sem plano.
            </p>
          </div>
        ) : null}

        {seq === "seq_b" ? (
          <div className="min-w-[200px] flex-1 space-y-1">
            <Label htmlFor="idle-dias">Dias parado antes de entrar</Label>
            <Input
              id="idle-dias"
              type="number"
              min={1}
              max={90}
              value={String(config.gatilho_idle_dias ?? 5)}
              onChange={(e) =>
                onChange({ gatilho_idle_dias: Math.max(1, Number(e.target.value) || 1) })
              }
            />
            <p className="text-[11px] text-muted-foreground">
              D+3/D+7/D+15 começam quando a inatividade é detectada.
            </p>
          </div>
        ) : null}

        <p
          className={cn(
            "min-w-[260px] rounded-lg bg-secondary/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground",
            temCampoExtra ? "flex-1" : "flex-[2]",
          )}
        >
          A sequência só roda para clientes com WhatsApp conectado e com o toggle ligado. Se o lead
          avançar no funil, o restante das mensagens é cancelado.
        </p>
      </div>
    </div>
  );
}

// ── Mensagens: timeline + editor + preview ───────────────────────────────────

function MensagensCard({
  seq,
  config,
  onChange,
}: {
  seq: SequenciaKey;
  config: NutricaoConfig["sequencias"][SequenciaKey];
  onChange: (p: Partial<NutricaoConfig["sequencias"][SequenciaKey]>) => void;
}) {
  const mensagens = config.mensagens ?? [];
  const exemplo = useMemo(() => varsDeExemplo(), []);

  const setMensagem = (i: number, p: Partial<{ dia: number; texto: string }>) =>
    onChange({ mensagens: mensagens.map((m, idx) => (idx === i ? { ...m, ...p } : m)) });

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/30 px-5 py-3">
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
          Linha do tempo
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {mensagens.map((m, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 ? <span className="text-muted-foreground/40">→</span> : null}
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                Msg {i + 1} · D+{m.dia}
              </span>
            </span>
          ))}
          {mensagens.length === 0 ? (
            <span className="text-[11px] text-muted-foreground">Nenhuma mensagem cadastrada.</span>
          ) : null}
        </div>
      </div>

      <div className="divide-y divide-border">
        {mensagens.map((m, i) => {
          const usadas = variaveisUsadas(m.texto);
          return (
            <div key={i} className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`msg-${seq}-${i}`} className="text-sm font-semibold">
                    Mensagem {i + 1}
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor={`dia-${seq}-${i}`} className="text-xs text-muted-foreground">
                      Dia
                    </Label>
                    <Input
                      id={`dia-${seq}-${i}`}
                      type="number"
                      min={0}
                      max={365}
                      value={String(m.dia)}
                      onChange={(e) =>
                        setMensagem(i, { dia: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="h-7 w-16 text-xs"
                    />
                  </div>
                </div>
                <Textarea
                  id={`msg-${seq}-${i}`}
                  rows={10}
                  value={m.texto}
                  onChange={(e) => setMensagem(i, { texto: e.target.value })}
                  className="resize-y text-[12.5px] leading-relaxed"
                />
                <div className="flex flex-wrap gap-1">
                  {VARIAVEIS.map((v) => (
                    <button
                      key={v.chave}
                      type="button"
                      title={v.descricao}
                      onClick={() => setMensagem(i, { texto: `${m.texto}${v.label}` })}
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                        usadas.includes(v.chave)
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-border text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
                  Preview WhatsApp
                </p>
                <WhatsappPreview texto={renderNutricaoTexto(m.texto, exemplo)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WhatsappPreview({ texto }: { texto: string }) {
  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="rounded-2xl bg-[#ECE5DD] p-3">
      <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-[#DCF8C6] px-3 py-2 shadow-sm">
        <p className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-[#111B21]">
          {texto || "—"}
        </p>
        <p className="mt-1 flex items-center justify-end gap-0.5 text-[10px] text-[#667781]">
          {hora}
          <Check className="h-3 w-3" />
        </p>
      </div>
    </div>
  );
}

// ── Envio de teste ───────────────────────────────────────────────────────────

function TesteCard({
  seq,
  textos,
  clientes,
}: {
  seq: SequenciaKey;
  textos: string[];
  clientes: ClienteNutricao[];
}) {
  const [clienteId, setClienteId] = useState("");
  const [telefone, setTelefone] = useState("");
  const [indice, setIndice] = useState(0);

  useEffect(() => setIndice(0), [seq]);

  const conectados = clientes.filter((c) => c.conectado);
  const texto = textos[indice] ?? "";

  const enviar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("nurture-tick", {
        body: {
          action: "test",
          cliente_id: clienteId,
          telefone: telefone.replace(/\D/g, ""),
          texto,
          sequencia: seq,
        },
      });
      const payload = data as { ok?: boolean; error?: string } | null;
      if (error || !payload?.ok) throw new Error(payload?.error ?? "Falha ao enviar o teste.");
    },
    onSuccess: () => toast.success("Mensagem de teste enviada."),
    onError: (e: Error) => toast.error(e.message),
  });

  const podeEnviar = Boolean(clienteId && telefone.replace(/\D/g, "").length >= 10 && texto.trim());

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border bg-secondary/30 px-5 py-3">
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
          Enviar agora para número de teste
        </p>
      </div>

      {/* Uma faixa só: os campos dividem a linha e o botão fecha à direita */}
      <div className="flex flex-wrap items-end gap-3 px-5 pt-5">
        <div className="min-w-[220px] flex-[2] space-y-1">
          <Label>Cliente (de quem sai a mensagem)</Label>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha o cliente" />
            </SelectTrigger>
            <SelectContent>
              {conectados.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {textos.length > 1 ? (
          <div className="min-w-[150px] flex-1 space-y-1">
            <Label>Mensagem</Label>
            <Select value={String(indice)} onValueChange={(v) => setIndice(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {textos.map((_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    Mensagem {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="min-w-[180px] flex-1 space-y-1">
          <Label htmlFor="tel-teste">Telefone</Label>
          <Input
            id="tel-teste"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="5511999999999"
            inputMode="tel"
          />
        </div>

        <Button
          className="shrink-0 gap-2"
          disabled={!podeEnviar || enviar.isPending}
          onClick={() => enviar.mutate()}
        >
          {enviar.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Enviar teste
        </Button>
      </div>

      <p className="px-5 pb-5 pt-3 text-[11px] leading-relaxed text-muted-foreground">
        {conectados.length === 0 ? (
          <span className="font-semibold text-amber-700">
            Nenhum cliente com WhatsApp conectado — não há de onde enviar.{" "}
          </span>
        ) : null}
        As variáveis são resolvidas com os dados reais do cliente escolhido. O texto usado é o que
        está no editor salvo — salve antes de testar uma alteração.
      </p>
    </div>
  );
}

// ── Clientes: toggle por sequência + links ───────────────────────────────────

function ClientesCard({
  clientes,
  config,
}: {
  clientes: ClienteNutricao[];
  config: NutricaoConfig;
}) {
  const qc = useQueryClient();
  const [expandido, setExpandido] = useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NutricaoCliente }) =>
      saveNutricaoCliente(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "nutricao-clientes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="animate-fade-up overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border bg-secondary/30 px-5 py-3">
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
          Clientes · liga/desliga e variáveis
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Cada cliente decide quais sequências recebe e quais links entram nas mensagens.
        </p>
      </div>

      <div className="divide-y divide-border">
        {clientes.map((c) => {
          const n = c.nutricao;
          const aberto = expandido === c.id;
          return (
            <div key={c.id} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setExpandido(aberto ? null : c.id)}
                  className="min-w-0 text-left"
                >
                  <p className="truncate text-sm font-semibold">{c.nome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.especialidade ?? "Sem especialidade"} ·{" "}
                    {c.conectado ? "WhatsApp conectado" : "WhatsApp desconectado"}
                  </p>
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  {SEQUENCIAS.map((s) => {
                    const globalOff = !config.sequencias[s].ativo;
                    const ligado = n.ativo !== false && n[s] !== false;
                    return (
                      <label key={s} className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "text-[11px] font-semibold",
                            globalOff ? "text-muted-foreground/50" : "text-muted-foreground",
                          )}
                        >
                          {SEQUENCIA_LETRA[s]}
                        </span>
                        <Switch
                          checked={ligado && !globalOff}
                          disabled={globalOff || salvar.isPending}
                          onCheckedChange={(v) =>
                            salvar.mutate({ id: c.id, patch: { [s]: v } as NutricaoCliente })
                          }
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {aberto ? <VariaveisCliente cliente={c} onSalvar={salvar.mutate} /> : null}
            </div>
          );
        })}

        {clientes.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhum cliente ativo.
          </p>
        ) : null}
      </div>
    </div>
  );
}

const CAMPOS_CLIENTE: Array<{ chave: keyof NutricaoCliente; label: string; placeholder: string }> =
  [
    { chave: "nome_medico", label: "{nome_medico}", placeholder: "Dr. Pedro Correa" },
    {
      chave: "tema_da_especialidade",
      label: "{tema_da_especialidade}",
      placeholder: "harmonização facial",
    },
    { chave: "link_material", label: "{link_material}", placeholder: "https://…" },
    {
      chave: "link_conteudo_autoridade",
      label: "{link_conteudo_autoridade}",
      placeholder: "https://…",
    },
    {
      chave: "link_google_avaliacao",
      label: "{link_google_avaliacao}",
      placeholder: "https://g.page/…",
    },
  ];

function VariaveisCliente({
  cliente,
  onSalvar,
}: {
  cliente: ClienteNutricao;
  onSalvar: (v: { id: string; patch: NutricaoCliente }) => void;
}) {
  const [form, setForm] = useState<NutricaoCliente>(cliente.nutricao);
  useEffect(() => setForm(cliente.nutricao), [cliente.id, cliente.nutricao]);

  const preview = varsDoCliente({
    nomeLead: "Marina Souza",
    clienteNome: cliente.nome,
    especialidade: cliente.especialidade,
    nutricao: form,
  });

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-border bg-secondary/20 p-4 lg:grid-cols-2">
      {CAMPOS_CLIENTE.map((campo) => (
        <div key={campo.chave} className="space-y-1">
          <Label className="font-mono text-[11px]">{campo.label}</Label>
          <Input
            value={String(form[campo.chave] ?? "")}
            placeholder={campo.placeholder}
            onChange={(e) => setForm((f) => ({ ...f, [campo.chave]: e.target.value }))}
          />
        </div>
      ))}

      <div className="space-y-1">
        <Label htmlFor={`tz-${cliente.id}`}>Fuso horário</Label>
        <Input
          id={`tz-${cliente.id}`}
          value={String(form.timezone ?? "")}
          placeholder="America/Sao_Paulo"
          onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
        />
      </div>

      <div className="flex items-end gap-2 lg:col-span-2">
        <Button
          size="sm"
          onClick={() => onSalvar({ id: cliente.id, patch: form })}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Salvar variáveis
        </Button>
        <p className="text-[11px] text-muted-foreground">
          {VARIAVEIS.filter((v) => !preview[v.chave]).length > 0
            ? `Sem valor: ${VARIAVEIS.filter((v) => !preview[v.chave])
                .map((v) => v.label)
                .join(", ")} — mensagens que usam esses links não são enviadas.`
            : "Todas as variáveis estão preenchidas."}
        </p>
      </div>
    </div>
  );
}
