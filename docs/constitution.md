# Constituição do Projeto (`constitution.md`)

> **Versão:** 1.1.0 · **Data:** 25/11/2026 · **Padrão:** GitHub Spec Kit (`constitution.md`)
> **Escopo:** Princípios inegociáveis de arquitetura, qualidade, privacidade de dados, operação de agentes de IA e governança de releases para a **Plataforma de Apoio ao Estudante Universitário**.

---

## 1. Propósito

Esta Constituição define as **regras invariantes** que tanto os **4 engenheiros humanos** quanto os **agentes de IA executados no Harness** devem obedecer. Nenhum Pull Request, prompt de agente ou decisão de escopo pode violar os princípios abaixo sem antes aprovar uma emenda explícita a este documento assinada pelos 4 papéis do grupo.

---

## 2. Os 8 Princípios Inegociáveis

| Código | Princípio | Regra Operacional Verificável | Mecanismo de Bloqueio (Gate) |
|---|---|---|---|
| **C1** | **A Especificação é a Fonte da Verdade** | Nenhum código de aplicação é escrito ou alterado sem um requisito (`RFxx`/`RNFxx`/`RNxx`) e uma tarefa (`Txx`) correspondentes em `docs/`. Mudanças de regra de negócio exigem atualização prévia ou simultânea dos arquivos `prd.md`, `data-model.md`, `api-spec.md` e `tasks.md`. | Template de PR obrigatório + verificação automática no CI que exige referência a `RFxx`, `Txx` e versão semântica da spec. |
| **C2** | **Aritmética Decimal Exata no Domínio** | Todo cálculo de notas, pesos, médias parciais/finais, prova substitutiva, exame final e nota necessária **deve** utilizar `decimal.js` dentro de `packages/domain`. É estritamente proibido usar ponto flutuante binário (`number` nativo do JS) para operações aritméticas acadêmicas. | Regra de linter customizada + testes de propriedade (`fast-check`, `CT02`) com cobertura `>= 95%` em `packages/domain`. |
| **C3** | **Isolamento Absoluto por Estudante (Zero IDOR)** | Toda entidade acadêmica pertence a um único `usuario_id` (`RN01`). Nenhum método de repositório pode buscar ou modificar registros sem receber `usuarioId` como parâmetro obrigatório. Recursos de terceiros devem retornar `404 Not Found` (nunca `403`). | Suíte automatizada de testes IDOR (`CT04`) com 2 usuários sintéticos testando todos os endpoints autenticados no CI. |
| **C4** | **Dados Reais Nunca Saem do Perímetro para LLMs** | É proibido enviar dados pessoais (PII) ou dados acadêmicos reais de estudantes para provedores de LLM (`OpenAI`, `Anthropic`, `Google`) ou logs externos (`RN18`, `RNF22`). Agentes operam **exclusivamente** sobre código-fonte, especificações e *fixtures* sintéticos (`@example.test`). | Scanner determinístico de PII (regex CPF/e-mail real + `gitleaks`) executado pelo Harness antes de cada chamada LLM e no CI. |
| **C5** | **Agentes Propõem, Humanos Aprovam e Respondem** | Agentes de IA (`M1`, `M2`, `M3`) atuam em sandbox isolado com permissão restrita a `paths_permitidos` da tarefa e só podem abrir Pull Requests. **Revisão por outra LLM (`M1`) não comprova correção.** Todo merge em `main` exige aprovação humana do `CODEOWNER`. | Branch protection no GitHub exigindo CI 100% verde + 1 aprovação humana do dono da área (`CODEOWNERS`). |
| **C6** | **Limites Rígidos de Execução e Orçamento do Harness** | Toda execução de agente está sujeita a limites estritos: timeout de **10 min/chamada** e **30 min/tarefa**, máximo de **3 ciclos** executor→testes, teto de **1,5M tokens de entrada / 120k saída** e **US$ 8,00 por tarefa** (teto semanal de **US$ 90,00**). Ao atingir qualquer limite, o agente **para e escala** para o humano. | Middleware de orçamento e *circuit breaker* no Harness (`EV01`, `EV02`, `CT06`, `CT07`). |
| **C7** | **Simplicidade Arquitetural (Monólito Modular)** | O sistema deve ser entregue como um monólito modular TypeScript (`Next.js App Router + Route Handlers + Prisma + PostgreSQL`) dentro da capacidade máxima de **160 horas-pessoa**. Nenhum microsserviço, fila externa ou novo provedor de IA pode ser adicionado sem um ADR aprovado. | Revisão de arquitetura pelo *Software Engineer* e *AI Engineer*. |
| **C8** | **Responsabilidade Nominal por Release e Rollback** | Cada incremento possui dono humano explícito e estratégia de rollback testada em `< 5 minutos`. O *Platform / LLMOps Engineer* possui autoridade para executar rollback imediato em produção em caso de incidente de segurança ou indisponibilidade, sem aguardar comitê. | Runbook de release e ensaio obrigatório de rollback + restauração PITR (`T53`) antes do Go-Live (`R2`). |

---

## 3. Política de Dados e Segredos

1. **Classificação de Dados:**
   - **Públicos / Sintéticos:** Código-fonte, documentação `docs/`, seeds com domínio `@example.test`. **Permitidos** no contexto das LLMs.
   - **Dados Pessoais e Acadêmicos Reais (Produção/Piloto):** Nome, e-mail real, hashes de senha, notas e histórico real dos estudantes. **Proibidos** em ambientes `local`, `preview`, `staging` e em qualquer chamada de LLM.
   - **Segredos de Infraestrutura:** `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`. Nunca entram no container de sandbox onde o agente `M2` executa código.
2. **Direitos LGPD (`RF03`, `RN17`):**
   - O estudante pode exportar 100% dos seus dados em JSON (`GET /api/v1/me/export`) e excluir definitivamente sua conta (`DELETE /api/v1/me`) com remoção em cascata (`ON DELETE CASCADE`).

---

## 4. Governança de Mudanças e Matriz `CODEOWNERS`

| Diretório / Artefato | Responsável Primário (`CODEOWNER`) | Aprovação Exigida para Mudança |
|---|---|---|
| `docs/constitution.md` | Todos os 4 integrantes | Consenso dos 4 papéis |
| `docs/prd.md`, `docs/ui-ux-spec.md`, `docs/pre-game.md` | **FDE** (Produto e Implantação) | FDE + Software Engineer |
| `docs/harness-spec.md`, `harness/**`, `docs/adr/adr-001*`, `adr-002*` | **AI Engineer** (Harness) | AI Engineer + Platform |
| `packages/domain/**`, `packages/application/**`, `packages/contracts/**`, `apps/web/**`, `docs/data-model.md`, `docs/api-spec.md` | **Software Engineer** (Integrações) | Software Engineer |
| `packages/db/**`, `.github/workflows/**`, `.devcontainer/**`, `docs/test-plan.md`, `docs/adr/adr-003*` | **Platform / LLMOps** (Qualidade) | Platform + Software Engineer |
| `docs/tasks.md`, `docs/budget-and-changes.md`, `docs/budget.csv` | **FDE** + **Platform** | FDE + AI Engineer |

---

## 5. Autoridade de Liberação de Releases

| Incremento | Janela | Aprovador Final | Critério Obrigatório de Saída |
|---|---|---|---|
| **R0 — Base Técnica** | Fim da Semana 1 | **AI Engineer** | Harness operacional no sandbox, fluxo vertical `GET /health` entregue via PR de agente, `EV01` aprovado. |
| **R1 — Piloto** | Fim da Semana 2 | **FDE** | `F1` completa em produção para 5–15 estudantes piloto, `CT04` (IDOR) e `CT05` (Auth) 100% verdes, Termos LGPD publicados. |
| **R2 — Entrega do Recorte** | Fim da Semana 4 | **FDE** (Produto) + **Platform** (Operação) | `F1 + F2 + F3` (com Substitutiva e Exame Final) integradas, `CT01`–`CT08` e `EV01`–`EV04` 100% verdes, backup PITR testado. |
