/**
 * Inbox Tab Screen
 *
 * Main inbox tab that renders the InboxScreen component.
 * This file serves as the Expo Router entry point for the inbox tab.
 */
import { InboxScreen } from '../../src/screens';

/**
 * Inbox tab - displays the email inbox
 *
 * Renders the full-featured InboxScreen component which includes:
 * - Email list with category filtering
 * - Pull-to-refresh functionality
 * - Infinite scroll pagination
 * - Email actions (archive, star, mark read)
 * - Inbox Zero celebration state
 */
export default function InboxTab(): JSX.Element {
  return <InboxScreen />;
}
