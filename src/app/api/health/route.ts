import { env } from "@/lib/env";

// Configuration liveness only; deliberately performs no database or integration I/O.
export function GET() {
  return Response.json({
    status: "ok",
    governanceMode: env.GITHUB_GOVERNANCE_MODE,
  });
}
