# Orçamento Detalhado, Viabilidade Financeira e Análise de Mudanças (`budget-and-changes.md`)

> **Versão:** 1.1.0 · **Data:** 25/11/2026 · **Responsável:** FDE + Platform / LLMOps Engineer + AI Engineer
> **Rastreabilidade:** [tasks.md](./tasks.md), [harness-spec.md](./harness-spec.md), Planilha editável com fórmulas: [budget.csv](./budget.csv)

---

## 1. Premissas Financeiras e Cotações de Catálogo (Pág. 8 da Parte 2)

| Parâmetro | Valor Adotado | Tipo (Catálogo vs. Hipótese) | Fonte / Condição e Data de Referência |
|---|---|---|---|
| **Janela do projeto** | `4 semanas` (`1 mês` simulado) | Premissa fixa do PDF | `Trabalho_SDD_Custos_Plataforma_Estudantil.pdf` (pág. 2) e `Parte_2` (pág. 7) |
| **Capacidade máxima da equipe** | `160 horas-pessoa` (`4 pessoas × 10h/sem × 4 sem`) | Premissa fixa do PDF | Alocado no baseline: **156 h** (folga operacional de **4 h**) |
| **Taxa Parte 1 (Uniforme)** | `R$ 100,00 / h` (com encargos) | Premissa fixa da Parte 1 | Usada no demonstrativo comparativo da Parte 1 (§2) |
| **Taxas Parte 2 (Por Papel)** | • FDE: `R$ 140/h`<br>• AI Engineer: `R$ 160/h`<br>• Software Engineer: `R$ 110/h`<br>• Platform / LLMOps: `R$ 130/h` | Premissa fixa da Parte 2 | `Parte_2_SDD_Harness_Arquitetura_IA.pdf` (pág. 7) |
| **Licenças de ferramentas de IA (IDE/Seat)** | `R$ 600,00 / mês` (para os 4 integrantes) | Premissa fixa da Parte 1 | **Não inclui consumo de API do Harness**, que é contabilizado à parte por milhão de tokens |
| **Infraestrutura de dev/testes (construção)** | `R$ 300,00 / mês` | Premissa fixa da Parte 1 | Cobre sandbox, CI/CD, branches de preview do Neon/Vercel durante as 4 semanas |
| **Reserva para imprevistos** | `10%` sobre o custo-base de construção | Premissa fixa dos PDFs | Apresentada em linha separada (`Construção com reserva = Base × 1,10`) |
| **Câmbio e Tributos (API Internacional)** | `R$ 5,50 / US$ 1,00` + `IOF de 3,5%` (fator `R$ 5,6925 / US$`) | **Hipótese explícita** | Cotação de referência datada em **12/11/2026** (data do material de apoio da Parte 2) |
| **Preço `M1` (`OpenAI gpt-5`)** | Entrada: `US$ 1,25 / 1M tok` · Saída: `US$ 10,00 / 1M tok` | **Catálogo datado (12/11/2026)** | Fonte: `https://openai.com/api/pricing/` |
| **Preço `M2` (`Anthropic claude-sonnet-4-5`)** | Entrada: `US$ 3,00 / 1M tok` · Saída: `US$ 15,00 / 1M tok` | **Catálogo datado (12/11/2026)** | Fonte: `https://www.anthropic.com/pricing#anthropic-api` |
| **Preço `M3` (`Google gemini-2.5-flash`)** | Entrada: `US$ 0,30 / 1M tok` · Saída: `US$ 2,50 / 1M tok` | **Catálogo datado (12/11/2026)** | Fonte: `https://ai.google.dev/pricing` |
| **Infraestrutura de Produção (Operação)** | Vercel Pro (`US$ 20`) + Neon Launch (`US$ 19`) + Domínio/Logs (`~US$ 22`) = `R$ 350,00 / mês` | **Catálogo + margem** | Fontes: `https://vercel.com/pricing`, `https://neon.tech/pricing` (`Sentry` e `Upstash` no tier gratuito para volume piloto) |

---

## 2. Orçamento Comparativo: Modelo Parte 1 vs. Modelo Parte 2

### 2.1 Fechamento no Modelo da Parte 1 (Taxa Uniforme de R$ 100/h)

| Bloco | Horas | Custo Mão de Obra (R$ 100/h) | Custos Compartilhados (IA + Infra) | Subtotal (R$) |
|---|---|---|---|---|
| **F1 — Disciplinas e Critérios** (`T12, T15, T18..T21, T25`) | 16 h | R$ 1.600,00 | — | R$ 1.600,00 |
| **F2 — Notas, Média, Substitutiva e Exame** (`T27, ½T26, ½T30, T33..T36`) | 17 h | R$ 1.700,00 | — | R$ 1.700,00 |
| **F3 — Simulador e Painel** (`T40, ½T26, ½T30, T47, T48, T51`) | 13 h | R$ 1.300,00 | — | R$ 1.300,00 |
| **Atividades Compartilhadas** (Spec, Setup, Harness, Auth/LGPD, CI, E2E, Deploy, Coordenação) | 110 h | R$ 11.000,00 | R$ 600,00 (IA) + R$ 300,00 (Infra) | R$ 11.900,00 |
| **Subtotal de Construção (Parte 1)** | **156 h** | **R$ 15.600,00** | **R$ 900,00** | **R$ 16.500,00** |
| **Reserva para Imprevistos (10%)** | — | — | — | **R$ 1.650,00** |
| **CUSTO TOTAL ESTIMADO (PARTE 1)** | **156 h** | | | **R$ 18.150,00** |

---

### 2.2 Memória de Cálculo de Consumo de API das 3 LLMs (Parte 2)

> **Regra do PDF (pág. 8):** *"A fórmula de API usa preços por milhão de tokens... Os tokens totais devem incluir todas as chamadas efetivas, inclusive revisão, testes do agente e novas tentativas; não apliquem um fator de retry novamente sobre esse total."*

- **Volume de execuções:** `40 tarefas` assistidas por agentes (das 53 tarefas totais), com média de **2,5 ciclos efetivos por tarefa** (`100 ciclos` no total), mais `80 execuções` da suíte de Evals do Harness (`EV01`–`EV04`).

| Atividade no Harness | Modelo | Cálculo do Volume de Chamadas Efetivas | Tokens por Chamada (In / Out) | Total Tokens Entrada | Total Tokens Saída | Custo Entrada (US$) | Custo Saída (US$) | Subtotal (US$) |
|---|---|---|---|---|---|---|---|---|
| Planejamento inicial (`40 tarefas`) | `M1 (gpt-5)` | `40 tarefas × 1 chamada` = `40` | `60k in / 6k out` | `2.400.000` (2,40 M) | `240.000` (0,24 M) | US$ 3,00 | US$ 2,40 | **US$ 5,40** |
| Revisão de diff por ciclo (`40 tarefas × 2,5 ciclos`) | `M1 (gpt-5)` | `100 ciclos × 1 chamada` = `100` | `40k in / 3k out` | `4.000.000` (4,00 M) | `300.000` (0,30 M) | US$ 5,00 | US$ 3,00 | **US$ 8,00** |
| Execução de código e testes (`40 tarefas × 2,5 ciclos`) | `M2 (claude-sonnet-4-5)` | `100 ciclos × 15 tool calls` = `1.500` | `25k in / 2k out` | `37.500.000` (37,50 M) | `3.000.000` (3,00 M) | US$ 112,50 | US$ 45,00 | **US$ 157,50** |
| Execução de Evals do Harness (`80 runs EV01..EV04`) | `M2 (claude-sonnet-4-5)` | `80 runs × 10 chamadas` = `800` | `20k in / 1,5k out` | `16.000.000` (16,00 M) | `1.200.000` (1,20 M) | US$ 48,00 | US$ 18,00 | **US$ 66,00** |
| Triagem de falhas e geração de fixtures (`40 tarefas`) | `M3 (gemini-2.5-flash)` | `40 tarefas × 2 chamadas` = `80` | `10k in / 1k out` | `800.000` (0,80 M) | `80.000` (0,08 M) | US$ 0,24 | US$ 0,20 | **US$ 0,44** |
| **TOTAL DE API NA CONSTRUÇÃO** | **3 Modelos** | **2.520 chamadas efetivas** | — | **60,70 M tokens** | **4,82 M tokens** | **US$ 168,74** | **US$ 68,60** | **US$ 237,34** |

- Conversão para Reais: `US$ 237,34 × R$ 5,50 = R$ 1.305,37` + `IOF 3,5% (R$ 45,69)` = **R$ 1.351,06**.

---

### 2.3 Fechamento Completo da Parte 2 (Construção por Release, Operação e Sensibilidade)

| Componente de Custo | R0 (Semana 1) | R1 (Semana 2) | R2 (Semanas 3 e 4) | Total Construção (4 Semanas) | Sensibilidade: +50% Tokens | Diferença (Δ +50% Tokens) |
|---|---|---|---|---|---|---|
| **1. Pessoas — FDE (R$ 140/h)** | 10h = R$ 1.400,00 | 10h = R$ 1.400,00 | 18h = R$ 2.520,00 | **38h = R$ 5.320,00** | R$ 5.320,00 | R$ 0,00 |
| **1. Pessoas — AI Engineer (R$ 160/h)** | 10h = R$ 1.600,00 | 10h = R$ 1.600,00 | 19h = R$ 3.040,00 | **39h = R$ 6.240,00** | R$ 6.240,00 | R$ 0,00 |
| **1. Pessoas — Software Eng. (R$ 110/h)** | 10h = R$ 1.100,00 | 10h = R$ 1.100,00 | 20h = R$ 2.200,00 | **40h = R$ 4.400,00** | R$ 4.400,00 | R$ 0,00 |
| **1. Pessoas — Platform Eng. (R$ 130/h)** | 10h = R$ 1.300,00 | 10h = R$ 1.300,00 | 19h = R$ 2.470,00 | **39h = R$ 5.070,00** | R$ 5.070,00 | R$ 0,00 |
| **Subtotal Pessoas** | **40h = R$ 5.400,00** | **40h = R$ 5.400,00** | **76h = R$ 10.230,00** | **156h = R$ 21.030,00** | **R$ 21.030,00** | **R$ 0,00** |
| **2. IA na Engenharia — API LLMs** (15% / 30% / 55%) | R$ 202,66 | R$ 405,32 | R$ 743,08 | **R$ 1.351,06** | **R$ 2.026,59** | **+R$ 675,53** |
| **2. IA na Engenharia — Licenças Fixas** | R$ 150,00 | R$ 150,00 | R$ 300,00 | **R$ 600,00** | R$ 600,00 | R$ 0,00 |
| **3. Infraestrutura Dev/Testes/CI** | R$ 75,00 | R$ 75,00 | R$ 150,00 | **R$ 300,00** | R$ 300,00 | R$ 0,00 |
| **CUSTO-BASE DE CONSTRUÇÃO** | **R$ 5.827,66** | **R$ 6.030,32** | **R$ 11.423,08** | **R$ 23.281,06** | **R$ 23.956,59** | **+R$ 675,53** |
| **4. Reserva para Imprevistos (10%)** | R$ 582,77 | R$ 603,03 | R$ 1.142,31 | **R$ 2.328,11** | **R$ 2.395,66** | **+R$ 67,55** |
| **TOTAL DE CONSTRUÇÃO COM RESERVA** | **R$ 6.410,43** | **R$ 6.633,35** | **R$ 12.565,39** | **R$ 25.609,17** | **R$ 26.352,25** | **+R$ 743,08 (+2,9%)** |

---

### 2.4 Custo de Operação Pós-Entrega (Mensal e Projeção de 3 Meses)

| Bloco de Operação | Composição Verificável | Custo Mensal (Base) | Acumulado 3 Meses (Base) | Acumulado 3 Meses (+50% Tokens) |
|---|---|---|---|---|
| **Infraestrutura de Produção** | Vercel Pro + Neon Postgres com PITR 7 dias + Domínio + Uptime/Sentry/Upstash | R$ 350,00 | R$ 1.050,00 | R$ 1.050,00 |
| **Suporte e Operação Assistida** | `4h/mês` Platform (`R$ 520`) + `4h/mês` Software Eng. (`R$ 440`) | R$ 960,00 | R$ 2.880,00 | R$ 2.880,00 |
| **Consumo de IA na Manutenção (Harness)** | ~10 tarefas corretivas/evolutivas por mês via Harness (`~US$ 26,35/mês`) | R$ 150,00 | R$ 450,00 | R$ 675,00 (+R$ 225,00) |
| **Consumo de IA no Produto pelos Estudantes** | `0` (não há LLM voltada ao estudante no MVP — decisão de arquitetura e privacidade) | R$ 0,00 | R$ 0,00 | R$ 0,00 |
| **TOTAL DE OPERAÇÃO** | | **R$ 1.460,00 / mês** | **R$ 4.380,00 (3 meses)** | **R$ 4.605,00 (3 meses)** |
| **TCO (Construção c/ Reserva + 3 Meses Operação)** | | — | **R$ 29.989,17** | **R$ 30.957,25** |

---

## 3. Matriz Completa dos 4 Eventos de Replanejamento (Pág. 5 da Parte 2)

Caso o professor sorteie qualquer um dos 4 eventos previstos na página 5 da Parte 2 durante a defesa, o grupo já possui o cálculo exato de impacto e rastreabilidade abaixo:

| Evento Sorteado pelo Professor | Artefatos SDD Afetados | Ajuste de Escopo e Arquitetura | Impacto em Horas (Δ Esforço) | Impacto Financeiro (Δ Custo c/ Reserva) | Impacto no Prazo |
|---|---|---|---|---|---|
| **Evento 1: Indisponibilidade do modelo principal (`M2: claude-sonnet-4-5`) por 48 horas** | `harness-spec.md` (§2, §3), `tasks.md` | • Tarefas de `Risco Baixo` (UI/boilerplate) são roteadas automaticamente pelo Harness para `M3` (`gemini-2.5-flash`).<br>• Tarefas de `Risco A` na janela de 48h são assumidas manualmente pelo `Software Engineer`.<br>• Corta-se o endpoint opcional `E30` (`POST /previa-criterios`, `-1h SW`) para absorver a codificação manual sem estourar 40h do SW Eng. | `+1h AI Eng.` (ajuste e monitoramento do fallback) usando 1h da folga existente (`156h → 157h`). | `+R$ 160` (1h AI) `- R$ 95` (economia de tokens `M2` trocados por `M3`) = **+R$ 71,50** (com reserva). | **0 dias** (mantém entrega em 4 semanas). |
| **Evento 2: Aumento de 50% no consumo de tokens** | `harness-spec.md` (§2), `budget-and-changes.md` (§2.3), `budget.csv` | • Nenhum corte de escopo funcional.<br>• Teto semanal do `BudgetCircuitBreaker` é ajustado de `US$ 90/sem` para `US$ 135/sem` e teto por tarefa de `US$ 8` para `US$ 12`. | **0 h** (`156h` mantidas). | API sobe `+R$ 675,53` + Reserva `+R$ 67,55` = **+R$ 743,08** (Total vai a **R$ 26.352,25**). | **0 dias** (absorvido por apenas 31,9% da reserva original de R$ 2.328,11). |
| **Evento 3: Restrição ao envio de dados acadêmicos a um fornecedor** | `constitution.md` (`C4`), `harness-spec.md` (`ADR-002`) | • **Cenário 3A (Restrição a dados reais):** Impacto **zero**, pois nossa arquitetura (`RN18`, `C4`, `PiiAndSecretScanner`) já garante que **0 dados acadêmicos reais** saem para qualquer LLM.<br>• **Cenário 3B (Veto institucional total a 1 fornecedor, ex.: Anthropic vetada):** O roteador do LangGraph substitui `M2` por `gpt-5` (OpenAI) e usa `gemini-2.5-pro` como revisor `M1`, reexecutando o eval `EV03`. | • 3A: `+1h FDE` (emitir laudo de conformidade).<br>• 3B: `+1h FDE + 2h AI Eng.` (`156h → 159h`, dentro das 160h). | • 3A: **+R$ 154,00**.<br>• 3B: `+R$ 460` (horas) `- R$ 280` (tarifa menor de tokens) = **+R$ 198,00** (com reserva). | **0 dias**. |
| **Evento 4: Alteração de regra de negócio (`MR-01`: Controle de Frequência e Reprovação por Falta < 75%)** | `prd.md` (`RN22`, `RN23`, `RF16`), `data-model.md`, `api-spec.md`, `ui-ux-spec.md`, `test-plan.md`, `tasks.md` | • Adiciona `carga_horaria_aulas`, `faltas_registradas`, cálculo de saldo de faltas e precedência de `REPROVADO_POR_FALTA` sobre nota (`+10h` brutas).<br>• **Opção A (Manter 4 semanas / 160h):** Corta `RF13` (Simulação "E se?"), `E30` (Prévia de critérios) e widget "Próximas avaliações" (`-6h`), resultando em `+4h` líquidas (`156h → 160h`).<br>• **Opção B (Manter 100% do escopo):** Estende 1 semana para o SW Eng. (`+5h`). | • Opção A: **+4 h líquidas** (`2h FDE + 1h AI + 1h Plat`, SW fica em `40h/40h`).<br>• Opção B: **+10 h brutas** (`166h`). | • Opção A: `+R$ 570` (pessoas) `+ R$ 67,55` (+5% API) + 10% reserva = **+R$ 701,31** (Total: **R$ 26.310,48**).<br>• Opção B: **+R$ 1.388,81**. | • Opção A: **0 dias** (4 semanas, sem folga).<br>• Opção B: **+1 semana** (5 semanas). |
