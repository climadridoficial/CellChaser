// ODIM 2.4 ranges are metres; previous ODIM versions used kilometres.
export function rangeStartMetres(value: number, conventions: string): number {
  const version = /V2[_\.](\d+)/i.exec(conventions);
  if (!version) throw new Error(`Unsupported ODIM convention: ${conventions}`);
  return value * (Number(version[1]) >= 4 ? 1 : 1000);
}

const EARTH = 6378137;
const RAD = Math.PI / 180;
export function mercatorY(lat: number): number {
  return EARTH * Math.log(Math.tan(Math.PI / 4 + lat * RAD / 2));
}
export function latitudeFromY(y: number): number {
  return (2 * Math.atan(Math.exp(y / EARTH)) - Math.PI / 2) / RAD;
}
export function polarAt(lat: number, lon: number, stationLat: number, stationLon: number) {
  const p1 = stationLat * RAD;
  const p2 = lat * RAD;
  const dl = (lon - stationLon) * RAD;
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const distance = 2 * EARTH * Math.asin(Math.sqrt(Math.min(1, a)));
  const bearing = (Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / RAD + 360) % 360;
  return { distance, bearing };
}

export function rayLookup(nrays: number, starts?: ArrayLike<number>, stops?: ArrayLike<number>): Int32Array {
  const lookup = new Int32Array(3600).fill(-1);
  if (!starts || !stops || starts.length !== nrays || stops.length !== nrays) {
    for (let i = 0; i < lookup.length; i++) lookup[i] = Math.floor(i / lookup.length * nrays);
    return lookup;
  }
  for (let ray = 0; ray < nrays; ray++) {
    const start = starts[ray];
    const stop = stops[ray];
    if (start === undefined || stop === undefined) continue;
    const width = (stop - start + 360) % 360;
    for (let i = Math.ceil(start * 10); i < (start + width) * 10; i++) {
      lookup[((i % 3600) + 3600) % 3600] = ray;
    }
  }
  return lookup;
}