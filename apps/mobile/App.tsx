/**
 * App.tsx - Legacy Entry Point (Not Used with Expo Router)
 *
 * IMPORTANT: This file is no longer the main entry point.
 *
 * With Expo Router enabled, the app uses file-based routing:
 * - Entry point: expo-router/entry (configured in package.json "main")
 * - Routes are defined in the app/ directory
 * - Root layout: app/_layout.tsx
 * - Home route: app/index.tsx
 *
 * This file is kept for reference and backwards compatibility.
 * To customize the root layout, edit app/_layout.tsx instead.
 *
 * Navigation Structure:
 * - app/_layout.tsx (Root Stack)
 *   ├── app/index.tsx (Entry - redirects based on auth)
 *   ├── app/(auth)/_layout.tsx (Auth Stack)
 *   │   └── app/(auth)/login.tsx (Login Screen)
 *   ├── app/(tabs)/_layout.tsx (Tab Navigator)
 *   │   ├── app/(tabs)/index.tsx (Inbox)
 *   │   ├── app/(tabs)/compose.tsx (Compose)
 *   │   └── app/(tabs)/settings.tsx (Settings)
 *   └── app/email/[id].tsx (Email Detail - Modal)
 *
 * @see https://docs.expo.dev/routing/introduction/
 */

export { default } from 'expo-router/entry';
