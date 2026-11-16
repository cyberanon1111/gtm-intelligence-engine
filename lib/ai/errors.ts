// Distinct failure modes so callers (and the persisted AccountInsight.error
// column) can tell "the model API was unreachable" apart from "the model
// replied with something we can't trust" — both are failures, but they mean
// different things and should never be conflated or silently coerced.

export class AIProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AIProviderError";
  }
}

export class AIResponseParseError extends Error {
  raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = "AIResponseParseError";
    this.raw = raw;
  }
}

export class AIResponseValidationError extends Error {
  raw: string;
  issues: string;
  constructor(message: string, raw: string, issues: string) {
    super(message);
    this.name = "AIResponseValidationError";
    this.raw = raw;
    this.issues = issues;
  }
}
