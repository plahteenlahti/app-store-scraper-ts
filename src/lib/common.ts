import type { App } from '../types/app.js';
import { markets } from '../types/constants.js';
import {
  iTunesLookupResponseSchema,
  type ITunesAppResponse,
} from './schemas.js';
import type { RequestOptions } from '../types/options.js';

/**
 * Makes an HTTP request
 */
export async function doRequest(url: string, options?: RequestOptions): Promise<string> {
  const defaultHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...defaultHeaders,
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.text();
}

/**
 * Cleans and transforms an iTunes API response to our App format
 */
export function cleanApp(app: ITunesAppResponse): App {
  return {
    id: app.trackId || 0,
    appId: app.bundleId || '',
    title: app.trackName || '',
    url: app.trackViewUrl || '',
    description: app.description || '',
    icon: app.artworkUrl512 || app.artworkUrl100 || '',
    genres: app.genres || [],
    genreIds: (app.genreIds || []).map(String),
    primaryGenre: app.primaryGenreName || '',
    primaryGenreId: String(app.primaryGenreId || ''),
    contentRating: app.contentAdvisoryRating || '4+',
    languages: app.languageCodesISO2A || [],
    size: app.fileSizeBytes || '0',
    requiredOsVersion: app.minimumOsVersion || '',
    released: app.releaseDate || '',
    updated: app.currentVersionReleaseDate || '',
    releaseNotes: app.releaseNotes || '',
    version: app.version || '',
    price: app.price || 0,
    currency: app.currency || 'USD',
    free: (app.price || 0) === 0,
    developerId: app.artistId || 0,
    developer: app.artistName || '',
    developerUrl: app.artistViewUrl || '',
    developerWebsite: app.sellerUrl,
    score: app.averageUserRating || 0,
    reviews: app.userRatingCount || 0,
    currentVersionScore: app.averageUserRatingForCurrentVersion || 0,
    currentVersionReviews: app.userRatingCountForCurrentVersion || 0,
    screenshots: app.screenshotUrls || [],
    ipadScreenshots: app.ipadScreenshotUrls || [],
    appletvScreenshots: app.appletvScreenshotUrls || [],
    supportedDevices: app.supportedDevices || [],
  };
}

/**
 * Looks up apps by ID, bundle ID, or artist ID from iTunes API
 */
export async function lookup(
  ids: number | number[],
  idField: 'id' | 'bundleId' | 'artistId',
  country = 'us',
  lang?: string,
  requestOptions?: RequestOptions
): Promise<App[]> {
  const idsArray = Array.isArray(ids) ? ids : [ids];
  const idsString = idsArray.join(',');

  // Map idField to the correct URL parameter name
  // artistId should use 'id' parameter, not 'artistId'
  const paramName = idField === 'artistId' ? 'id' : idField;

  const params = new URLSearchParams({
    [paramName]: idsString,
    country,
    entity: 'software',
  });

  if (lang) {
    params.set('lang', lang);
  }

  const url = `https://itunes.apple.com/lookup?${params.toString()}`;
  const body = await doRequest(url, requestOptions);

  const parsedData: unknown = JSON.parse(body);
  const validationResult = iTunesLookupResponseSchema.safeParse(parsedData);

  if (!validationResult.success) {
    throw new Error(
      `iTunes API response validation failed: ${validationResult.error.message}`
    );
  }

  const response = validationResult.data;

  // Filter to only software and clean the results
  // The response may include artist records (wrapperType: "artist") and app records
  // We only want apps, which have kind === 'software' or wrapperType === 'software'
  return response.results
    .filter((app) => app.kind === 'software' || app.wrapperType === 'software')
    .map((app) => cleanApp(app));
}

/**
 * Gets the Apple Store ID for a given country code
 */
export function storeId(country: string): number {
  const id = markets[country.toLowerCase()];
  return id || markets.us || 143441;
}

/**
 * Ensures an array from a value that could be undefined, a single item, or an array
 */
export function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Validates that at least one of the required fields is present
 */
export function validateRequiredField(
  options: Record<string, unknown>,
  fields: string[],
  errorMessage: string
): void {
  const hasField = fields.some((field) => options[field] !== undefined);
  if (!hasField) {
    throw new Error(errorMessage);
  }
}
