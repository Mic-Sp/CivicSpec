// Node-only crypto; shared by server auth and the standalone Prisma seed CLI.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// OWASP's scrypt alternative: N=2^15, r=8, p=3 (32 MiB per operation).
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const keyLength = 64;
const format = /^scrypt\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{128})$/;
const dummySalt = Buffer.alloc(16);
const dummyDigest = Buffer.alloc(keyLength);

function validPasswordInput(password: string): boolean {
  return typeof password === "string" && Buffer.byteLength(password, "utf8") > 0
    && Buffer.byteLength(password, "utf8") <= 1024;
}

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (!validPasswordInput(password)) throw new Error("Invalid password input.");
  const salt = randomBytes(16);
  const digest = await derive(password, salt);
  return `scrypt$32768$8$3$${salt.toString("hex")}$${digest.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string | null | undefined): Promise<boolean> {
  if (!validPasswordInput(password)) return false;
  // Pin accepted costs and lengths rather than trusting parameters in stored data.
  const match = typeof encoded === "string" && encoded.length <= 256 ? format.exec(encoded) : null;
  const salt = match ? Buffer.from(match[1], "hex") : dummySalt;
  const expected = match ? Buffer.from(match[2], "hex") : dummyDigest;
  // Missing accounts, unset passwords, and malformed hashes still perform scrypt
  // and the same fixed-length comparison; no early return on account existence.
  const actual = await derive(password, salt);
  const equal = timingSafeEqual(actual, expected);
  return match !== null && equal;
}
