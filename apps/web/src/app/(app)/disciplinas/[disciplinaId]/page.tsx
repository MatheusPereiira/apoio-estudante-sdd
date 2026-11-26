"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Desempenho } from "@app/domain";
import { ArrowLeft, History, Plus, Sparkles, Trash2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SimuladorPanel } from "@/components/SimuladorPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiClientError, apiFetch } from "@/lib/client";
import {
  formatDatePtBr,
  formatNotaPtBr,
  formatPesoPtBr,
  parseNotaInputPtBr,
} from "@/lib/format";

interface AvaliacaoDetalhe {
  id: string;
  nome: string;
  peso: number;
  nota: number | null;
  elegivelSubstitutiva: boolean;
  dataPrevista: string | null;
  versao: number;
}

interface DisciplinaDetalhe {
  id: string;
  periodoId: string;
  nome: string;
  codigo: string | null;
  metodoCalculo: "SIMPLES" | "PONDERADA";
  notaMinimaAprovacao: number;
  casasDecimais: 0 | 1 | 2;
  permiteSubstitutiva: boolean;
  notaSubstitutiva: number | null;
  permiteExameFinal: boolean;
  notaMinimaExame: number;
  mediaAprovacaoExame: number;
  notaExame: number | null;
  versao: number;
  avaliacoes: AvaliacaoDetalhe[];
  desempenho: Desempenho;
}

interface HistoricoItem {
  id: string;
  acao: "LANCADA" | "ALTERADA" | "REMOVIDA";
  notaAnterior: number | null;
  notaNova: number | null;
  criadoEm: string;
}

export default function DisciplinaDetalhePage() {
  const params = useParams<{ disciplinaId: string }>();
  const router = useRouter();
  const disciplinaId = params.disciplinaId;

  const [userName, setUserName] = useState("");
  const [disc, setDisc] = useState<DisciplinaDetalhe | null>(null);
  const [aba, setAba] = useState<"avaliacoes" | "simulador" | "historico">("avaliacoes");
  const [notasInput, setNotasInput] = useState<Record<string, string>>({});
  const [subInput, setSubInput] = useState("");
  const [exameInput, setExameInput] = useState("");
  const [novaAvNome, setNovaAvNome] = useState("");
  const [novaAvPeso, setNovaAvPeso] = useState("");
  const [novaAvData, setNovaAvData] = useState("");
  const [novaAvSub, setNovaAvSub] = useState(true);
  const [historicoPorAv, setHistoricoPorAv] = useState<Record<string, HistoricoItem[]>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function carregar() {
    try {
      const [me, d] = await Promise.all([
        apiFetch<{ nome: string }>("/api/v1/me"),
        apiFetch<DisciplinaDetalhe>(`/api/v1/disciplinas/${disciplinaId}`),
      ]);
      setUserName(me.nome);
      setDisc(d);
      const map: Record<string, string> = {};
      for (const a of d.avaliacoes) {
        map[a.id] = a.nota !== null ? formatNotaPtBr(a.nota, 2).replace(/,00$/, "") : "";
      }
      setNotasInput(map);
      setSubInput(d.notaSubstitutiva !== null ? formatNotaPtBr(d.notaSubstitutiva) : "");
      setExameInput(d.notaExame !== null ? formatNotaPtBr(d.notaExame) : "");
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      setErro(err instanceof Error ? err.message : "Erro ao carregar disciplina.");
    }
  }

  useEffect(() => {
    void carregar();
  }, [disciplinaId]);

  async function carregarHistoricos(avaliacoes: AvaliacaoDetalhe[]) {
    const entries = await Promise.all(
      avaliacoes.map(async (a) => {
        const res = await apiFetch<{ itens: HistoricoItem[] }>(
          `/api/v1/avaliacoes/${a.id}/historico`
        );
        return [a.id, res.itens] as const;
      })
    );
    setHistoricoPorAv(Object.fromEntries(entries));
  }

  useEffect(() => {
    if (aba === "historico" && disc) {
      void carregarHistoricos(disc.avaliacoes);
    }
  }, [aba, disc]);

  async function adicionarAvaliacao(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setMsg(null);
    const pesoNum = novaAvPeso.trim()
      ? Number(novaAvPeso.trim().replace(",", "."))
      : undefined;
    try {
      await apiFetch(`/api/v1/disciplinas/${disciplinaId}/avaliacoes`, {
        method: "POST",
        body: JSON.stringify({
          nome: novaAvNome,
          ...(pesoNum !== undefined ? { peso: pesoNum } : {}),
          elegivelSubstitutiva: novaAvSub,
          dataPrevista: novaAvData || null,
        }),
      });
      setNovaAvNome("");
      setNovaAvPeso("");
      setNovaAvData("");
      setMsg("Avaliação adicionada com sucesso.");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao adicionar avaliação.");
    }
  }

  async function salvarNota(av: AvaliacaoDetalhe) {
    setErro(null);
    setMsg(null);
    const parsed = parseNotaInputPtBr(notasInput[av.id] ?? "");
    if (parsed === null) {
      setErro(`Informe uma nota válida (0 a 10) para ${av.nome}.`);
      return;
    }
    try {
      await apiFetch(`/api/v1/avaliacoes/${av.id}/nota`, {
        method: "PUT",
        body: JSON.stringify({ nota: parsed, versao: av.versao }),
      });
      setMsg(`Nota de ${av.nome} atualizada.`);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar nota.");
    }
  }

  async function removerNota(av: AvaliacaoDetalhe) {
    setErro(null);
    try {
      await apiFetch(`/api/v1/avaliacoes/${av.id}/nota?versao=${av.versao}`, {
        method: "DELETE",
      });
      setMsg(`Nota de ${av.nome} removida (voltou a pendente).`);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao remover nota.");
    }
  }

  async function excluirAvaliacao(av: AvaliacaoDetalhe) {
    setErro(null);
    try {
      await apiFetch(`/api/v1/avaliacoes/${av.id}`, { method: "DELETE" });
      await carregar();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        if (window.confirm(`A avaliação "${av.nome}" tem nota lançada. Confirmar exclusão?`)) {
          await apiFetch(`/api/v1/avaliacoes/${av.id}?confirmar=true`, { method: "DELETE" });
          await carregar();
        }
      } else {
        setErro(err instanceof Error ? err.message : "Erro ao excluir avaliação.");
      }
    }
  }

  async function salvarSubstitutiva(e: React.FormEvent) {
    e.preventDefault();
    if (!disc) return;
    setErro(null);
    const parsed = parseNotaInputPtBr(subInput);
    if (parsed === null) {
      setErro("Informe uma nota válida (0 a 10) para a Prova Substitutiva.");
      return;
    }
    try {
      await apiFetch(`/api/v1/disciplinas/${disc.id}/substitutiva`, {
        method: "PUT",
        body: JSON.stringify({ nota: parsed, versao: disc.versao }),
      });
      setMsg("Prova Substitutiva registrada e recalculada.");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao registrar substitutiva.");
    }
  }

  async function salvarExame(e: React.FormEvent) {
    e.preventDefault();
    if (!disc) return;
    setErro(null);
    const parsed = parseNotaInputPtBr(exameInput);
    if (parsed === null) {
      setErro("Informe uma nota válida (0 a 10) para o Exame Final.");
      return;
    }
    try {
      await apiFetch(`/api/v1/disciplinas/${disc.id}/exame-final`, {
        method: "PUT",
        body: JSON.stringify({ nota: parsed, versao: disc.versao }),
      });
      setMsg("Nota do Exame Final registrada.");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao registrar exame final.");
    }
  }

  if (!disc) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar userName={userName} />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userName={userName} />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <Link
          href={`/periodos/${disc.periodoId}/painel`}
          className="mb-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar ao painel
        </Link>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <StatusBadge situacao={disc.desempenho.situacao} />
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                {disc.nome}{" "}
                {disc.codigo && (
                  <span className="text-base font-normal text-slate-500">({disc.codigo})</span>
                )}
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                Método: <strong>{disc.metodoCalculo}</strong> · Mínima:{" "}
                <strong>{formatNotaPtBr(disc.notaMinimaAprovacao)}</strong> · Arredondamento:{" "}
                <strong>
                  {disc.casasDecimais} casa(s) HALF_UP
                </strong>{" "}
                · Soma dos pesos: <strong>{formatPesoPtBr(disc.desempenho.somaPesos)}</strong>
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 text-center">
              <div>
                <p className="text-[11px] text-slate-500">Parcial</p>
                <p className="text-lg font-bold text-slate-900">
                  {formatNotaPtBr(disc.desempenho.mediaParcial, disc.casasDecimais)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Final</p>
                <p className="text-lg font-bold text-indigo-700">
                  {formatNotaPtBr(disc.desempenho.mediaFinal, disc.casasDecimais)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Precisa</p>
                <p className="text-lg font-bold text-amber-700">
                  {disc.desempenho.exameFinal.elegivel
                    ? formatNotaPtBr(disc.desempenho.exameFinal.notaNecessariaExame)
                    : disc.desempenho.notaNecessaria.status === "NECESSARIA"
                      ? formatNotaPtBr(disc.desempenho.notaNecessaria.valor)
                      : "—"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Abas (ui-ux-spec.md §4.2) */}
        <div role="tablist" className="mb-5 flex flex-wrap gap-2">
          <button
            role="tab"
            type="button"
            aria-selected={aba === "avaliacoes"}
            onClick={() => setAba("avaliacoes")}
            className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold ${
              aba === "avaliacoes"
                ? "bg-indigo-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Avaliações e Notas ({disc.avaliacoes.length})
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={aba === "simulador"}
            onClick={() => setAba("simulador")}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 text-sm font-semibold ${
              aba === "simulador"
                ? "bg-indigo-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Simulador &ldquo;E se?&rdquo;
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={aba === "historico"}
            onClick={() => setAba("historico")}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 text-sm font-semibold ${
              aba === "historico"
                ? "bg-indigo-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <History className="h-4 w-4" aria-hidden="true" />
            Histórico Imutável
          </button>
        </div>

        {erro && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800">
            {erro}
          </p>
        )}
        {msg && (
          <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            {msg}
          </p>
        )}

        {aba === "avaliacoes" && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-bold text-slate-900">Avaliações regulares</h2>
              <div className="space-y-3">
                {disc.avaliacoes.map((av) => (
                  <div
                    key={av.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {av.nome}{" "}
                        <span className="text-sm font-normal text-slate-500">
                          · Peso {formatPesoPtBr(av.peso)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {av.elegivelSubstitutiva ? "Elegível à Substitutiva" : "Não elegível à Sub"}
                        {av.dataPrevista && ` · Prevista: ${formatDatePtBr(av.dataPrevista)}`}
                        {disc.desempenho.substitutiva.avaliacaoSubstituidaId === av.id && (
                          <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 font-semibold text-purple-900">
                            Substituída pela Sub
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Nota de ${av.nome}`}
                        placeholder="0,0"
                        value={notasInput[av.id] ?? ""}
                        onChange={(e) =>
                          setNotasInput((prev) => ({ ...prev, [av.id]: e.target.value }))
                        }
                        className="min-h-[44px] w-24 rounded-xl border border-slate-300 px-3 text-center text-base"
                      />
                      <button
                        type="button"
                        onClick={() => salvarNota(av)}
                        className="min-h-[44px] rounded-xl bg-indigo-600 px-3.5 text-sm font-semibold text-white hover:bg-indigo-700"
                      >
                        Salvar
                      </button>
                      {av.nota !== null && (
                        <button
                          type="button"
                          onClick={() => removerNota(av)}
                          className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Limpar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => excluirAvaliacao(av)}
                        aria-label={`Excluir ${av.nome}`}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={adicionarAvaliacao}
                className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-5"
              >
                <input
                  type="text"
                  required
                  placeholder="Nova avaliação (ex.: P2)"
                  value={novaAvNome}
                  onChange={(e) => setNovaAvNome(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3 sm:col-span-2"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  required={disc.metodoCalculo === "PONDERADA"}
                  placeholder="Peso %"
                  value={novaAvPeso}
                  onChange={(e) => setNovaAvPeso(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                />
                <input
                  type="date"
                  aria-label="Data prevista"
                  value={novaAvData}
                  onChange={(e) => setNovaAvData(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
                />
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Adicionar
                </button>
                <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-5">
                  <input
                    type="checkbox"
                    checked={novaAvSub}
                    onChange={(e) => setNovaAvSub(e.target.checked)}
                  />
                  Elegível para ser substituída pela Prova Substitutiva (RN19)
                </label>
              </form>
            </section>

            {/* Prova Substitutiva e Exame Final (RN19, RN20, RN21) */}
            <section className="grid gap-4 sm:grid-cols-2">
              <form
                onSubmit={salvarSubstitutiva}
                className="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm"
              >
                <h2 className="text-base font-bold text-slate-900">Prova Substitutiva (RN19)</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Substitui automaticamente a avaliação elegível de maior ganho (nunca reduz a
                  média).
                </p>
                {disc.desempenho.substitutiva.notaNecessariaParaAprovar !== null && (
                  <p className="mt-2 rounded-lg bg-purple-50 p-2 text-xs font-medium text-purple-900">
                    Tirando{" "}
                    <strong>
                      {formatNotaPtBr(disc.desempenho.substitutiva.notaNecessariaParaAprovar)}
                    </strong>{" "}
                    na substitutiva você atinge a aprovação direta!
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex.: 7,5"
                    value={subInput}
                    onChange={(e) => setSubInput(e.target.value)}
                    className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-3"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] rounded-xl bg-purple-700 px-4 text-sm font-semibold text-white hover:bg-purple-800"
                  >
                    Salvar Sub
                  </button>
                </div>
              </form>

              <form
                onSubmit={salvarExame}
                className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm"
              >
                <h2 className="text-base font-bold text-slate-900">Exame Final (RN20 / RN21)</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Disponível quando média regular está entre{" "}
                  {formatNotaPtBr(disc.notaMinimaExame)} e{" "}
                  {formatNotaPtBr(disc.notaMinimaAprovacao - 0.1)}.
                </p>
                {disc.desempenho.exameFinal.notaNecessariaExame !== null && (
                  <p className="mt-2 rounded-lg bg-orange-50 p-2 text-xs font-medium text-orange-900">
                    Nota necessária no Exame Final:{" "}
                    <strong>{formatNotaPtBr(disc.desempenho.exameFinal.notaNecessariaExame)}</strong>
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex.: 5,5"
                    value={exameInput}
                    onChange={(e) => setExameInput(e.target.value)}
                    className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-3"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700"
                  >
                    Salvar Exame
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {aba === "simulador" && (
          <SimuladorPanel
            disciplinaId={disc.id}
            avaliacoes={disc.avaliacoes}
            casasDecimais={disc.casasDecimais}
          />
        )}

        {aba === "historico" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-bold text-slate-900">
              Histórico Imutável de Alterações (RF11 / RN11)
            </h2>
            <div className="space-y-4">
              {disc.avaliacoes.map((av) => {
                const hist = historicoPorAv[av.id] ?? [];
                return (
                  <div key={av.id} className="rounded-xl border border-slate-100 p-3">
                    <h3 className="text-sm font-bold text-slate-800">{av.nome}</h3>
                    {hist.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-500">Nenhuma alteração registrada.</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-xs text-slate-700">
                        {hist.map((h) => (
                          <li key={h.id}>
                            <strong>{h.acao}</strong>:{" "}
                            {h.notaAnterior !== null ? formatNotaPtBr(h.notaAnterior) : "pendente"}{" "}
                            → {h.notaNova !== null ? formatNotaPtBr(h.notaNova) : "pendente"} em{" "}
                            {formatDatePtBr(h.criadoEm)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
