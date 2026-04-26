/**
 * Pearson correlation between APY time series. We correlate on day-over-day
 * APY *changes* rather than raw APY levels — two pools that both yield ~5%
 * with no movement aren't actually correlated, they're independently flat.
 * Correlating on returns/changes is the standard approach in portfolio theory.
 */

export interface CorrelationCell {
  i: number;
  j: number;
  /** Pearson correlation, -1..1. NaN when either series has zero variance. */
  value: number;
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return Number.NaN;

  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  if (varA === 0 || varB === 0) return Number.NaN;
  return cov / Math.sqrt(varA * varB);
}

/**
 * Day-over-day diffs. Drops the first row since there's no prior day to diff
 * against. Equivalent to `Δapy_t = apy_t - apy_{t-1}`.
 */
function diffs(series: number[]): number[] {
  if (series.length < 2) return [];
  const out: number[] = new Array(series.length - 1);
  for (let i = 1; i < series.length; i++) out[i - 1] = series[i] - series[i - 1];
  return out;
}

/**
 * Build the full NxN correlation matrix from an aligned APY matrix
 * (rows = days, cols = pools). Diagonal is 1.0. Symmetric.
 */
export function correlationMatrix(matrix: number[][]): number[][] {
  if (matrix.length === 0) return [];
  const numCols = matrix[0].length;
  const cols: number[][] = [];
  for (let c = 0; c < numCols; c++) {
    const series: number[] = new Array(matrix.length);
    for (let r = 0; r < matrix.length; r++) series[r] = matrix[r][c];
    cols.push(diffs(series));
  }

  const grid: number[][] = [];
  for (let i = 0; i < numCols; i++) {
    const row: number[] = new Array(numCols);
    for (let j = 0; j < numCols; j++) {
      if (i === j) row[j] = 1;
      else if (j < i) row[j] = grid[j][i];
      else row[j] = pearson(cols[i], cols[j]);
    }
    grid.push(row);
  }
  return grid;
}
