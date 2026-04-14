import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert Hex to RGB object
export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

// Convert RGB object to Hex
export function rgbToHex(r: number, g: number, b: number) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export interface Source {
  id: string;
  name: string;
  color: string; // Hex for UI display
  rgb: { r: number; g: number; b: number };
}

export interface Well {
  id: string;
  name: string;
  targetColor: { r: number; g: number; b: number };
}

export interface Solution {
  weights: number[]; // Array of weights for sources
  predictedColor: { r: number; g: number; b: number };
  error: number; // Euclidean distance
}

export type MixingMode = 'additive' | 'subtractive';



export type CalibrationMatrix = number[][];

export function calculateSensorResponse(
  volumes: number[],
  matrix: CalibrationMatrix,
  mode: MixingMode,
  totalVolume: number
): number[] {
  // volumes: [v1, v2, v3]
  // matrix: 8 rows (sensors) x 3 cols (sources)
  // output: 8 sensor values

  const sensorValues = new Array(matrix.length).fill(0);
  
  // Normalize volumes to weights (0-1)
  const weights = volumes.map(v => v / totalVolume);

  for (let s = 0; s < matrix.length; s++) {
    let val = 0;
    if (mode === 'subtractive') {
      // Mix Absorbances
      // Matrix values assumed to be Transmittance % (0-100) or similar linear response
      // If matrix is raw sensor values, we might need to know "blank" value.
      // Let's assume matrix values are linear response coefficients.
      
      // Actually, for subtractive, we should mix in Log space if the matrix represents "color strength".
      // But if matrix represents "sensor reading for pure source", then:
      // A_mix = sum(w * A_source)
      // A_source = -log(Response_source)
      
      let A_mix = 0;
      for (let i = 0; i < weights.length; i++) {
        // Avoid log(0)
        const response = Math.max(0.1, matrix[s][i]); 
        // Normalize response to 0-1 for log calculation (assuming max is 100)
        const T = response / 100;
        const A = -Math.log10(T);
        A_mix += weights[i] * A;
      }
      
      // Convert back to T
      const T_mix = Math.pow(10, -A_mix);
      val = T_mix * 100;

    } else {
      // Additive: Linear mix
      for (let i = 0; i < weights.length; i++) {
        val += weights[i] * matrix[s][i];
      }
    }
    sensorValues[s] = val;
  }
  
  return sensorValues;
}

export function calculateMix(
  sources: Source[],
  weights: number[],
  mode: MixingMode
): { r: number; g: number; b: number } {
  const n = sources.length;

  if (mode === 'subtractive') {
    // Beer-Lambert Law: Mix Absorbances linearly
    let finalAx = 0, finalAy = 0, finalAz = 0;
    
    for (let i = 0; i < n; i++) {
      const r = Math.max(1, sources[i].rgb.r) / 255;
      const g = Math.max(1, sources[i].rgb.g) / 255;
      const b = Math.max(1, sources[i].rgb.b) / 255;
      
      const ar = -Math.log10(r);
      const ag = -Math.log10(g);
      const ab = -Math.log10(b);

      finalAx += weights[i] * ar;
      finalAy += weights[i] * ag;
      finalAz += weights[i] * ab;
    }

    const r = Math.pow(10, -finalAx) * 255;
    const g = Math.pow(10, -finalAy) * 255;
    const b = Math.pow(10, -finalAz) * 255;

    return {
      r: Math.max(0, Math.min(255, Math.round(r))),
      g: Math.max(0, Math.min(255, Math.round(g))),
      b: Math.max(0, Math.min(255, Math.round(b))),
    };
  } else {
    // Additive: Linear mix of RGB
    let finalX = 0, finalY = 0, finalZ = 0;
    for (let i = 0; i < n; i++) {
      finalX += weights[i] * sources[i].rgb.r;
      finalY += weights[i] * sources[i].rgb.g;
      finalZ += weights[i] * sources[i].rgb.b;
    }
    return {
      r: Math.max(0, Math.min(255, Math.round(finalX))),
      g: Math.max(0, Math.min(255, Math.round(finalY))),
      b: Math.max(0, Math.min(255, Math.round(finalZ))),
    };
  }
}

// Approximate CIE 1931 Color Matching Functions for specific wavelengths
// https://cvrl.cie.co.je/
const CMF: Record<number, { x: number; y: number; z: number }> = {
  410: { x: 0.0435, y: 0.0012, z: 0.2074 },
  440: { x: 0.3483, y: 0.0230, z: 1.7471 },
  470: { x: 0.1954, y: 0.0910, z: 1.2876 },
  510: { x: 0.0093, y: 0.5030, z: 0.1582 },
  550: { x: 0.4334, y: 0.9950, z: 0.0087 },
  583: { x: 1.0142, y: 0.8689, z: 0.0016 }, // Approx for 585
  620: { x: 0.8544, y: 0.3810, z: 0.0002 },
  670: { x: 0.0320, y: 0.0119, z: 0.0000 },
};

export const WAVELENGTHS = [410, 440, 470, 510, 550, 583, 620, 670];

export function spectrumToRgb(sensorValues: number[]): { r: number; g: number; b: number } {
  let X = 0, Y = 0, Z = 0;

  sensorValues.forEach((val, i) => {
    const wl = WAVELENGTHS[i];
    const cmf = CMF[wl];
    if (cmf) {
      X += val * cmf.x;
      Y += val * cmf.y;
      Z += val * cmf.z;
    }
  });

  // Normalize (Simple scaling for visualization)
  // In a real app, this would need proper exposure/white point handling
  const maxVal = Math.max(X, Y, Z, 1); 
  // This is a very rough approximation. 
  // Better: XYZ to sRGB matrix
  
  // XYZ to sRGB (D65)
  // https://www.image-engineering.de/library/technotes/958-how-to-convert-between-srgb-and-ciexyz
  let r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;

  // Gamma correction
  const gamma = (c: number) => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055;
  
  // Scale factor to bring it to visible range (arbitrary for now, depends on sensor units)
  const scale = 1; // Adjust based on expected sensor value range (0-100?)

  r = gamma(r * scale / 100);
  g = gamma(g * scale / 100);
  b = gamma(b * scale / 100);

  return {
    r: Math.max(0, Math.min(255, Math.round(r * 255))),
    g: Math.max(0, Math.min(255, Math.round(g * 255))),
    b: Math.max(0, Math.min(255, Math.round(b * 255))),
  };
}


export function generateDataset(
  sources: Source[],
  matrix: CalibrationMatrix,
  mode: MixingMode,
  count: number,
  totalVolume: number,
  minVolume: number = 0
): string {
  // Headers matching the user's repo conventions (lowercase chXXX)
  // Updated to r,y,b to reflect the RYB system
  let csv = "r,y,b,ch410,ch440,ch470,ch510,ch550,ch583,ch620,ch670\n";
  
  for (let i = 0; i < count; i++) {
    // Generate random volumes summing to totalVolume with minVolume constraint
    // We need 3 volumes v1, v2, v3 such that sum(v) = totalVolume and vi >= minVolume
    
    // Adjust total volume to account for reserved minimums
    const availableVolume = totalVolume - (sources.length * minVolume);
    
    if (availableVolume < 0) {
      // Should not happen if UI validates inputs, but handle gracefully
      const v = totalVolume / sources.length;
      const vols = [v, v, v];
      const response = calculateSensorResponse(vols, matrix, mode, totalVolume);
      csv += `${v.toFixed(2)},${v.toFixed(2)},${v.toFixed(2)},${response.map(v => v.toFixed(2)).join(',')}\n`;
      continue;
    }

    // Generate random weights for the available volume
    let r1 = Math.random();
    let r2 = Math.random();
    if (r1 > r2) [r1, r2] = [r2, r1];
    
    const w1 = r1;
    const w2 = r2 - r1;
    const w3 = 1 - r2;
    
    // Add back the minimum volume
    const v1 = minVolume + (w1 * availableVolume);
    const v2 = minVolume + (w2 * availableVolume);
    const v3 = minVolume + (w3 * availableVolume);
    
    const vols = [v1, v2, v3];
    
    // Calculate response
    const response = calculateSensorResponse(vols, matrix, mode, totalVolume);
    
    csv += `${vols[0].toFixed(2)},${vols[1].toFixed(2)},${vols[2].toFixed(2)},${response.map(v => v.toFixed(2)).join(',')}\n`;
  }
  
  return csv;
}

// Color Space Conversions for Perceptual Optimization
function rgbToLab(r: number, g: number, b: number) {
  // RGB to XYZ (D65)
  let rLin = r / 255, gLin = g / 255, bLin = b / 255;
  
  // Inverse sRGB Companding
  rLin = (rLin > 0.04045) ? Math.pow((rLin + 0.055) / 1.055, 2.4) : rLin / 12.92;
  gLin = (gLin > 0.04045) ? Math.pow((gLin + 0.055) / 1.055, 2.4) : gLin / 12.92;
  bLin = (bLin > 0.04045) ? Math.pow((bLin + 0.055) / 1.055, 2.4) : bLin / 12.92;

  // XYZ Linear Transform
  const x = (rLin * 0.4124 + gLin * 0.3576 + bLin * 0.1805) / 0.95047;
  const y = (rLin * 0.2126 + gLin * 0.7152 + bLin * 0.0722) / 1.00000;
  const z = (rLin * 0.0193 + gLin * 0.1192 + bLin * 0.9505) / 1.08883;

  // XYZ to Lab
  const epsilon = 0.008856;
  const kappa = 903.3;
  const f = (t: number) => (t > epsilon) ? Math.pow(t, 1/3) : (kappa * t + 16) / 116;

  const L = 116 * f(y) - 16;
  const A = 500 * (f(x) - f(y));
  const B = 200 * (f(y) - f(z));

  return { L, a: A, b: B };
}

function getDeltaE(rgb1: { r: number, g: number, b: number }, rgb2: { r: number, g: number, b: number }) {
  const lab1 = rgbToLab(rgb1.r, rgb1.g, rgb1.b);
  const lab2 = rgbToLab(rgb2.r, rgb2.g, rgb2.b);
  
  // CIE76 Delta E (Euclidean distance in Lab space)
  // Sufficient for optimization loops. For final validation, DE2000 is better but computationally heavier.
  return Math.sqrt(
    Math.pow(lab1.L - lab2.L, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

/**
 * Solves for the optimal mixture using Differential Evolution (DE).
 * DE is a stochastic global optimization algorithm ideal for continuous, multi-dimensional spaces.
 * It is robust against local minima common in non-linear mixing models (like subtractive color).
 */
export function solveMixing(
  sources: Source[],
  target: { r: number; g: number; b: number },
  mode: MixingMode = 'additive',
  minWeight: number = 0
): Solution {
  const n = sources.length;
  
  // Constraint: Minimum weight per source
  // If minWeight is too high, clamp it
  if (minWeight * n > 1) {
    minWeight = 1 / n;
  }
  const effectiveMin = minWeight;
  const remainingWeight = 1 - (n * effectiveMin);

  // Objective Function: Minimize Perceptual Error (Delta E)
  const costFunction = (weights: number[]) => {
    // Normalize weights to ensure they sum to remainingWeight
    // This handles the "simplex" constraint
    const sum = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = sum > 0 
      ? weights.map(w => (w / sum) * remainingWeight)
      : new Array(n).fill(remainingWeight / n);

    // Add back the minimums
    const finalWeights = normalizedWeights.map(w => w + effectiveMin);
    
    const predicted = calculateMix(sources, finalWeights, mode);
    return getDeltaE(predicted, target);
  };

  // --- Differential Evolution Configuration ---
  const populationSize = 15 * n; // Rule of thumb: 10-15 * dimensionality
  const maxGenerations = 100;
  const F = 0.8;  // Differential Weight [0, 2]
  const CR = 0.9; // Crossover Probability [0, 1]

  // Initialize Population
  // Each individual is a vector of weights (before normalization/min-add)
  let population = Array(populationSize).fill(0).map(() => 
    Array(n).fill(0).map(() => Math.random())
  );

  // Evaluate Initial Population
  let scores = population.map(ind => costFunction(ind));
  let bestIndex = 0;
  let bestScore = scores[0];

  for (let i = 1; i < populationSize; i++) {
    if (scores[i] < bestScore) {
      bestScore = scores[i];
      bestIndex = i;
    }
  }

  // Evolution Loop
  for (let gen = 0; gen < maxGenerations; gen++) {
    for (let i = 0; i < populationSize; i++) {
      // 1. Mutation: Select 3 distinct random agents (a, b, c) != i
      let a, b, c;
      do { a = Math.floor(Math.random() * populationSize); } while (a === i);
      do { b = Math.floor(Math.random() * populationSize); } while (b === i || b === a);
      do { c = Math.floor(Math.random() * populationSize); } while (c === i || c === a || c === b);

      // Create Mutant Vector: V = X_a + F * (X_b - X_c)
      const mutant = new Array(n);
      for (let j = 0; j < n; j++) {
        mutant[j] = population[a][j] + F * (population[b][j] - population[c][j]);
        // Clamp to valid range [0, 1] (soft constraint)
        if (mutant[j] < 0) mutant[j] = 0;
        if (mutant[j] > 1) mutant[j] = 1;
      }

      // 2. Crossover: Create Trial Vector
      const trial = new Array(n);
      const jRand = Math.floor(Math.random() * n); // Ensure at least one parameter changes
      for (let j = 0; j < n; j++) {
        if (Math.random() < CR || j === jRand) {
          trial[j] = mutant[j];
        } else {
          trial[j] = population[i][j];
        }
      }

      // 3. Selection
      const trialScore = costFunction(trial);
      if (trialScore < scores[i]) {
        population[i] = trial;
        scores[i] = trialScore;
        if (trialScore < bestScore) {
          bestScore = trialScore;
          bestIndex = i;
        }
      }
    }
    
    // Early exit if converged (optional, but good for performance)
    if (bestScore < 0.5) break; // Delta E < 0.5 is imperceptible
  }

  // Reconstruct final solution from best individual
  const bestRawWeights = population[bestIndex];
  const sum = bestRawWeights.reduce((a, b) => a + b, 0);
  const normalizedBest = sum > 0 
    ? bestRawWeights.map(w => (w / sum) * remainingWeight)
    : new Array(n).fill(remainingWeight / n);
  
  const finalWeights = normalizedBest.map(w => w + effectiveMin);
  const predictedColor = calculateMix(sources, finalWeights, mode);

  return {
    weights: finalWeights,
    predictedColor,
    error: bestScore, // This is now Delta E
  };
}
