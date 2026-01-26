/**
 * Email provider module
 * Exports all email-related types and services
 */

// Types
export * from "./types";

// Gmail service
export { GmailService, createGmailService, batchFetchEmails } from "./gmail";

// Outlook service
export { OutlookService, createOutlookService, batchFetchOutlookEmails } from "./outlook";
