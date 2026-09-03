// Cron (hora em hora): nutrição de leads (sequências A, B e C)
// + reengajamento do Pietro em conversas de bot paradas (pietro_brain_defaults.reengage_hours).
//
// Camadas, sem sobreposição:
//   1. reengage (IA, 1x por conversa, ~4h de silêncio)   → ai-respond mode=reengage
//   2. close_stalled_conversations (SQL, 30/30min)       → marca stalled após a janela + graça
//   3. nutrição (templates, dia+hora local do cliente)   → nurture_jobs (seq_a/seq_b/seq_c)
//
// A configuração das sequências (status disparador, dias e textos) vive em
// app_config.chave = 'nurture_defaults' e é editada em /admin/nutricao.
// Os ajustes por cliente (liga/desliga e links) vivem em
// clientes.dados_extras.nutricao.
//
// POST {} — roda o tick.
// POST { action: "test", cliente_id, telefone, texto } — envia uma mensagem de
//   teste já com as variáveis do cliente resolvidas (exige JWT de staff).
// Auth do tick: livre (verify_jwt=false) — usa service role internamente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SEQUENCIAS,
  SEQUENCIA_LETRA,
  VARIAVEIS_LINK,
  agendarEnvio,
  fusoDoCliente,
  horaDeEnvio,
  lerNutricaoCliente,
  renderNutricaoTexto,
  sequenciaAtivaParaCliente,
  variaveisUsadas,
  varsDoCliente,
  type NutricaoCliente,
  type NutricaoConfig,
  type SequenciaConfig,
  type SequenciaKey,
} from "../_shared/nutricao.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Status que encerram qualquer sequência em andamento — o lead avançou. */
const STATUS_ENCERRA = ["agendado", "atendido", "convertido"];

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function sendBotMessage(clienteId: string, telefone: string, body: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/zapi-send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cliente_id: clienteId,
      telefone,
      body,
      sender_type: "bot",
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || payload.ok === false) {
    throw new Error(payload.error ?? `zapi-send ${res.status}`);
  }
  return payload;
}

// ── Reengajamento do Pietro ──────────────────────────────────────────────────

async function loadReengageHours(): Promise<number> {
  const { data } = await supabase
    .from("app_config")
    .select("valor")
    .eq("chave", "pietro_brain_defaults")
    .maybeSingle();
  const raw = (data?.valor as { reengage_hours?: unknown } | null)?.reengage_hours;
  const n = Number(raw ?? 4);
  return Number.isFinite(n) ? Math.max(0, Math.min(72, n)) : 4;
}

function flag(v: unknown) {
  return v === true || v === "true";
}

/** Mesma regra do whatsapp-inbound: instância primeiro, legado em clientes depois. */
async function agenteAtivoPorCliente(): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  const { data: instances } = await supabase
    .from("whatsapp_instances")
    .select("cliente_id, dados_extras")
    .eq("status", "connected");
  for (const i of instances ?? []) {
    const extras = (i.dados_extras ?? {}) as Record<string, unknown>;
    if ("agente_ativo" in extras) map.set(i.cliente_id, flag(extras.agente_ativo));
  }
  const { data: clientes } = await supabase.from("clientes").select("id, dados_extras");
  for (const c of clientes ?? []) {
    if (map.has(c.id)) continue;
    const zapi = ((c.dados_extras as Record<string, unknown> | null)?.automacoes as
      | { zapi?: { agente_ativo?: unknown } }
      | undefined)?.zapi;
    map.set(c.id, flag(zapi?.agente_ativo));
  }
  return map;
}

async function reengageSilentBotConversations() {
  const hours = await loadReengageHours();
  if (hours <= 0) return { reengaged: 0, skipped: 0, disabled: true };

  const now = Date.now();
  const since = new Date(now - hours * 3_600_000).toISOString();
  // Janela [hours, 2*hours]: fora disso o close_stalled já assume.
  const floor = new Date(now - hours * 2 * 3_600_000).toISOString();

  const { data: convs, error } = await supabase
    .from("whatsapp_conversations")
    .select("id, cliente_id, contact_phone, last_inbound_at, last_outbound_at, bot_notes")
    .eq("owner_state", "bot")
    .in("state", ["greeting", "qualifying", "routing"])
    .is("closed_at", null)
    .not("last_inbound_at", "is", null)
    .not("last_outbound_at", "is", null)
    .lt("last_inbound_at", since)
    .gt("last_inbound_at", floor)
    .order("last_inbound_at", { ascending: true })
    .limit(30);

  if (error) throw error;
  if (!convs?.length) return { reengaged: 0, skipped: 0 };

  const ativo = await agenteAtivoPorCliente();
  let reengaged = 0;
  let skipped = 0;

  for (const c of convs) {
    const notes = (c.bot_notes ?? {}) as Record<string, unknown>;
    const botRespondeu =
      c.last_outbound_at && c.last_inbound_at && c.last_outbound_at >= c.last_inbound_at;
    if (!botRespondeu || notes.reengage_sent_at || !ativo.get(c.cliente_id)) {
      skipped += 1;
      continue;
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-respond`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation_id: c.id,
          cliente_id: c.cliente_id,
          mode: "reengage",
        }),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; skipped?: boolean };
      if (res.ok && out.ok && !out.skipped) reengaged += 1;
      else skipped += 1;
    } catch (err) {
      skipped += 1;
      await supabase.from("webhook_errors").insert({
        source: "nurture_tick",
        cliente_id: c.cliente_id,
        payload: { conversation_id: c.id, step: "reengage" },
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { reengaged, skipped };
}

// ── Nutrição ────────────────────────────────────────────────────────────────

type ClienteCtx = {
  id: string;
  nome: string;
  especialidade: string | null;
  nutricao: NutricaoCliente;
  redes: Record<string, string>;
  conectado: boolean;
};

async function loadConfig(): Promise<NutricaoConfig> {
  const { data } = await supabase
    .from("app_config")
    .select("valor")
    .eq("chave", "nurture_defaults")
    .maybeSingle();
  return (data?.valor ?? {}) as NutricaoConfig;
}

/** Clientes com o bloco de nutrição resolvido e o status da instância WhatsApp. */
async function loadClientes(): Promise<Map<string, ClienteCtx>> {
  const { data: clientes, error } = await supabase
    .from("clientes")
    .select("id, nome, especialidade, dados_extras");
  if (error) throw error;

  const { data: instances } = await supabase
    .from("whatsapp_instances")
    .select("cliente_id")
    .eq("status", "connected");
  const conectados = new Set((instances ?? []).map((i) => i.cliente_id));

  const map = new Map<string, ClienteCtx>();
  for (const c of clientes ?? []) {
    const extras = (c.dados_extras ?? {}) as Record<string, unknown>;
    map.set(c.id, {
      id: c.id,
      nome: c.nome,
      especialidade: c.especialidade,
      nutricao: lerNutricaoCliente(extras),
      redes: (extras.redes ?? {}) as Record<string, string>,
      conectado: conectados.has(c.id),
    });
  }
  return map;
}

function seqConfig(config: NutricaoConfig, seq: SequenciaKey): SequenciaConfig | undefined {
  return config.sequencias?.[seq];
}

function mensagensDe(cfg: SequenciaConfig | undefined): { dia: number; texto: string }[] {
  return (cfg?.mensagens ?? []).filter((m) => typeof m?.texto === "string" && m.texto.trim());
}

/** Já existe job desta sequência para o lead (ativo ou concluído)? */
async function jaEnfileirado(leadId: string, seq: SequenciaKey): Promise<boolean> {
  const { data } = await supabase
    .from("nurture_jobs")
    .select("id")
    .eq("lead_id", leadId)
    .eq("kind", seq)
    .in("status", ["pending", "sent", "done"])
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function enfileirar(
  seq: SequenciaKey,
  lead: { id: string; cliente_id: string },
  ctx: ClienteCtx,
  gatilho: Date,
  config: NutricaoConfig,
  motivo: string,
): Promise<boolean> {
  const cfg = seqConfig(config, seq);
  const mensagens = mensagensDe(cfg);
  if (!mensagens.length) return false;

  const tz = fusoDoCliente(ctx.nutricao, config);
  const quando = agendarEnvio(gatilho, mensagens[0].dia, horaDeEnvio(config), tz);

  const { error } = await supabase.from("nurture_jobs").insert({
    cliente_id: lead.cliente_id,
    lead_id: lead.id,
    kind: seq,
    step: 0,
    status: "pending",
    next_run_at: quando.toISOString(),
    metadata: { gatilho_em: gatilho.toISOString(), motivo, timezone: tz },
  });
  return !error;
}

/** Varre os leads e enfileira quem entrou no gatilho de cada sequência. */
async function enfileirarSequencias(config: NutricaoConfig, clientes: Map<string, ClienteCtx>) {
  const agora = new Date();
  const resultado: Record<string, number> = { seq_a: 0, seq_b: 0, seq_c: 0 };

  for (const seq of SEQUENCIAS) {
    const cfg = seqConfig(config, seq);
    if (!cfg?.ativo || !cfg.gatilho_status || !mensagensDe(cfg).length) continue;

    let query = supabase
      .from("leads")
      .select("id, cliente_id, telefone, status, motivo_perda, atualizado_em")
      .eq("status", cfg.gatilho_status)
      .not("telefone", "is", null)
      .order("atualizado_em", { ascending: false })
      .limit(200);

    // Sequência A: além do status, exige o motivo de perda configurado.
    if (cfg.gatilho_motivo_perda) query = query.eq("motivo_perda", cfg.gatilho_motivo_perda);

    // Sequência B: só entra depois de N dias parada no status.
    const idleDias = Number(cfg.gatilho_idle_dias ?? 0);
    if (idleDias > 0) {
      const limite = new Date(agora.getTime() - idleDias * 86_400_000);
      query = query.lt("atualizado_em", limite.toISOString());
    }

    const { data: leads, error } = await query;
    if (error) throw error;

    for (const lead of leads ?? []) {
      const ctx = clientes.get(lead.cliente_id);
      if (!ctx || !ctx.conectado) continue;
      if (!sequenciaAtivaParaCliente(seq, cfg, ctx.nutricao)) continue;
      if (await jaEnfileirado(lead.id, seq)) continue;

      // A e C contam a partir do momento em que o card mudou de status.
      // B conta a partir da detecção da inatividade (o card já está parado há
      // gatilho_idle_dias; contar do atualizado_em faria a D+3 nascer vencida).
      const gatilho = idleDias > 0 ? agora : new Date(lead.atualizado_em);
      const ok = await enfileirar(seq, lead, ctx, gatilho, config, `gatilho_${seq}`);
      if (ok) resultado[seq] += 1;
    }
  }

  return resultado;
}

/** Envia as mensagens vencidas. */
async function processarJobs(config: NutricaoConfig, clientes: Map<string, ClienteCtx>) {
  const { data: jobs, error } = await supabase
    .from("nurture_jobs")
    .select("id, cliente_id, lead_id, kind, step, metadata, enviadas")
    .eq("status", "pending")
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(40);

  if (error) throw error;

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const encerrar = async (id: string, motivo: string, status = "skipped") => {
    await supabase.from("nurture_jobs").update({ status, last_error: motivo }).eq("id", id);
    skipped += 1;
  };

  for (const job of jobs ?? []) {
    const seq = job.kind as SequenciaKey;
    try {
      const cfg = seqConfig(config, seq);
      const mensagens = mensagensDe(cfg);
      const mensagem = mensagens[job.step];
      if (!cfg || !mensagem) {
        await encerrar(job.id, "sem_mensagem", "done");
        continue;
      }

      const ctx = clientes.get(job.cliente_id);
      if (!ctx) {
        await encerrar(job.id, "cliente_nao_encontrado");
        continue;
      }
      if (!ctx.conectado) {
        await encerrar(job.id, "no_connected_instance");
        continue;
      }
      if (!sequenciaAtivaParaCliente(seq, cfg, ctx.nutricao)) {
        await encerrar(job.id, "sequencia_desligada");
        continue;
      }

      const { data: lead } = await supabase
        .from("leads")
        .select("id, nome, telefone, status")
        .eq("id", job.lead_id)
        .maybeSingle();

      if (!lead?.telefone) {
        await encerrar(job.id, "sem_telefone");
        continue;
      }
      // O lead avançou no funil — a sequência perde o sentido. A Sequência C
      // é a exceção: ela nasce justamente de um status de avanço.
      if (seq !== "seq_c" && STATUS_ENCERRA.includes(lead.status)) {
        await encerrar(job.id, "lead_avancou", "done");
        continue;
      }

      const vars = varsDoCliente({
        nomeLead: lead.nome,
        clienteNome: ctx.nome,
        especialidade: ctx.especialidade,
        nutricao: ctx.nutricao,
        redes: ctx.redes,
      });

      // Link obrigatório faltando: não manda texto quebrado.
      const faltando = variaveisUsadas(mensagem.texto).filter(
        (v) => (VARIAVEIS_LINK as readonly string[]).includes(v) && !vars[v],
      );
      if (faltando.length) {
        await encerrar(job.id, `sem_${faltando[0]}`);
        continue;
      }

      const texto = renderNutricaoTexto(mensagem.texto, vars);
      await sendBotMessage(job.cliente_id, lead.telefone, texto);

      const agora = new Date();
      const enviadas = [
        ...((job.enviadas ?? []) as unknown[]),
        { mensagem: job.step + 1, dia: mensagem.dia, enviada_em: agora.toISOString() },
      ];

      const proximo = job.step + 1;
      const proximaMensagem = mensagens[proximo];
      if (proximaMensagem) {
        const tz = String(
          (job.metadata as Record<string, unknown> | null)?.timezone ??
            fusoDoCliente(ctx.nutricao, config),
        );
        const gatilhoIso = (job.metadata as Record<string, unknown> | null)?.gatilho_em;
        const gatilho = gatilhoIso ? new Date(String(gatilhoIso)) : agora;
        await supabase
          .from("nurture_jobs")
          .update({
            status: "pending",
            step: proximo,
            enviadas,
            last_sent_at: agora.toISOString(),
            next_run_at: agendarEnvio(
              gatilho,
              proximaMensagem.dia,
              horaDeEnvio(config),
              tz,
            ).toISOString(),
            last_error: null,
          })
          .eq("id", job.id);
      } else {
        await supabase
          .from("nurture_jobs")
          .update({
            status: "done",
            step: proximo,
            enviadas,
            last_sent_at: agora.toISOString(),
            last_error: null,
          })
          .eq("id", job.id);
      }

      // Histórico que aparece no card do lead.
      await supabase.from("automation_logs").insert({
        cliente_id: job.cliente_id,
        action: "nutricao_enviada",
        metadata: {
          job_id: job.id,
          lead_id: job.lead_id,
          sequencia: seq,
          sequencia_letra: SEQUENCIA_LETRA[seq],
          sequencia_nome: cfg.nome ?? seq,
          mensagem: job.step + 1,
          total_mensagens: mensagens.length,
          dia: mensagem.dia,
          texto,
        },
      });

      sent += 1;
    } catch (err) {
      failed += 1;
      await supabase
        .from("nurture_jobs")
        .update({
          status: "failed",
          last_error: err instanceof Error ? err.message : String(err),
        })
        .eq("id", job.id);

      await supabase.from("webhook_errors").insert({
        source: "nurture_tick",
        cliente_id: job.cliente_id,
        payload: { job_id: job.id, lead_id: job.lead_id, kind: job.kind },
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { sent, failed, skipped };
}

// ── Envio de teste (botão "Enviar agora para número de teste") ───────────────

async function enviarTeste(req: Request, body: Record<string, unknown>) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "unauthorized" }, 401);
  if (!ANON_KEY) return json({ ok: false, error: "anon_key_missing" }, 500);

  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await caller.auth.getUser();
  if (!userData?.user) return json({ ok: false, error: "unauthorized" }, 401);

  const { data: staff } = await supabase.rpc("is_staff", { _user_id: userData.user.id });
  if (staff !== true) return json({ ok: false, error: "forbidden" }, 403);

  const clienteId = String(body.cliente_id ?? "");
  const telefone = String(body.telefone ?? "").trim();
  const textoBruto = String(body.texto ?? "");
  if (!clienteId || !telefone || !textoBruto) {
    return json({ ok: false, error: "missing_params" }, 400);
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nome, especialidade, dados_extras")
    .eq("id", clienteId)
    .maybeSingle();
  if (!cliente) return json({ ok: false, error: "cliente_nao_encontrado" }, 404);

  const extras = (cliente.dados_extras ?? {}) as Record<string, unknown>;
  const vars = varsDoCliente({
    nomeLead: String(body.nome_lead ?? "Teste"),
    clienteNome: cliente.nome,
    especialidade: cliente.especialidade,
    nutricao: lerNutricaoCliente(extras),
    redes: (extras.redes ?? {}) as Record<string, string>,
  });

  const texto = renderNutricaoTexto(textoBruto, vars);
  await sendBotMessage(clienteId, telefone, texto);

  await supabase.from("automation_logs").insert({
    cliente_id: clienteId,
    action: "nutricao_teste",
    metadata: { telefone, sequencia: body.sequencia ?? null, por: userData.user.id },
  });

  return json({ ok: true, texto });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  let body: Record<string, unknown> = {};
  if (req.method === "POST") body = await req.json().catch(() => ({}));

  if (body.action === "test") {
    try {
      return await enviarTeste(req, body);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : "test_failed" }, 500);
    }
  }

  try {
    const config = await loadConfig();
    const clientes = await loadClientes();

    const reengage = await reengageSilentBotConversations().catch((err) => {
      console.error("reengage error", err);
      return { reengaged: 0, skipped: 0, error: err instanceof Error ? err.message : String(err) };
    });
    const enfileirados = await enfileirarSequencias(config, clientes);
    const processados = await processarJobs(config, clientes);

    return json({ ok: true, reengage, enfileirados, ...processados });
  } catch (error) {
    console.error("nurture-tick error", error);
    await supabase.from("webhook_errors").insert({
      source: "nurture_tick",
      error: error instanceof Error ? error.message : String(error),
    });
    return json(
      { ok: false, error: error instanceof Error ? error.message : "nurture_tick_failed" },
      500,
    );
  }
});
