import { NextRequest, NextResponse } from "next/server";
import { UpdateAvaliacaoSchema } from "@app/contracts";
import { applyStandardHeaders, parseJsonBody, requireAuth, withApiHandler } from "@/lib/http";

type Ctx = { params: Promise<{ avaliacaoId: string }> };

/** E21 — PATCH /api/v1/avaliacoes/{avaliacaoId} (RF06, RF07) */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { avaliacaoId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const body = await parseJsonBody(req, UpdateAvaliacaoSchema);
    const data = await container.avaliacoes.update(usuarioId, avaliacaoId, body);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}

/** E22 — DELETE /api/v1/avaliacoes/{avaliacaoId}?confirmar=true (RF06 / CA06.4) */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { avaliacaoId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const confirmar = req.nextUrl.searchParams.get("confirmar") === "true";
    const data = await container.avaliacoes.delete(usuarioId, avaliacaoId, confirmar);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}
