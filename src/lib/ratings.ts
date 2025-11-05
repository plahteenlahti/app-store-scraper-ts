import * as cheerio from 'cheerio';
import type { RatingHistogram } from '../types/app.js';
import type { RatingsOptions } from '../types/options.js';
import { doRequest, storeId } from './common.js';

/**
 * Retrieves the rating histogram for an app (1-5 star breakdown)
 * @param options - Options including app id
 * @returns Promise resolving to rating histogram
 *
 * @example
 * ```typescript
 * const histogram = await ratings({ id: 553834731 });
 * // Returns: { 1: 100, 2: 200, 3: 500, 4: 1000, 5: 3000 }
 * ```
 */
export async function ratings(options: RatingsOptions): Promise<RatingHistogram> {
  const { id, country = 'us', requestOptions } = options;

  if (!id) {
    throw new Error('id is required');
  }

  const store = storeId(country);
  const url = `https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewContentsUserReviews?id=${id}&pageNumber=0&sortOrdering=4&type=Purple+Software`;

  const body = await doRequest(url, {
    ...(requestOptions || {}),
    headers: {
      'X-Apple-Store-Front': `${store},12`,
      ...(requestOptions?.headers || {}),
    },
  });

  const $ = cheerio.load(body);

  // Extract ratings from HTML
  const histogram: RatingHistogram = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  // Try to find rating distribution in the page
  $('.rating-count').each((_, element) => {
    const text = $(element).text().trim();
    const match = text.match(/(\d+)\s*(?:stars?|★)/i);
    if (match && match[1]) {
      const stars = parseInt(match[1], 10);
      const countText = $(element).closest('.rating').find('.total').text().trim();
      const count = parseInt(countText.replace(/\D/g, ''), 10) || 0;
      if (stars >= 1 && stars <= 5) {
        histogram[stars as keyof RatingHistogram] = count;
      }
    }
  });

  // Alternative selector pattern
  $('.vote').each((index, element) => {
    const countText = $(element).find('.total').text().trim();
    const count = parseInt(countText.replace(/\D/g, ''), 10) || 0;
    const stars = 5 - index; // Usually displayed in reverse order (5 to 1)
    if (stars >= 1 && stars <= 5) {
      histogram[stars as keyof RatingHistogram] = count;
    }
  });

  return histogram;
}
