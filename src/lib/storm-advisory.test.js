import { expect,test } from 'bun:test';
import { buildStormAdvisory,velocityForCell,lightningForCell } from './storm-advisory';
import { confirmedStormTracks } from './storm-tracking';
import { saveStormFrame } from './storm-pipeline.server';
import { STORM_VERSION } from './storm-version';
import {stormAdvisoryText} from './storm-advisory-text';

const time=Date.parse('2026-11-01T00:00:00Z');
const cell={lat:40,lon:-3,dbz:50,radiusKm:4};
const grid={width:20,height:20,values:new Float32Array(400).fill(-12.5),bounds:[[39,-4],[41,-2]]};
const velocity={grid,time,level:0.5,quantity:'VRADH'};
test('VRAD keeps signed numerical velocity and valid disk coverage',()=>{
  expect(velocityForCell(cell,time,0.5,velocity)).toEqual({status:'available',coverage:100,medianMs:-12.5,quantity:'VRADH'});
});
test('mismatched times/elevations do not support a DBZ cell',()=>{
  expect(velocityForCell(cell,time+60_000,0.5,velocity).status).toBe('unavailable');
  expect(velocityForCell(cell,time,1.5,velocity).status).toBe('unavailable');
});
test('out of range and missing gates have different evidence states',()=>{
  expect(velocityForCell({...cell,lon:0},time,0.5,velocity).status).toBe('outOfRange');
  expect(velocityForCell(cell,time,0.5,{...velocity,grid:{...grid,values:new Float32Array(400).fill(NaN)}})).toEqual({status:'insufficient',coverage:0});
});
const lightning={period:{start:time-12*3600_000,end:time},pixels:[[50,50]],corners:[[41,-4],[41,-2],[39,-2],[39,-4]],width:100,height:100};
test('lightning matches only observed cell and uses printed two-hour interval, never counts',()=>{
  const result=lightningForCell(cell,time,lightning);
  expect(result).toEqual({status:'nearby',interval:{start:time-2*3600_000,end:time}});
  expect(lightningForCell({...cell,lon:-3.8},time,lightning).status).toBe('notDetected');
});
test('unknown, future and stale lightning never claim no strikes',()=>{
  expect(lightningForCell(cell,time,null).status).toBe('unknown');
  expect(lightningForCell(cell,time-1,lightning).status).toBe('unknown');
  expect(lightningForCell(cell,time+2*3600_000+1,lightning).status).toBe('unknown');
  expect(lightningForCell(cell,time+2*3600_000,lightning).status).toBe('nearby');
});
test('VRAD does not bypass three reflectivity scans or alter the forecast',()=>{
  const frames=[0,10,20].map(m=>({time:time+m*60_000,cells:[{...cell,lon:-3+m*0.008}]}));
  expect(confirmedStormTracks(frames.slice(0,2),'radar')).toEqual([]);
  const track=confirmedStormTracks(frames,'radar')[0];
  const before=JSON.stringify(track.forecast);
  const evidence=buildStormAdvisory(track,'opera',0.5,{...velocity,time:track.points.at(-1).time},lightning);
  expect(evidence.vrad.status).toBe('available');
  expect(JSON.stringify(track.forecast)).toBe(before);
  expect(buildStormAdvisory(track,'opera',0.5,{...velocity,time:track.points.at(-1).time},lightning)).toEqual(evidence);
});
test('all viewers receive identical advisory facts independent of invocation',()=>{
  const track={id:'test',points:[{...cell,time}],forecast:null,speedKmh:0,intensity:'veryStrong'};
  const a={...track,advisory:buildStormAdvisory(track,'opera',0.5,velocity,lightning)};
  const b=JSON.parse(JSON.stringify(a));
  expect(a.advisory).toEqual(b.advisory);
  expect(stormAdvisoryText(a,'es')).toEqual(stormAdvisoryText(b,'es'));
});
test('scheduled frame saves shared evidence with version and recomputes on new scan',async()=>{
  const rows=[],tracks=[];
  const client={from(table){
    if(table==='storm_cell_frames') return {async upsert(row){rows.push(row);return {error:null}},select(){const q={eq(){return q},gte(){return q},lte(){return q},async order(){return {data:rows,error:null}}};return q}};
    return {async upsert(row){tracks.push(row);return {error:null}}};
  }};
  for(const m of [0,10,20]) await saveStormFrame(client,'test','opera',new Date(time+m*60_000).toISOString(),[{...cell,lon:-3+m*0.008}],{level:0.5,velocity:{...velocity,time:time+m*60_000},lightning});
  expect(tracks[0].tracks).toEqual([]);
  const saved=tracks.at(-1);
  expect(saved.algorithm_version).toBe(STORM_VERSION);
  expect(saved.tracks).toHaveLength(1);
  expect(saved.tracks[0].advisory.vrad.status).toBe('available');
  expect(saved.tracks[0].forecast).toHaveLength(4);
});