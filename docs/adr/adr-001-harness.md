# ADR-001: Adoção e Extensão do LangChain Deep Agents (LangGraph) como Harness de Engenharia

- **Status:** Aprovado
- **Data:** 25/11/2026
- **Decisores:** AI Engineer (líder), Platform Engineer, Software Engineer
- **Requisitos Relacionados:** `RNF22`, `RNF23`, `RNF24`, `C4`, `C5`, `C6`

---

## 1. Contexto e Problema

A Parte 2 do projeto exige que o desenvolvimento das três funcionalidades da Plataforma Estudantil (`F1`, `F2`, `F3`) seja conduzido por **agentes de IA controlados por um Harness de Engenharia**, operando com **múltiplas LLMs** (`M1` planejamento/revisão, `M2` execução, `M3` triagem/fallback), dentro de uma janela máxima de **160 horas-pessoa** (sendo apenas ~39 horas disponíveis para o *AI Engineer*).

Precisamos decidir entre:
1. Construir um orquestrador próprio do zero;
2. Adotar uma ferramenta fechada/CLI de um único fornecedor;
3. Adotar um framework aberto de agentes com suporte a grafos de estado e estendê-lo com nossas políticas determinísticas.

Além disso, o briefing alerta explicitamente: *"Um SDK ou produto pode restringir os modelos suportados. Justifiquem a compatibilidade real entre o harness e os modelos escolhidos; um arquivo de instruções, sozinho, não implementa a orquestração."*

---

## 2. Alternativas Consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| **A. Construir um harness próprio do zero (scripts Python/TS puros)** | Controle total sobre cada chamada HTTP e formato de estado. | Consome > 30h apenas para reimplementar persistência de checkpoints, retomada de sessão, gerenciamento de ferramentas e human-in-the-loop, inviabilizando as 39h do AI Engineer. |
| **B. Adotar agente CLI de fornecedor único (ex.: Claude Code puro ou OpenAI Codex CLI puro)** | Setup inicial quase imediato. | Acoplamento a um único provedor primário; dificulta o roteamento programático entre 3 provedores distintos (`OpenAI`, `Anthropic`, `Google`) no mesmo grafo de estado e limita o controle fino de teto financeiro por nó. |
| **C. Adotar `Deep Agents` sobre `LangGraph` e estendê-lo com políticas determinísticas próprias** | Suporte nativo multi-provedor (`langchain-openai`, `langchain-anthropic`, `langchain-google-genai`), checkpointer persistente em SQLite/Postgres, `interrupt()` nativo para aprovação humana (`Risco A`) e delegação estruturada para subagentes. | Exige fixar versão no lockfile para evitar quebras de API e escrever wrappers determinísticos para sandbox, limites de paths e scanner de PII. |

---

## 3. Decisão

Escolhemos a **Alternativa C**: adotar o padrão **Deep Agents implementado sobre LangGraph**, estendendo-o com quatro módulos determinísticos próprios escritos em código (`harness/policies/`):

1. **`PathGuard`**: intercepta a ferramenta `write_file` do agente `M2` e bloqueia qualquer tentativa de escrita fora da lista `paths_permitidos` definida no contrato da tarefa (`tasks.md`).
2. **`PiiAndSecretScanner`**: varre o contexto antes de cada chamada às APIs de LLM e antes da abertura do PR usando regex de dados pessoais (CPF, e-mails fora de `@example.test`) e `gitleaks`.
3. **`BudgetCircuitBreaker`**: contabiliza tokens de entrada/saída a cada nó do grafo e interrompe imediatamente a execução caso atinja **US$ 8,00 na tarefa**, **1,5M tokens de entrada**, **30 minutos** ou **3 ciclos de falha nos testes**.
4. **`SqliteCheckpointer` + `progress.md`**: persiste o estado completo do grafo em `harness/state/checkpoints.db` a cada transição de nó e registra um log legível por humanos em `harness/state/progress.md` e `decisions.jsonl` (inspirado nas práticas da Anthropic para agentes de longa duração).

---

## 4. Consequências

- **Positivas:**
  - Compatibilidade técnica real e comprovada com os três provedores escolhidos (`OpenAI`, `Anthropic`, `Google`) através da mesma interface de mensagens e `tool_calling`.
  - Capacidade de pausar a execução antes do nó de código em tarefas de **Risco A** (`T07`, `T08`, `T20`, `T33`, `T49`) aguardando aprovação humana e retomar do mesmo checkpoint (`harness resume --task T33`).
  - Esforço de construção do harness cabe nas tarefas `T05` (5h) e `T16` (4h).
- **Negativas / Trade-offs:**
  - Introduz dependência do ecossistema LangGraph (mitigado com versões estritamente pinadas no lockfile).
  - Exige manutenção dos testes de avaliação do próprio harness (`EV01` a `EV04` — 3h na tarefa `T17`).
