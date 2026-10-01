import * as THREE from 'three';
import { createSpinePresentation } from '../presentation/spine.js';
import { SPINE_SYMBOLS } from '../engine/config.js';
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-330,330,290,-290,.1,10);camera.position.z=5;
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(660,580);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
const slots=Array.from({length:4},()=>Array.from({length:6},()=>({style:{}})));
const manager=createSpinePresentation({scene,slots,getMatrix:()=>null});
await manager.init();
const grab=()=>{renderer.render(scene,camera);const canvas=document.createElement('canvas');canvas.width=165;canvas.height=145;const ctx=canvas.getContext('2d');ctx.fillStyle='black';ctx.fillRect(0,0,165,145);ctx.drawImage(renderer.domElement,0,0,165,145,0,0,165,145);return canvas;};
const data=canvas=>canvas.getContext('2d').getImageData(0,0,165,145).data;
const difference=(a,b)=>{let sum=0,pixels=0;for(let i=0;i<a.length;i+=4){const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));sum+=d;if(d>20)pixels++;}return {meanMaxChannelDifference:+(sum/(a.length/4)).toFixed(2),pixelsChangedOver20:pixels};};
const report=[];
for(const sym of SPINE_SYMBOLS){
  manager.resetToPng();
  const png=new Image();png.src=manager.reelSource(sym);await png.decode();
  const expected=document.createElement('canvas');expected.width=165;expected.height=145;const ctx=expected.getContext('2d');ctx.fillStyle='black';ctx.fillRect(0,0,165,145);ctx.drawImage(png,0,0);
  manager.showCell(0,0,sym,'land');const zero=grab();manager.update(.05);const advanced=grab();
  manager.flushPngHides();manager.update(.05);const animated=grab();
  report.push({symbol:sym,zero:difference(data(expected),data(zero)),firstFrame:difference(data(expected),data(advanced)),afterHandoff:difference(data(expected),data(animated))});
  const row=document.createElement('tr');const name=document.createElement('td');name.textContent=sym;row.append(name);
  for(const canvas of [expected,zero,advanced]){const cell=document.createElement('td'),img=new Image();img.src=canvas.toDataURL();cell.append(img);row.append(cell)}document.querySelector('#rows').append(row);
}
document.querySelector('#report').textContent=JSON.stringify(report,null,2);
