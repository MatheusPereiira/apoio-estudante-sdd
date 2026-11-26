"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { apiFetch } from "@/lib/client";

export default function CadastroPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      await apiFetch("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          nome,
          email,
          senha,
          aceiteTermos,
          termosVersao: "2026-11",
        }),
      });
      router.push("/periodos");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
            <GraduationCap className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Criar conta</h1>
          <p className="mt-1 text-sm text-slate-600">
            Seus dados acadêmicos ficam 100% isolados e protegidos (LGPD).
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-800">Nome completo</span>
            <input
              type="text"
              required
              minLength={2}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ana Souza"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-base text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-800">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="estudante@example.test"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-base text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-800">
              Senha (mín. 10 caracteres, letras e números)
            </span>
            <input
              type="password"
              required
              minLength={10}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Ex.: MinhaSenha2026"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 text-base text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="flex min-h-[44px] items-start gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={aceiteTermos}
              onChange={(e) => setAceiteTermos(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <span>
              Li e aceito os Termos de Uso e Política de Privacidade (versão{" "}
              <strong>2026-11</strong> — LGPD).
            </span>
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
            {loading ? "Criando conta..." : "Cadastrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Já possui conta?{" "}
          <Link href="/login" className="font-semibold text-indigo-700 hover:underline">
            Fazer login
          </Link>
        </p>
      </div>
    </main>
  );
}
