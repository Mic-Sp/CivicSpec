import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// A per-form, actor-bound idempotency token. It grants no resource access and
// contains no identity or submission text. Replays reuse the same draft ID.
export function createDraftTokens(secret: string) {
  if (Buffer.byteLength(secret) < 32) throw new Error("AUTH_SECRET is required for draft tokens.");
  const signature = (userId: string, id: string) => createHmac("sha256", secret).update(`owner-draft:${userId}:${id}`).digest("base64url");
  return {
    mint(userId: string) { const id = randomUUID(); return `${id}.${signature(userId, id)}`; },
    read(userId: string, token: string): string | null {
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
      const [id, signed] = token.split(".");
      const expected = Buffer.from(signature(userId, id));
      const actual = Buffer.from(signed);
      return actual.length === expected.length && timingSafeEqual(actual, expected) ? id : null;
    },
  };
}
