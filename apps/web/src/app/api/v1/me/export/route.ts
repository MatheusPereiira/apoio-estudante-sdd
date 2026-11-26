import { NextRequest, NextResponse } from "next/server";
import { applyStandardHeaders, requireAuth, withApiHandler } from "@/lib/http";

/** E08 — GET /api/v1/me/export (RF03 / LGPD CA03.1) */
export async function GET(req: NextRequest) {
  return withApiHandler(async (container, traceId) => {
    const { usuarioId, rateLimit } = await requireAuth(req, container, { checkCsrf: false });
    const payload = await container.auth.exportMe(usuarioId);
    const today = new Date().toISOString().slice(0, 10);
    const res = NextResponse.json(payload, {
      headers: {
        "Content-Disposition": `attachment; filename="meus-dados-${today}.json"`,
      },
    });
    return applyStandardHeaders(res, traceId, rateLimit);
  });
}
