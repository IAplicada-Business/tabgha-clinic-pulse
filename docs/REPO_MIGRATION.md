# Migração Lovable → GitHub canônico

**Data:** 2026-07-24  
**Motivo:** reconnect do GitHub no Lovable criou um repositório novo (mesmo padrão CB Move / Silva Drive).

## Repositórios

| Papel | Repo |
|-------|------|
| **Canônico (usar este)** | https://github.com/IAplicada-Business/tabgha-clinic-pulse |
| Legado (backup) | https://github.com/IAplicada-Business/tabgha-health-hub |

## Lovable

- Project ID: `17846404-c991-4994-9eef-09d7703cac4d`
- Editor: https://lovable.dev/projects/17846404-c991-4994-9eef-09d7703cac4d
- Preview: https://id-preview--17846404-c991-4994-9eef-09d7703cac4d.lovable.app
- Publicado: https://tabgha-clinic-pulse.lovable.app
- Display name: Tabgha Health Hub
- `latest_commit_sha` no momento da auditoria: `c1acc8ac2f009fc19ced9b17613bc454e5dae22c`

## Auditoria de sincronização

Comparação `tabgha-health-hub` (main) × `tabgha-clinic-pulse` (main):

- HEAD idêntico: `c1acc8a` — `fix(crm): editar, criar e excluir leads na ficha do cliente (#71)`
- 189 arquivos em cada lado
- `diff -rq` sem diferenças de conteúdo
- Nenhum arquivo só no antigo ou só no novo
- Histórico de commits de `main` preservado no repo novo
- PRs abertos no legado: 0

**Conclusão:** o código em `main` já está 100% sincronizado. Não há arquivos faltando para copiar.

## O que NÃO foi migrado (de propósito)

- ~56 branches de feature/cursor do legado — ficam no `tabgha-health-hub` como backup
- Issues/PRs históricos do legado

Se alguma branch antiga ainda precisar ser mergeada, rebase em cima deste `main` e abra PR **aqui**.

## Checklist operacional pós-migração

1. [x] Conteúdo de `main` idêntico nos dois repos + Lovable
2. [ ] Adicionar `tabgha-clinic-pulse` na instalação do GitHub App do **Cursor** (Settings → Applications → Cursor → Repository access), senão Cloud Agents continuam só no legado
3. [ ] Abrir o projeto no Cursor a partir do repo **novo**
4. [ ] Arquivar `tabgha-health-hub` no GitHub (read-only backup) quando o time confirmar
5. [ ] Validar um commit trivial: push no novo → aparece no Lovable

## Fluxo de trabalho a partir de agora

1. Editar via Cursor (repo `tabgha-clinic-pulse`) **ou** via agente Lovable
2. `main` deste repo é a fonte de verdade
3. Não fazer push no `tabgha-health-hub`
