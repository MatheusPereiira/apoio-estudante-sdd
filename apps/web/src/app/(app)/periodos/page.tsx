"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Calendar, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { ApiClientError, apiFetch } from "@/lib/client";
import { formatDatePtBr } from "@/lib/format";

interface PeriodoItem {
  id: string;
  nome: string;
  dataInicio: string | null;
  dataFim: string | null;
  totalDisciplinas: number;
  versao: number;
}

export default function PeriodosPage() {
  const router = useRouter();
  const [periodos, setPeriodos] = useState<PeriodoItem[]>([]);
  const [userName, setUserName] = useState<string>("");
  const [nome, setNome] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    try {
      const [me, list] = await Promise.all([
        apiFetch<{ nome: string }>("/api/v1/me"),
        apiFetch<{ itens: PeriodoItem[] }>("/api/v1/periodos"),
      ]);
      setUserName(me.nome);
      setPeriodos(list.itens);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      setErro(err instanceof Error ? err.message : "Erro ao carregar períodos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function criarPeriodo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSaving(true);
    try {
      const novo = await apiFetch<PeriodoItem>("/api/v1/periodos", {
        method: "POST",
        body: JSON.stringify({
          nome,
          dataInicio: dataInicio || null,
          dataFim: dataFim || null,
        }),
      });
      setNome("");
      setDataInicio("");
      setDataFim("");
      router.push(`/periodos/${novo.id}/painel`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar período.");
    } finally {
      setSaving(false);
    }
  }

  async function excluirPeriodo(p: PeriodoItem) {
    setErro(null);
    try {
      await apiFetch(`/api/v1/periodos/${p.id}`, { method: "DELETE" });
      await carregar();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        const impacto = err.payload.impacto as
          | { disciplinas: number; notasLancadas: number }
          | undefined;
        const ok = window.confirm(
          `Excluir "${p.nome}" removerá ${impacto?.disciplinas ?? p.totalDisciplinas} disciplina(s) e ${impacto?.notasLancadas ?? 0} nota(s). Confirmar?`
        );
        if (ok) {
          await apiFetch(`/api/v1/periodos/${p.id}?confirmar=true`, { method: "DELETE" });
          await carregar();
        }
      } else {
        setErro(err instanceof Error ? err.message : "Erro ao excluir período.");
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userName={userName} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Meus Períodos Letivos</h1>
          <p className="text-sm text-slate-600">
            Organize suas disciplinas por semestre (ex.: 2026.2) e acompanhe seu desempenho.
          </p>
        </div>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
            <Plus className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            Novo período letivo
          </h2>
          <form onSubmit={criarPeriodo} className="grid gap-3 sm:grid-cols-4">
            <input
              type="text"
              required
              placeholder="Ex.: 2026.2"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-base"
            />
            <input
              type="date"
              aria-label="Data de início"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
            />
            <input
              type="date"
              aria-label="Data de fim"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] rounded-xl bg-indigo-600 px-4 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? "Criando..." : "Criar período"}
            </button>
          </form>
          {erro && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {erro}
            </p>
          )}
        </section>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        ) : periodos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-indigo-500" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-900">
              Bem-vindo! Crie seu primeiro período letivo
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Use o formulário acima para cadastrar um semestre (ex.: 2026.2) e começar a lançar
              suas disciplinas.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {periodos.map((p) => (
              <article
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300"
              >
                <Link href={`/periodos/${p.id}/painel`} className="flex-1">
                  <h2 className="text-lg font-bold text-slate-900">{p.nome}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {p.totalDisciplinas} disciplina(s)
                    {p.dataInicio && ` · ${formatDatePtBr(p.dataInicio)}`}
                    {p.dataFim && ` até ${formatDatePtBr(p.dataFim)}`}
                  </p>
                </Link>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => excluirPeriodo(p)}
                    aria-label={`Excluir período ${p.nome}`}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <Link
                    href={`/periodos/${p.id}/painel`}
                    aria-label={`Abrir painel ${p.nome}`}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
