import { NextRequest, NextResponse } from "next/server";
import { DeleteMeSchema, UpdateMeSchema } from "@app/contracts";
import {
  applyStandardHeaders,
  clearAuthCookies,
  parseJsonBody,
  requireAuth,
  withApiHandler,
} from "@/lib/http";

/** E06 — GET /api/v1/me (RF03) */
export async function GET(req: NextRequest) {
  return withApiHandler(async (container, traceId) => {
    const { usuarioId, rateLimit } = await requireAuth(req, container, { checkCsrf: false });
    const data = await container.auth.getMe(usuarioId);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}

/** E07 — PATCH /api/v1/me (RF03) */
export async function PATCH(req: NextRequest) {
  return withApiHandler(async (container, traceId) => {
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const body = await parseJsonBody(req, UpdateMeSchema);
    const data = await container.auth.updateMe(usuarioId, body);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}

/** E09 — DELETE /api/v1/me (RF03 / LGPD RN17) */
export async function DELETE(req: NextRequest) {
  return withApiHandler(async (container, traceId) => {
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const body = await parseJsonBody(req, DeleteMeSchema);
    await container.auth.deleteMe(usuarioId, body);
    const res = clearAuthCookies(new NextResponse(null, { status: 204 }));
    return applyStandardHeaders(res, traceId, rateLimit);
  });
}
