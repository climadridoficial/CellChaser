import { operaCacheTtl, operaRetrySeconds } from './opera-cache-policy';

/**
 * Fallback when the shared backend cache is paused/unreachable: fetch OPERA
 * directly from this server instance, deduplicating in memory and honouring
 * provider cooldowns so the map keeps working without the database.
 */
type Entry = { status: number; contentType: string; bytes: Uint8Array<ArrayBuffer> | null; expires: number };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();
const cooldownUntil = new Map<string, number>();

export function resetDirectOpera(): void { cache.clear(); inflight.clear(); cooldownUntil.clear(); }

const respond = (entry: Entry, authorization: string | null | undefined, hit: boolean) => {
  if (entry.status === 429) {
    return new Response('OPERA temporarily busy', { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((entry.expires - Date.now()) / 1000))), 'Cache-Control': 'no-store' } });
  }
  if (entry.status !== 200 && entry.status !== 204) return new Response('Radar download unavailable', { status: entry.status >= 400 && entry.status <= 599 ? entry.status : 502 });
  const ttl = Math.max(0, Math.floor((entry.expires - Date.now()) / 1000));
  return new Response(entry.status === 204 ? null : entry.bytes, { status: entry.status, headers: {
    'Content-Type': entry.contentType,
    'Cache-Control': `${authorization ? 'private' : 'public'}, max-age=${Math.min(ttl, 300)}`,
    'X-OPERA-Cache': hit ? 'direct-hit' : 'direct',
  } });
};

export async function directOperaResponse(target: URL, authorization?: string | null): Promise<Response> {
  const key = `${authorization ?? ''}|${target.href}`;
  const host = `${target.hostname}|${authorization ?? ''}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expires > now) return respond(cached, authorization, true);
  const blocked = cooldownUntil.get(host);
  if (blocked && blocked > now) return respond({ status: 429, contentType: '', bytes: null, expires: blocked }, authorization, false);
  let pending = inflight.get(key);
  if (!pending) {
    pending = (async (): Promise<Entry> => {
      try {
        const response = await fetch(target.href, { redirect: 'manual', signal: AbortSignal.timeout(25_000), headers: authorization ? { Authorization: authorization } : {} });
        const status = response.status;
        const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
        if (status === 429) {
          const until = Date.now() + operaRetrySeconds(response.headers.get('retry-after')) * 1000;
          cooldownUntil.set(host, until);
          return { status, contentType, bytes: null, expires: until };
        }
        if (status !== 200 && status !== 204) return { status, contentType, bytes: null, expires: 0 };
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > 16 * 1024 * 1024) return { status: 502, contentType, bytes: null, expires: 0 };
        const entry = { status, contentType, bytes, expires: Date.now() + operaCacheTtl(target, status) * 1000 };
        if (entry.expires > Date.now()) {
          cache.set(key, entry);
          while (cache.size > 64) { const oldest = cache.keys().next().value; if (oldest === undefined) break; cache.delete(oldest); }
        }
        return entry;
      } catch {
        return { status: 502, contentType: '', bytes: null, expires: 0 };
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, pending);
  }
  return respond(await pending, authorization, false);
}
