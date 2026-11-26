import { NextRequest, NextResponse } from "next/server";
import { DomainError, LancarNotaSchema } from "@app/contracts";
import { applyStandardHeaders, parseJsonBody, requireAuth, withApiHandler } from "@/lib/http";

type Ctx = { params: Promise<{ avaliacaoId: string }> };

/** E24 — PUT /api/v1/avaliacoes/{avaliacaoId}/nota (RF08, RF11) */
export async function PUT(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { avaliacaoId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const body = await parseJsonBody(req, LancarNotaSchema);
    const data = await container.avaliacoes.setNota(usuarioId, avaliacaoId, body);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}

/** E25 — DELETE /api/v1/avaliacoes/{avaliacaoId}/nota?versao=X (RF08 / CA08.3) */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { avaliacaoId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const versao = Number(req.nextUrl.searchParams.get("versao"));
    if (!Number.isInteger(versao) || versao < 1) {
      throw new DomainError({
        status: 422,
        code: "VALIDACAO",
        title: "Versão obrigatória",
        detail: "Informe o parâmetro query versao.",
      });
    }
    const data = await container.avaliacoes.removeNota(usuarioId, avaliacaoId, versao);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}
