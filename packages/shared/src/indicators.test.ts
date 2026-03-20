import { describe, it, expect } from "vitest";
import { computeEma, computeRsi, averageTrueRange, computeVolatility, computePriceMomentum, normalizeScore } from "./indicators.js";

describe("Mathematical Indicators", () => {
  it("computes EMA correctly", () => {
    // Basic test case: values [10, 20, 30] over period 2
    const values = [10, 20, 30];
    const period = 2;
    // Multiplier = 2 / (2 + 1) = 2/3
    // EMA1 = 10
    // EMA2 = 20 * (2/3) + 10 * (1/3) = 13.333 + 3.333 = 16.666
    // EMA3 = 30 * (2/3) + 16.666 * (1/3) = 20 + 5.555 = 25.555
    const ema = computeEma(values, period);
    expect(ema).toBeCloseTo(25.555, 2);
  });

  it("computes RSI correctly", () => {
    // 15 days of data, rising
    const values = [10, 11, 12, 11, 10, 12, 13, 11, 10, 9, 10, 11, 12, 13, 14, 15];
    const rsi = computeRsi(values, 14);
    expect(rsi).toBeGreaterThan(50); // Net positive growth
    expect(rsi).toBeLessThanOrEqual(100);
  });

  it("computes ATR correctly", () => {
    const candles = [
      { openTime: 0, closeTime: 1, open: 15, high: 20, low: 10, close: 15, volume: 100 },
      { openTime: 1, closeTime: 2, open: 15, high: 25, low: 15, close: 20, volume: 100 },
      { openTime: 2, closeTime: 3, open: 20, high: 30, low: 25, close: 25, volume: 100 } // Gap up
    ];
    // TR1 (timestamp 1): max(10, |25-15|, |15-15|) = 10
    // TR2 (timestamp 2): max(5, |30-20|, |25-20|) = 10
    const atr = averageTrueRange(candles, 2);
    expect(atr).toBeGreaterThan(0);
    expect(atr).toBeCloseTo(10, 1);
  });

  it("computes Volatility correctly", () => {
    const values = [10, 10, 10, 10]; // 0 volatility
    expect(computeVolatility(values)).toBe(0);

    const volatile = [10, 20, 10, 20];
    expect(computeVolatility(volatile)).toBeGreaterThan(0);
  });

  it("computes Momentum correctly", () => {
    const values = [100, 120];
    // (120 - 100) / 100 = 0.2
    expect(computePriceMomentum(values)).toBe(0.2);
  });

  it("normalizes Score correctly", () => {
    expect(normalizeScore(2.5)).toBe(1);
    expect(normalizeScore(-1.5)).toBe(-1);
    expect(normalizeScore(0.5)).toBe(0.5);
  });
});
