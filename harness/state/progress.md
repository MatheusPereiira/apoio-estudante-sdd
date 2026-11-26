# Progresso Persistente do Harness (`progress.md`)

> Memória append-only conforme `docs/harness-spec.md` §2 (Bloco 1 — Contexto e Estado).

## Sprint R0 — Base Técnica
- [x] `T01`–`T04`: Constituição, PRD v1.1.0, Arquitetura, Data Model, API Spec e ADRs 001–003 concluídos em `main`.
- [x] `T09`–`T11`: Monorepo `pnpm + Turborepo`, ESLint com regra C2 anti-float, `.devcontainer`, `CODEOWNERS`, template de PR e GitHub Actions CI.
- [x] `T07`: Schema Prisma PostgreSQL 16 (7 tabelas), migração SQL com constraint trigger RN03 e seeds sintéticos `@example.test`.
- [x] `T06`: Fluxo vertical `GET /api/v1/health` (E01).

## Sprint R1 — Piloto (C + F1)
- [x] `T08`: Autenticação Argon2id + JWT + refresh rotativo com revogação de família + bloqueio 423 + CSRF double-submit (`CT05`).
- [x] `T19`–`T21`: APIs e UI de Períodos, Disciplinas e Avaliações com validação de soma de pesos (`RN03`).
- [x] `T24`: Suíte bloqueante de isolamento Zero IDOR (`CT04`).

## Sprint R2 — Entrega do Recorte (F2 + F3 + Harness + Operação)
- [x] `T33` & `T36`: Motor puro `@app/domain` (`decimal.js`, `SIMPLES`/`PONDERADA`, Substitutiva `RN19`, Exame Final `RN20`/`RN21`, Nota Necessária `RN10`) + 6 propriedades `fast-check` (`CT01`, `CT02`).
- [x] `T34`, `T35`, `T47`, `T48`, `T49`: APIs completas `E01`–`E35`, UI Next.js 15 mobile-first, Simulador "E se?", Histórico imutável e LGPD (`export` + exclusão em cascata).
- [x] `T05`, `T16`, `T17`, `T31`: Harness multi-LLM (`M1`/`M2`/`M3`), `PathGuard`, `PiiAndSecretScanner`, `BudgetCircuitBreaker` e evals `EV01`–`EV04` (`CT06`, `CT07`, `CT08`).
- [x] `T38` & `T52`: Script de carga `k6` e suíte E2E Playwright.
