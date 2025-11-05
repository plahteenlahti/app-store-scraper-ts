import type { VersionHistory } from '../types/review.js';
import type { VersionHistoryOptions } from '../types/options.js';
import { doRequest } from './common.js';
import { versionHistoryResponseSchema } from './schemas.js';

/**
 * Retrieves version history for an app
 * @param options - Options including app id
 * @returns Promise resolving to array of version history entries
 *
 * @example
 * ```typescript
 * const history = await versionHistory({ id: 553834731 });
 * ```
 */
export async function versionHistory(options: VersionHistoryOptions): Promise<VersionHistory[]> {
  const { id, country = 'us', requestOptions } = options;

  if (!id) {
    throw new Error('id is required');
  }

  // Step 1: Get the bearer token from the app page
  const appPageUrl = `https://apps.apple.com/${country}/app/id${id}`;
  const appPageBody = await doRequest(appPageUrl, requestOptions);

  // Extract bearer token from the page
  const tokenRegex = /token%22%3A%22([^%]+)%22%7D/;
  const tokenMatch = appPageBody.match(tokenRegex);

  if (!tokenMatch || !tokenMatch[1]) {
    throw new Error('Could not extract bearer token');
  }

  const token = tokenMatch[1];

  // Step 2: Call the AMP API with the token
  const ampUrl = `https://amp-api-edge.apps.apple.com/v1/catalog/${country}/apps/${id}?platform=web&extend=versionHistory&l=en-US`;

  const ampBody = await doRequest(ampUrl, {
    ...(requestOptions || {}),
    headers: {
      Origin: 'https://apps.apple.com',
      Authorization: `Bearer ${token}`,
      ...(requestOptions?.headers || {}),
    },
  });

  // Parse and validate response with Zod
  const parsedData = JSON.parse(ampBody) as unknown;
  const validationResult = versionHistoryResponseSchema.safeParse(parsedData);

  if (!validationResult.success) {
    throw new Error(
      `Version History API response validation failed: ${validationResult.error.message}`
    );
  }

  const response = validationResult.data;
  const versions =
    response.data?.[0]?.attributes?.platformAttributes?.ios?.versionHistory || [];

  return versions.map((version) => ({
    versionDisplay: version.versionDisplay || '',
    releaseDate: version.releaseDate || '',
    releaseNotes: version.releaseNotes,
  }));
}
