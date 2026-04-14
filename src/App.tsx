import React, { useState } from 'react';
import { SourceConfig } from './components/SourceConfig';
import { WellConfig } from './components/WellConfig';
import { CalibrationConfig } from './components/CalibrationConfig';
import { ResultsPanel } from './components/ResultsPanel';
import { Source, Well, WAVELENGTHS, CalibrationMatrix } from './lib/utils';
import { motion } from 'motion/react';

const DEFAULT_SOURCES: Source[] = [
  { id: '1', name: 'Red Source', color: '#FF0000', rgb: { r: 255, g: 0, b: 0 } },
  { id: '2', name: 'Yellow Source', color: '#FFFF00', rgb: { r: 255, g: 255, b: 0 } },
  { id: '3', name: 'Blue Source', color: '#0000FF', rgb: { r: 0, g: 0, b: 255 } },
];

const DEFAULT_WELLS: Well[] = [
  { id: '1', name: 'Well 1', targetColor: { r: 255, g: 0, b: 0 } },
  { id: '2', name: 'Well 2', targetColor: { r: 255, g: 128, b: 0 } },
  { id: '3', name: 'Well 3', targetColor: { r: 255, g: 255, b: 0 } },
  { id: '4', name: 'Well 4', targetColor: { r: 0, g: 255, b: 0 } },
  { id: '5', name: 'Well 5', targetColor: { r: 0, g: 255, b: 255 } },
  { id: '6', name: 'Well 6', targetColor: { r: 0, g: 0, b: 255 } },
  { id: '7', name: 'Well 7', targetColor: { r: 128, g: 0, b: 255 } },
  { id: '8', name: 'Well 8', targetColor: { r: 255, g: 0, b: 255 } },
];

// Default Matrix: Map 3 sources to 8 spectral channels
// Rows: 8 Channels (410, 440, 470, 510, 550, 583, 620, 670)
// Cols: 3 Sources (R, Y, B)
// Values: Response (0-100)
const DEFAULT_MATRIX = [
  // R   Y   B
  [10, 10, 80], // 410 (Violet) - Blue source high
  [10, 10, 90], // 440 (Blue)   - Blue source high
  [10, 20, 80], // 470 (Cyan)   - Blue + Yellow (low)
  [10, 80, 40], // 510 (Green)  - Yellow source high
  [40, 90, 10], // 550 (Yellow) - Yellow + Red
  [80, 90, 10], // 583 (Orange) - Red + Yellow
  [90, 80, 10], // 620 (Red)    - Red source high
  [80, 60, 10], // 670 (Deep Red)- Red source high
];

export default function App() {
  const [sources, setSources] = useState<Source[]>(DEFAULT_SOURCES);
  const [wells, setWells] = useState<Well[]>(DEFAULT_WELLS);
  const [matrix, setMatrix] = useState<CalibrationMatrix>(DEFAULT_MATRIX);
  const [totalVolume, setTotalVolume] = useState(300);
  const [activeTab, setActiveTab] = useState<'sources' | 'wells' | 'calibration'>('wells');

  const handleUpdateSource = (index: number, updates: Partial<Source>) => {
    const newSources = [...sources];
    newSources[index] = { ...newSources[index], ...updates };
    setSources(newSources);
  };

  const handleUpdateWell = (index: number, updates: Partial<Well>) => {
    const newWells = [...wells];
    newWells[index] = { ...newWells[index], ...updates };
    setWells(newWells);
  };

  const handleUpdateMatrix = (newMatrix: CalibrationMatrix) => {
    setMatrix(newMatrix);
  };

  const handleReset = () => {
    setSources(DEFAULT_SOURCES);
    setWells(DEFAULT_WELLS);
    setMatrix(DEFAULT_MATRIX);
  };

  return (
    <div className="flex h-screen w-full bg-[var(--bg)] text-[var(--ink)] overflow-hidden">
      {/* Sidebar: Configuration */}
      <motion.div 
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-80 flex-shrink-0 h-full border-r border-[var(--line)] bg-white/50 backdrop-blur-sm flex flex-col"
      >
        <div className="flex border-b border-[var(--line)]">
          <button 
            onClick={() => setActiveTab('sources')}
            className={`flex-1 py-3 text-xs font-mono uppercase tracking-wider ${activeTab === 'sources' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'hover:bg-black/5'}`}
          >
            Sources
          </button>
          <button 
            onClick={() => setActiveTab('wells')}
            className={`flex-1 py-3 text-xs font-mono uppercase tracking-wider ${activeTab === 'wells' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'hover:bg-black/5'}`}
          >
            Wells
          </button>
          <button 
            onClick={() => setActiveTab('calibration')}
            className={`flex-1 py-3 text-xs font-mono uppercase tracking-wider ${activeTab === 'calibration' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'hover:bg-black/5'}`}
          >
            Calib
          </button>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'sources' ? (
            <SourceConfig 
              sources={sources} 
              onUpdateSource={handleUpdateSource} 
              onReset={handleReset}
            />
          ) : activeTab === 'wells' ? (
            <WellConfig 
              wells={wells} 
              onUpdateWell={handleUpdateWell}
              onReset={handleReset}
            />
          ) : (
            <CalibrationConfig
              matrix={matrix}
              sources={sources}
              onUpdateMatrix={handleUpdateMatrix}
              onReset={() => setMatrix(DEFAULT_MATRIX)}
            />
          )}
        </div>
      </motion.div>

      {/* Main Content: Results */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <ResultsPanel 
          sources={sources}
          wells={wells}
          matrix={matrix}
          totalVolume={totalVolume} 
        />
      </main>
    </div>
  );
}
