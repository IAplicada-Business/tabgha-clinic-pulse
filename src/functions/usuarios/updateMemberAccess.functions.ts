import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { updateUserEmail } from "@/functions/usuarios/updateUserEmail.functions";
import { APP_ROLES, type AppRole, isStaffRole } from "@/lib/roles";

const appRoleSchema = z.enum(APP_ROLES as unknown as [AppRole, ...AppRole[]]);

const schema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(2).nullable().optional(),
  email: z.string().email().optional(),
  cliente_id: z.string().uuid().nullable().optional(),
  permissoes: z.array(z.string()).min(1),
  roles: z.array(appRoleSchema).min(1).optional(),
});

type Input = z.infer<typeof schema>;

async function syncRoles(userId: string, roles: AppRole[]) {
  const { data: currentRows, error: readErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (readErr) throw new Error(readErr.message || "Falha ao ler papéis.");

  const current = new Set((currentRows ?? []).map((r) => r.role as AppRole));
  const wanted = new Set(roles);

  for (const role of wanted) {
    if (!current.has(role)) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw new Error(error.message || "Falha ao adicionar perfil.");
    }
  }
  for (const role of current) {
    if (!wanted.has(role)) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw new Error(error.message || "Falha ao remover perfil.");
    }
  }
}

/**
 * Atualiza nome, email de login, vínculo de cliente, papéis e permissões (admin).
 * Email passa pela edge (Auth + profiles).
 */
export async function updateMemberAccess(input: { data: Input }): Promise<void> {
  const data = schema.parse(input.data);

  if (data.roles?.includes("cliente") && !data.cliente_id) {
    throw new Error("Selecione o consultório vinculado para o portal do médico.");
  }

  if (data.roles && data.roles.filter(isStaffRole).length > 1) {
    throw new Error("Selecione apenas um perfil interno da equipe.");
  }

  if (data.email) {
    await updateUserEmail({
      data: {
        user_id: data.id,
        email: data.email,
        sync_cliente_email: true,
      },
    });
  }

  const wantsCliente = data.roles?.includes("cliente") ?? data.cliente_id != null;

  const patch: {
    nome?: string | null;
    cliente_id?: string | null;
    permissoes: string[];
  } = {
    permissoes: data.permissoes,
  };

  if (data.nome !== undefined) patch.nome = data.nome?.trim() || null;
  if (data.roles) {
    patch.cliente_id = wantsCliente ? data.cliente_id ?? null : null;
  } else if (data.cliente_id !== undefined) {
    patch.cliente_id = data.cliente_id;
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", data.id);
  if (error) throw new Error(error.message || "Falha ao atualizar acessos.");

  if (data.roles) {
    await syncRoles(data.id, data.roles);
  }
}
