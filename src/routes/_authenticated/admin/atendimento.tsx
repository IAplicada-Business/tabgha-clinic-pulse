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
        <h1 className="text-xl font-bold tracking-tight">Atendimento WhatsApp</h1>
      </div>
      <AtendimentoPage isAdmin />
    </div>
  );
}
