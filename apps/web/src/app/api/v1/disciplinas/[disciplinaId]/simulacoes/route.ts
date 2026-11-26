import { NextRequest, NextResponse } from "next/server";
import { SimulacaoSchema } from "@app/contracts";
import { applyStandardHeaders, parseJsonBody, requireAuth, withApiHandler } from "@/lib/http";

type Ctx = { params: Promise<{ disciplinaId: string }> };

/** E29 — POST /api/v1/disciplinas/{disciplinaId}/simulacoes (RF13 / RN13) */
export async function POST(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { disciplinaId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const body = await parseJsonBody(req, SimulacaoSchema);
    const data = await container.painel.simular(usuarioId, disciplinaId, body);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}
