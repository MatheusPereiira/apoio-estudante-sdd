import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/http";

/** E01 — GET /api/v1/health (RNF04 / Tarefa T06) */
export async function GET() {
  return withApiHandler(async (container) => {
    const ok = await container.repo.ping();
    if (!ok) {
      return NextResponse.json(
        { status: "degradado", banco: "indisponivel", horario: new Date().toISOString() },
        { status: 503 }
      );
    }
    return NextResponse.json({
      status: "ok",
      versao: process.env.APP_VERSION ?? "1.1.0",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      banco: "ok",
      horario: new Date().toISOString(),
    });
  });
}
