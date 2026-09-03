import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Logo Tabgha OS — ponto único da marca no produto.
 *
 * Enquanto os arquivos oficiais não estiverem em /public, o componente cai no
 * lockup tipográfico. Ao soltar os arquivos abaixo em /public, a troca é
 * automática — nenhum código muda:
 *
 *   /logo.svg       logo completa (folha + wordmark)
 *   /logo-mark.svg  só a folha, para a sidebar colapsada
 *   /favicon.ico    Tabgha-OS-Favicon
 *   /og-tabgha.png  imagem de compartilhamento (og:image)
 *
 * `tone="claro"` é para fundo navy (sidebar, lado esquerdo do login);
 * `tone="escuro"` é para fundo branco (top bar, e-mails).
 */

export const LOGO_FULL_SRC = "/logo.svg";
export const LOGO_MARK_SRC = "/logo-mark.svg";

type Tone = "claro" | "escuro";

type Props = {
  variante?: "full" | "mark";
  tone?: Tone;
  /** Altura em px. O padrão 32px é o da top bar definido na marca. */
  altura?: number;
  className?: string;
};

export function TabghaLogo({ variante = "full", tone = "escuro", altura = 32, className }: Props) {
  const [falhou, setFalhou] = useState(false);
  const src = variante === "mark" ? LOGO_MARK_SRC : LOGO_FULL_SRC;

  if (!falhou) {
    return (
      <img
        src={src}
        alt="Tabgha OS"
        style={{ height: altura }}
        onError={() => setFalhou(true)}
        className={cn("w-auto", className)}
      />
    );
  }

  // Fallback tipográfico — sem inventar símbolo que não é da marca.
  if (variante === "mark") {
    return (
      <span
        style={{ height: altura, width: altura, fontSize: altura * 0.42 }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-lg font-extrabold tracking-tight",
          tone === "claro" ? "bg-white/10 text-white" : "bg-[var(--brand-navy)] text-white",
          className,
        )}
      >
        T
      </span>
    );
  }

  return (
    <span
      style={{ fontSize: altura * 0.55, lineHeight: 1 }}
      className={cn(
        "inline-flex items-baseline gap-1 font-extrabold tracking-tight",
        tone === "claro" ? "text-white" : "text-[var(--brand-navy)]",
        className,
      )}
    >
      Tabgha
      <span className={tone === "claro" ? "text-[var(--accent-orange)]" : "text-primary"}>OS</span>
    </span>
  );
}
