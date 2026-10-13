import { StealthOptions } from '../types/extractor';

export interface FetchJsonResult {
  success: boolean;
  data?: unknown;
  error?: string;
  statusCode?: number;
  durationMs: number;
  viaProxy?: string;
  isBotProtected?: boolean;
  firewallType?: string;
  domain?: string;
}

export async function fetchJsonFromUrl(
  url: string,
  customHeaders?: Record<string, string>,
  stealthMode = true,
  stealthOptions?: StealthOptions,
  bypassBackendProxy = false
): Promise<FetchJsonResult> {
  const startTime = performance.now();
  const trimmed = url.trim();

  let targetDomain = '';
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      targetDomain = new URL(trimmed).hostname;
    }
  } catch {
    // ignore
  }

  const isEaton = targetDomain.includes('eaton.com');

  // 1. Handle internal relative endpoints (e.g. /api/demo/projects)
  if (trimmed.startsWith('/')) {
    try {
      const res = await fetch(trimmed, {
        headers: {
          'Accept': 'application/json',
          ...(customHeaders || {})
        }
      });
      const durationMs = Math.round(performance.now() - startTime);

      if (!res.ok) {
        return {
          success: false,
          error: `HTTP ${res.status}: ${res.statusText}`,
          statusCode: res.status,
          durationMs
        };
      }

      const json = await res.json();
      return { success: true, data: json, durationMs, viaProxy: 'internal' };
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - startTime);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch internal demo feed',
        durationMs
      };
    }
  }

  let serverReportedBot = false;
  let serverReportedFirewall = '';

  // 2. Primary Strategy: Server-side Stealth Proxy
  if (!bypassBackendProxy) {
    try {
      const controller = new AbortController();
      const clientTimeout = setTimeout(() => controller.abort(), 14000);

      const proxyRes = await fetch('/api/fetch-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: trimmed,
          headers: customHeaders,
          stealth: stealthMode,
          stealthOptions,
        }),
        signal: controller.signal,
      });

      clearTimeout(clientTimeout);

      const text = await proxyRes.text();
      const durationMs = Math.round(performance.now() - startTime);

      try {
        const jsonResult = JSON.parse(text);
        if (proxyRes.ok && jsonResult.success && jsonResult.data !== undefined) {
          return {
            success: true,
            data: jsonResult.data,
            durationMs,
            viaProxy: stealthMode ? 'server-stealth' : 'backend-proxy'
          };
        }

        if (jsonResult.isBotProtected) {
          serverReportedBot = true;
          serverReportedFirewall = jsonResult.firewallType || 'Bot Shield';
        }

        if (jsonResult.error) {
          // If server explicitly reported Akamai/bot block, preserve rich error
          if (jsonResult.isBotProtected || isEaton) {
            return {
              success: false,
              error: jsonResult.error,
              statusCode: proxyRes.status,
              durationMs,
              isBotProtected: true,
              firewallType: jsonResult.firewallType || (isEaton ? 'Akamai Bot Manager' : 'Bot Shield'),
              domain: targetDomain
            };
          }
        }
      } catch {
        // Response was not JSON
      }

      if (!proxyRes.ok && (isEaton || serverReportedBot)) {
        return {
          success: false,
          error: `HTTP ${proxyRes.status}: Remote anti-bot shield (Akamai) prevented automated cloud retrieval on ${targetDomain}.`,
          statusCode: proxyRes.status,
          durationMs,
          isBotProtected: true,
          firewallType: isEaton ? 'Akamai Bot Manager' : 'Bot Shield',
          domain: targetDomain
        };
      }
    } catch (backendErr: unknown) {
      console.warn('Backend proxy fetch attempt completed with error:', backendErr);
    }
  }

  // 3. Fallback Strategy: Fast Public Stealth Gateways (with 4s timeout)
  if (stealthMode && !isEaton) {
    const publicProxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(trimmed)}`,
      `https://thingproxy.freeboard.io/fetch/${trimmed}`,
    ];

    for (const pubProxyUrl of publicProxies) {
      try {
        const pubController = new AbortController();
        const pubTimeout = setTimeout(() => pubController.abort(), 4000);

        const pubRes = await fetch(pubProxyUrl, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
          },
          signal: pubController.signal,
        });

        clearTimeout(pubTimeout);

        if (pubRes.ok) {
          const text = await pubRes.text();
          try {
            const data = JSON.parse(text);
            const durationMs = Math.round(performance.now() - startTime);
            return {
              success: true,
              data,
              durationMs,
              viaProxy: 'public-gateway'
            };
          } catch {
            // Not valid JSON
          }
        }
      } catch {
        // continue to next fallback
      }
    }
  }

  // 4. Fallback Strategy: Direct browser fetch (works if user has cookies or target has CORS enabled)
  try {
    const directRes = await fetch(trimmed, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        ...(customHeaders || {})
      }
    });

    const durationMs = Math.round(performance.now() - startTime);

    if (!directRes.ok) {
      const isBotStatus = directRes.status === 403 || directRes.status === 401;
      return {
        success: false,
        error: `HTTP ${directRes.status}: ${directRes.statusText}`,
        statusCode: directRes.status,
        durationMs,
        isBotProtected: isBotStatus || isEaton,
        firewallType: isEaton ? 'Akamai Bot Manager' : undefined,
        domain: targetDomain
      };
    }

    const data = await directRes.json();
    return { success: true, data, durationMs, viaProxy: 'browser-direct' };
  } catch (directErr: unknown) {
    const durationMs = Math.round(performance.now() - startTime);
    const isCors = directErr instanceof TypeError && (
      directErr.message.includes('fetch') || 
      directErr.message.includes('NetworkError') ||
      directErr.message.includes('Failed to fetch')
    );
    
    return {
      success: false,
      isBotProtected: isCors || isEaton || serverReportedBot,
      firewallType: isEaton ? 'Akamai Bot Protection' : (serverReportedFirewall || 'CORS / Remote Firewall'),
      domain: targetDomain,
      error: isEaton
        ? `Akamai Bot Protection & CORS Shield blocked retrieval from ${targetDomain}. Use the 1-Click "Open in Tab & Paste" button below or add your session cookie to extract instantly.`
        : isCors
        ? 'Could not reach link (blocked by remote server or CORS). Tip: You can paste the raw JSON in the "Paste Raw JSON" tab or upload a .json file.'
        : (directErr instanceof Error ? directErr.message : 'Network error connecting to URL'),
      durationMs
    };
  }
}

