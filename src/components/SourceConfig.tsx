import React from 'react';
import { Source } from '../lib/utils';
import { RefreshCw } from 'lucide-react';

interface SourceConfigProps {
  sources: Source[];
  onUpdateSource: (index: number, updates: Partial<Source>) => void;
  onReset: () => void;
}

export function SourceConfig({ sources, onUpdateSource, onReset }: SourceConfigProps) {
  return (
    <div className="h-full flex flex-col border-r border-[var(--line)] bg-[var(--bg)]">
      <div className="p-4 border-b border-[var(--line)] flex justify-between items-center">
        <h2 className="font-serif italic text-lg opacity-80">Source Liquids</h2>
        <button onClick={onReset} className="p-2 hover:bg-[var(--ink)] hover:text-[var(--bg)] rounded-full transition-colors" title="Reset to Defaults">
          <RefreshCw size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {sources.map((source, index) => (
          <div key={source.id} className="data-row grid-cols-[40px_1fr_60px] gap-4 items-center">
            <div className="font-mono text-xs opacity-50">{(index + 1).toString().padStart(2, '0')}</div>
            
            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={source.name}
                onChange={(e) => onUpdateSource(index, { name: e.target.value })}
                className="font-sans font-medium bg-transparent outline-none border-b border-transparent focus:border-[var(--ink)] w-full"
                placeholder="Source Name"
              />
              <div className="text-[10px] uppercase tracking-wider opacity-50 font-mono">
                {source.color}
              </div>
            </div>

            <div className="relative group">
              <input
                type="color"
                value={source.color}
                onChange={(e) => {
                  onUpdateSource(index, { color: e.target.value });
                }}
                className="w-10 h-10 rounded-full cursor-pointer border-2 border-[var(--line)] p-0 overflow-hidden"
              />
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t border-[var(--line)] text-xs opacity-60 font-mono">
        Configure the 3 RGB source liquids available on the OT2 deck.
      </div>
    </div>
  );
}
