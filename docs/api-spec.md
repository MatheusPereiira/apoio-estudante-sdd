# Especificação da API (Contratos e Endpoints)

> **Versão:** 1.1.0 · **Data:** 25/11/2026 · **Base URL:** `https://<host>/api/v1`
> Fonte executável: schemas Zod em `packages/contracts` → OpenAPI 3.1 gerado no CI (este documento é o contrato de referência humano).

---

## 1. Convenções gerais

| Item | Regra |
|---|---|
| Formato | `application/json; charset=utf-8`; erros em `application/problem+json` (RFC 9457) |
| Nomes de campos | `camelCase` |
| IDs | UUID v4 (string) |
| Números decimais | JSON `number` com no máx. 2 casas (notas/pesos). Campos calculados retornam **valor arredondado para exibição** e **valor exato** como string (`"...Exata"`) |
| Datas | `date`: `YYYY-MM-DD`; `date-time`: ISO 8601 UTC (`2026-11-25T23:30:00Z`) |
| Autenticação | Cookie `access_token` (JWT, 15 min, `HttpOnly; Secure; SameSite=Lax; Path=/`) + cookie `refresh_token` (opaco, 7 dias, `Path=/api/v1/auth`) |
| CSRF | Métodos `POST/PUT/PATCH/DELETE` exigem header `X-CSRF-Token` igual ao cookie `csrf_token` (não-HttpOnly). Exceções: `POST /auth/register`, `POST /auth/login` |
| Concorrência | Atualizações (`PATCH`, `PUT nota`) exigem campo `versao`; divergência → **409** `CONFLITO_VERSAO` |
| Rastreio | Toda resposta inclui header `X-Trace-Id` |
| Rate limit | Headers `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`; excedido → **429** com `Retry-After` |
| Propriedade | Recurso de outro usuário ou inexistente → **404** (nunca 403, para não revelar existência) |
| Versionamento | Prefixo `/v1`; mudanças incompatíveis → `/v2` |

### 1.1 Modelo de erro (Problem Details)

```json
{
  "type": "https://<host>/errors/validacao",
  "title": "Dados inválidos",
  "status": 422,
  "code": "VALIDACAO",
  "detail": "Um ou mais campos são inválidos.",
  "errors": [
    { "field": "nota", "code": "FORA_DO_INTERVALO", "message": "A nota deve estar entre 0 e 10." }
  ],
  "traceId": "01JDZ8K3M4X5Y6Z7A8B9C0D1E2"
}
```

### 1.2 Catálogo de códigos de erro

| HTTP | `code` | Quando |
|---|---|---|
| 400 | `REQUISICAO_MALFORMADA` | JSON inválido, tipo de conteúdo errado |
| 401 | `NAO_AUTENTICADO` | Sem sessão / token expirado sem refresh válido |
| 401 | `CREDENCIAIS_INVALIDAS` | Login com e-mail/senha incorretos |
| 403 | `CSRF_INVALIDO` | Header CSRF ausente/divergente |
| 404 | `NAO_ENCONTRADO` | Recurso inexistente ou de outro usuário |
| 409 | `NOME_DUPLICADO` | Viola RN15 |
| 409 | `CONFLITO_VERSAO` | Viola RN16 |
| 409 | `CONFIRMACAO_NECESSARIA` | Operação destrutiva/recalculadora sem `confirmar: true` (RN12, CA04.4, CA06.4) |
| 422 | `VALIDACAO` | Falha de schema/campos |
| 422 | `SOMA_PESOS_EXCEDIDA` | Viola RN03 |
| 422 | `LIMITE_ATINGIDO` | Viola RN14 |
| 422 | `CADASTRO_INVALIDO` | Cadastro recusado (inclui e-mail existente — mensagem genérica, CA01.2) |
| 423 | `CONTA_BLOQUEADA` | Bloqueio temporário (CA02.2) |
| 429 | `LIMITE_REQUISICOES` | Rate limit |
| 500 | `ERRO_INTERNO` | Falha inesperada (detalhe nunca exposto) |
| 503 | `INDISPONIVEL` | Banco indisponível |

> Todos os endpoints autenticados podem retornar **401, 403 (CSRF), 429, 500**; esses códigos não são repetidos nas tabelas abaixo.

### 1.3 Objetos compartilhados

**`Desempenho`** (calculado pelo `@app/domain`; RF09, RF10, RF12, RF15, RN19–RN21)
```json
{
  "configuracaoCompleta": true,
  "somaPesos": 100,
  "pesoLancado": 40,
  "pesoPendente": 60,
  "pontosAcumulados": 2.0,
  "pontosAcumuladosExata": "2.0000",
  "mediaParcial": 5.0,
  "mediaParcialExata": "5.0000",
  "mediaRegular": null,
  "mediaRegularExata": null,
  "substitutiva": {
    "permitida": true,
    "nota": null,
    "avaliacaoSubstituidaId": null,
    "ganhoMedia": "0.0000",
    "notaNecessariaParaAprovar": null
  },
  "exameFinal": {
    "permitido": true,
    "elegivel": false,
    "notaMinimaExame": 4.0,
    "mediaAprovacaoExame": 5.0,
    "notaExame": null,
    "notaNecessariaExame": null,
    "mediaPosExame": null,
    "mediaPosExameExata": null
  },
  "mediaFinal": null,
  "mediaFinalExata": null,
  "notaMinimaAprovacao": 6.0,
  "notaNecessaria": { "status": "NECESSARIA", "valor": 6.7, "valorExato": "6.6667", "maximoAtingivel": 8.0 },
  "situacao": "EM_RISCO"
}
```
- `notaNecessaria.status`: `NECESSARIA` | `JA_ATINGIDO` | `INVIAVEL` | `NAO_APLICAVEL` (sem pendentes ou configuração incompleta).
- `situacao`: `CONFIGURACAO_INCOMPLETA` | `SEM_NOTAS` | `EM_ANDAMENTO` | `EM_RISCO` | `APROVACAO_GARANTIDA` | `REPROVACAO_INEVITAVEL` | `AGUARDANDO_SUBSTITUTIVA` | `EM_EXAME_FINAL` | `APROVADO` | `APROVADO_POS_EXAME` | `REPROVADO` | `REPROVADO_POS_EXAME`.

---

## 2. Resumo de endpoints

| # | Método | Rota | Auth | RF |
|---|---|---|---|---|
| E01 | GET | `/health` | Não | RNF04 |
| E02 | POST | `/auth/register` | Não | RF01 |
| E03 | POST | `/auth/login` | Não | RF02 |
| E04 | POST | `/auth/refresh` | Refresh cookie | RF02 |
| E05 | POST | `/auth/logout` | Sim | RF02 |
| E06 | GET | `/me` | Sim | RF03 |
| E07 | PATCH | `/me` | Sim | RF03 |
| E08 | GET | `/me/export` | Sim | RF03 |
| E09 | DELETE | `/me` | Sim | RF03 |
| E10 | GET | `/periodos` | Sim | RF04 |
| E11 | POST | `/periodos` | Sim | RF04 |
| E12 | GET | `/periodos/{periodoId}` | Sim | RF04 |
| E13 | PATCH | `/periodos/{periodoId}` | Sim | RF04 |
| E14 | DELETE | `/periodos/{periodoId}` | Sim | RF04 |
| E15 | GET | `/periodos/{periodoId}/disciplinas` | Sim | RF05 |
| E16 | POST | `/periodos/{periodoId}/disciplinas` | Sim | RF05 |
| E17 | GET | `/disciplinas/{disciplinaId}` | Sim | RF05, RF09 |
| E18 | PATCH | `/disciplinas/{disciplinaId}` | Sim | RF05, RF07 |
| E19 | DELETE | `/disciplinas/{disciplinaId}` | Sim | RF05 |
| E20 | POST | `/disciplinas/{disciplinaId}/avaliacoes` | Sim | RF06 |
| E21 | PATCH | `/avaliacoes/{avaliacaoId}` | Sim | RF06, RF07 |
| E22 | DELETE | `/avaliacoes/{avaliacaoId}` | Sim | RF06 |
| E23 | PUT | `/disciplinas/{disciplinaId}/avaliacoes/ordem` | Sim | RF06 |
| E24 | PUT | `/avaliacoes/{avaliacaoId}/nota` | Sim | RF08 |
| E25 | DELETE | `/avaliacoes/{avaliacaoId}/nota` | Sim | RF08 |
| E26 | GET | `/avaliacoes/{avaliacaoId}/historico` | Sim | RF11 |
| E27 | GET | `/disciplinas/{disciplinaId}/desempenho` | Sim | RF09, RF10, RF15 |
| E28 | GET | `/disciplinas/{disciplinaId}/nota-necessaria` | Sim | RF12 |
| E29 | POST | `/disciplinas/{disciplinaId}/simulacoes` | Sim | RF13 |
| E30 | POST | `/disciplinas/{disciplinaId}/previa-criterios` | Sim | RF07 |
| E31 | GET | `/periodos/{periodoId}/painel` | Sim | RF14, RF15 |
| E32 | PUT | `/disciplinas/{disciplinaId}/substitutiva` | Sim | RF08, RN19 |
| E33 | DELETE | `/disciplinas/{disciplinaId}/substitutiva` | Sim | RF08, RN19 |
| E34 | PUT | `/disciplinas/{disciplinaId}/exame-final` | Sim | RF08, RN20, RN21 |
| E35 | DELETE | `/disciplinas/{disciplinaId}/exame-final` | Sim | RF08, RN20, RN21 |

---

## 3. Sistema

### E01 — `GET /health`
**200**
```json
{ "status": "ok", "versao": "1.0.0", "commit": "a1b2c3d", "banco": "ok", "horario": "2026-11-26T02:30:00Z" }
```
**503** — `{ "status": "degradado", "banco": "indisponivel" }`

---

## 4. Autenticação e conta (C)

### E02 — `POST /auth/register` (RF01)
**Request**
```json
{
  "nome": "Ana Souza",
  "email": "ana@example.test",
  "senha": "SenhaForte2026",
  "aceiteTermos": true,
  "termosVersao": "2026-11"
}
```
| Campo | Regra |
|---|---|
| `nome` | string 2–120, trim |
| `email` | e-mail válido, ≤ 254, normalizado para minúsculas |
| `senha` | 10–128 caracteres, letras e números, fora da lista de senhas comuns |
| `aceiteTermos` | deve ser `true` |
| `termosVersao` | deve ser a versão vigente |

**201 Created** — define cookies `access_token`, `refresh_token`, `csrf_token`
```json
{
  "usuario": { "id": "5b1c...", "nome": "Ana Souza", "email": "ana@example.test", "criadoEm": "2026-11-26T02:30:00Z" }
}
```
**Erros:** 422 `VALIDACAO` (campos) · 422 `CADASTRO_INVALIDO` (e-mail existente, mensagem genérica) · 429.

### E03 — `POST /auth/login` (RF02)
**Request** `{ "email": "ana@example.test", "senha": "SenhaForte2026" }`
**200** — define cookies; body `{ "usuario": { "id": "5b1c...", "nome": "Ana Souza", "email": "ana@example.test" } }`
**Erros:** 401 `CREDENCIAIS_INVALIDAS` (mensagem idêntica para e-mail inexistente e senha errada) · 423 `CONTA_BLOQUEADA` (`"bloqueadoAte": "2026-11-26T02:45:00Z"` em extensão do problem) · 429.

### E04 — `POST /auth/refresh` (RF02)
Sem body. Usa cookie `refresh_token`; rotaciona (novo refresh, invalida anterior).
**204 No Content** — novos cookies.
**Erros:** 401 `NAO_AUTENTICADO` (ausente/expirado/revogado) · 401 com reuso detectado → família revogada (CA02.4).

### E05 — `POST /auth/logout` (RF02)
**204** — revoga sessão atual e limpa cookies.

### E06 — `GET /me` (RF03)
**200**
```json
{ "id": "5b1c...", "nome": "Ana Souza", "email": "ana@example.test", "termosVersao": "2026-11", "criadoEm": "2026-11-26T02:30:00Z" }
```

### E07 — `PATCH /me` (RF03)
**Request** `{ "nome": "Ana S. Souza" }` (troca de e-mail/senha fora do MVP)
**200** — usuário atualizado · **422** `VALIDACAO`.

### E08 — `GET /me/export` (RF03)
**200** — `Content-Disposition: attachment; filename="meus-dados-2026-11-26.json"`
```json
{
  "geradoEm": "2026-11-26T02:30:00Z",
  "usuario": { "nome": "Ana Souza", "email": "ana@example.test", "criadoEm": "..." },
  "periodos": [
    {
      "nome": "2026.2",
      "disciplinas": [
        {
          "nome": "Cálculo I", "metodoCalculo": "PONDERADA", "notaMinimaAprovacao": 6.0,
          "avaliacoes": [
            { "nome": "P1", "peso": 40, "nota": 8.0, "historico": [ { "acao": "LANCADA", "notaNova": 8.0, "criadoEm": "..." } ] }
          ]
        }
      ]
    }
  ]
}
```

### E09 — `DELETE /me` (RF03)
**Request** `{ "senha": "SenhaForte2026", "confirmacao": "EXCLUIR MINHA CONTA" }`
**204** — dados apagados, cookies limpos.
**Erros:** 401 `CREDENCIAIS_INVALIDAS` (CA03.3) · 422 `VALIDACAO` (frase incorreta).

---

## 5. F1 — Períodos, disciplinas e avaliações

### E10 — `GET /periodos` (RF04)
**200**
```json
{
  "itens": [
    { "id": "p-1...", "nome": "2026.2", "dataInicio": "2026-08-03", "dataFim": "2026-12-12", "totalDisciplinas": 6, "versao": 1, "criadoEm": "..." }
  ]
}
```
Ordenação: `dataInicio DESC NULLS LAST, criadoEm DESC`.

### E11 — `POST /periodos` (RF04)
**Request** `{ "nome": "2026.2", "dataInicio": "2026-08-03", "dataFim": "2026-12-12" }`
**201** — objeto período (header `Location: /api/v1/periodos/{id}`).
**Erros:** 409 `NOME_DUPLICADO` · 422 `VALIDACAO` (datas) · 422 `LIMITE_ATINGIDO` (20).

### E12 — `GET /periodos/{periodoId}` → **200** período · **404**.

### E13 — `PATCH /periodos/{periodoId}` (RF04)
**Request** `{ "nome": "2026/2", "versao": 1 }` → **200** (versao=2) · 404 · 409 `NOME_DUPLICADO` · 409 `CONFLITO_VERSAO` · 422.

### E14 — `DELETE /periodos/{periodoId}?confirmar=true` (RF04, CA04.4)
- Sem `confirmar=true` e com disciplinas → **409** `CONFIRMACAO_NECESSARIA`:
```json
{ "status": 409, "code": "CONFIRMACAO_NECESSARIA", "title": "Confirmação necessária",
  "impacto": { "disciplinas": 6, "avaliacoes": 24, "notasLancadas": 10 } }
```
- Com confirmação → **204**. · **404**.

### E15 — `GET /periodos/{periodoId}/disciplinas` (RF05)
**200**
```json
{
  "itens": [
    { "id": "d-1...", "nome": "Cálculo I", "codigo": "MAT101", "metodoCalculo": "PONDERADA",
      "notaMinimaAprovacao": 6.0, "casasDecimais": 1, "totalAvaliacoes": 3, "situacao": "EM_ANDAMENTO", "versao": 3 }
  ]
}
```

### E16 — `POST /periodos/{periodoId}/disciplinas` (RF05)
**Request**
```json
{
  "nome": "Cálculo I",
  "codigo": "MAT101",
  "metodoCalculo": "PONDERADA",
  "notaMinimaAprovacao": 6.0,
  "casasDecimais": 1,
  "permiteSubstitutiva": true,
  "permiteExameFinal": true,
  "notaMinimaExame": 4.0,
  "mediaAprovacaoExame": 5.0
}
```
Somente `nome` é obrigatório; demais têm padrões (CA05.1).
**201**
```json
{ "id": "d-1...", "periodoId": "p-1...", "nome": "Cálculo I", "codigo": "MAT101", "metodoCalculo": "PONDERADA",
  "notaMinimaAprovacao": 6.0, "casasDecimais": 1, "versao": 1, "avaliacoes": [],
  "desempenho": { "configuracaoCompleta": false, "somaPesos": 0, "situacao": "CONFIGURACAO_INCOMPLETA", "...": "..." } }
```
**Erros:** 404 (período) · 409 `NOME_DUPLICADO` · 422 `LIMITE_ATINGIDO` (15) · 422 `VALIDACAO`.

### E17 — `GET /disciplinas/{disciplinaId}` (RF05, RF09)
**200**
```json
{
  "id": "d-1...", "periodoId": "p-1...", "nome": "Cálculo I", "metodoCalculo": "PONDERADA",
  "notaMinimaAprovacao": 6.0, "casasDecimais": 1, "versao": 3,
  "avaliacoes": [
    { "id": "a-1...", "nome": "P1", "peso": 40, "nota": 5.0, "notaLancadaEm": "2026-09-20T15:00:00Z", "dataPrevista": "2026-09-20", "ordem": 0, "versao": 2 },
    { "id": "a-2...", "nome": "P2", "peso": 40, "nota": null, "notaLancadaEm": null, "dataPrevista": "2026-11-28", "ordem": 1, "versao": 1 },
    { "id": "a-3...", "nome": "Trabalho", "peso": 20, "nota": null, "notaLancadaEm": null, "dataPrevista": "2026-12-05", "ordem": 2, "versao": 1 }
  ],
  "desempenho": { "...": "objeto Desempenho (§1.3)" }
}
```

### E18 — `PATCH /disciplinas/{disciplinaId}` (RF05, RF07)
**Request**
```json
{ "nome": "Cálculo I", "metodoCalculo": "SIMPLES", "notaMinimaAprovacao": 7.0, "casasDecimais": 1, "versao": 3, "confirmar": true }
```
- Alteração de `metodoCalculo`, `notaMinimaAprovacao` ou `casasDecimais` **com notas lançadas** e sem `confirmar: true` → **409** `CONFIRMACAO_NECESSARIA` com prévia (`desempenhoAtual`, `desempenhoNovo`).
- **200** — disciplina completa com `desempenho` recalculado; evento `DISCIPLINA_CRITERIO_ALTERADO` auditado.
- **Erros:** 404 · 409 `CONFLITO_VERSAO` · 409 `NOME_DUPLICADO` · 422.

### E19 — `DELETE /disciplinas/{disciplinaId}?confirmar=true`
Mesma semântica de confirmação de E14 quando há notas lançadas. **204** · 404 · 409.

### E20 — `POST /disciplinas/{disciplinaId}/avaliacoes` (RF06)
**Request** `{ "nome": "Trabalho", "peso": 20, "dataPrevista": "2026-12-05" }`
**201**
```json
{
  "avaliacao": { "id": "a-3...", "nome": "Trabalho", "peso": 20, "nota": null, "dataPrevista": "2026-12-05", "ordem": 2, "versao": 1 },
  "desempenho": { "configuracaoCompleta": true, "somaPesos": 100, "situacao": "EM_ANDAMENTO", "...": "..." }
}
```
**Erros:**
- 422 `SOMA_PESOS_EXCEDIDA` (CA06.2):
```json
{ "status": 422, "code": "SOMA_PESOS_EXCEDIDA", "title": "Soma de pesos excede 100%",
  "detail": "Restam 10 pontos percentuais disponíveis.", "somaAtual": 90, "disponivel": 10 }
```
- 409 `NOME_DUPLICADO` · 422 `LIMITE_ATINGIDO` (20) · 404.
- Em `SIMPLES`, `peso` é opcional (armazenado como `100/n` informativo; ignorado no cálculo).

### E21 — `PATCH /avaliacoes/{avaliacaoId}` (RF06, RF07)
**Request** `{ "nome": "P2", "peso": 35, "dataPrevista": "2026-11-28", "versao": 1, "confirmar": true }`
- Alterar `peso` de disciplina com notas lançadas exige `confirmar: true` (RN12).
- **200** `{ "avaliacao": {...}, "desempenho": {...} }` · 404 · 409 `CONFLITO_VERSAO` · 409 `CONFIRMACAO_NECESSARIA` · 422 `SOMA_PESOS_EXCEDIDA`.

### E22 — `DELETE /avaliacoes/{avaliacaoId}?confirmar=true` (RF06, CA06.4)
- Com nota lançada e sem confirmação → 409 `CONFIRMACAO_NECESSARIA`.
- **200** `{ "desempenho": {...} }` (retorna desempenho recalculado) · 404.

### E23 — `PUT /disciplinas/{disciplinaId}/avaliacoes/ordem`
**Request** `{ "ordem": ["a-2...", "a-1...", "a-3..."] }` (deve conter exatamente todas as avaliações da disciplina)
**204** · 404 · 422 `VALIDACAO`.

---

## 6. F2 — Notas e média

### E24 — `PUT /avaliacoes/{avaliacaoId}/nota` (RF08, RF11)
Idempotente: lança ou altera.
**Request** `{ "nota": 7.5, "versao": 1 }`
| Campo | Regra |
|---|---|
| `nota` | number 0–10, máx. 2 casas (a UI converte vírgula → ponto, CA08.4) |
| `versao` | versão atual da avaliação |

**200**
```json
{
  "avaliacao": { "id": "a-2...", "nome": "P2", "peso": 40, "nota": 7.5, "notaLancadaEm": "2026-11-28T18:00:00Z", "versao": 2 },
  "historico": { "acao": "LANCADA", "notaAnterior": null, "notaNova": 7.5, "criadoEm": "2026-11-28T18:00:00Z" },
  "desempenho": { "...": "objeto Desempenho" }
}
```
**Erros:** 404 · 409 `CONFLITO_VERSAO` · 422 `VALIDACAO` (`FORA_DO_INTERVALO`, `CASAS_DECIMAIS`).
Se a nota enviada for igual à atual → 200 sem novo registro de histórico.

### E25 — `DELETE /avaliacoes/{avaliacaoId}/nota?versao=2` (RF08, CA08.3)
**200** — `{ "avaliacao": { "nota": null, "versao": 3, "...": "..." }, "historico": { "acao": "REMOVIDA", "notaAnterior": 7.5, "notaNova": null }, "desempenho": {...} }`
**Erros:** 404 · 409 `CONFLITO_VERSAO` · 422 (avaliação já pendente → `code: "NOTA_INEXISTENTE"`).

### E26 — `GET /avaliacoes/{avaliacaoId}/historico?limite=20&cursor=...` (RF11)
**200**
```json
{
  "itens": [
    { "id": "h-2...", "acao": "ALTERADA", "notaAnterior": 6.0, "notaNova": 7.0, "criadoEm": "2026-10-02T12:00:00Z" },
    { "id": "h-1...", "acao": "LANCADA", "notaAnterior": null, "notaNova": 6.0, "criadoEm": "2026-10-01T12:00:00Z" }
  ],
  "proximoCursor": null
}
```
Ordenação `criadoEm DESC`; `limite` 1–100 (padrão 20). Não existem `PUT/PATCH/DELETE` (CA11.3 → **405**).

### E27 — `GET /disciplinas/{disciplinaId}/desempenho` (RF09, RF10, RF15)
**200** — objeto `Desempenho` (§1.3). Exemplo CA09.1 (`P1=8 (40)`, `P2=6 (40)`, `T=9 (20)`):
```json
{
  "configuracaoCompleta": true, "somaPesos": 100, "pesoLancado": 100, "pesoPendente": 0,
  "pontosAcumulados": 7.4, "pontosAcumuladosExata": "7.4000",
  "mediaParcial": 7.4, "mediaParcialExata": "7.4000",
  "mediaRegular": 7.4, "mediaRegularExata": "7.4000",
  "mediaFinal": 7.4, "mediaFinalExata": "7.4000",
  "notaMinimaAprovacao": 6.0,
  "notaNecessaria": { "status": "NAO_APLICAVEL", "valor": null, "valorExato": null, "maximoAtingivel": 7.4 },
  "situacao": "APROVADO"
}
```

### E32 — `PUT /disciplinas/{disciplinaId}/substitutiva` (RF08, RN19)
Lança ou altera a nota da Prova Substitutiva da disciplina.
**Request** `{ "nota": 8.0, "versao": 3 }`
**200**
```json
{
  "disciplinaId": "d-1...",
  "notaSubstitutiva": 8.0,
  "notaSubstitutivaEm": "2026-12-08T18:00:00Z",
  "avaliacaoSubstituidaId": "a-1...",
  "versao": 4,
  "historico": { "tipoAlvo": "SUBSTITUTIVA", "acao": "LANCADA", "notaAnterior": null, "notaNova": 8.0 },
  "desempenho": { "...": "objeto Desempenho recalculado" }
}
```
**Erros:** 404 · 409 `CONFLITO_VERSAO` · 422 `VALIDACAO` (`SUBSTITUTIVA_DESABILITADA` se `permiteSubstitutiva = false`, ou `AVALIACOES_REGULARES_PENDENTES`).

### E33 — `DELETE /disciplinas/{disciplinaId}/substitutiva?versao=4` (RF08, RN19)
Remove a nota da Prova Substitutiva e restaura o cálculo com as notas originais.
**200** `{ "notaSubstitutiva": null, "versao": 5, "historico": { "tipoAlvo": "SUBSTITUTIVA", "acao": "REMOVIDA", "notaAnterior": 8.0, "notaNova": null }, "desempenho": {...} }`

### E34 — `PUT /disciplinas/{disciplinaId}/exame-final` (RF08, RN20, RN21)
Lança ou altera a nota do Exame Final da disciplina.
**Request** `{ "nota": 5.5, "versao": 4 }`
**200**
```json
{
  "disciplinaId": "d-1...",
  "notaExame": 5.5,
  "notaExameEm": "2026-12-12T18:00:00Z",
  "versao": 5,
  "historico": { "tipoAlvo": "EXAME_FINAL", "acao": "LANCADA", "notaAnterior": null, "notaNova": 5.5 },
  "desempenho": { "mediaRegular": 5.0, "exameFinal": { "notaExame": 5.5, "mediaPosExame": 5.3 }, "mediaFinal": 5.3, "situacao": "APROVADO_POS_EXAME" }
}
```
**Erros:** 404 · 409 `CONFLITO_VERSAO` · 422 `VALIDACAO` (`EXAME_NAO_ELEGIVEL` se a disciplina não está na faixa de exame ou `permiteExameFinal = false`).

### E35 — `DELETE /disciplinas/{disciplinaId}/exame-final?versao=5` (RF08, RN20, RN21)
Remove a nota do Exame Final, retornando a disciplina para `EM_EXAME_FINAL`.
**200** `{ "notaExame": null, "versao": 6, "historico": { "tipoAlvo": "EXAME_FINAL", "acao": "REMOVIDA", "notaAnterior": 5.5, "notaNova": null }, "desempenho": {...} }`

---

## 7. F3 — Simulador e painel

### E28 — `GET /disciplinas/{disciplinaId}/nota-necessaria?alvo=7.0` (RF12)
`alvo` opcional (0–10, máx. 2 casas); padrão = `notaMinimaAprovacao`.
**200**
```json
{ "alvo": 6.0, "status": "NECESSARIA", "valor": 6.7, "valorExato": "6.6667", "maximoAtingivel": 8.0,
  "avaliacoesPendentes": [ { "id": "a-2...", "nome": "P2", "peso": 40 }, { "id": "a-3...", "nome": "Trabalho", "peso": 20 } ] }
```
Outros `status`: `JA_ATINGIDO` (`valor: null`), `INVIAVEL` (`valor` = necessário exato, ex.: 20.0, com `maximoAtingivel`), `NAO_APLICAVEL`.
**Erros:** 404 · 422 `VALIDACAO` (alvo fora de 0–10, CA12.4).

### E29 — `POST /disciplinas/{disciplinaId}/simulacoes` (RF13)
Não persiste nada (RN13).
**Request**
```json
{ "notasHipoteticas": [ { "avaliacaoId": "a-2...", "nota": 7.0 }, { "avaliacaoId": "a-3...", "nota": 8.0 } ] }
```
**200**
```json
{
  "persistido": false,
  "desempenhoAtual": { "situacao": "EM_RISCO", "mediaFinal": null, "...": "..." },
  "desempenhoSimulado": { "situacao": "APROVADO", "mediaFinal": 6.4, "mediaFinalExata": "6.4000", "...": "..." }
}
```
Cálculo do exemplo: (5×40 + 7×40 + 8×20)/100 = 6,4.
**Erros:** 404 · 422 `VALIDACAO` (`avaliacaoId` não pertencente à disciplina — CA13.3; IDs duplicados; nota inválida; máx. 20 itens).

### E30 — `POST /disciplinas/{disciplinaId}/previa-criterios` (RF07, CA07.1)
Calcula o efeito de mudar critérios sem salvar.
**Request** `{ "metodoCalculo": "PONDERADA", "notaMinimaAprovacao": 6.0, "casasDecimais": 1, "pesos": [ { "avaliacaoId": "a-1...", "peso": 50 } ] }`
**200** `{ "desempenhoAtual": {...}, "desempenhoNovo": {...} }` · 404 · 422.

### E31 — `GET /periodos/{periodoId}/painel` (RF14, RF15)
**200**
```json
{
  "periodo": { "id": "p-1...", "nome": "2026.2" },
  "resumo": { "totalDisciplinas": 6, "porSituacao": { "EM_RISCO": 1, "REPROVACAO_INEVITAVEL": 0, "CONFIGURACAO_INCOMPLETA": 1, "EM_ANDAMENTO": 3, "APROVACAO_GARANTIDA": 1 } },
  "disciplinas": [
    {
      "id": "d-1...", "nome": "Cálculo I", "situacao": "EM_RISCO", "prioridade": 2,
      "mediaParcial": 5.0, "pontosAcumulados": 2.0, "mediaFinal": null,
      "notaNecessaria": { "status": "NECESSARIA", "valor": 6.7 },
      "proximaAvaliacao": { "id": "a-2...", "nome": "P2", "dataPrevista": "2026-11-28", "peso": 40 }
    }
  ],
  "proximasAvaliacoes": [
    { "disciplinaId": "d-1...", "disciplinaNome": "Cálculo I", "avaliacaoId": "a-2...", "nome": "P2", "dataPrevista": "2026-11-28" }
  ]
}
```
- Ordenação de `disciplinas` por `prioridade` (1 = `REPROVACAO_INEVITAVEL`, 2 = `EM_RISCO`, 3 = `CONFIGURACAO_INCOMPLETA`, 4 = demais) e depois por nome (CA14.1).
- `proximasAvaliacoes`: pendentes com `dataPrevista >= hoje` (fuso `America/Sao_Paulo`), até 10.
- **Erros:** 404.
- **SLO:** p95 < 300 ms (RNF01).

---

## 8. Matriz de rastreabilidade RF → endpoints → testes

| RF | Endpoints | Casos de teste de liberação (tasks.md §5) |
|---|---|---|
| RF01–RF03 | E02–E09 | CT05 |
| RF04–RF07 | E10–E23, E30 | CT04 |
| RF08–RF11 | E24–E27 | CT01, CT02 |
| RF12–RF15 | E27–E29, E31 | CT03 |
| RN01 (isolamento) | todos os autenticados | CT04 |
