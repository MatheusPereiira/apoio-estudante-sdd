import { PrismaClient } from "@prisma/client";
import {
  AuthService,
  AvaliacaoService,
  DisciplinaService,
  PainelService,
  PeriodoService,
  type AppRepositoryPort,
  type CryptoPort,
} from "@app/application";
import { NodeCryptoAdapter } from "./crypto.js";
import { SlidingWindowRateLimiter } from "./rate-limit.js";
import { InMemoryAppRepository } from "./repositories/memory-store.js";
import { PrismaAppRepository } from "./repositories/prisma-store.js";

export interface AppContainer {
  repo: AppRepositoryPort;
  crypto: CryptoPort;
  rateLimiter: SlidingWindowRateLimiter;
  auth: AuthService;
  periodos: PeriodoService;
  disciplinas: DisciplinaService;
  avaliacoes: AvaliacaoService;
  painel: PainelService;
}

export function createContainer(options?: {
  repo?: AppRepositoryPort;
  crypto?: CryptoPort;
}): AppContainer {
  const repo =
    options?.repo ??
    (process.env.DATABASE_URL
      ? new PrismaAppRepository(new PrismaClient())
      : new InMemoryAppRepository());
  const crypto = options?.crypto ?? new NodeCryptoAdapter();
  const rateLimiter = new SlidingWindowRateLimiter();

  return {
    repo,
    crypto,
    rateLimiter,
    auth: new AuthService(repo, crypto),
    periodos: new PeriodoService(repo),
    disciplinas: new DisciplinaService(repo),
    avaliacoes: new AvaliacaoService(repo),
    painel: new PainelService(repo),
  };
}

/**
 * Semeia conta sintética demonstrativa (`ana@example.test` / `SenhaForte2026`)
 * reproduzindo os cenários do wireframe de docs/ui-ux-spec.md §4 (Constituição C4).
 */
export async function seedDemoIfMemory(container: AppContainer): Promise<void> {
  if (!(container.repo instanceof InMemoryAppRepository)) return;
  const existing = await container.repo.findUsuarioByEmail("ana@example.test");
  if (existing) return;

  const { usuario } = await container.auth.register({
    nome: "Ana Souza",
    email: "ana@example.test",
    senha: "SenhaForte2026",
    aceiteTermos: true,
    termosVersao: "2026-11",
  });

  const periodo = await container.periodos.create(usuario.id, {
    nome: "2026.2",
    dataInicio: "2026-08-03",
    dataFim: "2026-12-12",
  });

  // 1. Física I — EM_EXAME_FINAL (com Substitutiva aplicada)
  const fisica = await container.disciplinas.create(usuario.id, periodo.id, {
    nome: "Física I",
    codigo: "FIS102",
    metodoCalculo: "PONDERADA",
    notaMinimaAprovacao: 6.0,
    casasDecimais: 1,
    permiteSubstitutiva: true,
    permiteExameFinal: true,
    notaMinimaExame: 4.0,
    mediaAprovacaoExame: 5.0,
  });
  const fp1 = await container.avaliacoes.create(usuario.id, fisica.id, {
    nome: "P1",
    peso: 50,
    elegivelSubstitutiva: true,
    dataPrevista: "2026-09-15",
  });
  const fp2 = await container.avaliacoes.create(usuario.id, fisica.id, {
    nome: "P2",
    peso: 50,
    elegivelSubstitutiva: true,
    dataPrevista: "2026-11-10",
  });
  await container.avaliacoes.setNota(usuario.id, fp1.avaliacao.id, { nota: 4.0, versao: 1 });
  await container.avaliacoes.setNota(usuario.id, fp2.avaliacao.id, { nota: 6.0, versao: 1 });

  // 2. Cálculo I — EM_RISCO (P1=5.0/40%, P2 pendente 40%, Trabalho pendente 20% -> precisa 6,7)
  const calculo = await container.disciplinas.create(usuario.id, periodo.id, {
    nome: "Cálculo I",
    codigo: "MAT101",
    metodoCalculo: "PONDERADA",
    notaMinimaAprovacao: 6.0,
    casasDecimais: 1,
    permiteSubstitutiva: true,
    permiteExameFinal: true,
    notaMinimaExame: 4.0,
    mediaAprovacaoExame: 5.0,
  });
  const cp1 = await container.avaliacoes.create(usuario.id, calculo.id, {
    nome: "P1",
    peso: 40,
    elegivelSubstitutiva: true,
    dataPrevista: "2026-09-20",
  });
  await container.avaliacoes.create(usuario.id, calculo.id, {
    nome: "P2",
    peso: 40,
    elegivelSubstitutiva: true,
    dataPrevista: "2026-11-28",
  });
  await container.avaliacoes.create(usuario.id, calculo.id, {
    nome: "Trabalho",
    peso: 20,
    elegivelSubstitutiva: false,
    dataPrevista: "2026-12-05",
  });
  await container.avaliacoes.setNota(usuario.id, cp1.avaliacao.id, { nota: 5.0, versao: 1 });

  // 3. Algoritmos — CONFIGURACAO_INCOMPLETA (soma 80%)
  const algoritmos = await container.disciplinas.create(usuario.id, periodo.id, {
    nome: "Algoritmos e Estruturas de Dados",
    codigo: "INF101",
    metodoCalculo: "PONDERADA",
    notaMinimaAprovacao: 6.0,
    casasDecimais: 1,
    permiteSubstitutiva: true,
    permiteExameFinal: true,
    notaMinimaExame: 4.0,
    mediaAprovacaoExame: 5.0,
  });
  await container.avaliacoes.create(usuario.id, algoritmos.id, {
    nome: "P1",
    peso: 40,
    elegivelSubstitutiva: true,
    dataPrevista: "2026-10-05",
  });
  await container.avaliacoes.create(usuario.id, algoritmos.id, {
    nome: "Projeto Prático",
    peso: 40,
    elegivelSubstitutiva: false,
    dataPrevista: "2026-12-02",
  });

  // 4. Engenharia de Software — APROVADO (média 7,4)
  const engSoft = await container.disciplinas.create(usuario.id, periodo.id, {
    nome: "Engenharia de Software",
    codigo: "ESW201",
    metodoCalculo: "PONDERADA",
    notaMinimaAprovacao: 6.0,
    casasDecimais: 1,
    permiteSubstitutiva: true,
    permiteExameFinal: true,
    notaMinimaExame: 4.0,
    mediaAprovacaoExame: 5.0,
  });
  const ep1 = await container.avaliacoes.create(usuario.id, engSoft.id, {
    nome: "Sprint 1",
    peso: 40,
    elegivelSubstitutiva: true,
    dataPrevista: "2026-09-30",
  });
  const ep2 = await container.avaliacoes.create(usuario.id, engSoft.id, {
    nome: "Sprint 2",
    peso: 40,
    elegivelSubstitutiva: true,
    dataPrevista: "2026-10-30",
  });
  const et = await container.avaliacoes.create(usuario.id, engSoft.id, {
    nome: "Entrega Final",
    peso: 20,
    elegivelSubstitutiva: false,
    dataPrevista: "2026-11-20",
  });
  await container.avaliacoes.setNota(usuario.id, ep1.avaliacao.id, { nota: 8.0, versao: 1 });
  await container.avaliacoes.setNota(usuario.id, ep2.avaliacao.id, { nota: 6.0, versao: 1 });
  await container.avaliacoes.setNota(usuario.id, et.avaliacao.id, { nota: 9.0, versao: 1 });
}

const globalForContainer = globalThis as unknown as {
  __apoioEstudanteContainer?: AppContainer;
  __apoioEstudanteSeeded?: Promise<void>;
};

export async function getAppContainer(): Promise<AppContainer> {
  if (!globalForContainer.__apoioEstudanteContainer) {
    globalForContainer.__apoioEstudanteContainer = createContainer();
  }
  if (!globalForContainer.__apoioEstudanteSeeded) {
    globalForContainer.__apoioEstudanteSeeded = seedDemoIfMemory(
      globalForContainer.__apoioEstudanteContainer
    );
  }
  await globalForContainer.__apoioEstudanteSeeded;
  return globalForContainer.__apoioEstudanteContainer;
}
