import { createFileRoute } from "@tanstack/react-router";
import { AtendimentoPage } from "@/components/atendimento/AtendimentoPage";

export const Route = createFileRoute("/_authenticated/cliente/atendimento")({
  component: ClienteAtendimento,
  head: () => ({ meta: [{ title: "Atendimento — Tabgha" }] }),
});

function ClienteAtendimento() {
  return (
    <div className="px-6 py-6 space-y-6">
      <header className="animate-fade-up">
        <h1 className="text-xl font-bold tracking-tight">Atendimento</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Conversas e suporte via WhatsApp em tempo real.
        </p>
      </header>
      <AtendimentoPage />
    </div>
  );
}
