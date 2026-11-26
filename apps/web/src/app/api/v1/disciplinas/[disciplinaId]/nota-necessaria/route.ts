import { NextRequest, NextResponse } from "next/server";
import { NotaNecessariaQuerySchema } from "@app/contracts";
import { applyStandardHeaders, requireAuth, withApiHandler } from "@/lib/http";

type Ctx = { params: Promise<{ disciplinaId: string }> };

/** E28 — GET /api/v1/disciplinas/{disciplinaId}/nota-necessaria?alvo=7.0 (RF12) */
export async function GET(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { disciplinaId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container, { checkCsrf: false });
    const alvoParam = req.nextUrl.searchParams.get("alvo");
    const parsed = NotaNecessariaQuerySchema.parse({
      alvo: alvoParam !== null ? Number(alvoParam) : undefined,
    });
    const data = await container.painel.getNotaNecessaria(usuarioId, disciplinaId, parsed.alvo);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}
