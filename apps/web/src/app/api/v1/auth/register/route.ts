import { NextRequest, NextResponse } from "next/server";
import { RegisterSchema } from "@app/contracts";
import { attachAuthCookies, getClientIp, parseJsonBody, withApiHandler } from "@/lib/http";

/** E02 — POST /api/v1/auth/register (RF01) */
export async function POST(req: NextRequest) {
  return withApiHandler(async (container) => {
    const ip = getClientIp(req);
    container.rateLimiter.enforce(`register:${ip ?? "local"}`, 10, 60_000);
    const body = await parseJsonBody(req, RegisterSchema);
    const session = await container.auth.register(body, {
      userAgent: req.headers.get("user-agent"),
      ip,
    });
    const res = NextResponse.json({ usuario: session.usuario }, { status: 201 });
    return attachAuthCookies(res, session);
  });
}
