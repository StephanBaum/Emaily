/**
 * seed-emails.ts — Populate the database with diverse test emails
 *
 * Creates ~30 emails across ~15 threads covering different categories
 * for testing AI auto-tagging and classification features.
 *
 * Prerequisites: Run `pnpm db:seed` first to create team, user, and mailbox.
 *
 * Usage:
 *   cd packages/database
 *   pnpm db:seed:emails
 *
 * Categories covered:
 *   - Newsletter / marketing (HTML-heavy, single email)
 *   - Promotional / sale blast
 *   - SaaS notifications (password reset, billing, etc.)
 *   - Shipping / order confirmation
 *   - Client support threads (back-and-forth)
 *   - Sales inquiry threads
 *   - Bug report from customer
 *   - Feature request
 *   - Invoice / billing
 *   - Meeting / calendar
 *   - Cold outreach / spam-like
 *   - Internal team discussion
 *   - Contract / legal
 *   - Personal / casual
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEAM_ID = "test-team-1";
const MAILBOX_ID = "test-mailbox-1";
const INBOX_ADDRESS = "test@localhost";

/** Helper to create a date N days ago at a given hour */
function daysAgo(days: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
  return d;
}

interface ThreadDef {
  id: string;
  subject: string;
  status?: string;
  hasSentReply?: boolean;
  emails: EmailDef[];
}

interface EmailDef {
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  subject: string;
  bodyText: string;
  bodyHtml: string;
  fromAddress: string;
  fromName?: string;
  toAddresses: string[];
  ccAddresses?: string[];
  date: Date;
  isBot?: boolean;
  isSent?: boolean;
}

// ---------------------------------------------------------------------------
// Thread & Email definitions
// ---------------------------------------------------------------------------

const threads: ThreadDef[] = [
  // ── 1. Newsletter (single HTML email) ───────────────────────────────
  {
    id: "thread-newsletter-weekly",
    subject: "This Week in Tech: AI Breakthroughs & Cloud Updates",
    emails: [
      {
        messageId: "<newsletter-2026-w5@techdigest.io>",
        subject: "This Week in Tech: AI Breakthroughs & Cloud Updates",
        fromAddress: "digest@techdigest.io",
        fromName: "TechDigest Weekly",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(2, 7),
        isBot: true,
        bodyText:
          "This Week in Tech — Feb 5 2026\n\nTop Stories:\n1. OpenAI announces GPT-5 with real-time reasoning\n2. AWS cuts S3 pricing by 30%\n3. Kubernetes 1.33 released with improved autoscaling\n\nRead more at techdigest.io\n\nUnsubscribe: techdigest.io/unsub",
        bodyHtml: `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif">
  <div style="background:#1a1a2e;color:white;padding:20px;text-align:center">
    <h1 style="margin:0">TechDigest Weekly</h1>
    <p style="color:#aaa;margin:5px 0">February 5, 2026</p>
  </div>
  <div style="padding:20px;background:#f8f9fa">
    <h2 style="color:#333">Top Stories This Week</h2>
    <div style="border-left:4px solid #4361ee;padding:10px 15px;margin:10px 0;background:white">
      <h3>OpenAI announces GPT-5 with real-time reasoning</h3>
      <p>The latest model demonstrates significant improvements in multi-step problem solving...</p>
    </div>
    <div style="border-left:4px solid #4361ee;padding:10px 15px;margin:10px 0;background:white">
      <h3>AWS cuts S3 pricing by 30%</h3>
      <p>Amazon Web Services announced major price reductions across their storage services...</p>
    </div>
    <div style="border-left:4px solid #4361ee;padding:10px 15px;margin:10px 0;background:white">
      <h3>Kubernetes 1.33 released</h3>
      <p>New autoscaling capabilities and improved pod scheduling make this a significant release...</p>
    </div>
  </div>
  <div style="padding:10px 20px;background:#eee;text-align:center;font-size:12px;color:#666">
    <a href="#">Unsubscribe</a> | <a href="#">View in browser</a>
  </div>
</div>`,
      },
    ],
  },

  // ── 2. Promotional / sale email ─────────────────────────────────────
  {
    id: "thread-promo-saas",
    subject: "🔥 Last chance: 50% off Annual Plans — Ends Tonight!",
    emails: [
      {
        messageId: "<promo-annual-sale@cloudhost.com>",
        subject: "🔥 Last chance: 50% off Annual Plans — Ends Tonight!",
        fromAddress: "deals@cloudhost.com",
        fromName: "CloudHost",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(1, 10),
        isBot: true,
        bodyText:
          "FLASH SALE — 50% OFF\n\nUpgrade to our annual plan and save 50%. This offer expires tonight at midnight.\n\nStarter: $4.99/mo (was $9.99)\nPro: $12.49/mo (was $24.99)\nEnterprise: Contact sales\n\nUse code SAVE50 at checkout.\n\nCloudHost Inc. | Unsubscribe",
        bodyHtml: `<div style="max-width:600px;margin:0 auto;font-family:Helvetica,sans-serif">
  <div style="background:linear-gradient(135deg,#ff6b6b,#ee5a24);color:white;padding:30px;text-align:center">
    <h1 style="font-size:28px;margin:0">🔥 FLASH SALE 🔥</h1>
    <p style="font-size:20px;margin:10px 0">50% OFF Annual Plans</p>
    <p style="font-size:14px;opacity:0.9">Ends tonight at midnight</p>
  </div>
  <div style="padding:20px;background:white">
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#f8f9fa"><td style="padding:12px"><strong>Starter</strong></td><td style="padding:12px;text-align:right"><s>$9.99</s> <strong style="color:#ee5a24">$4.99/mo</strong></td></tr>
      <tr><td style="padding:12px"><strong>Pro</strong></td><td style="padding:12px;text-align:right"><s>$24.99</s> <strong style="color:#ee5a24">$12.49/mo</strong></td></tr>
      <tr style="background:#f8f9fa"><td style="padding:12px"><strong>Enterprise</strong></td><td style="padding:12px;text-align:right">Contact Sales</td></tr>
    </table>
    <div style="text-align:center;margin:20px 0">
      <span style="background:#ee5a24;color:white;padding:12px 30px;border-radius:5px;font-size:16px;display:inline-block">Use code: SAVE50</span>
    </div>
  </div>
  <div style="padding:10px;text-align:center;font-size:11px;color:#999">CloudHost Inc. | <a href="#">Unsubscribe</a></div>
</div>`,
      },
    ],
  },

  // ── 3. SaaS notification — password reset ───────────────────────────
  {
    id: "thread-password-reset",
    subject: "Password reset requested for your account",
    emails: [
      {
        messageId: "<pwd-reset-9283@github.com>",
        subject: "Password reset requested for your account",
        fromAddress: "noreply@github.com",
        fromName: "GitHub",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(5, 14),
        isBot: true,
        bodyText:
          "We received a request to reset the password for your account.\n\nIf you made this request, click the link below:\nhttps://github.com/password-reset/abc123\n\nThis link expires in 24 hours.\n\nIf you did not request a password reset, please ignore this email.\n\n— The GitHub Team",
        bodyHtml: `<div style="max-width:500px;margin:0 auto;font-family:-apple-system,sans-serif;padding:20px">
  <div style="text-align:center;padding:20px"><img alt="GitHub" style="width:40px" /></div>
  <h2 style="text-align:center">Password reset</h2>
  <p>We received a request to reset your password.</p>
  <div style="text-align:center;margin:20px 0">
    <a href="#" style="background:#2ea44f;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">Reset your password</a>
  </div>
  <p style="color:#666;font-size:13px">This link expires in 24 hours. If you didn't request this, ignore this email.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
  <p style="color:#999;font-size:12px;text-align:center">GitHub, Inc. | San Francisco, CA</p>
</div>`,
      },
    ],
  },

  // ── 4. Invoice / billing email ──────────────────────────────────────
  {
    id: "thread-invoice-jan",
    subject: "Invoice #INV-2026-0142 — Payment Due Feb 15",
    emails: [
      {
        messageId: "<invoice-0142@freshbooks.example.com>",
        subject: "Invoice #INV-2026-0142 — Payment Due Feb 15",
        fromAddress: "billing@acmedesign.co",
        fromName: "Acme Design Co",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(7, 9),
        isBot: false,
        bodyText:
          "Hi,\n\nPlease find attached invoice #INV-2026-0142 for services rendered in January 2026.\n\nAmount Due: $3,450.00\nDue Date: February 15, 2026\nPayment Terms: Net 15\n\nBank details:\nAccount: Acme Design Co\nIBAN: NL91 ABNA 0417 1643 00\nReference: INV-2026-0142\n\nPlease let me know if you have any questions.\n\nBest regards,\nSarah Chen\nAccounts — Acme Design Co",
        bodyHtml: `<div style="max-width:600px;margin:0 auto;font-family:Georgia,serif;padding:20px">
  <h2>Invoice #INV-2026-0142</h2>
  <table style="width:100%;border-collapse:collapse;margin:15px 0">
    <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Amount Due</strong></td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-size:18px"><strong>$3,450.00</strong></td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee">Due Date</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">February 15, 2026</td></tr>
    <tr><td style="padding:8px">Payment Terms</td><td style="padding:8px;text-align:right">Net 15</td></tr>
  </table>
  <p>Bank details:<br/>Account: Acme Design Co<br/>IBAN: NL91 ABNA 0417 1643 00<br/>Reference: INV-2026-0142</p>
  <p>Please let me know if you have any questions.</p>
  <p>Best regards,<br/><strong>Sarah Chen</strong><br/>Accounts — Acme Design Co</p>
</div>`,
      },
    ],
  },

  // ── 5. Shipping notification ────────────────────────────────────────
  {
    id: "thread-shipping-order",
    subject: "Your order #ORD-88291 has shipped!",
    emails: [
      {
        messageId: "<order-88291-shipped@shop.example.com>",
        subject: "Your order #ORD-88291 has shipped!",
        fromAddress: "orders@techgear.shop",
        fromName: "TechGear Shop",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(3, 15),
        isBot: true,
        bodyText:
          "Great news! Your order has shipped.\n\nOrder: #ORD-88291\nItem: USB-C Hub 7-in-1\nTracking: DHL 3948571038475\nEstimated delivery: Feb 9-11, 2026\n\nTrack your package: https://tracking.example.com/3948571038475\n\nThank you for shopping with us!",
        bodyHtml: `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif">
  <div style="background:#2d3436;color:white;padding:20px;text-align:center">
    <h2 style="margin:0">📦 Your order has shipped!</h2>
  </div>
  <div style="padding:20px">
    <table style="width:100%">
      <tr><td style="padding:5px;color:#666">Order</td><td style="padding:5px"><strong>#ORD-88291</strong></td></tr>
      <tr><td style="padding:5px;color:#666">Item</td><td style="padding:5px">USB-C Hub 7-in-1</td></tr>
      <tr><td style="padding:5px;color:#666">Carrier</td><td style="padding:5px">DHL</td></tr>
      <tr><td style="padding:5px;color:#666">Tracking</td><td style="padding:5px">3948571038475</td></tr>
      <tr><td style="padding:5px;color:#666">Estimated</td><td style="padding:5px">Feb 9-11, 2026</td></tr>
    </table>
    <div style="text-align:center;margin:20px 0">
      <a href="#" style="background:#0984e3;color:white;padding:10px 25px;border-radius:4px;text-decoration:none">Track Package</a>
    </div>
  </div>
</div>`,
      },
    ],
  },

  // ── 6. Client support thread (3 emails back-and-forth) ──────────────
  {
    id: "thread-support-login",
    subject: "Can't log in after updating my password",
    hasSentReply: true,
    emails: [
      {
        messageId: "<support-login-1@client.example.com>",
        subject: "Can't log in after updating my password",
        fromAddress: "maria.gonzalez@clientcorp.com",
        fromName: "Maria Gonzalez",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(4, 10),
        bodyText:
          "Hi,\n\nI updated my password yesterday through the settings page, but now I can't log in at all. I've tried resetting it twice and I keep getting \"Invalid credentials\" error.\n\nI'm locked out and have a deadline today. Can you help urgently?\n\nThanks,\nMaria Gonzalez\nProject Manager, ClientCorp",
        bodyHtml:
          "<p>Hi,</p><p>I updated my password yesterday through the settings page, but now I can't log in at all. I've tried resetting it twice and I keep getting <strong>\"Invalid credentials\"</strong> error.</p><p>I'm locked out and have a deadline today. Can you help urgently?</p><p>Thanks,<br/>Maria Gonzalez<br/>Project Manager, ClientCorp</p>",
      },
      {
        messageId: "<support-login-2@localhost>",
        inReplyTo: "<support-login-1@client.example.com>",
        references: ["<support-login-1@client.example.com>"],
        subject: "Re: Can't log in after updating my password",
        fromAddress: INBOX_ADDRESS,
        fromName: "Test User",
        toAddresses: ["maria.gonzalez@clientcorp.com"],
        date: daysAgo(4, 11),
        isSent: true,
        bodyText:
          "Hi Maria,\n\nSorry to hear about the trouble. I've looked into your account and it seems the password change didn't propagate correctly to our auth service.\n\nI've manually reset your password to a temporary one. You should receive a separate email with instructions.\n\nCould you try logging in again and let me know?\n\nBest,\nTest User",
        bodyHtml:
          "<p>Hi Maria,</p><p>Sorry to hear about the trouble. I've looked into your account and it seems the password change didn't propagate correctly to our auth service.</p><p>I've manually reset your password to a temporary one. You should receive a separate email with instructions.</p><p>Could you try logging in again and let me know?</p><p>Best,<br/>Test User</p>",
      },
      {
        messageId: "<support-login-3@client.example.com>",
        inReplyTo: "<support-login-2@localhost>",
        references: [
          "<support-login-1@client.example.com>",
          "<support-login-2@localhost>",
        ],
        subject: "Re: Can't log in after updating my password",
        fromAddress: "maria.gonzalez@clientcorp.com",
        fromName: "Maria Gonzalez",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(4, 12),
        bodyText:
          "That worked, I'm back in! Thank you so much for the quick response.\n\nOne more thing — is there a way to enable two-factor authentication? I'd like to add an extra layer of security.\n\nThanks,\nMaria",
        bodyHtml:
          "<p>That worked, I'm back in! Thank you so much for the quick response.</p><p>One more thing — is there a way to enable two-factor authentication? I'd like to add an extra layer of security.</p><p>Thanks,<br/>Maria</p>",
      },
    ],
  },

  // ── 7. Sales inquiry thread (2 emails) ──────────────────────────────
  {
    id: "thread-sales-enterprise",
    subject: "Enterprise pricing for 50-seat deployment",
    emails: [
      {
        messageId: "<sales-ent-1@bigclient.example.com>",
        subject: "Enterprise pricing for 50-seat deployment",
        fromAddress: "j.nakamura@bigclient.example.com",
        fromName: "Jun Nakamura",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(6, 8),
        bodyText:
          "Hello,\n\nWe're evaluating email collaboration tools for our engineering team (approximately 50 people). We'd like to understand:\n\n1. Enterprise pricing for 50 seats\n2. SSO integration (we use Okta)\n3. Self-hosted deployment options\n4. SLA and support terms\n\nWe're looking to make a decision by end of February. Could we schedule a demo call next week?\n\nBest regards,\nJun Nakamura\nVP Engineering, BigClient Inc.",
        bodyHtml:
          "<p>Hello,</p><p>We're evaluating email collaboration tools for our engineering team (approximately 50 people). We'd like to understand:</p><ol><li>Enterprise pricing for 50 seats</li><li>SSO integration (we use Okta)</li><li>Self-hosted deployment options</li><li>SLA and support terms</li></ol><p>We're looking to make a decision by end of February. Could we schedule a demo call next week?</p><p>Best regards,<br/>Jun Nakamura<br/>VP Engineering, BigClient Inc.</p>",
      },
      {
        messageId: "<sales-ent-2@bigclient.example.com>",
        inReplyTo: "<sales-ent-1@bigclient.example.com>",
        references: ["<sales-ent-1@bigclient.example.com>"],
        subject: "Re: Enterprise pricing for 50-seat deployment",
        fromAddress: "j.nakamura@bigclient.example.com",
        fromName: "Jun Nakamura",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(3, 9),
        bodyText:
          "Hi again,\n\nJust following up on my previous email. Our team is finalizing the shortlist this week, so timing is getting tight.\n\nWould Thursday or Friday work for a 30-minute call?\n\nThanks,\nJun",
        bodyHtml:
          "<p>Hi again,</p><p>Just following up on my previous email. Our team is finalizing the shortlist this week, so timing is getting tight.</p><p>Would Thursday or Friday work for a 30-minute call?</p><p>Thanks,<br/>Jun</p>",
      },
    ],
  },

  // ── 8. Bug report from customer (2 emails) ─────────────────────────
  {
    id: "thread-bug-csv-export",
    subject: "BUG: CSV export produces corrupted files with special characters",
    emails: [
      {
        messageId: "<bug-csv-1@user.example.com>",
        subject:
          "BUG: CSV export produces corrupted files with special characters",
        fromAddress: "alex.petrov@techstartup.io",
        fromName: "Alex Petrov",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(2, 16),
        bodyText:
          "Hi team,\n\nI've found a bug in the CSV export feature. When email subjects contain special characters (like umlauts: ä, ö, ü or emoji), the exported CSV file gets corrupted.\n\nSteps to reproduce:\n1. Go to a thread with special chars in subject\n2. Click Export > CSV\n3. Open the file — garbled text appears\n\nBrowser: Chrome 121\nOS: macOS 15.1\n\nThis is blocking our monthly reporting. We need this fixed ASAP.\n\nAttached: screenshot of the corrupted output.\n\n— Alex Petrov, CTO @ TechStartup",
        bodyHtml:
          "<p>Hi team,</p><p>I've found a bug in the CSV export feature. When email subjects contain special characters (like umlauts: ä, ö, ü or emoji), the exported CSV file gets corrupted.</p><h4>Steps to reproduce:</h4><ol><li>Go to a thread with special chars in subject</li><li>Click Export &gt; CSV</li><li>Open the file — garbled text appears</li></ol><p><strong>Browser:</strong> Chrome 121<br/><strong>OS:</strong> macOS 15.1</p><p>This is blocking our monthly reporting. We need this fixed ASAP.</p><p>— Alex Petrov, CTO @ TechStartup</p>",
      },
      {
        messageId: "<bug-csv-2@user.example.com>",
        inReplyTo: "<bug-csv-1@user.example.com>",
        references: ["<bug-csv-1@user.example.com>"],
        subject:
          "Re: BUG: CSV export produces corrupted files with special characters",
        fromAddress: "alex.petrov@techstartup.io",
        fromName: "Alex Petrov",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(1, 8),
        bodyText:
          "Following up — we found a workaround by piping the export through a UTF-8 converter, but this shouldn't be necessary.\n\nAlso noticed the same issue affects PDF exports. Probably a shared encoding problem in the export pipeline.\n\n— Alex",
        bodyHtml:
          "<p>Following up — we found a workaround by piping the export through a UTF-8 converter, but this shouldn't be necessary.</p><p>Also noticed the same issue affects PDF exports. Probably a shared encoding problem in the export pipeline.</p><p>— Alex</p>",
      },
    ],
  },

  // ── 9. Feature request ──────────────────────────────────────────────
  {
    id: "thread-feature-darkmode",
    subject: "Feature Request: Dark mode and custom themes",
    emails: [
      {
        messageId: "<feat-dark-1@user.example.com>",
        subject: "Feature Request: Dark mode and custom themes",
        fromAddress: "priya.sharma@designstudio.co",
        fromName: "Priya Sharma",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(8, 11),
        bodyText:
          "Hello,\n\nI'd love to see dark mode support in the email client. Our team works late hours and the bright white interface causes eye strain.\n\nIdeal features:\n- System-preference auto-detection\n- Manual toggle in settings\n- Custom accent color picker\n- Reduced motion option\n\nWe have 12 seats on your Pro plan and this would significantly improve our daily experience.\n\nThanks for considering!\nPriya Sharma\nLead Designer, Design Studio Co",
        bodyHtml:
          "<p>Hello,</p><p>I'd love to see dark mode support in the email client. Our team works late hours and the bright white interface causes eye strain.</p><p><strong>Ideal features:</strong></p><ul><li>System-preference auto-detection</li><li>Manual toggle in settings</li><li>Custom accent color picker</li><li>Reduced motion option</li></ul><p>We have 12 seats on your Pro plan and this would significantly improve our daily experience.</p><p>Thanks for considering!<br/>Priya Sharma<br/>Lead Designer, Design Studio Co</p>",
      },
    ],
  },

  // ── 10. Meeting / calendar request ──────────────────────────────────
  {
    id: "thread-meeting-quarterly",
    subject: "Q1 Planning Meeting — Feb 12, 2pm CET",
    emails: [
      {
        messageId: "<meeting-q1-1@partner.example.com>",
        subject: "Q1 Planning Meeting — Feb 12, 2pm CET",
        fromAddress: "tom.eriksen@partner.example.com",
        fromName: "Tom Eriksen",
        toAddresses: [INBOX_ADDRESS],
        ccAddresses: ["lisa.wong@partner.example.com"],
        date: daysAgo(5, 9),
        bodyText:
          "Hi,\n\nI'd like to schedule our quarterly planning session. How about Wednesday Feb 12 at 2pm CET?\n\nAgenda:\n1. Q4 retrospective\n2. Q1 goals and OKRs\n3. Resource allocation\n4. Upcoming releases timeline\n\nThe call will be on Google Meet. I'll send the calendar invite once confirmed.\n\nLet me know if the time works.\n\nBest,\nTom Eriksen\nPartner Relations",
        bodyHtml:
          "<p>Hi,</p><p>I'd like to schedule our quarterly planning session. How about Wednesday Feb 12 at 2pm CET?</p><p><strong>Agenda:</strong></p><ol><li>Q4 retrospective</li><li>Q1 goals and OKRs</li><li>Resource allocation</li><li>Upcoming releases timeline</li></ol><p>The call will be on Google Meet. I'll send the calendar invite once confirmed.</p><p>Let me know if the time works.</p><p>Best,<br/>Tom Eriksen<br/>Partner Relations</p>",
      },
    ],
  },

  // ── 11. Cold outreach / spam-like ───────────────────────────────────
  {
    id: "thread-cold-outreach",
    subject: "Quick question about your email infrastructure",
    emails: [
      {
        messageId: "<outreach-7823@salesbot.example.com>",
        subject: "Quick question about your email infrastructure",
        fromAddress: "derek.sales@saasvendor.io",
        fromName: "Derek",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(3, 6),
        bodyText:
          "Hi there,\n\nI noticed your company is using a self-hosted email solution. We help teams like yours migrate to our cloud platform with zero downtime.\n\nWould you be open to a 15-minute chat this week? I promise no hard sell — just want to understand if there's a fit.\n\nCheers,\nDerek\nAccount Executive, SaaSVendor\n\nP.S. We just signed 3 companies in your industry last month. Happy to share case studies.",
        bodyHtml:
          "<p>Hi there,</p><p>I noticed your company is using a self-hosted email solution. We help teams like yours migrate to our cloud platform with zero downtime.</p><p>Would you be open to a 15-minute chat this week? I promise no hard sell — just want to understand if there's a fit.</p><p>Cheers,<br/>Derek<br/>Account Executive, SaaSVendor</p><p><em>P.S. We just signed 3 companies in your industry last month. Happy to share case studies.</em></p>",
      },
    ],
  },

  // ── 12. Internal team discussion thread (3 emails) ──────────────────
  {
    id: "thread-internal-deploy",
    subject: "Deploying v2.3 to production this Friday?",
    hasSentReply: true,
    emails: [
      {
        messageId: "<internal-deploy-1@localhost>",
        subject: "Deploying v2.3 to production this Friday?",
        fromAddress: INBOX_ADDRESS,
        fromName: "Test User",
        toAddresses: ["devteam@localhost"],
        date: daysAgo(3, 14),
        isSent: true,
        bodyText:
          "Team,\n\nAll v2.3 tickets are merged and staging looks good. I'm thinking we push to production this Friday at 6pm to minimize impact.\n\nChanges include:\n- New thread filtering API\n- Fixed IMAP reconnection bug\n- Performance improvements on search queries\n\nAny concerns? Please flag by Thursday EOD.\n\n— Test",
        bodyHtml:
          "<p>Team,</p><p>All v2.3 tickets are merged and staging looks good. I'm thinking we push to production this Friday at 6pm to minimize impact.</p><p><strong>Changes include:</strong></p><ul><li>New thread filtering API</li><li>Fixed IMAP reconnection bug</li><li>Performance improvements on search queries</li></ul><p>Any concerns? Please flag by Thursday EOD.</p><p>— Test</p>",
      },
      {
        messageId: "<internal-deploy-2@colleague.localhost>",
        inReplyTo: "<internal-deploy-1@localhost>",
        references: ["<internal-deploy-1@localhost>"],
        subject: "Re: Deploying v2.3 to production this Friday?",
        fromAddress: "emma.dev@localhost",
        fromName: "Emma Chen",
        toAddresses: [INBOX_ADDRESS],
        ccAddresses: ["devteam@localhost"],
        date: daysAgo(3, 15),
        bodyText:
          "Sounds good to me. The search query fix alone should help — we've been seeing timeouts on large mailboxes.\n\nOne thing: can we add a rollback plan in case the IMAP changes cause issues? Maybe keep the old connection pool config as an env flag?\n\n— Emma",
        bodyHtml:
          "<p>Sounds good to me. The search query fix alone should help — we've been seeing timeouts on large mailboxes.</p><p>One thing: can we add a rollback plan in case the IMAP changes cause issues? Maybe keep the old connection pool config as an env flag?</p><p>— Emma</p>",
      },
      {
        messageId: "<internal-deploy-3@colleague2.localhost>",
        inReplyTo: "<internal-deploy-2@colleague.localhost>",
        references: [
          "<internal-deploy-1@localhost>",
          "<internal-deploy-2@colleague.localhost>",
        ],
        subject: "Re: Deploying v2.3 to production this Friday?",
        fromAddress: "raj.ops@localhost",
        fromName: "Raj Patel",
        toAddresses: [INBOX_ADDRESS],
        ccAddresses: ["devteam@localhost", "emma.dev@localhost"],
        date: daysAgo(2, 9),
        bodyText:
          "+1 on the rollback plan. I'll prepare a quick runbook.\n\nAlso, I've set up monitoring dashboards for the new search endpoint. We'll have real-time latency and error rate tracking from the moment we deploy.\n\nFriday 6pm works for me. I'll be on standby for the first hour post-deploy.\n\n— Raj",
        bodyHtml:
          "<p>+1 on the rollback plan. I'll prepare a quick runbook.</p><p>Also, I've set up monitoring dashboards for the new search endpoint. We'll have real-time latency and error rate tracking from the moment we deploy.</p><p>Friday 6pm works for me. I'll be on standby for the first hour post-deploy.</p><p>— Raj</p>",
      },
    ],
  },

  // ── 13. Contract / legal email ──────────────────────────────────────
  {
    id: "thread-contract-renewal",
    subject: "Service Agreement Renewal — Action Required by Feb 20",
    emails: [
      {
        messageId: "<contract-renew-1@legal.example.com>",
        subject: "Service Agreement Renewal — Action Required by Feb 20",
        fromAddress: "contracts@vendorpartner.com",
        fromName: "VendorPartner Legal",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(6, 10),
        bodyText:
          "Dear Client,\n\nYour annual service agreement (Contract #VP-2025-0891) is due for renewal on March 1, 2026.\n\nKey changes in the updated terms:\n- Price increase of 5% reflecting CPI adjustment\n- Updated data processing addendum (GDPR compliance)\n- New uptime SLA: 99.95% (up from 99.9%)\n\nPlease review the attached agreement and return a signed copy by February 20, 2026.\n\nIf you have questions or wish to negotiate terms, please contact me directly.\n\nRegards,\nLinda Foster\nLegal Department, VendorPartner Inc.",
        bodyHtml:
          "<p>Dear Client,</p><p>Your annual service agreement (Contract #VP-2025-0891) is due for renewal on March 1, 2026.</p><p><strong>Key changes in the updated terms:</strong></p><ul><li>Price increase of 5% reflecting CPI adjustment</li><li>Updated data processing addendum (GDPR compliance)</li><li>New uptime SLA: 99.95% (up from 99.9%)</li></ul><p>Please review the attached agreement and return a signed copy by <strong>February 20, 2026</strong>.</p><p>If you have questions or wish to negotiate terms, please contact me directly.</p><p>Regards,<br/>Linda Foster<br/>Legal Department, VendorPartner Inc.</p>",
      },
    ],
  },

  // ── 14. Personal / casual email ─────────────────────────────────────
  {
    id: "thread-personal-lunch",
    subject: "Lunch next week?",
    emails: [
      {
        messageId: "<lunch-1@friend.example.com>",
        subject: "Lunch next week?",
        fromAddress: "mike.old.friend@gmail.com",
        fromName: "Mike",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(1, 12),
        bodyText:
          "Hey!\n\nLong time no chat. I'm going to be in town next Tuesday and Wednesday. Want to grab lunch? That Thai place near your office was great last time.\n\nLet me know what works!\n\nMike",
        bodyHtml:
          "<p>Hey!</p><p>Long time no chat. I'm going to be in town next Tuesday and Wednesday. Want to grab lunch? That Thai place near your office was great last time.</p><p>Let me know what works!</p><p>Mike</p>",
      },
    ],
  },

  // ── 15. GitHub notification — PR review ─────────────────────────────
  {
    id: "thread-github-pr",
    subject: "[acme/api] PR #342: Fix race condition in connection pool",
    emails: [
      {
        messageId: "<github-pr-342-1@github.com>",
        subject: "[acme/api] PR #342: Fix race condition in connection pool",
        fromAddress: "notifications@github.com",
        fromName: "GitHub",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(1, 17),
        isBot: true,
        bodyText:
          "emma-dev requested your review on PR #342\n\nFix race condition in connection pool\n\nChanges:\n- Added mutex lock around pool.acquire()\n- Fixed double-release bug when connection times out\n- Added regression test\n\nFiles changed: 3 (src/pool.ts, src/pool.test.ts, src/types.ts)\n+42 -11\n\nView PR: https://github.com/acme/api/pull/342",
        bodyHtml: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto">
  <div style="border-bottom:1px solid #e1e4e8;padding:15px">
    <strong>emma-dev</strong> requested your review on <a href="#">PR #342</a>
  </div>
  <div style="padding:15px">
    <h3>Fix race condition in connection pool</h3>
    <ul>
      <li>Added mutex lock around <code>pool.acquire()</code></li>
      <li>Fixed double-release bug when connection times out</li>
      <li>Added regression test</li>
    </ul>
    <p style="color:#586069;font-size:13px">Files changed: 3 &middot; <span style="color:#28a745">+42</span> <span style="color:#cb2431">-11</span></p>
  </div>
  <div style="padding:10px 15px;background:#f6f8fa;border-top:1px solid #e1e4e8">
    <a href="#" style="color:#0366d6">View Pull Request</a>
  </div>
</div>`,
      },
    ],
  },

  // ── 16. Urgent security alert ───────────────────────────────────────
  {
    id: "thread-security-alert",
    subject: "URGENT: Unusual login activity detected on your account",
    emails: [
      {
        messageId: "<security-alert-99@monitoring.example.com>",
        subject: "URGENT: Unusual login activity detected on your account",
        fromAddress: "security@monitoring.example.com",
        fromName: "Security Team",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(0, 3),
        isBot: true,
        bodyText:
          "SECURITY ALERT\n\nWe detected an unusual login attempt on your account:\n\nTime: Feb 7, 2026 03:14 UTC\nLocation: Lagos, Nigeria\nIP: 102.89.xx.xx\nDevice: Unknown (Linux)\n\nIf this was you, no action needed.\n\nIf this was NOT you:\n1. Change your password immediately\n2. Enable two-factor authentication\n3. Review your recent account activity\n\n— Security Monitoring Team",
        bodyHtml: `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;border:2px solid #e74c3c;border-radius:8px;overflow:hidden">
  <div style="background:#e74c3c;color:white;padding:15px;text-align:center">
    <h2 style="margin:0">⚠️ Security Alert</h2>
  </div>
  <div style="padding:20px">
    <p>We detected an unusual login attempt on your account:</p>
    <table style="width:100%;margin:15px 0">
      <tr><td style="padding:5px;color:#666">Time</td><td style="padding:5px">Feb 7, 2026 03:14 UTC</td></tr>
      <tr><td style="padding:5px;color:#666">Location</td><td style="padding:5px"><strong>Lagos, Nigeria</strong></td></tr>
      <tr><td style="padding:5px;color:#666">IP</td><td style="padding:5px">102.89.xx.xx</td></tr>
      <tr><td style="padding:5px;color:#666">Device</td><td style="padding:5px">Unknown (Linux)</td></tr>
    </table>
    <p><strong>If this was NOT you:</strong></p>
    <ol>
      <li>Change your password immediately</li>
      <li>Enable two-factor authentication</li>
      <li>Review your recent account activity</li>
    </ol>
  </div>
</div>`,
      },
    ],
  },

  // ── 17. Client onboarding thread (4 emails) ────────────────────────
  {
    id: "thread-onboarding-newclient",
    subject: "Welcome aboard — getting started with your account",
    hasSentReply: true,
    emails: [
      {
        messageId: "<onboard-1@localhost>",
        subject: "Welcome aboard — getting started with your account",
        fromAddress: INBOX_ADDRESS,
        fromName: "Test User",
        toAddresses: ["sophie.martin@newclient.fr"],
        date: daysAgo(10, 9),
        isSent: true,
        bodyText:
          "Hi Sophie,\n\nWelcome to our platform! Here's what you need to get started:\n\n1. Set up your mailbox connections (IMAP/SMTP settings)\n2. Invite your team members\n3. Configure your first auto-tagging rules\n\nI've attached a quick-start guide. Feel free to reach out if you have any questions.\n\nBest,\nTest User",
        bodyHtml:
          "<p>Hi Sophie,</p><p>Welcome to our platform! Here's what you need to get started:</p><ol><li>Set up your mailbox connections (IMAP/SMTP settings)</li><li>Invite your team members</li><li>Configure your first auto-tagging rules</li></ol><p>I've attached a quick-start guide. Feel free to reach out if you have any questions.</p><p>Best,<br/>Test User</p>",
      },
      {
        messageId: "<onboard-2@newclient.fr>",
        inReplyTo: "<onboard-1@localhost>",
        references: ["<onboard-1@localhost>"],
        subject: "Re: Welcome aboard — getting started with your account",
        fromAddress: "sophie.martin@newclient.fr",
        fromName: "Sophie Martin",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(9, 14),
        bodyText:
          "Hi,\n\nThanks for the warm welcome! I've set up the IMAP connection and it's syncing now.\n\nA couple of questions:\n- Can we connect multiple mailboxes (we have support@ and sales@)?\n- Is there an API for integrating with our CRM?\n\nMerci,\nSophie",
        bodyHtml:
          "<p>Hi,</p><p>Thanks for the warm welcome! I've set up the IMAP connection and it's syncing now.</p><p>A couple of questions:</p><ul><li>Can we connect multiple mailboxes (we have support@ and sales@)?</li><li>Is there an API for integrating with our CRM?</li></ul><p>Merci,<br/>Sophie</p>",
      },
      {
        messageId: "<onboard-3@localhost>",
        inReplyTo: "<onboard-2@newclient.fr>",
        references: ["<onboard-1@localhost>", "<onboard-2@newclient.fr>"],
        subject: "Re: Welcome aboard — getting started with your account",
        fromAddress: INBOX_ADDRESS,
        fromName: "Test User",
        toAddresses: ["sophie.martin@newclient.fr"],
        date: daysAgo(9, 15),
        isSent: true,
        bodyText:
          "Hi Sophie,\n\nGreat to hear the sync is working!\n\nTo answer your questions:\n- Yes, you can add multiple mailboxes under Settings > Mailboxes. Each can be personal or shared.\n- We have a REST API — I'll send you the docs link separately.\n\nLet me know how the team invite goes.\n\nBest,\nTest User",
        bodyHtml:
          "<p>Hi Sophie,</p><p>Great to hear the sync is working!</p><p>To answer your questions:</p><ul><li>Yes, you can add multiple mailboxes under Settings &gt; Mailboxes. Each can be personal or shared.</li><li>We have a REST API — I'll send you the docs link separately.</li></ul><p>Let me know how the team invite goes.</p><p>Best,<br/>Test User</p>",
      },
      {
        messageId: "<onboard-4@newclient.fr>",
        inReplyTo: "<onboard-3@localhost>",
        references: [
          "<onboard-1@localhost>",
          "<onboard-2@newclient.fr>",
          "<onboard-3@localhost>",
        ],
        subject: "Re: Welcome aboard — getting started with your account",
        fromAddress: "sophie.martin@newclient.fr",
        fromName: "Sophie Martin",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(8, 10),
        bodyText:
          "Perfect, both mailboxes are connected now and the team has been invited. Everything's running smoothly so far.\n\nI'd love to get the API docs when you have a chance. We want to sync contact data with Salesforce.\n\nThanks!\nSophie",
        bodyHtml:
          "<p>Perfect, both mailboxes are connected now and the team has been invited. Everything's running smoothly so far.</p><p>I'd love to get the API docs when you have a chance. We want to sync contact data with Salesforce.</p><p>Thanks!<br/>Sophie</p>",
      },
    ],
  },

  // ── 18. Social media notification ───────────────────────────────────
  {
    id: "thread-linkedin-notification",
    subject: "You have 5 new connection requests",
    emails: [
      {
        messageId: "<linkedin-notif-7382@linkedin.com>",
        subject: "You have 5 new connection requests",
        fromAddress: "notifications-noreply@linkedin.com",
        fromName: "LinkedIn",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(1, 18),
        isBot: true,
        bodyText:
          "You have 5 pending connection requests:\n\n1. Sarah Kim — Product Manager at TechCo\n2. James Liu — Senior Engineer at StartupXYZ\n3. Anna Mueller — Design Lead at DesignStudio\n4. Carlos Ruiz — VP Sales at EnterpriseCorp\n5. David Park — Founder at AIStartup\n\nView and respond to your invitations:\nhttps://linkedin.com/mynetwork\n\nYou are receiving this email because you have an active LinkedIn account.",
        bodyHtml: `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif">
  <div style="background:#0077b5;color:white;padding:15px 20px">
    <strong>LinkedIn</strong>
  </div>
  <div style="padding:20px">
    <h3>You have 5 pending connection requests</h3>
    <div style="border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;margin:15px 0">
      <div style="padding:10px 15px;border-bottom:1px solid #e8e8e8"><strong>Sarah Kim</strong> — Product Manager at TechCo</div>
      <div style="padding:10px 15px;border-bottom:1px solid #e8e8e8"><strong>James Liu</strong> — Senior Engineer at StartupXYZ</div>
      <div style="padding:10px 15px;border-bottom:1px solid #e8e8e8"><strong>Anna Mueller</strong> — Design Lead at DesignStudio</div>
      <div style="padding:10px 15px;border-bottom:1px solid #e8e8e8"><strong>Carlos Ruiz</strong> — VP Sales at EnterpriseCorp</div>
      <div style="padding:10px 15px"><strong>David Park</strong> — Founder at AIStartup</div>
    </div>
    <a href="#" style="display:block;text-align:center;background:#0077b5;color:white;padding:10px;border-radius:20px;text-decoration:none">View Invitations</a>
  </div>
  <div style="padding:10px 20px;font-size:11px;color:#999;text-align:center">LinkedIn Corporation | <a href="#">Unsubscribe</a></div>
</div>`,
      },
    ],
  },

  // ── 19. Compliance / GDPR data request ──────────────────────────────
  {
    id: "thread-gdpr-request",
    subject: "GDPR Data Subject Access Request",
    emails: [
      {
        messageId: "<gdpr-dsar-1@user.example.com>",
        subject: "GDPR Data Subject Access Request",
        fromAddress: "privacy@clientcorp.com",
        fromName: "ClientCorp Privacy Office",
        toAddresses: [INBOX_ADDRESS],
        date: daysAgo(4, 8),
        bodyText:
          "To whom it may concern,\n\nUnder Article 15 of the General Data Protection Regulation (GDPR), we are writing to request access to all personal data you hold relating to the following data subjects from our organization:\n\n- maria.gonzalez@clientcorp.com\n- team-account@clientcorp.com\n\nPlease provide:\n1. Copies of all personal data processed\n2. The purposes of processing\n3. Categories of data concerned\n4. Recipients or categories of recipients\n5. Retention periods\n\nWe require a response within 30 days as mandated by GDPR.\n\nRegards,\nData Protection Officer\nClientCorp",
        bodyHtml:
          "<p>To whom it may concern,</p><p>Under Article 15 of the General Data Protection Regulation (GDPR), we are writing to request access to all personal data you hold relating to the following data subjects from our organization:</p><ul><li>maria.gonzalez@clientcorp.com</li><li>team-account@clientcorp.com</li></ul><p><strong>Please provide:</strong></p><ol><li>Copies of all personal data processed</li><li>The purposes of processing</li><li>Categories of data concerned</li><li>Recipients or categories of recipients</li><li>Retention periods</li></ol><p>We require a response within 30 days as mandated by GDPR.</p><p>Regards,<br/>Data Protection Officer<br/>ClientCorp</p>",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Additional tags for better AI classification coverage
// ---------------------------------------------------------------------------

const additionalTags = [
  { name: "Billing", color: "#f59e0b", aiAction: "none", tagGroup: "Clients" },
  { name: "Feature Request", color: "#06b6d4", aiAction: "none", tagGroup: "Clients" },
  { name: "Bug Report", color: "#ef4444", aiAction: "notify", tagGroup: "Clients" },
  { name: "Notification", color: "#94a3b8", aiAction: "archive", tagGroup: null },
  { name: "Onboarding", color: "#10b981", aiAction: "none", tagGroup: "Clients" },
  { name: "Legal", color: "#6366f1", aiAction: "notify", tagGroup: null },
  { name: "Internal", color: "#a855f7", aiAction: "none", tagGroup: "Team" },
  { name: "Spam", color: "#dc2626", aiAction: "archive", tagGroup: null },
  { name: "Personal", color: "#f472b6", aiAction: "none", tagGroup: null },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding test emails...\n");

  // Verify prerequisites
  const team = await prisma.team.findUnique({ where: { id: TEAM_ID } });
  if (!team) {
    console.error("Team not found. Run `pnpm db:seed` first.");
    process.exit(1);
  }

  const mailbox = await prisma.mailbox.findUnique({
    where: { id: MAILBOX_ID },
  });
  if (!mailbox) {
    console.error("Mailbox not found. Run `pnpm db:seed` first.");
    process.exit(1);
  }

  // Create additional tags
  for (const tag of additionalTags) {
    await prisma.tag.upsert({
      where: { teamId_name: { teamId: TEAM_ID, name: tag.name } },
      update: { tagGroup: tag.tagGroup },
      create: {
        teamId: TEAM_ID,
        name: tag.name,
        color: tag.color,
        aiAction: tag.aiAction,
        tagGroup: tag.tagGroup,
      },
    });
  }
  console.log(`Created ${additionalTags.length} additional tags`);

  // Create threads and emails
  let emailCount = 0;

  for (const threadDef of threads) {
    // Upsert thread
    const lastEmail = threadDef.emails[threadDef.emails.length - 1];
    await prisma.thread.upsert({
      where: { id: threadDef.id },
      update: {},
      create: {
        id: threadDef.id,
        mailboxId: MAILBOX_ID,
        teamId: TEAM_ID,
        subject: threadDef.subject,
        status: threadDef.status || "open",
        hasSentReply: threadDef.hasSentReply || false,
        lastActivityAt: lastEmail.date,
      },
    });

    // Upsert emails
    for (const emailDef of threadDef.emails) {
      await prisma.email.upsert({
        where: { messageId: emailDef.messageId },
        update: {},
        create: {
          threadId: threadDef.id,
          messageId: emailDef.messageId,
          inReplyTo: emailDef.inReplyTo || null,
          references: emailDef.references || [],
          subject: emailDef.subject,
          bodyText: emailDef.bodyText,
          bodyHtml: emailDef.bodyHtml,
          fromAddress: emailDef.fromAddress,
          fromName: emailDef.fromName || null,
          toAddresses: emailDef.toAddresses,
          ccAddresses: emailDef.ccAddresses || [],
          date: emailDef.date,
          folder: "INBOX",
          isBot: emailDef.isBot || false,
          isSent: emailDef.isSent || false,
        },
      });
      emailCount++;
    }

    console.log(
      `  Thread: "${threadDef.subject}" (${threadDef.emails.length} emails)`
    );
  }

  console.log(`\nDone! Created ${threads.length} threads with ${emailCount} emails.`);
  console.log("\nEmail categories covered:");
  console.log("  - Newsletter / marketing (HTML)");
  console.log("  - Promotional / sale blast");
  console.log("  - SaaS notifications (password reset, GitHub, LinkedIn)");
  console.log("  - Shipping / order confirmation");
  console.log("  - Client support (threaded)");
  console.log("  - Sales inquiry (threaded)");
  console.log("  - Bug report (threaded)");
  console.log("  - Feature request");
  console.log("  - Meeting / calendar");
  console.log("  - Cold outreach / spam");
  console.log("  - Internal team discussion (threaded)");
  console.log("  - Contract / legal");
  console.log("  - Personal / casual");
  console.log("  - Security alert");
  console.log("  - Client onboarding (threaded)");
  console.log("  - GDPR / compliance request");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
