import { boundsOfCorners, cornersFromBounds, type Corners, type RadarBounds } from "./aemet-overlay";

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
const BOX_CALIBRATION: Record<string, RadarBounds> = {
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

/**
 * Free four-corner alignments [NW, NE, SE, SW] as [lat, lon] (rotation/stretch),
 * copied from the owner's saved alignments (30 Oct 2026). am and ss keep the box.
 */
const CORNER_CALIBRATION: Record<string, Corners> = {
  ba: [[43.40305, -1.09314], [43.41103, 4.83124], [39.25778, 4.6637], [39.28329, -0.90637]],
  ca: [[30.03106, -18.09174], [30.00133, -13.12866], [25.89135, -13.25226], [25.88641, -18.03406]],
  cc: [[41.43037, -9.1983], [41.41802, -3.43597], [37.32976, -3.59665], [37.27842, -9.04724]],
  co: [[45.13943, -11.54388], [45.16848, -5.48767], [41.0255, -5.6662], [41.04207, -11.4093]],
  ma: [[42.1634, -6.62476], [42.17155, -0.84595], [38.04377, -0.97778], [38.03079, -6.46545]],
  ml: [[38.5997, -7.43225], [38.59541, -1.89514], [34.52919, -2.06818], [34.50656, -7.24548]],
  mu: [[40.2418, -4.01001], [40.26066, 1.61774], [36.12678, 1.49689], [36.11347, -3.87268]],
  pm: [[41.35413, -0.06866], [41.36032, 5.60303], [37.19314, 5.60577], [37.21283, 0.05219]],
  sa: [[45.41388, -9.31641], [45.43701, -3.31512], [41.31082, -3.3783], [41.3232, -9.19556]],
  se: [[39.66914, -9.09668], [39.67548, -3.56781], [35.52999, -3.67218], [35.56575, -9.0033]],
  va: [[41.16625, -3.12561], [41.15177, 2.58728], [37.07928, 2.4527], [37.03325, -2.97729]],
  vd: [[44.00072, -7.59705], [44.02047, -1.63696], [39.8465, -1.7688], [39.85915, -7.43225]],
  za: [[43.70759, -3.52386], [43.70958, 2.39502], [39.59934, 2.2522], [39.59934, -3.3728]],
};

/** Corners for every calibrated radar (box radars become axis-aligned quads). */
export const AEMET_CORNERS: Record<string, Corners> = Object.fromEntries(
  Object.keys(BOX_CALIBRATION).map(code => [code, CORNER_CALIBRATION[code] ?? cornersFromBounds(BOX_CALIBRATION[code]!)]),
);

/** Axis-aligned map box enclosing each radar's corners (where the warped image is drawn). */
export const AEMET_CALIBRATION: Record<string, RadarBounds> = Object.fromEntries(
  Object.entries(AEMET_CORNERS).map(([code, c]) => [code, boundsOfCorners(c)]),
);
