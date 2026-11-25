import "server-only";

export class AuthError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? "Unauthorized" : "Forbidden");
    this.name = "AuthError";
  }
}

export function authErrorResponse(error: AuthError): Response {
  return Response.json({ error: error.message }, {
    status: error.status,
    headers: { "Cache-Control": "no-store" },
  });
}

// Server Actions need serializable return values, rather than Response objects.
// Their transport is controlled by Next.js; status here is the action result code.
export function authActionFailure(error: AuthError) {
  return { ok: false as const, status: error.status, error: error.message };
}
