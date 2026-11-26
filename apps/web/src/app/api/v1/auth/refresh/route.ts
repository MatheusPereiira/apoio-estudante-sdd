import { NextRequest, NextResponse } from "next/server";
import { attachAuthCookies, getClientIp, withApiHandler } from "@/lib/http";

/** E04 — POST /api/v1/auth/refresh (RF02 / CA02.3–CA02.4) */
export async function POST(req: NextRequest) {
  return withApiHandler(async (container) => {
    const refreshToken = req.cookies.get("refresh_token")?.value;
    const session = await container.auth.refresh(refreshToken, {
      userAgent: req.headers.get("user-agent"),
      ip: getClientIp(req),
    });
    const res = new NextResponse(null, { status: 204 });
    return attachAuthCookies(res, session);
  });
}
