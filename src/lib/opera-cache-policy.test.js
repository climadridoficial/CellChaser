import { expect, test } from 'bun:test';
import { operaTarget, operaRetrySeconds, operaCacheTtl } from './opera-cache-policy';

test('nearby queries share minute windows without hiding the newest observation', () => {
  const a = operaTarget('https://api.meteogate.eu/collections/observations/locations/station?format=ODIM&datetime=2026-11-02T13:01:01Z/2026-11-02T14:31:01Z');
  const b = operaTarget('https://api.meteogate.eu/collections/observations/locations/station?datetime=2026-11-02T13:01:20Z/2026-11-02T14:31:20Z&format=ODIM');
  expect(a.href).toBe(b.href);
  expect(a.searchParams.get('datetime')).toBe('2026-11-02T13:01:00Z/2026-11-02T14:32:00Z');
});
test('both Retry-After formats delay new requests and absent headers wait one minute', () => {
  expect(operaRetrySeconds('120')).toBe(120);
  expect(operaRetrySeconds('Mon, 02 Nov 2026 14:35:00 GMT', Date.parse('2026-11-02T14:33:00Z'))).toBe(120);
  expect(operaRetrySeconds(null)).toBe(60);
});
test('volumes are reusable for the three-hour slider but failures are never fresh data', () => {
  const volume = operaTarget('https://s3.waw3-1.cloudferro.com/scan.h5');
  expect(operaCacheTtl(volume, 200)).toBe(10800);
  expect(operaCacheTtl(volume, 429)).toBe(0);
  expect(operaCacheTtl(volume, 204)).toBe(20);
});
test('untrusted schemes, credentials, hosts and overlong time windows are rejected', () => {
  for (const url of ['http://api.meteogate.eu/file', 'https://user:pass@api.meteogate.eu/file', 'https://evil.example/file', 'https://api.meteogate.eu/file?datetime=2026-11-01T00:00:00Z/2026-11-03T00:00:00Z']) expect(() => operaTarget(url)).toThrow();
});