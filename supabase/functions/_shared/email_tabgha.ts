// Template base dos e-mails do sistema · marca Tabgha OS.
//
// Header em navy com a logo, corpo em branco, assinatura fixa.
// Ponto único da identidade nos e-mails — qualquer fluxo novo (novo lead,
// aprovação de conteúdo pendente, resumo semanal) usa `renderEmailTabgha`
// em vez de montar HTML próprio.
//
// Observação: o e-mail de recuperação de senha é template do Supabase Auth
// (Authentication → Email Templates), não passa por aqui. Use
// `templateAuthRecuperacaoSenha()` para gerar o HTML a colar lá.

const NAVY = "#0E2A47";
const BLUE = "#2B6CB0";
const ORANGE = "#F39C12";
const BG = "#F7FAFC";
const BORDER = "#E2E8F0";
const TEXTO = "#1A202C";
const MUTED = "#718096";

export const SITE_URL = "https://os.tabgha.com.br";
export const LOGO_URL = `${SITE_URL}/logo.svg`;

export type BotaoEmail = { texto: string; url: string };

export type EmailTabghaOpts = {
  /** Vai no <title> e no bloco de destaque do topo do corpo. */
  titulo: string;
  /** Linha de apoio abaixo do título (opcional). */
  subtitulo?: string;
  /** HTML do corpo — parágrafos, listas, o que o fluxo precisar. */
  corpoHtml: string;
  botao?: BotaoEmail;
  /** Texto pequeno logo acima da assinatura (opcional). */
  rodapeExtra?: string;
};

/** Escapa texto que vai para dentro do HTML. */
export function esc(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Parágrafo já formatado no estilo do corpo. */
export function p(texto: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:${TEXTO};">${texto}</p>`;
}

export function renderEmailTabgha(opts: EmailTabghaOpts): string {
  const { titulo, subtitulo, corpoHtml, botao, rodapeExtra } = opts;

  const botaoHtml = botao
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;">
         <tr><td style="border-radius:10px;background:${BLUE};">
           <a href="${esc(botao.url)}" style="display:inline-block;padding:12px 26px;font-family:'Poppins',Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(botao.texto)}</a>
         </td></tr>
       </table>`
    : "";

  const extraHtml = rodapeExtra
    ? `<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">${rodapeExtra}</p>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} · Tabgha OS</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:'Poppins',Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">

    <!-- Header navy -->
    <tr><td style="background:${NAVY};padding:22px 28px;">
      <img src="${LOGO_URL}" alt="Tabgha OS" height="28" style="height:28px;width:auto;display:block;border:0;">
    </td></tr>
    <tr><td style="height:3px;background:${ORANGE};font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- Corpo -->
    <tr><td style="padding:28px;">
      <h1 style="margin:0 0 4px;font-size:19px;line-height:1.3;font-weight:700;color:${TEXTO};">${esc(titulo)}</h1>
      ${subtitulo ? `<p style="margin:0 0 18px;font-size:13px;color:${MUTED};">${esc(subtitulo)}</p>` : '<div style="height:14px;"></div>'}
      ${corpoHtml}
      ${botaoHtml}
      ${extraHtml}
    </td></tr>

    <!-- Assinatura -->
    <tr><td style="border-top:1px solid ${BORDER};padding:18px 28px;background:#ffffff;">
      <p style="margin:0;font-size:11.5px;line-height:1.6;color:${MUTED};">
        <strong style="color:${TEXTO};">Tabgha OS</strong> · Health Growth Operating System<br>
        <a href="${SITE_URL}" style="color:${BLUE};text-decoration:none;">os.tabgha.com.br</a>
      </p>
    </td></tr>

  </table>
  <p style="margin:16px 0 0;font-size:10.5px;color:${MUTED};">© 2026 Tabgha · Todos os direitos reservados</p>
</td></tr>
</table>
</body>
</html>`;
}

// ── Conteúdos prontos dos 4 e-mails previstos na marca ──────────────────────

/**
 * Recuperação de senha. O HTML devolvido vai colado em
 * Supabase → Authentication → Email Templates → Reset Password.
 * `{{ .ConfirmationURL }}` é a variável do próprio Supabase.
 */
export function templateAuthRecuperacaoSenha(): string {
  return renderEmailTabgha({
    titulo: "Redefinir sua senha",
    subtitulo: "Alguém pediu uma nova senha para este e-mail.",
    corpoHtml:
      p("Clique no botão abaixo para escolher uma nova senha. O link vale por 1 hora.") +
      p("Se não foi você, pode ignorar este e-mail — nada muda."),
    botao: { texto: "Criar nova senha", url: "{{ .ConfirmationURL }}" },
    rodapeExtra:
      "Se o botão não funcionar, copie e cole este endereço no navegador:<br>{{ .ConfirmationURL }}",
  });
}

export function emailNovoLead(opts: {
  clinica: string;
  nomeLead: string;
  canal: string;
  telefone: string;
}): string {
  return renderEmailTabgha({
    titulo: "Novo paciente no funil",
    subtitulo: opts.clinica,
    corpoHtml:
      p(`<strong>${esc(opts.nomeLead)}</strong> entrou pelo canal ${esc(opts.canal)}.`) +
      p(`Telefone: ${esc(opts.telefone)}`) +
      p("Quanto antes o primeiro contato, maior a chance de agendamento."),
    botao: { texto: "Abrir o funil", url: `${SITE_URL}/cliente/leads` },
  });
}

export function emailConteudoPendente(opts: { clinica: string; quantidade: number }): string {
  const plural = opts.quantidade === 1 ? "conteúdo aguardando" : "conteúdos aguardando";
  return renderEmailTabgha({
    titulo: "Conteúdo esperando sua aprovação",
    subtitulo: opts.clinica,
    corpoHtml:
      p(`Você tem <strong>${opts.quantidade} ${plural}</strong> sua aprovação no portal.`) +
      p("A aprovação libera a publicação no calendário editorial."),
    botao: { texto: "Revisar conteúdos", url: `${SITE_URL}/cliente/conteudo` },
  });
}

export function emailResumoSemanal(opts: {
  clinica: string;
  periodo: string;
  linhas: Array<{ rotulo: string; valor: string }>;
}): string {
  const tabela = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 8px;border-collapse:collapse;">
    ${opts.linhas
      .map(
        (l) =>
          `<tr>
             <td style="padding:9px 0;border-bottom:1px solid ${BORDER};font-size:13px;color:${MUTED};">${esc(l.rotulo)}</td>
             <td style="padding:9px 0;border-bottom:1px solid ${BORDER};font-size:14px;font-weight:600;color:${TEXTO};text-align:right;">${esc(l.valor)}</td>
           </tr>`,
      )
      .join("")}
  </table>`;

  return renderEmailTabgha({
    titulo: "Seu resumo da semana",
    subtitulo: `${opts.clinica} · ${opts.periodo}`,
    corpoHtml: p("Como a operação andou nos últimos 7 dias:") + tabela,
    botao: { texto: "Ver o painel completo", url: `${SITE_URL}/cliente/dashboard` },
  });
}
