import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ErrorBar, Cell } from 'recharts';
import { Source, Well, solveMixing, rgbToHex, MixingMode, CalibrationMatrix, calculateSensorResponse, spectrumToRgb, generateDataset, WAVELENGTHS } from '../lib/utils';
import { Download, FlaskConical, Lightbulb, Sliders, Database } from 'lucide-react';

interface ResultsPanelProps {
  sources: Source[];
  wells: Well[];
  matrix: CalibrationMatrix;
  totalVolume: number; // e.g., 300 uL
}

// Box-Muller transform for normal distribution
function randn_bm() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function ResultsPanel({ sources, wells, matrix, totalVolume }: ResultsPanelProps) {
  const [pipetteError, setPipetteError] = useState({ systematic: 0.5, random: 0.01 }); // 0.5uL + 1%
  const [mode, setMode] = useState<MixingMode>('subtractive');
  const [minVolume, setMinVolume] = useState(10); // Default 10uL
  const [isManual, setIsManual] = useState(false);
  const [manualVolumes, setManualVolumes] = useState<number[]>([]);
  const [datasetSize, setDatasetSize] = useState(100);

  // Initialize manual volumes if empty
  useMemo(() => {
    if (manualVolumes.length !== sources.length) {
      setManualVolumes(new Array(sources.length).fill(totalVolume / sources.length));
    }
  }, [sources.length, totalVolume]);

  const handleManualVolumeChange = (index: number, value: number) => {
    const newVolumes = [...manualVolumes];
    newVolumes[index] = Math.max(0, value);
    setManualVolumes(newVolumes);
  };

  // Solve for each well (Auto Mode) or use Manual Volumes
  const results = useMemo(() => {
    // Ensure minVolume doesn't exceed totalVolume / sources.length
    const safeMinVolume = Math.min(minVolume, totalVolume / sources.length);
    const minWeight = safeMinVolume / totalVolume;

    return wells.map(well => {
      let baseVolumes: number[];
      let predictedColor: { r: number; g: number; b: number };
      let error = 0;
      let spectralResponse: number[] = [];

      if (isManual) {
        baseVolumes = manualVolumes;
        // In manual mode, we predict the output based on the matrix
        spectralResponse = calculateSensorResponse(manualVolumes, matrix, mode, totalVolume);
        predictedColor = spectrumToRgb(spectralResponse);
        // Error is distance between Target Color and Predicted Color
        error = Math.sqrt(
          Math.pow(predictedColor.r - well.targetColor.r, 2) +
          Math.pow(predictedColor.g - well.targetColor.g, 2) +
          Math.pow(predictedColor.b - well.targetColor.b, 2)
        );
      } else {
        // Auto Solver: Find volumes to match Target Color
        // Note: The solver currently optimizes for RGB match. 
        // Ideally, it should optimize for Spectral Match if the target was defined as a spectrum.
        // But since Wells are defined by Target Color (RGB), we stick to RGB solver for now.
        const solution = solveMixing(sources, well.targetColor, mode, minWeight);
        baseVolumes = solution.weights.map(w => w * totalVolume);
        predictedColor = solution.predictedColor;
        error = solution.error;
        
        // Calculate the spectral response for this solution
        spectralResponse = calculateSensorResponse(baseVolumes, matrix, mode, totalVolume);
      }
      
      // Monte Carlo Simulation (Simplified for performance)
      const iterations = 200; 
      const simResults = [];
      
      for (let k = 0; k < iterations; k++) {
        const perturbedVolumes = baseVolumes.map(vol => {
          if (vol === 0) return 0;
          const err = Math.abs(randn_bm() * (pipetteError.systematic + vol * pipetteError.random));
          return Math.max(0, vol + (Math.random() > 0.5 ? err : -err));
        });

        // Calculate spectral response for perturbed volumes
        const response = calculateSensorResponse(perturbedVolumes, matrix, mode, totalVolume);
        // Convert to RGB
        const color = spectrumToRgb(response);
        simResults.push(color);
      }

      // Calculate std dev
      const meanR = simResults.reduce((a, b) => a + b.r, 0) / iterations;
      const meanG = simResults.reduce((a, b) => a + b.g, 0) / iterations;
      const meanB = simResults.reduce((a, b) => a + b.b, 0) / iterations;

      const stdR = Math.sqrt(simResults.reduce((a, b) => a + Math.pow(b.r - meanR, 2), 0) / iterations);
      const stdG = Math.sqrt(simResults.reduce((a, b) => a + Math.pow(b.g - meanG, 2), 0) / iterations);
      const stdB = Math.sqrt(simResults.reduce((a, b) => a + Math.pow(b.b - meanB, 2), 0) / iterations);
      
      const colorUncertainty = Math.sqrt(stdR*stdR + stdG*stdG + stdB*stdB);

      return {
        well,
        predictedColor,
        error,
        volumes: baseVolumes,
        spectralResponse,
        uncertainty: colorUncertainty,
        volumeErrors: baseVolumes.map(v => pipetteError.systematic + v * pipetteError.random)
      };
    });
  }, [sources, wells, matrix, mode, minVolume, totalVolume, pipetteError, isManual, manualVolumes]);

  const handleDownloadCSV = () => {
    let csv = "Well,Target Color,Predicted Color,Delta E,Source 1 (uL),Source 2 (uL),Source 3 (uL)\n";
    results.forEach(res => {
      const targetHex = rgbToHex(res.well.targetColor.r, res.well.targetColor.g, res.well.targetColor.b);
      const predHex = rgbToHex(res.predictedColor.r, res.predictedColor.g, res.predictedColor.b);
      const vols = res.volumes.map(v => v.toFixed(2)).join(",");
      csv += `${res.well.name},${targetHex},${predHex},${res.error.toFixed(2)},${vols}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ot2_well_mixing_protocol.csv';
    a.click();
  };


  const handleGenerateDataset = () => {
    const csv = generateDataset(sources, matrix, mode, datasetSize, totalVolume, minVolume);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'active_learning_dataset.csv';
    a.click();
  };

  return (
    <div className="h-full flex flex-col p-6 gap-8 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-[var(--line)] pb-4">
        <div>
          <h1 className="text-4xl font-serif italic mb-2">Well Mixing Plan</h1>
          <div className="font-mono text-xs opacity-60 flex items-center gap-4">
            <span>Total Vol/Well: {totalVolume} µL</span>
            <span className="w-px h-3 bg-current opacity-20" />
            <span>Min Vol: {minVolume} µL</span>
            <span className="w-px h-3 bg-current opacity-20" />
            <span>Error Model: {pipetteError.systematic}µL + {(pipetteError.random * 100).toFixed(0)}%</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end items-center">
           <div className="flex bg-white rounded-lg border border-[var(--line)] p-1">
            <button 
              onClick={() => setMode('subtractive')}
              className={`px-3 py-1.5 rounded text-xs font-mono flex items-center gap-2 transition-colors ${mode === 'subtractive' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'hover:bg-gray-100'}`}
            >
              <FlaskConical size={14} /> Subtractive
            </button>
            <button 
              onClick={() => setMode('additive')}
              className={`px-3 py-1.5 rounded text-xs font-mono flex items-center gap-2 transition-colors ${mode === 'additive' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'hover:bg-gray-100'}`}
            >
              <Lightbulb size={14} /> Additive
            </button>
          </div>

          <button 
            onClick={() => setIsManual(!isManual)}
            className={`btn-primary flex items-center gap-2 text-sm ${isManual ? 'bg-[var(--ink)] text-white' : ''}`}
          >
            <Sliders size={16} /> {isManual ? 'Manual Mix' : 'Auto Solver'}
          </button>

          <div className="flex items-center gap-2 bg-white border border-[var(--line)] rounded-lg p-1 px-2">
            <span className="text-[10px] font-mono opacity-50">N=</span>
            <input 
              type="number" 
              value={datasetSize}
              onChange={(e) => setDatasetSize(parseInt(e.target.value) || 100)}
              className="w-12 text-xs font-mono outline-none text-right"
            />
          </div>

          <button onClick={handleGenerateDataset} className="btn-primary flex items-center gap-2 text-sm">
            <Database size={16} /> Generate Dataset
          </button>

          <button onClick={handleDownloadCSV} className="btn-primary flex items-center gap-2 text-sm">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Manual Mix Controls */}
      {isManual && (
        <div className="bg-white rounded-xl p-4 border border-[var(--line)] shadow-sm">
          <h3 className="font-serif italic text-sm opacity-60 mb-4">Manual Source Volumes (Applied to ALL Wells)</h3>
          <div className="grid grid-cols-3 gap-4">
            {sources.map((source, index) => (
              <div key={source.id} className="p-3 border border-[var(--line)] rounded-lg flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: source.color }} />
                  <span className="font-mono text-xs truncate flex-1">{source.name}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={totalVolume}
                  step="1"
                  value={manualVolumes[index] || 0}
                  onChange={(e) => handleManualVolumeChange(index, parseFloat(e.target.value))}
                  className="w-full accent-[var(--ink)]"
                />
                <div className="flex justify-between items-center">
                  <input
                    type="number"
                    min="0"
                    value={manualVolumes[index] || 0}
                    onChange={(e) => handleManualVolumeChange(index, parseFloat(e.target.value))}
                    className="input-mono text-xs w-20"
                  />
                  <span className="text-[10px] opacity-50">µL</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid of Wells */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {results.map((res, i) => {
          const targetHex = rgbToHex(res.well.targetColor.r, res.well.targetColor.g, res.well.targetColor.b);
          const predHex = rgbToHex(res.predictedColor.r, res.predictedColor.g, res.predictedColor.b);
          
          const chartData = res.volumes.map((vol, idx) => ({
            name: sources[idx].name,
            volume: vol,
            color: sources[idx].color,
            error: res.volumeErrors[idx]
          }));

          return (
            <div key={res.well.id} className="bg-white rounded-xl border border-[var(--line)] overflow-hidden flex flex-col shadow-sm">
              <div className="p-3 border-b border-[var(--line)] flex justify-between items-center bg-gray-50">
                <span className="font-mono text-xs font-bold">{res.well.name}</span>
                <span className="font-mono text-[10px] opacity-50">ΔE {(res.error / 10).toFixed(1)}</span>
              </div>
              
              <div className="flex h-16">
                <div className="flex-1 relative group">
                  <div className="absolute inset-0" style={{ backgroundColor: targetHex }} />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 text-white text-[10px] font-mono transition-opacity">
                    Target
                  </div>
                </div>
                <div className="flex-1 relative group">
                  <div className="absolute inset-0" style={{ backgroundColor: predHex }} />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 text-white text-[10px] font-mono transition-opacity">
                    Predicted
                  </div>
                </div>
              </div>

              {/* Spectral Response Mini-Chart */}
              <div className="h-24 border-b border-[var(--line)] p-2 bg-gray-50/50 flex flex-col">
                 <div className="flex-1">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={res.spectralResponse.map((val, idx) => ({ wl: WAVELENGTHS[idx], val }))}>
                        <Tooltip 
                          contentStyle={{ fontFamily: 'var(--f-mono)', fontSize: '10px', borderRadius: '4px' }}
                          cursor={{ fill: 'transparent' }}
                          formatter={(value: number) => [value.toFixed(1), 'Response']}
                          labelFormatter={(label) => `${label}nm`}
                        />
                        <Bar dataKey="val" fill="#888888" radius={[2, 2, 0, 0]} />
                      </BarChart>
                   </ResponsiveContainer>
                 </div>
                 <div className="flex justify-between px-1 mt-1">
                    {res.spectralResponse.map((val, idx) => (
                      <div key={idx} className="flex flex-col items-center w-full">
                        <div className="h-full w-full bg-gray-200 rounded-sm overflow-hidden relative" style={{height: '2px'}}>
                          <div className="absolute bottom-0 left-0 w-full bg-gray-600" style={{height: `${Math.min(100, val)}%`}} />
                        </div>
                        <span className="text-[8px] font-mono opacity-50 mt-0.5">{val.toFixed(0)}</span>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="h-32 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                    <Tooltip 
                      contentStyle={{ fontFamily: 'var(--f-mono)', fontSize: '10px', borderRadius: '4px' }}
                      cursor={{ fill: 'transparent' }}
                    />
                    <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.1)" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-2 border-t border-[var(--line)] grid grid-cols-3 gap-1 text-[9px] font-mono text-center opacity-60">
                {res.volumes.map((v, idx) => (
                  <div key={idx} className="flex flex-col">
                    <span className="truncate">{sources[idx].name.split(' ')[0]}</span>
                    <span className="font-bold">{v.toFixed(0)}µL</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Uncertainty Settings */}
      <div className="grid grid-cols-3 gap-4 text-sm font-mono border-t border-[var(--line)] pt-4">
        <div>
          <label className="block opacity-50 mb-1">Min Volume (µL)</label>
          <input 
            type="number" 
            value={minVolume}
            onChange={e => setMinVolume(Math.max(0, parseFloat(e.target.value) || 0))}
            className="input-mono"
            step="1"
            disabled={isManual}
          />
        </div>
        <div>
          <label className="block opacity-50 mb-1">Systematic Error (µL)</label>
          <input 
            type="number" 
            value={pipetteError.systematic}
            onChange={e => setPipetteError(p => ({ ...p, systematic: parseFloat(e.target.value) || 0 }))}
            className="input-mono"
            step="0.1"
          />
        </div>
        <div>
          <label className="block opacity-50 mb-1">Random Error (%)</label>
          <input 
            type="number" 
            value={pipetteError.random * 100}
            onChange={e => setPipetteError(p => ({ ...p, random: (parseFloat(e.target.value) || 0) / 100 }))}
            className="input-mono"
            step="1"
          />
        </div>
      </div>
    </div>
  );
}
