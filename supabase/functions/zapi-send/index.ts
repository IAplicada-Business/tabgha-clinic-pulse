// Envia mensagem WhatsApp via provider (ZAPI) e grava outbound no banco.
//
// POST { cliente_id, telefone, body, conversation_id?, sender_type? }
// Auth: Authorization Bearer = service_role OU JWT de usuário com
// admin.atendimento (equipe) ou do próprio cliente (portal).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider, type WppInstance } from '../_shared/wpp_provider.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

type SendBody = {
  cliente_id?: string
  telefone?: string
  body?: string
  conversation_id?: string
  sender_type?: 'human' | 'bot'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const isServiceRole = token === SERVICE_KEY
  let senderUserId: string | null = null
  let callerRole: string | null = null
  let callerClienteId: string | null = null

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  if (!isServiceRole) {
    if (!ANON_KEY) {
      return json({ ok: false, error: 'anon_key_missing' }, 500)
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return json({ ok: false, error: 'unauthorized' }, 401)
    }

    senderUserId = user.id

    // Um usuário pode ter equipe + portal; maybeSingle() dava erro nesse caso.
    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      admin.from('user_roles').select('role').eq('user_id', user.id),
      admin.from('profiles').select('cliente_id, permissoes, ativo').eq('id', user.id).maybeSingle(),
    ])

    if (profile?.ativo === false) {
      return json({ ok: false, error: 'forbidden' }, 403)
    }

    const papeis = (roleRows ?? []).map((r) => r.role as string)
    const permissoes = (profile?.permissoes ?? []) as string[]
    // Quem atende o WhatsApp é quem tem admin.atendimento na matriz de perfis —
    // antes só super admin passava, o que travava o time de Atendimento/CS.
    const podeAtender =
      permissoes.includes('*') ||
      permissoes.includes('admin.atendimento') ||
      permissoes.includes('admin.*')

    callerRole = papeis.includes('cliente') && !podeAtender ? 'cliente' : 'staff'
    callerClienteId = profile?.cliente_id ?? null

    if (!podeAtender && !papeis.includes('cliente')) {
      return json({ ok: false, error: 'forbidden' }, 403)
    }
  }

  let payload: SendBody
  try {
    payload = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400)
  }

  const clienteId = payload.cliente_id
  const telefone = payload.telefone ? normalizePhone(payload.telefone) : ''
  const body = payload.body?.trim() ?? ''
  const senderType = payload.sender_type === 'bot' ? 'bot' : 'human'

  if (!clienteId || !telefone || !body) {
    return json({ ok: false, error: 'missing_fields' }, 400)
  }

  if (!isServiceRole && callerRole === 'cliente' && callerClienteId !== clienteId) {
    return json({ ok: false, error: 'forbidden' }, 403)
  }

  try {
    const { data: instance, error: instanceError } = await admin
      .from('whatsapp_instances')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('status', 'connected')
      .maybeSingle()

    if (instanceError) {
      throw instanceError
    }

    if (!instance) {
      return json({ ok: false, error: 'no_connected_instance' }, 404)
    }

    const provider = getProvider(instance as WppInstance)
    const sendResult = await provider.send(telefone, body)

    let conversationId = payload.conversation_id ?? null

    if (!conversationId) {
      const { data: createdId, error: convError } = await admin.rpc(
        'get_or_create_conversation',
        {
          _cliente_id: clienteId,
          _phone: telefone,
          _nome: null,
          _origem: 'desconhecido',
        },
      )

      if (convError || !createdId) {
        throw convError ?? new Error('failed to create conversation')
      }

      conversationId = createdId as string
    }

    const { data: message, error: messageError } = await admin
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversationId,
        cliente_id: clienteId,
        direction: 'outbound',
        sender_type: senderType,
        sender_user_id: senderType === 'human' ? senderUserId : null,
        body,
        zapi_message_id: sendResult.messageId,
        delivery_status: 'sent',
        metadata: { provider: instance.provider },
      })
      .select('id')
      .single()

    if (messageError) {
      throw messageError
    }

    const conversationUpdate: Record<string, string> = {
      last_outbound_at: new Date().toISOString(),
    }
    if (senderType === 'human') {
      conversationUpdate.owner_state = 'human_active'
    }

    await admin
      .from('whatsapp_conversations')
      .update(conversationUpdate)
      .eq('id', conversationId)

    return json({
      ok: true,
      message_id: message.id,
      conversation_id: conversationId,
      zapi_message_id: sendResult.messageId,
    })
  } catch (error) {
    console.error('zapi-send error', error)

    await admin.from('webhook_errors').insert({
      source: 'zapi_callback',
      cliente_id: clienteId,
      payload,
      error: error instanceof Error ? error.message : String(error),
    })

    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'send_failed',
      },
      500,
    )
  }
})
