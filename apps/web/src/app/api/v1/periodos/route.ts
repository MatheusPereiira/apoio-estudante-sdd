import { NextRequest, NextResponse } from "next/server";
import { CreatePeriodoSchema } from "@app/contracts";
import { applyStandardHeaders, parseJsonBody, requireAuth, withApiHandler } from "@/lib/http";

/** E10 — GET /api/v1/periodos (RF04) */
export async function GET(req: NextRequest) {
  return withApiHandler(async (container, traceId) => {
    const { usuarioId, rateLimit } = await requireAuth(req, container, { checkCsrf: false });
    const data = await container.periodos.list(usuarioId);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}

/** E11 — POST /api/v1/periodos (RF04) */
export async function POST(req: NextRequest) {
  return withApiHandler(async (container, traceId) => {
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const body = await parseJsonBody(req, CreatePeriodoSchema);
    const created = await container.periodos.create(usuarioId, body);
    const res = NextResponse.json(created, {
      status: 201,
      headers: { Location: `/api/v1/periodos/${created.id}` },
    });
    return applyStandardHeaders(res, traceId, rateLimit);
  });
}
