import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

/** Destino do formulário da landing page depois do envio. */
export const Route = createFileRoute("/obrigado")({
  component: ObrigadoPage,
  head: () => ({
    meta: [{ title: "Solicitação recebida · Tabgha OS" }, { name: "robots", content: "noindex" }],
  }),
});

function ObrigadoPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        background: "linear-gradient(150deg, #0E2A47 0%, #2B6CB0 100%)",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          textAlign: "center",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 20,
          padding: "48px 32px",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto",
            borderRadius: 16,
            background: "rgba(243,156,18,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckCircle2 style={{ width: 28, height: 28, color: "#F39C12" }} />
        </div>

        <h1
          style={{
            marginTop: 24,
            fontSize: "clamp(24px, 3vw, 32px)",
            fontWeight: 600,
            lineHeight: 1.2,
            color: "#fff",
          }}
        >
          Recebemos sua solicitação.
        </h1>

        <p
          style={{
            marginTop: 12,
            fontSize: 16,
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          Nosso time entra em contato em até 24h para agendar seu Diagnóstico Estratégico.
        </p>

        <div
          style={{
            marginTop: 32,
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "center",
          }}
        >
          <Link
            to="/"
            style={{
              padding: "12px 22px",
              borderRadius: 8,
              background: "#fff",
              color: "#0E2A47",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Voltar para o site
          </Link>
          <Link
            to="/login"
            style={{
              padding: "12px 22px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.25)",
              color: "rgba(255,255,255,0.85)",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Já sou cliente
          </Link>
        </div>

        <p style={{ marginTop: 36, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
          © 2026 Tabgha · Health Growth Operating System
        </p>
      </div>
    </div>
  );
}
