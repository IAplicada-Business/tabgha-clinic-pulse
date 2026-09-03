import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Copy, Images, Loader2, Plus, Search, Send, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { CriativoPreview, CriativoThumb } from "@/components/biblioteca/CriativoPreview";
import { ComentariosCriativo } from "@/components/biblioteca/ComentariosCriativo";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { useAuth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  BUCKET_CRIATIVOS,
  CRIATIVO_STATUS,
  FORMATOS,
  FORMATO_LABEL,
  LIMITE_DESCRICAO,
  LIMITE_LEGENDA,
  LIMITE_TITULO,
  PERIODOS,
  PILARES,
  PILAR_CLASS,
  PILAR_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  detectarFormato,
  frasesHistorico,
  lerArquivos,
  lerHistorico,
  type ArquivoCriativo,
  type Criativo,
  type CriativoStatus,
  type Formato,
  type Pilar,
} from "@/lib/biblioteca";

export const Route = createFileRoute("/_authenticated/admin/biblioteca-criativa")({
  component: BibliotecaPage,
  head: () => ({ meta: [{ title: "Biblioteca Criativa · Tabgha OS" }] }),
});

type CriativoComCliente = Criativo & { cliente_nome: string };

function BibliotecaPage() {
  const [busca, setBusca] = useState("");
  const [fCliente, setFCliente] = useState("");
  const [fPilar, setFPilar] = useState("");
  const [fFormato, setFFormato] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPeriodo, setFPeriodo] = useState("");
  const [novo, setNovo] = useState(false);
  const [detalhe, setDetalhe] = useState<CriativoComCliente | null>(null);

  const { data: clientes = [] } = useClientesOptions();
  const nomePorCliente = useMemo(() => new Map(clientes.map((c) => [c.id, c.nome])), [clientes]);

  const { data: raw = [], isLoading } = useQuery<Criativo[]>({
    queryKey: ["admin", "biblioteca"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conteudos")
        .select("*")
        .order("atualizado_em", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as Criativo[];
    },
  });

  const criativos: CriativoComCliente[] = useMemo(
    () =>
      raw.map((c) => ({
        ...c,
        cliente_nome: nomePorCliente.get(c.cliente_id) ?? "Cliente removido",
      })),
    [raw, nomePorCliente],
  );

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const limite = fPeriodo
      ? new Date(Date.now() - Number(fPeriodo) * 86_400_000).toISOString()
      : null;
    return criativos.filter((c) => {
      // Só a versão corrente aparece no grid; versões antigas ficam no detalhe.
      if (c.versao_de) return false;
      if (fCliente && c.cliente_id !== fCliente) return false;
      if (fPilar && c.pilar !== fPilar) return false;
      if (fFormato && c.formato !== fFormato) return false;
      if (fStatus && c.status !== fStatus) return false;
      if (limite && c.criado_em < limite) return false;
      if (termo) {
        const alvo = `${c.titulo ?? ""} ${(c.tags ?? []).join(" ")}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [criativos, busca, fCliente, fPilar, fFormato, fStatus, fPeriodo]);

  return (
    <div className="space-y-5 px-6 py-6">
      <div className="animate-fade-up flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow-pill">Conteúdo</span>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Images className="h-6 w-6 text-sky-700" />
            Biblioteca Criativa
          </h1>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Criativos, versões e aprovação do cliente no mesmo lugar. O cliente aprova pelo portal,
            em Conteúdo.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setNovo(true)}>
          <Plus className="h-4 w-4" />
          Novo criativo
        </Button>
      </div>

      <div className="animate-fade-up space-y-3" style={{ animationDelay: "75ms" }}>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título ou tag"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Chips
            label="Cliente"
            valor={fCliente}
            onChange={setFCliente}
            opcoes={clientes.map((c) => ({ valor: c.id, label: c.nome }))}
            comoSelect
          />
          <Chips
            label="Pilar"
            valor={fPilar}
            onChange={setFPilar}
            opcoes={PILARES.map((p) => ({ valor: p, label: PILAR_LABEL[p] }))}
          />
          <Chips
            label="Formato"
            valor={fFormato}
            onChange={setFFormato}
            opcoes={FORMATOS.map((f) => ({ valor: f, label: FORMATO_LABEL[f] }))}
          />
          <Chips
            label="Status"
            valor={fStatus}
            onChange={setFStatus}
            opcoes={CRIATIVO_STATUS.map((s) => ({ valor: s, label: STATUS_LABEL[s] }))}
          />
          <Chips
            label="Data"
            valor={fPeriodo}
            onChange={setFPeriodo}
            opcoes={PERIODOS.filter((p) => p.valor).map((p) => ({
              valor: p.valor,
              label: p.label,
            }))}
            comoSelect
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={<Images className="h-6 w-6" />}
          title={criativos.length === 0 ? "Nenhum criativo ainda" : "Nada com esses filtros"}
          description={
            criativos.length === 0
              ? "Suba o primeiro criativo e mande para aprovação do cliente."
              : "Ajuste a busca ou limpe os filtros."
          }
          action={
            criativos.length === 0
              ? { label: "Novo criativo", onClick: () => setNovo(true) }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {lista.map((c) => (
            <CardCriativo key={c.id} criativo={c} onAbrir={() => setDetalhe(c)} />
          ))}
        </div>
      )}

      {novo ? <DialogNovoCriativo onClose={() => setNovo(false)} /> : null}
      {detalhe ? (
        <DialogDetalhe
          criativo={detalhe}
          versoes={criativos.filter((c) => c.versao_de === detalhe.id)}
          onClose={() => setDetalhe(null)}
        />
      ) : null}
    </div>
  );
}

function Chips({
  label,
  valor,
  onChange,
  opcoes,
  comoSelect,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: Array<{ valor: string; label: string }>;
  comoSelect?: boolean;
}) {
  if (comoSelect) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <Select value={valor || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
          <SelectTrigger className="h-7 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All</SelectItem>
            {opcoes.map((o) => (
              <SelectItem key={o.valor} value={o.valor}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {[{ valor: "", label: "All" }, ...opcoes].map((o) => (
        <button
          key={o.valor || "all"}
          type="button"
          onClick={() => onChange(o.valor)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
            valor === o.valor
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-secondary",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CardCriativo({
  criativo,
  onAbrir,
}: {
  criativo: CriativoComCliente;
  onAbrir: () => void;
}) {
  const arquivos = lerArquivos(criativo.arquivos);
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-lift)]"
    >
      <CriativoThumb arquivo={arquivos[0]} className="aspect-video w-full" />
      <div className="space-y-2 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {criativo.titulo ?? "Sem título"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
              PILAR_CLASS[criativo.pilar as Pilar],
            )}
          >
            {PILAR_LABEL[criativo.pilar as Pilar] ?? criativo.pilar}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
              STATUS_CLASS[criativo.status as CriativoStatus],
            )}
          >
            {STATUS_LABEL[criativo.status as CriativoStatus] ?? criativo.status}
          </span>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {criativo.cliente_nome} · {new Date(criativo.criado_em).toLocaleDateString("pt-BR")} · v
          {criativo.versao}
        </p>
      </div>
    </button>
  );
}

// ── Novo criativo ───────────────────────────────────────────────────────────

async function subirArquivos(
  clienteId: string,
  conteudoId: string,
  arquivos: File[],
): Promise<ArquivoCriativo[]> {
  const salvos: ArquivoCriativo[] = [];
  for (const arquivo of arquivos) {
    const nomeSeguro = arquivo.name.replace(/[^\w.-]+/g, "_");
    const path = `${clienteId}/${conteudoId}/${Date.now()}-${nomeSeguro}`;
    const { error } = await supabase.storage
      .from(BUCKET_CRIATIVOS)
      .upload(path, arquivo, { contentType: arquivo.type, upsert: false });
    if (error) throw new Error(`Falha ao subir ${arquivo.name}: ${error.message}`);
    salvos.push({ path, tipo: arquivo.type, nome: arquivo.name });
  }
  return salvos;
}

function DialogNovoCriativo({
  base,
  onClose,
}: {
  /** Preenchido quando é uma nova versão de um criativo existente. */
  base?: CriativoComCliente;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { data: clientes = [] } = useClientesOptions();
  const inputRef = useRef<HTMLInputElement>(null);

  const [arquivos, setArquivos] = useState<File[]>([]);
  const [titulo, setTitulo] = useState(base?.titulo ?? "");
  const [descricao, setDescricao] = useState(base?.roteiro ?? "");
  const [clienteId, setClienteId] = useState(base?.cliente_id ?? "");
  const [pilar, setPilar] = useState<string>(base?.pilar ?? "autoridade");
  const [dataSugerida, setDataSugerida] = useState(base?.data_sugerida ?? "");
  const [legenda, setLegenda] = useState(base?.legenda ?? "");
  const [tags, setTags] = useState((base?.tags ?? []).join(", "));
  const [arrastando, setArrastando] = useState(false);

  const formato: Formato = arquivos.length
    ? detectarFormato(arquivos)
    : ((base?.formato as Formato) ?? "texto");

  const salvar = useMutation({
    mutationFn: async (enviarAprovacao: boolean) => {
      const status = enviarAprovacao ? "pendente_aprovacao" : "rascunho";
      const quem = profile?.nome ?? profile?.email ?? "equipe";
      const agora = new Date().toISOString();
      const historico = [
        { evento: base ? "nova_versao" : "criado", por: quem, em: agora },
        ...(enviarAprovacao ? [{ evento: "enviado_aprovacao", por: quem, em: agora }] : []),
      ];

      const { data: criado, error } = await supabase
        .from("conteudos")
        .insert({
          cliente_id: clienteId,
          titulo: titulo.trim(),
          roteiro: descricao.trim() || null,
          legenda: legenda.trim() || null,
          pilar,
          formato,
          status,
          data_sugerida: dataSugerida || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          autor_id: profile?.id ?? null,
          versao: base ? base.versao + 1 : 1,
          versao_de: base?.id ?? null,
          historico: historico as never,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      if (arquivos.length > 0) {
        const salvos = await subirArquivos(clienteId, criado.id, arquivos);
        const { error: e2 } = await supabase
          .from("conteudos")
          .update({ arquivos: salvos as never })
          .eq("id", criado.id);
        if (e2) throw new Error(e2.message);
      }

      // A versão anterior sai do grid e vira histórico.
      if (base) {
        const { error: e3 } = await supabase
          .from("conteudos")
          .update({ status: "arquivado" })
          .eq("id", base.id);
        if (e3) throw new Error(e3.message);
      }
    },
    onSuccess: (_d, enviarAprovacao) => {
      toast.success(
        enviarAprovacao ? "Criativo enviado para aprovação." : "Criativo salvo como rascunho.",
      );
      void qc.invalidateQueries({ queryKey: ["admin", "biblioteca"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const podeSalvar = Boolean(titulo.trim() && clienteId && !salvar.isPending);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{base ? `Nova versão · v${base.versao + 1}` : "Novo criativo"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              setArquivos([...e.dataTransfer.files]);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
              arrastando ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40",
            )}
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs font-medium">
              {arquivos.length
                ? `${arquivos.length} arquivo(s) · ${FORMATO_LABEL[formato]}`
                : "Arraste os arquivos ou clique para escolher"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              PNG, JPG, MP4 ou PDF · vários arquivos viram carrossel
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,application/pdf"
              className="hidden"
              onChange={(e) => setArquivos([...(e.target.files ?? [])])}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="titulo-criativo">
              Título{" "}
              <span className="text-muted-foreground">
                ({titulo.length}/{LIMITE_TITULO})
              </span>
            </Label>
            <Input
              id="titulo-criativo"
              maxLength={LIMITE_TITULO}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc-criativo">
              Descrição{" "}
              <span className="text-muted-foreground">
                ({descricao.length}/{LIMITE_DESCRICAO})
              </span>
            </Label>
            <Textarea
              id="desc-criativo"
              rows={3}
              maxLength={LIMITE_DESCRICAO}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cliente destino</Label>
              <Select value={clienteId} onValueChange={setClienteId} disabled={Boolean(base)}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pilar</Label>
              <Select value={pilar} onValueChange={setPilar}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILARES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PILAR_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Formato</Label>
              <Input value={FORMATO_LABEL[formato]} readOnly className="bg-secondary/40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data-sugerida">Data sugerida</Label>
              <Input
                id="data-sugerida"
                type="date"
                value={dataSugerida}
                onChange={(e) => setDataSugerida(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="legenda-criativo">
              Legenda proposta{" "}
              <span className="text-muted-foreground">
                ({legenda.length}/{LIMITE_LEGENDA})
              </span>
            </Label>
            <Textarea
              id="legenda-criativo"
              rows={4}
              maxLength={LIMITE_LEGENDA}
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              placeholder="Texto que o cliente vê na aprovação e usa na publicação."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags-criativo">Tags</Label>
            <Input
              id="tags-criativo"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="harmonização, antes-e-depois, reels"
            />
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="outline" disabled={!podeSalvar} onClick={() => salvar.mutate(false)}>
            Salvar como rascunho
          </Button>
          <Button disabled={!podeSalvar} onClick={() => salvar.mutate(true)} className="gap-2">
            {salvar.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar para aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Detalhe ─────────────────────────────────────────────────────────────────

function DialogDetalhe({
  criativo,
  versoes,
  onClose,
}: {
  criativo: CriativoComCliente;
  versoes: CriativoComCliente[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const { data: clientes = [] } = useClientesOptions();
  const [novaVersao, setNovaVersao] = useState(false);
  const [duplicando, setDuplicando] = useState(false);
  const [destino, setDestino] = useState("");

  const arquivos = lerArquivos(criativo.arquivos);
  const historico = lerHistorico(criativo.historico);
  const invalidar = () => qc.invalidateQueries({ queryKey: ["admin", "biblioteca"] });

  const acao = useMutation({
    mutationFn: async (tipo: "enviar" | "arquivar" | "excluir" | "duplicar") => {
      if (tipo === "excluir") {
        for (const a of arquivos) {
          await supabase.storage.from(BUCKET_CRIATIVOS).remove([a.path]);
        }
        const { error } = await supabase.from("conteudos").delete().eq("id", criativo.id);
        if (error) throw new Error(error.message);
        return;
      }
      if (tipo === "duplicar") {
        const { error } = await supabase.from("conteudos").insert({
          cliente_id: destino,
          titulo: criativo.titulo,
          roteiro: criativo.roteiro,
          legenda: criativo.legenda,
          pilar: criativo.pilar,
          formato: criativo.formato,
          status: "rascunho",
          tags: criativo.tags,
          data_sugerida: criativo.data_sugerida,
          arquivos: criativo.arquivos,
          historico: [
            { evento: "duplicado", em: new Date().toISOString(), texto: criativo.cliente_nome },
          ] as never,
        });
        if (error) throw new Error(error.message);
        return;
      }
      const status = tipo === "enviar" ? "pendente_aprovacao" : "arquivado";
      const { error } = await supabase
        .from("conteudos")
        .update({
          status,
          historico: [
            ...historico,
            {
              evento: tipo === "enviar" ? "enviado_aprovacao" : "arquivado",
              em: new Date().toISOString(),
            },
          ] as never,
        })
        .eq("id", criativo.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, tipo) => {
      toast.success(
        tipo === "enviar"
          ? "Enviado para aprovação."
          : tipo === "arquivar"
            ? "Criativo arquivado."
            : tipo === "duplicar"
              ? "Cópia criada como rascunho."
              : "Criativo excluído.",
      );
      void invalidar();
      if (tipo !== "duplicar") onClose();
      else setDuplicando(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {criativo.titulo ?? "Sem título"}
            <span className="text-xs font-normal text-muted-foreground">v{criativo.versao}</span>
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

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            <CriativoPreview arquivos={arquivos} />

            {criativo.legenda ? (
              <div className="rounded-xl border border-border bg-secondary/20 p-4">
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
                  Legenda proposta
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed">
                  {criativo.legenda}
                </p>
              </div>
            ) : null}

            {criativo.feedback_cliente ? (
              <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-orange-800">
                  Ajuste pedido pelo cliente
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-orange-900">
                  {criativo.feedback_cliente}
                </p>
              </div>
            ) : null}

            <ComentariosCriativo conteudoId={criativo.id} lado="equipe" />
          </div>

          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
              <Meta label="Cliente" valor={criativo.cliente_nome} />
              <Meta label="Pilar" valor={PILAR_LABEL[criativo.pilar as Pilar] ?? criativo.pilar} />
              <Meta
                label="Formato"
                valor={FORMATO_LABEL[criativo.formato as Formato] ?? criativo.formato}
              />
              <Meta
                label="Data sugerida"
                valor={
                  criativo.data_sugerida
                    ? new Date(`${criativo.data_sugerida}T00:00:00`).toLocaleDateString("pt-BR")
                    : "—"
                }
              />
              <Meta
                label="Criado em"
                valor={new Date(criativo.criado_em).toLocaleDateString("pt-BR")}
              />
              {(criativo.tags ?? []).length > 0 ? (
                <div>
                  <p className="text-[10.5px] uppercase tracking-widest text-muted-foreground">
                    Tags
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(criativo.tags ?? []).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
                Histórico
              </p>
              <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {historico.length === 0 ? (
                  <li>Sem eventos registrados.</li>
                ) : (
                  historico.map((e, i) => (
                    <li key={i}>
                      {frasesHistorico(e)}
                      {e.texto ? <span className="block italic">“{e.texto}”</span> : null}
                    </li>
                  ))
                )}
              </ul>
            </div>

            {versoes.length > 0 ? (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
                  Versões anteriores
                </p>
                <ul className="mt-1.5 space-y-1 text-[11.5px] text-muted-foreground">
                  {versoes.map((v) => (
                    <li key={v.id}>
                      v{v.versao} · {new Date(v.criado_em).toLocaleDateString("pt-BR")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {duplicando ? (
              <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
                <Label>Duplicar para</Label>
                <Select value={destino} onValueChange={setDestino}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes
                      .filter((c) => c.id !== criativo.cliente_id)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!destino || acao.isPending}
                    onClick={() => acao.mutate("duplicar")}
                  >
                    Duplicar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDuplicando(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {criativo.status !== "pendente_aprovacao" && criativo.status !== "aprovado" ? (
            <Button size="sm" className="gap-1.5" onClick={() => acao.mutate("enviar")}>
              <Send className="h-3.5 w-3.5" />
              Enviar para aprovação
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setNovaVersao(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova versão
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setDuplicando(true)}
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={criativo.status === "arquivado" || acao.isPending}
            onClick={() => acao.mutate("arquivar")}
          >
            <Archive className="h-3.5 w-3.5" />
            Arquivar
          </Button>
          {isSuperAdmin(roles) ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
              disabled={acao.isPending}
              onClick={() => acao.mutate("excluir")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </Button>
          ) : null}
        </DialogFooter>

        {novaVersao ? (
          <DialogNovoCriativo base={criativo} onClose={() => setNovaVersao(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{valor}</p>
    </div>
  );
}
