/** Helpers de análise gerencial + narrativas em linguagem leiga */

export const LEAD_STATUSES = [
  "novo",
  "em_conversa",
  "interessado",
  "agendado",
  "atendido",
  "convertido",
  "perdido",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  em_conversa: "Em conversa",
  interessado: "Interessado",
  agendado: "Agendado",
  atendido: "Atendido",
  convertido: "Convertido",
  perdido: "Perdido",
};

export const LEAD_STATUS_COLOR: Record<string, string> = {
  novo: "#94a3b8",
  em_conversa: "#60C3E8",
  interessado: "#1A5FAD",
  agendado: "#f59e0b",
  atendido: "#0ea5e9",
  convertido: "#10b981",
  perdido: "#f43f5e",
};

export type PlainInsight = {
  title: string;
  body: string;
  tone: "info" | "good" | "warn";
};

export function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function fmtMoneyCompact(v: number) {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return fmtMoney(v);
}

export function fmtPct(v: number | null, digits = 0) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

export function pct(part: number, total: number): number | null {
  if (total <= 0) return null;
  return (part / total) * 100;
}

export function percentDiff(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function countByStatus(rows: { status: string }[]) {
  const map = new Map<string, number>();
  for (const s of LEAD_STATUSES) map.set(s, 0);
  for (const row of rows) {
    map.set(row.status, (map.get(row.status) ?? 0) + 1);
  }
  return LEAD_STATUSES.map((status) => ({
    status,
    label: LEAD_STATUS_LABEL[status] ?? status,
    count: map.get(status) ?? 0,
    color: LEAD_STATUS_COLOR[status] ?? "#94a3b8",
  }));
}

export function funnelStages(rows: { status: string }[]) {
  const total = rows.length;
  const buckets = [
    { key: "entrada", label: "Entrada", count: total, color: "#94a3b8" },
    {
      key: "qualificacao",
      label: "Qualificação",
      count: rows.filter((r) =>
        ["em_conversa", "interessado", "agendado", "atendido", "convertido"].includes(r.status),
      ).length,
      color: "#60C3E8",
    },
    {
      key: "atendimento",
      label: "Atendimento",
      count: rows.filter((r) => ["agendado", "atendido", "convertido"].includes(r.status)).length,
      color: "#1A5FAD",
    },
    {
      key: "convertido",
      label: "Convertido",
      count: rows.filter((r) => r.status === "convertido").length,
      color: "#10b981",
    },
  ];
  return buckets.map((b, i) => ({
    ...b,
    rateFromPrev:
      i === 0 ? 100 : buckets[i - 1].count > 0 ? (b.count / buckets[i - 1].count) * 100 : null,
    shareOfTotal: pct(b.count, total),
  }));
}

export function insightFromGap(adsLeads: number, crmLeads: number): string | null {
  if (adsLeads <= 0 && crmLeads <= 0) return null;
  if (adsLeads > 0 && crmLeads === 0) {
    return `${adsLeads} é o que a Meta contabilizou no anúncio — ainda não são fichas no funil. Para virar nome e telefone, importe os formulários em Conexões Meta (permissão leads_retrieval).`;
  }
  if (crmLeads > adsLeads * 1.25) {
    return "Mais gente está no funil (WhatsApp, indicação, manual) do que só o anúncio reportou. A mídia paga não é a única porta.";
  }
  if (adsLeads > crmLeads * 1.25) {
    const gap = adsLeads - crmLeads;
    return `${adsLeads} eventos Ads vs ${crmLeads} fichas no funil. Os ${gap} de diferença não estão “perdidos no gráfico”: a Meta contou o clique/formulário; o kanban só mostra quem já foi importado.`;
  }
  return "Eventos da Meta e fichas no funil estão próximos neste período.";
}

export function daysBetween(isoDate: string, now = new Date()) {
  const d = new Date(isoDate);
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

/** Headline curta do tipo “o que está acontecendo” */
export function buildHeadline(input: {
  invest: number;
  leadsCrm: number;
  leadsAds: number;
  caq: number | null;
  convertidos: number;
  perdidos?: number;
}): { title: string; body: string; tone: "info" | "good" | "warn" } {
  const { invest, leadsCrm, leadsAds, caq, convertidos, perdidos = 0 } = input;
  const leads = leadsCrm > 0 ? leadsCrm : leadsAds;

  if (invest <= 0 && leads <= 0) {
    return {
      title: "Ainda sem movimento no período",
      body: "Não há investimento nem leads neste filtro. Selecione outro período ou confirme se a mídia e o WhatsApp estão conectados.",
      tone: "warn",
    };
  }

  if (invest > 0 && leads === 0) {
    return {
      title: "Dinheiro saindo, contatos não entrando",
      body: `Foram investidos ${fmtMoney(invest)} e nenhum lead chegou ao funil. Parece um vazamento entre o anúncio e o atendimento — prioridade alta.`,
      tone: "warn",
    };
  }

  if (convertidos > 0 && leads > 0) {
    const rate = pct(convertidos, leads) ?? 0;
    return {
      title: "Tem gente fechando — e o funil mostra o caminho",
      body: `${leads} oportunidades no período, ${convertidos} convertidas (${fmtPct(rate)}). ${
        caq != null ? `Cada lead está custando cerca de ${fmtMoney(caq)}.` : ""
      } ${perdidos > leads * 0.35 ? "Atenção: muitos leads se perderam no caminho." : "O ritmo está saudável para explicar ao cliente."}`,
      tone: rate >= 8 ? "good" : "info",
    };
  }

  if (caq != null && caq > 80) {
    return {
      title: "Leads estão caros neste período",
      body: `O custo por lead ficou em ${fmtMoney(caq)} com ${fmtMoney(invest)} investidos. Vale revisar criativos, público ou pausar campanhas fracas.`,
      tone: "warn",
    };
  }

  return {
    title: "O funil está se enchendo",
    body: `${leads} leads no período${invest > 0 ? ` com ${fmtMoney(invest)} em mídia` : ""}${
      caq != null ? ` (cerca de ${fmtMoney(caq)} por lead)` : ""
    }. Agora o foco é avançar conversas — não só captar.`,
    tone: "info",
  };
}

export function buildFunnelInsights(rows: { status: string }[]): PlainInsight[] {
  const total = rows.length;
  if (total === 0) {
    return [
      {
        title: "Funil vazio",
        body: "Sem oportunidades neste filtro. Sem dados, não dá para apontar gargalo — mude o período ou o cliente.",
        tone: "warn",
      },
    ];
  }
  const stages = funnelStages(rows);
  const novos = rows.filter((r) => r.status === "novo").length;
  const perdidos = rows.filter((r) => r.status === "perdido").length;
  const convertidos = stages[3].count;
  const out: PlainInsight[] = [];

  const dropQual =
    stages[0].count > 0 && stages[1].count / stages[0].count < 0.45
      ? "A maior parte para na entrada — muita gente entra e não é atendida a tempo."
      : null;
  const dropConv =
    stages[2].count > 0 && stages[3].count / stages[2].count < 0.2
      ? "Poucos que chegaram no atendimento viram paciente — falta fechamento ou follow-up."
      : null;

  if (dropQual) {
    out.push({ title: "Gargalo na entrada", body: dropQual, tone: "warn" });
  } else if (dropConv) {
    out.push({ title: "Gargalo no fechamento", body: dropConv, tone: "warn" });
  } else {
    out.push({
      title: "Funil equilibrado",
      body: `Das ${total} oportunidades, ${convertidos} viraram paciente. O fluxo está razoavelmente saudável.`,
      tone: "good",
    });
  }

  if (novos / total > 0.5) {
    out.push({
      title: "Fila de novos inchada",
      body: `${novos} leads ainda estão em “novo” (${fmtPct(pct(novos, total))}). Sem resposta rápida, o anúncio vira dinheiro jogado fora.`,
      tone: "warn",
    });
  }

  if (perdidos / total > 0.3) {
    out.push({
      title: "Muitos leads perdidos",
      body: `${perdidos} marcados como perdidos. Vale olhar os motivos — preço, demora ou público errado.`,
      tone: "warn",
    });
  }

  return out.slice(0, 3);
}

export function buildRankingInsights(
  rows: Array<{ nome: string; investimento: number; leads: number; caq: number | null }>,
): PlainInsight[] {
  if (rows.length === 0) {
    return [
      {
        title: "Sem ranking ainda",
        body: "Não há investimento ou leads suficientes para comparar clínicas neste filtro.",
        tone: "info",
      },
    ];
  }
  const bySpend = [...rows].sort((a, b) => b.investimento - a.investimento);
  const byCaq = [...rows].filter((r) => r.caq != null).sort((a, b) => (a.caq ?? 0) - (b.caq ?? 0));
  const top = bySpend[0];
  const best = byCaq[0];
  const worst = byCaq[byCaq.length - 1];
  const out: PlainInsight[] = [];

  if (top) {
    const share = pct(
      top.investimento,
      rows.reduce((s, r) => s + r.investimento, 0),
    );
    out.push({
      title: "Quem concentra o investimento",
      body: `${top.nome} leva ${fmtPct(share)} do investimento (${fmtMoney(top.investimento)}) e gerou ${top.leads} leads.`,
      tone: "info",
    });
  }
  if (best && worst && best.nome !== worst.nome && best.caq != null && worst.caq != null) {
    out.push({
      title: "Melhor e pior eficiência",
      body: `${best.nome} traz lead mais barato (${fmtMoney(best.caq)}). ${worst.nome} está em ${fmtMoney(worst.caq)} — revise criativo ou público.`,
      tone: worst.caq > best.caq * 1.8 ? "warn" : "info",
    });
  }
  return out;
}

export function buildCampaignInsights(
  rows: Array<{ campanha: string; investimento: number; leads: number; caq: number | null }>,
): PlainInsight[] {
  if (rows.length === 0) {
    return [
      {
        title: "Sem campanhas no filtro",
        body: "Não há dados de campanha. Conecte a Meta BM e sincronize Marketing Pago.",
        tone: "warn",
      },
    ];
  }
  const sorted = [...rows].sort((a, b) => b.investimento - a.investimento);
  const top = sorted[0];
  const totalInvest = rows.reduce((s, r) => s + r.investimento, 0);
  const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
  const shareSpend = pct(top.investimento, totalInvest);
  const shareLeads = pct(top.leads, totalLeads);
  const out: PlainInsight[] = [
    {
      title: "Campanha que puxa o resultado",
      body: `“${top.campanha}” usa ${fmtPct(shareSpend)} do budget e entrega ${fmtPct(shareLeads)} dos leads${
        top.caq != null ? ` (CAQ ${fmtMoney(top.caq)})` : ""
      }.`,
      tone: "info",
    },
  ];
  const weak = sorted.filter((r) => r.investimento > 0 && r.leads === 0);
  if (weak.length) {
    out.push({
      title: "Campanhas queimando verba",
      body: `${weak.length} campanha(s) gastaram sem gerar lead. Pause ou troque criativo antes de renovar budget.`,
      tone: "warn",
    });
  }
  const efficient = [...rows]
    .filter((r) => r.leads > 0 && r.caq != null)
    .sort((a, b) => (a.caq ?? 0) - (b.caq ?? 0));
  if (efficient.length >= 2) {
    const best = efficient[0];
    const worst = efficient[efficient.length - 1];
    if (best.campanha !== worst.campanha && best.caq != null && worst.caq != null) {
      out.push({
        title: "Onde o dinheiro rende mais",
        body: `“${best.campanha}” traz lead por ${fmtMoney(best.caq)}. “${worst.campanha}” está em ${fmtMoney(worst.caq)} — desvie budget da cara para a barata.`,
        tone: worst.caq > best.caq * 1.6 ? "warn" : "good",
      });
    }
  }
  return out.slice(0, 3);
}

export function buildAdInsights(
  rows: Array<{ anuncio: string; campanha: string; leads: number; investimento?: number }>,
): PlainInsight[] {
  if (rows.length === 0) {
    return [
      {
        title: "Ainda sem métricas por anúncio",
        body: "Sincronize a Meta no período. As linhas de anúncio vêm do insights level=ad (investimento, leads, impressões e cliques).",
        tone: "info",
      },
    ];
  }
  const sorted = [...rows].sort(
    (a, b) => b.leads - a.leads || (b.investimento ?? 0) - (a.investimento ?? 0),
  );
  const top = sorted[0];
  const total = rows.reduce((s, r) => s + r.leads, 0);
  const spendHint =
    top.investimento != null && top.investimento > 0
      ? ` com ${fmtMoneyCompact(top.investimento)} investidos`
      : "";
  const out: PlainInsight[] = [
    {
      title: "Criativo que mais puxa gente",
      body: `“${top.anuncio}” gerou ${top.leads} leads (${fmtPct(pct(top.leads, total))}) via ${top.campanha}${spendHint}. Esse é o formato para escalar ou clonar.`,
      tone: "good",
    },
  ];
  if (sorted.length >= 3) {
    const bottom = sorted.slice(-2);
    const bottomLeads = bottom.reduce((s, r) => s + r.leads, 0);
    out.push({
      title: "Peças que quase não conversam",
      body: `${bottom.map((b) => b.anuncio).join(" e ")} somam só ${bottomLeads} leads. Vale pausar e realocar impressão para o top.`,
      tone: "warn",
    });
  }
  return out;
}
