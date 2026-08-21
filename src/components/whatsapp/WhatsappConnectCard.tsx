import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, QrCode, RefreshCw, Unplug, Wifi } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type WhatsappConnectCardProps = {
  clienteId: string;
  compact?: boolean;
};

type ConnectResponse = {
  ok: boolean;
  provisioned?: boolean;
  status?: string;
  phone?: string | null;
  qr_image?: string | null;
  message?: string;
  error?: string;
};

function normalizeQrImage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("data:") || raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  const cleaned = raw.replace(/^data:image\/\w+;base64,/, "");
  return `data:image/png;base64,${cleaned}`;
}

async function callConnect(action: "status" | "qr" | "disconnect", clienteId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");

  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  const res = await fetch(`${base}/functions/v1/whatsapp-connect`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(anon ? { apikey: anon } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, cliente_id: clienteId }),
  });

  const json = (await res.json()) as ConnectResponse;
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || json.message || "Falha na conexão WhatsApp");
  }
  return json;
}

export function WhatsappConnectCard({ clienteId, compact = false }: WhatsappConnectCardProps) {
  const qc = useQueryClient();
  const [qrImage, setQrImage] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["whatsapp-connect", clienteId],
    enabled: Boolean(clienteId),
    refetchInterval: (query) => {
      const status = (query.state.data as ConnectResponse | undefined)?.status;
      return status === "connecting" ? 8_000 : 30_000;
    },
    queryFn: () => callConnect("status", clienteId),
  });

  const qrMutation = useMutation({
    mutationFn: () => callConnect("qr", clienteId),
    onSuccess: (data) => {
      setQrImage(normalizeQrImage(data.qr_image));
      void qc.invalidateQueries({ queryKey: ["whatsapp-connect", clienteId] });
      if (!data.qr_image) {
        toast.message("QR indisponível no momento. Tente de novo em alguns segundos.");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => callConnect("disconnect", clienteId),
    onSuccess: () => {
      setQrImage(null);
      toast.success("WhatsApp desconectado.");
      void qc.invalidateQueries({ queryKey: ["whatsapp-connect", clienteId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (statusQuery.data?.status === "connected") {
      setQrImage(null);
    }
  }, [statusQuery.data?.status]);

  const status = statusQuery.data?.status ?? "disconnected";
  const provisioned = statusQuery.data?.provisioned ?? false;
  const connected = status === "connected";
  const statusTint = connected ? "green" : provisioned ? "amber" : "rose";
  const StatusIcon = connected ? Wifi : provisioned ? QrCode : Unplug;
  const badgeVariant = connected ? "success" : provisioned ? "warning" : "error";

  return (
    <div className="card-lift rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`icon-chip icon-chip-${statusTint} h-10 w-10 shrink-0`}>
            <StatusIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              WhatsApp
            </p>
            <p className="mt-1 text-sm font-medium">
              {connected
                ? `Conectado${statusQuery.data?.phone ? ` · ${statusQuery.data.phone}` : ""}`
                : provisioned
                  ? "Pronto para escanear o QR"
                  : "Falta a Tabgha salvar as credenciais Z-API"}
            </p>
            {!compact ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {connected
                  ? "Conversas novas aparecem em Atendimento. Se o agente estiver ligado, o Pietro responde sozinho."
                  : provisioned
                    ? "Escaneie com o WhatsApp do consultório (Aparelhos conectados)."
                    : "Peça à equipe Tabgha para preencher Instance ID + Token na ficha do cliente (Conexões)."}
              </p>
            ) : null}
          </div>
        </div>
        <Badge variant={badgeVariant} className="shrink-0">
          {connected ? "Online" : status}
        </Badge>
      </div>

      {!provisioned ? (
        <p className="rounded-xl border border-dashed border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
          {statusQuery.data?.message ??
            "Ainda sem credenciais Z-API neste cliente. Admin: Clientes → ficha → Conexões → Credenciais Z-API."}
        </p>
      ) : (
        <div className="space-y-3">
          {qrImage ? (
            <div className="flex justify-center rounded-xl border border-border bg-white p-3">
              <img src={qrImage} alt="QR Code WhatsApp" className="h-48 w-48 object-contain" />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {!connected ? (
              <Button
                size="sm"
                className="gap-2"
                onClick={() => qrMutation.mutate()}
                disabled={qrMutation.isPending}
              >
                {qrMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
                {qrImage ? "Atualizar QR" : "Gerar QR Code"}
              </Button>
            ) : null}

            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => void statusQuery.refetch()}
              disabled={statusQuery.isFetching}
            >
              {statusQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Atualizar status
            </Button>

            {connected ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="h-4 w-4" />
                )}
                Desconectar
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Wifi className="h-3.5 w-3.5" />
                Após escanear, o status muda para Online
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
