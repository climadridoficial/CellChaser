import {expect,test} from 'bun:test';
import {aemetKeyOrder} from './aemet-key-order';
// Synthetic labels only: real credentials never enter tests or output.
test('three preferred credentials always precede legacy backups and optional override',()=>{
  for(let i=0;i<6;i++){
    const order=aemetKeyOrder(['new-a','new-b','new-c'],['old-a','old-b'],i,'custom');
    expect(new Set(order.slice(0,3))).toEqual(new Set(['new-a','new-b','new-c']));
    expect(order.slice(3)).toContain('old-a');
    expect(order.slice(3)).toContain('custom');
  }
});
test('preferred credentials rotate so one key does not take every request',()=>{
  expect([0,1,2].map(i=>aemetKeyOrder(['a','b','c'],['d'],i)[0])).toEqual(['a','b','c']);
});
test('missing preferred keys preserve legacy support and duplicates are removed',()=>{
  expect(aemetKeyOrder(['',' a '],['a','b'],0)).toEqual(['a','b']);
  expect(aemetKeyOrder([],['b','c'],1)).toEqual(['c','b']);
});