import "server-only";

import { AuthError, authErrorResponse } from "@/server/auth/errors";
import { requireAuthOrigin } from "@/server/auth/origin";
import type { AuthUser } from "@/server/auth/user";
import { PreferenceInputError, type createWorkspaceService } from "./preferences";

const response = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export function createPreferencePost(dependencies: {
  appUrl: string;
  resolveUser: () => Promise<AuthUser | null>;
  save: ReturnType<typeof createWorkspaceService>["save"];
  limit: (userId: string) => Promise<boolean>;
}) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return response(405, "Method not allowed");
    try {
      requireAuthOrigin(request.headers, dependencies.appUrl);
      const user = await dependencies.resolveUser();
      if (!user) throw new AuthError(401);
      if (!await dependencies.limit(user.id)) return response(429, "Too many requests. Please try again later.");
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return response(415, "Use JSON");
      const reader = request.body?.getReader();
      if (!reader) return response(400, "Invalid preference");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1024) { await reader.cancel(); return response(413, "Request too large"); }
        chunks.push(chunk.value);
      }
      let input: unknown;
      try { input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { return response(400, "Invalid preference"); }
      return Response.json(await dependencies.save(input), { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof AuthError) return authErrorResponse(error);
      if (error instanceof PreferenceInputError) return response(400, "Invalid preference");
      return response(503, "Preferences could not be saved. Please try again.");
    }
  };
}
