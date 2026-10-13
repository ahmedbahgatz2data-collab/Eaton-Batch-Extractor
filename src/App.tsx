import React, { useState } from 'react';
import { ExtractedRecord, UrlJob, ExtractionConfig } from './types/extractor';
import { extractDataFromJson } from './utils/extractor';
import { fetchJsonFromUrl } from './utils/fetchJson';
import { Header } from './components/Header';
import { UrlInputSection } from './components/UrlInputSection';
import { UrlStatusList } from './components/UrlStatusList';
import { ExtractedDataTable } from './components/ExtractedDataTable';
import { ExportToolbar } from './components/ExportToolbar';
import { RawJsonModal } from './components/RawJsonModal';
import { Loader2, Square } from 'lucide-react';

export default function App() {
  const [records, setRecords] = useState<ExtractedRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [urlJobs, setUrlJobs] = useState<UrlJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Inspector modal state
  const [rawJsonModalOpen, setRawJsonModalOpen] = useState<boolean>(false);
  const [activeRawJson, setActiveRawJson] = useState<unknown>(null);
  const [activeRawJsonTitle, setActiveRawJsonTitle] = useState<string>('');

  // Configuration with Stealth Mode enabled by default
  const [config, setConfig] = useState<ExtractionConfig>({
    strictMode: false,
    resolveRelativeUrls: true,
    includeInputLinkInExcel: true,
    includeTimestampInExcel: true,
    includeIndexInExcel: true,
    customHeaders: {},
    stealthMode: true,
    stealthOptions: {
      browserProfile: 'chrome-131',
      autoReferer: true,
    },
  });

  // Concurrency and progress state
  const [progress, setProgress] = useState<{ completed: number; total: number; currentUrl: string } | null>(null);
  const cancelProcessingRef = React.useRef<boolean>(false);

  const handleStopProcessing = () => {
    cancelProcessingRef.current = true;
  };

  const handleProcessUrls = async (urlsToFetch: string[]) => {
    if (urlsToFetch.length === 0) return;
    setIsLoading(true);
    cancelProcessingRef.current = false;
    setProgress({ completed: 0, total: urlsToFetch.length, currentUrl: urlsToFetch[0] });

    // Initialize or update jobs
    const initialJobs: UrlJob[] = urlsToFetch.map((url) => {
      const existing = urlJobs.find((j) => j.url === url);
      return {
        id: existing ? existing.id : `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        url,
        status: 'loading',
        itemsFound: 0,
      };
    });

    setUrlJobs((prev) => {
      const remaining = prev.filter((j) => !urlsToFetch.includes(j.url));
      return [...initialJobs, ...remaining];
    });

    const newExtractedRecords: ExtractedRecord[] = [];
    const jobUpdateMap = new Map<string, Partial<UrlJob>>();

    // Controlled concurrency worker pool (4 parallel workers)
    // Running 4 workers prevents remote rate limiting (Akamai 429), socket starvation, and main thread freezing
    const CONCURRENCY = 4;
    let index = 0;
    let completedCount = 0;

    const worker = async () => {
      while (index < urlsToFetch.length && !cancelProcessingRef.current) {
        const currentIndex = index++;
        const url = urlsToFetch[currentIndex];
        if (!url) break;

        setProgress({ completed: completedCount, total: urlsToFetch.length, currentUrl: url });

        try {
          const fetchRes = await fetchJsonFromUrl(
            url,
            config.customHeaders,
            config.stealthMode,
            config.stealthOptions
          );

          if (fetchRes.success && fetchRes.data !== undefined) {
            const extracted = extractDataFromJson(fetchRes.data, url, {
              strictMode: config.strictMode,
              resolveRelativeUrls: config.resolveRelativeUrls,
            });

            newExtractedRecords.push(...extracted);

            // For large batches (>15 URLs), don't keep multi-megabyte raw JSON in memory to prevent V8 GC freeze
            const shouldStoreRaw = urlsToFetch.length <= 15;

            jobUpdateMap.set(url, {
              status: 'success',
              itemsFound: extracted.length,
              durationMs: fetchRes.durationMs,
              rawJson: shouldStoreRaw ? fetchRes.data : undefined,
              isBotProtected: false,
              error:
                extracted.length === 0
                  ? 'Fetched successfully, but 0 objects matched "title", "completeUrl", or "statusBadge"'
                  : undefined,
            });
          } else {
            jobUpdateMap.set(url, {
              status: 'error',
              itemsFound: 0,
              error: fetchRes.error || 'Failed to fetch',
              durationMs: fetchRes.durationMs,
              isBotProtected: fetchRes.isBotProtected,
              firewallType: fetchRes.firewallType,
              domain: fetchRes.domain,
            });
          }
        } catch (err) {
          jobUpdateMap.set(url, {
            status: 'error',
            itemsFound: 0,
            error: err instanceof Error ? err.message : 'Network failure',
          });
        } finally {
          completedCount++;
          setProgress({ completed: completedCount, total: urlsToFetch.length, currentUrl: url });

          // Periodically flush updates every few completed jobs or when queue finishes
          if (completedCount % 2 === 0 || completedCount === urlsToFetch.length) {
            setUrlJobs((prev) =>
              prev.map((job) => {
                const update = jobUpdateMap.get(job.url);
                return update ? { ...job, ...update } : job;
              })
            );
          }
        }
      }
    };

    // Spawn workers
    const workers = Array.from({ length: Math.min(CONCURRENCY, urlsToFetch.length) }, () => worker());
    await Promise.all(workers);

    // Final flush of any remaining job statuses
    setUrlJobs((prev) =>
      prev.map((job) => {
        const update = jobUpdateMap.get(job.url);
        return update ? { ...job, ...update } : job;
      })
    );

    // Efficient bulk record deduplication & merge
    if (newExtractedRecords.length > 0) {
      setRecords((prev) => {
        const existingSignatures = new Set(
          prev.map((r) => `${r.sourceUrl}|${r.title}|${r.completeUrl}|${r.statusBadge}`)
        );
        const uniqueNew: ExtractedRecord[] = [];
        for (const r of newExtractedRecords) {
          const sig = `${r.sourceUrl}|${r.title}|${r.completeUrl}|${r.statusBadge}`;
          if (!existingSignatures.has(sig)) {
            existingSignatures.add(sig);
            uniqueNew.push(r);
          }
        }
        return [...prev, ...uniqueNew];
      });
    }

    setProgress(null);
    setIsLoading(false);
  };

  const handlePasteClipboardForUrl = async (sourceUrl: string) => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        alert('Clipboard is empty! Open the JSON URL in your browser, press Ctrl+A then Ctrl+C, and click Paste again.');
        return;
      }
      const parsed = JSON.parse(text);
      const extracted = extractDataFromJson(parsed, sourceUrl, {
        strictMode: config.strictMode,
        resolveRelativeUrls: config.resolveRelativeUrls,
      });

      setUrlJobs((prev) =>
        prev.map((job) =>
          job.url === sourceUrl
            ? {
                ...job,
                status: 'success',
                itemsFound: extracted.length,
                rawJson: parsed,
                error: extracted.length === 0 ? 'JSON parsed from clipboard, but no matching title/URL/badge fields found' : undefined,
                durationMs: 1,
              }
            : job
        )
      );

      setRecords((prev) => {
        const existingSignatures = new Set(
          prev.map((r) => `${r.sourceUrl}|${r.title}|${r.completeUrl}|${r.statusBadge}`)
        );
        const uniqueNew = extracted.filter(
          (r) => !existingSignatures.has(`${r.sourceUrl}|${r.title}|${r.completeUrl}|${r.statusBadge}`)
        );
        return [...uniqueNew, ...prev];
      });
    } catch (err) {
      alert(`Could not parse clipboard contents as JSON: ${err instanceof Error ? err.message : 'Invalid JSON'}`);
    }
  };

  const handleProcessRawJson = (jsonData: unknown, sourceName: string) => {
    const extracted = extractDataFromJson(jsonData, sourceName, {
      strictMode: config.strictMode,
      resolveRelativeUrls: config.resolveRelativeUrls,
    });

    const newJob: UrlJob = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      url: sourceName,
      status: 'success',
      itemsFound: extracted.length,
      rawJson: jsonData,
      durationMs: 1,
    };

    setUrlJobs((prev) => [newJob, ...prev]);

    setRecords((prev) => {
      const existingSignatures = new Set(
        prev.map((r) => `${r.sourceUrl}|${r.title}|${r.completeUrl}|${r.statusBadge}`)
      );
      const uniqueNew = extracted.filter(
        (r) => !existingSignatures.has(`${r.sourceUrl}|${r.title}|${r.completeUrl}|${r.statusBadge}`)
      );
      return [...uniqueNew, ...prev];
    });
  };

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)));
    }
  };

  const handleDeleteRecord = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleClearAll = () => {
    if (confirm('Clear all extracted records and source history?')) {
      setRecords([]);
      setSelectedIds(new Set());
      setUrlJobs([]);
    }
  };

  const handleRemoveJob = (id: string) => {
    const job = urlJobs.find((j) => j.id === id);
    if (!job) return;
    setUrlJobs((prev) => prev.filter((j) => j.id !== id));
    // Also remove records belonging to this source
    setRecords((prev) => prev.filter((r) => r.sourceUrl !== job.url));
  };

  const handleInspectJson = (rawJson: unknown, sourceName: string) => {
    setActiveRawJson(rawJson);
    setActiveRawJsonTitle(`Raw JSON Node: ${sourceName}`);
    setRawJsonModalOpen(true);
  };

  const handleInspectRecordJson = (rec: ExtractedRecord) => {
    setActiveRawJson(rec.rawItem || rec);
    setActiveRawJsonTitle(`Record Item: "${rec.title || rec.id}"`);
    setRawJsonModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        recordCount={records.length}
        urlCount={urlJobs.length}
        stealthMode={config.stealthMode}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* URL Input & Options */}
        <UrlInputSection
          onProcessUrls={handleProcessUrls}
          onProcessRawJson={handleProcessRawJson}
          isLoading={isLoading}
          config={config}
          onConfigChange={setConfig}
        />

        {/* Real-Time Processing Progress Banner with Cancel Option */}
        {progress && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                <span className="text-xs font-semibold text-emerald-950">
                  Processing Link {progress.completed} of {progress.total} (
                  {Math.round((progress.completed / Math.max(1, progress.total)) * 100)}%)
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-[11px] text-emerald-700 truncate max-w-xs sm:max-w-md font-mono">
                  {progress.currentUrl}
                </span>
              </div>
              <button
                type="button"
                onClick={handleStopProcessing}
                className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg shadow-2xs transition-colors"
                title="Stop processing remaining URLs"
              >
                <Square className="w-3 h-3 text-rose-600 fill-current" />
                <span>Stop Batch</span>
              </button>
            </div>
            {/* Animated progress track */}
            <div className="w-full bg-emerald-200/60 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-2 rounded-full transition-all duration-200 ease-out"
                style={{
                  width: `${Math.round((progress.completed / Math.max(1, progress.total)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* URL Jobs Audit List */}
        {urlJobs.length > 0 && (
          <UrlStatusList
            jobs={urlJobs}
            onRetry={(url) => handleProcessUrls([url])}
            onRemoveJob={handleRemoveJob}
            onInspectJson={handleInspectJson}
            onPasteClipboardForJob={handlePasteClipboardForUrl}
          />
        )}

        {/* Primary Excel Export Bar */}
        {records.length > 0 && (
          <ExportToolbar
            records={records}
            selectedIds={selectedIds}
            urlJobs={urlJobs}
          />
        )}

        {/* Extracted Data Table */}
        <ExtractedDataTable
          records={records}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onDeleteRecord={handleDeleteRecord}
          onClearAll={handleClearAll}
          onInspectRecordJson={handleInspectRecordJson}
        />
      </main>

      {/* Raw JSON Inspector Modal */}
      <RawJsonModal
        isOpen={rawJsonModalOpen}
        onClose={() => setRawJsonModalOpen(false)}
        title={activeRawJsonTitle}
        jsonData={activeRawJson}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-medium text-slate-700">
            Eaton Batch Extractor · Automated extractor for title, completeUrl, and statusBadge
          </p>
          <div className="flex items-center space-x-3 text-slate-400 text-[11px]">
            <span>Direct Excel (.xlsx) / CSV Export</span>
            <span>·</span>
            <span>Stealth Bypass Engine Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

