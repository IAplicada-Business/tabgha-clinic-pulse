import { jsPDF } from "jspdf";

import { FONTES_LIST, faixaScore } from "@/lib/fontes";
import type { DiagnosticoRelatorio } from "@/hooks/useDiagnosticoRelatorio";

const MARGIN_X = 18;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const BOTTOM_LIMIT = PAGE_HEIGHT - 20;

type FonteRelatorio = { diagnostico?: string; oportunidades?: string[]; plano_acao?: string[] };

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function exportRelatorioPdf({
  clienteNome,
  relatorio,
  scores,
}: {
  clienteNome: string;
  relatorio: DiagnosticoRelatorio;
  scores: Array<{ label: string; score: number | null }>;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 22;

  function ensureSpace(nextLines: number, lineHeight: number) {
    if (y + nextLines * lineHeight > BOTTOM_LIMIT) {
      doc.addPage();
      y = 22;
    }
  }

  function writeParagraph(text: string, fontSize: number, lineHeight: number, color = "#0f172a") {
    doc.setFontSize(fontSize);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[];
    for (const line of lines) {
      ensureSpace(1, lineHeight);
      doc.text(line, MARGIN_X, y);
      y += lineHeight;
    }
  }

  function writeHeading(text: string, fontSize = 13) {
    ensureSpace(2, 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor("#0f172a");
    doc.text(text, MARGIN_X, y);
    doc.setFont("helvetica", "normal");
    y += fontSize * 0.5 + 2;
  }

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor("#0284c7");
  doc.text("Diagnóstico das 7 Fontes", MARGIN_X, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor("#334155");
  doc.text(clienteNome, MARGIN_X, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor("#64748b");
  const geradoEm = new Date(relatorio.gerado_em).toLocaleString("pt-BR");
  const scoreTxt =
    relatorio.score_geral != null ? ` · score geral ${relatorio.score_geral}/100` : "";
  doc.text(`Gerado em ${geradoEm}${scoreTxt}`, MARGIN_X, y);
  y += 10;

  // Resumo executivo
  if (relatorio.resumo_executivo) {
    writeHeading("Resumo executivo");
    writeParagraph(relatorio.resumo_executivo, 10.5, 5.2);
    y += 4;
  }

  // Scores por Fonte (tabela simples)
  writeHeading("Score por Fonte");
  doc.setFontSize(10);
  for (const s of scores) {
    ensureSpace(1, 5.5);
    const faixa = faixaScore(s.score);
    doc.setTextColor("#0f172a");
    doc.text(s.label, MARGIN_X, y);
    doc.setTextColor("#64748b");
    const valor = s.score != null ? `${s.score}/100 · ${faixa.label}` : "sem dados";
    doc.text(valor, MARGIN_X + 70, y);
    y += 5.5;
  }
  y += 4;

  // Por Fonte: diagnóstico, oportunidades, plano de ação
  const porFonte = (relatorio.por_fonte ?? {}) as Record<string, FonteRelatorio>;
  for (const f of FONTES_LIST) {
    const dado = porFonte[f.slug];
    if (!dado) continue;

    ensureSpace(2, 6);
    writeHeading(f.label, 12);

    if (dado.diagnostico) {
      writeParagraph(dado.diagnostico, 10, 5);
      y += 2;
    }

    if (dado.oportunidades?.length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor("#0f172a");
      ensureSpace(1, 5);
      doc.text("Oportunidades", MARGIN_X, y);
      doc.setFont("helvetica", "normal");
      y += 5;
      for (const item of dado.oportunidades) {
        writeParagraph(`• ${item}`, 9.5, 4.6, "#334155");
      }
      y += 1;
    }

    if (dado.plano_acao?.length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor("#0f172a");
      ensureSpace(1, 5);
      doc.text("Plano de ação", MARGIN_X, y);
      doc.setFont("helvetica", "normal");
      y += 5;
      dado.plano_acao.forEach((item, i) => {
        writeParagraph(`${i + 1}. ${item}`, 9.5, 4.6, "#334155");
      });
    }

    y += 5;
  }

  doc.save(`diagnostico-7fontes-${slugify(clienteNome)}.pdf`);
}
