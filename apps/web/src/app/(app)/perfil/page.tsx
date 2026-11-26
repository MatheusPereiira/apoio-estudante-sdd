"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, ShieldAlert } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { ApiClientError, apiFetch } from "@/lib/client";

export default function PerfilPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senhaExclusao, setSenhaExclusao] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ nome: string; email: string }>("/api/v1/me")
      .then((me) => {
        setNome(me.nome);
        setEmail(me.email);
      })
      .catch((err) => {
        if (err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
        }
      });
  }, [router]);

  async function salvarNome(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setMsg(null);
    try {
      await apiFetch("/api/v1/me", {
        method: "PATCH",
        body: JSON.stringify({ nome }),
      });
      setMsg("Nome atualizado com sucesso.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao atualizar perfil.");
    }
  }

  async function exportarDados() {
    window.location.href = "/api/v1/me/export";
  }

  async function excluirConta(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      await apiFetch("/api/v1/me", {
        method: "DELETE",
        body: JSON.stringify({ senha: senhaExclusao, confirmacao }),
      });
      router.push("/login");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível excluir a conta.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar userName={nome} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Perfil e Privacidade (LGPD)</h1>
          <p className="text-sm text-slate-600">
            Gerencie seus dados pessoais conforme o requisito RF03 e a regra RN17.
          </p>
        </div>

        {erro && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800">
            {erro}
          </p>
        )}
        {msg && (
          <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            {msg}
          </p>
        )}

        <form
          onSubmit={salvarNome}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-bold text-slate-900">Dados da conta</h2>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">E-mail</span>
            <input
              type="email"
              disabled
              value={email}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-slate-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Nome</span>
            <input
              type="text"
              required
              minLength={2}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3"
            />
          </label>
          <button
            type="submit"
            className="min-h-[44px] rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Salvar alterações
          </button>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Portabilidade de Dados (CA03.1)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Baixe um arquivo JSON completo com seu perfil, períodos, disciplinas, avaliações e
            histórico imutável de notas.
          </p>
          <button
            type="button"
            onClick={exportarDados}
            className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-4 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Exportar meus dados (JSON)
          </button>
        </section>

        <form
          onSubmit={excluirConta}
          className="space-y-3 rounded-2xl border border-rose-300 bg-rose-50/40 p-5"
        >
          <h2 className="flex items-center gap-2 text-base font-bold text-rose-900">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            Excluir conta definitivamente (RN17)
          </h2>
          <p className="text-sm text-rose-800">
            Esta ação apaga permanentemente todos os seus períodos, disciplinas, notas e histórico.
          </p>
          <input
            type="password"
            required
            placeholder="Digite sua senha atual"
            value={senhaExclusao}
            onChange={(e) => setSenhaExclusao(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-rose-300 bg-white px-3"
          />
          <input
            type="text"
            required
            placeholder='Digite exatamente: EXCLUIR MINHA CONTA'
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-rose-300 bg-white px-3"
          />
          <button
            type="submit"
            className="min-h-[44px] rounded-xl bg-rose-700 px-5 text-sm font-semibold text-white hover:bg-rose-800"
          >
            Excluir minha conta permanentemente
          </button>
        </form>
      </main>
    </div>
  );
}
