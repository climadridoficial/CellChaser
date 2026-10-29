import { IBERIA, type RadarStation } from "./ord";
import type { CompositeMode } from "./composite";

/** Imagery visibility never controls tracking targets. */
export function stormTargets(stations: RadarStation[], selectedId: string|null): string[] {
  return selectedId ? [selectedId] : stations.filter(s=>IBERIA.includes(s.country.replace(/^0+/,""))).map(s=>s.id).sort();
}
export function stormSource(mode: CompositeMode): "auto"|"opera"|"aemet" {
  return mode==="opendata"?"aemet":mode==="opera"?"opera":"auto";
}