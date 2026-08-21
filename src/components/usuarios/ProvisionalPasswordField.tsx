import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { provisionalPassword } from "@/lib/provisional-password";

/** Mostra a senha provisória padrão (Tabgha{ano}) já no formulário, pronta para enviar. */
export function ProvisionalPasswordField({
  hint = "Senha provisória padrão — copie e envie junto com o email de login.",
}: {
  hint?: string;
}) {
  const password = provisionalPassword();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success("Senha copiada.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <div className="space-y-1.5 rounded-xl border border-sky-200 bg-sky-50/70 px-3.5 py-3 shadow-[var(--shadow-xs)]">
      <Label className="text-sky-950">Senha provisória</Label>
      <div className="flex items-center gap-2">
        <p className="flex-1 font-mono text-lg font-bold tracking-wide text-sky-950">{password}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={() => void copy()}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Copiar
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-sky-900/70">{hint}</p>
    </div>
  );
}
