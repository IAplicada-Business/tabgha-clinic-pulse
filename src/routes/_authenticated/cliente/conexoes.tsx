import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";
import { WhatsappConnectCard } from "@/components/whatsapp/WhatsappConnectCard";

export const Route = createFileRoute("/_authenticated/cliente/conexoes")({
  component: ConexoesPage,
  head: () => ({ meta: [{ title: "Conexões — Portal" }] }),
});

type RedesForm = {
  instagram: string;
  facebook: string;
  doctoralia: string;
  site: string;
  linkedin: string;
  tiktok: string;
  google_review: string;
};

const CAMPOS: {
  name: keyof RedesForm;
  label: string;
  placeholder: string;
  barColor: string;
}[] = [
  { name: "instagram", label: "Instagram", placeholder: "@usuario ou URL do perfil", barColor: "bg-pink-500" },
  { name: "facebook", label: "Facebook", placeholder: "URL da página", barColor: "bg-blue-500" },
  { name: "linkedin", label: "LinkedIn", placeholder: "URL do perfil", barColor: "bg-sky-500" },
  { name: "tiktok", label: "TikTok", placeholder: "@usuario", barColor: "bg-slate-700" },
  { name: "doctoralia", label: "Doctoralia", placeholder: "URL do perfil", barColor: "bg-teal-500" },
  { name: "site", label: "Site / Landing Page", placeholder: "https://…", barColor: "bg-violet-500" },
  {
    name: "google_review",
    label: "Google Avaliações",
    placeholder: "https://g.page/r/…/review",
    barColor: "bg-amber-500",
  },
];

function ConexoesPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;
  const qc = useQueryClient();

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", "conexoes", clienteId],
    enabled: !!clienteId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("dados_extras")
        .eq("id", clienteId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const extras = (cliente?.dados_extras ?? {}) as Record<string, unknown>;
  const agenteIa = (extras.agente_ia ?? {}) as Record<string, string>;
  const automacoes = (extras.automacoes ?? {}) as Record<string, unknown>;
  const zapi = (automacoes.zapi ?? {}) as Record<string, unknown>;
  const agenteAtivo = zapi.agente_ativo === true || zapi.agente_ativo === "true";
  const tom = agenteIa.tom || "acolhedor, claro e profissional";
  const nomeAgente = agenteIa.nome_agente || "assistente";

  const redes = extras.redes as Record<string, string> | undefined;

  const form = useForm<RedesForm>({
    defaultValues: {
      instagram: "",
      facebook: "",
      doctoralia: "",
      site: "",
      linkedin: "",
      tiktok: "",
      google_review: "",
    },
  });

  useEffect(() => {
    if (redes) {
      form.reset({
        instagram: redes.instagram ?? "",
        facebook: redes.facebook ?? "",
        doctoralia: redes.doctoralia ?? "",
        site: redes.site ?? "",
        linkedin: redes.linkedin ?? "",
        tiktok: redes.tiktok ?? "",
        google_review: redes.google_review ?? "",
      });
    }
  }, [redes, form]);

  const save = useMutation({
    mutationFn: async (values: RedesForm) => {
      const { error } = await supabase.rpc("atualizar_redes_cliente", {
        _redes: values,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Redes atualizadas.");
      void qc.invalidateQueries({ queryKey: ["cliente", "conexoes"] });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao salvar."),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const connected = CAMPOS.filter(({ name }) => !!form.watch(name)).length;

  return (
    <div className="space-y-8 px-6 py-6">
      <header className="animate-fade-up">
        <span className="eyebrow-pill">Configurações</span>
        <h1 className="mt-3 text-xl font-bold tracking-tight">Conexões</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Conecte o WhatsApp do consultório para o atendimento e o agente. As redes sociais ficam
          abaixo, só como referência do perfil.
        </p>
      </header>

      <section className="space-y-3 animate-fade-up">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">WhatsApp & atendimento</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Depois de online, as conversas aparecem em{" "}
            <Link to="/cliente/atendimento" className="font-medium text-sky-700 underline-offset-2 hover:underline">
              Atendimento
            </Link>
            . Se a Tabgha ligou o agente, o Pietro responde sozinho e registra insights no lead.
          </p>
        </div>

        {clienteId ? <WhatsappConnectCard clienteId={clienteId} /> : null}

        <div className="rounded-2xl border border-border bg-card px-5 py-4 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Como o agente fala neste consultório
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Status do agente</p>
              <p className="mt-0.5 font-medium">
                {agenteAtivo ? "Ligado pela Tabgha" : "Desligado (só inbox humano)"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="mt-0.5 font-medium">{nomeAgente}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tom</p>
              <p className="mt-0.5 font-medium">{tom}</p>
            </div>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            <li>Mensagens curtas (1–3 frases), sem diagnóstico médico nem preços inventados.</li>
            <li>Qualifica o lead e gera score/notas; handoff para humano quando precisar.</li>
            <li>
              Tempo por etapa e evolução do funil ficam em{" "}
              <Link
                to="/cliente/leads"
                search={{ periodo: 30, canal: "", q: "" }}
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                Leads
              </Link>
              .
            </li>
          </ul>
        </div>
      </section>

      <section className="animate-fade-up">
        <div className="mb-4">
          <h2 className="text-sm font-semibold tracking-tight">Redes do consultório</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Links de perfil (não disparam automação).{" "}
            {connected > 0 ? (
              <span className="font-medium text-emerald-700">
                {connected}/{CAMPOS.length} preenchidos
              </span>
            ) : null}
          </p>
        </div>

        <form onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {CAMPOS.map(({ name, label, placeholder, barColor }, i) => {
              const hasValue = !!form.watch(name);
              return (
                <div
                  key={name}
                  className={cn(
                    "flex flex-col rounded-2xl border bg-card px-5 pb-4 pt-5 shadow-[var(--shadow-card)]",
                    hasValue ? "border-primary/15" : "border-border",
                  )}
                  style={{ animationDelay: `${i * 75}ms` }}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    {hasValue ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Preenchido
                      </span>
                    ) : null}
                  </div>

                  <Input
                    placeholder={placeholder}
                    {...form.register(name)}
                    className="mt-auto bg-background text-sm"
                  />

                  <div
                    className={cn("mt-3 h-0.5 w-full rounded-full", hasValue ? barColor : "bg-border")}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <Button type="submit" disabled={save.isPending} className="gap-2">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar redes
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
