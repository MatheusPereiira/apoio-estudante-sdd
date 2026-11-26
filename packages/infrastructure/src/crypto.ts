import { createHash, randomBytes, randomUUID } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";
import { SignJWT, jwtVerify } from "jose";
import type { CryptoPort } from "@app/application";

const ACCESS_TOKEN_TTL = "15m";

export class NodeCryptoAdapter implements CryptoPort {
  private readonly jwtSecret: Uint8Array;
  private readonly ipHashSalt: string;

  constructor(options?: { jwtSecret?: string; ipHashSalt?: string }) {
    const secret =
      options?.jwtSecret ??
      process.env.JWT_SECRET ??
      "dev-only-jwt-secret-apoio-estudante-sdd-2026-min-32";
    this.jwtSecret = new TextEncoder().encode(secret);
    this.ipHashSalt = options?.ipHashSalt ?? process.env.IP_HASH_SALT ?? "dev-ip-salt-2026";
  }

  /** RNF07: Argon2id com m=19 MiB (19456 KiB), t=2, p=1 no formato PHC */
  async hashPassword(plain: string): Promise<string> {
    const salt = randomBytes(16);
    return argon2id({
      password: plain,
      salt,
      parallelism: 1,
      iterations: 2,
      memorySize: 19456,
      hashLength: 32,
      outputType: "encoded",
    });
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    try {
      return await argon2Verify({ password: plain, hash });
    } catch {
      return false;
    }
  }

  async signAccessToken(payload: { sub: string; email: string }): Promise<string> {
    return new SignJWT({ email: payload.email })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_TTL)
      .sign(this.jwtSecret);
  }

  async verifyAccessToken(token: string): Promise<{ sub: string; email: string } | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
        return null;
      }
      return { sub: payload.sub, email: payload.email };
    } catch {
      return null;
    }
  }

  generateOpaqueToken(): string {
    return randomBytes(32).toString("hex");
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  hashIp(ip: string | null): string | null {
    if (!ip) return null;
    return createHash("sha256").update(`${this.ipHashSalt}:${ip}`).digest("hex");
  }

  generateId(): string {
    return randomUUID();
  }
}
