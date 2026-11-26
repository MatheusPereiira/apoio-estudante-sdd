"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { apiFetch } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      await apiFetch("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, senha }),
      });
      const periodos = await apiFetch<{ itens: Array<{ id: string }> }>("/api/v1/periodos");
      if (periodos.itens.length > 0 && periodos.itens[0]) {
        router.push(`/periodos/${periodos.itens[0].id}/painel`);
      } else {
        router.push("/periodos");
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  function preencherDemo() {
    setEmail("ana@example.test");
    setSenha("SenhaForte2026");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
            <GraduationCap className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Apoio Estudantil</h1>
          <p className="mt-1 text-sm text-slate-600">
            Acompanhe suas notas, médias e quanto precisa tirar em tempo real.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-800">E-mail</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ana@example.test"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-base text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-800">Senha</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••••"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-base text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </label>

          {erro && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] w-full rounded-xl bg-indigo-600 px-4 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <div className="flex items-center justify-between gap-2">
            <span>Conta sintética demo (@example.test):</span>
            <button
              type="button"
              onClick={preencherDemo}
              className="font-semibold text-indigo-700 underline hover:text-indigo-900"
            >
              Preencher demo
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-semibold text-indigo-700 hover:underline">
            Criar conta gratuita
          </Link>
        </p>
      </div>
    </main>
  );
}
