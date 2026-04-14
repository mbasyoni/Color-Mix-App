import React from 'react';
import { CalibrationMatrix, WAVELENGTHS, Source } from '../lib/utils';
import { RotateCcw } from 'lucide-react';

interface CalibrationConfigProps {
  matrix: CalibrationMatrix;
  sources: Source[];
  onUpdateMatrix: (newMatrix: CalibrationMatrix) => void;
  onReset: () => void;
}

export function CalibrationConfig({ matrix, sources, onUpdateMatrix, onReset }: CalibrationConfigProps) {
  const handleValueChange = (row: number, col: number, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    
    const newMatrix = matrix.map(r => [...r]);
    newMatrix[row][col] = numValue;
    onUpdateMatrix(newMatrix);
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-serif italic">Sensor Calibration</h2>
          <p className="text-xs opacity-60 mt-1 font-mono">
            Define the response of each sensor channel (row) to each pure source (col).
            Values represent the sensor reading (0-100) for a pure sample.
          </p>
        </div>
        <button 
          onClick={onReset}
          className="p-2 hover:bg-black/5 rounded-full transition-colors"
          title="Reset to Defaults"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono border-collapse">
          <thead>
            <tr>
              <th className="p-2 border border-[var(--line)] bg-gray-50 text-left w-20">Wavelength</th>
              {sources.map(source => (
                <th key={source.id} className="p-2 border border-[var(--line)] bg-gray-50 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} />
                    {source.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="p-2 border border-[var(--line)] font-bold bg-gray-50">
                  {WAVELENGTHS[rowIndex]} nm
                </td>
                {row.map((val, colIndex) => (
                  <td key={colIndex} className="p-0 border border-[var(--line)]">
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => handleValueChange(rowIndex, colIndex, e.target.value)}
                      className="w-full h-full p-2 text-center outline-none focus:bg-blue-50 transition-colors"
                      step="1"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-100 rounded-lg text-xs text-yellow-800">
        <strong>Note:</strong> For Subtractive mixing (dyes), these values are treated as Transmittance (0-100%). 
        Lower values mean higher absorbance. For Additive mixing (lights), they are treated as Intensity.
      </div>
    </div>
  );
}
