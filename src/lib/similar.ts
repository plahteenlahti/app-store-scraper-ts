import type { App } from '../types/app.js';
import type { SimilarOptions } from '../types/options.js';
import { doRequest, validateRequiredField, lookup } from './common.js';
import { app as getApp } from './app.js';
import { similarAppsSchema } from './schemas.js';

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

  const url = `https://itunes.apple.com/us/app/app/id${id}`;

  const body = await doRequest(url, requestOptions);

  // Extract similar app IDs using regex
  const regex = /customersAlsoBoughtApps":\s*(\[.*?\])/;
  const match = body.match(regex);

  if (!match || !match[1]) {
    return [];
  }

  try {
    const parsedData = JSON.parse(match[1]) as unknown;

    // Validate response with Zod
    const validationResult = similarAppsSchema.safeParse(parsedData);

    if (!validationResult.success) {
      throw new Error(
        `Similar apps response validation failed: ${validationResult.error.message}`
      );
    }

    const similarIds = validationResult.data;

    if (similarIds.length === 0) {
      return [];
    }

    // Fetch full details for similar apps
    return lookup(similarIds, 'id', country, lang, requestOptions);
  } catch {
    return [];
  }
}
