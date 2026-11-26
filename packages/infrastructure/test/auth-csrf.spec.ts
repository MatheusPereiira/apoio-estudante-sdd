import { describe, expect, it } from "vitest";
import { DomainError } from "@app/contracts";
import {
  createContainer,
  InMemoryAppRepository,
  verifyCsrfDoubleSubmit,
} from "../src/index.js";

describe("CT05 — Autorização, Sessão Rotativa, Bloqueio Temporário e CSRF", () => {
  it("CT05-5A / CA02.2: 5 falhas consecutivas bloqueiam a conta (HTTP 423) mesmo na 6ª tentativa correta", async () => {
    const repo = new InMemoryAppRepository();
    const app = createContainer({ repo });

    const { usuario } = await app.auth.register({
      nome: "Ana Souza",
      email: "ana@example.test",
      senha: "SenhaForte2026",
      aceiteTermos: true,
      termosVersao: "2026-11",
    });

    for (let i = 1; i <= 4; i++) {
      await expect(
        app.auth.login({ email: "ana@example.test", senha: "SenhaErrada123" })
      ).rejects.toMatchObject({ status: 401, code: "CREDENCIAIS_INVALIDAS" });
    }

    // 5ª falha dispara bloqueio 423
    await expect(
      app.auth.login({ email: "ana@example.test", senha: "SenhaErrada123" })
    ).rejects.toMatchObject({ status: 423, code: "CONTA_BLOQUEADA" });

    // 6ª tentativa com senha CORRETA continua bloqueada
    await expect(
      app.auth.login({ email: "ana@example.test", senha: "SenhaForte2026" })
    ).rejects.toMatchObject({ status: 423, code: "CONTA_BLOQUEADA" });

    const eventos = await repo.listAuditoria(usuario.id);
    expect(eventos.some((e) => e.tipo === "CONTA_BLOQUEADA")).toBe(true);
  });

  it("CT05-5B / CA02.4: Reuso de refresh_token já rotacionado revoga toda a família de sessões", async () => {
    const repo = new InMemoryAppRepository();
    const app = createContainer({ repo });

    const s1 = await app.auth.register({
      nome: "Ana Souza",
      email: "ana@example.test",
      senha: "SenhaForte2026",
      aceiteTermos: true,
      termosVersao: "2026-11",
    });

    // Rotação legítima: s1 -> s2
    const s2 = await app.auth.refresh(s1.refreshToken);
    expect(s2.refreshToken).not.toBe(s1.refreshToken);

    // Atacante tenta reutilizar s1.refreshToken -> 401 e família revogada!
    await expect(app.auth.refresh(s1.refreshToken)).rejects.toMatchObject({
      status: 401,
      code: "NAO_AUTENTICADO",
    });

    // Até s2 (da mesma família) agora está revogado!
    await expect(app.auth.refresh(s2.refreshToken)).rejects.toMatchObject({
      status: 401,
      code: "NAO_AUTENTICADO",
    });

    const eventos = await repo.listAuditoria(s1.usuario.id);
    expect(eventos.some((e) => e.tipo === "REFRESH_REUSO_DETECTADO")).toBe(true);
  });

  it("CT05-5C: Mutação sem X-CSRF-Token ou divergente retorna 403 CSRF_INVALIDO", () => {
    expect(() =>
      verifyCsrfDoubleSubmit({ method: "PUT", cookieToken: "abc123", headerToken: null })
    ).toThrowError(DomainError);

    try {
      verifyCsrfDoubleSubmit({ method: "PUT", cookieToken: "abc123", headerToken: "xyz999" });
      expect.fail("Deveria rejeitar CSRF divergente");
    } catch (err) {
      expect(err).toMatchObject({ status: 403, code: "CSRF_INVALIDO" });
    }

    expect(() =>
      verifyCsrfDoubleSubmit({ method: "PUT", cookieToken: "abc123", headerToken: "abc123" })
    ).not.toThrow();

    expect(() =>
      verifyCsrfDoubleSubmit({ method: "GET", cookieToken: null, headerToken: null })
    ).not.toThrow();
  });
});
