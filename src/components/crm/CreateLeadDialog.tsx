import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createLeadManual } from "@/functions/leads/createLeadManual.functions";
import type { Lead } from "@/hooks/useLeads";

type Props = {
  open: boolean;
  onClose: () => void;
  clienteId: string;
  /** Canais extras no select (admin/cliente) */
  showCanalSelect?: boolean;
  /** Chamado após criar — útil para abrir o detalhe no funil. */
  onCreated?: (lead: Lead) => void;
};

const CANAIS = [
  { value: "manual", label: "Manual" },
  { value: "indicação", label: "Indicação" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "meta", label: "Meta Ads" },
  { value: "lp", label: "Landing page" },
  { value: "site", label: "Site" },
];

export function CreateLeadDialog({
  open,
  onClose,
  clienteId,
  showCanalSelect = true,
  onCreated,
}: Props) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [canal, setCanal] = useState("manual");
  const [observacoes, setObservacoes] = useState("");

  const reset = () => {
    setNome("");
    setTelefone("");
    setEmail("");
    setCanal("manual");
    setObservacoes("");
  };

  const mutation = useMutation({
    mutationFn: () =>
      createLeadManual({
        data: {
          cliente_id: clienteId,
          nome,
          telefone,
          email,
          canal,
          observacoes,
        },
      }),
    onSuccess: (lead) => {
      toast.success("Lead criado — abrindo detalhes.");
      void queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "cliente"] });
      void queryClient.invalidateQueries({ queryKey: ["cliente", "pacientes"] });
      reset();
      onClose();
      onCreated?.(lead);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4 py-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nome.trim() || !telefone.trim()) {
              toast.error("Nome e telefone são obrigatórios.");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do lead"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="11999999999"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email (opcional)</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>
          {showCanalSelect ? (
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <select
                value={canal}
                onChange={(e) => setCanal(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              >
                {CANAIS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Observações (opcional)</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Contexto da indicação, interesse, etc."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="gap-2">
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Criar lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
