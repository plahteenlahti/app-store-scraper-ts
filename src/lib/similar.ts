import * as cheerio from 'cheerio';
import type { App } from '../types/app.js';
import type { SimilarOptions } from '../types/options.js';
import { doRequest, validateRequiredField, lookup } from './common.js';
import { app as getApp } from './app.js';

/**
 * Retrieves similar apps ("Customers Also Bought" section)
 * @param options - Options including app id or appId
 * @returns Promise resolving to array of similar apps
 *
 * @example
 * ```typescript
 * const similar = await similar({ id: 553834731 });
 * ```
 */
export async function similar(options: SimilarOptions): Promise<App[]> {
  validateRequiredField(options as Record<string, unknown>, ['id', 'appId'], 'Either id or appId is required');

  const { appId, country = 'us', lang, requestOptions } = options;
  let { id } = options;

  // If appId is provided, resolve to id first
  if (appId && !id) {
    const appData = await getApp({ appId, country, requestOptions });
    id = appData.id;
  }

  if (!id) {
    throw new Error('Could not resolve app id');
  }

  // Build URL for main app page (contains similar apps embedded in HTML)
  const url = `https://apps.apple.com/${country}/app/id${id}`;

  let body: string;
  try {
    body = await doRequest(url, requestOptions);
  } catch (error) {
    // If the page doesn't exist or request fails, return empty array
    return [];
  }

  // Parse HTML with cheerio
  const $ = cheerio.load(body);

  // Extract app IDs from links in the grid
  const similarIds: number[] = [];

  // Find all links that contain "/app/" in their href
  $('a[href*="/app/"]').each((_, element) => {
    const href = $(element).attr('href');
    if (href) {
      // Extract ID from URLs like:
      // "https://apps.apple.com/us/app/app-name/id123456"
      // or "/fi/app/app-name/id123456"
      const match = href.match(/\/id(\d+)/);
      if (match && match[1]) {
        const appId = parseInt(match[1], 10);
        // Avoid duplicates and exclude the current app
        if (!similarIds.includes(appId) && appId !== id) {
          similarIds.push(appId);
        }
      }
    }
  });

  if (similarIds.length === 0) {
    return [];
  }

  // Fetch full details for similar apps
  return lookup(similarIds, 'id', country, lang, requestOptions);
}
