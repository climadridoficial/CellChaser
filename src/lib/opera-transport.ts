/** An unavailable shared store is a service state, never an empty radar scan. */
export async function operaBrowserResponse(response: Response): Promise<Response> {
  if (response.status !== 503) return response;
  const message = await response.clone().text();
  if (message !== 'Shared radar cache unavailable') return response;
  return Response.json({ error: { code: 'OPERA_CACHE_UNAVAILABLE' } }, {
    headers: { 'X-OPERA-Unavailable': 'cache', 'Cache-Control': 'no-store' },
  });
}

export function assertOperaAvailable(response: Response): void {
  if (response.headers.get('X-OPERA-Unavailable') === 'cache') {
    throw new Error('OPERA shared cache unavailable');
  }
}