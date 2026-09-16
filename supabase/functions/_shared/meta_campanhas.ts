// Allowlist de campanhas Meta por cliente.
//
// Uma mesma conta de anúncio da BM costuma abrigar campanhas de vários
// clientes (e da própria agência). Sem uma lista explícita do que pertence a
// quem, o sync importa a conta inteira e o portal de um cliente passa a exibir
// investimento de outro. Por isso a regra aqui é falhar fechado: sem allowlist
// configurada, nada é importado.

export type CampanhaPermitida = { id: string; nome?: string | null };

export type MetaCampanhaConfig = {
  campanhas?: CampanhaPermitida[] | null;
};

/** Ids de campanha liberados para o cliente. Vazio = nada liberado. */
export function campanhasPermitidas(config: MetaCampanhaConfig | undefined | null): Set<string> {
  const lista = config?.campanhas ?? [];
  const ids = lista.map((c) => String(c?.id ?? "").trim()).filter((id) => id.length > 0);
  return new Set(ids);
}

/**
 * Mantém só as linhas de insights cujas campanhas estão liberadas.
 *
 * Linhas sem `campaign_id` (o nível "account", que vem agregado) são sempre
 * descartadas quando há allowlist: não há como provar que o total agregado é
 * só deste cliente.
 */
export function filtrarPorCampanha(
  rows: Array<Record<string, unknown>>,
  permitidas: Set<string>,
): { mantidas: Array<Record<string, unknown>>; descartadas: number } {
  const mantidas = rows.filter((row) => {
    const id = String(row.campaign_id ?? "").trim();
    return id.length > 0 && permitidas.has(id);
  });
  return { mantidas, descartadas: rows.length - mantidas.length };
}
