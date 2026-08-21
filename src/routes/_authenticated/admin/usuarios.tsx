import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, UserPlus, Users, Loader2, ShieldCheck, UserCog, Layers } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { PermissionPicker } from "@/components/PermissionPicker";
import { CredentialsDialog, type AccessCredentials } from "@/components/usuarios/CredentialsDialog";
import { ProvisionalPasswordField } from "@/components/usuarios/ProvisionalPasswordField";
import { createUserWithRole } from "@/functions/usuarios/createUserWithRole.functions";
import { resetProvisionalPassword } from "@/functions/usuarios/resetProvisionalPassword.functions";
import { updateMemberAccess } from "@/functions/usuarios/updateMemberAccess.functions";
import { summarizePermissions } from "@/lib/permissions";
import { provisionalPassword } from "@/lib/provisional-password";
import { useAuth } from "@/lib/auth";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosPage,
  head: () => ({ meta: [{ title: "Usuários & acessos — Tabgha Admin" }] }),
});

type AppRole = "admin" | "cliente";

type TeamMember = {
  id: string;
  nome: string | null;
  email: string | null;
  roles: AppRole[];
  permissoes: string[];
  cliente_id: string | null;
  cliente_nome: string | null;
};

/** Fetch rápido: profiles + roles + mapa de clientes em paralelo (sem join aninhado). */
async function fetchTeam(): Promise<TeamMember[]> {
  const [profilesRes, rolesRes, clientesRes] = await Promise.all([
    supabase.from("profiles").select("id, nome, email, permissoes, cliente_id").order("nome"),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("clientes").select("id, nome"),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (rolesRes.error) throw new Error(rolesRes.error.message);

  const rolesByUser = new Map<string, AppRole[]>();
  for (const row of rolesRes.data ?? []) {
    const list = rolesByUser.get(row.user_id) ?? [];
    if (row.role === "admin" || row.role === "cliente") list.push(row.role);
    rolesByUser.set(row.user_id, list);
  }
  const nomeByCliente = new Map((clientesRes.data ?? []).map((c) => [c.id, c.nome]));

  return (profilesRes.data ?? []).map((p) => {
    const roles = rolesByUser.get(p.id) ?? [];
    roles.sort((a, b) => (a === b ? 0 : a === "admin" ? -1 : 1));
    return {
      id: p.id,
      nome: p.nome,
      email: p.email,
      roles,
      permissoes: p.permissoes ?? [],
      cliente_id: p.cliente_id,
      cliente_nome: p.cliente_id ? (nomeByCliente.get(p.cliente_id) ?? null) : null,
    };
  });
}

const addUserSchema = z
  .object({
    nome: z.string().min(2, "Nome obrigatório"),
    email: z.string().email("Email inválido"),
    roles: z.array(z.enum(["admin", "cliente"])).min(1, "Selecione ao menos um perfil"),
    cliente_id: z.string().nullable().default(null),
  })
  .superRefine((data, ctx) => {
    if (data.roles.includes("cliente") && !data.cliente_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione o consultório vinculado ao portal.",
        path: ["cliente_id"],
      });
    }
  });

type AddUserForm = {
  nome: string;
  email: string;
  roles: AppRole[];
  cliente_id: string | null;
};

function initials(nome: string | null, email: string | null): string {
  if (nome)
    return nome
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

function roleLabel(roles: AppRole[]): string {
  if (roles.includes("admin") && roles.includes("cliente")) return "Admin + Portal";
  if (roles.includes("admin")) return "Admin";
  if (roles.includes("cliente")) return "Cliente";
  return "Sem perfil";
}

function AddUserDialog({
  open,
  onClose,
  onCredentials,
}: {
  open: boolean;
  onClose: () => void;
  onCredentials: (c: AccessCredentials) => void;
}) {
  const [permissoes, setPermissoes] = useState<string[]>(["*"]);
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: clientes = [] } = useClientesOptions();

  const form = useForm<AddUserForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(addUserSchema) as any,
    defaultValues: { nome: "", email: "", roles: ["cliente"], cliente_id: null },
  });

  const roles = form.watch("roles");
  const wantsAdmin = roles.includes("admin");
  const wantsCliente = roles.includes("cliente");

  function toggleRole(role: AppRole, checked: boolean) {
    const next = checked
      ? [...new Set([...roles, role])]
      : roles.filter((r) => r !== role);
    form.setValue("roles", next, { shouldValidate: true });
    if (!next.includes("cliente")) form.setValue("cliente_id", null);
    // Admin + Portal: acesso total evita menu vazio em uma das áreas.
    if (next.includes("admin") && next.includes("cliente")) setPermissoes(["*"]);
  }

  const mutation = useMutation({
    mutationFn: (data: AddUserForm) =>
      createUserWithRole({
        data: {
          ...data,
          roles: data.roles,
          cliente_id: data.roles.includes("cliente") ? data.cliente_id : null,
          permissoes,
        },
      }),
    onSuccess: (result) => {
      setFormError(null);
      toast.success(
        result.reused_existing
          ? `Senha redefinida para ${result.temporary_password}.`
          : `Acesso criado. Senha: ${result.temporary_password}`,
      );
      onCredentials({
        email: result.email,
        temporary_password: result.temporary_password || provisionalPassword(),
        reused_existing: result.reused_existing,
        role: (result.roles ?? []).join("+") || result.role,
      });
      void queryClient.invalidateQueries({ queryKey: ["admin", "team"] });
      onClose();
      form.reset({ nome: "", email: "", roles: ["cliente"], cliente_id: null });
      setPermissoes(["*"]);
    },
    onError: (err: Error) => {
      setFormError(err.message);
      toast.error(err.message);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setFormError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar membro</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((d) => {
            setFormError(null);
            if (d.roles.includes("cliente") && !d.cliente_id) {
              setFormError("Selecione o consultório vinculado.");
              return;
            }
            if (permissoes.length === 0) {
              setFormError("Selecione ao menos uma permissão.");
              return;
            }
            mutation.mutate(d as AddUserForm);
          })}
          className="space-y-4 py-2"
        >
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            Isso cria o <strong>login</strong> (email + senha provisória{" "}
            <strong>{provisionalPassword()}</strong>). Dá para liberar Admin e Portal no mesmo
            usuário — depois a pessoa troca de área no menu.
          </p>

          {formError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <div className="space-y-1">
            <Label>Nome</Label>
            <Input placeholder="Nome completo" {...form.register("nome")} />
            {form.formState.errors.nome && (
              <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Email de login</Label>
            <Input type="email" placeholder="email@exemplo.com" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <ProvisionalPasswordField />

          <div className="space-y-2">
            <Label>Perfis de acesso</Label>
            <div className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="role-admin"
                  checked={wantsAdmin}
                  onCheckedChange={(c) => toggleRole("admin", c === true)}
                />
                <Label htmlFor="role-admin" className="cursor-pointer font-normal">
                  Admin — equipe Tabgha (painel interno)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="role-cliente"
                  checked={wantsCliente}
                  onCheckedChange={(c) => toggleRole("cliente", c === true)}
                />
                <Label htmlFor="role-cliente" className="cursor-pointer font-normal">
                  Portal do médico — abas do cliente
                </Label>
              </div>
            </div>
            {form.formState.errors.roles && (
              <p className="text-xs text-destructive">{form.formState.errors.roles.message}</p>
            )}
          </div>

          {wantsCliente && (
            <div className="space-y-1">
              <Label>Consultório vinculado</Label>
              <Select
                value={form.watch("cliente_id") ?? ""}
                onValueChange={(v) => form.setValue("cliente_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente…" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Telas liberadas</Label>
            {wantsAdmin && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Painel Admin</p>
                <PermissionPicker value={permissoes} onChange={setPermissoes} variant="admin" />
              </div>
            )}
            {wantsCliente && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Portal do médico</p>
                <PermissionPicker value={permissoes} onChange={setPermissoes} variant="cliente" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending || roles.length === 0}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar acesso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAccessDialog({
  member,
  onClose,
  onCredentials,
}: {
  member: TeamMember;
  onClose: () => void;
  onCredentials: (c: AccessCredentials) => void;
}) {
  const queryClient = useQueryClient();
  const { user, refresh } = useAuth();
  const { data: clientes = [] } = useClientesOptions();
  const [nome, setNome] = useState(member.nome ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  const [clienteId, setClienteId] = useState<string | null>(member.cliente_id);
  const [roles, setRoles] = useState<AppRole[]>(
    member.roles.length ? member.roles : ["cliente"],
  );
  const [permissoes, setPermissoes] = useState<string[]>(
    member.permissoes.length ? member.permissoes : ["*"],
  );
  const [formError, setFormError] = useState<string | null>(null);

  const wantsAdmin = roles.includes("admin");
  const wantsCliente = roles.includes("cliente");

  function toggleRole(role: AppRole, checked: boolean) {
    setRoles((prev) => {
      const next = checked ? [...new Set([...prev, role])] : prev.filter((r) => r !== role);
      if (!next.includes("cliente")) setClienteId(null);
      if (next.includes("admin") && next.includes("cliente")) setPermissoes(["*"]);
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: () => {
      setFormError(null);
      const nextEmail = email.trim().toLowerCase();
      if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        throw new Error("Informe um email de login válido.");
      }
      if (roles.length === 0) throw new Error("Selecione ao menos um perfil.");
      if (roles.includes("cliente") && !clienteId) {
        throw new Error("Selecione o consultório vinculado.");
      }
      if (permissoes.length === 0) throw new Error("Selecione ao menos uma permissão.");
      return updateMemberAccess({
        data: {
          id: member.id,
          nome: nome.trim() || null,
          email: nextEmail,
          cliente_id: roles.includes("cliente") ? clienteId : null,
          roles,
          permissoes,
        },
      });
    },
    onSuccess: async () => {
      const emailChanged = email.trim().toLowerCase() !== (member.email ?? "").trim().toLowerCase();
      toast.success(
        emailChanged
          ? "Email e acessos atualizados. O login passa a usar o novo email."
          : "Acessos atualizados. O usuário precisa recarregar a página (ou relogar).",
      );
      void queryClient.invalidateQueries({ queryKey: ["admin", "team"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "clientes"] });
      if (user?.id === member.id) await refresh();
      onClose();
    },
    onError: (err: Error) => {
      setFormError(err.message);
      toast.error(err.message);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetProvisionalPassword({ data: { user_id: member.id } }),
    onSuccess: (result) => {
      toast.success(`Senha redefinida para ${result.temporary_password}.`);
      onCredentials({
        email: result.email || email.trim().toLowerCase(),
        temporary_password: result.temporary_password,
        reused_existing: true,
        role: roles.join("+"),
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar acessos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              A senha não fica salva em texto — use <strong>Redefinir senha</strong> para gerar de
              novo a provisória <strong>{provisionalPassword()}</strong> e copiar.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={resetMutation.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    `Redefinir a senha de ${member.email ?? "este usuário"} para ${provisionalPassword()}?`,
                  )
                ) {
                  return;
                }
                resetMutation.mutate();
              }}
            >
              {resetMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Redefinir senha provisória
            </Button>
          </div>

          {formError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Email de login</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Perfis de acesso</Label>
            <div className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-role-admin"
                  checked={wantsAdmin}
                  onCheckedChange={(c) => toggleRole("admin", c === true)}
                />
                <Label htmlFor="edit-role-admin" className="cursor-pointer font-normal">
                  Admin — painel interno
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-role-cliente"
                  checked={wantsCliente}
                  onCheckedChange={(c) => toggleRole("cliente", c === true)}
                />
                <Label htmlFor="edit-role-cliente" className="cursor-pointer font-normal">
                  Portal do médico
                </Label>
              </div>
            </div>
          </div>

          {wantsCliente && (
            <div className="space-y-1">
              <Label>Consultório vinculado</Label>
              <Select value={clienteId ?? ""} onValueChange={(v) => setClienteId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Telas liberadas</Label>
            {wantsAdmin && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Painel Admin</p>
                <PermissionPicker value={permissoes} onChange={setPermissoes} variant="admin" />
              </div>
            )}
            {wantsCliente && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Portal do médico</p>
                <PermissionPicker value={permissoes} onChange={setPermissoes} variant="cliente" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={mutation.isPending || roles.length === 0}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UsuariosPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [credentials, setCredentials] = useState<AccessCredentials | null>(null);

  const {
    data: team = [],
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["admin", "team"],
    queryFn: fetchTeam,
    staleTime: 15_000,
  });

  const admins = team.filter((m) => m.roles.includes("admin"));
  const portalMembers = team.filter((m) => m.roles.includes("cliente"));
  const dual = team.filter((m) => m.roles.includes("admin") && m.roles.includes("cliente"));

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="eyebrow-pill">Configurações</span>
          <h1 className="mt-2 text-xl font-bold tracking-tight">Usuários & acessos</h1>
          <p className="mt-0.5 text-xs text-muted-foreground max-w-xl">
            Aqui ficam os <strong>logins</strong>. Um mesmo email pode ter Admin e Portal: marque os
            dois perfis e a pessoa troca de área no menu. A senha provisória só aparece na criação
            ou ao redefinir.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Adicionar membro
        </Button>
      </div>

      {!isLoading && team.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total de membros", value: team.length, color: "text-slate-700" },
            { label: "Admins", value: admins.length, color: "text-primary" },
            { label: "Portais", value: portalMembers.length, color: "text-sky-700" },
            { label: "Admin + Portal", value: dual.length, color: "text-emerald-700" },
          ].map((kpi, i) => (
            <div
              key={kpi.label}
              className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
              style={{ animationDelay: i * 75 + "ms" }}
            >
              <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
                {kpi.label}
              </p>
              <p className={`mt-1 text-3xl font-extrabold tracking-tight ${kpi.color}`}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <p className="text-sm text-destructive">Erro ao carregar: {(error as Error).message}</p>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : team.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nenhum login cadastrado"
          description="Crie o primeiro acesso (admin, portal, ou os dois)."
          action={{ label: "Adicionar membro", onClick: () => setShowAdd(true) }}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Membros {isFetching ? "· atualizando…" : ""}
            </p>
          </div>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {team.map((member, i) => (
              <div
                key={member.id}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
              >
                <span className="w-5 shrink-0 text-[10px] font-black tabular-nums text-muted-foreground/30">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Avatar>
                  <AvatarFallback className="bg-slate-100 text-xs text-slate-700">
                    {initials(member.nome, member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.nome ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  {member.roles.includes("cliente") && (
                    <p className="mt-0.5 truncate text-[11px] text-sky-700">
                      {member.cliente_nome
                        ? `Portal: ${member.cliente_nome}`
                        : "Sem consultório vinculado"}
                    </p>
                  )}
                </div>
                <div className="hidden max-w-[220px] flex-col items-end gap-1 sm:flex">
                  <span
                    className={
                      member.roles.includes("admin") && member.roles.includes("cliente")
                        ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700"
                        : member.roles.includes("admin")
                          ? "rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700"
                          : "rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700"
                    }
                  >
                    {roleLabel(member.roles)}
                  </span>
                  <Badge variant="outline" className="max-w-full truncate text-[10px] font-normal">
                    {summarizePermissions(member.permissoes, member.roles)}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setEditing(member)}
                  aria-label={`Editar ${member.email ?? ""}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <AddUserDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCredentials={setCredentials}
      />
      {editing && (
        <EditAccessDialog
          key={editing.id}
          member={editing}
          onClose={() => setEditing(null)}
          onCredentials={setCredentials}
        />
      )}
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}
