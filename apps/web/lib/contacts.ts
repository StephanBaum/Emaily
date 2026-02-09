import { prisma } from "@/lib/prisma";
import type { TrustLevel } from "@emailautomation/shared";

/**
 * Upsert a contact from an incoming email.
 * New contacts start as "known" (auto-learned on first interaction).
 * Increments interactionCount on every call.
 */
export async function upsertContactFromEmail(
  teamId: string,
  fromAddress: string,
  fromName: string | null
): Promise<{ trustLevel: TrustLevel; contactId: string }> {
  const domain = fromAddress.split("@")[1]?.toLowerCase() || null;

  const contact = await prisma.contact.upsert({
    where: {
      teamId_email: { teamId, email: fromAddress.toLowerCase() },
    },
    update: {
      interactionCount: { increment: 1 },
      lastContactedAt: new Date(),
      ...(fromName ? { name: fromName } : {}),
    },
    create: {
      teamId,
      email: fromAddress.toLowerCase(),
      name: fromName || null,
      domain,
      trustLevel: "known",
      interactionCount: 1,
      autoLearned: true,
      lastContactedAt: new Date(),
    },
  });

  return {
    trustLevel: contact.trustLevel as TrustLevel,
    contactId: contact.id,
  };
}

/**
 * Elevate trust when our team replies to a contact.
 * stranger/known → trusted. Never downgrades vip.
 */
export async function elevateTrustOnReply(
  teamId: string,
  recipientAddress: string
): Promise<void> {
  const contact = await prisma.contact.findUnique({
    where: {
      teamId_email: { teamId, email: recipientAddress.toLowerCase() },
    },
  });

  if (!contact) return;

  const currentTrust = contact.trustLevel as TrustLevel;
  if (currentTrust === "vip" || currentTrust === "trusted") {
    // Already trusted or higher — just bump the reply count
    await prisma.contact.update({
      where: { id: contact.id },
      data: { repliedToCount: { increment: 1 } },
    });
    return;
  }

  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      trustLevel: "trusted",
      repliedToCount: { increment: 1 },
    },
  });
}

/**
 * Look up a sender's trust level.
 * Returns "stranger" if no contact record exists.
 */
export async function getSenderTrustLevel(
  teamId: string,
  fromAddress: string
): Promise<TrustLevel> {
  const contact = await prisma.contact.findUnique({
    where: {
      teamId_email: { teamId, email: fromAddress.toLowerCase() },
    },
    select: { trustLevel: true },
  });

  return (contact?.trustLevel as TrustLevel) || "stranger";
}
