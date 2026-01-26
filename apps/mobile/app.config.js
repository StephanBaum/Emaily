/**
 * Expo App Configuration
 *
 * This file allows for dynamic configuration of the Expo app.
 * Values can be overridden by environment variables for different environments.
 *
 * @see https://docs.expo.dev/workflow/configuration/
 */

export default ({ config }) => {
  return {
    ...config,
    name: process.env.APP_NAME || config.name,
    slug: config.slug,
    extra: {
      // API URL for the backend
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
      // Environment identifier
      environment: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',
      // EAS project configuration
      eas: {
        projectId: process.env.EAS_PROJECT_ID || '',
      },
    },
    updates: {
      url: process.env.EXPO_PUBLIC_UPDATES_URL || '',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
  };
};
