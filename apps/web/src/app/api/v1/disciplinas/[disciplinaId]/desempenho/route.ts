import { NextRequest, NextResponse } from "next/server";
import { applyStandardHeaders, requireAuth, withApiHandler } from "@/lib/http";

type Ctx = { params: Promise<{ disciplinaId: string }> };

/** E27 — GET /api/v1/disciplinas/{disciplinaId}/desempenho (RF09, RF10, RF15) */
export async function GET(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { disciplinaId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container, { checkCsrf: false });
    const data = await container.painel.getDesempenho(usuarioId, disciplinaId);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}
