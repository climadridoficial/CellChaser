// Stub only persistence transport; upstream requests still reach the test's mock.
export function withCacheRpc(upstream) {
  return async (url, init) => {
    const path = String(url);
    if (path.includes('/rest/v1/rpc/claim_opera_cache')) return Response.json({ kind: 'fetch' });
    if (path.includes('/rest/v1/rpc/finish_opera_cache')) return Response.json(null);
    return upstream(url, init);
  };
}