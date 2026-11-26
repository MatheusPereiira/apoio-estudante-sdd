-- Migração inicial PostgreSQL 16 — Plataforma de Apoio ao Estudante Universitário
-- Rastreável a docs/data-model.md (spec-v1.1.0) · Tarefa T07 (Risco A)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TYPE "metodo_calculo" AS ENUM ('SIMPLES', 'PONDERADA');
CREATE TYPE "acao_nota" AS ENUM ('LANCADA', 'ALTERADA', 'REMOVIDA');
CREATE TYPE "tipo_alvo_nota" AS ENUM ('REGULAR', 'SUBSTITUTIVA', 'EXAME_FINAL');

CREATE TABLE "usuario" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" VARCHAR(120) NOT NULL CHECK (length(trim("nome")) BETWEEN 2 AND 120),
  "email" CITEXT NOT NULL UNIQUE,
  "senha_hash" VARCHAR(255) NOT NULL,
  "termos_versao" VARCHAR(20) NOT NULL,
  "termos_aceitos_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "tentativas_falhas" SMALLINT NOT NULL DEFAULT 0 CHECK ("tentativas_falhas" >= 0),
  "bloqueado_ate" TIMESTAMPTZ,
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "sessao" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" UUID NOT NULL REFERENCES "usuario"("id") ON DELETE CASCADE,
  "familia_id" UUID NOT NULL,
  "refresh_token_hash" CHAR(64) NOT NULL UNIQUE,
  "user_agent" VARCHAR(255),
  "ip_hash" CHAR(64),
  "expira_em" TIMESTAMPTZ NOT NULL,
  "revogada_em" TIMESTAMPTZ,
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "sessao_usuario_id_idx" ON "sessao"("usuario_id");
CREATE INDEX "sessao_familia_id_idx" ON "sessao"("familia_id");
CREATE INDEX "sessao_expira_em_idx" ON "sessao"("expira_em");

CREATE TABLE "periodo_letivo" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" UUID NOT NULL REFERENCES "usuario"("id") ON DELETE CASCADE,
  "nome" VARCHAR(40) NOT NULL CHECK (length(trim("nome")) >= 1),
  "data_inicio" DATE,
  "data_fim" DATE CHECK ("data_fim" IS NULL OR "data_inicio" IS NULL OR "data_fim" >= "data_inicio"),
  "versao" INTEGER NOT NULL DEFAULT 1,
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("id", "usuario_id")
);

CREATE UNIQUE INDEX "periodo_letivo_usuario_nome_uk" ON "periodo_letivo"("usuario_id", lower("nome"));
CREATE INDEX "periodo_letivo_usuario_criado_idx" ON "periodo_letivo"("usuario_id", "criado_em" DESC);

CREATE TABLE "disciplina" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" UUID NOT NULL REFERENCES "usuario"("id") ON DELETE CASCADE,
  "periodo_id" UUID NOT NULL,
  "nome" VARCHAR(120) NOT NULL CHECK (length(trim("nome")) >= 1),
  "codigo" VARCHAR(20),
  "metodo_calculo" "metodo_calculo" NOT NULL DEFAULT 'PONDERADA',
  "nota_minima_aprovacao" NUMERIC(4,2) NOT NULL DEFAULT 6.00 CHECK ("nota_minima_aprovacao" BETWEEN 0 AND 10),
  "casas_decimais" SMALLINT NOT NULL DEFAULT 1 CHECK ("casas_decimais" IN (0, 1, 2)),
  "permite_substitutiva" BOOLEAN NOT NULL DEFAULT true,
  "nota_substitutiva" NUMERIC(4,2) CHECK ("nota_substitutiva" IS NULL OR "nota_substitutiva" BETWEEN 0 AND 10),
  "nota_substitutiva_em" TIMESTAMPTZ,
  "permite_exame_final" BOOLEAN NOT NULL DEFAULT true,
  "nota_minima_exame" NUMERIC(4,2) NOT NULL DEFAULT 4.00 CHECK ("nota_minima_exame" BETWEEN 0 AND "nota_minima_aprovacao"),
  "media_aprovacao_exame" NUMERIC(4,2) NOT NULL DEFAULT 5.00 CHECK ("media_aprovacao_exame" BETWEEN 0 AND 10),
  "nota_exame" NUMERIC(4,2) CHECK ("nota_exame" IS NULL OR "nota_exame" BETWEEN 0 AND 10),
  "nota_exame_em" TIMESTAMPTZ,
  "versao" INTEGER NOT NULL DEFAULT 1,
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (("nota_substitutiva" IS NULL) = ("nota_substitutiva_em" IS NULL)),
  CHECK (("nota_exame" IS NULL) = ("nota_exame_em" IS NULL)),
  UNIQUE ("id", "usuario_id"),
  FOREIGN KEY ("periodo_id", "usuario_id") REFERENCES "periodo_letivo"("id", "usuario_id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "disciplina_periodo_nome_uk" ON "disciplina"("periodo_id", lower("nome"));
CREATE INDEX "disciplina_usuario_periodo_idx" ON "disciplina"("usuario_id", "periodo_id");

CREATE TABLE "avaliacao" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" UUID NOT NULL REFERENCES "usuario"("id") ON DELETE CASCADE,
  "disciplina_id" UUID NOT NULL,
  "nome" VARCHAR(80) NOT NULL CHECK (length(trim("nome")) >= 1),
  "peso" NUMERIC(5,2) NOT NULL CHECK ("peso" > 0 AND "peso" <= 100),
  "nota" NUMERIC(4,2) CHECK ("nota" IS NULL OR "nota" BETWEEN 0 AND 10),
  "nota_lancada_em" TIMESTAMPTZ,
  "elegivel_substitutiva" BOOLEAN NOT NULL DEFAULT true,
  "data_prevista" DATE,
  "ordem" SMALLINT NOT NULL DEFAULT 0 CHECK ("ordem" >= 0),
  "versao" INTEGER NOT NULL DEFAULT 1,
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (("nota" IS NULL) = ("nota_lancada_em" IS NULL)),
  FOREIGN KEY ("disciplina_id", "usuario_id") REFERENCES "disciplina"("id", "usuario_id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "avaliacao_disciplina_nome_uk" ON "avaliacao"("disciplina_id", lower("nome"));
CREATE INDEX "avaliacao_disciplina_ordem_idx" ON "avaliacao"("disciplina_id", "ordem");
CREATE INDEX "avaliacao_proximas_idx" ON "avaliacao"("usuario_id", "data_prevista") WHERE "nota" IS NULL;

-- Constraint Trigger RN03: impede SUM(peso) > 100 por disciplina ao fim da transação
CREATE OR REPLACE FUNCTION "validar_soma_pesos_disciplina"() RETURNS TRIGGER AS $$
DECLARE
  v_soma NUMERIC(6,2);
  v_metodo "metodo_calculo";
BEGIN
  SELECT "metodo_calculo" INTO v_metodo FROM "disciplina" WHERE "id" = NEW."disciplina_id";
  IF v_metodo = 'PONDERADA' THEN
    SELECT COALESCE(SUM("peso"), 0) INTO v_soma FROM "avaliacao" WHERE "disciplina_id" = NEW."disciplina_id";
    IF v_soma > 100.00 THEN
      RAISE EXCEPTION 'SOMA_PESOS_EXCEDIDA: soma atual % excede 100%%', v_soma;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "trg_validar_soma_pesos"
AFTER INSERT OR UPDATE OF "peso" ON "avaliacao"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validar_soma_pesos_disciplina"();

CREATE TABLE "historico_nota" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" UUID NOT NULL REFERENCES "usuario"("id") ON DELETE CASCADE,
  "disciplina_id" UUID NOT NULL REFERENCES "disciplina"("id") ON DELETE CASCADE,
  "avaliacao_id" UUID REFERENCES "avaliacao"("id") ON DELETE CASCADE,
  "tipo_alvo" "tipo_alvo_nota" NOT NULL DEFAULT 'REGULAR',
  "acao" "acao_nota" NOT NULL,
  "nota_anterior" NUMERIC(4,2),
  "nota_nova" NUMERIC(4,2),
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (("tipo_alvo" = 'REGULAR') = ("avaliacao_id" IS NOT NULL)),
  CHECK ("acao" <> 'LANCADA' OR "nota_anterior" IS NULL),
  CHECK ("acao" <> 'REMOVIDA' OR "nota_nova" IS NULL)
);

CREATE INDEX "historico_nota_disciplina_idx" ON "historico_nota"("disciplina_id", "criado_em" DESC);
CREATE INDEX "historico_nota_avaliacao_idx" ON "historico_nota"("avaliacao_id", "criado_em" DESC);

CREATE TABLE "evento_auditoria" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" UUID REFERENCES "usuario"("id") ON DELETE SET NULL,
  "tipo" VARCHAR(60) NOT NULL,
  "metadados" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "evento_auditoria_usuario_idx" ON "evento_auditoria"("usuario_id", "criado_em" DESC);
CREATE INDEX "evento_auditoria_tipo_idx" ON "evento_auditoria"("tipo", "criado_em" DESC);
