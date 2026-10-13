import React from 'react';
import { FileSpreadsheet, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  recordCount: number;
  urlCount: number;
  stealthMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ recordCount, urlCount, stealthMode = true }) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-20 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Eaton Batch Extractor
              </h1>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                v2.0
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Extract <code className="text-emerald-700 font-mono text-[11px] font-semibold">title</code>, <code className="text-emerald-700 font-mono text-[11px] font-semibold">description</code>, <code className="text-emerald-700 font-mono text-[11px] font-semibold">completeUrl</code>, and <code className="text-emerald-700 font-mono text-[11px] font-semibold">statusBadge</code> to formatted Excel (.xlsx)
            </p>
          </div>
        </div>

        {/* Live Status & Quick Actions */}
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-lg border ${
            stealthMode 
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800' 
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <ShieldCheck className={`w-4 h-4 ${stealthMode ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span className="text-xs font-medium">
              {stealthMode ? 'Stealth Engine Active' : 'Standard Fetch'}
            </span>
          </div>

          {recordCount > 0 && (
            <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-slate-900">{recordCount}</span>
              <span>records ready</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

