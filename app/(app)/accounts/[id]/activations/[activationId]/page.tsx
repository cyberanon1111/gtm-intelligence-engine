import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivationStatusBadge, ActivationChannelBadge } from "@/components/activations/activation-badges";
import { EditableDraft } from "@/components/activations/editable-draft";
import {
  RegenerateButton,
  SubmitForReviewButton,
  ApproveButton,
  RejectButton,
  MarkSentButton,
  CancelButton,
} from "@/components/activations/activation-actions";
import { canTransition, type ActivationStatusValue } from "@/lib/activation/statusTransitions";
import { whyNowResultSchema } from "@/lib/ai/schemas/whyNow";
import type { ScoreComponentDetails } from "@/lib/scoring/types";
import { getActivationChannelDefinition } from "@/config/meridian/activationChannels";
import { RecordOutcomeDialog } from "@/components/outcomes/record-outcome-dialog";
import { OutcomeBadge } from "@/components/outcomes/outcome-badge";

export const dynamic = "force-dynamic";

export default async function ActivationReviewPage({
  params,
}: {
  params: Promise<{ id: string; activationId: string }>;
}) {
  const { id: accountId, activationId } = await params;

  const activation = await prisma.activation.findUnique({
    where: { id: activationId },
    include: { contact: { include: { persona: true } } },
  });
  if (!activation || activation.accountId !== accountId) notFound();

  const [account, latestScore, insights, evidenceRows, priorVersion, outcomes] = await Promise.all([
    prisma.account.findUniqueOrThrow({ where: { id: accountId } }),
    prisma.score.findFirst({ where: { accountId }, orderBy: { computedAt: "desc" } }),
    prisma.accountInsight.findMany({ where: { accountId }, orderBy: { generatedAt: "desc" } }),
    activation.evidenceIds.length
      ? prisma.evidence.findMany({
          where: { id: { in: activation.evidenceIds } },
          include: { source: true },
        })
      : Promise.resolve([]),
    activation.regeneratedFromId
      ? prisma.activation.findUnique({ where: { id: activation.regeneratedFromId }, select: { id: true, version: true } })
      : Promise.resolve(null),
    prisma.outcomeEvent.findMany({ where: { activationId }, orderBy: { occurredAt: "desc" } }),
  ]);

  const latestWhyNowInsight = insights.find((i) => i.kind === "GTM_INTELLIGENCE" && i.status === "COMPLETED");
  const whyNowParsed = latestWhyNowInsight?.content
    ? whyNowResultSchema.safeParse(latestWhyNowInsight.content)
    : undefined;
  const whyNow = whyNowParsed?.success ? whyNowParsed.data : null;

  const componentDetails = latestScore?.componentDetails as unknown as ScoreComponentDetails | undefined;
  const matchedProblems = componentDetails?.problemRelevance.matchedProblems ?? [];
  const relevantProducts = new Set(matchedProblems.flatMap((p) => p.relevantProducts.map((pr) => pr.name)));

  const status = activation.status as ActivationStatusValue;
  const editable = status === "DRAFT" || status === "PENDING_REVIEW";
  const channelDef = getActivationChannelDefinition(activation.channel);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href={`/accounts/${accountId}`} />}>
          <ArrowLeft className="size-4" /> Back to {account.companyName}
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{activation.objective}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {channelDef?.label ?? activation.channel} · v{activation.version}
            {priorVersion && (
              <>
                {" "}
                · regenerated from{" "}
                <Link href={`/accounts/${accountId}/activations/${priorVersion.id}`} className="hover:underline">
                  v{priorVersion.version}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ActivationChannelBadge channel={activation.channel} />
          <ActivationStatusBadge status={activation.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* WHY THIS ACCOUNT */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why This Account</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-muted-foreground">
                {account.companyName} — {account.companyType ?? "unknown type"}
                {account.country ? `, ${account.country}` : ""}
                {account.fleetSize ? `, ${account.fleetSize} vessels` : ""}. GTM score:{" "}
                {latestScore ? `${latestScore.total}/100` : "not yet scored"}.
              </p>
            </CardContent>
          </Card>

          {/* WHY NOW */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why Now</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-muted-foreground">{whyNow?.whyNow ?? "No Why-Now intelligence on file."}</p>
            </CardContent>
          </Card>

          {/* WHO */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Who</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {activation.contact ? (
                <p>
                  <span className="font-medium">{activation.contact.name}</span>
                  {activation.contact.title ? ` — ${activation.contact.title}` : ""}
                  {activation.contact.persona ? ` (${activation.contact.persona.name})` : ""}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  No specific contact — {channelDef?.kind === "internal" ? "internal content" : "account-level"}.
                </p>
              )}
            </CardContent>
          </Card>

          {/* WHAT PROBLEM */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What Problem</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {matchedProblems.length === 0 ? (
                <p className="text-muted-foreground">No problem matched by the deterministic score yet.</p>
              ) : (
                <ul className="list-inside list-disc text-muted-foreground">
                  {matchedProblems.map((p) => (
                    <li key={p.problemKey}>{p.label}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* WHAT PRODUCT */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What Product</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-muted-foreground">
                {relevantProducts.size > 0 ? [...relevantProducts].join(", ") : "No product match yet."}
              </p>
            </CardContent>
          </Card>

          {/* WHAT ACTION */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What Action</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>
                <span className="font-medium">Objective: </span>
                {activation.objective}
              </p>
              {whyNow?.recommendedNextStep && (
                <p className="mt-1 text-muted-foreground">
                  GTM-recommended next step: {whyNow.recommendedNextStep}
                </p>
              )}
            </CardContent>
          </Card>

          {/* DRAFT */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Draft</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Reasoning: <span className="italic">{activation.reasoning}</span>
              </p>
              <EditableDraft
                activationId={activation.id}
                channel={activation.channel}
                content={activation.content as Record<string, unknown>}
                editable={editable}
              />
            </CardContent>
          </Card>

          {/* EVIDENCE */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evidence</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {evidenceRows.length === 0 ? (
                <p className="text-muted-foreground">
                  No evidence was cited for this draft — treat unsupported claims with caution.
                </p>
              ) : (
                evidenceRows.map((e) => (
                  <div key={e.id} className="border-b pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{e.claimType}</Badge>
                    </div>
                    <p>{e.claim}</p>
                    <p className="text-xs text-muted-foreground">Source: {e.source.name}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <RegenerateButton activationId={activation.id} accountId={accountId} />
              {canTransition(status, "PENDING_REVIEW") && <SubmitForReviewButton activationId={activation.id} />}
              {canTransition(status, "APPROVED") && <ApproveButton activationId={activation.id} />}
              {canTransition(status, "REJECTED") && <RejectButton activationId={activation.id} />}
              {canTransition(status, "SENT") && <MarkSentButton activationId={activation.id} />}
              {canTransition(status, "CANCELLED") && <CancelButton activationId={activation.id} />}
              {status === "SENT" || status === "REJECTED" || status === "CANCELLED" ? (
                <p className="text-xs text-muted-foreground">
                  This activation is in a final state — regenerate to create a new draft.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              <div>Created: {activation.createdAt.toLocaleString()}</div>
              {activation.approvedAt && <div>Approved: {activation.approvedAt.toLocaleString()}</div>}
              {activation.rejectedAt && <div>Rejected: {activation.rejectedAt.toLocaleString()}</div>}
              {activation.sentAt && <div>Sent: {activation.sentAt.toLocaleString()}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Outcomes</CardTitle>
              <RecordOutcomeDialog
                accountId={accountId}
                activationId={activation.id}
                contacts={activation.contact ? [{ id: activation.contact.id, name: activation.contact.name }] : []}
              />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {outcomes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No outcomes recorded for this activation yet.</p>
              ) : (
                outcomes.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 text-xs">
                    <OutcomeBadge type={o.type} />
                    <span className="text-muted-foreground">{o.occurredAt.toLocaleString()}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
