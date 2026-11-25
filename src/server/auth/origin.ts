import "server-only";

import { AuthError } from "./errors";

export function requireAuthOrigin(requestHeaders: Pick<Headers, "get">, appUrl: string) {
  // Pin to configured public origin, not potentially forged forwarding headers.
  if (requestHeaders.get("origin") !== new URL(appUrl).origin || requestHeaders.get("sec-fetch-site") === "cross-site") {
    throw new AuthError(403);
  }
}
