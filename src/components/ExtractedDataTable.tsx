import React, { useState, useMemo } from 'react';
import { ExtractedRecord } from '../types/extractor';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ExternalLink, 
  Copy, 
  Code2, 
  Check, 
  Trash2,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';

interface ExtractedDataTableProps {
  records: ExtractedRecord[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
  onInspectRecordJson: (rec: ExtractedRecord) => void;
}

type SortField = 'index' | 'sourceUrl' | 'title' | 'completeUrl' | 'statusBadge';
type SortOrder = 'asc' | 'desc';

export const ExtractedDataTable: React.FC<ExtractedDataTableProps> = ({
  records,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onDeleteRecord,
  onClearAll,
  onInspectRecordJson,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [badgeFilter, setBadgeFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('index');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Extract unique badges for dropdown
  const uniqueBadges = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.statusBadge) set.add(r.statusBadge);
    });
    return Array.from(set).sort();
  }, [records]);

  // Extract unique sources for dropdown
  const uniqueSources = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.sourceUrl) set.add(r.sourceUrl);
    });
    return Array.from(set).sort();
  }, [records]);

  // Filtered & Sorted records
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      // Badge filter
      if (badgeFilter !== 'ALL' && rec.statusBadge !== badgeFilter) {
        return false;
      }
      // Source filter
      if (sourceFilter !== 'ALL' && rec.sourceUrl !== sourceFilter) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = rec.title.toLowerCase().includes(query);
        const matchesUrl = rec.completeUrl.toLowerCase().includes(query);
        const matchesBadge = rec.statusBadge.toLowerCase().includes(query);
        const matchesSource = rec.sourceUrl.toLowerCase().includes(query);
        return matchesTitle || matchesUrl || matchesBadge || matchesSource;
      }
      return true;
    });
  }, [records, badgeFilter, sourceFilter, searchTerm]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortField === 'title') {
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
      } else if (sortField === 'completeUrl') {
        valA = a.completeUrl.toLowerCase();
        valB = b.completeUrl.toLowerCase();
      } else if (sortField === 'statusBadge') {
        valA = a.statusBadge.toLowerCase();
        valB = b.statusBadge.toLowerCase();
      } else if (sortField === 'sourceUrl') {
        valA = a.sourceUrl.toLowerCase();
        valB = b.sourceUrl.toLowerCase();
      } else {
        return sortOrder === 'asc' ? 0 : -1;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRecords, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getBadgeStyle = (badge: string) => {
    const lower = (badge || '').toLowerCase();
    if (
      lower.includes('complete') ||
      lower.includes('stock') && !lower.includes('low') && !lower.includes('out') ||
      lower.includes('active') ||
      lower.includes('approved') ||
      lower.includes('success') ||
      lower.includes('peer') ||
      lower.includes('verified')
    ) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (
      lower.includes('progress') ||
      lower.includes('editor') ||
      lower.includes('process') ||
      lower.includes('open')
    ) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (
      lower.includes('review') ||
      lower.includes('low') ||
      lower.includes('pending') ||
      lower.includes('order') ||
      lower.includes('trending') ||
      lower.includes('backlog')
    ) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (
      lower.includes('out') ||
      lower.includes('discontinued') ||
      lower.includes('cancel') ||
      lower.includes('error') ||
      lower.includes('reject')
    ) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  if (records.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          No Extracted Records Yet
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
          Paste Eaton JSON links above or click "Insert Eaton Example" to extract <code className="font-mono text-emerald-700 font-semibold">title</code>, <code className="font-mono text-emerald-700 font-semibold">completeUrl</code>, and <code className="font-mono text-emerald-700 font-semibold">statusBadge</code> into an Excel spreadsheet.
        </p>

      </div>
    );
  }

  const allSelected = sortedRecords.length > 0 && sortedRecords.every((r) => selectedIds.has(r.id));
  const someSelected = sortedRecords.some((r) => selectedIds.has(r.id));

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        {/* Search & Filter */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, URL, badge..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Badge Filter */}
          {uniqueBadges.length > 0 && (
            <select
              value={badgeFilter}
              onChange={(e) => setBadgeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Status Badges ({uniqueBadges.length})</option>
              {uniqueBadges.map((b) => (
                <option key={b} value={b}>
                  Badge: {b}
                </option>
              ))}
            </select>
          )}

          {/* Source Link Filter */}
          {uniqueSources.length > 1 && (
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[180px] truncate"
            >
              <option value="ALL">All Sources ({uniqueSources.length})</option>
              {uniqueSources.map((s) => (
                <option key={s} value={s}>
                  Source: {s}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Counter and Clear */}
        <div className="flex items-center space-x-3 text-xs">
          <span className="text-slate-500">
            Showing <strong className="text-slate-900">{sortedRecords.length}</strong> of{' '}
            <strong className="text-slate-900">{records.length}</strong> records
            {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
          </span>

          <button
            onClick={onClearAll}
            className="text-slate-500 hover:text-red-600 transition-colors p-1"
            title="Clear all extracted records"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold select-none">
              <th className="py-2.5 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </th>
              <th className="py-2.5 px-3 w-12 text-slate-500">#</th>
              <th
                onClick={() => handleSort('sourceUrl')}
                className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/50 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Input JSON Link</span>
                  {sortField === 'sourceUrl' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('title')}
                className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/50 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Title</span>
                  {sortField === 'title' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('completeUrl')}
                className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/50 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Complete URL</span>
                  {sortField === 'completeUrl' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('statusBadge')}
                className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/50 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Status Badge</span>
                  {sortField === 'statusBadge' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  )}
                </div>
              </th>
              <th className="py-2.5 px-3 text-right w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No records match your search or filter.
                </td>
              </tr>
            ) : (
              sortedRecords.map((rec, idx) => {
                const isSelected = selectedIds.has(rec.id);
                return (
                  <tr
                    key={rec.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      isSelected ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(rec.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Row Index */}
                    <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Source JSON URL */}
                    <td className="py-2 px-3 max-w-[180px]">
                      <span
                        className="font-mono text-slate-500 text-[11px] truncate block"
                        title={rec.sourceUrl}
                      >
                        {rec.sourceUrl}
                      </span>
                    </td>

                    {/* Title */}
                    <td className="py-2 px-3 max-w-[280px]">
                      {rec.title ? (
                        <span className="font-medium text-slate-900 block truncate" title={rec.title}>
                          {rec.title}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic flex items-center">
                          <AlertCircle className="w-3 h-3 text-amber-500 mr-1" />
                          Missing title
                        </span>
                      )}
                    </td>

                    {/* Complete URL */}
                    <td className="py-2 px-3 max-w-[260px]">
                      {rec.completeUrl ? (
                        <div className="flex items-center space-x-1.5">
                          <a
                            href={rec.completeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-blue-600 hover:text-blue-800 hover:underline truncate text-[11px] block"
                            title={rec.completeUrl}
                          >
                            {rec.completeUrl}
                          </a>
                          <a
                            href={rec.completeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-slate-600 shrink-0"
                            title="Open URL"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No URL</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-2 px-3">
                      {rec.statusBadge ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${getBadgeStyle(
                            rec.statusBadge
                          )}`}
                        >
                          {rec.statusBadge}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">None</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(rec.completeUrl || rec.title, rec.id)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                          title="Copy URL/Title"
                        >
                          {copiedId === rec.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onInspectRecordJson(rec)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                          title="View raw JSON node"
                        >
                          <Code2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteRecord(rec.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
