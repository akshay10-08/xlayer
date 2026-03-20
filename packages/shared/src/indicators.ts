import { clamp, roundTo } from "./deterministic.js";
import type { Candle } from "./types.js";

export function computeEma(values: number[], period: number) {
  if (values.length === 0) {
    return 0;
  }

  const multiplier = 2 / (period + 1);
  let ema = values[0]!;

  for (let index = 1; index < values.length; index += 1) {
    ema = values[index]! * multiplier + ema * (1 - multiplier);
  }

  return ema;
}

export function computeRsi(values: number[], period = 14) {
  if (values.length <= period) {
    return 50;
  }

  let gains = 0;
  let losses = 0;

  for (let index = 1; index <= period; index += 1) {
    const delta = values[index]! - values[index - 1]!;
    if (delta >= 0) {
      gains += delta;
    } else {
      losses -= delta;
    }
  }

  for (let index = period + 1; index < values.length; index += 1) {
    const delta = values[index]! - values[index - 1]!;
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);
    gains = ((gains * (period - 1)) + gain) / period;
    losses = ((losses * (period - 1)) + loss) / period;
  }

  if (losses === 0) {
    return 100;
  }

  const relativeStrength = gains / losses;
  return clamp(100 - 100 / (1 + relativeStrength), 0, 100);
}

export function computeVolatility(values: number[]) {
  if (values.length <= 1) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

export function computeAverageVolume(candles: Candle[]) {
  if (candles.length === 0) {
    return 0;
  }

  return candles.reduce((sum, candle) => sum + candle.volume, 0) / candles.length;
}

export function computePriceMomentum(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  return first === 0 ? 0 : (last - first) / first;
}

export function averageTrueRange(candles: Candle[], period = 14) {
  if (candles.length < 2) {
    return 0;
  }

  const ranges: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index]!;
    const previous = candles[index - 1]!;
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );
    ranges.push(tr);
  }

  const slice = ranges.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / Math.max(slice.length, 1);
}

export function normalizeScore(score: number) {
  return roundTo(clamp(score, -1, 1), 4);
}
