import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plataforma de Apoio ao Estudante Universitário",
  description:
    "Previsibilidade acadêmica com aritmética decimal exata, Prova Substitutiva, Exame Final e simulador de nota necessária.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
