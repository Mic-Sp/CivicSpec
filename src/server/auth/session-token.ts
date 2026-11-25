import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function signature(payload: string, secret: string): Buffer {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("AUTH_SECRET must be configured with at least 32 bytes.");
  }
  return createHmac("sha256", secret).update(`civicspec.session:${payload}`).digest();
}

export function newSessionToken(secret: string): string {
  const payload = `v1.${randomBytes(32).toString("base64url")}`;
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

export function validSessionToken(token: string, secret: string): boolean {
  // Bound work and require canonical encodings before comparing signatures.
  const match = /^v1\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return false;
  const nonce = Buffer.from(match[1], "base64url");
  const actual = Buffer.from(match[2], "base64url");
  if (nonce.toString("base64url") !== match[1] || actual.toString("base64url") !== match[2]) return false;
  return timingSafeEqual(actual, signature(`v1.${match[1]}`, secret));
}

export function sessionTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
