"use client";

import { useState } from "react";
import type { Desempenho } from "@app/domain";
import { Sparkles, RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { formatNotaPtBr, formatPesoPtBr, parseNotaInputPtBr } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

interface AvaliacaoSim {
  id: string;
  nome: string;
  peso: number;
  nota: number | null;
}

export function SimuladorPanel({
  disciplinaId,
  avaliacoes,
  casasDecimais,
}: {
  disciplinaId: string;
  avaliacoes: AvaliacaoSim[];
  casasDecimais: number;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const a of avaliacoes) {
      init[a.id] = a.nota !== null ? formatNotaPtBr(a.nota, 2).replace(/,00$/, "") : "";
    }
    return init;
  });
  const [notaSub, setNotaSub] = useState("");
  const [notaExame, setNotaExame] = useState("");
  const [resultado, setResultado] = useState<{
    desempenhoAtual: Desempenho;
    desempenhoSimulado: Desempenho;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function executarSimulacao(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      const notasHipoteticas: Array<{ avaliacaoId: string; nota: number | null }> = [];
      for (const a of avaliacoes) {
        const raw = valores[a.id]?.trim() ?? "";
        if (!raw) {
          notasHipoteticas.push({ avaliacaoId: a.id, nota: null });
        } else {
          const parsed = parseNotaInputPtBr(raw);
          if (parsed === null) {
            setErro(`Nota inválida em "${a.nome}". Use um valor entre 0 e 10 (ex.: 7,5).`);
            setLoading(false);
            return;
          }
          notasHipoteticas.push({ avaliacaoId: a.id, nota: parsed });
        }
      }

      const parsedSub = notaSub.trim() ? parseNotaInputPtBr(notaSub) : undefined;
      const parsedExame = notaExame.trim() ? parseNotaInputPtBr(notaExame) : undefined;
      if ((notaSub.trim() && parsedSub === null) || (notaExame.trim() && parsedExame === null)) {
        setErro("Nota inválida na Substitutiva ou Exame Final (0 a 10).");
        setLoading(false);
        return;
      }

      const res = await apiFetch<{
        persistido: false;
        desempenhoAtual: Desempenho;
        desempenhoSimulado: Desempenho;
      }>(`/api/v1/disciplinas/${disciplinaId}/simulacoes`, {
        method: "POST",
        body: JSON.stringify({
          notasHipoteticas,
          ...(parsedSub !== undefined ? { notaSubstitutiva: parsedSub } : {}),
          ...(parsedExame !== undefined ? { notaExame: parsedExame } : {}),
        }),
      });
      setResultado(res);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao simular.");
    } finally {
      setLoading(false);
    }
  }

  function limpar() {
    const reset: Record<string, string> = {};
    for (const a of avaliacoes) {
      reset[a.id] = a.nota !== null ? formatNotaPtBr(a.nota, 2).replace(/,00$/, "") : "";
    }
    setValores(reset);
    setNotaSub("");
    setNotaExame("");
    setResultado(null);
    setErro(null);
  }

  return (
    <section
      aria-label="Simulador E se"
      className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Sparkles className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            Simulador &ldquo;E se?&rdquo;
          </h2>
          <p className="text-sm text-slate-600">
            Teste cenários hipotéticos sem alterar nenhuma nota salva (RN13).
          </p>
        </div>
        <button
          type="button"
          onClick={limpar}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Limpar
        </button>
      </div>

      <form onSubmit={executarSimulacao} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {avaliacoes.map((a) => (
            <label key={a.id} className="flex flex-col gap-1 rounded-xl bg-white p-3 shadow-sm">
              <span className="text-sm font-semibold text-slate-800">
                {a.nome} <span className="font-normal text-slate-500">({formatPesoPtBr(a.peso)})</span>
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ex.: 7,5"
                value={valores[a.id] ?? ""}
                onChange={(e) => setValores((prev) => ({ ...prev, [a.id]: e.target.value }))}
                className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-base text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1 rounded-xl bg-white p-3 shadow-sm">
            <span className="text-sm font-semibold text-slate-800">
              Prova Substitutiva <span className="font-normal text-slate-500">(opcional)</span>
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Ex.: 8,0"
              value={notaSub}
              onChange={(e) => setNotaSub(e.target.value)}
              className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-base text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 rounded-xl bg-white p-3 shadow-sm">
            <span className="text-sm font-semibold text-slate-800">
              Exame Final <span className="font-normal text-slate-500">(opcional)</span>
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Ex.: 5,5"
              value={notaExame}
              onChange={(e) => setNotaExame(e.target.value)}
              className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-base text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </label>
        </div>

        {erro && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-indigo-600 px-5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Calculando..." : "Simular cenário"}
        </button>
      </form>

      {resultado && (
        <div
          className="mt-5 rounded-xl border border-indigo-200 bg-white p-4 shadow-sm"
          aria-live="polite"
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-700">
            Resultado Simulado (não salvo)
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusBadge situacao={resultado.desempenhoSimulado.situacao} />
            <div className="text-sm text-slate-700">
              Média Final:{" "}
              <strong className="text-lg text-slate-950">
                {formatNotaPtBr(
                  resultado.desempenhoSimulado.mediaFinal ??
                    resultado.desempenhoSimulado.mediaParcial,
                  casasDecimais
                )}
              </strong>
              {resultado.desempenhoSimulado.mediaFinalExata && (
                <span className="ml-2 text-xs text-slate-500">
                  (exata: {resultado.desempenhoSimulado.mediaFinalExata.replace(".", ",")})
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
