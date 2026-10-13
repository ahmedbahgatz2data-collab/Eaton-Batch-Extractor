import React, { useState } from 'react';
import { UrlJob } from '../types/extractor';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  RotateCcw, 
  ExternalLink, 
  Code2, 
  Trash2, 
  ShieldAlert, 
  Clipboard, 
  Sparkles,
  Terminal,
  Check
} from 'lucide-react';

interface UrlStatusListProps {
  jobs: UrlJob[];
  onRetry: (url: string) => void;
  onRemoveJob: (id: string) => void;
  onInspectJson: (rawJson: unknown, sourceName: string) => void;
  onPasteClipboardForJob?: (sourceUrl: string) => void;
}

export const UrlStatusList: React.FC<UrlStatusListProps> = ({
  jobs,
  onRetry,
  onRemoveJob,
  onInspectJson,
  onPasteClipboardForJob,
}) => {
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'error' | 'success' | 'loading'>('all');
  const [page, setPage] = useState<number>(1);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const pageSize = 15;

  if (jobs.length === 0) return null;

  const totalSuccess = jobs.filter((j) => j.status === 'success').length;
  const totalFailed = jobs.filter((j) => j.status === 'error').length;
  const totalLoading = jobs.filter((j) => j.status === 'loading').length;
  const totalItems = jobs.reduce((acc, j) => acc + j.itemsFound, 0);

  const filteredJobs = jobs.filter((job) => {
    if (filterTab === 'error') return job.status === 'error';
    if (filterTab === 'success') return job.status === 'success';
    if (filterTab === 'loading') return job.status === 'loading';
    return true;
  });

  const totalJobPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
  const safeJobPage = Math.min(Math.max(1, page), totalJobPages);
  const paginatedJobs = filteredJobs.slice((safeJobPage - 1) * pageSize, safeJobPage * pageSize);

  const handleCopyScript = (jobUrl: string, jobId: string) => {
    const script = `fetch("${jobUrl}").then(r=>r.json()).then(d=>navigator.clipboard.writeText(JSON.stringify(d))).then(()=>console.log("JSON copied to clipboard!"))`;
    navigator.clipboard.writeText(script).then(() => {
      setCopiedScriptId(jobId);
      setTimeout(() => setCopiedScriptId(null), 2500);
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-xs font-semibold uppercase tracking-wider text-slate-700 hover:text-slate-900 flex items-center space-x-1"
          >
            <span>Source Processing Audit ({jobs.length})</span>
            <span className="text-[10px] text-slate-400 font-normal">
              [{isCollapsed ? 'Show' : 'Hide'}]
            </span>
          </button>
        </div>

        {/* Status Metrics & Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => { setFilterTab('all'); setPage(1); }}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              filterTab === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({jobs.length})
          </button>

          {totalLoading > 0 && (
            <button
              onClick={() => { setFilterTab('loading'); setPage(1); }}
              className={`flex items-center px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                filterTab === 'loading' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
              Loading ({totalLoading})
            </button>
          )}

          <button
            onClick={() => { setFilterTab('success'); setPage(1); }}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              filterTab === 'success' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Success ({totalSuccess})
          </button>

          {totalFailed > 0 && (
            <button
              onClick={() => { setFilterTab('error'); setPage(1); }}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                filterTab === 'error' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Failed/Protected ({totalFailed})
            </button>
          )}

          <span className="text-slate-300">|</span>
          <span className="font-semibold text-slate-800 text-xs">
            {totalItems} items extracted
          </span>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="mt-3 divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {paginatedJobs.map((job) => {
          const isBotBlocked = job.isBotProtected || (job.error && (job.error.includes('Akamai') || job.error.includes('CORS') || job.error.includes('bot')));
          const isEaton = job.url.includes('eaton.com');

          return (
            <div
              key={job.id}
              className={`py-3 px-2 rounded-lg transition-colors ${
                job.status === 'error' ? 'bg-slate-50/60 my-1 border border-slate-200/80' : 'hover:bg-slate-50/80'
              }`}
            >
              <div className="flex items-start justify-between text-xs gap-3">
                {/* Status Icon & URL */}
                <div className="flex items-start space-x-2.5 min-w-0 flex-1">
                  {job.status === 'loading' && (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0 mt-0.5" />
                  )}
                  {job.status === 'success' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  {job.status === 'error' && (
                    isBotBlocked ? (
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    )
                  )}
                  {job.status === 'idle' && (
                    <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0 mt-0.5" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="font-mono text-slate-800 truncate max-w-xs sm:max-w-md lg:max-w-xl font-medium"
                        title={job.url}
                      >
                        {job.url}
                      </span>
                      {job.url.startsWith('http') && (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-[11px] hover:underline"
                          title="Open URL directly in a browser tab"
                        >
                          <span>Open Tab</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {isBotBlocked && (
                        <span className="inline-flex items-center text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded">
                          🛡️ {job.firewallType || (isEaton ? 'Akamai Bot Protection' : 'Bot Shield Active')}
                        </span>
                      )}
                    </div>

                    {job.error ? (
                      <div className="mt-1 text-[11px] text-slate-700 bg-white border border-slate-200 rounded p-2 max-w-2xl space-y-1.5">
                        <p className="text-rose-700 font-medium">{job.error}</p>

                        {/* Interactive Bypass Assistant for Bot/CORS Protected Links */}
                        {isBotBlocked && (
                          <div className="pt-1.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-600">
                              ⚡ Quick Bypass:
                            </span>

                            {/* 1. Open in new tab */}
                            {job.url.startsWith('http') && (
                              <a
                                href={job.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded shadow-2xs transition-colors cursor-pointer"
                                title="Click to view JSON directly in your residential browser session"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                                <span>1. Open Link in Tab</span>
                              </a>
                            )}

                            {/* 2. Paste from clipboard */}
                            {onPasteClipboardForJob && (
                              <button
                                type="button"
                                onClick={() => onPasteClipboardForJob(job.url)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded shadow-2xs transition-colors cursor-pointer"
                                title="Copy the JSON from your open tab and click here to extract it directly into the table"
                              >
                                <Clipboard className="w-3.5 h-3.5 text-blue-700" />
                                <span>2. Paste & Extract Directly</span>
                              </button>
                            )}

                            {/* 3. DevTools copy script */}
                            <button
                              type="button"
                              onClick={() => handleCopyScript(job.url, job.id)}
                              className="inline-flex items-center space-x-1 px-2 py-1 text-[11px] text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors"
                              title="Copy 1-line script to run in browser Console on target domain"
                            >
                              {copiedScriptId === job.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-700">Snippet Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Terminal className="w-3 h-3 text-slate-500" />
                                  <span>Copy Console Snippet</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : job.durationMs !== undefined ? (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Extracted {job.itemsFound} record{job.itemsFound === 1 ? '' : 's'} in {job.durationMs}ms
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Actions for this job */}
                <div className="flex items-center space-x-1.5 shrink-0">
                  {job.rawJson !== undefined && (
                    <button
                      type="button"
                      onClick={() => onInspectJson(job.rawJson, job.url)}
                      className="inline-flex items-center space-x-1 px-2 py-1 text-[11px] text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                      title="View full parsed JSON from this link"
                    >
                      <Code2 className="w-3 h-3 text-slate-500" />
                      <span>Raw JSON</span>
                    </button>
                  )}

                  {job.status === 'error' && (
                    <button
                      type="button"
                      onClick={() => onRetry(job.url)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded shadow-2xs transition-colors cursor-pointer"
                      title="Retry fetching with Stealth Mode"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                      <span>Retry Stealth</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemoveJob(job.id)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100"
                    title="Remove source"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
          </div>

          {/* Job Pagination Controls if more than 1 page */}
          {totalJobPages > 1 && (
            <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing {((safeJobPage - 1) * pageSize) + 1}-{Math.min(safeJobPage * pageSize, filteredJobs.length)} of {filteredJobs.length} sources
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safeJobPage === 1}
                  className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                >
                  Prev
                </button>
                <span className="px-1 text-slate-600 font-medium">
                  {safeJobPage} / {totalJobPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalJobPages, p + 1))}
                  disabled={safeJobPage === totalJobPages}
                  className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

