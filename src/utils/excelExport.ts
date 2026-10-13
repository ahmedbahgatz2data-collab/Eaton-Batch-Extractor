import * as XLSX from 'xlsx';
import { ExtractedRecord, ExcelExportOptions, UrlJob } from '../types/extractor';

export function exportRecordsToExcel(
  records: ExtractedRecord[],
  options: ExcelExportOptions,
  urlJobs: UrlJob[] = []
): { success: boolean; filename: string; rowCount: number } {
  const wb = XLSX.utils.book_new();

  // 1. Prepare Main Data Sheet
  const headers: string[] = [];
  if (options.includeIndex) headers.push('#');
  if (options.includeInputLink) headers.push('Input JSON Link');
  headers.push('Title');
  headers.push('Complete URL');
  headers.push('Status Badge');
  if (options.includeTimestamp) headers.push('Extracted At');

  const rows: (string | number)[][] = [headers];

  records.forEach((rec, idx) => {
    const row: (string | number)[] = [];
    if (options.includeIndex) row.push(idx + 1);
    if (options.includeInputLink) row.push(rec.sourceUrl);
    row.push(rec.title || '(No Title)');
    row.push(rec.completeUrl || '(No URL)');
    row.push(rec.statusBadge || '(None)');
    if (options.includeTimestamp) row.push(new Date(rec.extractedAt).toLocaleString());
    rows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Calculate auto column widths
  const colWidths = headers.map((header, colIdx) => {
    let maxLen = header.length;
    for (let r = 1; r < rows.length; r++) {
      const val = rows[r][colIdx];
      if (val !== undefined && val !== null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    }
    // Cap reasonable bounds
    return { wch: Math.min(Math.max(maxLen + 3, 12), 65) };
  });
  ws['!cols'] = colWidths;

  // Add autofilter range for Excel table filtering
  if (rows.length > 1) {
    const lastColIndex = headers.length - 1;
    const lastColLetter = XLSX.utils.encode_col(lastColIndex);
    ws['!autofilter'] = { ref: `A1:${lastColLetter}${rows.length}` };
  }

  // Add hyperlinks for URLs in the sheet
  records.forEach((rec, idx) => {
    const rowIndex = idx + 2; // 1-indexed, row 1 is header
    let targetColIdx = 0;
    if (options.includeIndex) targetColIdx++;
    if (options.includeInputLink) {
      // Input JSON link hyperlink
      if (rec.sourceUrl.startsWith('http://') || rec.sourceUrl.startsWith('https://')) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex - 1, c: targetColIdx });
        if (ws[cellRef]) {
          ws[cellRef].l = { Target: rec.sourceUrl, Tooltip: 'Open source JSON URL' };
        }
      }
      targetColIdx++;
    }
    targetColIdx++; // skip Title col

    // Complete URL hyperlink
    if (rec.completeUrl.startsWith('http://') || rec.completeUrl.startsWith('https://')) {
      const urlCellRef = XLSX.utils.encode_cell({ r: rowIndex - 1, c: targetColIdx });
      if (ws[urlCellRef]) {
        ws[urlCellRef].l = { Target: rec.completeUrl, Tooltip: 'Open extracted destination URL' };
      }
    }
  });

  const sheetTitle = (options.sheetName || 'Extracted Data').slice(0, 31); // Excel sheet max 31 chars
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

  // 2. Prepare Source Audit Summary Sheet
  if (urlJobs.length > 0) {
    const summaryHeaders = ['Source JSON Link', 'Fetch Status', 'Records Found', 'Latency (ms)', 'Error Details'];
    const summaryRows: (string | number)[][] = [summaryHeaders];

    urlJobs.forEach((job) => {
      summaryRows.push([
        job.url,
        job.status.toUpperCase(),
        job.itemsFound,
        job.durationMs ?? '-',
        job.error || 'None'
      ]);
    });

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWs['!cols'] = [
      { wch: 50 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Source Links Audit');
  }

  // Clean filename
  let filename = options.filename.trim();
  if (!filename.toLowerCase().endsWith('.xlsx')) {
    filename += '.xlsx';
  }

  // Trigger browser download
  XLSX.writeFile(wb, filename);

  return {
    success: true,
    filename,
    rowCount: records.length,
  };
}

export function exportRecordsToCsv(records: ExtractedRecord[], filename = 'extracted_data.csv'): void {
  const headers = ['Input JSON Link', 'Title', 'Complete URL', 'Status Badge', 'Extracted At'];
  const rows = records.map((r) => [
    `"${(r.sourceUrl || '').replace(/"/g, '""')}"`,
    `"${(r.title || '').replace(/"/g, '""')}"`,
    `"${(r.completeUrl || '').replace(/"/g, '""')}"`,
    `"${(r.statusBadge || '').replace(/"/g, '""')}"`,
    `"${r.extractedAt}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function copyRecordsToClipboard(records: ExtractedRecord[]): Promise<boolean> {
  const headers = ['Input JSON Link', 'Title', 'Complete URL', 'Status Badge'];
  const rows = records.map((r) => [
    r.sourceUrl,
    r.title,
    r.completeUrl,
    r.statusBadge,
  ]);
  const tsvContent = [headers.join('\t'), ...rows.map((row) => row.join('\t'))].join('\n');
  return navigator.clipboard.writeText(tsvContent).then(() => true).catch(() => false);
}
