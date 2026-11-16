import type { ActivationChannelKey } from "@/config/meridian/activationChannels";
import type { ActivationContent } from "@/lib/ai/schemas/activation";

// Denormalizes angle/cta out of the channel-specific content shape at
// generation time, purely so Phase 6 analytics can group/filter by these
// without parsing per-channel JSON at query time (see the comment on
// Activation.angle in prisma/schema.prisma). SALES_BRIEF has no angle/cta
// concept at all — both are null for it, which is correct, not a gap.
export function extractAngleAndCta(
  channel: ActivationChannelKey,
  content: ActivationContent,
): { angle: string | null; cta: string | null } {
  if (channel === "LINKEDIN" || channel === "EMAIL") {
    const c = content as { angle: string; cta: string };
    return { angle: c.angle, cta: c.cta };
  }
  if (channel === "CONTENT_RECOMMENDATION") {
    const c = content as { contentAngle: string; suggestedCta: string };
    return { angle: c.contentAngle, cta: c.suggestedCta };
  }
  return { angle: null, cta: null };
}
