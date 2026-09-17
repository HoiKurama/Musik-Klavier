import { expect, it } from 'vitest';
import { parseMidiMessage } from '../src/midi';
it('verarbeitet Note-on/off auf verschiedenen Kanälen und Velocity null als Note-off',()=>{
  expect(parseMidiMessage([0x92,60,127])).toEqual({kind:'on',midi:60,velocity:1});
  expect(parseMidiMessage([0x93,60,0])).toEqual({kind:'off',midi:60,velocity:0});
  expect(parseMidiMessage([0x81,60,80])).toEqual({kind:'off',midi:60,velocity:0});
  expect(parseMidiMessage([0xb0,64,127])).toBeUndefined();
  expect(parseMidiMessage([0x90,10,127])).toBeUndefined();
  expect(parseMidiMessage([0x90,60])).toBeUndefined();
});
