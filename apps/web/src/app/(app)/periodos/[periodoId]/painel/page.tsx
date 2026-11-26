"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { NotaNecessariaResultado, SituacaoDisciplina } from "@app/domain";
import { BookOpen, CalendarClock, ChevronRight, Plus, X } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiClientError, apiFetch } from "@/lib/client";
import {
  formatDatePtBr,
  formatNotaPtBr,
  formatPesoPtBr,
  parseNotaInputPtBr,
} from "@/lib/format";

interface AvaliacaoCard {
  id: string;
  nome: string;
  peso: number;
  nota: number | null;
  versao: number;
}

interface DisciplinaPainelCard {
  id: string;
  nome: string;
  codigo: string | null;
  metodoCalculo: "SIMPLES" | "PONDERADA";
  notaMinimaAprovacao: number;
  versao: number;
  situacao: SituacaoDisciplina;
  prioridade: number;
  mediaParcial: number | null;
  pontosAcumulados: number | null;
  mediaRegular: number | null;
  mediaFinal: number | null;
  somaPesos: number;
  pesoLancado: number;
  notaNecessaria: NotaNecessariaResultado;
  exameFinal: {
    elegivel: boolean;
    notaNecessariaExame: number | null;
    notaExame: number | null;
    mediaPosExame: number | null;
  };
  substitutiva: {
    permitida: boolean;
    nota: number | null;
    notaNecessariaParaAprovar: number | null;
  };
  avaliacoes: AvaliacaoCard[];
}

interface PainelPayload {
  periodo: { id: string; nome: string };
  resumo: {
    totalDisciplinas: number;
    porSituacao: Partial<Record<SituacaoDisciplina, number>>;
  };
  disciplinas: DisciplinaPainelCard[];
  proximasAvaliacoes: Array<{
    disciplinaId: string;
    disciplinaNome: string;
    avaliacaoId: string;
    nome: string;
    peso: number;
    versao: number;
    dataPrevista: string;
  }>;
}

export default function PainelPeriodoPage() {
  const params = useParams<{ periodoId: string }>();
  const router = useRouter();
  const periodoId = params.periodoId;

  const [userName, setUserName] = useState("");
  const [painel, setPainel] = useState<PainelPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Lançamento rápido em <= 3 interações (RNF18)
  const [quickAv, setQuickAv] = useState<{
    id: string;
    nome: string;
    disciplinaNome: string;
    versao: number;
  } | null>(null);
  const [quickNota, setQuickNota] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);

  // Modal Nova Disciplina (RF05)
  const [modalDisc, setModalDisc] = useState(false);
  const [discNome, setDiscNome] = useState("");
  const [discCodigo, setDiscCodigo] = useState("");
  const [discMetodo, setDiscMetodo] = useState<"PONDERADA" | "SIMPLES">("PONDERADA");
  const [discMinima, setDiscMinima] = useState("6,0");

  async function carregar() {
    try {
      const [me, data] = await Promise.all([
        apiFetch<{ nome: string }>("/api/v1/me"),
        apiFetch<PainelPayload>(`/api/v1/periodos/${periodoId}/painel`),
      ]);
      setUserName(me.nome);
      setPainel(data);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      setErro(err instanceof Error ? err.message : "Erro ao carregar painel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, [periodoId]);

  async function salvarNotaRapida(e: React.FormEvent) {
    e.preventDefault();
    if (!quickAv) return;
    const parsed = parseNotaInputPtBr(quickNota);
    if (parsed === null) {
      setErro("Informe uma nota válida entre 0 e 10 (ex.: 7,5).");
      return;
    }
    setQuickSaving(true);
    setErro(null);
    try {
      await apiFetch(`/api/v1/avaliacoes/${quickAv.id}/nota`, {
        method: "PUT",
        body: JSON.stringify({ nota: parsed, versao: quickAv.versao }),
      });
      setQuickAv(null);
      setQuickNota("");
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar nota.");
    } finally {
      setQuickSaving(false);
    }
  }

  async function criarDisciplina(e: React.FormEvent) {
    e.preventDefault();
    const min = parseNotaInputPtBr(discMinima) ?? 6.0;
    setErro(null);
    try {
      const criada = await apiFetch<{ id: string }>(
        `/api/v1/periodos/${periodoId}/disciplinas`,
        {
          method: "POST",
          body: JSON.stringify({
            nome: discNome,
            codigo: discCodigo || null,
            metodoCalculo: discMetodo,
            notaMinimaAprovacao: min,
            casasDecimais: 1,
            permiteSubstitutiva: true,
            permiteExameFinal: true,
            notaMinimaExame: 4.0,
            mediaAprovacaoExame: 5.0,
          }),
        }
      );
      setModalDisc(false);
      setDiscNome("");
      setDiscCodigo("");
      router.push(`/disciplinas/${criada.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar disciplina.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userName={userName} periodoNome={painel?.periodo.nome} />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Painel {painel?.periodo.nome ?? ""}
            </h1>
            <p className="text-sm text-slate-600">
              {painel
                ? `${painel.resumo.totalDisciplinas} disciplina(s) ordenadas por prioridade de atenção`
                : "Carregando situação acadêmica..."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalDisc(true)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            Nova disciplina
          </button>
        </div>

        {erro && (
          <div role="alert" className="mb-5 rounded-xl bg-red-50 p-3.5 text-sm font-medium text-red-800">
            {erro}
          </div>
        )}

        {/* Lançamento rápido em 3 interações (RNF18) */}
        {quickAv && (
          <div className="mb-6 rounded-2xl border-2 border-indigo-500 bg-white p-4 shadow-md">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">
                Lançar nota — {quickAv.nome} ({quickAv.disciplinaNome})
              </p>
              <button
                type="button"
                onClick={() => setQuickAv(null)}
                aria-label="Fechar lançamento rápido"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={salvarNotaRapida} className="flex flex-wrap gap-2">
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                placeholder="Ex.: 7,5"
                value={quickNota}
                onChange={(e) => setQuickNota(e.target.value)}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-3.5 text-base"
              />
              <button
                type="submit"
                disabled={quickSaving}
                className="min-h-[44px] rounded-xl bg-indigo-600 px-5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {quickSaving ? "Salvando..." : "Salvar"}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            <div className="h-56 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-56 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-56 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        ) : painel && painel.disciplinas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-indigo-500" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-900">
              Nenhuma disciplina cadastrada em {painel.periodo.nome}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Adicione suas disciplinas e pesos para acompanhar médias e simular notas.
            </p>
            <button
              type="button"
              onClick={() => setModalDisc(true)}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-5 font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              Adicionar primeira disciplina
            </button>
          </div>
        ) : (
          <>
            {painel && painel.proximasAvaliacoes.length > 0 && (
              <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                  <CalendarClock className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                  Próximas avaliações
                </h2>
                <ul className="divide-y divide-slate-100">
                  {painel.proximasAvaliacoes.slice(0, 5).map((av) => (
                    <li
                      key={av.avaliacaoId}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                    >
                      <span>
                        <strong className="text-slate-900">{formatDatePtBr(av.dataPrevista)}</strong>{" "}
                        — {av.nome} de <span className="font-medium">{av.disciplinaNome}</span>{" "}
                        <span className="text-slate-500">({formatPesoPtBr(av.peso)})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickAv({
                            id: av.avaliacaoId,
                            nome: av.nome,
                            disciplinaNome: av.disciplinaNome,
                            versao: av.versao,
                          });
                          setQuickNota("");
                        }}
                        className="min-h-[36px] rounded-lg bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        Lançar nota
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {painel?.disciplinas.map((d) => (
                <article
                  key={d.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <StatusBadge situacao={d.situacao} />
                      <span className="text-xs font-medium text-slate-500">
                        Mín.: {formatNotaPtBr(d.notaMinimaAprovacao)}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900">
                      {d.nome}{" "}
                      {d.codigo && (
                        <span className="text-sm font-normal text-slate-500">({d.codigo})</span>
                      )}
                    </h2>

                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                      <div>
                        <p className="text-slate-500">
                          {d.mediaFinal !== null ? "Média Final" : "Média Parcial"}
                        </p>
                        <p className="text-lg font-bold text-slate-900">
                          {formatNotaPtBr(d.mediaFinal ?? d.mediaParcial)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Pontos Acumulados</p>
                        <p className="text-lg font-bold text-slate-900">
                          {formatNotaPtBr(d.pontosAcumulados)}
                        </p>
                      </div>
                    </div>

                    {/* Mensagem acionável conforme estado (ui-ux-spec.md §3) */}
                    <p className="mt-3 text-sm text-slate-700">
                      {d.situacao === "CONFIGURACAO_INCOMPLETA" && (
                        <>
                          Soma atual dos pesos: <strong>{formatPesoPtBr(d.somaPesos)}</strong>.
                          Complete 100% para liberar o cálculo.
                        </>
                      )}
                      {d.situacao === "EM_EXAME_FINAL" && (
                        <>
                          Precisa tirar{" "}
                          <strong>{formatNotaPtBr(d.exameFinal.notaNecessariaExame)}</strong> no
                          Exame Final para aprovação.
                        </>
                      )}
                      {(d.situacao === "EM_RISCO" || d.situacao === "EM_ANDAMENTO") &&
                        d.notaNecessaria.status === "NECESSARIA" && (
                          <>
                            Precisa tirar{" "}
                            <strong>{formatNotaPtBr(d.notaNecessaria.valor)}</strong> nas avaliações
                            restantes.
                          </>
                        )}
                      {d.situacao === "APROVACAO_GARANTIDA" && (
                        <>Pontos acumulados já garantiram a aprovação!</>
                      )}
                      {d.situacao === "APROVADO" && (
                        <>Concluída com média final {formatNotaPtBr(d.mediaFinal)}.</>
                      )}
                      {d.situacao === "APROVADO_POS_EXAME" && (
                        <>
                          Aprovado pós-exame com média {formatNotaPtBr(d.exameFinal.mediaPosExame)}.
                        </>
                      )}
                      {d.situacao === "SEM_NOTAS" && (
                        <>Configuração pronta. Lance a primeira nota quando realizar a avaliação.</>
                      )}
                    </p>

                    {/* Chips rápidos de avaliação */}
                    {d.avaliacoes.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {d.avaliacoes.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              setQuickAv({
                                id: a.id,
                                nome: a.nome,
                                disciplinaNome: d.nome,
                                versao: a.versao,
                              });
                              setQuickNota(a.nota !== null ? formatNotaPtBr(a.nota) : "");
                            }}
                            className={`min-h-[34px] rounded-lg border px-2.5 text-xs font-medium ${
                              a.nota !== null
                                ? "border-slate-200 bg-slate-50 text-slate-800"
                                : "border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
                            }`}
                          >
                            {a.nome}: {a.nota !== null ? formatNotaPtBr(a.nota) : "+ Nota"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <Link
                      href={`/disciplinas/${d.id}`}
                      className="inline-flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      <span>Avaliações, Simulador e Histórico</span>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {/* Modal Nova Disciplina */}
        {modalDisc && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-nova-disc-titulo"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 id="modal-nova-disc-titulo" className="text-lg font-bold text-slate-900">
                  Nova disciplina
                </h2>
                <button
                  type="button"
                  onClick={() => setModalDisc(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={criarDisciplina} className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-800">Nome</span>
                  <input
                    type="text"
                    required
                    value={discNome}
                    onChange={(e) => setDiscNome(e.target.value)}
                    placeholder="Ex.: Cálculo I"
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-800">
                    Código (opcional)
                  </span>
                  <input
                    type="text"
                    value={discCodigo}
                    onChange={(e) => setDiscCodigo(e.target.value)}
                    placeholder="Ex.: MAT101"
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-800">Método</span>
                    <select
                      value={discMetodo}
                      onChange={(e) =>
                        setDiscMetodo(e.target.value as "PONDERADA" | "SIMPLES")
                      }
                      className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3"
                    >
                      <option value="PONDERADA">Ponderada</option>
                      <option value="SIMPLES">Simples</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-800">
                      Nota mínima
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={discMinima}
                      onChange={(e) => setDiscMinima(e.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalDisc(false)}
                    className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="min-h-[44px] rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Criar e configurar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
