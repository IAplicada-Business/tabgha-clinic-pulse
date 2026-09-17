// Pietro Brain — responde conversas WhatsApp com owner_state=bot.
//
// POST {
//   conversation_id: uuid,
//   cliente_id: uuid,
//   trigger_message_id?: uuid,
//   mode?: "reply" | "reengage"   // reengage = lead em silêncio; bot puxa a conversa (1x)
// }
// Auth: Authorization Bearer = service_role
//
// Config global: app_config.pietro_brain_defaults (editável em Admin → Cérebro Pietro).
// Override por cliente: clientes.dados_extras.agente_ia.system_prompt.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DEFAULT_HANDOFF_MESSAGE,
  DEFAULT_MODEL,
  parsePietroDecision,
  resolveSystemPrompt,
  wantsHuman,
  type PietroCliente,
  type PietroDefaults,
} from "../_shared/pietro_brain.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const REENGAGE_INSTRUCTION =
  "[Instrução do sistema — não mencione ao lead: ele está sem responder há algumas horas. Envie UMA mensagem curta e gentil de reengajamento, retomando o último ponto da conversa e terminando com uma pergunta simples. Não repita a mensagem anterior. Mantenha o mesmo tom e as mesmas regras.]";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clamp(n: unknown, min: number, max: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

type RequestBody = {
  conversation_id?: string;
  cliente_id?: string;
  trigger_message_id?: string;
  mode?: "reply" | "reengage";
};

async function loadDefaults(): Promise<PietroDefaults> {
  const { data } = await supabase
    .from("app_config")
    .select("valor")
    .eq("chave", "pietro_brain_defaults")
    .maybeSingle();
  return (data?.valor ?? {}) as PietroDefaults;
}

type ClaudeMessage = { role: "user" | "assistant"; content: string };

async function callClaude(params: {
  model: string;
  system: string;
  messages: ClaudeMessage[];
  temperature: number;
  maxTokens: number;
}) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: params.system,
      messages: params.messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
  }

  const result = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  return {
    text: result.content.find((b) => b.type === "text")?.text ?? "",
    stopReason: result.stop_reason ?? null,
    tokensIn: result.usage?.input_tokens ?? 0,
    tokensOut: result.usage?.output_tokens ?? 0,
  };
}

function looksLikePhone(nome: string | null | undefined, telefone: string | null | undefined) {
  if (!nome) return true;
  const digits = nome.replace(/\D/g, "");
  return digits.length >= 8 && (digits === (telefone ?? "").replace(/\D/g, "") || digits === nome);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== SERVICE_KEY) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const conversationId = body.conversation_id;
  const clienteId = body.cliente_id;
  const mode: "reply" | "reengage" = body.mode === "reengage" ? "reengage" : "reply";
  if (!conversationId || !clienteId) {
    return json({ ok: false, error: "missing_fields" }, 400);
  }

  if (!ANTHROPIC_KEY) {
    await supabase.from("webhook_errors").insert({
      source: "ai_respond",
      cliente_id: clienteId,
      payload: body,
      error: "ANTHROPIC_API_KEY não configurada",
    });
    return json({ ok: false, error: "missing_anthropic_key" }, 500);
  }

  try {
    const defaults = await loadDefaults();
    const model = defaults.model?.trim() || DEFAULT_MODEL;
    const maxHistory = Math.round(clamp(defaults.max_history, 6, 60, 30));
    const temperature = clamp(defaults.temperature, 0, 1, 0.5);
    const maxTokens = Math.round(clamp(defaults.max_tokens, 100, 2000, 400));
    const handoffScore = Math.round(clamp(defaults.handoff_score, 0, 100, 75));
    const handoffMessage = defaults.handoff_message?.trim() || DEFAULT_HANDOFF_MESSAGE;

    const { data: conversation, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select(
        "id, cliente_id, lead_id, contact_phone, contact_name, state, owner_state, bot_score, bot_notes, step_count",
      )
      .eq("id", conversationId)
      .eq("cliente_id", clienteId)
      .maybeSingle();

    if (convError) throw convError;
    if (!conversation) {
      return json({ ok: false, error: "conversation_not_found" }, 404);
    }

    if (conversation.owner_state !== "bot") {
      return json({
        ok: true,
        skipped: true,
        reason: "owner_not_bot",
        owner_state: conversation.owner_state,
      });
    }

    const prevNotes = ((conversation.bot_notes as Record<string, unknown> | null) ?? {});

    if (mode === "reengage" && prevNotes.reengage_sent_at) {
      return json({ ok: true, skipped: true, reason: "reengage_already_sent" });
    }

    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("id, nome, especialidade, dados_extras")
      .eq("id", clienteId)
      .single();

    if (clienteError) throw clienteError;

    const { data: history, error: historyError } = await supabase
      .from("whatsapp_messages")
      .select("direction, sender_type, body, sent_at")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: false })
      .limit(maxHistory);

    if (historyError) throw historyError;

    const chronological = [...(history ?? [])].reverse();
    const lastMessage = chronological[chronological.length - 1];
    const lastInbound = [...chronological].reverse().find((m) => m.direction === "inbound");
    const lastText = String(lastInbound?.body ?? "");

    if (mode === "reengage" && lastMessage?.direction !== "outbound") {
      // Lead já respondeu (ou nunca houve resposta do bot): não é caso de reengajar.
      return json({ ok: true, skipped: true, reason: "not_silent" });
    }

    const forceHandoff = mode === "reply" && wantsHuman(lastText);

    const claudeMessages: ClaudeMessage[] = chronological
      .filter((m) => m.body && m.body.trim().length > 0)
      .map((m) => ({
        role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
        content: m.body,
      }));

    // Anthropic exige começar com user
    while (claudeMessages.length && claudeMessages[0].role !== "user") {
      claudeMessages.shift();
    }

    if (mode === "reengage") {
      claudeMessages.push({ role: "user", content: REENGAGE_INSTRUCTION });
    }

    if (!claudeMessages.length) {
      return json({ ok: true, skipped: true, reason: "no_user_messages" });
    }

    const { system, source: promptSource } = resolveSystemPrompt(
      cliente as PietroCliente,
      defaults,
    );

    let tokensIn = 0;
    let tokensOut = 0;
    let stopReason: string | null = null;
    let decision = parsePietroDecision("");

    if (forceHandoff) {
      // Gatilho determinístico: não gasta modelo, resposta fixa.
      decision.reply = handoffMessage;
      decision.handoff = true;
      decision.state = "handoff";
      decision.handoff_reason = "gatilho_humano";
      decision.bot_score = Math.max(conversation.bot_score ?? 0, 80);
      decision.parse_ok = true;
    } else {
      let attempt = await callClaude({
        model,
        system,
        messages: claudeMessages,
        temperature,
        maxTokens,
      });
      tokensIn += attempt.tokensIn;
      tokensOut += attempt.tokensOut;
      stopReason = attempt.stopReason;
      decision = parsePietroDecision(attempt.text);

      // JSON cortado por max_tokens: 1 retry com folga.
      if (!decision.parse_ok && attempt.stopReason === "max_tokens") {
        attempt = await callClaude({
          model,
          system,
          messages: claudeMessages,
          temperature,
          maxTokens: Math.min(2000, maxTokens * 2),
        });
        tokensIn += attempt.tokensIn;
        tokensOut += attempt.tokensOut;
        stopReason = attempt.stopReason;
        decision = parsePietroDecision(attempt.text);
      }
    }

    if (!decision.reply) {
      if (mode === "reengage") {
        // Reengajamento falhou: melhor silêncio do que mensagem genérica.
        await supabase.from("webhook_errors").insert({
          source: "ai_respond",
          cliente_id: clienteId,
          payload: { ...body, stop_reason: stopReason },
          error: "reengage sem reply utilizável",
        });
        return json({ ok: true, skipped: true, reason: "empty_reply_reengage" });
      }
      decision.reply = handoffMessage;
      decision.handoff = true;
      decision.state = "handoff";
      decision.handoff_reason = decision.parse_ok ? "empty_reply" : "parse_failed";
    }

    if (
      mode === "reply" &&
      !decision.handoff &&
      decision.state !== "agendado" &&
      decision.bot_score >= handoffScore &&
      conversation.step_count >= 3
    ) {
      decision.handoff = true;
      decision.state = "handoff";
      decision.handoff_reason = decision.handoff_reason ?? "score_qualificado";
    }

    // Agendamento aceito: bot não confirma horário — equipe assume (human_alert), estado fica agendado.
    const agendou = decision.state === "agendado";
    const nextOwner = decision.handoff || agendou ? "human_alert" : "bot";
    const nextState = decision.handoff
      ? "handoff"
      : decision.state === "greeting" && conversation.step_count > 0
        ? "qualifying"
        : decision.state;
    const handoffReason = decision.handoff
      ? decision.handoff_reason
      : agendou
        ? "agendamento_confirmar"
        : null;

    const prevFontes = Array.isArray(prevNotes.fonte_tocada)
      ? (prevNotes.fonte_tocada as unknown[]).map(Number)
      : [];
    const fonteTocada = [...new Set([...prevFontes, ...decision.fonte_tocada])]
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
      .sort((a, b) => a - b);

    const passouParaHumano = nextOwner === "human_alert";

    const mergedNotes: Record<string, unknown> = {
      ...prevNotes,
      ...decision.bot_notes,
      fonte_tocada: fonteTocada,
      maturidade_percebida: decision.maturidade_percebida ?? prevNotes.maturidade_percebida ?? null,
      agendamento_sugerido:
        Boolean(prevNotes.agendamento_sugerido) || decision.agendamento_sugerido || agendou,
      passou_para_humano: Boolean(prevNotes.passou_para_humano) || passouParaHumano,
      passou_para_humano_motivo: passouParaHumano
        ? handoffReason
        : (prevNotes.passou_para_humano_motivo ?? null),
      nome: decision.lead.nome ?? prevNotes.nome ?? null,
      especialidade: decision.lead.especialidade ?? prevNotes.especialidade ?? null,
      cidade: decision.lead.cidade ?? prevNotes.cidade ?? null,
      dor_principal: decision.lead.dor_principal ?? prevNotes.dor_principal ?? null,
      last_handoff_reason: handoffReason ?? prevNotes.last_handoff_reason ?? null,
      updated_at: new Date().toISOString(),
      ...(mode === "reengage" ? { reengage_sent_at: new Date().toISOString() } : {}),
    };

    await supabase
      .from("whatsapp_conversations")
      .update({
        state: nextState,
        owner_state: nextOwner,
        bot_score: decision.bot_score,
        bot_notes: mergedNotes,
      })
      .eq("id", conversationId);

    if (conversation.lead_id) {
      const leadUpdate: Record<string, unknown> = {};
      if (decision.lead_status) leadUpdate.status = decision.lead_status;
      if (decision.lead.nome) {
        const { data: lead } = await supabase
          .from("leads")
          .select("nome, telefone")
          .eq("id", conversation.lead_id)
          .maybeSingle();
        if (lead && looksLikePhone(lead.nome, lead.telefone)) leadUpdate.nome = decision.lead.nome;
      }
      if (Object.keys(leadUpdate).length) {
        await supabase
          .from("leads")
          .update(leadUpdate)
          .eq("id", conversation.lead_id)
          .eq("cliente_id", clienteId);
      }
    }

    // Envia resposta via zapi-send (grava outbound sender_type=bot, atualiza last_outbound_at)
    const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/zapi-send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cliente_id: clienteId,
        telefone: conversation.contact_phone,
        body: decision.reply,
        conversation_id: conversationId,
        sender_type: "bot",
      }),
    });

    const sendJson = (await sendRes.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      message_id?: string;
    };

    if (!sendRes.ok || sendJson.ok === false) {
      throw new Error(`zapi-send failed: ${sendJson.error ?? sendRes.status}`);
    }

    await supabase.from("automation_logs").insert({
      cliente_id: clienteId,
      action: mode === "reengage" ? "ai_reengage" : "ai_respond",
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      metadata: {
        conversation_id: conversationId,
        trigger_message_id: body.trigger_message_id ?? null,
        mode,
        prompt_source: promptSource,
        stop_reason: stopReason,
        parse_ok: decision.parse_ok,
        handoff: decision.handoff,
        handoff_reason: handoffReason,
        bot_score: decision.bot_score,
        fonte_tocada: decision.fonte_tocada,
        maturidade_percebida: decision.maturidade_percebida,
        agendamento_sugerido: decision.agendamento_sugerido,
        state: nextState,
        owner_state: nextOwner,
        model,
        zapi_message_id: sendJson.message_id ?? null,
      },
    });

    return json({
      ok: true,
      mode,
      handoff: decision.handoff,
      bot_score: decision.bot_score,
      state: nextState,
      owner_state: nextOwner,
      message_id: sendJson.message_id ?? null,
    });
  } catch (error) {
    console.error("ai-respond error", error);

    await supabase.from("webhook_errors").insert({
      source: "ai_respond",
      cliente_id: clienteId,
      payload: body,
      error: error instanceof Error ? error.message : String(error),
    });

    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "ai_respond_failed",
      },
      500,
    );
  }
});
