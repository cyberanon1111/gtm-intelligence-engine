export interface RuleExplanation {
  rule: string;
  matched: boolean;
  points: number;
  explanation: string;
}

export interface IcpFitDetail {
  rules: RuleExplanation[];
}

export interface SignalContribution {
  signalId: string;
  title: string;
  category: string;
  type: string;
  basePoints: number;
  decayFactor: number;
  ageDays: number;
  effectivePoints: number;
  expired: boolean;
  counted: boolean;
}

export interface SignalStrengthDetail {
  signals: SignalContribution[];
}

export interface MatchedProblem {
  problemKey: string;
  label: string;
  description: string;
  evidenceSignalIds: string[];
  relevantProducts: { id: string; name: string }[];
}

export interface ProblemRelevanceDetail {
  matchedProblems: MatchedProblem[];
  countedMatches: number;
}

export interface MatchedContact {
  contactId: string;
  name: string;
  personaName: string;
  seniorityTier: string;
  points: number;
}

export interface BuyingPersonaDetail {
  matchedContacts: MatchedContact[];
  winningContactId?: string;
}

export interface EngagementSignalContribution {
  signalId: string;
  title: string;
  type: string;
  points: number;
}

export interface EngagementOutcomeContribution {
  outcomeId: string;
  activityId: string;
  type: string;
  points: number;
}

export interface EngagementDetail {
  signalContribution: EngagementSignalContribution | null;
  outcomeContribution: EngagementOutcomeContribution | null;
  chosen: "signal" | "outcome" | "none";
}

export interface ScoreComponentDetails {
  icpFit: IcpFitDetail;
  signalStrength: SignalStrengthDetail;
  problemRelevance: ProblemRelevanceDetail;
  buyingPersona: BuyingPersonaDetail;
  engagement: EngagementDetail;
}

export interface ScoreResult {
  accountId: string;
  icpFit: number;
  signalStrength: number;
  problemRelevance: number;
  buyingPersona: number;
  engagement: number;
  total: number;
  scoringVersion: string;
  componentDetails: ScoreComponentDetails;
}
