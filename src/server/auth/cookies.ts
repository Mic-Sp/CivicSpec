import "server-only";

import { createAuthService, sessionCookieSettings, sessionMaxAge } from "./service";

type CookieOptions = ReturnType<typeof sessionCookieSettings>["options"] & { expires: Date; maxAge: number };
export type SessionCookieStore = {
  get: (name: string) => { value: string } | undefined;
  set: (name: string, value: string, options: CookieOptions) => unknown;
};

export function createCookieAuth(
  service: ReturnType<typeof createAuthService>,
  loadCookies: () => Promise<SessionCookieStore>,
  production: boolean,
) {
  const cookie = sessionCookieSettings(production);
  return {
    async getCurrentUser() {
      return service.resolveSession((await loadCookies()).get(cookie.name)?.value);
    },

    // Trusted server helper; only call after verifying credentials. Cookie writes
    // require a Route Handler or Server Action, rather than a page render.
    async startSession(userId: string) {
      const store = await loadCookies();
      const previous = store.get(cookie.name)?.value;
      const session = await service.createSession(userId);
      try {
        store.set(cookie.name, session.token, { ...cookie.options, expires: session.expiresAt, maxAge: sessionMaxAge });
        await service.revokeSession(previous);
      } catch (error) {
        await service.revokeSession(session.token);
        throw error;
      }
      return session.user;
    },

    async endSession() {
      const store = await loadCookies();
      await service.revokeSession(store.get(cookie.name)?.value);
      store.set(cookie.name, "", { ...cookie.options, expires: new Date(0), maxAge: 0 });
    },
  };
}
