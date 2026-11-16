// Signals are never deleted for aging out — instead their *effective*
// contribution to a score decays continuously over time. This keeps scoring
// history explainable (the raw signal is still there) while ensuring a
// years-old signal doesn't retain full weight forever.

export function ageInDays(from: Date, now: Date): number {
  return Math.max(0, (now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

// Exponential half-life decay: value halves every `halfLifeDays`.
export function decayFactor(ageDays: number, halfLifeDays: number): number {
  if (halfLifeDays <= 0) return 1;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

export function isExpired(signal: { expiresAt: Date | null }, now: Date): boolean {
  return !!signal.expiresAt && now.getTime() >= signal.expiresAt.getTime();
}
