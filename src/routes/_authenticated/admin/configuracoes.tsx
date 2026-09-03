import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Database, Loader2, Settings, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClientesOptions } from "@/hooks/useClientesOptions";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  component: ConfiguracoesPage,
  head: () => ({ meta: [{ title: "Configurações · Tabgha OS" }] }),
});

function ConfiguracoesPage() {
  return (
    <div className="space-y-5 px-6 py-6">
      <div className="animate-fade-up">
        <span className="eyebrow-pill">Administração</span>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Settings className="h-6 w-6 text-slate-700" />
          Configurações
        </h1>
        <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
          Ajustes de plataforma que só o Super Admin acessa.
        </p>
      </div>

      <DadosDemo />
    </div>
  );
}

function DadosDemo() {
  const qc = useQueryClient();
  const { data: clientes = [] } = useClientesOptions();
  const [clienteId, setClienteId] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);

  const invalidarTudo = () => {
    void qc.invalidateQueries();
  };

  const popular = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("seed_demo_tabgha", { _cliente_id: clienteId });
      if (error) throw new Error(error.message);
      return data as Record<string, unknown>;
    },
    onSuccess: (data) => {
      const leads = Number(data?.leads ?? 0);
      setResultado(
        `${leads} leads, 6 conversas de WhatsApp, 5 conteúdos, 3 eventos, 30 dias de métricas e o Diagnóstico 7 Fontes.`,
      );
      toast.success("Dados de demonstração criados.");
      invalidarTudo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const limpar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("limpar_dados_demo");
      if (error) throw new Error(error.message);
      return data as Record<string, number>;
    },
    onSuccess: (data) => {
      const total = Object.values(data ?? {}).reduce((s, n) => s + Number(n ?? 0), 0);
      setResultado(`${total} registro(s) de demonstração removido(s).`);
      toast.success("Dados de demonstração removidos.");
      invalidarTudo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ocupado = popular.isPending || limpar.isPending;

  return (
    <div className="animate-fade-up overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border bg-secondary/30 px-5 py-3">
        <p className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          Dados de demonstração
        </p>
      </div>

      {/* Contexto à esquerda, ação à direita: o card ocupa a largura da página
          em vez de uma coluna estreita com metade da tela vazia. */}
      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Popula o ambiente de um cliente com uma operação completa para demonstração: 13 leads no
            funil, 6 conversas de WhatsApp (incluindo passagem para humano e nutrição rodando), 5
            conteúdos em estágios diferentes, 3 eventos no calendário, 30 dias de métricas Meta e o
            Diagnóstico 7 Fontes preenchido.
          </p>

          <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-amber-900">
              Todo registro criado leva o prefixo <strong>[Demo]</strong> e a marca{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px]">is_demo</code>. Popular
              de novo apaga a demonstração anterior antes de recriar. Nada que não esteja marcado é
              tocado.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o cliente que recebe a demonstração" />
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

          {resultado ? (
            <p className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              {resultado}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              className="gap-2"
              disabled={!clienteId || ocupado}
              onClick={() => popular.mutate()}
            >
              {popular.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Popular dados demo
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50"
                  disabled={ocupado}
                >
                  {limpar.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Remover todos os registros marcados como demo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover os dados de demonstração?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Apaga todos os registros com is_demo = true, em qualquer cliente: leads,
                    conversas, mensagens, conteúdos, eventos, métricas, contratos, faturas e o
                    diagnóstico de demonstração. Registros reais não são tocados. Não dá para
                    desfazer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => limpar.mutate()}>Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
