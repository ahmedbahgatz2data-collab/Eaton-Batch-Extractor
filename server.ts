import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Disable strict TLS verification for testing internal/dev endpoints
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // CORS headers for all incoming requests (crucial for iframe & preview environments)
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
    if (_req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json({ limit: '25mb' }));

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', proxyActive: true, timestamp: new Date().toISOString() });
  });

  // Demo Feed 1: Project Management / Issue Tracker
  app.get('/api/demo/projects', (_req: Request, res: Response) => {
    res.json({
      feedTitle: "DevOps & Cloud Sprint Tracker",
      lastUpdated: new Date().toISOString(),
      items: [
        {
          id: "TASK-101",
          title: "Migrate Cloud SQL cluster to High Availability multi-zone",
          completeUrl: "https://cloud.example.org/projects/sprint-42/tasks/101",
          statusBadge: "In Progress",
          priority: "High",
          assignee: "Alex Rivera",
          updatedAt: "2026-10-10"
        },
        {
          id: "TASK-102",
          title: "Implement OAuth 2.0 PKCE Authorization Server",
          completeUrl: "https://cloud.example.org/projects/sprint-42/tasks/102",
          statusBadge: "Completed",
          priority: "Critical",
          assignee: "Sarah Chen",
          updatedAt: "2026-10-11"
        },
        {
          id: "TASK-103",
          title: "Automate Redis caching layer invalidation on schema mutation",
          completeUrl: "https://cloud.example.org/projects/sprint-42/tasks/103",
          statusBadge: "Under Review",
          priority: "Medium",
          assignee: "Elena Rostova",
          updatedAt: "2026-10-12"
        },
        {
          id: "TASK-104",
          title: "Audit Web Vitals and optimize hydration bundle size",
          completeUrl: "https://cloud.example.org/projects/sprint-42/tasks/104",
          statusBadge: "Backlog",
          priority: "Low",
          assignee: "David Kim",
          updatedAt: "2026-10-09"
        },
        {
          id: "TASK-105",
          title: "Deploy Edge CDN SSL wildcard certificates auto-renewal",
          completeUrl: "https://cloud.example.org/projects/sprint-42/tasks/105",
          statusBadge: "Approved",
          priority: "Medium",
          assignee: "Marcus Vance",
          updatedAt: "2026-10-12"
        }
      ]
    });
  });

  // Demo Feed 2: E-Commerce Product Catalog
  app.get('/api/demo/products', (_req: Request, res: Response) => {
    res.json([
      {
        sku: "PROD-A91",
        title: "Ergonomic Mechanical Keyboard with Hot-Swappable Switches",
        completeUrl: "https://gearstore.example.com/catalog/keyboards/ergonomic-a91",
        statusBadge: "In Stock",
        price: 189.99,
        category: "Peripherals"
      },
      {
        sku: "PROD-B44",
        title: "Ultra-Wide 34-Inch Curved Quantum-Dot OLED Monitor",
        completeUrl: "https://gearstore.example.com/catalog/monitors/34-curved-oled",
        statusBadge: "Low Stock",
        price: 849.00,
        category: "Displays"
      },
      {
        sku: "PROD-C82",
        title: "Active Noise-Cancelling Wireless Studio Headphones Gen 4",
        completeUrl: "https://gearstore.example.com/catalog/audio/studio-headphones-gen4",
        statusBadge: "Pre-Order",
        price: 299.50,
        category: "Audio"
      },
      {
        sku: "PROD-D15",
        title: "Solid Walnut Motorized Height-Adjustable Standing Desk",
        completeUrl: "https://gearstore.example.com/catalog/furniture/walnut-standing-desk",
        statusBadge: "Out of Stock",
        price: 720.00,
        category: "Furniture"
      },
      {
        sku: "PROD-E30",
        title: "Thunderbolt 5 Docking Hub with 140W Power Delivery",
        completeUrl: "https://gearstore.example.com/catalog/accessories/tb5-dock-140w",
        statusBadge: "Discontinued",
        price: 219.00,
        category: "Accessories"
      }
    ]);
  });

  // Demo Feed 3: Editorial Tech Articles / Research Publications
  app.get('/api/demo/publications', (_req: Request, res: Response) => {
    res.json({
      status: "success",
      queryTimeMs: 14,
      data: {
        results: [
          {
            paperId: "PUB-2026-01",
            title: "Zero-Latency Client-Side Spreadsheet Generation at Scale",
            completeUrl: "https://techdigest.example.org/articles/zero-latency-spreadsheets",
            statusBadge: "Peer Reviewed",
            doi: "10.1016/j.cs.2026.04.01",
            citations: 28
          },
          {
            paperId: "PUB-2026-02",
            title: "Evaluating Type Safety in Distributed Full-Stack TypeScript Architectures",
            completeUrl: "https://techdigest.example.org/articles/type-safety-fullstack-ts",
            statusBadge: "Editor Choice",
            doi: "10.1016/j.cs.2026.03.11",
            citations: 45
          },
          {
            paperId: "PUB-2026-03",
            title: "Benchmarking Modern Browser Web Streams against Node Buffer Ingestion",
            completeUrl: "https://techdigest.example.org/articles/web-streams-vs-node-buffer",
            statusBadge: "Verified",
            doi: "10.1016/j.cs.2026.02.19",
            citations: 12
          },
          {
            paperId: "PUB-2026-04",
            title: "Practical Security Boundaries for Headless Browser Crawling & JSON Extraction",
            completeUrl: "https://techdigest.example.org/articles/headless-json-crawling-security",
            statusBadge: "Trending",
            doi: "10.1016/j.cs.2026.01.05",
            citations: 89
          }
        ]
      }
    });
  });

  // Core proxy logic with Advanced Stealth Mode
  async function handleFetchProxy(
    urlStr: string,
    customHeaders?: Record<string, string>,
    stealthMode = true,
    stealthOptions?: {
      browserProfile?: string;
      customCookies?: string;
      customProxyUrl?: string;
      autoReferer?: boolean;
    },
    res?: Response
  ) {
    if (!res) return;
    if (!urlStr || typeof urlStr !== 'string') {
      return res.status(400).json({ error: 'Valid URL is required' });
    }

    const trimmedUrl = urlStr.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmedUrl);
    } catch {
      return res.status(400).json({ error: 'Malformed URL provided' });
    }

    const hostname = parsedUrl.hostname;
    const origin = parsedUrl.origin;
    const isEatonOrAkamai = hostname.includes('eaton.com') || hostname.includes('akamai');

    try {
      const controller = new AbortController();
      const timeoutMs = 12000; // 12 second bounded timeout
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      // Choose realistic modern browser profile for anti-bot bypass
      let userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
      let secChUa = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
      let secChUaPlatform = '"Windows"';

      if (stealthOptions?.browserProfile === 'safari-mac') {
        userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
        secChUa = '';
        secChUaPlatform = '"macOS"';
      } else if (stealthOptions?.browserProfile === 'edge-131') {
        userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';
        secChUa = '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
      }

      // Dynamic referer matching target host
      let autoReferer = `${origin}/`;
      if (hostname.includes('eaton.com')) {
        autoReferer = 'https://www.eaton.com/us/en-us/site-search.html';
      }

      // Compile stealth headers
      const fetchHeaders: Record<string, string> = {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': userAgent,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      };

      if (stealthMode) {
        fetchHeaders['Origin'] = origin;
        fetchHeaders['Referer'] = autoReferer;
        if (secChUa) fetchHeaders['sec-ch-ua'] = secChUa;
        fetchHeaders['sec-ch-ua-mobile'] = '?0';
        fetchHeaders['sec-ch-ua-platform'] = secChUaPlatform;
        fetchHeaders['sec-fetch-dest'] = 'empty';
        fetchHeaders['sec-fetch-mode'] = 'cors';
        fetchHeaders['sec-fetch-site'] = 'same-origin';
      }

      // Merge user custom headers
      if (customHeaders) {
        Object.assign(fetchHeaders, customHeaders);
      }

      // Apply custom stealth cookies if specified
      if (stealthOptions?.customCookies && !fetchHeaders['Cookie'] && !fetchHeaders['cookie']) {
        fetchHeaders['Cookie'] = stealthOptions.customCookies;
      }

      // Check if custom upstream proxy gateway is requested
      let requestTargetUrl = trimmedUrl;
      if (stealthOptions?.customProxyUrl?.trim()) {
        const proxyBase = stealthOptions.customProxyUrl.trim();
        requestTargetUrl = proxyBase.includes('{url}') 
          ? proxyBase.replace('{url}', encodeURIComponent(trimmedUrl))
          : `${proxyBase}${proxyBase.includes('?') ? '&' : '?'}url=${encodeURIComponent(trimmedUrl)}`;
      }

      const response = await fetch(requestTargetUrl, {
        method: 'GET',
        headers: fetchHeaders,
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status} ${response.statusText}`;
        const isBotBlocked = response.status === 403 || response.status === 401 || response.status === 503;

        if (response.status === 403) {
          errorDetail = isEatonOrAkamai
            ? `HTTP 403: Akamai Bot Manager on ${hostname} challenged the automated request.`
            : `HTTP 403 Forbidden: Endpoint rejected request (requires token/cookie or residential IP).`;
        } else if (response.status === 401) {
          errorDetail = `HTTP 401 Unauthorized: Authorization token required in Settings.`;
        } else if (response.status === 404) {
          errorDetail = `HTTP 404 Not Found: Target JSON link does not exist.`;
        }

        return res.status(response.status).json({
          error: errorDetail,
          statusCode: response.status,
          preview: text.slice(0, 250),
          isBotProtected: isBotBlocked || isEatonOrAkamai,
          firewallType: isEatonOrAkamai ? 'Akamai Bot Protection' : 'Bot Shield',
          domain: hostname
        });
      }

      try {
        const jsonData = JSON.parse(text);
        return res.json({
          success: true,
          url: trimmedUrl,
          contentType,
          data: jsonData
        });
      } catch (parseErr) {
        const isHtml = text.toLowerCase().includes('<html') || text.toLowerCase().includes('<!doctype');
        const looksLikeAkamaiChallenge = text.includes('Akamai') || text.includes('Access Denied') || text.includes('Incapsula') || text.includes('Cloudflare');

        return res.status(422).json({
          error: looksLikeAkamaiChallenge
            ? `Remote server returned a bot challenge page instead of JSON.`
            : `Remote endpoint returned HTML or non-JSON content instead of JSON.`,
          preview: text.slice(0, 300),
          isBotProtected: looksLikeAkamaiChallenge || isEatonOrAkamai,
          firewallType: isEatonOrAkamai ? 'Akamai Bot Protection' : 'Anti-Scraping Challenge',
          domain: hostname
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return res.status(504).json({
          error: isEatonOrAkamai
            ? `Request timed out (Akamai Bot Shield dropped connection on ${hostname}).`
            : `Request timed out after 12 seconds.`,
          isBotProtected: isEatonOrAkamai,
          firewallType: isEatonOrAkamai ? 'Akamai Bot Protection' : undefined,
          domain: hostname
        });
      }
      const msg = err instanceof Error ? err.message : 'Unknown network failure';
      return res.status(502).json({
        error: isEatonOrAkamai
          ? `Connection terminated by ${hostname} (Akamai anti-bot firewall).`
          : `Connection failed: ${msg}. Check if the URL is publicly accessible.`,
        isBotProtected: isEatonOrAkamai,
        firewallType: isEatonOrAkamai ? 'Akamai Bot Protection' : undefined,
        domain: hostname
      });
    }
  }

  // Server-side JSON proxy via POST
  app.post('/api/fetch-json', async (req: Request, res: Response) => {
    const { url, headers: customHeaders, stealth, stealthOptions } = req.body;
    await handleFetchProxy(url, customHeaders, stealth !== false, stealthOptions, res);
  });

  // Server-side JSON proxy via GET
  app.get('/api/fetch-json', async (req: Request, res: Response) => {
    const url = req.query.url as string;
    await handleFetchProxy(url, undefined, true, undefined, res);
  });

  // Mount Vite or static server
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
