"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, LogOut, User } from "lucide-react";
import { apiFetch } from "@/lib/client";

export function Navbar({
  userName,
  periodoNome,
}: {
  userName?: string;
  periodoNome?: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // ignora erro de sessão já encerrada
    }
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/periodos"
            className="flex min-h-[44px] items-center gap-2 font-bold text-slate-900 hover:text-indigo-700"
          >
            <GraduationCap className="h-6 w-6 text-indigo-600" aria-hidden="true" />
            <span className="text-base sm:text-lg">Apoio Estudantil</span>
          </Link>
          {periodoNome && (
            <span className="hidden rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800 sm:inline-block">
              Período {periodoNome}
            </span>
          )}
        </div>

        <nav aria-label="Menu principal" className="flex items-center gap-2">
          <Link
            href="/periodos"
            className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Períodos
          </Link>
          <Link
            href="/perfil"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <User className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{userName ?? "Perfil"}</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
