import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { operaTarget, operaCacheTtl, operaRetrySeconds } from './opera-cache-policy';

type Claim = { kind: 'hit' | 'fetch' | 'wait' | 'blocked'; body?: string; contentType?: string; status?: number; retryAt?: string };
const bytesToBase64 = (bytes: Uint8Array) => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
};
const retry = (seconds: number) => new Response('OPERA temporarily busy', { status: 429, headers: { 'Retry-After': String(seconds), 'Cache-Control': 'no-store' } });

/** Persisted leases/cooldowns coordinate all instances, not just this process. */
export async function sharedOperaResponse(raw: string, authorization?: string | null, requestOrigin?: string): Promise<Response> {
  const target = operaTarget(raw);
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const backend = process.env['SUPABASE_URL'] || import.meta.env['VITE_SUPABASE_URL'];
  if (!key || !backend) {
    // External deployments share the managed cache, not a new anonymous ORD quota.
    const origin = process.env['OPERA_CACHE_ORIGIN'] || 'https://cellchaser.lovable.app';
    if (requestOrigin === new URL(origin).origin) return new Response('Shared radar cache unavailable', { status: 503 });
    return fetch(`${origin}/api/public/odim?url=${encodeURIComponent(target.href)}`, {
      headers: authorization ? { authorization } : {}, redirect: 'manual', signal: AbortSignal.timeout(30_000),
    });
  }
  const client = createClient<Database>(backend, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
    headers.set('apikey', key);
    return fetch(input, { ...init, headers });
  } } });
  const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, '0')).join('');
  const scope = authorization ? await digest(authorization) : 'anonymous';
  const cacheKey = await digest(`${scope}:${target.href}`);
  const host = `${target.hostname}:${scope}`;
  const token = crypto.randomUUID();
  const deadline = Date.now() + 4000;
  let claim: Claim;
  while (true) {
    const result = await client.rpc('claim_opera_cache', { p_key: cacheKey, p_host: host, p_token: token });
    if (result.error) return new Response('Shared radar cache unavailable', { status: 503 });
    claim = result.data as unknown as Claim;
    if (claim.kind !== 'wait') break;
    if (Date.now() >= deadline) return retry(2);
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  if (claim.kind === 'blocked') return retry(operaRetrySeconds(claim.retryAt ?? null));
  if (claim.kind === 'hit' && claim.body !== undefined) {
    const bytes = Uint8Array.from(atob(claim.body), c => c.charCodeAt(0));
    return new Response(claim.status === 204 ? null : bytes, { status: claim.status ?? 200, headers: {
      'Content-Type': claim.contentType ?? 'application/octet-stream',
      'Cache-Control': authorization ? 'private, max-age=60' : 'public, max-age=60', 'X-OPERA-Cache': 'hit',
    } });
  }
  let status = 502, contentType = 'application/octet-stream', body: string | null = null, ttl = 0, cooldown = 0;
  let bytes: Uint8Array<ArrayBuffer> | undefined;
  try {
    const response = await fetch(target.href, { redirect: 'manual', signal: AbortSignal.timeout(25_000), headers: authorization ? { Authorization: authorization } : {} });
    status = response.status;
    contentType = response.headers.get('content-type') ?? contentType;
    if (status === 429) cooldown = operaRetrySeconds(response.headers.get('retry-after'));
    else if (status >= 500) cooldown = 15;
    if (status === 200 || status === 204) {
      if (Number(response.headers.get('content-length')) > 16 * 1024 * 1024) throw new Error('Radar response too large');
      bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 16 * 1024 * 1024) throw new Error('Radar response too large');
      if (contentType.includes('json') && status !== 204) JSON.parse(new TextDecoder().decode(bytes));
      body = bytesToBase64(bytes);
      ttl = operaCacheTtl(target, status);
    }
  } catch { status = 502; body = null; bytes = undefined; cooldown = 15; }
  const saved = await client.rpc('finish_opera_cache', { p_key: cacheKey, p_token: token, p_body: body ?? '', p_type: contentType, p_status: status, p_ttl: ttl, p_host: host, p_retry: cooldown });
  if (saved.error) return new Response('Shared radar cache unavailable', { status: 503 });
  if (status === 429) return retry(cooldown);
  if (status !== 200 && status !== 204) return new Response('Radar download unavailable', { status: status >= 400 && status <= 599 ? status : 502 });
  return new Response(status === 204 ? null : bytes, { status, headers: {
    'Content-Type': contentType, 'Cache-Control': authorization ? `private, max-age=${ttl}` : `public, max-age=${Math.min(ttl, 300)}`, 'X-OPERA-Cache': 'miss',
  } });
}