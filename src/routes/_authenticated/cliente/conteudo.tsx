import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Images, Loader2, MessageSquareWarning, XCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CriativoPreview, CriativoThumb } from "@/components/biblioteca/CriativoPreview";
import { ComentariosCriativo } from "@/components/biblioteca/ComentariosCriativo";
import { cn } from "@/lib/utils";
import {
  PILARES,
  PILAR_CLASS,
  PILAR_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  frasesHistorico,
  lerArquivos,
  lerHistorico,
  type Criativo,
  type CriativoStatus,
  type Pilar,
} from "@/lib/biblioteca";

/**
 * Portal do cliente · aprovação de conteúdo.
 * O briefing chamava esta tela de /portal/aprovacao-conteudo; ela já existia
 * aqui, então continua no mesmo endereço em vez de virar rota duplicada.
 */
export const Route = createFileRoute("/_authenticated/cliente/conteudo")({
  component: ConteudoPage,
  head: () => ({ meta: [{ title: "Conteúdo · Tabgha OS" }] }),
});

function ConteudoPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id ?? null;
  const [fPilar, setFPilar] = useState("");
  const [aberto, setAberto] = useState<Criativo | null>(null);
  const [verTodos, setVerTodos] = useState(false);

  const { data: criativos = [], isLoading } = useQuery<Criativo[]>({
    queryKey: ["cliente", "conteudos", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conteudos")
        .select("*")
        .eq("cliente_id", clienteId!)
        .neq("status", "rascunho")
        .order("atualizado_em", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Criativo[];
    },
  });

  const pendentes = useMemo(
    () => criativos.filter((c) => c.status === "pendente_aprovacao"),
    [criativos],
  );

  const lista = useMemo(() => {
    const base = verTodos ? criativos.filter((c) => !c.versao_de) : pendentes;
    return fPilar ? base.filter((c) => c.pilar === fPilar) : base;
  }, [criativos, pendentes, verTodos, fPilar]);

  if (!clienteId) {
    return (
      <div className="px-6 py-6">
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Seu usuário ainda não está vinculado a uma clínica. Fale com a equipe Tabgha.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 px-6 py-6">
      <header className="animate-fade-up">
        <span className="eyebrow-pill">Conteúdo</span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
          {pendentes.length === 0
            ? "Nenhum criativo aguardando você"
            : `Você tem ${pendentes.length} criativo${pendentes.length === 1 ? "" : "s"} aguardando sua aprovação.`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aprove, peça ajuste ou rejeite. A equipe recebe sua resposta na hora.
        </p>
      </header>

      <div
        className="animate-fade-up flex flex-wrap items-center gap-3"
        style={{ animationDelay: "75ms" }}
      >
        <div className="segmented">
          <button
            type="button"
            data-active={!verTodos ? "true" : undefined}
            onClick={() => setVerTodos(false)}
            className="segmented-item"
          >
            Aguardando ({pendentes.length})
          </button>
          <button
            type="button"
            data-active={verTodos ? "true" : undefined}
            onClick={() => setVerTodos(true)}
            className="segmented-item"
          >
            Todos
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
            Pilar
          </span>
          {[
            { valor: "", label: "Todos" },
            ...PILARES.map((p) => ({ valor: p, label: PILAR_LABEL[p] })),
          ].map((o) => (
            <button
              key={o.valor || "todos"}
              type="button"
              onClick={() => setFPilar(o.valor)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                fPilar === o.valor
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" />}
          title={verTodos ? "Nenhum criativo por aqui" : "Tudo aprovado"}
          description={
            verTodos
              ? "Assim que a equipe subir um criativo, ele aparece aqui."
              : "Não há nada esperando sua resposta no momento."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {lista.map((c) => {
            const arquivos = lerArquivos(c.arquivos);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setAberto(c)}
                className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-lift)]"
              >
                <CriativoThumb arquivo={arquivos[0]} className="aspect-video w-full" />
                <div className="space-y-2 p-3">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">
                    {c.titulo ?? "Sem título"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                        PILAR_CLASS[c.pilar as Pilar],
                      )}
                    >
                      {PILAR_LABEL[c.pilar as Pilar] ?? c.pilar}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                        STATUS_CLASS[c.status as CriativoStatus],
                      )}
                    >
                      {STATUS_LABEL[c.status as CriativoStatus] ?? c.status}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {c.data_sugerida
                      ? `Publicar em ${new Date(`${c.data_sugerida}T00:00:00`).toLocaleDateString("pt-BR")}`
                      : new Date(c.criado_em).toLocaleDateString("pt-BR")}{" "}
                    · v{c.versao}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {aberto ? (
        <DialogAprovacao
          criativo={aberto}
          versoes={criativos.filter((c) => c.versao_de === aberto.id)}
          onClose={() => setAberto(null)}
        />
      ) : null}
    </div>
  );
}

type Acao = "aprovar" | "pedir_ajuste" | "rejeitar";

function DialogAprovacao({
  criativo,
  versoes,
  onClose,
}: {
  criativo: Criativo;
  versoes: Criativo[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [acao, setAcao] = useState<Acao | null>(null);
  const [texto, setTexto] = useState("");

  const arquivos = lerArquivos(criativo.arquivos);
  const historico = lerHistorico(criativo.historico);
  const pendente = criativo.status === "pendente_aprovacao";

  const responder = useMutation({
    mutationFn: async (tipo: Acao) => {
      const { error } = await supabase.rpc("responder_conteudo", {
        _id: criativo.id,
        _aprovada: tipo === "aprovar",
        _feedback: texto.trim() || undefined,
        _acao: tipo,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, tipo) => {
      toast.success(
        tipo === "aprovar"
          ? "Criativo aprovado."
          : tipo === "pedir_ajuste"
            ? "Pedido de ajuste enviado para a equipe."
            : "Criativo rejeitado.",
      );
      void qc.invalidateQueries({ queryKey: ["cliente", "conteudos"] });
      void qc.invalidateQueries({ queryKey: ["cliente", "dashboard"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {criativo.titulo ?? "Sem título"}
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                STATUS_CLASS[criativo.status as CriativoStatus],
              )}
            >
              {STATUS_LABEL[criativo.status as CriativoStatus] ?? criativo.status}
            </span>
          </DialogTitle>
        </DialogHeader>

        <CriativoPreview arquivos={arquivos} />

        {criativo.legenda ? (
          <div className="rounded-xl border border-border bg-secondary/20 p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              Legenda proposta
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed">
              {criativo.legenda}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Quer mudar alguma palavra? Use "Pedir ajuste" e escreva como prefere.
            </p>
          </div>
        ) : null}

        {criativo.data_sugerida ? (
          <p className="text-xs text-muted-foreground">
            Data sugerida de publicação:{" "}
            <strong className="text-foreground">
              {new Date(`${criativo.data_sugerida}T00:00:00`).toLocaleDateString("pt-BR")}
            </strong>
          </p>
        ) : null}

        {pendente ? (
          acao === null ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button
                className="h-12 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={responder.isPending}
                onClick={() => responder.mutate("aprovar")}
              >
                <CheckCircle2 className="h-4 w-4" />
                Aprovar
              </Button>
              <Button
                className="h-12 gap-2 bg-amber-500 text-white hover:bg-amber-600"
                onClick={() => setAcao("pedir_ajuste")}
              >
                <MessageSquareWarning className="h-4 w-4" />
                Pedir ajuste
              </Button>
              <Button
                className="h-12 gap-2 bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => setAcao("rejeitar")}
              >
                <XCircle className="h-4 w-4" />
                Rejeitar
              </Button>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-4">
              <label htmlFor="texto-acao" className="text-sm font-semibold">
                {acao === "pedir_ajuste" ? "Descreva o ajuste desejado" : "Motivo da rejeição"}
              </label>
              <Textarea
                id="texto-acao"
                rows={4}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={
                  acao === "pedir_ajuste"
                    ? "Ex.: trocar a foto de capa e encurtar a legenda."
                    : "Ex.: não faz sentido para a clínica neste momento."
                }
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!texto.trim() || responder.isPending}
                  onClick={() => responder.mutate(acao)}
                  className="gap-2"
                >
                  {responder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Enviar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setAcao(null);
                    setTexto("");
                  }}
                >
                  Voltar
                </Button>
              </div>
            </div>
          )
        ) : null}

        <ComentariosCriativo conteudoId={criativo.id} lado="cliente" />

        {historico.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              Histórico
            </p>
            <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              {historico.map((e, i) => (
                <li key={i}>
                  {frasesHistorico(e)}
                  {e.texto ? <span className="block italic">“{e.texto}”</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {versoes.length > 0 ? (
          <div className="rounded-xl border border-border bg-secondary/20 p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              Versões anteriores
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {versoes.map((v) => (
                <div key={v.id} className="w-24">
                  <CriativoThumb
                    arquivo={lerArquivos(v.arquivos)[0]}
                    className="aspect-video w-full rounded-lg"
                  />
                  <p className="mt-1 text-center text-[10.5px] text-muted-foreground">
                    v{v.versao}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!pendente ? (
          <p className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
            <Images className="h-3.5 w-3.5" />
            Este criativo não está aguardando resposta.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
