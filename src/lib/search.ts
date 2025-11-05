import type { Dispatcher } from 'undici';
import type { App } from '../types/app.js';
import type { SearchOptions } from '../types/options.js';
import { doRequest, storeId, cleanApp } from './common.js';
import {
  searchResponseSchema,
  type SearchResult,
} from './schemas.js';

/**
 * Searches for apps in the App Store
 * @param options - Search options including term, pagination, etc.
 * @returns Promise resolving to array of apps or app IDs
 *
 * @example
 * ```typescript
 * // Basic search
 * const apps = await search({ term: 'minecraft' });
 *
 * // Search with pagination
 * const apps = await search({
 *   term: 'puzzle game',
 *   num: 25,
 *   page: 2
 * });
 *
 * // Get only IDs
 * const ids = await search({
 *   term: 'social',
 *   idsOnly: true
 * });
 * ```
 */
export async function search(options: SearchOptions): Promise<App[] | number[]> {
  const { term, num = 50, page = 1, country = 'us', lang = 'en-us', idsOnly, requestOptions } = options;

  if (!term) {
    throw new Error('term is required');
  }

  const store = storeId(country);
  const url = `https://search.itunes.apple.com/WebObjects/MZStore.woa/wa/search?clientApplication=Software&media=software&term=${encodeURIComponent(term)}`;

  const body = await doRequest(url, {
    ...(requestOptions || {}),
    headers: {
      'X-Apple-Store-Front': `${store},24 t:native`,
      'Accept-Language': lang,
      ...(requestOptions?.headers || {}),
    },
  } as Dispatcher.RequestOptions);

  // Parse and validate response with Zod
  const parsedData: unknown = JSON.parse(body);
  const validationResult = searchResponseSchema.safeParse(parsedData);

  if (!validationResult.success) {
    throw new Error(
      `Search API response validation failed: ${validationResult.error.message}`
    );
  }

  const response = validationResult.data;

  // Extract results from first bubble
  const bubble = response.bubbles?.[0];
  const results = bubble?.results || [];

  // Apply pagination
  const start = (page - 1) * num;
  const end = start + num;
  const paginatedResults = results.slice(start, end);

  if (idsOnly) {
    return paginatedResults
      .map((result) => result.trackId)
      .filter((id): id is number => id !== undefined);
  }

  // Convert to App objects
  return paginatedResults
    .filter((result): result is SearchResult & { trackId: number } => !!result.trackId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    .map((result) => cleanApp(result as any));
}
