/**
 * Permission helpers — array text[] no banco, com `*` como wildcard total.
 * Usado pelo AppLayout p/ filtrar sidebar e por guards de rota.
 */
import { type AppRole, type StaffRole, ROLE_LABELS } from "@/lib/roles";

export function hasPermission(permissoes: string[] | null | undefined, required: string): boolean {
  if (!permissoes || permissoes.length === 0) return false;
  if (permissoes.includes("*")) return true;
  if (permissoes.includes(required)) return true;
  // suporte a prefixos: "admin.*" libera "admin.clientes"
  return permissoes.some((p) => p.endsWith(".*") && required.startsWith(p.slice(0, -1)));
}

export function hasAnyPermission(
  permissoes: string[] | null | undefined,
  required: string[],
): boolean {
  return required.some((r) => hasPermission(permissoes, r));
}

/**
 * Grupos canônicos de permissão admin (notação dot, espelhada na sidebar).
 * Um grupo por linha da matriz roles_permissoes — mesma granularidade do banco.
 */
export const ADMIN_PERMISSION_GROUPS = {
  dashboard: "admin.dashboard",
  dashboard_executivo: "admin.dashboard_executivo",
  clientes: "admin.clientes",
  crm: "admin.crm",
  pipeline: "admin.pipeline",
  atendimento: "admin.atendimento",
  cerebro: "admin.cerebro",
  nutricao: "admin.nutricao",
  estrategia: "admin.estrategia",
  calendario: "admin.calendario",
  biblioteca: "admin.biblioteca",
  meta_ads: "admin.meta_ads",
  diagnosticos: "admin.diagnosticos",
  financeiro: "admin.financeiro",
  roi: "admin.roi",
  usuarios: "admin.usuarios",
} as const;

export type AdminPermissionGroup = keyof typeof ADMIN_PERMISSION_GROUPS;

/** Rótulos alinhados ao menu admin (AppLayout) */
export const ADMIN_PERMISSION_LABELS: Record<AdminPermissionGroup, string> = {
  dashboard: "Dashboard",
  dashboard_executivo: "Dashboard de clientes",
  clientes: "Carteira de clientes",
  crm: "Funil de pacientes",
  pipeline: "Pipeline comercial B2B",
  atendimento: "Atendimento WhatsApp",
  cerebro: "Cérebro Pietro",
  nutricao: "Automações & nutrição",
  estrategia: "Estratégia editorial",
  calendario: "Calendário editorial",
  biblioteca: "Biblioteca criativa",
  meta_ads: "Marketing pago",
  diagnosticos: "Diagnósticos",
  financeiro: "Financeiro",
  roi: "Resultados & ROI",
  usuarios: "Usuários & acessos",
};

/** Grupos canônicos do portal do médico */
export const CLIENT_PERMISSION_GROUPS = {
  dashboard: "cliente.dashboard",
  roi: "cliente.roi",
  meta_ads: "cliente.meta_ads",
  atendimento: "cliente.atendimento",
  leads: "cliente.leads",
  clientes: "cliente.clientes",
  conteudo: "cliente.conteudo",
  entregas: "cliente.entregas",
  calendario: "cliente.calendario",
  diagnostico: "cliente.diagnostico",
  conexoes: "cliente.conexoes",
} as const;

export type ClientPermissionGroup = keyof typeof CLIENT_PERMISSION_GROUPS;

export const CLIENT_PERMISSION_LABELS: Record<ClientPermissionGroup, string> = {
  dashboard: "Dashboard",
  roi: "ROI",
  meta_ads: "Marketing Pago",
  atendimento: "Atendimento",
  leads: "Leads",
  clientes: "Pacientes",
  conteudo: "Conteúdo",
  entregas: "Entregas",
  calendario: "Calendário",
  diagnostico: "Diagnóstico",
  conexoes: "Conexões",
};

const ALL_CLIENT_PERMS = Object.values(CLIENT_PERMISSION_GROUPS);

const A = ADMIN_PERMISSION_GROUPS;

/**
 * Matriz perfil × permissão — espelho do que a migration
 * 20260903180000_perfis_acesso gravou em public.roles_permissoes.
 * O banco é a origem (permissoes_do_perfil lê de lá ao provisionar usuário);
 * esta cópia serve ao guarda de rota e à sidebar, que precisam ser síncronos.
 */
export const ROLE_PERMISSION_PRESETS: Record<AppRole, string[]> = {
  super_admin: ["*"],
  gestor_estrategico: [
    A.dashboard,
    A.dashboard_executivo,
    A.clientes,
    A.crm,
    A.pipeline,
    A.diagnosticos,
    A.financeiro,
    A.roi,
  ],
  growth_manager: [
    A.dashboard,
    A.clientes,
    A.crm,
    A.pipeline,
    A.atendimento,
    A.cerebro,
    A.nutricao,
    A.biblioteca,
    A.calendario,
    A.roi,
  ],
  social_media: [A.clientes, A.estrategia, A.biblioteca, A.calendario, A.roi],
  performance: [A.dashboard, A.clientes, A.meta_ads, A.roi],
  atendimento_cs: [A.dashboard, A.clientes, A.crm, A.atendimento, A.diagnosticos],
  financeiro: [A.dashboard, A.clientes, A.financeiro],
  cliente: [...ALL_CLIENT_PERMS],
};

export const ROLE_PRESET_OPTIONS: Array<{
  role: AppRole;
  label: string;
  description: string;
}> = [
  {
    role: "super_admin",
    label: ROLE_LABELS.super_admin,
    description: "Acesso total ao painel interno (e gestão de usuários).",
  },
  {
    role: "gestor_estrategico",
    label: ROLE_LABELS.gestor_estrategico,
    description: "Visão ampla: clientes, funil, diagnósticos, financeiro e ROI.",
  },
  {
    role: "growth_manager",
    label: ROLE_LABELS.growth_manager,
    description: "Funil, atendimento, nutrição, conteúdo e pipeline comercial.",
  },
  {
    role: "social_media",
    label: ROLE_LABELS.social_media,
    description: "Estratégia editorial, calendário e biblioteca criativa.",
  },
  {
    role: "performance",
    label: ROLE_LABELS.performance,
    description: "Meta Ads, conexões, ROI e dashboard de performance.",
  },
  {
    role: "atendimento_cs",
    label: ROLE_LABELS.atendimento_cs,
    description: "WhatsApp, funil de pacientes e diagnósticos.",
  },
  {
    role: "financeiro",
    label: ROLE_LABELS.financeiro,
    description: "Contratos, cobranças, MRR e inadimplência.",
  },
  {
    role: "cliente",
    label: ROLE_LABELS.cliente,
    description: "Portal do médico (consultório vinculado).",
  },
];

/** Aplica preset de um perfil staff; opcionalmente une permissões do portal. */
export function permissionsForRoles(roles: AppRole[]): string[] {
  if (roles.includes("super_admin")) return ["*"];
  const set = new Set<string>();
  for (const role of roles) {
    for (const p of ROLE_PERMISSION_PRESETS[role] ?? []) set.add(p);
  }
  return [...set];
}

export function presetForStaffRole(role: StaffRole): string[] {
  return [...ROLE_PERMISSION_PRESETS[role]];
}

/** Resumo legível das permissões para listagens */
export function summarizePermissions(
  permissoes: string[] | null | undefined,
  role: string | null | string[],
): string {
  if (!permissoes || permissoes.length === 0) return "Sem permissões";
  if (permissoes.includes("*")) return "Acesso total";

  const roleList = Array.isArray(role) ? role : role ? [role] : [];
  const includeAdmin = roleList.some((r) => r !== "cliente") || roleList.length === 0;
  const includeCliente = roleList.includes("cliente") || roleList.length === 0;

  const matched: string[] = [];
  if (includeAdmin) {
    matched.push(
      ...(Object.keys(ADMIN_PERMISSION_GROUPS) as AdminPermissionGroup[])
        .filter((key) => permissoes.includes(ADMIN_PERMISSION_GROUPS[key]))
        .map((key) => ADMIN_PERMISSION_LABELS[key]),
    );
  }
  if (includeCliente) {
    matched.push(
      ...(Object.keys(CLIENT_PERMISSION_GROUPS) as ClientPermissionGroup[])
        .filter((key) => permissoes.includes(CLIENT_PERMISSION_GROUPS[key]))
        .map((key) => CLIENT_PERMISSION_LABELS[key]),
    );
  }

  if (matched.length === 0) return `${permissoes.length} permissão(ões)`;
  if (matched.length <= 2) return matched.join(", ");
  return `${matched.slice(0, 2).join(", ")} +${matched.length - 2}`;
}

/** Em simulação (admin vendo portal), libera abas cliente se o admin tem acesso amplo. */
export function canSeeNavPermission(
  permissoes: string[] | null | undefined,
  required: string,
  opts?: { simulatingAsCliente?: boolean },
): boolean {
  if (hasPermission(permissoes, required)) return true;
  if (
    opts?.simulatingAsCliente &&
    required.startsWith("cliente.") &&
    (hasPermission(permissoes, "*") || (permissoes ?? []).some((p) => p.startsWith("admin.")))
  ) {
    return true;
  }
  return false;
}
