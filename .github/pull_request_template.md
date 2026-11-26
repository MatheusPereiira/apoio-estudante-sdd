## Rastreabilidade SDD (Obrigatório — Constituição C1 & CT08)

- **Tarefa (`docs/tasks.md`):** `T__`
- **Requisitos (`docs/prd.md`):** `RF__`, `RN__`, `RNF__`
- **Versão da Spec:** `spec-v1.1.0`
- **Release:** `R0` | `R1` | `R2`
- **Autor:** Humano | Agente (`M2: claude-sonnet-4-5`)

## Resumo das Alterações

-

## Evidências de Verificação (Gate C2 / C3 / C4)

- [ ] `pnpm lint` (inclui regra C2 anti-float em `@app/domain`) verde
- [ ] `pnpm typecheck` verde
- [ ] `pnpm test:domain` (`CT01`, `CT02`, 6 propriedades `fast-check`, cobertura >= 95%) verde
- [ ] `pnpm test:integration` & `pnpm test:idor` (`CT03`, `CT04`, `CT05`) verde
- [ ] `pnpm test:harness` (`EV01`–`EV04`, `CT06`, `CT07`, `CT08`) verde
- [ ] `pnpm build` verde
- [ ] Scanner de PII / segredos = 0 ocorrências (`C4`)
- [ ] Diff restrito a `paths_permitidos` da tarefa

## Custo e Métricas do Harness (se gerado por agente)

- **Ciclos executados:** `__/3`
- **Tokens (in / out):** `__ / __`
- **Custo estimado (US$):** `US$ __` (teto: `US$ 8,00`)
