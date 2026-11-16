import type { Account, ICPRule } from "@/lib/generated/prisma/client";
import { DIMENSION_MAX } from "@/lib/scoring/constants";
import type { IcpFitDetail, RuleExplanation } from "@/lib/scoring/types";

// Only fields that already exist on Account — Phase 3 explicitly scopes ICP
// Fit to data already in the database, no new inputs.
export type IcpAccountFields = Pick<
  Account,
  "companyType" | "fleetSize" | "vesselTypes" | "regions" | "country"
>;

function getFieldValue(account: IcpAccountFields, field: string): unknown {
  return (account as unknown as Record<string, unknown>)[field];
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function evaluateIcpRule(rule: ICPRule, account: IcpAccountFields): RuleExplanation {
  const fieldValue = getFieldValue(account, rule.field);

  if (isEmpty(fieldValue)) {
    return {
      rule: rule.name,
      matched: false,
      points: 0,
      explanation: `No data for "${rule.field}" — rule not evaluated.`,
    };
  }

  const ruleValue = rule.value as unknown;
  let matched = false;

  switch (rule.operator) {
    case "EQUALS":
      matched = fieldValue === ruleValue;
      break;
    case "NOT_EQUALS":
      matched = fieldValue !== ruleValue;
      break;
    case "IN":
      matched = Array.isArray(ruleValue) && ruleValue.includes(fieldValue);
      break;
    case "NOT_IN":
      matched = Array.isArray(ruleValue) && !ruleValue.includes(fieldValue);
      break;
    case "GTE":
      matched = typeof fieldValue === "number" && typeof ruleValue === "number" && fieldValue >= ruleValue;
      break;
    case "LTE":
      matched = typeof fieldValue === "number" && typeof ruleValue === "number" && fieldValue <= ruleValue;
      break;
    case "CONTAINS":
      if (Array.isArray(fieldValue)) {
        const wanted = Array.isArray(ruleValue) ? ruleValue : [ruleValue];
        matched = fieldValue.some((v) => wanted.includes(v));
      } else if (typeof fieldValue === "string" && typeof ruleValue === "string") {
        matched = fieldValue.toLowerCase().includes(ruleValue.toLowerCase());
      }
      break;
  }

  return {
    rule: rule.name,
    matched,
    points: matched ? rule.points : 0,
    explanation: matched
      ? (rule.description ?? `Matched configured rule "${rule.name}".`)
      : `Did not match configured rule "${rule.name}" (${rule.field}).`,
  };
}

export function computeIcpFit(
  account: IcpAccountFields,
  rules: ICPRule[],
): { points: number; detail: IcpFitDetail } {
  const activeRules = rules.filter((r) => r.active);
  const evaluations = activeRules.map((rule) => evaluateIcpRule(rule, account));
  const rawTotal = evaluations.reduce((sum, e) => sum + e.points, 0);
  const points = Math.min(rawTotal, DIMENSION_MAX.ICP_FIT);
  return { points, detail: { rules: evaluations } };
}
