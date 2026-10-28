import type { RadarBounds } from "./aemet-overlay";

/**
 * Manual alignment tools for AEMET images. Turned off now that every radar has
 * been aligned; flip to true to bring back the "Alinear imagen AEMET" button.
 */
export const AEMET_ALIGNMENT_ENABLED = false;

/**
 * Map bounds [[south, west], [north, east]] for each AEMET regional image,
 * copied from the owner's saved manual alignments (28 Oct 2026). Applies to the
 * 480×460 crop produced by loadAemetImages.
 */
export const AEMET_CALIBRATION: Record<string, RadarBounds> = {
  am: [[34.64225, -4.81201], [38.79905, 0.6372]],
  ba: [[39.22375, -1.06842], [43.37711, 4.81476]],
  ca: [[25.8345, -18.05054], [29.99062, -13.15613]],
  cc: [[37.27288, -9.07646], [41.37886, -3.50464]],
  co: [[40.99025, -11.50543], [45.11424, -5.5838]],
  ma: [[38.01997, -6.58081], [42.141, -0.89539]],
  ml: [[34.41597, -7.36359], [38.57608, -1.94733]],
  mu: [[36.09796, -3.95782], [40.23131, 1.56555]],
  pm: [[37.19314, -0.01648], [41.34589, 5.60577]],
  sa: [[41.27577, -9.25049], [45.40219, -3.36731]],
  se: [[35.51659, -9.06372], [39.65222, -3.63373]],
  ss: [[41.52084, -5.80353], [45.02311, 0.13184]],
  va: [[37.00705, -3.06793], [41.14246, 2.53235]],
  vd: [[39.83385, -7.61078], [43.9691, -1.70013]],
  za: [[39.54641, -3.47992], [43.68375, 2.35657]],
};
