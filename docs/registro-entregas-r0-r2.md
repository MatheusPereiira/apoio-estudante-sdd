# Relatório Consolidado do que Foi Feito (Sprints R0 → R2)

> **Projeto:** Plataforma de Apoio ao Estudante Universitário (SDD + Agent Harness Engineering)
> **Versão Entregue:** `v1.1.0` · **Data:** 26/11/2026 · **Base de Especificação:** `spec-v1.1.0`
> **Repositório:** https://github.com/MatheusPereiira/apoio-estudante-sdd
> **Branches Versionadas:** `develop` (7 commits incrementais) → integrada em `main` via merge commit `e12de9a`

---

## 1. Resumo Executivo

A partir da baseline de especificação zero-código (`spec-v1.1.0` em `docs/`), o sistema foi implementado de ponta a ponta como um **monorepo TypeScript modular** (`pnpm + Turborepo`), atendendo simultaneamente às **duas visões arquiteturais** exigidas pela disciplina:

- **Visão A (Aplicação Entregue):** motor de cálculo decimal exato (`@app/domain`), contratos tipados Zod/OpenAPI (`@app/contracts`), modelagem PostgreSQL 16 + Prisma (`@app/db`), casos de uso com isolamento estrito por estudante (`@app/application`), camada de segurança/infraestrutura (`@app/infrastructure`) e aplicação web responsiva Next.js 15 com **todos os 35 endpoints REST (`E01`–`E35`)** e telas mobile-first (`apps/web`).
- **Visão B (Engenharia com IA e Qualidade):** Harness determinístico multi-LLM (`M1: gpt-5`, `M2: claude-sonnet-4-5`, `M3: gemini-2.5-flash`), guardrails de segurança (`PathGuard`, `PiiAndSecretScanner`, `BudgetCircuitBreaker`), suíte automatizada de evals (`EV01`–`EV04`), sandbox `.devcontainer` e pipelines de CI/CD no GitHub Actions.

Todos os gates determinísticos foram executados e aprovados localmente (**lint, typecheck, cobertura ≥ 95% no domínio, testes de integração, suíte bloqueante Zero IDOR, Auth/CSRF, evals do harness e build de produção Next.js 15**).

---

## 2. Histórico de Versionamento Ágil (Git Sprint Flow)

O desenvolvimento foi conduzido na branch `develop` em **7 commits atômicos e rastreáveis** às tarefas de `docs/tasks.md`, e posteriormente integrado em `main` preservando o grafo completo de sprint (`git merge --no-ff`):

| Ordem | Commit | Release | Tarefas | Escopo Entregue |
|---|---|---|---|---|
| 1 | `ca0177e` | **R0** | `T09`, `T10`, `T11` | Monorepo `pnpm/Turbo`, `tsconfig.base.json` strict, ESLint com regra customizada `C2` anti-float, `.devcontainer`, `docker-compose.yml`, `CODEOWNERS`, template de PR e 3 workflows GitHub Actions |
| 2 | `ccd4ff8` | **R0** | `T07` | Schema Prisma PostgreSQL 16 (7 tabelas), migração SQL com `citext`, FKs compostas e constraint trigger `RN03` (soma de pesos ≤ 100%), seed sintético `@example.test` e contratos Zod + OpenAPI 3.1 |
| 3 | `3487bd1` | **R1** | `T33`, `T36` | Motor puro `@app/domain` (`decimal.js`, `SIMPLES`/`PONDERADA`, Substitutiva `RN19`, Exame Final `RN20`/`RN21`, Nota Necessária `RN10`, 12 estados `RF15`) + 27 testes unitários e **6 propriedades `fast-check`** |
| 4 | `88fecb1` | **R1** | `T08`, `T19`, `T20`, `T24` | Casos de uso `@app/application`, Argon2id (`RNF07`), JWT + refresh rotativo com revogação de família (`CT05`), CSRF double-submit, rate limiter, logger Pino sem PII, repositórios `Prisma` e `InMemory` (com seed demo) e suíte bloqueante **Zero IDOR (`CT04`)** |
| 5 | `ffd61e7` | **R2** | `T06`, `T34`, `T47`, `T49` | Implementação completa dos **35 endpoints REST (`/api/v1/*`, `E01`–`E35`)** com Problem Details (RFC 9457), `X-Trace-Id`, cabeçalhos de segurança (`CSP`, `HSTS`, `X-Frame-Options`), cookies `HttpOnly` e `405` no histórico imutável |
| 6 | `8eafd49` | **R2** | `T21`, `T35`, `T38`, `T48`, `T52` | Interface Next.js 15 App Router mobile-first WCAG 2.1 AA (Login, Cadastro, Períodos, Painel do Período, Detalhe da Disciplina com Substitutiva/Exame/Simulador/Histórico e Perfil LGPD) + testes Playwright E2E e carga `k6` |
| 7 | `3af5666` | **R2** | `T05`, `T16`, `T17`, `T31` | Harness multi-LLM (`M1`/`M2`/`M3`), `PathGuard`, `PiiAndSecretScanner`, `BudgetCircuitBreaker`, prompts versionados, `progress.md`, `decisions.jsonl`, evals `EV01`–`EV04` (`CT06`–`CT08`) e atualização do `README.md` |
| Merge | `e12de9a` | **R0–R2** | — | `merge(sprint): integra branch develop na main (Releases R0, R1 e R2)` |

---

## 3. Detalhamento Técnico do Sistema Implementado

### 3.1 Visão A — Aplicação Entregue

| Pacote / App | Caminho | Principais Entregas | Regras / Requisitos Atendidos |
|---|---|---|---|
| **Motor de Domínio** | `packages/domain/` | `calcularDesempenho`, `simularDesempenho`, `PonderadaStrategy`, `SimplesStrategy`, `aplicarSubstitutiva` (maior ganho ponderado e nunca reduz média), `calcularExameFinal`, `calcularNotaNecessariaPendentes` (`CEILING`), `classificarSituacao` (12 estados) e ordenação de painel | `C2`, `RF09`, `RF10`, `RF12`, `RF13`, `RF15`, `RN04`–`RN10`, `RN19`–`RN21`, `RNF14` |
| **Contratos & OpenAPI** | `packages/contracts/` | Schemas Zod para auth e domínio acadêmico (validação 0–10 com até 2 casas, senhas fortes com blocklist), `DomainError` → RFC 9457 `ProblemDetails` (20 códigos de erro) e catálogo OpenAPI 3.1 dos 35 endpoints | `C1`, `RF01`–`RF15`, `RN02`, `RN03`, `api-spec.md` |
| **Banco de Dados** | `packages/db/` | `schema.prisma` (7 tabelas: `usuario`, `sessao`, `periodo_letivo`, `disciplina`, `avaliacao`, `historico_nota`, `evento_auditoria`), migração SQL com extensão `citext`, FKs compostas `(id, usuario_id)`, `CHECK`s, índice parcial de próximas avaliações e trigger `DEFERRABLE` `trg_validar_soma_pesos` | `RN01`, `RN03`, `RN05`, `RN11`, `RN15`–`RN17`, `data-model.md` |
| **Casos de Uso** | `packages/application/` | `AuthService`, `PeriodoService`, `DisciplinaService`, `AvaliacaoService`, `PainelService` e porta `AppRepositoryPort` exigindo `usuarioId` em 100% das operações acadêmicas | `C3`, `RF01`–`RF15`, `RN01`, `RN11`–`RN17` |
| **Infraestrutura & Segurança** | `packages/infrastructure/` | `NodeCryptoAdapter` (Argon2id via `hash-wasm` com `m=19456 KiB, t=2, p=1` + JWT HS256 via `jose`), `verifyCsrfDoubleSubmit`, `SlidingWindowRateLimiter`, logger `Pino` com redaction de PII, `PrismaAppRepository`, `InMemoryAppRepository` e seed sintético demo (`ana@example.test`) | `C3`, `C4`, `RNF07`–`RNF12`, `RNF19` |
| **Web App & API REST** | `apps/web/` | 23 arquivos de rotas implementando **todos os 35 endpoints `E01`–`E35`**; 7 páginas App Router (`/`, `/login`, `/cadastro`, `/periodos`, `/periodos/[periodoId]/painel`, `/disciplinas/[disciplinaId]`, `/perfil`); cliente HTTP com renovação transparente de token (`CA02.3`); formatação pt-BR (`RNF21`) e lançamento rápido em ≤ 3 interações (`RNF18`) | `RF01`–`RF15`, `RNF08`, `RNF11`, `RNF16`–`RNF18`, `RNF21`, `ui-ux-spec.md` |

### 3.2 Visão B — Harness de Engenharia com IA e Governança

| Componente | Caminho | Comportamento Implementado |
|---|---|---|
| **Matriz Multi-LLM e Limites** | `harness/policies/config.ts` | Configuração de `M1` (`gpt-5` OpenAI), `M2` (`claude-sonnet-4-5` Anthropic), `M3` (`gemini-2.5-flash` Google), teto de 3 ciclos, 10 min/chamada, 30 min/tarefa, 1,5M in / 120k out, US$ 8,00/tarefa e US$ 90,00/semana (`C6`) |
| **PathGuard** | `harness/policies/path-guard.ts` | Bloqueia escrita fora de `paths_permitidos`, path traversal (`..`) e arquivos protegidos (`.env*`, `docs/constitution.md`, `.github/workflows/**`, `harness/policies/**`) com `POLICY_VIOLATION` (`EV04`) |
| **PiiAndSecretScanner** | `harness/policies/pii-scanner.ts` | Bloqueia CPFs, e-mails fora de `@example.test` e chaves/tokens (`sk-`, `sk-ant-`, `AIza`, `ghp_`, strings PostgreSQL) antes de qualquer chamada LLM (`C4`, `EV04`) |
| **BudgetCircuitBreaker** | `harness/policies/budget-breaker.ts` | Calcula custo acumulado por modelo, emite alerta em 80% e aborta antes de ultrapassar o teto (`EV02`, `CT07`) |
| **Roteador e Orquestrador** | `harness/agents/router.ts`, `orchestrator.ts` | Máquina de estados `ContextBuilder → PiiScanIn → Planner_M1 → HumanGatePlan (Risco A) → Executor_M2 → DeterministicGates → Triage_M3 → Reviewer_M1 → OpenPR/ESCALATED`; fallback `M2 → M3` restrito a risco `BAIXO` |
| **Memória e Prompts** | `harness/prompts/`, `harness/state/` | Prompts versionados (`planner-m1.md`, `executor-m2.md`, `triage-m3.md`), `progress.md` e trilha auditável `decisions.jsonl` |
| **CI/CD & Sandbox** | `.github/`, `.devcontainer/` | `ci.yml` (6 gates bloqueantes), `harness-evals.yml`, `release.yml`, `CODEOWNERS`, `pull_request_template.md` e container Docker isolado sem segredos |

---

## 4. Evidências Objetivas de Verificação (Gates Executados)

Todas as verificações abaixo foram rodadas diretamente no repositório antes do merge na `main`:

| Gate / Caso de Teste | Comando / Suíte | Resultado Observado | Referência SDD |
|---|---|---|---|
| **Prisma Client** | `pnpm db:generate` | Gerado com sucesso (Prisma `6.19.3`) | `T07`, `data-model.md` |
| **Lint + Regra Anti-Float (`C2`)** | `pnpm lint` | **0 erros, 0 warnings** (regra `sdd/no-native-float-math` ativa em `packages/domain/src`) | `C2`, `RNF15` |
| **TypeScript Strict** | `pnpm typecheck` | **11/11 alvos aprovados** em todo o monorepo | `RNF15` |
| **Domínio + Propriedades (`CT01`, `CT02`)** | `pnpm --filter @app/domain test:coverage` | **27/27 testes verdes** (incl. 6 propriedades `fast-check` × 1.000 runs = 6.000 casos aleatórios) · **95,0% cobertura de linhas / 96,42% funções** | `CT01`, `CT02`, `RNF14` |
| **Integração F1+F2+F3+LGPD (`CT03`)** | `packages/infrastructure/test/integration.spec.ts` | **100% verde** (fluxo completo, ordenação do painel `[Física I, Cálculo I, Algoritmos]`, simulação não persistida, export e exclusão LGPD) | `CT03`, `RF01`–`RF15` |
| **Isolamento Zero IDOR (`CT04`)** | `packages/infrastructure/test/idor.spec.ts` | **100% verde** — 24 tentativas cross-user retornando `404 NAO_ENCONTRADO` com integridade preservada | `C3`, `CT04`, `RN01`, `RNF09` |
| **Auth, Lockout, Refresh e CSRF (`CT05`)** | `packages/infrastructure/test/auth-csrf.spec.ts` | **100% verde** — bloqueio `423` após 5 falhas, revogação total da família no reuso de refresh e `403 CSRF_INVALIDO` | `CT05`, `RF02`, `RNF07`, `RNF08` |
| **Evals do Harness (`CT06`–`CT08`)** | `harness/evals/harness.eval.spec.ts` | **5/5 suítes verdes** (`EV01` 3 ciclos + timeout, `EV02` corte US$ 0,10, `EV03`/`CT08` simulação T33 Ciclo 1 falha → M3 → Ciclo 2 sucesso, `EV04` PathGuard + PiiScanner) | `CT06`, `CT07`, `CT08`, `EV01`–`EV04` |
| **Build de Produção** | `pnpm build` | **7/7 pacotes compilados** incluindo produção do Next.js 15 (16 páginas estáticas/dinâmicas + 23 módulos de API) | `RNF15` |

---

## 5. Como Executar e Demonstrar Localmente

```bash
pnpm install
pnpm db:generate
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm dev
```

- Acesse `http://localhost:3000/login` e clique em **"Preencher demo"** (ou use `ana@example.test` / `SenhaForte2026`).
- O modo local sem `DATABASE_URL` inicializa automaticamente o repositório em memória com dados sintéticos reproduzindo os cenários do wireframe (`Física I` em Exame Final, `Cálculo I` em Risco precisando de 6,7, `Algoritmos` com pesos incompletos e `Engenharia de Software` Aprovada com 7,4).
- Para executar com PostgreSQL 16 real: `docker compose up -d`, configure `DATABASE_URL` no `.env` (copiando `.env.example`) e rode `pnpm db:migrate`.
