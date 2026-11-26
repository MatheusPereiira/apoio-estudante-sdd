# Plataforma de Apoio ao Estudante Universitário — SDD + Agent Harness Engineering

> **Status Atual:** `spec-v1.1.0` (Especificação SDD 100% Concluída — Marco Zero-Código)
> **Metodologia:** Spec-Driven Development (GitHub Spec Kit) + Agent Harness Engineering (LangGraph Deep Agents) + Política de Múltiplas LLMs (`OpenAI gpt-5`, `Anthropic claude-sonnet-4-5`, `Google gemini-2.5-flash`).

---

## 1. Visão Geral do Projeto

A **Plataforma de Apoio ao Estudante Universitário** resolve a falta de previsibilidade acadêmica dos estudantes de graduação ao longo do semestre. Através de três funcionalidades integradas (**F1**, **F2** e **F3**) com isolamento estrito por estudante (**Pré-requisito C / LGPD**), o aluno modela os critérios de cada disciplina, lança suas notas (regulares, **Prova Substitutiva** e **Exame Final**) com precisão decimal exata e descobre em tempo real sua situação e **quanto precisa tirar** nas avaliações restantes.

---

## 2. Índice Completo da Documentação Técnica (`docs/`)

Toda a engenharia deste repositório é orientada pelas especificações versionadas abaixo (Princípio `C1` da Constituição):

### Governança e Alinhamento Inicial
- [**`docs/constitution.md`**](./docs/constitution.md) — **Constituição do Projeto:** Os 8 princípios inegociáveis (`C1`–`C8`), política de dados/segredos para LLMs, matriz `CODEOWNERS` e autoridades de release.
- [**`docs/pre-game.md`**](./docs/pre-game.md) — **Pré-Game Individual e Decisões:** Os 4 registros individuais (*FDE*, *AI Engineer*, *Software Engineer*, *Platform / LLMOps*) aplicados ao projeto com citações das fontes de mercado (*GitHub Spec Kit, Sequoia/Harrison Chase, Anthropic Effective Harnesses, Stripe Minions e OpenAI Harness Engineering*).

### Produto, Regras de Negócio e Interface
- [**`docs/prd.md`**](./docs/prd.md) — **Product Requirements Document (`spec.md`):** 21 Regras de Negócio (`RN01`–`RN21`, incluindo Substitutiva e Exame Final), 15 Requisitos Funcionais (`RF01`–`RF15`) com critérios *Given/When/Then*, 24 Requisitos Não Funcionais mensuráveis (`RNF01`–`RNF24`), escopo do MVP e matriz de lacunas resolvidas.
- [**`docs/ui-ux-spec.md`**](./docs/ui-ux-spec.md) — **Especificação de UI/UX e Acessibilidade:** Fluxo de navegação, regra das 3 interações, tokens visuais dos 12 estados de situação da disciplina (WCAG 2.1 AA) e wireframes ASCII mobile-first.

### Arquitetura, Dados e Contratos de API
- [**`docs/architecture.md`**](./docs/architecture.md) — **Arquitetura e Stack (`plan.md`):** Justificativa da stack (Next.js 15 + TypeScript + `@app/domain` Decimal.js + Prisma + PostgreSQL 16 + Upstash Redis), Visão A (Aplicação Entregue) e Visão B (Engenharia com IA).
- **Architecture Decision Records (`docs/adr/`):**
  - [**`docs/adr/adr-001-harness.md`**](./docs/adr/adr-001-harness.md) — Adoção e extensão do LangChain Deep Agents (LangGraph).
  - [**`docs/adr/adr-002-llms.md`**](./docs/adr/adr-002-llms.md) — Política de 3 LLMs segregadas por papel e provedor.
  - [**`docs/adr/adr-003-operacao.md`**](./docs/adr/adr-003-operacao.md) — Monólito modular serverless e estratégia de operação/rollback.
- [**`docs/data-model.md`**](./docs/data-model.md) — **Modelagem de Dados:** Diagrama Entidade-Relacionamento (DER) em Mermaid + dicionário completo das 7 tabelas PostgreSQL, índices, constraints e triggers.
- [**`docs/api-spec.md`**](./docs/api-spec.md) — **Contratos e Endpoints REST:** Especificação completa de 35 endpoints (`E01`–`E35`), autenticação JWT + Refresh rotativo + CSRF, Problem Details (RFC 9457) e payloads JSON.

### Harness de Engenharia com IA, Qualidade e Viabilidade Financeira
- [**`docs/harness-spec.md`**](./docs/harness-spec.md) — **Especificação do Harness e Múltiplas LLMs:** Contrato operacional em 4 blocos, matriz dos 3 modelos (`M1`, `M2`, `M3`), 4 Evals automatizados (`EV01`–`EV04`) e **Simulação Ponta a Ponta da Tarefa `T33` (com falha no Ciclo 1, triagem por `M3` e recuperação no Ciclo 2)**.
- [**`docs/test-plan.md`**](./docs/test-plan.md) — **Plano de Testes e Liberação Baseada em Evidência:** Pirâmide de verificação, os **8 Casos de Teste obrigatórios (`CT01`–`CT08`)** e as **6 Propriedades Matemáticas Invariantes (`fast-check`)**.
- [**`docs/tasks.md`**](./docs/tasks.md) — **Plano de Implementação e Release Plan:** Alocação da equipe (`156h / 160h`), 8 Épicos, 54 tarefas atômicas (`T00`–`T53`), grafo de caminho crítico, Releases `R0`, `R1` e `R2`, e análise de mudança de requisito (`MR-01`: Controle de Frequência/Faltas `< 75%`).
- [**`docs/budget-and-changes.md`**](./docs/budget-and-changes.md) & [**`docs/budget.csv`**](./docs/budget.csv) — **Orçamento Detalhado e Planilha com Fórmulas:** Memória de cálculo Parte 1 (`R$ 18.150,00`) vs. Parte 2 (`R$ 25.609,17` construção c/ reserva + `R$ 4.380,00` operação 3 meses), sensibilidade a `+50% tokens` (`R$ 26.352,25`), planilha CSV com fórmulas explícitas e matriz dos **4 Eventos de Replanejamento**.

---

## 3. Equipe e Papéis (Simulação Parte 2)

| Papel | Responsabilidade Central | Taxa Simulada | Horas Alocadas |
|---|---|---|---|
| **FDE / Produto e Implantação** | Descoberta com a faculdade, especificação SDD, piloto e aceite de releases | R$ 140/h | 38 h / 40 h |
| **AI Engineer / Harness** | Orquestração LangGraph, roteamento M1/M2/M3, contexto, limites e evals `EV01`–`EV04` | R$ 160/h | 39 h / 40 h |
| **Software Engineer / Integrações** | Arquitetura da aplicação, motor `@app/domain`, APIs, banco e code review técnico | R$ 110/h | 40 h / 40 h |
| **Platform / LLMOps e Qualidade** | Sandbox isolado, CI/CD, observabilidade, suíte IDOR, testes de carga e rollback | R$ 130/h | 39 h / 40 h |
