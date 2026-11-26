# ADR-002: Política de Múltiplas LLMs com Segregação entre Planejamento/Revisão, Execução e Triagem

- **Status:** Aprovado
- **Data:** 25/11/2026
- **Decisores:** AI Engineer (líder), Software Engineer, FDE
- **Requisitos Relacionados:** `RNF22`, `RNF23`, `RNF24`, `C4`, `C5`, `C6`

---

## 1. Contexto e Problema

A Parte 2 exige a seleção de **três modelos distintos**, sendo pelo menos dois com participação ativa e um terceiro atuando como revisor ou fallback, deixando claro que *"vários agentes usando um mesmo modelo não equivalem a vários modelos"* e que *"uma revisão por outra LLM não comprova correção"*.

Precisamos alocar modelos que equilibrem:
- Alta capacidade de raciocínio arquitetural e decomposição de especificações SDD;
- Alta precisão em geração e edição incremental de código TypeScript/Next.js/Prisma com uso intensivo de ferramentas (*tool calling*);
- Baixo custo e baixa latência para triagem de logs de falha, geração de *fixtures* sintéticos e atuação como fallback em tarefas de baixo risco;
- Orçamento total de API dentro de ~US$ 237 (R$ 1.351) para 40 tarefas assistidas por agentes.

---

## 2. Alternativas Consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| **A. Usar um único modelo topo de linha (ex.: Claude Opus ou GPT-5) em todos os agentes** | Configuração única. | Custo de tokens > 3x maior; o agente revisor compartilha os mesmos vieses e pontos cegos do agente executor; zero resiliência se o provedor cair por 48h (Evento `E1`). |
| **B. Três modelos do mesmo fornecedor (ex.: Haiku + Sonnet + Opus)** | Uma única chave de API e contrato comercial. | Uma falha operacional ou bloqueio regulatório do fornecedor (Eventos `E1` e `E3`) paralisa 100% da engenharia com IA. |
| **C. Três modelos de provedores distintos especializados por etapa do ciclo (`M1` OpenAI `gpt-5`, `M2` Anthropic `claude-sonnet-4-5`, `M3` Google `gemini-2.5-flash`)** | Separa cognitivamente quem planeja/revisa (`M1`) de quem codifica (`M2`); mantém custo controlado concentrando 88% dos tokens em `M2` e triagens baratas em `M3`; alta resiliência a falhas de um provedor. | Exige gerenciamento de 3 chaves de API no orquestrador e normalização de schemas JSON via LangGraph. |

---

## 3. Decisão

Adotamos a **Alternativa C**, distribuindo os papéis da seguinte forma:

1. **`M1 — Planejamento e Revisão Semântica` (`OpenAI / gpt-5`):**
   - Acionado 1 vez no início da tarefa para gerar o plano estruturado em JSON a partir da spec (`prd.md`, `api-spec.md`, `data-model.md`) e 1 vez ao final de cada ciclo verde de testes para comparar o `git diff` contra os Critérios de Aceite (`CAxx.x`).
   - Permissão **somente leitura**.
2. **`M2 — Execução de Código e Testes` (`Anthropic / claude-sonnet-4-5`):**
   - Acionado no loop de implementação dentro do sandbox Docker. Possui acesso restrito de escrita aos `paths_permitidos` da tarefa e execução de `Vitest`/linter.
3. **`M3 — Triagem de Falhas, Fixtures e Fallback de Baixo Risco` (`Google / gemini-2.5-flash`):**
   - Acionado quando um gate determinístico falha no sandbox (para resumir o stack trace e economizar tokens de contexto de `M2`) e para gerar massa de testes sintética (`@example.test`).
   - Atua como **fallback de execução** somente quando `M2` estiver indisponível por `> 15 min` **e** a tarefa for classificada como `Risco Baixo` (boilerplate, UI simples, documentação). Para tarefas de `Risco A` (autenticação, migrações, motor de cálculo decimal), se `M2` cair, o harness **para e escala para o Software Engineer humano**.

---

## 4. Consequências

- **Positivas:**
  - Reduz drasticamente o risco de "auto-aprovação viciada" entre executor e revisor, mantendo os testes determinísticos (`Vitest`, `Playwright`, suíte `IDOR`) e o `CODEOWNER` humano como juízes finais.
  - Custo total estimado de API em construção fica em **US$ 237,34 (R$ 1.351,06)** para todas as 40 tarefas e 80 execuções de evals.
- **Negativas / Trade-offs:**
  - Necessidade de manter contratos de saída estruturados (`Zod` / JSON Schema) compatíveis com os 3 modelos e monitorar limites de cota em 3 consoles.
