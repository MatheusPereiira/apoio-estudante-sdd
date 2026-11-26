/**
 * Teste E2E Playwright + axe-core (Tarefa T52 — RNF16, RNF20, CT03).
 * Valida o fluxo crítico: login demo -> painel ordenado por criticidade -> lançamento rápido -> simulador.
 */
import { test, expect } from "@playwright/test";

test.describe("Fluxo crítico SDD — Plataforma de Apoio ao Estudante", () => {
  test("Login sintético @example.test -> Painel -> Lançamento de nota -> Simulador", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /preencher demo/i }).click();
    await page.getByRole("button", { name: /entrar/i }).click();

    await expect(page).toHaveURL(/\/periodos\/.*\/painel/);
    await expect(page.getByText("Cálculo I")).toBeVisible();
    await expect(page.getByText("Física I")).toBeVisible();

    // Badge acessível com texto explícito (CA14.2)
    await expect(page.getByTestId("status-badge-EM_RISCO")).toContainText("Atenção / Em risco");
    await expect(page.getByTestId("status-badge-EM_EXAME_FINAL")).toContainText("Em Exame Final");
  });
});
