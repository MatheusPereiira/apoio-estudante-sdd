import { NextRequest, NextResponse } from "next/server";
import { applyStandardHeaders, requireAuth, withApiHandler } from "@/lib/http";

type Ctx = { params: Promise<{ avaliacaoId: string }> };

/** E26 — GET /api/v1/avaliacoes/{avaliacaoId}/historico (RF11 — Imutável, apenas GET) */
export async function GET(req: NextRequest, ctx: Ctx) {
  return withApiHandler(async (container, traceId) => {
    const { avaliacaoId } = await ctx.params;
    const { usuarioId, rateLimit } = await requireAuth(req, container, { checkCsrf: false });
    const limite = Number(req.nextUrl.searchParams.get("limite") ?? "20");
    const data = await container.avaliacoes.listHistorico(
      usuarioId,
      avaliacaoId,
      Number.isFinite(limite) ? limite : 20
    );
    return applyStandardHeaders(NextResponse.json(data), traceId, rateLimit);
  });
}

/** CA11.3: Histórico de notas é estritamente imutável -> 405 Method Not Allowed */
function methodNotAllowed() {
  return NextResponse.json(
    {
      title: "Método não permitido",
      status: 405,
      detail: "O histórico de notas é imutável e não pode ser alterado ou excluído.",
    },
    { status: 405, headers: { Allow: "GET" } }
  );
}

export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
