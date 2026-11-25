const fallback = "/app";
const base = "https://civicspec.invalid";
const unsafeCharacters = /[\\\u0000-\u001f\u007f]/;

// Independent of Host/forwarded headers; no caller-controlled origin or fallback.
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) return fallback;
  let decoded = value;
  try {
    // Check encoded and repeatedly encoded slashes, controls, and backslashes too.
    for (let depth = 0; depth < 5; depth++) {
      if (!decoded.startsWith("/") || decoded.startsWith("//") || unsafeCharacters.test(decoded)) return fallback;
      const url = new URL(decoded, base);
      if (url.origin !== base || url.pathname.startsWith("//")) return fallback;
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        const original = new URL(value, base);
        return `${original.pathname}${original.search}${original.hash}`;
      }
      decoded = next;
    }
  } catch {
    // Malformed encodings and invalid URLs are untrusted return paths.
  }
  return fallback;
}

export function signInLocation(returnTo: unknown): string {
  return `/auth?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`;
}
