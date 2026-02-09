import nodemailer from "nodemailer";

const SENDERS = [
  { name: "Sarah Chen", email: "sarah.chen@acmecorp.com" },
  { name: "Mike Johnson", email: "mike.j@techstartup.io" },
  { name: "Lisa Park", email: "lisa@designstudio.co" },
  { name: "David Kim", email: "david.kim@lawfirm.com" },
  { name: "Emma Wilson", email: "emma.w@freelance.dev" },
  { name: "James Lee", email: "james@retailco.com" },
  { name: "Ana Rodriguez", email: "ana.r@university.edu" },
  { name: "Tom Baker", email: "tom@cloudservices.net" },
];

const SCENARIOS = [
  {
    subject: "Quick question about your API rate limits",
    body: "Hi there,\n\nI've been using your API for my project and I'm hitting rate limits during peak hours. Could you let me know:\n\n1. What are the current rate limits for the Pro plan?\n2. Is there a way to request a temporary increase?\n3. Do you offer dedicated endpoints for high-volume users?\n\nWe're processing about 50k requests/hour and it's causing timeouts for our customers.\n\nThanks,\n",
  },
  {
    subject: "Invoice #4521 - Payment overdue",
    body: "Dear Team,\n\nThis is a reminder that invoice #4521 dated January 15, 2026 for $3,450.00 is now 15 days overdue.\n\nPlease arrange payment at your earliest convenience. If you've already sent the payment, please disregard this message.\n\nPayment details:\n- Amount: $3,450.00\n- Due date: January 25, 2026\n- Invoice: #4521\n\nBest regards,\n",
  },
  {
    subject: "Bug report: Dashboard charts not loading on Firefox",
    body: "Hi Support,\n\nI've found a bug in the dashboard. The analytics charts fail to render on Firefox 124+. Steps to reproduce:\n\n1. Open the dashboard in Firefox\n2. Navigate to Analytics > Revenue\n3. The chart area shows a blank white space\n4. Console shows: TypeError canvas.getContext is not a function\n\nThis works fine in Chrome and Safari. Seems like a Firefox-specific Canvas API issue.\n\nPriority: High - our team primarily uses Firefox.\n\nCheers,\n",
  },
  {
    subject: "Partnership proposal - Content collaboration",
    body: "Hello,\n\nI'm reaching out from DesignStudio Co. We've been following your product and think there's a great opportunity for content collaboration.\n\nWe'd like to propose:\n- Co-authored blog series on modern email workflows\n- Joint webinar on team collaboration tools\n- Cross-promotion to our 25k subscriber newsletter\n\nWould you be interested in setting up a call this week to discuss further?\n\nBest,\n",
  },
  {
    subject: "Re: Server migration scheduled for this weekend",
    body: "Team,\n\nJust confirming the migration timeline for this weekend:\n\n- Saturday 2am: Begin database migration\n- Saturday 4am: Switch DNS records\n- Saturday 6am: Verify all services\n- Saturday 8am: Send all-clear or rollback decision\n\nPlease make sure your on-call contacts are up to date. If anyone spots issues during the migration window, ping the #ops-critical Slack channel.\n\nQuestions before we proceed?\n\n",
  },
  {
    subject: "Feature request: Dark mode for mobile app",
    body: "Hi product team,\n\nWe've received multiple requests from users asking for dark mode support in the mobile app. Here's a summary:\n\n- 47 support tickets in the last month mentioning dark mode\n- Our NPS comments frequently cite eye strain\n- Competitors X and Y both launched dark mode recently\n\nCan you add this to the roadmap? Our users would really appreciate it.\n\nThanks,\n",
  },
  {
    subject: "Legal review needed - Updated Terms of Service",
    body: "Dear Legal Team,\n\nWe've drafted updated Terms of Service to comply with the new EU Digital Services Act requirements. Key changes:\n\n1. Added transparency reporting obligations\n2. Updated content moderation policies\n3. New user rights section (data portability, appeal process)\n4. Modified liability clauses for platform services\n\nPlease review the attached draft by Friday. We need to publish the updated terms before March 1st.\n\nRegards,\n",
  },
  {
    subject: "Customer feedback: Love the new search feature!",
    body: "Hey team!\n\nJust wanted to share some positive feedback we received today. A customer wrote: The new search is incredible.\n\nGreat work on the release. Wanted to make sure the dev team sees this too.\n\nCheers,\n",
  },
  {
    subject: "Urgent: Production database running low on disk space",
    body: "ALERT - Production DB disk usage at 87%\n\nThe main production database server is approaching capacity. Current stats:\n\n- Disk usage: 87% (412GB / 475GB)\n- Growth rate: ~2GB/day\n- Estimated time to full: ~30 days\n\nImmediate actions needed:\n1. Identify and archive old log tables\n2. Schedule disk expansion with cloud provider\n3. Review data retention policies\n\nThis is not yet critical but needs attention this week.\n\n",
  },
  {
    subject: "Welcome aboard! Your onboarding checklist",
    body: "Hi!\n\nWelcome to the team! Here's your onboarding checklist for the first week:\n\n- Set up your development environment\n- Complete security training\n- Join the team Slack channels\n- Schedule 1:1s with your team lead and mentor\n- Review the codebase architecture docs\n\nYour buddy for the first month will be Sarah from the backend team.\n\nBest,\n",
  },
  {
    subject: "Can we reschedule tomorrow's meeting?",
    body: "Hey,\n\nSomething came up and I won't be able to make our 2pm meeting tomorrow. Would any of these times work instead?\n\n- Wednesday 10am\n- Wednesday 3pm\n- Thursday 11am\n\nSorry for the short notice. The quarterly board review got moved up and conflicts with our slot.\n\nLet me know what works,\n",
  },
];

/**
 * Sends 1-3 random test emails via SMTP to the specified mailbox address.
 * Uses nodemailer directly without auth (GreenMail accepts unauthenticated SMTP).
 */
export async function injectTestEmails(
  smtpHost: string,
  smtpPort: number,
  targetAddress: string
): Promise<{ sent: number; subjects: string[] }> {
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    tls: { rejectUnauthorized: false },
  });

  const count = 1 + Math.floor(Math.random() * 3);
  const sentSubjects: string[] = [];

  try {
    for (let i = 0; i < count; i++) {
      const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
      const sender = SENDERS[Math.floor(Math.random() * SENDERS.length)];

      await transporter.sendMail({
        from: `"${sender.name}" <${sender.email}>`,
        to: targetAddress,
        subject: scenario.subject,
        text: scenario.body + sender.name,
      });

      sentSubjects.push(scenario.subject);
    }
  } finally {
    transporter.close();
  }

  return { sent: sentSubjects.length, subjects: sentSubjects };
}
