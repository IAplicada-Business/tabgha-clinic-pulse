import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { CreateLeadDialog } from "@/components/crm/CreateLeadDialog";
import { FunilHeader, KanbanBoard } from "@/components/crm/KanbanBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { useLeads, type Lead } from "@/hooks/useLeads";

export const Route = createFileRoute("/_authenticated/admin/leads")({
  component: AdminLeadsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    periodo: Number(search.periodo) || 30,
    canal: typeof search.canal === "string" ? search.canal : "",
    cliente: typeof search.cliente === "string" ? search.cliente : "",
    q: typeof search.q === "string" ? search.q : "",
  }),
  head: () => ({ meta: [{ title: "Funil de leads — Admin" }] }),
});

function AdminLeadsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const { data: clientes = [] } = useClientesOptions();
  const [localSearch, setLocalSearch] = useState(search.q);
  const [showCreate, setShowCreate] = useState(false);
  const [focusLead, setFocusLead] = useState<Lead | null>(null);

  // Pré-seleciona o primeiro cliente só na primeira carga (habilita "Novo lead").
  // Depois disso "Todos os clientes" (cliente = "") precisa continuar valendo.
  const autoPickedCliente = useRef(false);

  useEffect(() => {
    if (autoPickedCliente.current || clientes.length === 0) return;
    autoPickedCliente.current = true;
    if (search.cliente) return;
    void navigate({
      to: ".",
      search: (prev: typeof search) => ({ ...prev, cliente: clientes[0].id }),
      replace: true,
    });
  }, [clientes, search.cliente, navigate]);

  const filters = useMemo(
    () => ({
      clienteId: search.cliente || null,
      periodoDias: search.periodo || null,
      canal: search.canal || null,
      search: search.q || "",
    }),
    [search],
  );

  const { data: leads = [], isLoading } = useLeads(filters);

  function updateSearch(patch: Partial<typeof search>) {
    void navigate({
      to: ".",
      search: (prev: typeof search) => ({ ...prev, ...patch }),
    });
  }

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col overflow-hidden md:h-screen">
      <div className="shrink-0 border-b border-border px-6 py-5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight">Funil de pacientes</h1>
          <span className="text-sm text-muted-foreground">{leads.length} no período</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Crie leads manualmente ou acompanhe captura Meta/LP/WhatsApp.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={search.cliente}
            onChange={(e) => updateSearch({ cliente: e.target.value })}
            className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Todos os clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <select
            value={search.periodo}
            onChange={(e) => updateSearch({ periodo: Number(e.target.value) })}
            className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={365}>1 ano</option>
          </select>
          <select
            value={search.canal}
            onChange={(e) => updateSearch({ canal: e.target.value })}
            className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Todos os canais</option>
            <option value="manual">Manual</option>
            <option value="indicação">Indicação</option>
            <option value="meta">Meta</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="lp">Landing page</option>
            <option value="site">Site</option>
          </select>
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onBlur={() => updateSearch({ q: localSearch })}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateSearch({ q: localSearch });
            }}
            placeholder="Buscar nome ou telefone"
            className="max-w-xs rounded-xl"
          />
          <Button
            size="sm"
            className="gap-2"
            disabled={!search.cliente}
            onClick={() => setShowCreate(true)}
          >
            <UserPlus className="h-4 w-4" />
            Novo lead
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 && !focusLead ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Nenhum lead no filtro"
            description="Crie um lead manualmente ou ajuste período/cliente."
            action={
              search.cliente
                ? { label: "Novo lead", onClick: () => setShowCreate(true) }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4">
          <div className="shrink-0">
            <FunilHeader leads={leads} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <p className="mb-3 shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Pipeline
            </p>
            <div className="min-h-0 flex-1">
              <KanbanBoard
                leads={leads}
                isAdmin
                focusLead={focusLead}
                onFocusLeadConsumed={() => setFocusLead(null)}
              />
            </div>
          </div>
        </div>
      )}

      {search.cliente ? (
        <CreateLeadDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          clienteId={search.cliente}
          onCreated={(lead) => setFocusLead(lead)}
        />
      ) : null}
    </div>
  );
}
