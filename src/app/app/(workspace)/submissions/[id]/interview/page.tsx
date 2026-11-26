import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InterviewWorkspace } from "@/components/discovery/InterviewWorkspace";
import { prisma } from "@/lib/prisma";
import { requireAuthentication } from "@/server/auth";
import { createInterviewService } from "@/server/discovery/interview";
import { SubmissionUnavailableError } from "@/server/discovery/owner-service";

export const metadata: Metadata = { title: "Discovery workspace | CivicSpec", robots: { index: false, follow: false } };

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuthentication({ kind: "page", returnTo: `/app/submissions/${encodeURIComponent(id)}/interview` });
  const interview = await createInterviewService(prisma, async () => user).read(id).catch((error: unknown) => {
    if (error instanceof SubmissionUnavailableError) notFound();
    throw error;
  });
  return <InterviewWorkspace key={`${user.id}:${id}`} initial={interview} accountId={user.id} />;
}
