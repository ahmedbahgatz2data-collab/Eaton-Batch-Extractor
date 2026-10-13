import { ExtractedRecord } from '../types/extractor';

// Keys to search for exact match
const EXACT_TITLE_KEYS = ['title'];
const EXACT_DESCRIPTION_KEYS = ['description'];
const EXACT_URL_KEYS = ['completeUrl'];
const EXACT_BADGE_KEYS = ['statusBadge'];

// Fallback alias variations (including AEM, Eaton, eCommerce and enterprise search models)
const ALIAS_TITLE_KEYS = [
  'title', 'Title', 'TITLE', 'jcr:title', 'productTitle', 'heading', 'headline',
  'post_title', 'item_title', 'name', 'task_name', 'label', 'searchTerm', 'partNumber'
];
const ALIAS_DESCRIPTION_KEYS = [
  'description', 'Description', 'DESCRIPTION', 'shortDescription', 'short_description',
  'productDescription', 'item_description', 'summary', 'snippet', 'details', 'metaDescription',
  'body', 'jcr:description', 'teaser'
];
const ALIAS_URL_KEYS = [
  'completeUrl', 'complete_url', 'completeURL', 'url', 'URL', 'link', 'fullUrl', 'full_url',
  'targetUrl', 'target_url', 'href', 'permalink', 'uri', 'path', 'jcr:path', 'pageUrl', 'productUrl'
];
const ALIAS_BADGE_KEYS = [
  'statusBadge', 'status_badge', 'statusBadgeText', 'status', 'Status', 'badge', 'state', 'tag',
  'condition', 'productStatus', 'availability', 'category', 'type', 'statusText'
];

function cleanHtmlText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '') // remove HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractStringValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Active' : 'Inactive';

  if (typeof val === 'object') {
    // If it's an object with label/text/name/value
    const obj = val as Record<string, unknown>;
    const subKeys = ['label', 'text', 'value', 'name', 'title', 'badge', 'status', 'description'];
    for (const k of subKeys) {
      if (typeof obj[k] === 'string' && obj[k]) {
        return (obj[k] as string).trim();
      }
    }
    // Try JSON representation if small
    try {
      const serialized = JSON.stringify(val);
      if (serialized.length < 50) return serialized;
    } catch {
      // ignore
    }
  }

  return String(val);
}

function resolveUrl(urlStr: string, sourceUrl: string, shouldResolve: boolean): string {
  if (!urlStr || !shouldResolve) return urlStr;
  const trimmed = urlStr.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
    return trimmed;
  }
  try {
    if (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://')) {
      const base = new URL(sourceUrl);
      let resolved = new URL(trimmed, base.origin).href;
      // If it's an AEM content path like /content/... without extension, ensure user can open it as a webpage (.html)
      if (resolved.includes('/content/') && !resolved.endsWith('.html') && !resolved.endsWith('.json') && !resolved.includes('?') && !resolved.includes('#')) {
        resolved = `${resolved}.html`;
      }
      return resolved;
    }
  } catch {
    // fallback to original
  }
  return trimmed;
}


function extractFromObject(
  obj: Record<string, unknown>,
  sourceUrl: string,
  strictMode: boolean,
  resolveRelative: boolean
): ExtractedRecord | null {
  const titleKeys = strictMode ? EXACT_TITLE_KEYS : ALIAS_TITLE_KEYS;
  const descriptionKeys = strictMode ? EXACT_DESCRIPTION_KEYS : ALIAS_DESCRIPTION_KEYS;
  const urlKeys = strictMode ? EXACT_URL_KEYS : ALIAS_URL_KEYS;
  const badgeKeys = strictMode ? EXACT_BADGE_KEYS : ALIAS_BADGE_KEYS;

  let foundTitle = '';
  let hasTitle = false;
  let foundDescription = '';
  let hasDescription = false;
  let foundUrl = '';
  let hasCompleteUrl = false;
  let foundBadge = '';
  let hasStatusBadge = false;

  // Search for Title
  for (const k of titleKeys) {
    if (k in obj && obj[k] !== undefined && obj[k] !== null) {
      const str = extractStringValue(obj[k]);
      if (str) {
        foundTitle = cleanHtmlText(str);
        hasTitle = true;
        break;
      }
    }
  }

  // Search for Description
  for (const k of descriptionKeys) {
    if (k in obj && obj[k] !== undefined && obj[k] !== null) {
      const str = extractStringValue(obj[k]);
      if (str) {
        foundDescription = cleanHtmlText(str);
        hasDescription = true;
        break;
      }
    }
  }

  // Search for the primary/first CompleteUrl (prioritizing exact "completeUrl" key first)
  for (const primaryKey of ['completeUrl', 'complete_url', 'completeURL']) {
    if (primaryKey in obj && obj[primaryKey] !== undefined && obj[primaryKey] !== null) {
      const str = extractStringValue(obj[primaryKey]);
      if (str) {
        foundUrl = resolveUrl(str, sourceUrl, resolveRelative);
        hasCompleteUrl = true;
        break;
      }
    }
  }

  // If not found under exact completeUrl, inspect url key aliases in priority order
  if (!hasCompleteUrl) {
    for (const k of urlKeys) {
      if (k in obj && obj[k] !== undefined && obj[k] !== null) {
        const str = extractStringValue(obj[k]);
        if (str) {
          foundUrl = resolveUrl(str, sourceUrl, resolveRelative);
          hasCompleteUrl = true;
          break;
        }
      }
    }
  }

  // Search for StatusBadge
  for (const k of badgeKeys) {
    if (k in obj && obj[k] !== undefined && obj[k] !== null) {
      const str = extractStringValue(obj[k]);
      if (str) {
        foundBadge = str;
        hasStatusBadge = true;
        break;
      }
    }
  }

  // Filter out secondary resource brochures / catalog PDFs without a status badge
  const isResourceDocument = 
    (obj.contentType === 'resources' || obj.fileType === 'application/pdf' || foundUrl.toLowerCase().endsWith('.pdf')) &&
    !hasStatusBadge;

  if (isResourceDocument) {
    return null;
  }

  // Strict validation: must have title or completeUrl, and not be a tiny leaf tuple
  const isLeafBadgeTuple = !hasCompleteUrl && !hasStatusBadge && Object.keys(obj).length <= 2;
  const isQualified = strictMode
    ? (hasTitle || hasCompleteUrl || hasStatusBadge || hasDescription)
    : (hasCompleteUrl || (hasTitle && (hasStatusBadge || hasDescription || !isLeafBadgeTuple)));

  if (isQualified) {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return {
      id,
      sourceUrl,
      title: foundTitle,
      description: foundDescription,
      completeUrl: foundUrl,
      statusBadge: foundBadge,
      extractedAt: new Date().toISOString(),
      rawItem: obj,
      fieldFlags: {
        hasTitle,
        hasDescription,
        hasCompleteUrl,
        hasStatusBadge,
      },
    };
  }

  return null;
}

/**
 * Recursively inspects a parsed JSON structure (object or array)
 * and extracts all records that contain title, description, completeUrl, and/or statusBadge.
 */
export function extractDataFromJson(
  jsonData: unknown,
  sourceUrl: string,
  options: { strictMode?: boolean; resolveRelativeUrls?: boolean } = {}
): ExtractedRecord[] {
  const strictMode = options.strictMode ?? false;
  const resolveRelative = options.resolveRelativeUrls ?? true;
  const results: ExtractedRecord[] = [];
  const seenKeys = new Set<string>();

  // Specialized primary target selection for Eaton Site Search structure
  if (typeof jsonData === 'object' && jsonData !== null && 'siteSearchResults' in (jsonData as Record<string, unknown>)) {
    const rawResults = (jsonData as Record<string, unknown>).siteSearchResults;
    if (Array.isArray(rawResults) && rawResults.length > 0) {
      // Prioritize primary SKU product matching the search query
      const skuCandidates = rawResults.filter((it: unknown) => {
        if (typeof it !== 'object' || it === null) return false;
        const candidate = it as Record<string, unknown>;
        const isSku = candidate.contentType === 'sku';
        const hasBadge = !!(candidate.statusBadge && (typeof candidate.statusBadge === 'string' ? candidate.statusBadge : (candidate.statusBadge as Record<string, unknown>).label || (candidate.statusBadge as Record<string, unknown>).name));
        const isPdf = candidate.contentType === 'resources' || (typeof candidate.url === 'string' && candidate.url.endsWith('.pdf'));
        return (isSku || hasBadge) && !isPdf;
      });

      // Target the first primary matching product item (first row)
      const chosenItems = skuCandidates.length > 0 ? [skuCandidates[0]] : [rawResults[0]];
      for (const item of chosenItems) {
        const record = extractFromObject(item as Record<string, unknown>, sourceUrl, strictMode, resolveRelative);
        if (record) results.push(record);
      }
      return results;
    }
  }


  function traverse(current: unknown, depth = 0) {
    if (depth > 12 || current === null || current === undefined) return;

    if (Array.isArray(current)) {
      for (const item of current) {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const record = extractFromObject(
            item as Record<string, unknown>,
            sourceUrl,
            strictMode,
            resolveRelative
          );
          if (record) {
            // Deduplicate if identical title, description, and URL
            const signature = `${record.title}|${record.description}|${record.completeUrl}|${record.statusBadge}`;
            if (!seenKeys.has(signature)) {
              seenKeys.add(signature);
              results.push(record);
            }
            // Once the item in array is extracted, do not traverse deeper into its sub-properties
            // (e.g. secondary links, image renditions, or badge objects) to avoid duplicate/fragment records
            continue;
          }
        }
        // Recursively inspect child arrays or nested objects
        traverse(item, depth + 1);
      }
    } else if (typeof current === 'object') {
      const obj = current as Record<string, unknown>;

      // Check if the current object itself is a record (e.g. single item payload)
      const directRecord = extractFromObject(obj, sourceUrl, strictMode, resolveRelative);
      if (directRecord && directRecord.fieldFlags.hasTitle && directRecord.fieldFlags.hasCompleteUrl) {
        const signature = `${directRecord.title}|${directRecord.description}|${directRecord.completeUrl}|${directRecord.statusBadge}`;
        if (!seenKeys.has(signature)) {
          seenKeys.add(signature);
          results.push(directRecord);
        }
      }

      // Check properties of object (e.g. siteSearchResults, items, data, results)
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (typeof val === 'object' && val !== null) {
          traverse(val, depth + 1);
        }
      }
    }
  }

  traverse(jsonData);
  return results;
}

