import {expect,test} from 'bun:test';
import {calibratedGate} from './storm-grid';
test('ODIM velocity gain/offset preserve signed values and nodata/undetect transparency',()=>{
  expect(calibratedGate(80,0.5,-50,255,0)).toBe(-10);
  expect(calibratedGate(120,0.5,-50,255,0)).toBe(10);
  expect(calibratedGate(255,0.5,-50,255,0)).toBeNaN();
  expect(calibratedGate(0,0.5,-50,255,0)).toBeNaN();
  expect(calibratedGate(120,NaN,-50,255,0)).toBeNaN();
});