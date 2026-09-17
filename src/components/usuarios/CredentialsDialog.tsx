import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AccessCredentials = {
  email: string;
  temporary_password: string;
  reused_existing?: boolean;
  role?: string;
};

type Props = {
  credentials: AccessCredentials | null;
  onClose: () => void;
};

export function CredentialsDialog({ credentials, onClose }: Props) {
  const [copied, setCopied] = useState<"email" | "password" | "all" | null>(null);

  async function copy(text: string, kind: "email" | "password" | "all") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success("Copiado.");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  if (!credentials) return null;

  const bloco = `Email: ${credentials.email}\nSenha temporária: ${credentials.temporary_password}\nLogin: https://tabgha-clinic-pulse.lovable.app/login`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {credentials.reused_existing ? "Senha redefinida" : "Acesso criado"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Envie estes dados ao usuário. Senha provisória padrão:{" "}
            <strong className="text-foreground">{credentials.temporary_password}</strong>.
          </p>

          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Email
                </p>
                <p className="truncate text-sm font-medium">{credentials.email}</p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => void copy(credentials.email, "email")}
              >
                {copied === "email" ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Senha temporária
                </p>
                <p className="font-mono text-sm font-semibold tracking-wide">
                  {credentials.temporary_password}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => void copy(credentials.temporary_password, "password")}
              >
                {copied === "password" ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => void copy(bloco, "all")}
          >
            {copied === "all" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copiar email + senha
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
