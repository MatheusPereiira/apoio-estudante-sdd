import { NextRequest, NextResponse } from "next/server";
import { CreateAvaliacaoSchema } from "@app/contracts";
import { applyStandardHeaders, parseJsonBody, requireAuth, withApiHandler } from "@/lib/http";

type Ctx = { params: Promise<{ disciplinaId: string }> };

/** E20 — POST /api/v1/disciplinas/{disciplinaId}/avaliacoes (RF06) */
export async function POST(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { disciplinaId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const body = await parseJsonBody(req, CreateAvaliacaoSchema);
    const data = await container.avaliacoes.create(usuarioId, disciplinaId, body);
    return applyStandardHeaders(NextResponse.json(data, { status: 201 }), traceId, rateLimit);
  });
}
