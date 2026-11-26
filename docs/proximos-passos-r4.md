# Plano da Próxima Etapa e Roteiro para Entrega Final (R4 — 03/12/2026)

> **Projeto:** Plataforma de Apoio ao Estudante Universitário (SDD + Agent Harness Engineering)
> **Referência Anterior:** [registro-entregas-r0-r2.md](./registro-entregas-r0-r2.md) (Base R0–R2 concluída em `main`)
> **Prazo da Entrega Final (R4 — Avaliação Substitutiva da Prova):** **03/12/2026**
> **Objetivo:** Transformar a base implementada e testada localmente em uma entrega final completa, implantada em ambiente real, validada com evidências de operação/piloto e pronta para apresentação executiva e técnica.

---

## 1. Visão Geral do que Falta para Fechar 100% da R4

A implementação do código-fonte, dos testes automatizados (`CT01`–`CT08` e `EV01`–`EV04`) e do CI já está concluída na `main`. A próxima etapa foca em **operação real, validação externa, fechamento das lacunas documentais e preparação da apresentação final**:

| Frente | Objetivo Principal | Tarefas (`tasks.md`) | Responsável Principal | Prioridade |
|---|---|---|---|---|
| **1. Infraestrutura, Banco Real e Deploy** | Subir PostgreSQL 16 (Neon) + Vercel (`staging` e `production`), aplicar migrações via CI e validar observabilidade | `T22`, `T23`, `T53` | Platform / LLMOps | **Alta (Crítica)** |
| **2. Qualidade em Ambiente Real (E2E, Carga, Segurança)** | Executar Playwright + `axe-core`, teste de carga `k6`, checklist OWASP ASVS L1, ensaio de rollback (< 5 min) e restauração PITR | `T37`, `T38`, `T52`, `T53` | Platform + SW Eng. | **Alta (Crítica)** |
| **3. Refinamentos de Produto e Piloto Real** | Completar tela de edição de critérios com modal comparativo `E30`, rodar piloto com 5–15 estudantes e consolidar feedback | `T13`, `T14`, `T15`, `T27`, `T28`, `T40` | FDE + SW Eng. | **Alta** |
| **4. Governança, Custos e Harness (Lacunas L-12/L-13)** | Atualizar links/datas oficiais de preços de LLM e câmbio, gerar relatório final de evidências (`T45`) e runbook (`T46`) | `T29`, `T39`, `T45`, `T46` | AI Engineer + FDE | **Média-Alta** |
| **5. Mudança de Requisito (`MR-01` — Frequência/Faltas)** | Manter branch/plano pronto para implementar `RN22`/`RN23`/`RF16` caso o professor solicite execução prática na R4 | `T43` + `MR-01` | Equipe (4 papéis) | **Condicional** |
| **6. Apresentação Final e Release `v1.0.0`** | Consolidar slides/roteiro de demonstração ao vivo, revisar histórico de commits de todos os integrantes e publicar tag `v1.0.0` | `T41`, `T42`, `T53` | Todos os 4 papéis | **Alta (Crítica)** |

---

## 2. Plano de Ação Detalhado por Frente

### Frente 1 — Deploy em Nuvem, PostgreSQL 16 e Observabilidade (`T22`, `T23`, `T53`)
1. **Banco PostgreSQL 16 (Neon — `sa-east-1`):**
   - Criar projeto Neon com branches `staging` e `main` (habilitar PITR de 7 dias conforme `RNF05`).
   - Configurar `DATABASE_URL` (usuário de aplicação sem DDL) e `DIRECT_URL`/usuário de migração nos *Secrets* do GitHub Actions e da Vercel.
   - Executar `pnpm db:migrate` e `pnpm db:seed` em `staging` e confirmar a criação das 7 tabelas + constraint trigger `trg_validar_soma_pesos`.
2. **Hospedagem Web (Vercel — `gru1`):**
   - Conectar o repositório `MatheusPereiira/apoio-estudante-sdd` na Vercel com Root Directory configurado para o monorepo (`apps/web`).
   - Configurar variáveis obrigatórias (`JWT_SECRET` ≥ 32 bytes aleatórios, `IP_HASH_SALT`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_DSN`).
   - Validar `GET https://<dominio>/api/v1/health` retornando HTTP `200` com `"banco": "ok"`.
3. **Observabilidade e Alertas (`RNF04`, `RNF19`):**
   - Configurar monitor de uptime (Better Stack ou UptimeRobot) checando `/api/v1/health` a cada 1 minuto.
   - Integrar `@sentry/nextjs` com `sendDefaultPii: false` e disparar um erro controlado em `staging` para comprovar captura em `< 5 min` sem e-mail/PII no payload.

### Frente 2 — Evidências de Qualidade, Performance, Segurança e Rollback (`T37`, `T38`, `T52`, `T53`)
1. **E2E e Acessibilidade WCAG 2.1 AA (`T52`):**
   - Instalar `@playwright/test` e `@axe-core/playwright` em `apps/web` e rodar [critical-flow.spec.ts](../apps/web/tests/e2e/critical-flow.spec.ts) contra `staging` em Chromium e WebKit (`360px` mobile e `1280px` desktop).
   - Exportar o relatório HTML do Playwright + resultado `0` violações `serious/critical` do `axe-core` como evidência da R4.
2. **Teste de Carga `k6` (`T38` — `RNF01`, `RNF02`):**
   - Expandir [load-test.js](../apps/web/tests/perf/load-test.js) para autenticar um usuário sintético `@example.test` com volume máximo (`15 disciplinas × 20 avaliações`), medir `GET /painel` (`p95 < 300 ms`) e `PUT /nota` (`p95 < 500 ms`) com 50 VUs.
   - Anexar o print/resumo das métricas `p95` e `p99` no dossiê da R4.
3. **Segurança OWASP ASVS L1 (`T37`):**
   - Rodar `pnpm audit` e `gitleaks` no CI; validar headers HTTP em produção (`HSTS`, `CSP`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) usando `curl -I`.
   - Ativar *Branch Protection* na `main` exigindo CI verde + aprovação humana de `CODEOWNER` (`C5`).
4. **Ensaio Obrigatório de Rollback e PITR (`T53` — `C8`, `RNF05`):**
   - Simular um deploy defeituoso em `staging`, executar *"Promote previous deployment"* na Vercel e cronometrar o retorno (`meta < 5 min`).
   - Testar restauração Point-in-Time Recovery (PITR) em branch efêmero do Neon e registrar a evidência (data/hora e duração) em `docs/runbook-operacao.md`.

### Frente 3 — Evoluções de UI/UX e Piloto com Estudantes (`T13`–`T15`, `T27`, `T28`, `T40`)
1. **Melhorias incrementais de UI em `apps/web` (excelentes tarefas para commits dos demais integrantes):**
   - **Modal de Edição de Critérios com Prévia (`RF07` / `CA07.1`):** conectar botão *"Editar Critérios"* em `apps/web/src/app/(app)/disciplinas/[disciplinaId]/page.tsx` ao endpoint `POST /api/v1/disciplinas/{id}/previa-criterios` (`E30`), exibindo o comparativo *"Média/Situação Antes vs. Depois"* antes de enviar `PATCH` com `confirmar: true`.
   - **Página de Termos de Uso e Política de Privacidade (`T13` / `/termos`):** publicar o texto oficial da versão `2026-11` acessível a partir da tela `/cadastro`.
   - **Guia Rápido / FAQ (`T42`):** adicionar página `/ajuda` explicando arredondamento `HALF_UP`, Prova Substitutiva (`RN19`) e Exame Final (`RN20`/`RN21`).
   - **Reordenação de Avaliações (`E23`):** adicionar botões ↑/↓ na tabela de avaliações conectando ao endpoint `PUT /avaliacoes/ordem`.
2. **Piloto Controlado (`T14`, `T28`):**
   - Convidar 5 a 15 colegas/estudantes para usar o ambiente `staging`/`production` com formulário curto (nota 1–5 de satisfação, tempo para cadastrar 1 disciplina + 3 avaliações + 1 nota, e relato de qualquer divergência de cálculo).
   - Registrar os resultados anonimizados (sem PII!) em um changelog `spec-v1.1.1` ou `spec-v1.2.0`.

### Frente 4 — Fechamento Documental do Harness, Custos e Evals (`T29`, `T39`, `T45`, `T46`)
1. **Atualizar Lacunas `L-12` e `L-13` em `docs/budget-and-changes.md`, `docs/budget.csv` e `docs/tasks.md`:**
   - Consultar os preços vigentes oficiais de `OpenAI API`, `Anthropic Claude API` e `Google Gemini API` e preencher a data exata e os links oficiais nas tabelas de orçamento.
   - Registrar a cotação oficial do dólar (PTAX/BCB) usada no cálculo.
2. **Relatório de Evidências de Liberação (`T45`):**
   - Criar `docs/release-evidence-v1.0.0.md` consolidando a saída real dos 8 casos obrigatórios (`CT01`–`CT08`) e dos 4 evals (`EV01`–`EV04`), além dos links das execuções verdes no GitHub Actions.
3. **Runbook Operacional e do Harness (`T46`):**
   - Criar `docs/runbook-operacao.md` documentando retomada de checkpoint, rotação de chaves LLM, fallback `M2 → M3`, restauração PITR e procedimento de rollback em `< 5 min`.

### Frente 5 — Preparação para Mudança de Requisito `MR-01` (Contingência)
Caso o professor solicite demonstrar uma mudança de escopo na R4, o cenário oficial já está especificado em `docs/tasks.md` §8.1 (**Controle de Frequência e Reprovação por Falta `< 75%`**):
- Adicionar colunas `carga_horaria_aulas`, `faltas_registradas` e `frequencia_minima_pct` em `packages/db` + migração expand-only.
- Adicionar regras `RN22`/`RN23` e estados `REPROVADO_POR_FALTA` / badge `RISCO_POR_FALTA` em `packages/domain` + testes `fast-check`.
- Expor `PUT /api/v1/disciplinas/{id}/faltas` e contador rápido `-/+` no card do painel.

---

## 3. Fluxo Git Obrigatório para Todos os Integrantes (Critério de Nota)

Para demonstrar gestão ágil real com participação de toda a equipe no histórico do repositório:

1. Cada integrante cria sua própria branch a partir de `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/<nome>-<tarefa>
   ```
   Exemplos:
   - `feat/matheus-modal-criterios-e30`
   - `feat/integrante3-pagina-termos-faq`
   - `feat/integrante4-playwright-k6-staging`
2. Realizar commits pequenos no padrão **Conventional Commits** referenciando `Txx` e `RFxx`/`RNFxx` (ex.: `feat(web): modal de previa de criterios E30 (T35, RF07)`).
3. Abrir **Pull Request** usando `.github/pull_request_template.md`, aguardar o CI (`ci.yml` + `harness-evals.yml`) ficar **100% verde**, obter **aprovação de outro integrante (CODEOWNER)** e fazer merge em `develop` → `main`.
4. Ao concluir todas as evidências da R4, publicar a tag de release oficial:
   ```bash
   git checkout main && git pull origin main
   git tag -a v1.0.0 -m "Release R4 — Entrega Final Plataforma de Apoio ao Estudante"
   git push origin v1.0.0
   ```

---

## 4. Cronograma Sugerido até a Entrega Final (27/11 a 03/12/2026)

| Data | Marco / Foco | Entregas Esperadas no Git |
|---|---|---|
| **27/11 (Sex)** | **Deploy & Banco Real** | Neon PostgreSQL 16 + Vercel `staging` online; `GET /api/v1/health` 200; CI verde em PRs reais; Branch Protection ativada |
| **28/11 (Sáb)** | **UI Complementar & LGPD** | PRs dos demais integrantes: modal de edição de critérios (`E30`), página `/termos`, página `/ajuda` (FAQ) e reordenação `E23` |
| **29/11 (Dom)** | **Qualidade & Carga** | Execução Playwright + `axe-core` (`T52`), teste `k6` em `staging` (`T38`), revisão OWASP ASVS L1 (`T37`) e ensaio de rollback + PITR (`T53`) |
| **30/11 (Seg)** | **Piloto & Métricas** | Piloto com 5–15 estudantes (`T14`), coleta de formulário de satisfação e registro de melhorias/correções (`T28`, `T50`) |
| **01/12 (Ter)** | **Custos, Evals & Runbook** | Atualização de cotações `L-12`/`L-13` em `budget.csv`, criação de `docs/release-evidence-v1.0.0.md` (`T45`) e `docs/runbook-operacao.md` (`T46`) |
| **02/12 (Qua)** | **Freeze & Ensaio R4** | Merge final `develop` → `main`, tag `v1.0.0`, verificação final do `release.yml` e ensaio cronometrado da apresentação |
| **03/12 (Qui)** | **Apresentação Final (R4)** | Demonstração ao vivo + entrega consolidada (avaliação final substitutiva da prova) |

---

## 5. Roteiro Sugerido para a Apresentação Final (R4 — 03/12)

1. **Abertura e Metodologia SDD (2 min — FDE):** problema dos estudantes, Constituição (`C1`–`C8`), recorte `F1`/`F2`/`F3` e governança por especificação versionada.
2. **Demonstração ao Vivo do Sistema (3 min — Software Engineer):**
   - Login na conta demo (`ana@example.test`), mostrar o Painel ordenado por criticidade (`Em Exame Final`, `Em Risco`, `Pesos Incompletos`, `Aprovado`).
   - Lançar nota em ≤ 3 interações com vírgula decimal (`7,5`) e mostrar recálculo imediato.
   - Abrir Simulador "E se?", Prova Substitutiva (`RN19`), Exame Final (`RN20`/`RN21`), Histórico Imutável (`RF11`) e Exportação LGPD (`RF03`).
3. **Arquitetura de IA, Harness e Evals (2 min — AI Engineer):** mostrar `M1`/`M2`/`M3`, `PathGuard`, `PiiAndSecretScanner`, `BudgetCircuitBreaker` e a simulação da tarefa `T33` (Ciclo 1 falha → triagem `M3` → Ciclo 2 sucesso).
4. **Qualidade, Segurança, Custos e Versionamento (3 min — Platform / LLMOps):** mostrar o grafo Git com commits de toda a equipe, GitHub Actions verde (`CT01`–`CT08` + `EV01`–`EV04`), 95% de cobertura + 6.000 execuções `fast-check`, orçamento atualizado e plano de contingência/rollback (`< 5 min`).
