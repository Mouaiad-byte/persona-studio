import { MetricPoint } from '../data/types'

export interface Scale {
  x(i: number): number
  y(v: number): number
  min: number
  max: number
}

export function makeScale(
  points: MetricPoint[],
  width: number,
  height: number,
  padding: { top: number; bottom: number } = { top: 0, bottom: 0 },
): Scale {
  const values = points.map((p) => p.value)
  const rawMax = Math.max(...values, 1)
  const rawMin = Math.min(...values, 0)
  // Headroom so the line never grazes the frame; floor at zero for count data.
  const max = rawMax + (rawMax - rawMin) * 0.12
  const min = Math.max(0, rawMin - (rawMax - rawMin) * 0.12)
  const plotH = height - padding.top - padding.bottom
  const denom = max - min || 1
  return {
    min,
    max,
    x: (i) => (points.length <= 1 ? 0 : (i / (points.length - 1)) * width),
    y: (v) => padding.top + plotH - ((v - min) / denom) * plotH,
  }
}

export function linePath(points: MetricPoint[], scale: Scale): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${scale.x(i).toFixed(2)},${scale.y(p.value).toFixed(2)}`).join(' ')
}

export function areaPath(points: MetricPoint[], scale: Scale, baselineY: number): string {
  if (points.length === 0) return ''
  const top = linePath(points, scale)
  const lastX = scale.x(points.length - 1).toFixed(2)
  const firstX = scale.x(0).toFixed(2)
  return `${top} L${lastX},${baselineY} L${firstX},${baselineY} Z`
}

/** Nearest data index to a pointer position, for the crosshair. */
export function indexAtX(x: number, width: number, count: number): number {
  if (count <= 1) return 0
  const ratio = Math.min(1, Math.max(0, x / width))
  return Math.round(ratio * (count - 1))
}

export function sum(points: MetricPoint[]): number {
  return points.reduce((acc, p) => acc + p.value, 0)
}

/** Sum of the last `n` points. */
export function sumLast(points: MetricPoint[], n: number): number {
  return sum(points.slice(-n))
}

/**
 * Change between the last `n` points and the `n` before them, as a fraction.
 * Returns null when there is not enough history to make the comparison.
 */
export function periodChange(points: MetricPoint[], n: number): number | null {
  if (points.length < n * 2) return null
  const recent = sumLast(points, n)
  const prior = sum(points.slice(-n * 2, -n))
  if (prior === 0) return null
  return (recent - prior) / prior
}
