import { NextRequest, NextResponse } from "next/server";
import { CreateDisciplinaSchema } from "@app/contracts";
import { applyStandardHeaders, parseJsonBody, requireAuth, withApiHandler } from "@/lib/http";

type Ctx = { params: Promise<{ periodoId: string }> };

/** E15 — GET /api/v1/periodos/{periodoId}/disciplinas (RF05) */
export async function GET(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { periodoId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container, { checkCsrf: false });
    const data = await container.disciplinas.listByPeriodo(usuarioId, periodoId);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}

/** E16 — POST /api/v1/periodos/{periodoId}/disciplinas (RF05) */
export async function POST(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { periodoId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const body = await parseJsonBody(req, CreateDisciplinaSchema);
    const created = await container.disciplinas.create(usuarioId, periodoId, body);
    return applyStandardHeaders(NextResponse.json(created, { status: 201 }), traceId, rateLimit);
  });
}
