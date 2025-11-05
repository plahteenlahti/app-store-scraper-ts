import type { App } from '../types/app.js';
import type { ListOptions } from '../types/options.js';
import { collection as collectionConstants } from '../types/constants.js';
import { doRequest, lookup } from './common.js';
import { rssFeedSchema } from './schemas.js';

/**
 * Retrieves a list of apps from iTunes collections
 * @param options - Options for filtering and pagination
 * @returns Promise resolving to array of apps
 *
 * @example
 * ```typescript
 * // Get top 50 free iOS apps
 * const apps = await list({ collection: collection.TOP_FREE_IOS });
 *
 * // Get top 100 paid games
 * const apps = await list({
 *   collection: collection.TOP_PAID_IOS,
 *   category: category.GAMES,
 *   num: 100
 * });
 *
 * // Get full details for each app
 * const apps = await list({
 *   collection: collection.TOP_FREE_IOS,
 *   num: 10,
 *   fullDetail: true
 * });
 * ```
 */
export async function list(options: ListOptions = {}): Promise<App[]> {
  const {
    collection = collectionConstants.TOP_FREE_IOS,
    category,
    num = 50,
    country = 'us',
    lang,
    fullDetail = false,
    requestOptions,
  } = options;

  // Enforce maximum
  const limit = Math.min(num, 200);

  // Build URL
  let url = `https://itunes.apple.com/${country}/rss/${collection}`;

  if (category) {
    url += `/genre=${category}`;
  }

  url += `/limit=${limit}/json`;

  const body = await doRequest(url, requestOptions);

  // Parse and validate response with Zod
  const parsedData = JSON.parse(body) as unknown;
  const validationResult = rssFeedSchema.safeParse(parsedData);

  if (!validationResult.success) {
    throw new Error(
      `List API response validation failed: ${validationResult.error.message}`
    );
  }

  const data = validationResult.data;

  // Extract app IDs from feed
  const entries = data.feed?.entry || [];
  const ids = entries
    .map((entry) => {
      const id = entry.id?.attributes?.['im:id'];
      return id ? parseInt(id, 10) : null;
    })
    .filter((id): id is number => id !== null);

  if (ids.length === 0) {
    return [];
  }

  // If fullDetail, fetch complete app information
  if (fullDetail) {
    return lookup(ids, 'id', country, lang, requestOptions);
  }

  // Otherwise, return basic info by looking up all IDs
  return lookup(ids, 'id', country, lang, requestOptions);
}
