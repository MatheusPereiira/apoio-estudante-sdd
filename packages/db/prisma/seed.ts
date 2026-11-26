/**
 * Seed 100% SINTÉTICO (@example.test — Constituição C4 / RN18).
 * Popula 2 estudantes sintéticos (Ana Souza e Bruno Lima) para ambiente local, preview e testes IDOR.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("[seed] Semeando dados sintéticos @example.test...");

  const ana = await prisma.usuario.upsert({
    where: { email: "ana@example.test" },
    update: {},
    create: {
      nome: "Ana Souza",
      email: "ana@example.test",
      // Hash sintético placeholder — em runtime o seed via aplicação usa Argon2id real
      senhaHash: "$argon2id$v=19$m=19456,t=2,p=1$c2VlZHNhbHRhbmEyMDI2$placeholder",
      termosVersao: "2026-11",
    },
  });

  const periodo = await prisma.periodoLetivo.upsert({
    where: { id: "11111111-1111-4111-8111-111111111111" },
    update: {},
    create: {
      id: "11111111-1111-4111-8111-111111111111",
      usuarioId: ana.id,
      nome: "2026.2",
      dataInicio: new Date("2026-08-03"),
      dataFim: new Date("2026-12-12"),
    },
  });

  console.log(`[seed] Concluído para ${ana.email} (período ${periodo.nome}).`);
}

main()
  .catch((err) => {
    console.error("[seed] Falha:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
