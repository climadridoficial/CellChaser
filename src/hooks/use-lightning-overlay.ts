import type L from "leaflet";
import type { AemetMapImage, Corners } from "@/lib/aemet-overlay";
import { LIGHTNING_SIZE } from "@/lib/aemet-lightning";
import { useAemetMapOverlay } from "./use-aemet-map-overlay";

/** Draws the AEMET lightning map as a static quadrilateral above radar echoes. */
export function useLightningOverlay(mapRef: { current: L.Map | null }, value: AemetMapImage | null, onCorners: (corners: Corners) => void) {
  useAemetMapOverlay(mapRef, value, onCorners, LIGHTNING_SIZE, true);
}
