import { type ReactNode, Suspense, lazy, useState, useEffect, useRef } from "react";
const AssistantBubble = lazy(() =>
  import("./AssistantBubble").then((m) => ({ default: m.AssistantBubble })),
);
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { canSeeNavPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Calendar,
  Zap,
  TrendingUp,
  UserCog,
  Stethoscope,
  FileText,
  UserCheck,
  Link2,
  LogOut,
  MessageSquare,
  Menu,
  ChevronRight,
  ChevronLeft,
  Users,
  Eye,
  X,
  ShieldCheck,
  Package,
} from "lucide-react";

type NavChild = {
  to: string;
  label: string;
  perm: string;
  search?: Record<string, string>;
};

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  perm: string;
  children?: NavChild[];
};

function navChildActive(
  child: NavChild,
  pathname: string,
  searchParams: Record<string, unknown>,
): boolean {
  if (pathname !== child.to) {
    if (child.to === "/admin/dashboard") return false;
    if (!pathname.startsWith(child.to + "/")) return false;
  }
  if (!child.search) {
    // Exact match for dashboard root; other bare links match path only.
    if (child.to === "/admin/dashboard") return pathname === "/admin/dashboard";
    return true;
  }
  return Object.entries(child.search).every(
    ([key, value]) => String(searchParams[key] ?? "") === String(value),
  );
}

type NavGroup = {
  group: string;
  items: NavItem[];
};

const ADMIN_NAV: NavGroup[] = [
  {
    group: "Visão",
    items: [
      {
        to: "/admin/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        perm: "admin.dashboard",
        children: [
          { to: "/admin/dashboard", label: "Tabgha", perm: "admin.dashboard" },
          { to: "/admin/dashboard-clientes", label: "Clientes", perm: "admin.dashboard" },
        ],
      },
      {
        to: "/admin/roi",
        label: "ROI da operação",
        icon: TrendingUp,
        perm: "admin.roi",
        children: [
          { to: "/admin/roi", label: "Operação", perm: "admin.roi", search: { tab: "operacao" } },
          {
            to: "/admin/roi",
            label: "Clientes",
            perm: "admin.roi",
            search: { tab: "clientes" },
          },
          {
            to: "/admin/roi",
            label: "Campanhas",
            perm: "admin.roi",
            search: { tab: "campanhas" },
          },
          {
            to: "/admin/roi",
            label: "Marketing pago",
            perm: "admin.meta_ads",
            search: { tab: "marketing" },
          },
        ],
      },
    ],
  },
  {
    group: "Carteira",
    items: [
      { to: "/admin/clientes", label: "Clientes", icon: Users, perm: "admin.clientes" },
      {
        to: "/admin/diagnosticos",
        label: "Diagnósticos",
        icon: Stethoscope,
        perm: "admin.diagnosticos",
      },
    ],
  },
  {
    group: "Operação diária",
    items: [
      {
        to: "/admin/atendimento",
        label: "Atendimento",
        icon: MessageSquare,
        perm: "admin.atendimento",
      },
      {
        to: "/admin/estrategia",
        label: "Estratégia editorial",
        icon: FileText,
        perm: "admin.estrategia",
      },
      { to: "/admin/calendario", label: "Calendário", icon: Calendar, perm: "admin.operacao" },
    ],
  },
  {
    group: "Aquisição",
    items: [
      {
        to: "/admin/automacoes-leads",
        label: "Automações de leads",
        icon: Zap,
        perm: "admin.operacao",
      },
      { to: "/admin/leads", label: "Funil de leads", icon: Users, perm: "admin.operacao" },
      { to: "/admin/config-meta", label: "Conectar Meta BM", icon: Link2, perm: "admin.meta_ads" },
    ],
  },
  {
    group: "Administração",
    items: [
      { to: "/admin/usuarios", label: "Usuários & acessos", icon: UserCog, perm: "admin.usuarios" },
    ],
  },
];

const CLIENTE_NAV: NavGroup[] = [
  {
    group: "Visão",
    items: [
      {
        to: "/cliente/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        perm: "cliente.dashboard",
      },
      {
        to: "/cliente/roi",
        label: "ROI",
        icon: TrendingUp,
        perm: "cliente.roi",
        children: [
          { to: "/cliente/roi", label: "Operação", perm: "cliente.roi", search: { tab: "operacao" } },
          {
            to: "/cliente/roi",
            label: "Oportunidades",
            perm: "cliente.roi",
            search: { tab: "oportunidades" },
          },
          {
            to: "/cliente/roi",
            label: "Campanhas",
            perm: "cliente.roi",
            search: { tab: "campanhas" },
          },
          {
            to: "/cliente/roi",
            label: "Marketing pago",
            perm: "cliente.meta_ads",
            search: { tab: "marketing" },
          },
        ],
      },
    ],
  },
  {
    group: "Relacionamento",
    items: [
      {
        to: "/cliente/atendimento",
        label: "Atendimento",
        icon: MessageSquare,
        perm: "cliente.atendimento",
      },
      { to: "/cliente/leads", label: "Leads", icon: Users, perm: "cliente.leads" },
      { to: "/cliente/clientes", label: "Pacientes", icon: UserCheck, perm: "cliente.clientes" },
    ],
  },
  {
    group: "Marketing",
    items: [
      { to: "/cliente/conteudo", label: "Conteúdo", icon: FileText, perm: "cliente.conteudo" },
      { to: "/cliente/entregas", label: "Entregas", icon: Package, perm: "cliente.entregas" },
      {
        to: "/cliente/calendario",
        label: "Calendário",
        icon: Calendar,
        perm: "cliente.calendario",
      },
    ],
  },
  {
    group: "Estratégia",
    items: [
      {
        to: "/cliente/diagnostico",
        label: "Diagnóstico",
        icon: Stethoscope,
        perm: "cliente.diagnostico",
      },
      { to: "/cliente/conexoes", label: "Conexões", icon: Link2, perm: "cliente.conexoes" },
    ],
  },
];

// ── Client Picker ─────────────────────────────────────────────────────────────

type ClientOption = { id: string; nome: string; especialidade: string | null };

function ClientPicker({
  collapsed,
  onSelect,
}: {
  collapsed: boolean;
  onSelect: (id: string, nome: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [clientes, setClientes] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  async function fetchClientes() {
    setLoading(true);
    const { data } = await supabase
      .from("clientes")
      .select("id, nome, especialidade")
      .in("status", ["ativo", "onboarding"])
      .order("nome");
    setClientes(data ?? []);
    setLoading(false);
  }

  function handleOpen() {
    setOpen((v) => !v);
    if (!open && clientes.length === 0) fetchClientes();
  }

  const filtered = clientes.filter((c) => c.nome.toLowerCase().includes(search.toLowerCase()));

  const trigger = (
    <button
      onClick={handleOpen}
      className={cn(
        "flex items-center gap-2 rounded-md text-[11px] font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors",
        collapsed
          ? "h-8 w-8 justify-center hover:bg-sidebar-accent"
          : "w-full px-2.5 py-2 hover:bg-sidebar-accent/60",
      )}
    >
      <Eye className="h-3.5 w-3.5 shrink-0" />
      {!collapsed && <span>Ver como cliente</span>}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            Ver como cliente
          </TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}

      {open && (
        <div
          className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-sidebar-border bg-sidebar shadow-xl z-50 overflow-hidden"
          style={{ minWidth: 200 }}
        >
          <div className="border-b border-sidebar-border px-3 py-2">
            <p className="text-[10.5px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              Simular como cliente
            </p>
          </div>
          <div className="px-2 pt-2 pb-1">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente…"
              className="w-full rounded-md bg-sidebar-accent/40 px-2.5 py-1.5 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/30 outline-none border border-sidebar-border focus:border-sidebar-primary/50"
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {loading ? (
              <p className="px-3 py-4 text-center text-[11px] text-sidebar-foreground/40">
                Carregando…
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-[11px] text-sidebar-foreground/40">
                Nenhum cliente encontrado
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelect(c.id, c.nome);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex w-full flex-col px-3 py-2 text-left hover:bg-sidebar-accent/60 transition-colors"
                >
                  <span className="text-[12px] font-medium text-sidebar-foreground">{c.nome}</span>
                  {c.especialidade && (
                    <span className="text-[10px] text-sidebar-foreground/40">
                      {c.especialidade}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sidebar Nav ───────────────────────────────────────────────────────────────

function SidebarNav({
  groups,
  pathname,
  searchParams,
  profile,
  user,
  onNavigate,
  signOut,
  navigate,
  collapsed = false,
  onToggleCollapse,
  isAdmin,
  isSimulating,
  simulatedClientNome,
  onStartSimulation,
  onStopSimulation,
  canSwitchAreas,
  activeArea,
  onSwitchArea,
}: {
  groups: NavGroup[];
  pathname: string;
  searchParams: Record<string, unknown>;
  profile: ReturnType<typeof useAuth>["profile"];
  user: ReturnType<typeof useAuth>["user"];
  onNavigate?: () => void;
  signOut: ReturnType<typeof useAuth>["signOut"];
  navigate: ReturnType<typeof useNavigate>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isAdmin: boolean;
  isSimulating: boolean;
  simulatedClientNome: string | null;
  onStartSimulation: (id: string, nome: string) => void;
  onStopSimulation: () => void;
  canSwitchAreas: boolean;
  activeArea: "admin" | "cliente" | null;
  onSwitchArea: (area: "admin" | "cliente") => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    "/admin/dashboard": true,
    "/admin/roi": true,
    "/cliente/roi": true,
  });

  function toggleGroup(group: string) {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  function isGroupOpen(key: string): boolean {
    return openGroups[key] !== false;
  }

  function isSubmenuOpen(key: string, forceOpen?: boolean): boolean {
    if (forceOpen) return true;
    return openSubmenus[key] !== false;
  }

  return (
    <TooltipProvider delayDuration={0}>
      {/* ── Logo ── */}
      <div
        className={cn(
          "flex h-12 items-center border-b border-sidebar-border shrink-0",
          collapsed ? "justify-center px-0" : "px-3.5",
        )}
      >
        {!collapsed && (
          <img
            src="https://tabghamkt.com.br/wp-content/uploads/2025/05/logo_tabgha_health_mkt_caixa_alta-04-scaled-e1747895382243.png"
            alt="Tabgha Health Marketing"
            className="h-6 w-auto brightness-0 invert"
          />
        )}
        {collapsed && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-primary/20">
            <span className="text-[11px] font-bold text-sidebar-primary">T</span>
          </div>
        )}
      </div>

      {/* ── Simulation badge (expanded sidebar only) ── */}
      {isSimulating && !collapsed && (
        <div className="mx-2 mt-2 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
          <Eye className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-[9.5px] font-semibold uppercase tracking-widest text-amber-400/70">
              Simulando
            </p>
            <p className="text-[11.5px] font-semibold text-amber-300 truncate">
              {simulatedClientNome}
            </p>
          </div>
        </div>
      )}

      {/* ── Nav groups ── */}
      <nav className="flex-1 overflow-y-auto py-2">
        {groups.map((g) => {
          const key = g.group;
          const isOpen = isGroupOpen(key);
          const hasActive = g.items.some(
            (i) =>
              pathname === i.to ||
              pathname.startsWith(i.to + "/") ||
              (i.children?.some((c) => navChildActive(c, pathname, searchParams)) ?? false),
          );
          const isAdminGroup = key === "Administração";

          return (
            <div key={key} className={cn("mb-1", collapsed ? "px-1.5" : "")}>
              {/* Group header */}
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(key)}
                  className={cn(
                    "flex w-[calc(100%-16px)] items-center justify-between mx-2 px-2.5 py-1.5 rounded-md border-0 bg-transparent cursor-pointer transition-colors",
                    "text-[9.5px] font-semibold tracking-[0.14em] uppercase",
                    hasActive
                      ? "text-sidebar-primary"
                      : isAdminGroup
                        ? "text-sidebar-foreground/50 hover:text-sidebar-foreground/70"
                        : "text-sidebar-foreground/35 hover:text-sidebar-foreground/60",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {isAdminGroup && <ShieldCheck className="h-3 w-3 opacity-60" />}
                    {key}
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 opacity-55 transition-transform duration-200",
                      isOpen && "rotate-90",
                    )}
                  />
                </button>
              )}

              {/* Group items */}
              {(isOpen || collapsed) && (
                <div className={collapsed ? "flex flex-col gap-0.5 py-0.5" : ""}>
                  {g.items.map((it) => {
                    const childActive =
                      it.children?.some((c) => navChildActive(c, pathname, searchParams)) ?? false;
                    const active =
                      pathname === it.to || pathname.startsWith(it.to + "/") || childActive;
                    const Icon = it.icon;
                    const hasChildren = Boolean(it.children?.length);
                    const submenuOpen = isSubmenuOpen(it.to, childActive);

                    if (collapsed) {
                      return (
                        <Tooltip key={it.to}>
                          <TooltipTrigger asChild>
                            <Link
                              to={it.to as any}
                              onClick={onNavigate}
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 mx-auto",
                                active
                                  ? "bg-sidebar-primary text-white shadow-[0_4px_12px_-2px_oklch(0.440_0.158_261_/_55%)]"
                                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                              )}
                            >
                              <Icon
                                className={cn("h-4 w-4", active ? "opacity-100" : "opacity-60")}
                              />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs font-medium">
                            {it.label}
                            {hasChildren ? ` · ${it.children!.map((c) => c.label).join(", ")}` : ""}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    if (hasChildren) {
                      return (
                        <div key={it.to} className="mb-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenSubmenus((prev) => ({
                                ...prev,
                                [it.to]: !isSubmenuOpen(it.to, childActive),
                              }))
                            }
                            className={cn(
                              "mx-2 mb-px flex w-[calc(100%-16px)] items-center gap-2.5 rounded-xl border-0 bg-transparent px-2.5 py-2 text-left text-[12.5px] transition-all duration-200",
                              active
                                ? "bg-sidebar-primary/90 font-semibold text-white shadow-[0_4px_12px_-2px_oklch(0.440_0.158_261_/_45%)]"
                                : "text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-3.5 w-3.5 shrink-0",
                                active ? "text-white opacity-100" : "opacity-50",
                              )}
                            />
                            <span className="flex-1">{it.label}</span>
                            <ChevronRight
                              className={cn(
                                "h-3 w-3 opacity-55 transition-transform duration-200",
                                submenuOpen && "rotate-90",
                              )}
                            />
                          </button>
                          {submenuOpen ? (
                            <div className="mb-1 ml-4 mt-0.5 space-y-0.5 border-l-2 border-sidebar-border/50 pl-3">
                              {it.children!.map((child) => {
                                const exactActive = navChildActive(child, pathname, searchParams);
                                const childKey = child.search
                                  ? `${child.to}?${new URLSearchParams(child.search).toString()}`
                                  : child.to;
                                return (
                                  <Link
                                    key={childKey}
                                    to={child.to as any}
                                    search={(child.search ?? {}) as any}
                                    onClick={onNavigate}
                                    className={cn(
                                      "flex items-center rounded-lg px-2.5 py-1.5 text-[12px] transition-all duration-200",
                                      exactActive
                                        ? "bg-sidebar-accent font-semibold text-sidebar-primary"
                                        : "text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "mr-2 h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                                        exactActive ? "bg-sidebar-primary" : "bg-sidebar-foreground/20",
                                      )}
                                    />
                                    {child.label}
                                  </Link>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={it.to}
                        to={it.to as any}
                        onClick={onNavigate}
                        className={cn(
                          "mx-2 mb-px flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] transition-all duration-200",
                          active
                            ? "bg-sidebar-primary text-white font-semibold shadow-[0_4px_12px_-2px_oklch(0.440_0.158_261_/_45%)]"
                            : "text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            active ? "text-white opacity-100" : "opacity-50",
                          )}
                        />
                        {it.label}
                      </Link>
                    );
                  })}
                </div>
              )}

              {collapsed && <div className="mt-1 h-px bg-sidebar-border/40 mx-1" />}
            </div>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div
        className={cn(
          "border-t border-sidebar-border py-2 shrink-0 space-y-1",
          collapsed ? "flex flex-col items-center gap-0 px-0 space-y-0" : "px-2",
        )}
      >
        {/* User name */}
        {!collapsed && (
          <div className="px-2.5 pb-1 truncate text-[11px] font-medium text-sidebar-foreground/70">
            {profile?.nome ?? user?.email}
          </div>
        )}

        {/* Dual-role: trocar entre painel admin e portal do consultório */}
        {canSwitchAreas && !isSimulating && (
          <div className={cn(collapsed ? "flex flex-col items-center gap-1" : "space-y-1 px-0.5")}>
            {!collapsed && (
              <p className="px-2.5 text-[9.5px] font-semibold uppercase tracking-widest text-sidebar-foreground/35">
                Área
              </p>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSwitchArea("admin")}
                  className={cn(
                    "flex items-center gap-2 rounded-md text-[11px] font-medium transition-colors",
                    collapsed ? "h-8 w-8 justify-center" : "w-full px-2.5 py-2",
                    activeArea === "admin"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  {!collapsed && <span>Painel Admin</span>}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="text-xs">
                  Painel Admin
                </TooltipContent>
              )}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSwitchArea("cliente")}
                  className={cn(
                    "flex items-center gap-2 rounded-md text-[11px] font-medium transition-colors",
                    collapsed ? "h-8 w-8 justify-center" : "w-full px-2.5 py-2",
                    activeArea === "cliente"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <UserCheck className="h-3.5 w-3.5 shrink-0" />
                  {!collapsed && <span>Portal do médico</span>}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="text-xs">
                  Portal do médico
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        )}

        {/* Client simulation picker (admin only, not simulating) */}
        {isAdmin && !isSimulating && (
          <ClientPicker collapsed={collapsed} onSelect={onStartSimulation} />
        )}

        {/* Stop simulation (admin simulating) */}
        {isAdmin && isSimulating && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onStopSimulation}
                className={cn(
                  "flex items-center gap-2 rounded-md text-[11px] font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 transition-colors",
                  collapsed ? "h-8 w-8 justify-center" : "w-full px-2.5 py-2",
                )}
              >
                <X className="h-3.5 w-3.5 shrink-0" />
                {!collapsed && <span>Sair da simulação</span>}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" className="text-xs">
                Sair da simulação
              </TooltipContent>
            )}
          </Tooltip>
        )}

        {/* Sign out */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/login", replace: true });
              }}
              className={cn(
                "flex items-center gap-2 rounded-md text-[11px] text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors",
                collapsed ? "h-8 w-8 justify-center" : "w-full px-2.5 py-2",
              )}
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              {!collapsed && <span>Sair</span>}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="text-xs">
              Sair
            </TooltipContent>
          )}
        </Tooltip>

        {/* Toggle collapse — always last */}
        {onToggleCollapse && (
          <>
            <div className={cn("h-px bg-sidebar-border/40", collapsed ? "w-8 mx-auto" : "mx-1")} />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleCollapse}
                  className={cn(
                    "flex items-center gap-2 rounded-md text-[11px] text-sidebar-foreground/35 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors",
                    collapsed ? "h-8 w-8 justify-center" : "w-full px-2.5 py-2",
                  )}
                  aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                >
                  {collapsed ? (
                    <ChevronRight className="h-3.5 w-3.5" />
                  ) : (
                    <>
                      <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                      <span>Recolher menu</span>
                    </>
                  )}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="text-xs">
                  Expandir menu
                </TooltipContent>
              )}
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

// ── App Layout ────────────────────────────────────────────────────────────────

export function AppLayout({ children }: { children: ReactNode }) {
  const {
    profile,
    role,
    roles,
    setActiveRole,
    user,
    signOut,
    isSimulating,
    simulatedClientId,
    simulatedClientNome,
    startSimulation,
    stopSimulation,
  } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchParams = useRouterState({
    select: (s) => (s.location.search ?? {}) as Record<string, unknown>,
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isAdmin = roles.includes("admin");
  const canSwitchAreas =
    roles.includes("admin") && roles.includes("cliente") && Boolean(profile?.cliente_id);

  const allGroups = role === "admin" ? ADMIN_NAV : CLIENTE_NAV;

  const groups: NavGroup[] = allGroups
    .map((g) => ({
      ...g,
      items: g.items
        .map((item) => ({
          ...item,
          children: item.children?.filter((c) =>
            canSeeNavPermission(profile?.permissoes, c.perm, {
              simulatingAsCliente: isSimulating,
            }),
          ),
        }))
        .filter((i) =>
          canSeeNavPermission(profile?.permissoes, i.perm, {
            simulatingAsCliente: isSimulating,
          }),
        ),
    }))
    .filter((g) => g.items.length > 0);

  const navProps = {
    groups,
    pathname,
    searchParams,
    profile,
    user,
    signOut,
    navigate,
    isAdmin,
    isSimulating,
    simulatedClientId,
    simulatedClientNome,
    onStartSimulation: (id: string, nome: string) => {
      startSimulation(id, nome);
      navigate({ to: "/cliente/dashboard", replace: true });
    },
    onStopSimulation: () => {
      stopSimulation();
      navigate({ to: "/admin/dashboard", replace: true });
    },
    canSwitchAreas,
    activeArea: (isSimulating ? "cliente" : role) as "admin" | "cliente" | null,
    onSwitchArea: (area: "admin" | "cliente") => {
      setActiveRole(area);
      navigate({
        to: area === "admin" ? "/admin/dashboard" : "/cliente/dashboard",
        replace: true,
      });
    },
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* ── Desktop sidebar ── */}
      <aside
        className="relative hidden shrink-0 flex-col bg-sidebar md:flex overflow-hidden shadow-[4px_0_24px_-8px_rgba(0,0,0,0.25)]"
        style={{
          width: sidebarCollapsed ? "3.5rem" : "14rem",
          transition: "width 280ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(500px 260px at 0% 0%, oklch(0.440 0.158 261 / 22%), transparent 60%), radial-gradient(420px 240px at 100% 100%, oklch(0.770 0.160 72 / 8%), transparent 55%)",
          }}
        />
        <SidebarNav
          {...navProps}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />
      </aside>

      {/* ── Mobile: header bar + Sheet drawer ── */}
      <div className="flex flex-1 min-w-0 flex-col md:contents">
        {/* Mobile top bar */}
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4 shadow-sm md:hidden">
          <button
            aria-label="Abrir menu"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-foreground/60 hover:bg-muted transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img
            src="https://tabghamkt.com.br/wp-content/uploads/2025/05/logo_tabgha_health_mkt_caixa_alta-04-scaled-e1747895382243.png"
            alt="Tabgha Health Marketing"
            className="h-6 w-auto"
            style={{
              filter:
                "brightness(0) saturate(100%) invert(18%) sepia(56%) saturate(1200%) hue-rotate(204deg) brightness(82%) contrast(97%)",
            }}
          />
          {isSimulating && (
            <div className="ml-auto flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1">
              <Eye className="h-3 w-3 text-amber-400" />
              <span className="text-[11px] font-semibold text-amber-400 max-w-[120px] truncate">
                {simulatedClientNome}
              </span>
              <button
                onClick={() => {
                  stopSimulation();
                  navigate({ to: "/admin/dashboard", replace: true });
                }}
                className="ml-1 text-amber-400/60 hover:text-amber-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </header>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-56 p-0 flex flex-col bg-sidebar border-sidebar-border"
          >
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
            <SidebarNav {...navProps} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <main className="flex-1 min-w-0 bg-background">{children}</main>
      </div>

      {process.env.ANTHROPIC_API_KEY && (
        <Suspense fallback={null}>
          <AssistantBubble />
        </Suspense>
      )}
    </div>
  );
}
