import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { LAYOUT, SPINE_SYMBOLS, GEM_SYMBOLS } from '../engine/config.js';

// Run the actual presentation controller with only the GPU boundary replaced.
// The separate browser visual test covers real Three.js/Spine pixel output.
const source=fs.readFileSync(new URL('../presentation/spine.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace('export function createSpinePresentation','function createSpinePresentation');
const factory=vm.runInNewContext(source+'\ncreateSpinePresentation',{
  LAYOUT,SPINE_SYMBOLS,CASH_SYMBOLS:GEM_SYMBOLS,performance,console,setTimeout,clearTimeout,
});
function setup(){
  const scene={add(mesh){mesh.parent=this},remove(mesh){mesh.parent=null}};
  const slots=Array.from({length:4},()=>Array.from({length:6},()=>({style:{opacity:'1'}})));
  const manager=factory({scene,slots,getMatrix:()=>null});
  manager.ready=true;manager.data.set('A',{});manager.data.set('R',{});manager.cashBackData={};
  manager.makeMesh=()=>{
    const mesh={visible:false,updates:[],state:{clearTracks(){},setAnimation(){},addAnimation(){}},skeleton:{color:{}},
      update(dt){this.updates.push(dt)},dispose(){},removeFromParent(){scene.remove(this)}};
    scene.add(mesh);return mesh;
  };
  manager.makeDataMesh=manager.makeMesh;
  manager.resetToPng();return {manager,slots,scene};
}
test('landing starts at authored t=0 even after a long render interval',()=>{
  const {manager,slots}=setup();manager.showCell(0,0,'A','land');
  const mesh=manager.cells[0][0].mesh;
  manager.update(.05);manager.update(.05);
  assert.deepEqual(mesh.updates,[0]);assert.equal(slots[0][1].style.opacity,'1');
  manager.flushPngHides();assert.equal(slots[0][1].style.opacity,'0');
  manager.update(.016);assert.deepEqual(mesh.updates,[0,.016]);
});
test('win dispatch waits for a rendered landing frame',async()=>{
  const {manager}=setup();manager.showCell(0,0,'A','land');let rendered=false;
  const pending=manager.whenLandingRendered().then(()=>{rendered=true});
  await Promise.resolve();assert.equal(rendered,false);
  manager.flushPngHides();await pending;assert.equal(rendered,true);
});
test('removed cells cannot leave a stale PNG hide behind',()=>{
  const {manager,slots}=setup();manager.showCell(0,0,'A','land');manager.removeCell(0,0);
  manager.flushPngHides();assert.equal(slots[0][1].style.opacity,'1');
});
test('late asset completion cannot change artwork or enable Spine midway through a spin',()=>{
  const {manager}=setup();manager.ready=false;manager.resetToPng();
  manager.ready=true;manager.landingSprites.set('R','data:matching-pose');
  assert.equal(manager.reelSource('R'),'assets/R.png');assert.equal(manager.showCell(0,0,'A'),false);
  manager.resetToPng();assert.equal(manager.reelSource('R'),'data:matching-pose');
  assert.equal(manager.showCell(0,0,'A'),true);
});
test('a missing matching cash pose retains the full PNG',()=>{
  const {manager,slots}=setup();assert.equal(manager.showCell(0,0,'R'),false);
  manager.flushPngHides();assert.equal(slots[0][1].style.opacity,'1');
  assert.equal(manager.showCell(0,0,'A'),true);
});
