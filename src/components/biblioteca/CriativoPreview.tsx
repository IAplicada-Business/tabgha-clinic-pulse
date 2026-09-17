import { useEffect, useState } from "react";
import { FileText, ImageOff, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { BUCKET_CRIATIVOS, type ArquivoCriativo } from "@/lib/biblioteca";

/**
 * Preview de arquivo do bucket privado `criativos`.
 * A URL assinada é resolvida sob demanda e vale 1 hora.
 */
export function useUrlAssinada(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let ativo = true;
    if (!path) {
      setUrl(null);
      return;
    }
    setCarregando(true);
    void supabase.storage
      .from(BUCKET_CRIATIVOS)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (ativo) {
          setUrl(data?.signedUrl ?? null);
          setCarregando(false);
        }
      });
    return () => {
      ativo = false;
    };
  }, [path]);

  return { url, carregando };
}

export function CriativoThumb({
  arquivo,
  className,
}: {
  arquivo: ArquivoCriativo | undefined;
  className?: string;
}) {
  const { url, carregando } = useUrlAssinada(arquivo?.path);

  if (!arquivo) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-secondary/50 text-muted-foreground",
          className,
        )}
      >
        <FileText className="h-6 w-6 opacity-40" />
      </div>
    );
  }

  if (carregando) {
    return (
      <div className={cn("flex items-center justify-center bg-secondary/50", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-secondary/50 text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="h-5 w-5 opacity-40" />
      </div>
    );
  }

  if (arquivo.tipo.startsWith("video/")) {
    return <video src={url} className={cn("object-cover", className)} muted playsInline />;
  }

  if (arquivo.tipo === "application/pdf") {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-secondary/50 text-muted-foreground",
          className,
        )}
      >
        <FileText className="h-6 w-6 opacity-50" />
      </div>
    );
  }

  return <img src={url} alt={arquivo.nome} className={cn("object-cover", className)} />;
}

/** Preview grande da tela de detalhe — imagem, player de vídeo ou carrossel. */
export function CriativoPreview({ arquivos }: { arquivos: ArquivoCriativo[] }) {
  const [indice, setIndice] = useState(0);
  const atual = arquivos[indice];
  const { url, carregando } = useUrlAssinada(atual?.path);

  if (arquivos.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl bg-secondary/40 text-sm text-muted-foreground">
        Sem arquivo — criativo de texto.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex max-h-[380px] min-h-[200px] items-center justify-center overflow-hidden rounded-xl bg-slate-900/[0.03]">
        {carregando ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : !url ? (
          <p className="text-sm text-muted-foreground">Arquivo indisponível.</p>
        ) : atual.tipo.startsWith("video/") ? (
          <video src={url} controls className="max-h-[380px] w-full" />
        ) : atual.tipo === "application/pdf" ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-2 py-12 text-sm text-primary underline-offset-2 hover:underline"
          >
            <FileText className="h-8 w-8" />
            Abrir {atual.nome}
          </a>
        ) : (
          <img src={url} alt={atual.nome} className="max-h-[380px] w-auto" />
        )}
      </div>

      {arquivos.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {arquivos.map((a, i) => (
            <button
              key={a.path}
              type="button"
              onClick={() => setIndice(i)}
              aria-label={`Ver arquivo ${i + 1}`}
              className={cn(
                "h-12 w-12 overflow-hidden rounded-lg border-2 transition-colors",
                i === indice ? "border-primary" : "border-transparent hover:border-border",
              )}
            >
              <CriativoThumb arquivo={a} className="h-full w-full" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
