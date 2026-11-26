# Plano de Testes, Casos de Liberação e Verificação SDD (`test-plan.md`)

> **Versão:** 1.1.0 · **Data:** 25/11/2026 · **Responsável:** Platform / LLMOps Engineer + Software Engineer + AI Engineer
> **Rastreabilidade:** [constitution.md](./constitution.md) (`C2`, `C3`, `C6`), [prd.md](./prd.md), [api-spec.md](./api-spec.md), [harness-spec.md](./harness-spec.md)

---

## 1. Pirâmide de Verificação e Limiares Bloqueantes (Gates de CI)

Nenhum Pull Request (humano ou de agente) pode ser mergeado em `main` e nenhuma tag de release (`R0`, `R1`, `R2`) pode ser promovida para produção se qualquer um dos limiares abaixo falhar:

| Camada | Ferramenta | Escopo | Limiar Mínimo (Gate Bloqueante) | Tempo Máx. Execução |
|---|---|---|---|---|
| **1. Estática e Tipos** | `ESLint` + `tsc --noEmit` | Todo o monorepo + regra que proíbe `number` nativo em `packages/domain` | `0` erros e `0` warnings críticos | `< 30 s` |
| **2. Segurança e PII** | `gitleaks` + `PiiAndSecretScanner` + `pnpm audit` | Commits, fixtures e dependências npm | `0` segredos, `0` PII real, `0` CVEs Críticas/Altas | `< 30 s` |
| **3. Unitários + Propriedades (Domínio)** | `Vitest` + `fast-check` (`1.000` runs por propriedade) | `packages/domain` (cálculo, arredondamento, substitutiva, exame, status) | **100% pass** e cobertura de linhas **>= 95%** (`RNF14`) | `< 15 s` |
| **4. Integração de API e Banco** | `Vitest` + PostgreSQL 16 em container efêmero | Todos os 35 endpoints (`E01`–`E35`), constraints SQL e transações | **100% pass** e cobertura geral **>= 80%** (`RNF15`) | `< 3 min` |
| **5. Autorização e Isolamento (IDOR)** | Suíte dedicada `idor.spec.ts` (`CT04`) | Usuário B tentando acessar/alterar recursos do Usuário A em todas as rotas | **100% de respostas `404 Not Found`** (`RNF09`) | `< 1 min` |
| **6. E2E e Acessibilidade** | `Playwright` + `@axe-core/playwright` | Jornada crítica completa em Chromium e WebKit (`360px` mobile e `1280px` desktop) | **100% pass** e `0` violações axe `serious`/`critical` (`RNF16`) | `< 5 min` |
| **7. Performance e Carga** | `k6` (contra `staging`) | `GET /painel` (`E31`) e `PUT /nota` (`E24`) com 50 VUs e volume máximo `RN14` | Leitura `p95 < 300ms`, Escrita `p95 < 500ms` (`RNF01`, `RNF02`) | `< 3 min` |
| **8. Evals do Harness de IA** | Suíte `harness/evals` (`EV01`–`EV04`) | Timeout, orçamento, qualidade de plano `M1` e bloqueio de path/PII | `EV01, EV02, EV04 = 100%`; `EV03 >= 80%` | `< 5 min` |

---

## 2. Os 8 Casos de Teste/Avaliação de Liberação Baseados em Evidência (Pág. 7 da Parte 2)

> A Parte 2 exige **pelo menos oito casos de teste/avaliação**: três de regras/aceite do produto, dois de autorização e isolamento, dois de falha/limite do harness e um de rastreabilidade/qualidade do agente.

| ID | Categoria | Requisito / Regra | Entrada Exata (Fixture Sintético) | Resultado Esperado Verificável | Método de Execução | Responsável pela Aprovação |
|---|---|---|---|---|---|---|
| **CT01** | **Regra de Produto (Média, Substitutiva e Exame Final)** | `RF09`, `RN06`, `RN19`, `RN20`, `RN21`, `CA09.1`, `CA09.5`, `CA09.6` | Disciplina `PONDERADA` (mínima `6,0`, exame `4,0`, pós-exame `5,0`):<br>• Caso 1A: `P1=8,0 (40)`, `P2=6,0 (40)`, `T=9,0 (20)`.<br>• Caso 1B: `P1=3,0 (40, elegível)`, `P2=7,0 (40, elegível)`, `T=5,0 (20, não elegível)` + `Substitutiva=6,5`.<br>• Caso 1C: `P1=4,0 (50)`, `P2=6,0 (50)` → média `5,0` (`EM_EXAME_FINAL`) + `Exame=5,0`. | • Caso 1A: `mediaFinal = 7.4`, `situacao = "APROVADO"`.<br>• Caso 1B: `P1` substituída por `6.5`, `mediaRegular = 6.4`, `situacao = "APROVADO"`.<br>• Caso 1C: `mediaPosExame = 5.0`, `situacao = "APROVADO_POS_EXAME"`. | Teste unitário em `packages/domain` + Teste de integração `GET /desempenho` (`E27`, `E32`, `E34`). | **Software Engineer** |
| **CT02** | **Regra de Produto (Precisão Decimal e Arredondamento)** | `RF10`, `RN07`, `CA10.1`, `CA10.2`, `CA10.3` | • Caso 2A: Pesos `33,33 / 33,33 / 33,34` e notas `7,0 / 8,0 / 9,0`.<br>• Caso 2B: Notas que geram média exata `6,9500` com `casasDecimais = 1`.<br>• Caso 2C: Notas que geram média exata `5,9499` com `casasDecimais = 1` e mínima `6,0`. | • Caso 2A: `mediaFinalExata = "8.0001"`, exibida `8.0` (sem ruído IEEE-754).<br>• Caso 2B: exibida `7.0` (`HALF_UP`).<br>• Caso 2C: exibida `5.9`, `situacao = "EM_EXAME_FINAL"` (comparação sobre valor arredondado exibido). | Teste unitário + `fast-check` (`packages/domain/test/rounding.spec.ts`). | **Platform Engineer** |
| **CT03** | **Aceite de Produto (Nota Necessária e Painel)** | `RF12`, `RF14`, `RF15`, `CA12.1`, `CA12.5`, `CA14.1` | Período com 3 disciplinas:<br>• `D1`: `P1=5,0 (40)` lançada, `P2 (40)` e `T (20)` pendentes, mínima `6,0`.<br>• `D2`: fechada com média `4,6` (`EM_EXAME_FINAL`).<br>• `D3`: pesos somando `80%` (`CONFIGURACAO_INCOMPLETA`). | • `D1`: `notaNecessaria.valor = 6.7` (`CEILING` de `6,666...`), `situacao = "EM_RISCO"`.<br>• `D2`: `notaNecessariaExame = 5.4`, `situacao = "EM_EXAME_FINAL"`.<br>• `GET /painel` retorna ordenação `[D2, D1, D3]` e UI exibe badge com ícone + texto (`axe-core` = 0 falhas). | Integração (`E28`, `E31`) + E2E Playwright com `axe-core`. | **FDE** |
| **CT04** | **Autorização e Isolamento de Dados (Zero IDOR)** | `RN01`, `RNF09`, `CA05.4`, `C3` | Usuário `A` (`ana@example.test`) cria período `P_A`, disciplina `D_A` e avaliação `A_A`. Usuário `B` (`bruno@example.test`) autenticado envia `GET`, `PATCH`, `PUT`, `DELETE` e `POST /simulacoes` usando os UUIDs `P_A`, `D_A` e `A_A`. | **100% das chamadas retornam HTTP `404 Not Found`** com corpo `code: "NAO_ENCONTRADO"`; estado dos recursos de `A` no banco permanece idêntico (`versao` inalterada). | Suíte automatizada `tests/security/idor.spec.ts` no CI. | **Platform Engineer** |
| **CT05** | **Autorização, Sessão, Bloqueio e CSRF** | `RF02`, `RNF07`, `RNF08`, `RNF10`, `CA02.2`, `CA02.4` | • Caso 5A: 5 logins com senha errada + 6ª tentativa com senha correta.<br>• Caso 5B: Apresentar um `refresh_token` já rotacionado (`reuso`).<br>• Caso 5C: Enviar `PUT /avaliacoes/{id}/nota` sem header `X-CSRF-Token`. | • Caso 5A: HTTP `423 CONTA_BLOQUEADA` + evento `CONTA_BLOQUEADA` em `evento_auditoria`.<br>• Caso 5B: HTTP `401` e todas as sessões da mesma `familia_id` marcadas com `revogada_em != NULL`.<br>• Caso 5C: HTTP `403 CSRF_INVALIDO`. | Teste de integração `tests/security/auth-csrf.spec.ts`. | **Software Engineer** |
| **CT06** | **Falha do Harness (Timeout e Máximo de Tentativas)** | `RNF23`, `C6`, `EV01` | • Caso 6A: Tarefa de teste onde a suíte Vitest falha nos 3 ciclos.<br>• Caso 6B: Chamada mockada ao modelo `M2` que excede `10 min`. | O harness interrompe exatamente no limite (3º ciclo ou 10 min), salva checkpoint no SQLite, grava status `ESCALATED` em `decisions.jsonl`, **não abre PR** e aciona notificação ao responsável humano. | Execução automatizada do eval `EV01` em `.github/workflows/harness-evals.yml`. | **AI Engineer** |
| **CT07** | **Limite Financeiro e de Escopo do Harness** | `RNF22`, `RNF23`, `C4`, `C6`, `EV02`, `EV04` | • Caso 7A: Tarefa iniciada com `maxBudgetUsd = 0.10`.<br>• Caso 7B: Agente `M2` tenta executar `write_file(".github/workflows/ci.yml")`.<br>• Caso 7C: Contexto contém CPF e e-mail real fora de `@example.test`. | • Caso 7A: `BudgetCircuitBreaker` aborta execução ao atingir `US$ 0,10`.<br>• Caso 7B: `PathGuard` bloqueia escrita com `POLICY_VIOLATION`.<br>• Caso 7C: `PiiAndSecretScanner` bloqueia request antes de sair para a internet. | Execução automatizada dos evals `EV02` e `EV04`. | **AI Engineer** |
| **CT08** | **Rastreabilidade e Qualidade da Saída do Agente** | `C1`, `C5`, `C7`, `EV03` | Pull Request real gerado pelo harness para a tarefa `T33` (ou `T06`). | O script do CI verifica que: (1) o PR contém ID `Txx`, `RFxx`, versão da spec `v1.1.0`, custo em US$ e log de testes; (2) 100% dos arquivos no `git diff` pertencem a `paths_permitidos` de `T33`; (3) há aprovação humana de um `CODEOWNER`. | Job `verify-agent-pr` no GitHub Actions + revisão humana. | **AI Engineer** + **Software Engineer** |

---

## 3. Propriedades Matemáticas Invariantes (`fast-check` em `packages/domain`)

Para garantir `RNF14` (0 divergências de cálculo), a suíte `packages/domain/test/properties.spec.ts` testa `1.000` combinações aleatórias por propriedade:

1. **Invariante de Limites (`P1`):** Para qualquer conjunto válido de notas `∈ [0, 10]` e pesos `> 0` com soma `100`, `mediaParcial`, `mediaRegular` e `mediaPosExame` pertencem sempre ao intervalo `[0, 10]`.
2. **Invariante de Equivalência (`P2`):** O cálculo no método `SIMPLES` para `n` avaliações produz exatamente o mesmo valor que o método `PONDERADA` quando todas as `n` avaliações possuem peso igual a `100 / n`.
3. **Invariante de Monotonicidade (`P3`):** Aumentar a nota de qualquer avaliação regular (mantendo as demais constantes) **nunca diminui** `pontosAcumulados` nem `mediaRegular`.
4. **Invariante de Não-Prejuízo da Substitutiva (`P4` — `RN19`):** Para qualquer configuração de notas regulares e qualquer `notaSubstitutiva ∈ [0, 10]`, `mediaRegularComSubstitutiva >= mediaRegularSemSubstitutiva`.
5. **Invariante de Conservadorismo da Nota Necessária (`P5` — `RN10`):** Se `notaNecessaria.status === "NECESSARIA"` com valor arredondado `x`, então atribuir a nota `x` a todas as avaliações pendentes resulta obrigatoriamente em `mediaFinalExibida >= notaAlvo`.
6. **Invariante de Nota Pendente (`P6` — `RN05`):** Uma avaliação com `nota = null` produz resultado diferente de `nota = 0` na `mediaParcial` sempre que a média das demais avaliações lançadas for `> 0`.
