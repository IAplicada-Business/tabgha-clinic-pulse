# Prompt: aplicar a padronização de componentes (Tabgha OS)

Cole este prompt numa sessão do Claude Code dentro do repo `tabgha-clinic-pulse` quando quiser
executar a padronização. Ele assume que `notas-internas/proposta_padronizacao_componentes.html`
já existe como referência visual — se não existir mais, gere de novo antes.

---

Você vai trabalhar na tarefa de **aplicar** a padronização de componentes descrita em
`notas-internas/proposta_padronizacao_componentes.html`. Esse documento já é o resultado de
uma auditoria — não reaudite do zero, use-o como especificação. O achado central dele: existem
hoje **dois cards de KPI diferentes** competindo no mesmo produto (o componente compartilhado
`KpiCard` em `src/components/ui/kpi-card.tsx`, e um "rank card" inline copiado e colado em pelo
menos 3 arquivos: `admin/dashboard.tsx`, `admin/dashboard-clientes.tsx`, `meta/MetaAdsPage.tsx`).

## Regras
- Crie uma branch nova (ex: `padronizacao-componentes`). Não commite direto na main.
- Isto é refatoração **puramente visual/estrutural**. Dados, queries, lógica de negócio e
  comportamento de cada tela têm que ficar idênticos — nenhuma tela pode mudar de significado,
  só a forma como o componente visual é montado por baixo.
- Não invente nada que o documento não descreveu (ex: não crie um card de criativo com
  thumbnail — o próprio documento sinaliza que esse padrão ainda não existe no código).
- Rode lint ao final. Para cada tela alterada, rode o dev server e compare visualmente
  antes/depois (screenshot), não assuma que "deu build" significa "ficou igual visualmente".

## Escopo

### 1. Consolidar o KpiCard v2 (canônico)
- Leia `src/components/ui/kpi-card.tsx` (versão A: ícone + valor + chip de variação) e as 3
  implementações inline do "rank card" (versão B: número de rank + valor gigante + barra de
  cor no rodapé) nos três arquivos citados acima.
- Atualize `KpiCard` para suportar opcionalmente uma barra de cor no rodapé
  (prop tipo `accentBar?: string` com a classe Tailwind da cor), igual à proposta "KpiCard v2"
  do documento.
- Substitua as 3 implementações inline pelo componente atualizado, mantendo exatamente os
  mesmos dados/valores/formatos exibidos hoje em cada tela.
- **Não** adicione número de rank ("01", "02"...) — o documento recomenda explicitamente tirar
  isso, é ruído num grid de 4 KPIs.

### 2. Extrair o padrão "ponto + label" de status ao vivo
- Hoje só existe inline em `src/components/atendimento/AtendimentoPage.tsx`, para os estados
  `owner_state` (bot / humano / aguardando / fechada).
- Crie um componente pequeno (ex: `src/components/ui/status-dot.tsx`) com uma variant por
  estado, e troque o uso inline por ele.

### 3. Centralizar a sombra de card
- Hoje `shadow-[0_1px_3px_rgba(15,27,53,0.04)]` é repetida como string inline em pelo menos
  5 arquivos diferentes.
- Adicione como token real em `src/styles.css` (ex: `--shadow-card`) e crie uma classe
  utilitária correspondente; troque os usos inline por essa classe.

### 4. Fora de escopo nesta etapa
- Não crie componentes novos que o documento não descreveu.
- Não mexa em domínio, migrations ou banco.
- Não mexa em copy/texto das telas — só na estrutura dos componentes.

## Ao final, devolva
- Lista de arquivos alterados.
- Prints antes/depois de pelo menos 2 telas (`dashboard.tsx` e `MetaAdsPage.tsx`).
- Confirmação campo a campo de que os valores exibidos continuam batendo com o que era
  mostrado antes da refatoração (não só "visualmente parece igual").
