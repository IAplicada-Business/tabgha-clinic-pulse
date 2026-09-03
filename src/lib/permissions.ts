/**
 * Permission helpers — array text[] no banco, com `*` como wildcard total.
 * Usado pelo AppLayout p/ filtrar sidebar e por guards de rota.
 */
import {
  type AppRole,
  type StaffRole,
  ROLE_LABELS,
} from "@/lib/roles";

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

/** Grupos canônicos de permissão admin (notação dot, espelhada na sidebar) */
export const ADMIN_PERMISSION_GROUPS = {
  dashboard: "admin.dashboard",
  clientes: "admin.clientes",
  estrategia: "admin.estrategia",
  operacao: "admin.operacao",
  atendimento: "admin.atendimento",
  meta_ads: "admin.meta_ads",
  roi: "admin.roi",
  usuarios: "admin.usuarios",
  diagnosticos: "admin.diagnosticos",
  /** Fase B — Pipeline B2B (rota ainda não existe; preset Growth Manager já inclui) */
  pipeline: "admin.pipeline",
} as const;

export type AdminPermissionGroup = keyof typeof ADMIN_PERMISSION_GROUPS;

/** Rótulos alinhados ao menu admin (AppLayout) */
export const ADMIN_PERMISSION_LABELS: Record<AdminPermissionGroup, string> = {
  dashboard: "Dashboard",
  roi: "ROI da operação",
  meta_ads: "Marketing Pago",
  clientes: "Clientes",
  diagnosticos: "Diagnósticos",
  atendimento: "Atendimento WhatsApp",
  estrategia: "Estratégia editorial",
  operacao: "Automações & Operação",
  usuarios: "Usuários & acessos",
  pipeline: "Pipeline comercial B2B",
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

/**
 * Presets nomeados dos 8 perfis do Blueprint.
 *
 * // PLACEHOLDER — revisar com Pietro matriz exata de telas por perfil
 * // (Blueprint lista os 8 papéis; granularidade fina ainda não validada).
 */
export const ROLE_PERMISSION_PRESETS: Record<AppRole, string[]> = {
  admin: ["*"],
  gestor_estrategico: [
    ADMIN_PERMISSION_GROUPS.dashboard,
    ADMIN_PERMISSION_GROUPS.clientes,
    ADMIN_PERMISSION_GROUPS.estrategia,
    ADMIN_PERMISSION_GROUPS.roi,
    ADMIN_PERMISSION_GROUPS.diagnosticos,
    ADMIN_PERMISSION_GROUPS.operacao,
    ADMIN_PERMISSION_GROUPS.meta_ads,
  ],
  growth_manager: [
    ADMIN_PERMISSION_GROUPS.dashboard,
    ADMIN_PERMISSION_GROUPS.clientes,
    ADMIN_PERMISSION_GROUPS.operacao,
    ADMIN_PERMISSION_GROUPS.meta_ads,
    ADMIN_PERMISSION_GROUPS.roi,
    ADMIN_PERMISSION_GROUPS.pipeline,
  ],
  social_media: [
    ADMIN_PERMISSION_GROUPS.estrategia,
    ADMIN_PERMISSION_GROUPS.operacao,
    ADMIN_PERMISSION_GROUPS.clientes,
  ],
  performance: [
    ADMIN_PERMISSION_GROUPS.dashboard,
    ADMIN_PERMISSION_GROUPS.meta_ads,
    ADMIN_PERMISSION_GROUPS.roi,
    ADMIN_PERMISSION_GROUPS.clientes,
  ],
  atendimento_cs: [
    ADMIN_PERMISSION_GROUPS.atendimento,
    ADMIN_PERMISSION_GROUPS.clientes,
    ADMIN_PERMISSION_GROUPS.diagnosticos,
    ADMIN_PERMISSION_GROUPS.operacao,
  ],
  financeiro: [
    ADMIN_PERMISSION_GROUPS.roi,
    ADMIN_PERMISSION_GROUPS.dashboard,
    ADMIN_PERMISSION_GROUPS.clientes,
  ],
  cliente: [...ALL_CLIENT_PERMS],
};

export const ROLE_PRESET_OPTIONS: Array<{
  role: AppRole;
  label: string;
  description: string;
}> = [
  {
    role: "admin",
    label: ROLE_LABELS.admin,
    description: "Acesso total ao painel interno (e gestão de usuários).",
  },
  {
    role: "gestor_estrategico",
    label: ROLE_LABELS.gestor_estrategico,
    description: "Visão ampla: clientes, estratégia, ROI e diagnósticos.",
  },
  {
    role: "growth_manager",
    label: ROLE_LABELS.growth_manager,
    description: "Aquisição B2B, funil, Meta Ads e pipeline comercial.",
  },
  {
    role: "social_media",
    label: ROLE_LABELS.social_media,
    description: "Estratégia editorial, calendário e operação de conteúdo.",
  },
  {
    role: "performance",
    label: ROLE_LABELS.performance,
    description: "Mídia paga, ROI e dashboards de performance.",
  },
  {
    role: "atendimento_cs",
    label: ROLE_LABELS.atendimento_cs,
    description: "WhatsApp, clientes e acompanhamento de diagnósticos.",
  },
  {
    role: "financeiro",
    label: ROLE_LABELS.financeiro,
    description: "ROI da operação e visão financeira por cliente.",
  },
  {
    role: "cliente",
    label: ROLE_LABELS.cliente,
    description: "Portal do médico (consultório vinculado).",
  },
];

/** Aplica preset de um perfil staff; opcionalmente une permissões do portal. */
export function permissionsForRoles(roles: AppRole[]): string[] {
  if (roles.includes("admin")) return ["*"];
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
  const includeAdmin =
    roleList.some((r) => r !== "cliente") || roleList.length === 0;
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
    (hasPermission(permissoes, "*") ||
      (permissoes ?? []).some((p) => p.startsWith("admin.")))
  ) {
    return true;
  }
  return false;
}
