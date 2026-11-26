import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, requireAuth, withApiHandler } from "@/lib/http";

/** E05 — POST /api/v1/auth/logout (RF02 / CA02.5) */
export async function POST(req: NextRequest) {
  return withApiHandler(async (container) => {
    const { usuarioId } = await requireAuth(req, container);
    const refreshToken = req.cookies.get("refresh_token")?.value;
    await container.auth.logout(usuarioId, refreshToken);
    const res = new NextResponse(null, { status: 204 });
    return clearAuthCookies(res);
  });
}
