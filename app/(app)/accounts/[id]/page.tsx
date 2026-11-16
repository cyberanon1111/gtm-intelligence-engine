import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCOUNT_STATUS_BADGE_VARIANT, ACCOUNT_STATUS_LABELS } from "@/lib/labels";
import { ArchiveToggleButton, DeleteAccountButton } from "@/components/accounts/account-actions";
import { RecalculateScoreButton } from "@/components/accounts/recalculate-score-button";
import { ScoreBreakdown } from "@/components/accounts/score-breakdown";
import { ResearchButton } from "@/components/accounts/research-button";
import { ResearchStatusSummary } from "@/components/accounts/research-status-summary";
import { BuyingCommittee } from "@/components/accounts/buying-committee";
import { ResearchRunHistory } from "@/components/accounts/research-run-history";
import { WhatChanged } from "@/components/accounts/what-changed";
import { ActivationHistory } from "@/components/activations/activation-history";
import { GenerateActivationDialog } from "@/components/activations/generate-activation-dialog";
import { OutcomeHistory } from "@/components/outcomes/outcome-history";
import { RecordOutcomeDialog } from "@/components/outcomes/record-outcome-dialog";
import { GtmJourney } from "@/components/accounts/gtm-journey";
import { getAccountJourney } from "@/lib/journey/accountJourney";
import {
  ResearchSummaryPanel,
  WhyNowPanel,
  PotentialProblemsPanel,
  RelevantProductsPanel,
  RelevantPersonasPanel,
  RecommendedActionPanel,
  EvidencePanel,
} from "@/components/accounts/research-panels";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { DeleteContactButton } from "@/components/contacts/delete-contact-button";
import type { ScoreComponentDetails } from "@/lib/scoring/types";
import { researchResultSchema } from "@/lib/ai/schemas/research";
import { whyNowResultSchema } from "@/lib/ai/schemas/whyNow";
import { computeWhatChanged } from "@/lib/research/whatChanged";
import { getSignalFreshnessLabel } from "@/lib/signals/freshness";

export const dynamic = "force-dynamic";

function ComingSoon({ note }: { note: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      <Badge variant="outline" className="mr-2 align-middle">
        Later phase
      </Badge>
      {note}
    </p>
  );
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [account, personas, insights, evidence, researchRuns, whatChanged, activations, outcomes, journey] =
    await Promise.all([
      prisma.account.findUnique({
        where: { id },
        include: {
          contacts: { include: { persona: true }, orderBy: { createdAt: "asc" } },
          signals: { orderBy: { detectedAt: "desc" } },
          scores: { orderBy: { computedAt: "desc" }, take: 1 },
          activities: { orderBy: { createdAt: "desc" }, include: { outcomes: true } },
        },
      }),
      prisma.persona.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.accountInsight.findMany({ where: { accountId: id }, orderBy: { generatedAt: "desc" } }),
      prisma.evidence.findMany({
        where: { accountId: id },
        include: { source: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.researchRun.findMany({ where: { accountId: id }, orderBy: { startedAt: "desc" } }),
      computeWhatChanged(prisma, id),
      prisma.activation.findMany({
        where: { accountId: id },
        include: { contact: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.outcomeEvent.findMany({
        where: { accountId: id },
        include: { contact: { select: { name: true } }, activation: { select: { id: true, channel: true, objective: true } } },
        orderBy: { occurredAt: "desc" },
      }),
      getAccountJourney(prisma, id),
    ]);

  if (!account) notFound();

  const latestScore = account.scores[0];

  const latestCompletedResearch = insights.find((i) => i.kind === "RESEARCH" && i.status === "COMPLETED");
  const latestCompletedWhyNow = insights.find(
    (i) => i.kind === "GTM_INTELLIGENCE" && i.status === "COMPLETED",
  );
  const research = latestCompletedResearch
    ? researchResultSchema.safeParse(latestCompletedResearch.content)
    : null;
  const whyNow = latestCompletedWhyNow
    ? whyNowResultSchema.safeParse(latestCompletedWhyNow.content)
    : null;
  const researchData = research?.success ? research.data : null;
  const whyNowData = whyNow?.success ? whyNow.data : null;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Company overview */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{account.companyName}</h1>
            {account.archivedAt && <Badge variant="outline">Archived</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {account.companyType ?? "Unknown type"}
            {account.country ? ` · ${account.country}` : ""}
            {account.fleetSize ? ` · ${account.fleetSize} vessels` : ""}
          </p>
          {account.website && (
            <a
              href={account.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:underline"
            >
              {account.website}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={ACCOUNT_STATUS_BADGE_VARIANT[account.status]}>
            {ACCOUNT_STATUS_LABELS[account.status]}
          </Badge>
          <Button variant="outline" size="sm" render={<Link href={`/accounts/${account.id}/edit`} />}>
            <Pencil className="size-4" /> Edit
          </Button>
          <ArchiveToggleButton accountId={account.id} archived={!!account.archivedAt} />
          <DeleteAccountButton
            accountId={account.id}
            companyName={account.companyName}
            redirectTo="/accounts"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* 2. Company attributes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Company Attributes</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Attribute label="Company Type" value={account.companyType} />
              <Attribute label="Fleet Size" value={account.fleetSize?.toString()} />
              <Attribute label="Vessel Types" value={account.vesselTypes.join(", ")} />
              <Attribute label="Regions" value={account.regions.join(", ")} />
              <Attribute label="Country" value={account.country} />
              <Attribute label="Added" value={account.createdAt.toLocaleDateString()} />
            </CardContent>
          </Card>

          {/* 3. Contacts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Contacts</CardTitle>
              <ContactFormDialog
                accountId={account.id}
                personas={personas}
                trigger={
                  <Button size="sm" variant="outline">
                    <Plus className="size-4" /> Add contact
                  </Button>
                }
              />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {account.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No contacts yet. Add the people who make up the buying committee.
                </p>
              ) : (
                account.contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between gap-2 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="text-sm font-medium">{contact.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {contact.title ?? "—"}
                        {contact.persona ? ` · ${contact.persona.name}` : ""}
                        {contact.department ? ` · ${contact.department}` : ""}
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {contact.email && <span>{contact.email}</span>}
                        {contact.linkedinUrl && (
                          <a
                            href={contact.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            LinkedIn
                          </a>
                        )}
                        {contact.influenceScore !== null && (
                          <span>Influence {contact.influenceScore}/100</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <ContactFormDialog
                        accountId={account.id}
                        personas={personas}
                        contact={contact}
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Pencil className="size-4" />
                            <span className="sr-only">Edit {contact.name}</span>
                          </Button>
                        }
                      />
                      <DeleteContactButton
                        contactId={contact.id}
                        accountId={account.id}
                        contactName={contact.name}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Buying Committee */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buying Committee</CardTitle>
            </CardHeader>
            <CardContent>
              <BuyingCommittee contacts={account.contacts} whyNow={whyNowData} />
            </CardContent>
          </Card>

          {/* 4. Signals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signals</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {account.signals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No signals detected for this account yet.
                </p>
              ) : (
                account.signals.map((signal) => (
                  <div
                    key={signal.id}
                    className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{signal.title}</span>
                      <div className="flex shrink-0 gap-1">
                        <Badge variant="outline">{signal.category}</Badge>
                        <Badge variant={signal.status === "ACTIVE" ? "default" : "secondary"}>
                          {signal.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{signal.description}</p>
                    <div className="text-xs text-muted-foreground">
                      Detected {signal.detectedAt.toLocaleDateString()}
                      {signal.sourceName ? ` · Source: ${signal.sourceName}` : ""}
                      {" · "}Strength {signal.strength}/5 · Confidence {signal.confidence}%
                      {" · "}
                      {getSignalFreshnessLabel(signal).toLowerCase()}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* 5. Research */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Research</CardTitle>
              <ResearchButton accountId={account.id} hasResearch={!!latestCompletedResearch} />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ResearchStatusSummary latestRun={researchRuns[0] ?? null} />
              {researchData && latestCompletedResearch ? (
                <ResearchSummaryPanel research={researchData} generatedAt={latestCompletedResearch.generatedAt} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No completed research narrative yet. Click &ldquo;Research Account&rdquo; to run the AI
                  Research Agent — it synthesizes only the signals and account data already on file, never
                  outside knowledge.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Why Now */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why Now</CardTitle>
            </CardHeader>
            <CardContent>
              {whyNowData && latestCompletedWhyNow ? (
                <WhyNowPanel whyNow={whyNowData} generatedAt={latestCompletedWhyNow.generatedAt} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Run research to generate a why-now synthesis grounded in the deterministic score.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Potential Problems */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Potential Problems</CardTitle>
            </CardHeader>
            <CardContent>
              {whyNowData ? (
                <PotentialProblemsPanel whyNow={whyNowData} />
              ) : (
                <p className="text-sm text-muted-foreground">Not yet available.</p>
              )}
            </CardContent>
          </Card>

          {/* Relevant Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Relevant Products</CardTitle>
            </CardHeader>
            <CardContent>
              {whyNowData ? (
                <RelevantProductsPanel whyNow={whyNowData} />
              ) : (
                <p className="text-sm text-muted-foreground">Not yet available.</p>
              )}
            </CardContent>
          </Card>

          {/* Relevant Personas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Relevant Personas</CardTitle>
            </CardHeader>
            <CardContent>
              {whyNowData ? (
                <RelevantPersonasPanel whyNow={whyNowData} />
              ) : (
                <p className="text-sm text-muted-foreground">Not yet available.</p>
              )}
            </CardContent>
          </Card>

          {/* Evidence */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              <EvidencePanel evidence={evidence} />
            </CardContent>
          </Card>

          {/* What Changed */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What Changed</CardTitle>
            </CardHeader>
            <CardContent>
              <WhatChanged result={whatChanged} />
            </CardContent>
          </Card>

          {/* Research History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Research History</CardTitle>
            </CardHeader>
            <CardContent>
              <ResearchRunHistory runs={researchRuns} />
            </CardContent>
          </Card>

          {/* 8. Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {account.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                account.activities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between text-sm">
                    <span>{activity.title}</span>
                    <Badge variant="outline">{activity.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {/* 6. GTM Score */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">GTM Score</CardTitle>
              <RecalculateScoreButton accountId={account.id} />
            </CardHeader>
            <CardContent>
              {latestScore ? (
                <ScoreBreakdown
                  total={latestScore.total}
                  icpFit={latestScore.icpFit}
                  signalStrength={latestScore.signalStrength}
                  problemRelevance={latestScore.problemRelevance}
                  buyingPersona={latestScore.buyingPersona}
                  engagement={latestScore.engagement}
                  scoringVersion={latestScore.scoringVersion}
                  computedAt={latestScore.computedAt}
                  details={latestScore.componentDetails as unknown as ScoreComponentDetails}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not yet scored. Click &ldquo;Recalculate Score&rdquo; to run the deterministic scoring engine.
                </p>
              )}
            </CardContent>
          </Card>

          {/* 7. Recommended action */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommended Action</CardTitle>
            </CardHeader>
            <CardContent>
              {whyNowData ? (
                <RecommendedActionPanel whyNow={whyNowData} />
              ) : (
                <ComingSoon note="Run research to get a recommended next action." />
              )}
            </CardContent>
          </Card>

          {/* Activation History */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Activation</CardTitle>
              <GenerateActivationDialog accountId={account.id} contacts={account.contacts} />
            </CardHeader>
            <CardContent>
              <ActivationHistory accountId={account.id} activations={activations} />
            </CardContent>
          </Card>

          {/* Outcome History */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Outcome History</CardTitle>
              <RecordOutcomeDialog accountId={account.id} contacts={account.contacts} />
            </CardHeader>
            <CardContent>
              <OutcomeHistory accountId={account.id} outcomes={outcomes} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* GTM Journey */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">GTM Journey</CardTitle>
        </CardHeader>
        <CardContent>
          <GtmJourney entries={journey} />
        </CardContent>
      </Card>
    </div>
  );
}

function Attribute({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}

