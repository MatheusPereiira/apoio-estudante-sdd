import { NextRequest, NextResponse } from "next/server";
import { applyStandardHeaders, requireAuth, withApiHandler } from "@/lib/http";

type Ctx = { params: Promise<{ periodoId: string }> };

/** E31 — GET /api/v1/periodos/{periodoId}/painel (RF14 / RF15) */
export async function GET(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { periodoId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container, { checkCsrf: false });
    const data = await container.painel.getPainelPeriodo(usuarioId, periodoId);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}
