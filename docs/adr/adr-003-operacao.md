# ADR-003: Arquitetura Monolítica Modular Serverless (Next.js + Neon PostgreSQL) e Estratégia de Operação

- **Status:** Aprovado
- **Data:** 25/11/2026
- **Decisores:** Software Engineer (líder), Platform / LLMOps Engineer, FDE
- **Requisitos Relacionados:** `RNF01` a `RNF11`, `C2`, `C3`, `C7`, `C8`

---

## 1. Contexto e Problema

A equipe dispõe de **160 horas-pessoa totais** (40h por integrante em 4 semanas) e um orçamento de infraestrutura de desenvolvimento/testes de **R$ 300/mês**, precisando entregar três releases incrementais (`R0` na Semana 1, `R1` Piloto na Semana 2 e `R2` Final na Semana 4) com requisitos rigorosos de:
- Latência (`p95 < 300ms` leitura, `p95 < 500ms` escrita);
- Disponibilidade (`>= 99,5%`) e recuperação (`RPO <= 24h`, `RTO <= 4h`, PITR de 7 dias);
- Ambientes isolados (`local`, `preview` por PR, `staging` e `production`);
- Rollback rápido e seguro por release.

---

## 2. Alternativas Consideradas

| Alternativa | Prós | Contras |
|---|---|---|
| **A. Front-end SPA separado + Back-end em containers (ECS/Kubernetes) + RDS** | Isolamento total de processos e infraestrutura tradicional corporativa. | Custo mensal elevado (> R$ 800/mês só de banco e cluster); consome > 25h do Platform Engineer com Terraform, VPC e pipelines duplos. |
| **B. BaaS acoplado no cliente (React + chamadas diretas ao Supabase via RLS no navegador)** | Muito rápido para CRUD simples. | Espalha regras críticas de negócio (média ponderada, substitutiva, exame final, validação de soma de pesos = 100% e auditoria LGPD) entre cliente e triggers SQL, dificultando testes unitários determinísticos com `decimal.js`. |
| **C. Monólito Modular TypeScript em Next.js 15 (SSR + Route Handlers `/api/v1`) na Vercel + PostgreSQL 16 Serverless (Neon) + Upstash Redis** | Um único repositório (Turborepo), tipagem compartilhada via Zod, pacote `@app/domain` 100% puro e testável, deploy de `preview` + branch de banco automático por PR, rollback em 1 clique e PITR nativo. | Funções serverless exigem atenção a conexões de banco (resolvido pelo connection pooler nativo do Neon) e rate limiting distribuído (resolvido com Upstash Redis HTTP). |

---

## 3. Decisão

Adotamos a **Alternativa C**:

1. **Monólito Modular com Camadas Isoladas:**
   - `packages/domain`: núcleo funcional puro (`decimal.js`), zero dependência de banco ou HTTP, cobertura `>= 95%`.
   - `packages/contracts`: schemas `Zod` que validam payloads e geram a especificação OpenAPI 3.1.
   - `packages/application` e `packages/infrastructure`: casos de uso transacionais e repositórios Prisma que exigem `usuarioId` em 100% das assinaturas.
   - `apps/web`: interface mobile-first e Route Handlers finos em `/api/v1`.
2. **Operação e Rollback:**
   - Todo PR aprovado por agente/humano gera um ambiente `preview` isolado.
   - Migrações de banco seguem o padrão **Expand/Contract** e rodam apenas via GitHub Actions com credencial de migração separada da credencial da aplicação.
   - Rollback de código na Vercel via *"Promote previous deployment"* (`< 2 min`) + feature flag para desativar módulos novos (`F3`) sem indisponibilizar `F1`/`F2`.

---

## 4. Consequências

- **Positivas:**
  - Mantém o custo de infraestrutura de desenvolvimento/testes dentro dos **R$ 300/mês** e a operação mensal pós-entrega em **R$ 350/mês** de infraestrutura.
  - Maximiza a produtividade tanto dos humanos quanto do agente `M2`, que trabalha em uma única linguagem (TypeScript strict) com feedback de testes unitários em `< 3 segundos`.
- **Negativas / Trade-offs:**
  - Possível *cold start* em rotas pouco acessadas (mitigado mantendo as funções na região `gru1` / `sa-east-1` e bundles enxutos).
