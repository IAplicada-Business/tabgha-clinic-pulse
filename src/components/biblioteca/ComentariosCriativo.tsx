import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Comentario } from "@/lib/biblioteca";

/**
 * Chat inline do criativo — equipe e cliente conversam no mesmo fio.
 * Usado tanto em /admin/biblioteca-criativa quanto em /cliente/conteudo.
 */
export function ComentariosCriativo({
  conteudoId,
  lado,
}: {
  conteudoId: string;
  lado: "equipe" | "cliente";
}) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [texto, setTexto] = useState("");

  const { data: comentarios = [], isLoading } = useQuery<Comentario[]>({
    queryKey: ["criativo-comentarios", conteudoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conteudo_comentarios")
        .select("*")
        .eq("conteudo_id", conteudoId)
        .order("criado_em", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Comentario[];
    },
  });

  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("conteudo_comentarios").insert({
        conteudo_id: conteudoId,
        autor_id: profile?.id ?? null,
        autor_nome: profile?.nome ?? profile?.email ?? null,
        autor_lado: lado,
        texto: texto.trim(),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setTexto("");
      void qc.invalidateQueries({ queryKey: ["criativo-comentarios", conteudoId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
        Comentários
      </p>

      <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border bg-secondary/20 p-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : comentarios.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">Nenhum comentário ainda.</p>
        ) : (
          comentarios.map((c) => (
            <div
              key={c.id}
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] shadow-[var(--shadow-xs)]",
                c.autor_lado === lado
                  ? "ml-auto rounded-br-md bg-primary/10"
                  : "mr-auto rounded-bl-md border border-border bg-card",
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {c.autor_nome ?? (c.autor_lado === "cliente" ? "Cliente" : "Equipe Tabgha")}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{c.texto}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {new Date(c.criado_em).toLocaleString("pt-BR")}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva um comentário…"
          className="resize-none text-[12.5px]"
        />
        <Button
          size="icon"
          disabled={!texto.trim() || enviar.isPending}
          onClick={() => enviar.mutate()}
          aria-label="Enviar comentário"
        >
          {enviar.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
