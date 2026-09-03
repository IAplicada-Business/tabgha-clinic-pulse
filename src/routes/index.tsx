import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Users,
  TrendingUp,
  Zap,
  CheckCircle,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Menu,
  X,
  Star,
  Brain,
  Target,
  Rocket,
  Instagram,
  BarChart2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tabgha OS · Health Growth Operating System — Mais pacientes. Todo mês." },
      {
        name: "description",
        content:
          "A Tabgha transforma a presença digital de clínicas e consultórios em resultado previsível — com estratégia, conteúdo médico e tecnologia integrados.",
      },
      { property: "og:title", content: "Tabgha OS · Health Growth Operating System" },
      {
        property: "og:description",
        content:
          "Marketing médico com estratégia, conteúdo e tecnologia. Resultado previsível para clínicas e consultórios.",
      },
    ],
  }),
  component: Landing,
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── data ──────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Brain,
    label: "Diagnóstico & Estratégia",
    desc: "Mapeamos o posicionamento da sua clínica, o perfil do paciente ideal e definimos a estratégia de crescimento com base em dados — não em achismo.",
    items: ["Análise de concorrência local", "Persona detalhada por especialidade", "Funil de captação desenhado"],
  },
  {
    icon: Instagram,
    label: "Conteúdo Médico",
    desc: "Criamos e publicamos conteúdo técnico e humanizado que educa pacientes, gera autoridade e mantém sua agenda cheia.",
    items: ["Roteiros e artes para redes sociais", "Pipeline editorial 30 dias à frente", "Aprovação em um clique"],
  },
  {
    icon: Zap,
    label: "Tecnologia & Automação",
    desc: "Nossa plataforma centraliza leads, métricas e comunicação — e automatiza o que rouba seu tempo sem gerar resultado.",
    items: ["CRM de leads integrado", "Relatório de ROI em tempo real", "Automações de WhatsApp e Meta"],
  },
];

const STEPS = [
  {
    n: "01",
    title: "Diagnóstico gratuito",
    desc: "Analisamos sua presença digital atual, posicionamento, concorrência e oportunidades de crescimento. Sem custo, sem compromisso.",
  },
  {
    n: "02",
    title: "Estratégia personalizada",
    desc: "Montamos um plano de 90 dias específico para a sua especialidade, cidade e perfil de paciente — com metas e entregáveis claros.",
  },
  {
    n: "03",
    title: "Execução e resultado",
    desc: "Nossa equipe executa conteúdo, campanhas e automações enquanto você acompanha tudo em tempo real pelo portal.",
  },
];

const TESTIMONIALS = [
  {
    name: "Dra. Ana Claudia Mendes",
    role: "Dermatologista · São Paulo",
    stars: 5,
    text: "Em 4 meses a Tabgha triplicou meu volume de novos pacientes. A diferença é que eles chegam já sabendo quem sou — o conteúdo educa antes mesmo de marcar consulta.",
  },
  {
    name: "Dr. Rodrigo Figueiredo",
    role: "Ortopedista · Belo Horizonte",
    stars: 5,
    text: "Tentei outras agências antes. Nenhuma entendia o setor de saúde. A Tabgha não só entende como tem um portal próprio que me dá visibilidade total sobre leads e ROI.",
  },
  {
    name: "Clínica Sorrir Mais",
    role: "Odontologia · Curitiba",
    stars: 5,
    text: "Nossa agenda estava com 30% de ociosidade. Após o diagnóstico e as primeiras campanhas, fechamos 3 meses consecutivos com lista de espera.",
  },
];

const FAQS = [
  {
    q: "Para quais especialidades a Tabgha trabalha?",
    a: "Atendemos médicos e clínicas de qualquer especialidade — dermatologia, ortopedia, odontologia, psicologia, nutrição, cirurgia plástica, entre outras. Nossa metodologia se adapta ao perfil de paciente de cada área.",
  },
  {
    q: "Preciso ter CNPJ ou posso ser pessoa física?",
    a: "Atendemos tanto clínicas com CNPJ quanto profissionais autônomos com CRM/CRO ativos. Basta exercer legalmente a profissão.",
  },
  {
    q: "Quanto tempo para ver os primeiros resultados?",
    a: "Os primeiros leads costumam aparecer entre 30 e 45 dias após o início das campanhas. Resultados consistentes de agenda cheia normalmente se consolidam entre 60 e 90 dias.",
  },
  {
    q: "Como funciona o acesso ao portal?",
    a: "Cada cliente recebe um login próprio com visão do pipeline de leads, calendário editorial, métricas de ROI e canal direto com a equipe. Tudo em um lugar.",
  },
  {
    q: "A Tabgha cuida da criação de conteúdo ou só de tráfego pago?",
    a: "Fazemos os dois de forma integrada. Estratégia, produção de conteúdo orgânico, gestão de tráfego pago (Meta e Google) e automações de relacionamento — o pacote completo.",
  },
];

const SPECIALTIES = [
  "Dermatologia", "Ortopedia", "Odontologia", "Psicologia",
  "Cardiologia", "Nutrição", "Ginecologia", "Cirurgia Plástica",
];

const STATS = [
  { value: "+180", numericValue: 180, prefix: "+", label: "Clínicas atendidas", icon: Users },
  { value: "+14k", numericValue: 14, prefix: "+", suffix: "k", label: "Leads gerados", icon: Target },
  { value: "4.1x", numericValue: 4.1, prefix: "", suffix: "x", label: "ROAS médio", icon: TrendingUp },
  { value: "92%", numericValue: 92, prefix: "", suffix: "%", label: "Retenção em 6 meses", icon: Rocket },
];

// ─── CountUp hook ──────────────────────────────────────────────────────────────

function useCountUp(end: number, duration = 1500, decimals = 0) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const startTime = performance.now();
    const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setCount(parseFloat((easeOutExpo(progress) * end).toFixed(decimals)));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, end, duration, decimals]);

  return { count, ref };
}

// ─── Scroll reveal hook ────────────────────────────────────────────────────────

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

// ─── CSS (injected once) ───────────────────────────────────────────────────────

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

  @keyframes logo-scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  @keyframes fade-up {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulse-down {
    0%, 100% { transform: translateY(0); opacity: 0.6; }
    50%       { transform: translateY(6px); opacity: 1; }
  }

  .scroll-reveal {
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.55s ease, transform 0.55s ease;
  }
  .scroll-reveal.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .icon-box-arrow {
    transition: transform 200ms ease;
  }
  .cta-btn:hover .icon-box-arrow {
    transform: translate(2px, -2px);
  }

  .segment-card:hover .segment-overlay {
    background: linear-gradient(to bottom, rgba(13,27,62,0.92), rgba(13,27,62,0.3) 60%) !important;
  }
  .segment-card:hover .segment-arrow {
    transform: translate(2px, -2px);
    border-color: rgba(255,255,255,0.2) !important;
  }
`;

function GlobalStyles() {
  useEffect(() => {
    const id = "tabgha-lp-styles";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = GLOBAL_CSS;
      document.head.appendChild(style);
    }
  }, []);
  return null;
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks: [string, string][] = [
    ["#solucao", "Solução"],
    ["#resultados", "Resultados"],
    ["#depoimentos", "Depoimentos"],
    ["#faq", "FAQ"],
  ];

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: "all 0.3s",
        background: scrolled ? "rgba(13,27,62,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : undefined,
        boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.2)" : undefined,
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <img
            src="https://tabghamkt.com.br/wp-content/uploads/2025/05/logo_tabgha_health_mkt_caixa_alta-04-scaled-e1747895382243.png"
            alt="Tabgha Health Marketing"
            style={{ height: 40, width: "auto", filter: "brightness(0) invert(1)" }}
          />
        </div>

        {/* Desktop nav pill */}
        <nav
          className="hidden md:flex"
          style={{
            alignItems: "center",
            gap: 4,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 40,
            padding: "6px 8px",
          }}
        >
          {navLinks.map(([href, label]) => (
            <a
              key={href}
              href={href}
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 14,
                padding: "8px 16px",
                borderRadius: 32,
                textDecoration: "none",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex" style={{ alignItems: "center" }}>
          <Link
            to="/login"
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 13,
              textDecoration: "none",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.9)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.55)"; }}
          >
            Entrar →
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden"
          style={{ color: "#fff", background: "none", border: "none", cursor: "pointer", padding: 4 }}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden"
          style={{ background: "#0D1B3E", borderTop: "1px solid rgba(255,255,255,0.1)", padding: "16px 24px" }}
        >
          <nav style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {navLinks.map(([href, label]) => (
              <a
                key={href}
                href={href}
                style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, textDecoration: "none" }}
                onClick={() => setOpen(false)}
              >
                {label}
              </a>
            ))}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16 }}>
              <Link to="/login" style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, textDecoration: "none" }}>
                Entrar →
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

// ─── Hero product cards ────────────────────────────────────────────────────────

function ProductCard1() {
  return (
    <div style={{
      background: "rgba(255,255,255,0.96)",
      borderRadius: 16,
      padding: "20px 24px",
      boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
      width: 220,
      backdropFilter: "blur(12px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #1A5FAD, #40ADDB)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users style={{ width: 14, height: 14, color: "#fff" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#0D1B3E" }}>Novos leads</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: "#16a34a", background: "#dcfce7", borderRadius: 20, padding: "2px 8px" }}>hoje</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#0D1B3E", lineHeight: 1 }}>12</div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>↑ 3 vs. ontem</div>
    </div>
  );
}

function ProductCard2() {
  const bars = [55, 70, 45, 80, 65, 90, 75];
  return (
    <div style={{
      background: "rgba(255,255,255,0.96)",
      borderRadius: 16,
      padding: "20px 24px",
      boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
      width: 220,
      backdropFilter: "blur(12px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #1A5FAD, #40ADDB)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BarChart2 style={{ width: 14, height: 14, color: "#fff" }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#0D1B3E" }}>ROAS</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#0D1B3E", lineHeight: 1 }}>4.1x</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, marginTop: 10, height: 36 }}>
        {bars.map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              borderRadius: 3,
              background: i === bars.length - 1
                ? "linear-gradient(135deg, #1A5FAD, #40ADDB)"
                : "rgba(26,95,173,0.2)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ProductCard3() {
  return (
    <div style={{
      background: "rgba(255,255,255,0.96)",
      borderRadius: 16,
      padding: "20px 24px",
      boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
      width: 220,
      backdropFilter: "blur(12px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #60C3E8, #1A5FAD)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          color: "#fff",
        }}>
          AC
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#0D1B3E" }}>Conteúdo aprovado</div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>Dra. Ana Claudia</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#f0fdf4", borderRadius: 10 }}>
        <CheckCircle style={{ width: 16, height: 16, color: "#16a34a" }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "#16a34a" }}>3 posts aprovados</span>
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8 }}>Próxima publicação: amanhã</div>
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section
      style={{
        background: "#0D1B3E",
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        display: "flex",
        alignItems: "stretch",
      }}
    >
      {/* Left 55% */}
      <div
        style={{
          width: "55%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "120px 64px 80px",
          zIndex: 2,
        }}
        className="hero-left"
      >
        {/* subtle grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.04,
            pointerEvents: "none",
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div style={{ position: "relative" }}>
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 20,
              padding: "6px 16px",
              border: "1px solid rgba(26,95,173,0.35)",
              background: "rgba(26,95,173,0.15)",
              color: "#60C3E8",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 32,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#60C3E8",
                animation: "pulse-down 2s ease-in-out infinite",
              }}
            />
            Agência especializada em marketing médico
          </div>

          {/* H1 */}
          <h1
            style={{
              fontSize: "clamp(48px, 5.5vw, 80px)",
              fontWeight: 500,
              lineHeight: 1.0,
              letterSpacing: "-0.01em",
              color: "#fff",
              margin: 0,
            }}
          >
            Mais pacientes para{" "}
            <span
              style={{
                backgroundImage: "linear-gradient(135deg, #60C3E8, #40ADDB)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              sua clínica.
            </span>
            <br />
            Todo mês.
          </h1>

          {/* Sub-headline */}
          <p
            style={{
              fontSize: "clamp(18px, 1.5vw, 20px)",
              fontWeight: 400,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.8)",
              marginTop: 24,
              maxWidth: 480,
            }}
          >
            A Tabgha conecta estratégia, conteúdo médico e tecnologia para transformar
            sua presença digital em agenda cheia — com previsibilidade e sem achismo.
          </p>

          {/* CTAs */}
          <div style={{ marginTop: 40, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <a
              href="#contato"
              className="cta-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "linear-gradient(135deg, #1A5FAD, #40ADDB)",
                borderRadius: 8,
                padding: "14px 24px",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: "0 8px 32px rgba(26,95,173,0.35)",
              }}
            >
              Quero saber mais
              <div
                className="icon-box-arrow"
                style={{
                  width: 36,
                  height: 36,
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ArrowUpRight style={{ width: 16, height: 16 }} />
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Right 45% — diagonal gradient + floating cards */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "48%",
          height: "100%",
          background: "linear-gradient(135deg, #1A5FAD 0%, #40ADDB 100%)",
          clipPath: "polygon(8% 0, 100% 0, 100% 100%, 0% 100%)",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          padding: "120px 48px 80px 80px",
        }}
        className="hero-right"
      >
        {/* subtle overlay pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.06,
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 20, width: "100%", maxWidth: 260 }}>
          <div style={{ alignSelf: "flex-end" }}>
            <ProductCard1 />
          </div>
          <div style={{ alignSelf: "flex-start" }}>
            <ProductCard2 />
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <ProductCard3 />
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          width: "calc(55% - 64px)",
          maxWidth: 640,
        }}
        className="hero-stats"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(12px)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {STATS.map((s, i) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "20px 16px",
                borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.08)" : undefined,
              }}
            >
              <span style={{ fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{s.value}</span>
              <span style={{ marginTop: 4, fontSize: 10, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>scroll</span>
        <ChevronDown
          style={{
            width: 16,
            height: 16,
            color: "rgba(255,255,255,0.4)",
            animation: "pulse-down 1.8s ease-in-out infinite",
          }}
        />
      </div>

      {/* Inline mobile styles */}
      <style>{`
        @media (max-width: 768px) {
          .hero-left {
            width: 100% !important;
            padding: 100px 24px 60px !important;
          }
          .hero-right {
            position: relative !important;
            width: 100% !important;
            height: 50vw !important;
            clip-path: none !important;
            padding: 32px 24px !important;
          }
          .hero-stats {
            position: relative !important;
            bottom: auto !important;
            left: auto !important;
            transform: none !important;
            width: calc(100% - 48px) !important;
            margin: 0 24px 32px !important;
          }
        }
      `}</style>
    </section>
  );
}

// ─── Trust bar ────────────────────────────────────────────────────────────────

function TrustBar() {
  return (
    <section style={{ background: "#f8fafc", paddingTop: 56, paddingBottom: 56 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <span
            style={{
              background: "rgba(26,95,173,0.08)",
              border: "1px solid rgba(26,95,173,0.12)",
              borderRadius: 4,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#1A5FAD",
            }}
          >
            Especialidades que confiam na Tabgha
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {SPECIALTIES.map((s) => (
            <span
              key={s}
              style={{
                border: "1px solid #e2e8f0",
                background: "#fff",
                color: "#475569",
                borderRadius: 20,
                padding: "6px 16px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "default",
                transition: "all 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1A5FAD";
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.borderColor = "#1A5FAD";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.color = "#475569";
                e.currentTarget.style.borderColor = "#e2e8f0";
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Problem / Segmentation ───────────────────────────────────────────────────

function ProblemSection() {
  const segments = [
    {
      emoji: "📉",
      label: "Médicos & Consultórios",
      title: "Agenda com buracos todo mês",
      desc: "Sem estratégia, cada mês começa do zero. Você depende de indicação e torce para o telefone tocar.",
    },
    {
      emoji: "🌀",
      label: "Clínicas Especializadas",
      title: "Agência que não entende saúde",
      desc: "Posts genéricos, copy que viola o CFM, métricas de vaidade. Dinheiro gasto sem retorno mensurável.",
    },
    {
      emoji: "🔍",
      label: "Redes de Clínicas",
      title: "Zero visibilidade sobre o que funciona",
      desc: "Não sabe quantos leads vieram de cada canal, qual campanha converteu, nem quanto custa um paciente novo.",
    },
  ];

  return (
    <section style={{ background: "#0D1B3E", position: "relative", paddingTop: 96, paddingBottom: 96 }}>
      {/* top wave */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, transform: "translateY(-1px)" }}>
        <svg viewBox="0 0 1440 80" style={{ width: "100%", display: "block", transform: "rotate(180deg)" }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
        </svg>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ marginBottom: 56, textAlign: "center" }}>
          <span
            style={{
              background: "rgba(26,95,173,0.08)",
              border: "1px solid rgba(26,95,173,0.15)",
              borderRadius: 4,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#60C3E8",
            }}
          >
            ● O problema
          </span>
          <h2
            style={{
              fontSize: "clamp(36px, 4vw, 64px)",
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: "#fff",
              marginTop: 16,
            }}
          >
            Marketing médico sem estratégia{" "}
            <span
              style={{
                backgroundImage: "linear-gradient(135deg, #60C3E8, #40ADDB)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              custa mais
            </span>{" "}
            do que você imagina
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {segments.map((seg) => (
            <div
              key={seg.title}
              className="segment-card"
              style={{
                position: "relative",
                aspectRatio: "16/9",
                borderRadius: 16,
                overflow: "hidden",
                cursor: "pointer",
                border: "1px solid rgba(255,255,255,0.08)",
                transition: "border-color 0.25s",
                background: "linear-gradient(135deg, rgba(26,95,173,0.25), rgba(64,173,219,0.15))",
              }}
            >
              {/* overlay */}
              <div
                className="segment-overlay"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(to bottom, rgba(13,27,62,0.85), transparent 60%)",
                  transition: "background 0.25s",
                  zIndex: 1,
                }}
              />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "24px 28px", zIndex: 2 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#60C3E8",
                      }}
                    >
                      {seg.label}
                    </div>
                  </div>
                  <div
                    className="segment-arrow"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "transform 0.2s, border-color 0.2s",
                    }}
                  >
                    <ArrowUpRight style={{ width: 14, height: 14, color: "#fff" }} />
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: "#fff", margin: 0 }}>{seg.title}</h3>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 6, lineHeight: 1.5 }}>{seg.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* bottom wave */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <svg viewBox="0 0 1440 80" style={{ width: "100%", display: "block" }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
        </svg>
      </div>
    </section>
  );
}

// ─── Solution — 50/50 sticky ──────────────────────────────────────────────────

function SolutionSection() {
  return (
    <section id="solucao" style={{ background: "#f8fafc", paddingTop: 112, paddingBottom: 112 }}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 80,
          alignItems: "start",
        }}
        className="solution-grid"
      >
        {/* Left sticky */}
        <div style={{ position: "sticky", top: 88 }}>
          <span
            style={{
              background: "rgba(26,95,173,0.08)",
              border: "1px solid rgba(26,95,173,0.12)",
              borderRadius: 4,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#1A5FAD",
            }}
          >
            ● Nossa solução
          </span>
          <h2
            style={{
              fontSize: "clamp(36px, 4vw, 48px)",
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: "#0D1B3E",
              marginTop: 16,
              marginBottom: 0,
            }}
          >
            Tudo que uma clínica precisa para{" "}
            <span
              style={{
                backgroundImage: "linear-gradient(135deg, #1A5FAD, #40ADDB)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              crescer com consistência
            </span>
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "#64748b", marginTop: 20, marginBottom: 32 }}>
            Não vendemos peças isoladas. Entregamos um sistema integrado de crescimento —
            estratégia, conteúdo e tecnologia funcionando juntos.
          </p>
          <a
            href="#contato"
            className="cta-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: "linear-gradient(135deg, #1A5FAD, #40ADDB)",
              borderRadius: 8,
              padding: "14px 24px",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 4px 20px rgba(26,95,173,0.25)",
            }}
          >
            Ver a solução completa
            <div
              className="icon-box-arrow"
              style={{
                width: 36,
                height: 36,
                background: "rgba(255,255,255,0.2)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowUpRight style={{ width: 16, height: 16 }} />
            </div>
          </a>
        </div>

        {/* Right scroll */}
        <div>
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.label}
                style={{
                  borderBottom: i < FEATURES.length - 1 ? "1px solid rgba(0,0,0,0.06)" : undefined,
                  padding: "32px 0",
                  display: "flex",
                  gap: 20,
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 600, color: "#0D1B3E", margin: 0 }}>{f.label}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: "#64748b", marginTop: 6, marginBottom: 0 }}>{f.desc}</p>
                  <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {f.items.map((item) => (
                      <li key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569" }}>
                        <CheckCircle style={{ width: 14, height: 14, flexShrink: 0, color: "#1A5FAD" }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .solution-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
          .solution-grid > div:first-child {
            position: static !important;
          }
        }
      `}</style>
    </section>
  );
}

// ─── How it works — Product Demo (sticky scroll) ───────────────────────────────

function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const rect = container.getBoundingClientRect();
      const totalHeight = container.offsetHeight;
      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / (totalHeight - window.innerHeight)));
      const step = Math.min(2, Math.floor(progress * 3));
      setActiveStep(step);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  const mockups = [
    {
      label: "Diagnóstico",
      color: "linear-gradient(135deg, #1A5FAD, #0D1B3E)",
      content: (
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 12, color: "#60C3E8", fontWeight: 600, marginBottom: 16, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
            Relatório de diagnóstico
          </div>
          {["Posicionamento", "Concorrência", "Oportunidades"].map((item, i) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: i === 0 ? "#60C3E8" : i === 1 ? "#40ADDB" : "#1A5FAD" }} />
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                <div style={{ width: `${[75, 60, 88][i]}%`, height: "100%", background: "linear-gradient(90deg, #60C3E8, #40ADDB)", borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", minWidth: 30 }}>{[75, 60, 88][i]}%</span>
            </div>
          ))}
          <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(255,255,255,0.06)", borderRadius: 10, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
            Análise concluída · 12 recomendações
          </div>
        </div>
      ),
    },
    {
      label: "Estratégia",
      color: "linear-gradient(135deg, #0D1B3E, #1A5FAD)",
      content: (
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 12, color: "#60C3E8", fontWeight: 600, marginBottom: 16, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
            Plano 90 dias
          </div>
          {["Mês 1 · Fundação", "Mês 2 · Aceleração", "Mês 3 · Escala"].map((item, i) => (
            <div key={item} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: i === 0 ? "linear-gradient(135deg, #1A5FAD, #40ADDB)" : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{item}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                  {["Diagnóstico, persona, funil", "Conteúdo + tráfego pago", "Automações + ROI"][i]}
                </div>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      label: "Resultado",
      color: "linear-gradient(135deg, #40ADDB, #1A5FAD)",
      content: (
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 12, color: "#60C3E8", fontWeight: 600, marginBottom: 16, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
            Dashboard de ROI
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["ROAS", "4.1x"], ["Leads", "+127"], ["CPL", "R$ 48"], ["Conv.", "22%"]].map(([label, val]) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <section
      ref={containerRef}
      style={{
        background: "#0D1B3E",
        position: "relative",
        height: isMobile ? "auto" : "300vh",
      }}
    >
      {/* top wave */}
      <div style={{ position: isMobile ? "relative" : "absolute", top: 0, left: 0, right: 0, transform: "translateY(-1px)" }}>
        <svg viewBox="0 0 1440 80" style={{ width: "100%", display: "block", transform: "rotate(180deg)" }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
        </svg>
      </div>

      <div
        style={{
          position: isMobile ? "relative" : "sticky",
          top: 0,
          height: isMobile ? "auto" : "100vh",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "80px 24px" : "0 24px", width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <span
              style={{
                background: "rgba(26,95,173,0.08)",
                border: "1px solid rgba(26,95,173,0.15)",
                borderRadius: 4,
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "#60C3E8",
              }}
            >
              ● Como funciona
            </span>
            <h2
              style={{
                fontSize: "clamp(36px, 4vw, 64px)",
                fontWeight: 500,
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
                color: "#fff",
                marginTop: 16,
              }}
            >
              Do diagnóstico à{" "}
              <span
                style={{
                  backgroundImage: "linear-gradient(135deg, #60C3E8, #40ADDB)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                agenda cheia
              </span>
            </h2>
          </div>

          {/* Frames */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 64,
              alignItems: "center",
            }}
          >
            {/* Step pills */}
            <div style={{ display: "flex", flexDirection: isMobile ? "row" : "column", gap: 16, flexWrap: "wrap" }}>
              {STEPS.map((s, i) => (
                <div
                  key={s.n}
                  onClick={() => setActiveStep(i)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                    padding: "20px 24px",
                    borderRadius: 16,
                    border: `1px solid ${activeStep === i ? "rgba(26,95,173,0.5)" : "rgba(255,255,255,0.08)"}`,
                    background: activeStep === i ? "rgba(26,95,173,0.15)" : "rgba(255,255,255,0.03)",
                    cursor: "pointer",
                    transition: "all 0.3s",
                    flex: isMobile ? "1 1 280px" : undefined,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      border: `1px solid ${activeStep === i ? "rgba(26,95,173,0.5)" : "rgba(255,255,255,0.1)"}`,
                      background: activeStep === i ? "rgba(26,95,173,0.25)" : "rgba(255,255,255,0.05)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 700,
                      color: activeStep === i ? "#60C3E8" : "rgba(255,255,255,0.4)",
                      flexShrink: 0,
                    }}
                  >
                    {s.n}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: activeStep === i ? "#fff" : "rgba(255,255,255,0.6)", margin: 0 }}>{s.title}</h3>
                    <p style={{ fontSize: 13, lineHeight: 1.5, color: activeStep === i ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)", marginTop: 6, marginBottom: 0 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Mockup */}
            {!isMobile && (
              <div
                style={{
                  borderRadius: 20,
                  overflow: "hidden",
                  background: mockups[activeStep].color,
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
                  transition: "all 0.4s ease",
                  minHeight: 280,
                }}
              >
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
                  {[0, 1, 2].map((d) => (
                    <div key={d} style={{ width: 10, height: 10, borderRadius: "50%", background: ["#ff5f57", "#febc2e", "#28c840"][d] }} />
                  ))}
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: 8 }}>Portal Tabgha · {mockups[activeStep].label}</span>
                </div>
                {mockups[activeStep].content}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* bottom wave */}
      <div style={{ position: isMobile ? "relative" : "absolute", bottom: 0, left: 0, right: 0 }}>
        <svg viewBox="0 0 1440 80" style={{ width: "100%", display: "block" }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
        </svg>
      </div>
    </section>
  );
}

// ─── Results — CountUp ────────────────────────────────────────────────────────

function MetricCard({ stat }: { stat: typeof STATS[0] }) {
  const isDecimal = !Number.isInteger(stat.numericValue);
  const { count, ref } = useCountUp(stat.numericValue, 1500, isDecimal ? 1 : 0);
  const { ref: revealRef, visible } = useScrollReveal();
  const Icon = stat.icon;

  return (
    <div
      ref={revealRef}
      className={cn("scroll-reveal", visible && "visible")}
      style={{
        background: "linear-gradient(135deg, #1A5FAD, #40ADDB)",
        borderRadius: 16,
        padding: "28px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        boxShadow: "0 12px 40px rgba(26,95,173,0.3)",
      }}
    >
      <Icon style={{ width: 28, height: 28, color: "rgba(255,255,255,0.7)", marginBottom: 16 }} />
      <span
        ref={ref}
        style={{
          fontSize: "clamp(48px, 6vw, 80px)",
          fontWeight: 500,
          lineHeight: 1,
          color: "#fff",
          letterSpacing: "-0.02em",
        }}
      >
        {stat.prefix}{isDecimal ? count.toFixed(1) : Math.round(count)}{stat.suffix}
      </span>
      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", marginTop: 8 }}>{stat.label}</span>
    </div>
  );
}

function ResultsSection() {
  const { ref: titleRef, visible: titleVisible } = useScrollReveal();

  return (
    <section id="resultados" style={{ background: "#f8fafc", paddingTop: 112, paddingBottom: 112 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div
          ref={titleRef}
          className={cn("scroll-reveal", titleVisible && "visible")}
          style={{ textAlign: "center", marginBottom: 64 }}
        >
          <span
            style={{
              background: "rgba(26,95,173,0.08)",
              border: "1px solid rgba(26,95,173,0.12)",
              borderRadius: 4,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#1A5FAD",
            }}
          >
            ● Resultados reais
          </span>
          <h2
            style={{
              fontSize: "clamp(36px, 4vw, 64px)",
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: "#0D1B3E",
              marginTop: 16,
            }}
          >
            Números que a sua clínica{" "}
            <span
              style={{
                backgroundImage: "linear-gradient(135deg, #1A5FAD, #40ADDB)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              merece ter
            </span>
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "#64748b", marginTop: 16, maxWidth: 480, margin: "16px auto 0" }}>
            Dados reais dos nossos clientes ativos — transparência total sobre o que entregamos.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {STATS.map((s) => (
            <MetricCard key={s.label} stat={s} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials + Logo Strip ────────────────────────────────────────────────

function Testimonials() {
  const { ref: titleRef, visible: titleVisible } = useScrollReveal();

  return (
    <section id="depoimentos" style={{ background: "#0D1B3E", paddingBottom: 112, paddingTop: 80, position: "relative" }}>
      {/* top wave */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, transform: "translateY(-1px)" }}>
        <svg viewBox="0 0 1440 80" style={{ width: "100%", display: "block", transform: "rotate(180deg)" }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
        </svg>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div
          ref={titleRef}
          className={cn("scroll-reveal", titleVisible && "visible")}
          style={{ textAlign: "center", marginBottom: 48 }}
        >
          <span
            style={{
              background: "rgba(26,95,173,0.08)",
              border: "1px solid rgba(26,95,173,0.15)",
              borderRadius: 4,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#60C3E8",
            }}
          >
            ● Depoimentos
          </span>
          <h2
            style={{
              fontSize: "clamp(36px, 4vw, 64px)",
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: "#fff",
              marginTop: 16,
            }}
          >
            Quem já tem agenda cheia fala por nós
          </h2>
        </div>

        {/* Auto-scroll logo strip */}
        <div style={{ overflow: "hidden", marginBottom: 64, position: "relative" }}>
          <div
            style={{
              display: "flex",
              gap: 16,
              animation: "logo-scroll 30s linear infinite",
              width: "max-content",
            }}
          >
            {[...SPECIALTIES, ...SPECIALTIES].map((s, i) => (
              <div
                key={`${s}-${i}`}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: "20px 32px",
                  whiteSpace: "nowrap" as const,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.5)",
                  flexShrink: 0,
                }}
              >
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              style={{
                display: "flex",
                flexDirection: "column",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 20,
                padding: 32,
              }}
            >
              <div style={{ display: "flex", gap: 4 }}>
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} style={{ width: 14, height: 14, fill: "#f59e0b", color: "#f59e0b" }} />
                ))}
              </div>
              <p style={{ marginTop: 16, flex: 1, fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.7)" }}>"{t.text}"</p>
              <div style={{ marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 20 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>{t.name}</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0, marginTop: 2 }}>{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* bottom wave */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <svg viewBox="0 0 1440 80" style={{ width: "100%", display: "block" }} preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
        </svg>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" style={{ background: "#f8fafc", paddingTop: 112, paddingBottom: 112 }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span
            style={{
              background: "rgba(26,95,173,0.08)",
              border: "1px solid rgba(26,95,173,0.12)",
              borderRadius: 4,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#1A5FAD",
            }}
          >
            ● FAQ
          </span>
          <h2
            style={{
              fontSize: "clamp(36px, 4vw, 64px)",
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: "#0D1B3E",
              marginTop: 16,
            }}
          >
            Perguntas frequentes
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FAQS.map((f, i) => (
            <div
              key={i}
              style={{
                borderRadius: 16,
                border: `1px solid ${open === i ? "rgba(26,95,173,0.35)" : "#e2e8f0"}`,
                background: "#fff",
                overflow: "hidden",
                transition: "border-color 0.2s",
                boxShadow: open === i ? "0 4px 20px rgba(26,95,173,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "20px 24px",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: "#0D1B3E" }}>{f.q}</span>
                <ChevronDown
                  style={{
                    marginLeft: 16,
                    width: 16,
                    height: 16,
                    color: "#94a3b8",
                    flexShrink: 0,
                    transition: "transform 0.2s",
                    transform: open === i ? "rotate(180deg)" : undefined,
                  }}
                />
              </button>
              {open === i && (
                <div style={{ padding: "0 24px 20px" }}>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: "#64748b", margin: 0 }}>{f.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA / Quero saber mais ───────────────────────────────────────────────────

const ESPECIALIDADES = ["Ortopedia","Dermatologia","Clínica geral","OPME","Cardiologia","Oftalmologia","Ginecologia","Pediatria","Neurologia","Outro"];
const VOLUMES = [
  { value: "menos_50",   label: "Menos de 50 pacientes/mês" },
  { value: "50_150",     label: "50 – 150 pacientes/mês" },
  { value: "150_500",    label: "150 – 500 pacientes/mês" },
  { value: "mais_500",   label: "Mais de 500 pacientes/mês" },
];

function CTASection() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [volume, setVolume] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome || (!email && !telefone)) {
      setErro("Preencha o nome e pelo menos um contato (email ou telefone).");
      return;
    }
    setLoading(true);
    setErro(null);

    const params =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const edgeBase =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
      (typeof process !== "undefined" && process.env?.SUPABASE_URL) ||
      "";

    try {
      const response = await fetch(`${edgeBase}/functions/v1/lp-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          email: email || null,
          telefone: telefone || null,
          especialidade: especialidade || null,
          volume_estimado: volume || null,
          website: "",
          utm_source: params?.get("utm_source"),
          utm_medium: params?.get("utm_medium"),
          utm_campaign: params?.get("utm_campaign"),
          utm_content: params?.get("utm_content"),
          utm_term: params?.get("utm_term"),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        if (payload.error === "rate_limited") {
          setErro("Aguarde um minuto e tente novamente.");
        } else {
          setErro("Erro ao enviar. Tente novamente.");
        }
        return;
      }

      setSuccess(true);
      setNome("");
      setEmail("");
      setTelefone("");
      setEspecialidade("");
      setVolume("");
    } catch {
      setErro("Erro ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="contato" style={{ background: "#f8fafc", paddingBottom: 112 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 20,
            background: "linear-gradient(135deg, #0D1B3E 0%, #0f2040 100%)",
            padding: "80px",
            textAlign: "center",
            boxShadow: "0 24px 80px rgba(13,27,62,0.25)",
          }}
        >
          {/* blobs */}
          <div style={{ position: "absolute", top: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(26,95,173,0.15)", filter: "blur(60px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(64,173,219,0.1)", filter: "blur(60px)", pointerEvents: "none" }} />
          {/* subtle grid */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.04,
              backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "50px 50px",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative" }}>
            <span
              style={{
                display: "inline-block",
                borderRadius: 20,
                padding: "6px 16px",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "#60C3E8",
                border: "1px solid rgba(96,195,232,0.25)",
                background: "rgba(96,195,232,0.08)",
              }}
            >
              Fale com o time
            </span>

            <h2
              style={{
                fontSize: "clamp(30px, 4vw, 52px)",
                fontWeight: 500,
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
                color: "#fff",
                marginTop: 20,
              }}
            >
              Conheça a plataforma que{" "}
              <span
                style={{
                  backgroundImage: "linear-gradient(135deg, #60C3E8, #40ADDB)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                organiza seu marketing do início ao fim
              </span>
            </h2>

            <p
              style={{
                fontSize: "clamp(16px, 1.4vw, 18px)",
                fontWeight: 400,
                lineHeight: 1.5,
                color: "rgba(255,255,255,0.65)",
                marginTop: 16,
                maxWidth: 460,
                margin: "16px auto 0",
              }}
            >
              Preencha o formulário e o time da Tabgha entra em contato em até 1 dia útil.
            </p>

            {success ? (
              <div
                style={{
                  marginTop: 40,
                  padding: "24px 32px",
                  borderRadius: 12,
                  background: "rgba(96,195,232,0.12)",
                  border: "1px solid rgba(96,195,232,0.25)",
                  color: "#60C3E8",
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                ✓ Recebemos sua mensagem. O time da Tabgha vai te chamar em até 1 dia útil.
              </div>
            ) : (
            <form
              onSubmit={handleSubmit}
              style={{
                marginTop: 40,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxWidth: 420,
                margin: "40px auto 0",
              }}
            >
              <input
                type="text"
                required
                placeholder="Seu nome *"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={{ borderRadius: 8, padding: "13px 18px", fontSize: 14, color: "#fff", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", outline: "none", width: "100%" }}
              />
              <input
                type="tel"
                placeholder="Telefone / WhatsApp"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                style={{ borderRadius: 8, padding: "13px 18px", fontSize: 14, color: "#fff", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", outline: "none", width: "100%" }}
              />
              <input
                type="email"
                placeholder="Email (opcional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ borderRadius: 8, padding: "13px 18px", fontSize: 14, color: "#fff", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", outline: "none", width: "100%" }}
              />
              <select
                value={especialidade}
                onChange={(e) => setEspecialidade(e.target.value)}
                style={{ borderRadius: 8, padding: "13px 18px", fontSize: 14, color: especialidade ? "#fff" : "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", outline: "none", width: "100%" }}
              >
                <option value="" style={{ background: "#0D1B3E" }}>Especialidade</option>
                {ESPECIALIDADES.map((e) => <option key={e} value={e} style={{ background: "#0D1B3E" }}>{e}</option>)}
              </select>
              <select
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                style={{ borderRadius: 8, padding: "13px 18px", fontSize: 14, color: volume ? "#fff" : "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", outline: "none", width: "100%" }}
              >
                <option value="" style={{ background: "#0D1B3E" }}>Volume estimado de pacientes/mês</option>
                {VOLUMES.map((v) => <option key={v.value} value={v.value} style={{ background: "#0D1B3E" }}>{v.label}</option>)}
              </select>
              {erro && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{erro}</p>}
              <button
                type="submit"
                disabled={loading}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
                  background: loading ? "rgba(26,95,173,0.6)" : "linear-gradient(135deg, #1A5FAD, #40ADDB)",
                  borderRadius: 8, padding: "14px 24px", color: "#fff", fontSize: 15, fontWeight: 600,
                  border: "none", cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 20px rgba(26,95,173,0.35)", width: "100%", marginTop: 4,
                }}
              >
                {loading ? "Enviando…" : "Quero saber mais"}
                {!loading && (
                  <div style={{ width: 36, height: 36, background: "rgba(255,255,255,0.15)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ArrowUpRight style={{ width: 16, height: 16 }} />
                  </div>
                )}
              </button>
            </form>
            )}

            <p style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              Sem spam. Seus dados são tratados com total confidencialidade.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ background: "#0D1B3E", paddingTop: 64, paddingBottom: 40 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: 40,
          }}
          className="footer-grid"
        >
          {/* Brand */}
          <div>
            <img
              src="https://tabghamkt.com.br/wp-content/uploads/2025/05/logo_tabgha_health_mkt_caixa_alta-04-scaled-e1747895382243.png"
              alt="Tabgha Health Marketing"
              style={{ height: 32, width: "auto", filter: "brightness(0) invert(1)", opacity: 0.6 }}
            />
            <p style={{ marginTop: 16, maxWidth: 260, fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.4)" }}>
              Estratégia, conteúdo e tecnologia integrados para clínicas e consultórios que querem crescer com previsibilidade.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4
              style={{
                marginBottom: 16,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              Navegação
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {[["#solucao", "Solução"], ["#resultados", "Resultados"], ["#depoimentos", "Depoimentos"], ["#faq", "FAQ"]].map(([href, label]) => (
                <li key={label}>
                  <a href={href} style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", textDecoration: "none", transition: "color 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4
              style={{
                marginBottom: 16,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              Connect
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {["Instagram", "LinkedIn", "YouTube", "WhatsApp"].map((s) => (
                <li key={s}>
                  <a href="#" style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", textDecoration: "none", transition: "color 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                  >
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Login */}
          <div>
            <h4
              style={{
                marginBottom: 16,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              Plataforma
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <li>
                <Link to="/login" style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", textDecoration: "none", transition: "color 0.2s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#fff"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.5)"; }}
                >
                  Acesso à plataforma
                </Link>
              </li>
              <li>
                <a href="#" style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Política de privacidade</a>
              </li>
              <li>
                <a href="#" style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Termos de uso</a>
              </li>
            </ul>
          </div>
        </div>

        <div
          style={{
            marginTop: 56,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: 32,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
            © {new Date().getFullYear()} Tabgha OS. Todos os direitos reservados.
          </p>
          <Link to="/login" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.6)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.3)"; }}
          >
            Acesso à plataforma →
          </Link>
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function Landing() {
  return (
    <div style={{ fontFamily: "'DM Sans', Inter, system-ui, sans-serif" }}>
      <GlobalStyles />
      <Nav />
      <Hero />
      <TrustBar />
      <ProblemSection />
      <SolutionSection />
      <HowItWorks />
      <ResultsSection />
      <Testimonials />
      <FAQ />
      <CTASection />
      <Footer />
    </div>
  );
}
