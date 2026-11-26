import { NextRequest, NextResponse } from "next/server";
import { UpdatePeriodoSchema } from "@app/contracts";
import { applyStandardHeaders, parseJsonBody, requireAuth, withApiHandler } from "@/lib/http";

type Ctx = { params: Promise<{ periodoId: string }> };

/** E12 — GET /api/v1/periodos/{periodoId} */
export async function GET(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { periodoId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container, { checkCsrf: false });
    const data = await container.periodos.getById(usuarioId, periodoId);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}

/** E13 — PATCH /api/v1/periodos/{periodoId} */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { periodoId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const body = await parseJsonBody(req, UpdatePeriodoSchema);
    const data = await container.periodos.update(usuarioId, periodoId, body);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}

/** E14 — DELETE /api/v1/periodos/{periodoId}?confirmar=true */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { periodoId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const confirmar = req.nextUrl.searchParams.get("confirmar") === "true";
    await container.periodos.delete(usuarioId, periodoId, confirmar);
    return applyStandardHeaders(new NextResponse(null, { status: 204 }), traceId, rateLimit);
  });
}
