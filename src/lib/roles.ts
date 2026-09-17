/**
 * Os 8 perfis de acesso. O valor `super_admin` no enum app_role era `admin`
 * até a migration 20260903180000_perfis_acesso.
 */

export const STAFF_ROLES = [
  "super_admin",
  "gestor_estrategico",
  "growth_manager",
  "social_media",
  "performance",
  "atendimento_cs",
  "financeiro",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const APP_ROLES = [...STAFF_ROLES, "cliente"] as const;

export type AppRole = (typeof APP_ROLES)[number];

/** Área de UI (painel interno vs portal do médico) — distinto do perfil RBAC. */
export type ViewArea = "admin" | "cliente";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  gestor_estrategico: "Gestor Estratégico",
  growth_manager: "Growth Manager",
  social_media: "Social Media",
  performance: "Performance",
  atendimento_cs: "Atendimento/CS",
  financeiro: "Financeiro",
  cliente: "Cliente",
};

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

export function isStaff(roles: readonly string[] | null | undefined): boolean {
  return (roles ?? []).some((r) => isStaffRole(r));
}

export function isSuperAdmin(roles: readonly string[] | null | undefined): boolean {
  return (roles ?? []).includes("super_admin");
}

export function primaryStaffRole(roles: readonly AppRole[]): StaffRole | null {
  for (const r of STAFF_ROLES) {
    if (roles.includes(r)) return r;
  }
  return null;
}

export function formatRolesLabel(roles: readonly AppRole[]): string {
  if (roles.length === 0) return "Sem perfil";
  const staff = primaryStaffRole(roles as AppRole[]);
  const hasCliente = roles.includes("cliente");
  if (staff && hasCliente) return `${ROLE_LABELS[staff]} + Portal`;
  if (staff) return ROLE_LABELS[staff];
  if (hasCliente) return ROLE_LABELS.cliente;
  return roles.map((r) => ROLE_LABELS[r] ?? r).join(", ");
}
