export interface ExtractedRecord {
  id: string;
  sourceUrl: string; // The input JSON link
  title: string;
  description: string;
  completeUrl: string;
  statusBadge: string;
  extractedAt: string;
  rawItem?: Record<string, unknown>;
  fieldFlags: {
    hasTitle: boolean;
    hasDescription: boolean;
    hasCompleteUrl: boolean;
    hasStatusBadge: boolean;
  };
}

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UrlJob {
  id: string;
  url: string;
  status: FetchStatus;
  itemsFound: number;
  error?: string;
  durationMs?: number;
  rawJson?: unknown;
  isBotProtected?: boolean;
  firewallType?: string;
  domain?: string;
}

export interface StealthOptions {
  browserProfile: 'chrome-131' | 'edge-131' | 'safari-mac';
  autoReferer: boolean;
  customCookies?: string; // e.g. Eaton/Akamai session cookies (_abck, bm_sv, ak_bmsc)
  customProxyUrl?: string; // Optional custom upstream residential/CORS proxy URL
}

export interface ExtractionConfig {
  strictMode: boolean; // strict exact "title", "completeUrl", "statusBadge" vs fallback aliases
  resolveRelativeUrls: boolean; // resolve relative URLs against source JSON URL
  includeInputLinkInExcel: boolean; // include "Input JSON Link" column
  includeTimestampInExcel: boolean;
  includeIndexInExcel: boolean;
  customHeaders: Record<string, string>;
  stealthMode: boolean; // 🕵️ Stealth Mode toggle
  stealthOptions: StealthOptions;
}

export interface ExcelExportOptions {
  filename: string;
  sheetName: string;
  selectedOnly: boolean;
  includeInputLink: boolean;
  includeTimestamp: boolean;
  includeIndex: boolean;
}

