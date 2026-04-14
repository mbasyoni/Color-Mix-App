import React from 'react';
import { Well, hexToRgb } from '../lib/utils';
import { RefreshCw } from 'lucide-react';

interface WellConfigProps {
  wells: Well[];
  onUpdateWell: (index: number, updates: Partial<Well>) => void;
  onReset: () => void;
}

export function WellConfig({ wells, onUpdateWell, onReset }: WellConfigProps) {
  return (
    <div className="h-full flex flex-col border-r border-[var(--line)] bg-[var(--bg)]">
      <div className="p-4 border-b border-[var(--line)] flex justify-between items-center">
        <h2 className="font-serif italic text-lg opacity-80">Target Wells</h2>
        <button onClick={onReset} className="p-2 hover:bg-[var(--ink)] hover:text-[var(--bg)] rounded-full transition-colors" title="Reset to Defaults">
          <RefreshCw size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {wells.map((well, index) => (
          <div key={well.id} className="data-row grid-cols-[40px_1fr_60px] gap-4 items-center">
            <div className="font-mono text-xs opacity-50">{(index + 1).toString().padStart(2, '0')}</div>
            
            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={well.name}
                onChange={(e) => onUpdateWell(index, { name: e.target.value })}
                className="font-sans font-medium bg-transparent outline-none border-b border-transparent focus:border-[var(--ink)] w-full"
                placeholder="Well Name"
              />
              <div className="text-[10px] uppercase tracking-wider opacity-50 font-mono">
                R{well.targetColor.r} G{well.targetColor.g} B{well.targetColor.b}
              </div>
            </div>

            <div className="relative group">
              <input
                type="color"
                value={`#${((1 << 24) + (well.targetColor.r << 16) + (well.targetColor.g << 8) + well.targetColor.b).toString(16).slice(1)}`}
                onChange={(e) => {
                  onUpdateWell(index, { targetColor: hexToRgb(e.target.value) });
                }}
                className="w-10 h-10 rounded-full cursor-pointer border-2 border-[var(--line)] p-0 overflow-hidden"
              />
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t border-[var(--line)] text-xs opacity-60 font-mono">
        Configure the 8 target wells and their desired colors.
      </div>
    </div>
  );
}
