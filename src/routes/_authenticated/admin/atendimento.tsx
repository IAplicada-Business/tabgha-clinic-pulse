import { createFileRoute } from "@tanstack/react-router";
import { AtendimentoPage } from "@/components/atendimento/AtendimentoPage";

export const Route = createFileRoute("/_authenticated/admin/atendimento")({
  component: AdminAtendimento,
  head: () => ({ meta: [{ title: "Atendimento — Tabgha Admin" }] }),
});

function AdminAtendimento() {
  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Atendimento</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Conversas e suporte via WhatsApp em tempo real.
        </p>
      </div>
      <AtendimentoPage isAdmin />
    </div>
  );
}
