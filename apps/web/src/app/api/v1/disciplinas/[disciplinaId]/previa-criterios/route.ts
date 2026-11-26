import { NextRequest, NextResponse } from "next/server";
import { PreviaCriteriosSchema } from "@app/contracts";
import { applyStandardHeaders, parseJsonBody, requireAuth, withApiHandler } from "@/lib/http";

type Ctx = { params: Promise<{ disciplinaId: string }> };

/** E30 — POST /api/v1/disciplinas/{disciplinaId}/previa-criterios (RF07 / CA07.1) */
export async function POST(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { disciplinaId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const body = await parseJsonBody(req, PreviaCriteriosSchema);
    const data = await container.disciplinas.previewCriteria(usuarioId, disciplinaId, body);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}
