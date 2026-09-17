import { expect, it } from 'vitest';
import { restoreSettings } from '../src/storage';
import type { Score } from '../src/types';
const score={bpm:90,measures:[{},{}],staves:['1','2']}as Score;
it('stellt gültige gespeicherte Einstellungen wieder her und begrenzt beschädigte Werte',()=>{
  expect(restoreSettings({bpm:120,hand:'left',rightStaff:0,leftStaff:1,loop:true,from:1,to:1},score)).toEqual({bpm:120,hand:'left',rightStaff:0,leftStaff:1,loop:true,from:1,to:1});
  expect(restoreSettings({bpm:999,rightStaff:8,leftStaff:-1,from:99,to:-10},score)).toEqual({bpm:240,hand:'both',rightStaff:1,leftStaff:0,loop:false,from:1,to:1});
});
