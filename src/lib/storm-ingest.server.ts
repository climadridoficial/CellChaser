import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

/** Fetch health and processing health are distinct: a processing error is not a radar outage. */
export async function ingestStormSource<T, R>(client: SupabaseClient<Database>, radarId: string, source: 'aemet' | 'opera', load: () => Promise<T>, process: (input: T) => Promise<R>): Promise<R> {
  let input: T;
  try {
    input = await load();
  } catch (error) {
    const state = await client.from('storm_source_state').upsert({ radar_id: radarId, source, available: false, checked_at: new Date().toISOString() });
    if (state.error) throw state.error;
    throw error;
  }
  const state = await client.from('storm_source_state').upsert({ radar_id: radarId, source, available: true, checked_at: new Date().toISOString() });
  if (state.error) throw state.error;
  return process(input);
}

/** Workers support manual redirects; reject every redirect rather than following an unchecked host. */
export async function fetchStormVolume(href: string): Promise<ArrayBuffer> {
  const url = new URL(href);
  if (url.protocol !== 'https:' || !['s3.waw3-1.cloudferro.com', 'api.meteogate.eu', 'radar.meteogate.eu'].includes(url.hostname)) throw new Error('Untrusted radar host');
  const { sharedOperaResponse } = await import('./opera-cache.server');
  const response = await sharedOperaResponse(url.href);
  if (!response.ok) throw new Error('Radar download unavailable');
  return response.arrayBuffer();
}