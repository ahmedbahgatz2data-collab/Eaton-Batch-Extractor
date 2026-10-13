import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Settings, 
  Copy, 
  FileText, 
  Check, 
  ChevronDown, 
  Table, 
  Code
} from 'lucide-react';
import { ExcelExportOptions, ExtractedRecord, UrlJob } from '../types/extractor';
import { exportRecordsToExcel, exportRecordsToCsv, copyRecordsToClipboard } from '../utils/excelExport';

interface ExportToolbarProps {
  records: ExtractedRecord[];
  selectedIds: Set<string>;
  urlJobs: UrlJob[];
}

export const ExportToolbar: React.FC<ExportToolbarProps> = ({
  records,
  selectedIds,
  urlJobs,
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const [filename, setFilename] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    return `eaton_batch_extracted_${today}.xlsx`;
  });
  const [sheetName, setSheetName] = useState('Eaton Data');

  const [includeInputLink, setIncludeInputLink] = useState(true);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [includeIndex, setIncludeIndex] = useState(true);
  const [exportSelectedOnly, setExportSelectedOnly] = useState(false);

  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  const activeRecords = exportSelectedOnly && selectedIds.size > 0
    ? records.filter((r) => selectedIds.has(r.id))
    : records;

  const handleExcelExport = () => {
    if (activeRecords.length === 0) return;

    const options: ExcelExportOptions = {
      filename,
      sheetName,
      selectedOnly: exportSelectedOnly && selectedIds.size > 0,
      includeInputLink,
      includeTimestamp,
      includeIndex,
    };

    const result = exportRecordsToExcel(activeRecords, options, urlJobs);
    if (result.success) {
      setDownloadSuccess(`Downloaded "${result.filename}" (${result.rowCount} rows)`);
      setTimeout(() => setDownloadSuccess(null), 4000);
    }
  };

  const handleCsvExport = () => {
    if (activeRecords.length === 0) return;
    const baseName = filename.replace(/\.xlsx$/i, '');
    exportRecordsToCsv(activeRecords, `${baseName}.csv`);
  };

  const handleCopyClipboard = async () => {
    if (activeRecords.length === 0) return;
    const ok = await copyRecordsToClipboard(activeRecords);
    if (ok) {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(null as unknown as boolean), 2000);
    }
  };

  const handleJsonDownload = () => {
    if (activeRecords.length === 0) return;
    const dataToExport = activeRecords.map((r) => ({
      inputJsonLink: r.sourceUrl,
      title: r.title,
      description: r.description,
      completeUrl: r.completeUrl,
      statusBadge: r.statusBadge,
      extractedAt: r.extractedAt,
    }));
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/\.xlsx$/i, '.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Summary description */}
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Excel Spreadsheet Export
            </h2>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded">
              .XLSX Format Ready
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Exports formatted columns: <strong className="text-slate-700">Input JSON Link</strong>, <strong className="text-slate-700">Title</strong>, <strong className="text-slate-700">Complete URL</strong>, <strong className="text-slate-700">Status Badge</strong> with active hyperlinks and autofilter.
          </p>
        </div>

        {/* Right: Primary Action & Quick Options */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Options Toggle */}
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className={`inline-flex items-center space-x-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              showOptions
                ? 'bg-slate-100 text-slate-900 border-slate-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Options</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
          </button>

          {/* Secondary formats */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={handleCsvExport}
              disabled={records.length === 0}
              className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded transition-colors disabled:opacity-40"
              title="Download CSV file"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={handleJsonDownload}
              disabled={records.length === 0}
              className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded transition-colors disabled:opacity-40"
              title="Download JSON file"
            >
              JSON
            </button>
            <button
              type="button"
              onClick={handleCopyClipboard}
              disabled={records.length === 0}
              className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded transition-colors disabled:opacity-40 inline-flex items-center space-x-1"
              title="Copy table to clipboard for Google Sheets / Excel paste"
            >
              {copiedSuccess ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-600 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy TSV</span>
                </>
              )}
            </button>
          </div>

          {/* PRIMARY EXCEL BUTTON */}
          <button
            type="button"
            onClick={handleExcelExport}
            disabled={records.length === 0}
            className="inline-flex items-center space-x-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 fill-white/20" />
            <span>Save in Excel File ({activeRecords.length})</span>
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {downloadSuccess && (
        <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{downloadSuccess}</span>
          </div>
          <span className="text-emerald-600">Saved to Downloads</span>
        </div>
      )}

      {/* Advanced Excel Configuration Drawer */}
      {showOptions && (
        <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              File Name
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md font-mono text-xs focus:bg-white focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Worksheet Name
            </label>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              maxLength={31}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:bg-white focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2 flex flex-col justify-end">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInputLink}
                  onChange={(e) => setIncludeInputLink(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700">Include Input JSON Link column</span>
              </label>

              <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTimestamp}
                  onChange={(e) => setIncludeTimestamp(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700">Include Extraction Timestamp</span>
              </label>

              <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeIndex}
                  onChange={(e) => setIncludeIndex(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700">Include Row Index (#)</span>
              </label>

              {selectedIds.size > 0 && (
                <label className="inline-flex items-center space-x-1.5 cursor-pointer text-emerald-700 font-medium">
                  <input
                    type="checkbox"
                    checked={exportSelectedOnly}
                    onChange={(e) => setExportSelectedOnly(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Export {selectedIds.size} selected only</span>
                </label>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
