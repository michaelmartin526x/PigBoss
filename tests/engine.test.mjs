import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GameEngine } from '../engine/game-engine.js';
import { createRules, evaluateSpin, evaluateFeatureSpin } from '../engine/rules.js';
import { seededRandom } from '../engine/random.js';
const reels=JSON.parse(fs.readFileSync(new URL('../reels.json',import.meta.url),'utf8'));

test('known line, collector and scatter awards',()=>{
  const allA=Array.from({length:4},()=>Array(4).fill('A'));
  assert.equal(evaluateSpin('A',allA).totalWin,30);
  const matrix=Array.from({length:4},()=>Array(4).fill('F'));
  matrix[0][0]='W';matrix[1][0]='Z';matrix[2][0]='R';
  assert.equal(evaluateSpin('C',matrix).collectorAmount,21);
  matrix[3][0]='W';
  assert.equal(evaluateFeatureSpin('FA',matrix).collectorAmount,42);
  assert.equal(evaluateSpin('A',matrix).freeSpins,15);
});
test('repeatable results; malformed reels fail before play',()=>{
  const a=createRules(reels,seededRandom(23)),b=createRules(reels,seededRandom(23));
  for(let i=0;i<100;i++)assert.deepEqual(a.resolve(),b.resolve());
  assert.throws(()=>createRules({...reels,reelA1:['missing']}),/Invalid reel/);
});
test('award settled before presentation; input locked and completion idempotent',()=>{
  const engine=new GameEngine(reels,{random:seededRandom(5)});engine.enterBase();
  const r=engine.beginBase();
  assert.equal(engine.creditCents,100000-100+r.awardCents);
  assert.equal(engine.paidSpins,1);
  assert.equal(engine.beginBase(),null);
  assert.equal(engine.completeBase(r.id+1),false);
  assert.equal(engine.completeBase(r.id),true);
  assert.equal(engine.completeBase(r.id),false);
  assert.equal(engine.creditCents,100000-100+r.awardCents);
  assert.throws(()=>{r.matrix[0][0]='W'},TypeError);
});
test('trigger transition blocks a second paid spin throughout entry delay',()=>{
  const engine=new GameEngine(reels);engine.enterBase();
  const r=engine.beginBase({forced:true});assert.equal(r.result.freeSpins,15);
  engine.completeBase(r.id);
  assert.equal(engine.state,'FEATURE_TRANSITION');
  assert.equal(engine.beginBase(),null);assert.equal(engine.startFeature(),false);
  engine.showFeatureEntry();assert.equal(engine.beginBase(),null);
  engine.startFeature();assert.equal(engine.beginBase(),null);
});
test('entire forced feature is excluded from real balance and session RTP',()=>{
  const engine=new GameEngine(reels,{random:seededRandom(9)});engine.enterBase();
  engine.completeBase(engine.beginBase({forced:true}).id);engine.showFeatureEntry();engine.startFeature();
  for(let i=0;i<15;i++){
    const r=engine.beginFeatureSpin();assert.ok(r);
    assert.equal(engine.beginFeatureSpin(),null);
    assert.equal(engine.completeFeatureSpin(r.id),true);
    assert.equal(engine.completeFeatureSpin(r.id),false);
  }
  assert.equal(engine.state,'FEATURE_COMPLETE');
  assert.equal(engine.creditCents,100000);assert.equal(engine.paidSpins,0);
  assert.equal(engine.totalStakedCents,0);assert.equal(engine.totalReturnedCents,0);
  assert.equal(engine.finishFeature(),true);assert.equal(engine.finishFeature(),false);
});
test('natural feature credits exactly once without requiring completion-screen input',()=>{
  // random=0 picks A and stop 0 on every reel: natural four-scatter trigger.
  const engine=new GameEngine(reels,{random:()=>0,stakeCents:125});engine.enterBase();
  const base=engine.beginBase();engine.completeBase(base.id);engine.showFeatureEntry();engine.startFeature();
  let expected=100000-125+base.awardCents;
  while(engine.state==='FREE_SPINS'){
    const r=engine.beginFeatureSpin();expected+=r.awardCents;
    assert.equal(engine.creditCents,expected);engine.completeFeatureSpin(r.id);
  }
  assert.equal(engine.creditCents,expected);assert.equal(engine.totalStakedCents,125);
  assert.equal(engine.totalReturnedCents,expected-100000+125);
  engine.finishFeature();assert.equal(engine.creditCents,expected);
});
test('insufficient funds and wrong-state requests leave the ledger unchanged',()=>{
  const e=new GameEngine(reels,{creditCents:99});
  assert.equal(e.beginBase(),null);e.enterBase();assert.equal(e.beginBase(),null);
  assert.equal(e.creditCents,99);assert.equal(e.paidSpins,0);
  assert.equal(e.beginFeatureSpin(),null);
});
