import test from 'node:test';
import assert from 'node:assert/strict';
import { loadReelSprites } from '../presentation/reel-sprites.js';

test('moving slots replace pixels synchronously and reuse decoded artwork', async () => {
  const assets = new Map();
  const renderer = await loadReelSprites(['A','B'], {loadImage: async src => {
    const image = {src}; assets.set(src,image); return image;
  }});
  const calls=[];
  const canvas={width:165,height:145,dataset:{},getContext:()=>({
    clearRect:()=>calls.push('clear'), drawImage:image=>calls.push(image)
  })};
  renderer.draw(canvas,'A'); renderer.draw(canvas,'A');
  assert.deepEqual(calls,['clear',assets.get('assets/A.png')]);
  renderer.draw(canvas,'B');
  assert.equal(calls.at(-1),assets.get('assets/B.png'));
  assert.equal(canvas.dataset.symbol,'B');
  renderer.draw(canvas,'B',true);
  assert.equal(calls.at(-1),assets.get('assets/blur/B_blur.png'));
  const pose={pose:true}; renderer.draw(canvas,'B',false,pose);
  assert.equal(calls.at(-1),pose);
});

test('missing optional blur uses sharp artwork; missing sharp artwork fails loading', async () => {
  const sharp={};
  const renderer=await loadReelSprites(['A'],{loadImage:async src=>{
    if(src.includes('/blur/'))throw Error('missing blur');return sharp;
  }});
  let painted;
  renderer.draw({width:165,height:145,dataset:{},getContext:()=>({clearRect(){},drawImage(image){painted=image}})},'A',true);
  assert.equal(painted,sharp);
  await assert.rejects(loadReelSprites(['A'],{loadImage:async()=>{throw Error('missing')}}));
});
