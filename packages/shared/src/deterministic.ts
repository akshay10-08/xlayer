import { createHash } from "node:crypto";

export function hashToSeed(input: string): number {
  const digest = createHash("sha256").update(input).digest();
  return digest.readUInt32BE(0);
}

export function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function timeframeToMs(timeframe: string) {
  const match = timeframe.trim().match(/^(\d+)([mhd])$/i);
  if (!match) {
    throw new Error(`Unsupported timeframe: ${timeframe}`);
  }
  const multipliers: Record<string, number> = {
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000
  };
  const amount = Number(match[1]!);
  const unit = match[2]!.toLowerCase() as keyof typeof multipliers;
  return amount * multipliers[unit]!;
}
