FROM node:22-alpine

# Sandbox isolado sem segredos (Constituição C4 / Tarefa T11)
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN apk add --no-cache git ca-certificates

WORKDIR /workspace
USER node
