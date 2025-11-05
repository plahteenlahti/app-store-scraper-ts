import type { PrivacyDetails } from '../types/review.js';
import type { PrivacyOptions } from '../types/options.js';
import { doRequest } from './common.js';
import { ampApiResponseSchema } from './schemas.js';

/**
 * Retrieves privacy policy details for an app
 * @param options - Options including app id
 * @returns Promise resolving to privacy details
 *
 * @example
 * ```typescript
 * const privacy = await privacy({ id: 553834731 });
 * ```
 */
export async function privacy(options: PrivacyOptions): Promise<PrivacyDetails> {
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
  const ampUrl = `https://amp-api-edge.apps.apple.com/v1/catalog/${country}/apps/${id}?platform=web&fields=privacyDetails&l=en-US`;

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
  const validationResult = ampApiResponseSchema.safeParse(parsedData);

  if (!validationResult.success) {
    throw new Error(
      `Privacy API response validation failed: ${validationResult.error.message}`
    );
  }

  const response = validationResult.data;
  const privacyData = response.data?.[0]?.attributes?.privacyDetails;

  if (!privacyData) {
    return {};
  }

  return {
    managePrivacyChoicesUrl: privacyData.managePrivacyChoicesUrl,
    privacyPolicyUrl: privacyData.privacyPolicyUrl,
    privacyPolicyText: privacyData.privacyPolicyText,
    privacyTypes: privacyData.privacyTypes?.map((type) => ({
      privacyType: type.identifier || type.privacyType || '',
      name: type.privacyType || '',
      description: type.description || '',
      dataCategories: type.dataCategories,
      purposes: type.purposes,
    })),
  };
}
