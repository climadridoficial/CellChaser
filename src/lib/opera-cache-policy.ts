const HOSTS = new Set(['s3.waw3-1.cloudferro.com', 'api.meteogate.eu', 'radar.meteogate.eu']);

export function operaTarget(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !HOSTS.has(url.hostname) || url.username || url.password || url.port) throw new Error('Untrusted radar host');
  url.hash = '';
  const datetime = url.searchParams.get('datetime');
  if (datetime) {
    const parts = datetime.split('/').map(Date.parse);
    if (parts.length !== 2 || parts.some(t => !Number.isFinite(t))) throw new Error('Invalid radar time window');
    // Expand rather than truncate: the caller still applies observation freshness.
    const start = parts[0], end = parts[1];
    if (start === undefined || end === undefined || end < start || end - start > 25 * 3600_000) throw new Error('Invalid radar time window');
    const iso = (t: number) => new Date(t).toISOString().replace('.000Z', 'Z');
    url.searchParams.set('datetime', `${iso(Math.floor(start / 60_000) * 60_000)}/${iso(Math.ceil(end / 60_000) * 60_000)}`);
  }
  url.searchParams.sort();
  return url;
}

export function operaCacheTtl(url: URL, status: number): number {
  if (status === 204) return 20;
  if (status !== 200) return 0;
  if (url.pathname.endsWith('/locations')) return 300;
  if (url.hostname === 'api.meteogate.eu' && url.pathname.includes('/collections/')) return 60;
  return 3 * 3600;
}

export function operaRetrySeconds(value: string | null, now = Date.now()): number {
  const seconds = value && /^\d+$/.test(value) ? Number(value) : value ? (Date.parse(value) - now) / 1000 : 60;
  return Math.max(1, Math.min(3600, Math.ceil(Number.isFinite(seconds) ? seconds : 60)));
}