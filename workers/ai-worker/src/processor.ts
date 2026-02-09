import { Worker } from "bullmq";
import { prisma, Prisma } from "@emailautomation/database";
import { createProviderFromEnv, AutoTagger, IntentExtractor, DraftGenerator } from "@emailautomation/ai-engine";
import type { TagAutoRules } from "@emailautomation/shared";
import { AI_QUEUE_NAME, getRedisConnection, type ProcessEmailJob } from "./queues";

export function createWorker() {
  const provider = createProviderFromEnv();
  const autoTagger = new AutoTagger(provider);
  const intentExtractor = new IntentExtractor(provider);
  const draftGenerator = new DraftGenerator(provider);

  const worker = new Worker<ProcessEmailJob>(
    AI_QUEUE_NAME,
    async (job) => {
      const { emailId, teamId } = job.data;
      console.log(`[AI Worker] Processing email ${emailId} for team ${teamId}`);

      // Fetch email with thread context
      const email = await prisma.email.findUnique({
        where: { id: emailId },
        include: {
          thread: {
            include: {
              emails: {
                orderBy: { date: "asc" },
                select: {
                  id: true,
                  fromAddress: true,
                  bodyText: true,
                  date: true,
                },
              },
              tags: {
                include: { tag: true },
              },
            },
          },
        },
      });

      if (!email) {
        console.warn(`[AI Worker] Email ${emailId} not found, skipping`);
        return;
      }

      // Fetch team tags
      const tags = await prisma.tag.findMany({
        where: { teamId, active: true },
      });

      const emailData = {
        subject: email.subject,
        from: email.fromAddress,
        to: email.toAddresses,
        body: email.bodyText,
      };

      // Step 1: Auto-tag
      const tagData = tags.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        autoRules: t.autoRules as TagAutoRules | null,
      }));

      const tagMatches = await autoTagger.tagEmail(emailData, tagData);

      for (const match of tagMatches) {
        await prisma.threadTag.upsert({
          where: {
            threadId_tagId: {
              threadId: email.threadId,
              tagId: match.tagId,
            },
          },
          update: {},
          create: {
            threadId: email.threadId,
            tagId: match.tagId,
            appliedBy: match.appliedBy,
          },
        });
      }

      // Step 2: Extract intents
      const previousEmails = email.thread.emails
        .filter((e) => e.id !== emailId)
        .map((e) => ({
          from: e.fromAddress,
          body: e.bodyText,
          date: e.date,
        }));

      const intents = await intentExtractor.extractIntents(emailData, previousEmails);

      if (intents.length > 0) {
        await prisma.emailIntent.upsert({
          where: { emailId },
          update: {
            intents: JSON.parse(JSON.stringify(intents)) as Prisma.InputJsonValue,
            modelVersion: provider.name,
          },
          create: {
            emailId,
            intents: JSON.parse(JSON.stringify(intents)) as Prisma.InputJsonValue,
            modelVersion: provider.name,
          },
        });
      }

      // Step 3: Check for draft-triggering tags
      const appliedTagIds = new Set([
        ...tagMatches.map((m) => m.tagId),
        ...email.thread.tags.map((t) => t.tagId),
      ]);

      const draftTriggerTags = tags.filter(
        (t) => appliedTagIds.has(t.id) && (t.aiAction === "draft" || t.aiAction === "research_draft")
      );

      if (draftTriggerTags.length > 0 && intents.length > 0) {
        // Check if a draft already exists for this thread
        const existingDraft = await prisma.sharedDraft.findFirst({
          where: {
            threadId: email.threadId,
            status: { not: "sent" },
          },
        });

        if (!existingDraft) {
          // Fetch Q&A pairs for this team
          const qaPairs = await prisma.qAPair.findMany({
            where: { teamId, approved: true },
          });

          const threadContext = intentExtractor.buildThreadContext(previousEmails);

          const draft = await draftGenerator.generateDraft(
            emailData,
            intents,
            qaPairs.map((qa) => ({
              id: qa.id,
              triggerPatterns: qa.triggerPatterns,
              idealResponse: qa.idealResponse,
            })),
            threadContext
          );

          // Find the mailbox for this thread to get a createdById
          const mailbox = await prisma.mailbox.findUnique({
            where: { id: email.thread.mailboxId },
            include: {
              access: {
                where: { permission: { in: ["write", "admin"] } },
                take: 1,
              },
            },
          });

          if (mailbox?.access[0]) {
            await prisma.sharedDraft.create({
              data: {
                threadId: email.threadId,
                mailboxId: mailbox.id,
                createdById: mailbox.access[0].userId,
                subject: draft.subject,
                body: draft.body,
                toAddresses: [email.fromAddress],
                status: "drafting",
                lockType: "generating",
                confidence: JSON.parse(JSON.stringify(draft.confidence)) as Prisma.InputJsonValue,
              },
            });
          }
        }
      }

      console.log(
        `[AI Worker] Processed email ${emailId}: ${tagMatches.length} tags, ${intents.length} intents`
      );
    },
    {
      connection: getRedisConnection(),
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 60_000,
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[AI Worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[AI Worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
