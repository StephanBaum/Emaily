/**
 * Search Screen Route
 *
 * Search screen route that renders the SearchScreen component.
 * This file serves as the Expo Router entry point for the search screen.
 */
import { SearchScreen } from '../src/screens';

/**
 * Search screen - email search with filters
 *
 * Renders the full-featured SearchScreen component which includes:
 * - Advanced search bar with recent searches
 * - Category, sender, date, and status filters
 * - Search results with email list
 * - Infinite scroll pagination
 * - Pull-to-refresh functionality
 */
export default function Search(): JSX.Element {
  return <SearchScreen />;
}
