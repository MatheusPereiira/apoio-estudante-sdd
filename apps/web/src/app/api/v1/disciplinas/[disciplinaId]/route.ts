import { NextRequest, NextResponse } from "next/server";
import { UpdateDisciplinaSchema } from "@app/contracts";
import { applyStandardHeaders, parseJsonBody, requireAuth, withApiHandler } from "@/lib/http";

type Ctx = { params: Promise<{ disciplinaId: string }> };

/** E17 — GET /api/v1/disciplinas/{disciplinaId} */
export async function GET(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { disciplinaId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container, { checkCsrf: false });
    const data = await container.disciplinas.getById(usuarioId, disciplinaId);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}

/** E18 — PATCH /api/v1/disciplinas/{disciplinaId} */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { disciplinaId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const body = await parseJsonBody(req, UpdateDisciplinaSchema);
    const data = await container.disciplinas.update(usuarioId, disciplinaId, body);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}

/** E19 — DELETE /api/v1/disciplinas/{disciplinaId}?confirmar=true */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { disciplinaId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const confirmar = req.nextUrl.searchParams.get("confirmar") === "true";
    await container.disciplinas.delete(usuarioId, disciplinaId, confirmar);
    return applyStandardHeaders(new NextResponse(null, { status: 204 }), traceId, rateLimit);
  });
}
