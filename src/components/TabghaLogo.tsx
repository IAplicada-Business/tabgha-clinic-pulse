import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Logo Tabgha OS — ponto único da marca no produto.
 *
 * Arquivos esperados em /public (a troca é automática, nenhum código muda):
 *
 *   /logo.svg         logo completa para FUNDO CLARO (folha + wordmark navy +
 *                     assinatura "Health Growth Operating System")
 *   /logo-branca.svg  a mesma logo em versão para FUNDO ESCURO (sidebar navy,
 *                     lado esquerdo do login). Sem ela, o wordmark navy fica
 *                     ilegível sobre o navy — o componente então cai no
 *                     /logo.svg e, se nem esse existir, no lockup tipográfico.
 *   /logo-mark.svg    só a folha, para a sidebar colapsada
 *   /favicon.ico      Tabgha-OS-Favicon
 *   /og-tabgha.png    imagem de compartilhamento (og:image)
 *
 * A logo oficial já contém a assinatura. Telas que também escrevem
 * "Health Growth Operating System" devem usar `onFallback` para só mostrar o
 * texto próprio quando o arquivo não estiver presente — senão duplica.
 */

export const LOGO_FULL_SRC = "/logo.svg";
export const LOGO_FULL_CLARO_SRC = "/logo-branca.svg";
export const LOGO_MARK_SRC = "/logo-mark.svg";

type Tone = "claro" | "escuro";

type Props = {
  variante?: "full" | "mark";
  /** "claro" = sobre fundo escuro; "escuro" = sobre fundo branco. */
  tone?: Tone;
  /** Altura em px. O padrão 32px é o da top bar definido na marca. */
  altura?: number;
  className?: string;
  /**
   * Chamado com `true` quando nenhum arquivo oficial carregou e o lockup
   * tipográfico entrou no lugar. Use para decidir se a tela escreve a
   * assinatura por conta própria (a logo oficial já traz a dela).
   */
  onFallback?: (usandoFallback: boolean) => void;
};

/** Ordem de tentativa dos arquivos, por variante e tom. */
function candidatos(variante: "full" | "mark", tone: Tone): string[] {
  if (variante === "mark") return [LOGO_MARK_SRC];
  return tone === "claro" ? [LOGO_FULL_CLARO_SRC, LOGO_FULL_SRC] : [LOGO_FULL_SRC];
}

export function TabghaLogo({
  variante = "full",
  tone = "escuro",
  altura = 32,
  className,
  onFallback,
}: Props) {
  const fontes = candidatos(variante, tone);
  const [indice, setIndice] = useState(0);
  const semArquivo = indice >= fontes.length;

  useEffect(() => {
    onFallback?.(semArquivo);
  }, [semArquivo, onFallback]);

  if (!semArquivo) {
    return (
      <img
        src={fontes[indice]}
        alt="Tabgha OS"
        style={{ height: altura }}
        onError={() => setIndice((i) => i + 1)}
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
