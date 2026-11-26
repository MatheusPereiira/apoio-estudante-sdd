# Registros Individuais do Pré-Game e Decisões Aplicadas ao Projeto (`pre-game.md`)

> **Versão:** 1.1.0 · **Data:** 25/11/2026 · **Padrão:** Pág. 4 e Pág. 9 da Parte 2 (`10%` da nota da Parte 2)
> **Requisito do PDF:** *"Cada integrante entrega até meia página com: (1) uma mudança que faria no projeto após estudar; (2) um controle do harness e a falha que ele evita; (3) uma responsabilidade humana que precisa permanecer; (4) um custo antes esquecido. Citem ao menos duas fontes e expliquem a aplicação ao projeto."*

---

## 1. Ingresso Individual — Integrante 1: FDE (Produto e Implantação)

- **Papel no Projeto:** Forward Deployed Engineer (`R$ 140/h` · `38h` alocadas)
- **Fontes Estudadas:**
  1. *Den Delimarsky — The ONLY guide you'll need for GitHub Spec Kit (min 11 a 35)* & documentação oficial do *GitHub Spec Kit*.
  2. *OpenAI — Forward Deployed Engineer (descrição pública da função) & Harness Engineering (11/02/2026)*.

| Item Exigido | Aplicação Concreta na Plataforma Estudantil |
|---|---|
| **1. Mudança que faria no projeto após estudar** | Na Parte 1, tratávamos a especificação como um documento estático escrito apenas no início. Após estudar o **GitHub Spec Kit** (Delimarsky), separei os princípios invariantes em um arquivo `docs/constitution.md` e transformei os critérios de aceite de `F1`, `F2` (incluindo Prova Substitutiva e Exame Final) e `F3` em contratos executáveis versionados (`spec-v1.1.0`) que alimentam diretamente o contexto dos agentes e evoluem a cada feedback do piloto (`T28`). |
| **2. Controle do harness e a falha que ele evita** | **Filtro de Contexto e Scanner Determinístico de PII (`PiiAndSecretScanner` — Princípio `C4`):** impede que qualquer dado pessoal ou nota real dos estudantes do piloto (`R1`) entre nos prompts enviados para OpenAI, Anthropic ou Google. Evita violação da LGPD e vazamento de dados acadêmicos reais para provedores externos. |
| **3. Responsabilidade humana que precisa permanecer** | **Descoberta institucional, validação de regras acadêmicas com a faculdade (`T02`) e Homologação/Aceite de Release (`R1` e `R2` — `T14`, `T41`).** Nenhum agente de IA consegue negociar com a coordenação se a Prova Substitutiva substitui apenas provas ou também trabalhos, nem assinar o termo de responsabilidade de Go-Live diante dos alunos. |
| **4. Custo antes esquecido** | **Esforço humano de curadoria da spec, onboarding do grupo piloto e reescrita da especificação após feedback real (`T14`, `T28`, `T43` = `8h` do FDE = `R$ 1.120,00`).** Na Parte 1 presumimos que "usar IA economiza horas automaticamente", esquecendo o custo de especificar com rigor suficiente para o agente não alucinar regras de cálculo. |

---

## 2. Ingresso Individual — Integrante 2: AI Engineer (Harness e Modelos)

- **Papel no Projeto:** AI Engineer / Harness (`R$ 160/h` · `39h` alocadas)
- **Fontes Estudadas:**
  1. *Harrison Chase / Sequoia Capital — When to Build Your Own Agent Harness (primeiros 16 min)* & *The Anatomy of an Agent Harness*.
  2. *Anthropic — Building more effective AI agents (min 06:40 a 17:15) & Effective harnesses for long-running agents (26/11/2025)* + *LangChain Deep Agents*.

| Item Exigido | Aplicação Concreta na Plataforma Estudantil |
|---|---|
| **1. Mudança que faria no projeto após estudar** | Em vez de tentar construir um orquestrador próprio do zero ou usar um único modelo para tudo, apliquei a lição de Harrison Chase (*reutilizar a infraestrutura de grafo/estado e customizar apenas as políticas de domínio*) adotando **Deep Agents sobre LangGraph (`ADR-001`)** com três modelos segregados (`ADR-002`): `M1 (gpt-5)` apenas planeja e revisa, `M2 (claude-sonnet-4-5)` codifica e `M3 (gemini-2.5-flash)` faz triagem de logs de falha. |
| **2. Controle do harness e a falha que ele evita** | **`BudgetCircuitBreaker` + Limite de 3 Ciclos com Checkpoints Persistentes (`EV01`, `EV02`):** conforme demonstrado pela Anthropic em *Building effective agents*, agentes em loop de correção podem entrar em espiral infinita tentando consertar um teste quebrado e queimando orçamento. O controle interrompe a tarefa exatamente na 3ª falha ou ao atingir `US$ 8,00`, grava o checkpoint em SQLite + `progress.md` e escala para o humano. |
| **3. Responsabilidade humana que precisa permanecer** | **Aprovação prévia do plano (`Human-in-the-loop interrupt`) nas tarefas classificadas como `Risco A` (`T07`, `T08`, `T20`, `T33`, `T49`).** Mesmo com `M1` planejando e revisando, uma revisão por outra LLM não comprova correção matemática ou criptográfica. |
| **4. Custo antes esquecido** | **Tokens consumidos em reexecuções (média de 2,5 ciclos por tarefa), chamadas de revisão (`M1`) e execuções da suíte de Evals do próprio Harness (`80 runs` de `EV01`–`EV04`).** Na Parte 1 orçamos apenas R$ 600 de licenças fixas; ao contabilizar os `60,70M` tokens de entrada e `4,82M` de saída na API (com câmbio + IOF), descobrimos **R$ 1.351,06** adicionais só de consumo de API. |

---

## 3. Ingresso Individual — Integrante 3: Software Engineer (Aplicação e Integrações)

- **Papel no Projeto:** Software Engineer / Integrações (`R$ 110/h` · `40h` alocadas)
- **Fontes Estudadas:**
  1. *Stripe — Minions: Stripe's one-shot, end-to-end coding agents (09/02/2026)*.
  2. *Den Delimarsky — GitHub Spec Kit* & *Anthropic — Building more effective AI agents*.

| Item Exigido | Aplicação Concreta na Plataforma Estudantil |
|---|---|
| **1. Mudança que faria no projeto após estudar** | Inspirado na arquitetura dos **Stripe Minions** (que intercalam geração de código com ferramentas determinísticas rápidas e escopo de arquivos estritamente delimitado), isolei toda a matemática acadêmica (médias, arredondamento `HALF_UP`, prova substitutiva `RN19` e exame final `RN20/RN21`) em um pacote puro `@app/domain` (`packages/domain/**`) com `decimal.js` e zero dependência de banco ou Next.js. Assim, o agente `M2` recebe `paths_permitidos` cirúrgicos e valida o código em `< 3 segundos`. |
| **2. Controle do harness e a falha que ele evita** | **`PathGuard` (Restrição determinística de escrita por tarefa — `EV04`):** bloqueia qualquer chamada `write_file` do agente `M2` fora da lista `paths_permitidos` do contrato da tarefa. Evita que o agente, ao tentar fazer um teste passar, altere indevidamente contratos globais, migrações já aplicadas ou desative verificações em outros pacotes. |
| **3. Responsabilidade humana que precisa permanecer** | **Code Review técnico final (`CODEOWNER`) de 100% dos Pull Requests abertos pelos agentes antes do merge em `main` (`RNF24`, `C5`).** Cabe ao Software Engineer verificar integridade transacional (nota + histórico na mesma transação), locks pessimistas na soma de pesos (`FOR UPDATE`) e legibilidade arquitetural. |
| **4. Custo antes esquecido** | **Horas humanas de revisão técnica de PRs gerados por agentes e intervenção manual quando o agente escala após 3 falhas.** O agente não reduz o esforço de engenharia a zero: das minhas 40h, cerca de 35% são dedicadas a revisar planos `Risco A`, auditar diffs produzidos por `M2` e corrigir casos de borda complexos. |

---

## 4. Ingresso Individual — Integrante 4: Platform / LLMOps e Qualidade

- **Papel no Projeto:** Platform / LLMOps e Qualidade (`R$ 130/h` · `39h` alocadas)
- **Fontes Estudadas:**
  1. *Anthropic — Effective harnesses for long-running agents (26/11/2025)*.
  2. *Stripe — Minions (09/02/2026)* & *OpenAI — Harness Engineering (11/02/2026)*.

| Item Exigido | Aplicação Concreta na Plataforma Estudantil |
|---|---|
| **1. Mudança que faria no projeto após estudar** | Ao estudar o relato da **OpenAI** e da **Stripe** sobre ambientes de agentes, percebi que o ambiente de execução e feedback é tão importante quanto o prompt. Projetei um container `.devcontainer` isolado (sem chaves de produção e com rede restrita) espelhado nos gates do GitHub Actions, além de uma suíte automatizada de **Propriedades Matemáticas (`fast-check`)** e **Isolamento IDOR (`CT04`)** que rodam obrigatoriamente antes de qualquer release. |
| **2. Controle do harness e a falha que ele evita** | **Sandbox Efêmero Sem Segredos + Gate Bloqueante de IDOR/CI (`CT04`, `CT08`):** o agente `M2` executa testes contra um PostgreSQL local populado apenas com seeds `@example.test`, sem acesso às variáveis `.env` de produção/staging. Evita exfiltração acidental de credenciais via prompt injection ou destruição do banco de dados real durante testes automatizados. |
| **3. Responsabilidade humana que precisa permanecer** | **Decisão de Go/No-Go operacional da Release `R2`, execução de migrações em produção, teste de restauração de backup (`PITR` — `T53`) e acionamento de Rollback.** Nenhum agente tem permissão de deploy em produção ou acesso ao banco Neon de produção (`C8`). |
| **4. Custo antes esquecido** | **Custo contínuo de operação pós-entrega (R$ 1.460,00/mês = R$ 4.380,00 no 1º trimestre) e infraestrutura de observabilidade/testes.** Na Parte 1 olhamos apenas para as 4 semanas de construção e esquecemos o custo mensal de manter banco com Point-in-Time Recovery, hospedagem comercial, horas humanas de suporte (`8h/mês`) e tokens de manutenção pós-lançamento. |

---

## 5. Síntese das Decisões Coletivas que o Pré-Game Provocou no Projeto (Rodada 1 — Alinhamento)

1. **Adoção do pacote completo do GitHub Spec Kit (`constitution.md` + `prd.md` + `architecture.md` + `tasks.md` + `ADRs`):** garantiu rastreabilidade ponta a ponta entre requisito, tarefa, agente e caso de teste.
2. **Inclusão de Prova Substitutiva (`RN19`) e Exame Final (`RN20`, `RN21`) no pacote puro `@app/domain`:** blindada por 6 propriedades matemáticas invariantes no `fast-check` (`test-plan.md` §3).
3. **Criação dos 4 Evals do Harness (`EV01`–`EV04`) no CI:** o próprio harness passa a ser testado automaticamente contra estouro de orçamento, loop infinito, edição de path proibido e vazamento de PII.
4. **Explicitação do orçamento de API por modelo e do TCO de operação de 3 meses:** eliminou a ilusão de que a licença fixa de R$ 600 cobriria chamadas programáticas de agentes.
