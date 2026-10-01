import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRules } from '../engine/rules.js';
import { seededRandom } from '../engine/random.js';
import { evaluateSpin, evaluateFeatureSpin } from './reference-v0207.mjs';
const reels=JSON.parse(fs.readFileSync(new URL('../reels.json',import.meta.url),'utf8'));
test('20,000 sampled base/feature results match the original evaluator exactly',()=>{
  const rules=createRules(reels,seededRandom(20260929));
  for(let i=0;i<20000;i++){
    const feature=i%2===1,record=rules.resolve(feature);
    const expected=feature?evaluateFeatureSpin(record.mode,record.matrix):evaluateSpin(record.mode,record.matrix);
    assert.deepEqual(record.result,expected);
  }
});
