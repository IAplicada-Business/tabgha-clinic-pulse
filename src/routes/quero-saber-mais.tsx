import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/quero-saber-mais")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Quero saber mais — Tabgha OS · Health Growth Operating System" },
      {
        name: "description",
        content:
          "Fale com a Tabgha e descubra como atrair mais pacientes com marketing médico e IA.",
      },
    ],
  }),
  component: QueroSaberMaisPage,
});

const ESPECIALIDADES = [
  "Ortopedia",
  "Dermatologia",
  "Clínica geral",
  "OPME",
  "Cardiologia",
  "Oftalmologia",
  "Ginecologia",
  "Pediatria",
  "Neurologia",
  "Outro",
];

const EDGE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lp-submit`
    : "") ||
  (typeof process !== "undefined" && process.env?.SUPABASE_URL
    ? `${process.env.SUPABASE_URL}/functions/v1/lp-submit`
    : "");

function QueroSaberMaisPage() {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [cidade, setCidade] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const utms = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_content: null,
        utm_term: null,
      };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
      utm_term: params.get("utm_term"),
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!nome.trim() || !telefone.trim()) {
      setErro("Preencha nome e telefone.");
      return;
    }

    setLoading(true);
    setErro(null);

    try {
      const response = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          telefone: telefone.trim(),
          especialidade: especialidade || null,
          cidade: cidade.trim() || null,
          website,
          ...utms,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        if (payload.error === "rate_limited") {
          setErro("Aguarde um minuto e tente novamente.");
        } else {
          setErro("Não foi possível enviar. Tente novamente.");
        }
        return;
      }

      setSuccess(true);
      setNome("");
      setTelefone("");
      setEspecialidade("");
      setCidade("");
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#e0f2fe_0%,_#f8fafc_45%,_#f1f5f9_100%)]">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B1220] text-sm font-bold tracking-wide text-white">
            TB
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
            Tabgha OS · Health Growth Operating System
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Quero saber mais
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
            Marketing médico com IA. Deixe seus dados e falamos com você em até 24h.
          </p>
        </div>

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Recebemos!</h2>
            <p className="mt-2 text-sm text-slate-600">
              Falamos com você em até 24h. Enquanto isso, pode fechar esta página.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            {/* honeypot */}
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />

            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone / WhatsApp *</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Especialidade de interesse</Label>
              <Select value={especialidade} onValueChange={setEspecialidade}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ESPECIALIDADES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="São Paulo"
              />
            </div>

            {erro ? <p className="text-sm text-rose-600">{erro}</p> : null}

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-sky-600 hover:bg-sky-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                "Quero saber mais"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
