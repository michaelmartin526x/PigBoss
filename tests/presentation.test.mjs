import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioManager } from '../presentation/audio.js';
import { loadSkeletons } from '../presentation/load-skeletons.js';
import { anticipationPlan, anticipationDistance, presentationStrip, wrap } from '../presentation/motion.js';
import { createReelAnimator } from '../presentation/reels.js';
import { createRules } from '../engine/rules.js';
import fs from 'node:fs';

test('crossfades finish independently; mute and volume apply during a fade',async()=>{
  let time=0,queue=[];
  const audio=new AudioManager({now:()=>time,frame:cb=>queue.push(cb),createAudio:()=>({paused:true,volume:0,currentTime:0,play(){this.paused=false;return Promise.resolve()},pause(){this.paused=true}})});
  await audio.trySplashAmbient();await audio.enterBase();
  audio.setVolume(.5);audio.setMuted(true);
  assert.equal(audio.ambient.volume,0);assert.equal(audio.base.volume,0);
  time=1000;const pending=queue;queue=[];pending.forEach(cb=>cb(time));
  assert.equal(audio.ambient.paused,true);assert.equal(audio.ambient.volume,0);
  audio.setMuted(false);assert.equal(audio.base.volume,.29);
});
test('one bad skeleton or parse error does not disable valid symbols',async()=>{
  const {data,failures}=await loadSkeletons(['A','missing','bad','W'],async name=>{
    if(name==='missing')throw new Error('404');return {name};
  },json=>{if(json.name==='bad')throw new Error('invalid skeleton');return json});
  assert.deepEqual([...data.keys()],['A','W']);assert.equal(failures.length,2);
});
test('anticipation remains forward, lands exactly and joins at incoming velocity',()=>{
  for(const velocity of [.0018,.003,.009,.02,.1])for(const distance of [0,21.4,79.9]){
    const p=anticipationPlan(distance,velocity,1300);
    let previous=distance;
    for(let t=0;t<=1800;t++){const next=anticipationDistance(p,t);assert.ok(next>=previous-1e-10);previous=next}
    assert.equal(previous,p.targetDistance);
    const epsilon=.0001;
    const derivative=(anticipationDistance(p,1300+epsilon)-anticipationDistance(p,1300))/epsilon;
    assert.ok(Math.abs(derivative-velocity)<.000001);
  }
});
test('temporary anticipation landing presents the chosen symbols without altering real strips',()=>{
  const real=Array.from({length:80},(_,i)=>String(i)),before=real.slice(),symbols=['A','F','W','Z'];
  for(const start of [0,12,79])for(const target of [33,82,197]){
    const {strip,center}=presentationStrip(real,start,target,symbols);
    assert.deepEqual([0,1,2,3].map(r=>strip[wrap(center-1+r,80)]),symbols);
    assert.deepEqual(real,before);
  }
});
test('actual animator uses correct landing window in normal and anticipated spins',async()=>{
  const reels=JSON.parse(fs.readFileSync(new URL('../reels.json',import.meta.url),'utf8'));
  const {matrixFromStops}=createRules(reels);
  const originalRaf=globalThis.requestAnimationFrame,originalPerformance=globalThis.performance;
  try{
    for(const stops of [[0,0,0,0],[10,10,10,10],[79,79,79,79]]){
      let time=0,queue=[],landed=0;const visible=[];
      globalThis.performance={now:()=>time};globalThis.requestAnimationFrame=cb=>queue.push(cb);
      const columns=Array.from({length:4},()=>({classList:{add(){},remove(){},toggle(){}}}));
      const tracks=columns.map(()=>({style:{}}));
      const animate=createReelAnimator({reels,matrixFromStops,columns,tracks,report(){},
        fillTrack(c,strip,center){visible[c]=[0,1,2,3].map(r=>strip[wrap(center-1+r,strip.length)])},
        spineSymbols:{resetToPng(){},startAnticipationFx(){},stopAnticipationFx(){},landColumn(c,symbols){assert.deepEqual(visible[c],symbols);landed++}}});
      const pending=animate('A',stops);
      while(queue.length&&time<10000){time+=16;const frame=queue;queue=[];frame.forEach(cb=>cb(time))}
      await pending;assert.equal(landed,4);assert.deepEqual(visible,matrixFromStops('A',stops));
    }
  }finally{globalThis.requestAnimationFrame=originalRaf;globalThis.performance=originalPerformance}
});
