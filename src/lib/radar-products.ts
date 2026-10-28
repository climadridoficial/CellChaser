// Browser-safe metadata: radar product definitions and color scales.

export type ProductKey = string; // ODIM quantity, e.g. "DBZH"

export interface ProductInfo {
  key: ProductKey;
  label: string;
  unit: string;
  scale: "reflectivity" | "velocity" | "generic";
  min: number;
  max: number;
  note?: string;
}

export const PRODUCT_INFO: Record<string, ProductInfo> = {
  DBZH: { key: "DBZH", label: "DBZH — Reflectivity", unit: "dBZ", scale: "reflectivity", min: -32, max: 75 },
  DBZV: { key: "DBZV", label: "DBZV — Reflectivity (V)", unit: "dBZ", scale: "reflectivity", min: -32, max: 75 },
  TH: { key: "TH", label: "TH — Raw reflectivity", unit: "dBZ", scale: "reflectivity", min: -32, max: 75 },
  TV: { key: "TV", label: "TV — Raw reflectivity (V)", unit: "dBZ", scale: "reflectivity", min: -32, max: 75 },
  VRAD: { key: "VRAD", label: "VRAD — Radial velocity", unit: "m/s", scale: "velocity", min: -35, max: 35 },
  VRADH: { key: "VRADH", label: "VRADH — Radial velocity", unit: "m/s", scale: "velocity", min: -35, max: 35 },
  WRAD: { key: "WRAD", label: "WRAD — Spectrum width", unit: "m/s", scale: "generic", min: 0, max: 10 },
  WRADH: { key: "WRADH", label: "WRADH — Spectrum width", unit: "m/s", scale: "generic", min: 0, max: 10 },
  ZDR: { key: "ZDR", label: "ZDR — Differential reflectivity", unit: "dB", scale: "generic", min: -2, max: 6 },
  RHOHV: { key: "RHOHV", label: "RHOHV — Correlation coeff.", unit: "", scale: "generic", min: 0, max: 1 },
  PHIDP: { key: "PHIDP", label: "PHIDP — Differential phase", unit: "deg", scale: "generic", min: -180, max: 180 },
  KDP: { key: "KDP", label: "KDP — Specific diff. phase", unit: "deg/km", scale: "generic", min: -1, max: 5 },
  SQIH: { key: "SQIH", label: "SQIH — Signal quality", unit: "", scale: "generic", min: 0, max: 1 },
  CCORH: { key: "CCORH", label: "CCORH — Clutter correction", unit: "dB", scale: "generic", min: 0, max: 40 },
  LDR: { key: "LDR", label: "LDR — Linear depol. ratio", unit: "dB", scale: "generic", min: -35, max: 5 },
  VRADV: { key: "VRADV", label: "VRADV — Radial velocity (V)", unit: "m/s", scale: "velocity", min: -35, max: 35 },
  WRADV: { key: "WRADV", label: "WRADV — Spectrum width (V)", unit: "m/s", scale: "generic", min: 0, max: 10 },
  UZDR: { key: "UZDR", label: "UZDR — Raw diff. reflectivity", unit: "dB", scale: "generic", min: -2, max: 6 },
  URHOHV: { key: "URHOHV", label: "URHOHV — Raw correlation coeff.", unit: "", scale: "generic", min: 0, max: 1 },
  UPHIDP: { key: "UPHIDP", label: "UPHIDP — Raw differential phase", unit: "deg", scale: "generic", min: -180, max: 180 },
  HGHT: { key: "HGHT", label: "HGHT — Echo height", unit: "km", scale: "generic", min: 0, max: 15 },
  SQIV: { key: "SQIV", label: "SQIV — Signal quality (V)", unit: "", scale: "generic", min: 0, max: 1 },
  CCORV: { key: "CCORV", label: "CCORV — Clutter correction (V)", unit: "dB", scale: "generic", min: 0, max: 40 },
  SNRH: { key: "SNRH", label: "SNRH — Signal-to-noise", unit: "dB", scale: "generic", min: -10, max: 60 },
  RATE: { key: "RATE", label: "RATE — Rain rate", unit: "mm/h", scale: "generic", min: 0, max: 50 },
  ACRR: { key: "ACRR", label: "ACRR — Accumulated rain", unit: "mm", scale: "generic", min: 0, max: 50 },
};

export function productInfo(key: string): ProductInfo {
  return (
    PRODUCT_INFO[key] ?? {
      key,
      label: key,
      unit: "",
      scale: "generic",
      min: 0,
      max: 1,
    }
  );
}

type Stop = [number, [number, number, number]];

const REFLECTIVITY_STOPS: Stop[] = [
  [-15, [70, 90, 140]],
  [-5, [60, 130, 210]],
  [5, [55, 175, 235]],
  [15, [70, 220, 235]],
  [25, [60, 210, 120]],
  [35, [240, 220, 70]],
  [45, [240, 140, 40]],
  [55, [225, 45, 45]],
  [65, [190, 40, 150]],
  [75, [250, 240, 255]],
];

// Classic Doppler scale: green = toward radar (negative), red = away (positive).
const VELOCITY_STOPS: Stop[] = [
  [-35, [150, 255, 150]],
  [-25, [0, 230, 0]],
  [-15, [0, 170, 0]],
  [-5, [0, 100, 0]],
  [-0.5, [60, 80, 60]],
  [0.5, [80, 60, 60]],
  [5, [110, 0, 0]],
  [15, [180, 0, 0]],
  [25, [240, 30, 30]],
  [35, [255, 160, 160]],
];

const GENERIC_STOPS: Stop[] = [
  [0, [25, 30, 55]],
  [0.25, [45, 110, 175]],
  [0.5, [50, 185, 175]],
  [0.75, [235, 205, 85]],
  [1, [245, 120, 90]],
];

function interp(stops: Stop[], v: number): [number, number, number] {
  if (v <= stops[0]![0]) return stops[0]![1];
  const last = stops[stops.length - 1]!;
  if (v >= last[0]) return last[1];
  for (let i = 1; i < stops.length; i++) {
    const [x1, c1] = stops[i]!;
    const [x0, c0] = stops[i - 1]!;
    if (v <= x1) {
      const t = (v - x0) / (x1 - x0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * t),
        Math.round(c0[1] + (c1[1] - c0[1]) * t),
        Math.round(c0[2] + (c1[2] - c0[2]) * t),
      ];
    }
  }
  return last[1];
}

export function colorFor(info: ProductInfo, value: number): [number, number, number, number] {
  if (info.scale === "reflectivity") {
    if (value < -15) return [0, 0, 0, 0];
    const [r, g, b] = interp(REFLECTIVITY_STOPS, value);
    return [r, g, b, 255];
  }
  if (info.scale === "velocity") {
    const [r, g, b] = interp(VELOCITY_STOPS, value);
    return [r, g, b, 255];
  }
  const t = (value - info.min) / (info.max - info.min || 1);
  const [r, g, b] = interp(GENERIC_STOPS, Math.min(1, Math.max(0, t)));
  return [r, g, b, 220];
}

/** Legend ticks for the currently selected product. */
export function legendStops(info: ProductInfo): { value: number; css: string }[] {
  const steps = 9;
  return Array.from({ length: steps }, (_, i) => {
    const value = info.min + ((info.max - info.min) * i) / (steps - 1);
    const [r, g, b] = colorFor(info, value);
    return { value: Math.round(value * 10) / 10, css: `rgb(${r},${g},${b})` };
  });
}
