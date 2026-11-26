/**
 * Utilitários de formatação regional pt-BR (RNF21 / CA08.4).
 */
export function formatNotaPtBr(value: number | null | undefined, casas = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function formatPesoPtBr(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/**
 * Converte string com vírgula ou ponto decimal ("7,5" ou "7.5") em número validado (CA08.4).
 */
export function parseNotaInputPtBr(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (!cleaned) return null;
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(cleaned)) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0 || num > 10) return null;
  return num;
}

export function formatDatePtBr(dateIso: string | null | undefined): string {
  if (!dateIso) return "Sem data";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    const [y, m, d] = dateIso.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateIso));
}
