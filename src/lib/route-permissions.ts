/**
 * Mapa path → permissão exigida (bloqueio real de rota, Etapa 2 / Fase A).
 * Ordem: prefixos mais específicos primeiro.
 */
import { hasPermission } from "@/lib/permissions";
import { ADMIN_PERMISSION_GROUPS, CLIENT_PERMISSION_GROUPS } from "@/lib/permissions";

type RouteRule = {
  /** Prefixo do pathname (sem trailing slash, exceto root) */
  prefix: string;
  perm: string;
};

const ADMIN_ROUTE_RULES: RouteRule[] = [
  { prefix: "/admin/usuarios", perm: ADMIN_PERMISSION_GROUPS.usuarios },
  { prefix: "/admin/diagnosticos", perm: ADMIN_PERMISSION_GROUPS.diagnosticos },
  { prefix: "/admin/estrategia", perm: ADMIN_PERMISSION_GROUPS.estrategia },
  { prefix: "/admin/atendimento", perm: ADMIN_PERMISSION_GROUPS.atendimento },
  { prefix: "/admin/config-meta", perm: ADMIN_PERMISSION_GROUPS.meta_ads },
  { prefix: "/admin/meta-ads", perm: ADMIN_PERMISSION_GROUPS.meta_ads },
  { prefix: "/admin/roi", perm: ADMIN_PERMISSION_GROUPS.roi },
  { prefix: "/admin/pipeline-comercial", perm: ADMIN_PERMISSION_GROUPS.pipeline },
  { prefix: "/admin/automacoes-leads", perm: ADMIN_PERMISSION_GROUPS.operacao },
  { prefix: "/admin/nutricao", perm: ADMIN_PERMISSION_GROUPS.operacao },
  { prefix: "/admin/leads", perm: ADMIN_PERMISSION_GROUPS.operacao },
  { prefix: "/admin/calendario", perm: ADMIN_PERMISSION_GROUPS.operacao },
  { prefix: "/admin/clientes", perm: ADMIN_PERMISSION_GROUPS.clientes },
  { prefix: "/admin/dashboard-clientes", perm: ADMIN_PERMISSION_GROUPS.dashboard },
  { prefix: "/admin/dashboard", perm: ADMIN_PERMISSION_GROUPS.dashboard },
  // fallback genérico /admin/*
  { prefix: "/admin", perm: ADMIN_PERMISSION_GROUPS.dashboard },
];

const CLIENT_ROUTE_RULES: RouteRule[] = [
  { prefix: "/cliente/diagnostico", perm: CLIENT_PERMISSION_GROUPS.diagnostico },
  { prefix: "/cliente/conexoes", perm: CLIENT_PERMISSION_GROUPS.conexoes },
  { prefix: "/cliente/calendario", perm: CLIENT_PERMISSION_GROUPS.calendario },
  { prefix: "/cliente/entregas", perm: CLIENT_PERMISSION_GROUPS.entregas },
  { prefix: "/cliente/conteudo", perm: CLIENT_PERMISSION_GROUPS.conteudo },
  { prefix: "/cliente/clientes", perm: CLIENT_PERMISSION_GROUPS.clientes },
  { prefix: "/cliente/leads", perm: CLIENT_PERMISSION_GROUPS.leads },
  { prefix: "/cliente/atendimento", perm: CLIENT_PERMISSION_GROUPS.atendimento },
  { prefix: "/cliente/meta-ads", perm: CLIENT_PERMISSION_GROUPS.meta_ads },
  { prefix: "/cliente/roi", perm: CLIENT_PERMISSION_GROUPS.roi },
  { prefix: "/cliente/dashboard", perm: CLIENT_PERMISSION_GROUPS.dashboard },
  { prefix: "/cliente", perm: CLIENT_PERMISSION_GROUPS.dashboard },
];

function matchRule(pathname: string, rules: RouteRule[]): RouteRule | null {
  for (const rule of rules) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + "/")) {
      return rule;
    }
  }
  return null;
}

export function requiredPermissionForPath(pathname: string): string | null {
  if (pathname.startsWith("/admin")) {
    return matchRule(pathname, ADMIN_ROUTE_RULES)?.perm ?? null;
  }
  if (pathname.startsWith("/cliente")) {
    return matchRule(pathname, CLIENT_ROUTE_RULES)?.perm ?? null;
  }
  return null;
}

/** Primeira rota admin liberada pelas permissões (fallback de redirect). */
export function firstAllowedAdminPath(permissoes: string[] | null | undefined): string {
  const candidates = [
    "/admin/dashboard",
    "/admin/dashboard-clientes",
    "/admin/clientes",
    "/admin/roi",
    "/admin/meta-ads",
    "/admin/atendimento",
    "/admin/estrategia",
    "/admin/leads",
    "/admin/calendario",
    "/admin/automacoes-leads",
    "/admin/nutricao",
    "/admin/diagnosticos",
    "/admin/pipeline-comercial",
    "/admin/usuarios",
    "/admin/config-meta",
  ];
  for (const path of candidates) {
    const required = requiredPermissionForPath(path);
    if (!required || hasPermission(permissoes, required)) return path;
  }
  return "/login";
}

export function firstAllowedClientePath(permissoes: string[] | null | undefined): string {
  const candidates = [
    "/cliente/dashboard",
    "/cliente/roi",
    "/cliente/leads",
    "/cliente/atendimento",
    "/cliente/conteudo",
    "/cliente/entregas",
    "/cliente/calendario",
    "/cliente/diagnostico",
    "/cliente/clientes",
    "/cliente/conexoes",
    "/cliente/meta-ads",
  ];
  for (const path of candidates) {
    const required = requiredPermissionForPath(path);
    if (!required || hasPermission(permissoes, required)) return path;
  }
  return "/login";
}

export function canAccessPath(pathname: string, permissoes: string[] | null | undefined): boolean {
  const required = requiredPermissionForPath(pathname);
  if (!required) return true;
  return hasPermission(permissoes, required);
}
