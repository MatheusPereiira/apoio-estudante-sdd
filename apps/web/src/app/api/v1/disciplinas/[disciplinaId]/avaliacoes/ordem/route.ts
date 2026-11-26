import { NextRequest, NextResponse } from "next/server";
import { ReordenarAvaliacoesSchema } from "@app/contracts";
import { applyStandardHeaders, parseJsonBody, requireAuth, withApiHandler } from "@/lib/http";

type Ctx = { params: Promise<{ disciplinaId: string }> };

/** E23 — PUT /api/v1/disciplinas/{disciplinaId}/avaliacoes/ordem (RF06) */
export async function PUT(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { disciplinaId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const body = await parseJsonBody(req, ReordenarAvaliacoesSchema);
    await container.avaliacoes.reorder(usuarioId, disciplinaId, body.ordem);
    return applyStandardHeaders(new NextResponse(null, { status: 204 }), traceId, rateLimit);
  });
}
