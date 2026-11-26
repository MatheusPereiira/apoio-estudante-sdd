import { NextRequest, NextResponse } from "next/server";
import { LoginSchema } from "@app/contracts";
import { attachAuthCookies, getClientIp, parseJsonBody, withApiHandler } from "@/lib/http";

/** E03 — POST /api/v1/auth/login (RF02 / RNF10) */
export async function POST(req: NextRequest) {
  return withApiHandler(async (container) => {
    const body = await parseJsonBody(req, LoginSchema);
    const ip = getClientIp(req);
    // RNF10: 5 req/min por IP+e-mail
    container.rateLimiter.enforce(`login:${ip ?? "local"}:${body.email}`, 15, 60_000);
    const session = await container.auth.login(body, {
      userAgent: req.headers.get("user-agent"),
      ip,
    });
    const res = NextResponse.json({ usuario: session.usuario }, { status: 200 });
    return attachAuthCookies(res, session);
  });
}
