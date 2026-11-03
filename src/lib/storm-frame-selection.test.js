import { expect, test } from 'bun:test';
import { selectStormFrame } from './storm-frame-selection';

const now=Date.parse('2026-11-03T00:14:00Z'), maxAge=20*60_000;
const previous={radar_id:'0-724-0-esgld',source:'opera',observed_at:'2026-11-03T00:00:00Z',algorithm_version:4,tracks:[{forecast:[[1,2],[2,3],[3,4],[4,5]]}]};
const select=(frames,at=null,unavailable=false)=>selectStormFrame(frames,previous.radar_id,'opera',at,maxAge,now,unavailable);
test('advisory-only rollout preserves fresh version 4 forecasts while version 5 jobs are pending',()=>{
  expect(select([previous])).toBe(previous);
  expect(select([previous]).tracks[0].forecast).toHaveLength(4);
});
test('version 5 takes precedence including an empty detection result',()=>{
  const current={...previous,algorithm_version:5,tracks:[]};
  expect(select([previous,current])).toBe(current);
});
test('old intensity version 3 is never restored',()=>{
  expect(select([{...previous,algorithm_version:3}])).toBeUndefined();
});
test('compatible frames cannot bypass live expiry or failed-source rules',()=>{
  expect(select([{...previous,observed_at:'2026-11-02T23:50:00Z'}])).toBeUndefined();
  expect(select([previous],null,true)).toBeUndefined();
});
test('compatible history stays in its own ten-minute slot',()=>{
  expect(select([previous],Date.parse('2026-11-03T00:00:00Z'),true)).toBe(previous);
  expect(select([previous],Date.parse('2026-11-02T23:30:00Z'))).toBeUndefined();
});