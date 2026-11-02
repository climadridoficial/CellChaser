import { expect, test } from 'bun:test';
import { stormVelocityScan } from './storm-velocity';

const dbz={href:'dbz',time:'2026-11-02T21:20:00Z',level:0.5,doppler:false,products:['DBZH']};
const vrad={href:'velocity',time:'2026-11-02T21:17:00Z',level:0.5,doppler:false,products:['VRADH']};
test('staggered Barcelona Doppler is discovered by quantity, not the range flag',()=>{
  expect(stormVelocityScan([dbz,vrad],dbz)).toBe(vrad);
});
test('newest earlier same-elevation measurement wins independent of catalogue order',()=>{
  const earlier={...vrad,time:'2026-11-02T21:15:00Z'};
  expect(stormVelocityScan([earlier,vrad],dbz)).toBe(vrad);
  expect(stormVelocityScan([vrad,earlier],dbz)).toBe(vrad);
});
test('future, older than five minutes, and other-elevation VRAD cannot be used',()=>{
  for (const scan of [{...vrad,time:'2026-11-02T21:21:00Z'},{...vrad,time:'2026-11-02T21:14:59Z'},{...vrad,level:1.5}]) expect(stormVelocityScan([scan],dbz)).toBeNull();
});