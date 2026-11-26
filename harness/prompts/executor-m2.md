# Prompt Versionado — Executor de Código (`M2: claude-sonnet-4-5`)

- **Versão:** `spec-v1.1.0`
- **Restrições:** escrever somente em `paths_permitidos`; usar `decimal.js` em `@app/domain` (`C2`); exigir `usuarioId` em todos os repositórios (`C3`).
- **Verificação obrigatória antes de encerrar:** `pnpm lint`, `pnpm typecheck` e `pnpm test`.
