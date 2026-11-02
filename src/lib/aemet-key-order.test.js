import {expect,test} from 'bun:test';
import {aemetKeyOrder,aemetPriorityKeys} from './aemet-key-order';
// Synthetic labels only: real credentials never enter tests or output.
test('all five case-sensitive Vercel names are recognized and rotated before backups',()=>{
  const priority=aemetPriorityKeys({Opendata1:'one',Opendata2:'two',Opendata3:'three',Opendata4:'four',Opendata5:'five'});
  expect(priority).toEqual(['one','two','three','four','five']);
  for(let i=0;i<5;i++){
    const order=aemetKeyOrder(priority,['backup'],i);
    expect(order[0]).toBe(priority[i]);
    expect(order[5]).toBe('backup');
  }
});
test('original priority names remain supported when Vercel aliases are absent',()=>{
  expect(aemetPriorityKeys({AEMET_PRIORITY_KEY_1:'old-one',AEMET_PRIORITY_KEY_2:'old-two',AEMET_PRIORITY_KEY_3:'old-three'})).toEqual(['old-one','old-two','old-three','','']);
  expect(aemetPriorityKeys({Opendata1:'new-one',AEMET_PRIORITY_KEY_1:'old-one'} )[0]).toBe('new-one');
});
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