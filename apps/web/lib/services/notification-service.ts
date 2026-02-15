import { prisma } from "@/lib/prisma";

export async function createNotification({
  userId,
  teamId,
  type,
  title,
  message,
  targetType,
  targetId,
}: {
  userId: string;
  teamId: string;
  type: string;
  title: string;
  message?: string;
  targetType?: string;
  targetId?: string;
}) {
  return prisma.notification.create({
    data: { userId, teamId, type, title, message, targetType, targetId },
  });
}

export async function createNotificationsForTeam({
  teamId,
  mailboxId,
  excludeUserId,
  type,
  title,
  message,
  targetType,
  targetId,
  roles,
}: {
  teamId: string;
  mailboxId?: string;
  excludeUserId?: string;
  type: string;
  title: string;
  message?: string;
  targetType?: string;
  targetId?: string;
  roles?: string[];
}) {
  let userIds: string[];

  if (mailboxId) {
    const accessRecords = await prisma.mailboxAccess.findMany({
      where: { mailboxId },
      select: { userId: true, user: { select: { role: true } } },
    });

    userIds = accessRecords
      .filter((a) => !roles?.length || roles.includes(a.user.role))
      .map((a) => a.userId);
  } else {
    const users = await prisma.user.findMany({
      where: {
        teamId,
        ...(roles?.length ? { role: { in: roles } } : {}),
      },
      select: { id: true },
    });
    userIds = users.map((u) => u.id);
  }

  if (excludeUserId) {
    userIds = userIds.filter((id) => id !== excludeUserId);
  }

  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      teamId,
      type,
      title,
      message,
      targetType,
      targetId,
    })),
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}
