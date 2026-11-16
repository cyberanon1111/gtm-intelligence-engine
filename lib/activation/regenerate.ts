import type { Activation, PrismaClient } from "@/lib/generated/prisma/client";
import { generateActivation, type GenerateActivationDeps } from "@/lib/activation/generate";

// Creates a NEW Activation row rather than overwriting the previous draft —
// the prior row is never modified or deleted, and stays fully visible in
// Activation History. Re-gathers context fresh (score/research/evidence may
// have changed since the original draft), reusing the same account/contact/
// channel/objective.
export async function regenerateActivation(
  db: PrismaClient,
  activationId: string,
  deps: GenerateActivationDeps = {},
): Promise<Activation> {
  const previous = await db.activation.findUniqueOrThrow({ where: { id: activationId } });

  const created = await generateActivation(
    db,
    {
      accountId: previous.accountId,
      contactId: previous.contactId,
      channel: previous.channel,
      objective: previous.objective,
    },
    deps,
  );

  return db.activation.update({
    where: { id: created.id },
    data: { regeneratedFromId: previous.id, version: previous.version + 1 },
  });
}
