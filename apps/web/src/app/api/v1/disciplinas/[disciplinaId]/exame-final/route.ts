import { NextRequest, NextResponse } from "next/server";
import { DomainError, LancarNotaSchema } from "@app/contracts";
import { applyStandardHeaders, parseJsonBody, requireAuth, withApiHandler } from "@/lib/http";

type Ctx = { params: Promise<{ disciplinaId: string }> };

/** E34 — PUT /api/v1/disciplinas/{disciplinaId}/exame-final (RF08 / RN20 / RN21) */
export async function PUT(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { disciplinaId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container);
    const body = await parseJsonBody(req, LancarNotaSchema);
    const data = await container.avaliacoes.setExameFinal(usuarioId, disciplinaId, body);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}

/** E35 — DELETE /api/v1/disciplinas/{disciplinaId}/exame-final?versao=X (RF08 / RN20 / RN21) */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { disciplinaId } = await ctx.params;
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
    const data = await container.avaliacoes.removeExameFinal(usuarioId, disciplinaId, versao);
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}
