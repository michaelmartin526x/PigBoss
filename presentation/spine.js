import * as THREE from 'three';
import * as spine from 'spine-threejs';
import { SPINE_SYMBOLS, GEM_SYMBOLS as CASH_SYMBOLS, LAYOUT } from '../engine/config.js';
import { loadSkeletons } from './load-skeletons.js';

export function createSpinePresentation({scene, slots, getMatrix}) {
const landingImages=new Map();
let spinImages=new Map();
const VIEW_W=LAYOUT.columns*LAYOUT.cellWidth, VIEW_H=LAYOUT.rows*LAYOUT.cellHeight;
const pendingPngHides=new Map();
const landingFrameWaiters=[];
function queuePngHide(img,cell){if(img)pendingPngHides.set(img,cell)}
function flushPngHides(){
  for(const [img,cell] of pendingPngHides){
    if(cell.mesh.parent===scene&&cell.mesh.visible){
      img.style.opacity='0';
      cell.awaitingFirstRender=false;
    }
  }
  pendingPngHides.clear();
  for(const resolve of landingFrameWaiters.splice(0))resolve();
}
function setRenderLayer(obj,order,z=null){if(!obj)return;if(z!==null)obj.position.z=z;obj.renderOrder=order;obj.traverse?.(child=>{child.renderOrder=order;if(child.material){child.material.depthTest=false;child.material.depthWrite=false;child.material.transparent=true}})}

class SpineSymbolManager{
  constructor(){this.ready=false;this.spinReady=false;this.landingSprites=new Map();this.spinSprites=new Map();this.data=new Map();this.cells=Array.from({length:LAYOUT.columns},()=>Array(LAYOUT.rows).fill(null));this.assetManager=null;this.last=performance.now();this.eventLog=[];this.lastError='';this.cellErrors=[];this.focusTimer=null;this.fxData=null;this.anticipationFx=null;this.anticipationReel=-1;}
  async init(){
    try {
      this.assetManager = new spine.AssetManager('assets/spine/');
      await this.assetManager.loadTextureAtlasAsync('Symbols.atlas');
      const loader = new spine.AtlasAttachmentLoader(this.assetManager.require('Symbols.atlas'));
      const loaded = await loadSkeletons([...SPINE_SYMBOLS,'cashBack','fx_anticipation'],
        async name => { await this.assetManager.loadJsonAsync(name+'.json'); return this.assetManager.require(name+'.json'); },
        json => { const parser=new spine.SkeletonJson(loader); parser.scale=1; return parser.readSkeletonData(json); });
      this.cashBackData=loaded.data.get('cashBack');
      this.fxData=loaded.data.get('fx_anticipation');
      loaded.data.delete('cashBack'); loaded.data.delete('fx_anticipation');
      this.data=loaded.data;
      this.missingAssets=loaded.failures;
      this.lastError=loaded.failures.join('; ');
      try{await this.prepareLandingSprites()}
      catch(error){
        // Failing to make an optional cached pose must not disable the other
        // skeletons. Cash/W keep their complete PNG in this fallback case.
        this.lastError+=(this.lastError?'; ':'')+'LANDING SPRITES: '+error.message;
      }
      this.ready=this.data.size>0;
      return this.ready;
    } catch(err) {
      console.error('Spine atlas unavailable; retaining PNGs.',err);
      this.lastError='INIT: '+(err?.message||err); this.ready=false; return false;
    }
  }
  async prepareLandingSprites(){
    // Most original PNGs exactly match their atlas region. The split cash/W
    // skeletons do not. Cache their actual authored t=0 pose once, so the sharp
    // reel sprite and the first landed mesh depict exactly the same artwork.
    const rasterizer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    rasterizer.setPixelRatio(1);rasterizer.setSize(LAYOUT.cellWidth,LAYOUT.cellHeight);
    rasterizer.setClearColor(0,0);rasterizer.outputColorSpace=THREE.SRGBColorSpace;
    const rasterScene=new THREE.Scene();
    const camera=new THREE.OrthographicCamera(-LAYOUT.cellWidth/2,LAYOUT.cellWidth/2,LAYOUT.cellHeight/2,-LAYOUT.cellHeight/2,.1,10);camera.position.z=5;
    const pending=[];
    try{
      for(const sym of [...CASH_SYMBOLS,'W']){
        if(!this.data.has(sym)||(CASH_SYMBOLS.has(sym)&&!this.cashBackData))continue;
        let cell;
        try{
          cell=this.buildCell(0,0,sym,'land');
          cell.mesh.position.x=cell.mesh.position.y=0;rasterScene.add(cell.mesh);
          if(cell.backMesh){cell.backMesh.position.x=cell.backMesh.position.y=0;rasterScene.add(cell.backMesh)}
          rasterizer.render(rasterScene,camera);
          const image=new Image();image.src=rasterizer.domElement.toDataURL('image/png');
          pending.push(image.decode().then(()=>{this.landingSprites.set(sym,image.src);landingImages.set(sym,image)}).catch(error=>{this.cellErrors.push(`LANDING SPRITE ${sym}: ${error.message}`)}));
        }catch(error){this.cellErrors.push(`LANDING SPRITE ${sym}: ${error.message}`)}
        finally{if(cell)for(const mesh of [cell.mesh,cell.backMesh])if(mesh){mesh.removeFromParent();mesh.dispose?.()}}
      }
      await Promise.all(pending);
    }finally{rasterizer.dispose();rasterizer.forceContextLoss()}
  }
  reelSource(sym){return this.spinSprites.get(sym)||`assets/${sym}.png`}
  reelImage(sym){return spinImages.get(sym)||null}
  whenLandingRendered(){
    if(!pendingPngHides.size)return Promise.resolve();
    return new Promise(resolve=>landingFrameWaiters.push(resolve));
  }
  buildCell(c,r,sym,animation){
    const mesh=this.makeMesh(sym,c,r);
    let backMesh=null;
    try{
      mesh.visible=true;mesh.state.clearTracks();
      mesh.state.setAnimation(0,animation,false);mesh.state.addAnimation(0,'idle',true,0);mesh.update(0);
      if(CASH_SYMBOLS.has(sym)&&this.cashBackData){
        backMesh=this.makeDataMesh(this.cashBackData,c,r,-.001);
        backMesh.state.clearTracks();backMesh.state.setAnimation(0,animation,false);backMesh.state.addAnimation(0,'idle',true,0);backMesh.update(0);
      }
      return {mesh,backMesh,sym,brightness:1,targetBrightness:1,awaitingFirstRender:true};
    }catch(error){for(const item of [mesh,backMesh])if(item){item.removeFromParent();item.dispose?.()}throw error}
  }
  makeDataMesh(skeletonData,c,r,z=-0.0002){
    let mesh;
    try{mesh=new spine.SkeletonMesh({skeletonData,twoColorTint:false,materialFactory:(parameters)=>{parameters.depthTest=false;parameters.depthWrite=false;parameters.transparent=true;return new THREE.MeshBasicMaterial(parameters)}})}
    catch(_){mesh=new spine.SkeletonMesh(skeletonData,(parameters)=>{parameters.depthTest=false;parameters.depthWrite=false;parameters.transparent=true})}
    mesh.position.set(-VIEW_W/2+LAYOUT.cellWidth/2+c*LAYOUT.cellWidth,VIEW_H/2-LAYOUT.cellHeight/2-r*LAYOUT.cellHeight,z);mesh.zOffset=z;mesh.visible=true;scene.add(mesh);return mesh;
  }
  makeMesh(sym,c,r){
    const skeletonData=this.data.get(sym); if(!skeletonData)return null;
    let mesh;
    try{
      mesh=new spine.SkeletonMesh({
        skeletonData,
        twoColorTint:false,
        materialFactory:(parameters)=>{parameters.depthTest=false;parameters.depthWrite=false;parameters.transparent=true;return new THREE.MeshBasicMaterial(parameters)}
      });
    }catch(_){
      // Compatibility path for older 4.3 patch APIs.
      mesh=new spine.SkeletonMesh(skeletonData,(parameters)=>{parameters.depthTest=false;parameters.depthWrite=false;parameters.transparent=true});
    }
    mesh.position.set(-VIEW_W/2+LAYOUT.cellWidth/2+c*LAYOUT.cellWidth,VIEW_H/2-LAYOUT.cellHeight/2-r*LAYOUT.cellHeight,0);
    mesh.zOffset=0.0001; mesh.visible=false; scene.add(mesh); return mesh;
  }
  removeCell(c,r){
    const old=this.cells[c][r]; if(!old)return;
    pendingPngHides.delete(slots[c]?.[r+1]);
    scene.remove(old.mesh); if(typeof old.mesh.dispose==='function')old.mesh.dispose(); if(old.backMesh){scene.remove(old.backMesh);if(typeof old.backMesh.dispose==='function')old.backMesh.dispose()} this.cells[c][r]=null;
  }
  resetToPng(){
    // Freeze readiness and artwork for this spin. Late asset loading must never
    // change a moving reel or switch only the later reels to a different pose.
    this.spinReady=this.ready;
    this.spinSprites=this.ready?new Map(this.landingSprites):new Map();
    spinImages=this.ready?new Map(landingImages):new Map();
    this.stopAnticipationFx();
    this.eventLog=[];
    clearTimeout(this.focusTimer); this.focusTimer=null;
    pendingPngHides.clear();
    for(const resolve of landingFrameWaiters.splice(0))resolve();
    for(let c=0;c<LAYOUT.columns;c++)for(let r=0;r<LAYOUT.rows;r++){
      const img=slots[c]?.[r+1]; if(img)img.style.opacity='1'; this.removeCell(c,r);
    }
  }
  showCell(c,r,sym,animation='land'){
    if(!this.ready||!this.spinReady||!this.data.has(sym))return false;
    // Cash foregrounds need their stationary backing. Keep the complete PNG if
    // that optional skeleton is unavailable, instead of showing half a symbol.
    if(CASH_SYMBOLS.has(sym)&&!this.cashBackData)return false;
    if((CASH_SYMBOLS.has(sym)||sym==='W')&&!this.spinSprites.has(sym))return false;
    try{
      this.removeCell(c,r);
      const cell=this.buildCell(c,r,sym,animation);
      this.cells[c][r]=cell;
      const img=slots[c]?.[r+1]; queuePngHide(img,cell);
      return true;
    }catch(err){
      console.error(`Spine cell ${c}:${r} (${sym}) failed; keeping PNG.`,err);
      this.lastError=`R${c+1}/row${r+1} ${sym}: ${err?.message||err}`; this.cellErrors.push(this.lastError); this.cellErrors=this.cellErrors.slice(-8);
      try{this.removeCell(c,r)}catch(_){}
      const img=slots[c]?.[r+1]; if(img)img.style.opacity='1';
      return false;
    }
  }
  cellCount(){let n=0;for(let c=0;c<LAYOUT.columns;c++)for(let r=0;r<LAYOUT.rows;r++)if(this.cells[c]?.[r])n++;return n;}
  ensureMatrix(matrix,animation='idle'){
    const report={requested:16,created:0,existing:0,failed:0};
    if(!this.ready||!this.spinReady||!matrix){report.failed=16;return report;}
    for(let c=0;c<LAYOUT.columns;c++)for(let r=0;r<LAYOUT.rows;r++){
      const sym=matrix[c][r],cell=this.cells[c]?.[r];
      if(!this.data.has(sym)){ // e.g. C: intentionally rendered by PNG in Symbols(5)
        if(cell)this.removeCell(c,r); const img=slots[c]?.[r+1]; if(img)img.style.opacity='1';
        report.existing++; continue;
      }
      if(cell?.sym===sym){report.existing++;continue;}
      if(this.showCell(c,r,sym,animation))report.created++;else report.failed++;
    }
    return report;
  }
  cellDiagnostic(matrix){
    const lines=[`SPINE CELLS: ${this.cellCount()} / 16 · runtime ${this.ready?'READY':'NOT READY'}`];
    if(matrix){for(let c=0;c<LAYOUT.columns;c++)for(let r=0;r<LAYOUT.rows;r++){const cell=this.cells[c]?.[r],sym=matrix[c][r];lines.push(`R${c+1}/row${r+1} ${sym}: ${cell?`ACTIVE ${cell.sym}`:(this.data.has(sym)?'MISSING':'PNG FALLBACK')}`)}}
    if(this.lastError)lines.push(`LAST SPINE ERROR: ${this.lastError}`);
    return lines.join('\n');
  }
  // Fire-and-forget presentation hook. This method NEVER throws into the reel state machine.
  landColumn(c,symbols){
    if(!this.ready)return;
    try{for(let r=0;r<LAYOUT.rows;r++)this.showCell(c,r,symbols[r],'land')}
    catch(err){console.error(`Spine column ${c} presentation failed. Gameplay continues.`,err)}
  }
  startAnticipationFx(c){
    if(!this.ready||!this.fxData)return;
    try{
      this.stopAnticipationFx();
      let mesh;
      try{mesh=new spine.SkeletonMesh({skeletonData:this.fxData,twoColorTint:false,materialFactory:(parameters)=>{parameters.depthTest=false;parameters.depthWrite=false;parameters.transparent=true;return new THREE.MeshBasicMaterial(parameters)}})}
      catch(_){mesh=new spine.SkeletonMesh(this.fxData,(parameters)=>{parameters.depthTest=false;parameters.depthWrite=false;parameters.transparent=true})}
      // Authored FX is ~205x600 and intentionally overlaps the reel edges vertically.
      mesh.position.set(-VIEW_W/2+LAYOUT.cellWidth/2+c*LAYOUT.cellWidth,0,0); mesh.renderOrder=60; mesh.zOffset=.002; mesh.visible=true;
      mesh.state.clearTracks(); mesh.state.setAnimation(0,'loop',true); mesh.update(0); scene.add(mesh);
      this.anticipationFx=mesh; this.anticipationReel=c;
    }catch(err){console.error('Non-fatal anticipation Spine FX error',err);this.lastError=`ANTICIPATION FX R${c+1}: ${err?.message||err}`}
  }
  stopAnticipationFx(c=null){
    if(!this.anticipationFx)return;
    if(c!==null&&this.anticipationReel!==c)return;
    try{scene.remove(this.anticipationFx);if(typeof this.anticipationFx.dispose==='function')this.anticipationFx.dispose()}catch(_){}
    this.anticipationFx=null;this.anticipationReel=-1;
  }
  setCellBrightness(cell,value){
    if(!cell?.mesh?.skeleton?.color)return;
    const v=Math.max(0,Math.min(1,value));
    cell.mesh.skeleton.color.r=v;cell.mesh.skeleton.color.g=v;cell.mesh.skeleton.color.b=v;
  }
  focusWinningCells(seen,holdMs=950){
    if(this.focusTimer){clearTimeout(this.focusTimer);this.focusTimer=null}
    for(let c=0;c<LAYOUT.columns;c++)for(let r=0;r<LAYOUT.rows;r++){
      const cell=this.cells[c]?.[r];if(!cell)continue;
      cell.targetBrightness=seen.has(`${c}:${r}`)?1:0.60;
    }
    this.focusTimer=setTimeout(()=>{
      for(let c=0;c<LAYOUT.columns;c++)for(let r=0;r<LAYOUT.rows;r++){const cell=this.cells[c]?.[r];if(cell)cell.targetBrightness=1}
      this.focusTimer=null;
    },holdMs);
  }
  resetSequenceFrames(mesh){
    // Spine 4.3 sequence timelines keep their selected frame on the Slot.
    // Empty IDLE animations do not overwrite it, so explicitly restore sequence attachments to frame 0.
    if(!mesh?.skeleton?.slots)return;
    for(const slot of mesh.skeleton.slots){
      try{
        if(slot?.attachment?.sequence) slot.sequenceIndex=0;
      }catch(_){}
    }
  }
  prepareAnimationFromFrameZero(cell,name,loop=false){
    if(!cell?.mesh)return null;
    const mesh=cell.mesh;
    mesh.state.clearTracks();
    mesh.skeleton?.setBonesToSetupPose?.();
    mesh.skeleton?.setSlotsToSetupPose?.();
    this.resetSequenceFrames(mesh);
    const entry=mesh.state.setAnimation(0,name,loop);
    if(entry){entry.trackTime=0;entry.animationLast=-1;entry.trackLast=-1;}
    // Apply exactly t=0 before the normal render clock advances.
    mesh.update(0);
    this.resetSequenceFrames(mesh);
    mesh.update(0);
    mesh.visible=true;
    return entry;
  }
  resetCellToIdle(cell){
    if(!cell?.mesh)return false;
    try{
      // Spine 4.3 has separate bone/slot setup-pose methods (not setToSetupPose).
      // Reset first, then apply idle at t=0 so no final COLLECT pose can leak into the restored cell.
      this.prepareAnimationFromFrameZero(cell,'idle',true);
      return true;
    }catch(err){console.error('Spine idle reset failed',err);return false}
  }
  playCellAnimation(cell,name,{loop=false,queueIdle=true}={}){
    if(!cell?.mesh)return {ok:false,error:'NO SPINE CELL'};
    try{
      const available=cell.mesh.skeleton?.data?.findAnimation?.(name);
      if(!available)return {ok:false,error:`ANIMATION '${name}' MISSING`};
      cell.mesh.visible=true;
      cell.mesh.state.clearTracks();
      cell.mesh.state.setAnimation(0,name,loop);
      if(queueIdle&&!loop)cell.mesh.state.addAnimation(0,'idle',true,0);
      // Advance by a tiny non-zero delta. Some 4.3 exports have no visible keyed
      // change at exactly t=0, which made a correctly-routed event look static.
      cell.mesh.update(1/120);
      return {ok:true};
    }catch(err){return {ok:false,error:err?.message||String(err)};}
  }
  playWin(positions,source='RESULT'){
    if(!this.ready)return {requested:0,played:0,missing:0};
    const seen=new Set(); for(const [c,r] of positions)seen.add(`${c}:${r}`);
    if(seen.size)this.focusWinningCells(seen);
    let played=0,missing=0; const events=[]; const routed=new Set();
    for(const [c,r] of positions){
      const key=`${c}:${r}`; if(routed.has(key))continue; routed.add(key);
      const cell=this.cells[c]?.[r];
      if(!cell){missing++;events.push(`R${c+1}/row${r+1}: NO SPINE CELL`);continue}
      try{
        cell.mesh.visible=true;
        cell.mesh.state.clearTracks();
        cell.mesh.state.setAnimation(0,'win',false);
        cell.mesh.state.addAnimation(0,'idle',true,0);
        cell.mesh.update(0);
        played++;events.push(`R${c+1}/row${r+1} ${cell.sym}: WIN`);
      }catch(err){
        missing++;events.push(`R${c+1}/row${r+1} ${cell.sym}: ERROR`);
        console.error(`Spine WIN failed at ${key}`,err);
      }
    }
    this.eventLog=[`${source}: requested ${seen.size}, played ${played}, missing ${missing}`,`WIN FOCUS: winners 100% · others 60%`,...events].slice(0,20);
    return {requested:seen.size,played,missing};
  }
  animationDuration(cell,name){
    try{return cell?.mesh?.skeleton?.data?.findAnimation?.(name)?.duration||0}catch(_){return 0}
  }
  async playReturnThenIdle(cell){
    if(!cell?.mesh)return;
    const hasReturn=!!cell.mesh.skeleton?.data?.findAnimation?.('return');
    if(hasReturn){
      this.prepareAnimationFromFrameZero(cell,'return',false);
      const ms=Math.max(80,this.animationDuration(cell,'return')*1000);
      await new Promise(r=>setTimeout(r,ms));
    }
    this.resetCellToIdle(cell);
  }
  async playCollector(result){
    if(!this.ready||!result?.collectorActive)return {requested:0,played:0,missing:0};
    // Every visible W gets its own complete collection pass. Order is deterministic:
    // reel left->right, then row top->bottom. This is presentation of the already-awarded maths only.
    const collectors=[...(result.wPositions||[])].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    if(!collectors.length)return {requested:0,played:0,missing:0};
    const gems=(result.gems||[]).filter(g=>CASH_SYMBOLS.has(getMatrix()?.[g.position[0]]?.[g.position[1]]));
    const focus=new Set([...collectors.map(([c,r])=>`${c}:${r}`),...gems.map(g=>`${g.position[0]}:${g.position[1]}`)]);
    this.focusWinningCells(focus,Math.max(2200,collectors.length*(900+gems.length*120)));
    let played=0,missing=0; const events=[];

    for(let wi=0;wi<collectors.length;wi++){
      const [wc,wr]=collectors[wi],wCell=this.cells[wc]?.[wr];
      if(!wCell){missing++;events.push(`W${wi+1} R${wc+1}/row${wr+1}: MISSING`);continue}
      let wStarted=false;
      try{
        wCell.mesh.visible=true;setRenderLayer(wCell.mesh,100,0);
        this.prepareAnimationFromFrameZero(wCell,'collect',false);wStarted=true;played++;
      }catch(err){missing++;console.error(`W${wi+1} collect failed`,err)}
      const target=wCell.mesh.position.clone();target.z=1;
      const fly=[];
      for(let i=0;i<gems.length;i++){
        const [c,r]=gems[i].position,cell=this.cells[c]?.[r];
        if(!cell){missing++;continue}
        try{
          cell.mesh.visible=true;this.prepareAnimationFromFrameZero(cell,'collect',false);
          // Only the cash foreground travels. cashBack stays at its authored reel cell.
          setRenderLayer(cell.mesh,1000,1);
          if(cell.backMesh){
            cell.backMesh.visible=true;setRenderLayer(cell.backMesh,0,-0.001);
            cell.backMesh.state.clearTracks();cell.backMesh.state.setAnimation(0,'idle',true);cell.backMesh.update(0);
          }
          const start=cell.mesh.position.clone();start.z=1;cell.mesh.position.z=1;played++;
          fly.push(new Promise(resolve=>setTimeout(()=>{
            const t0=performance.now(),dur=650;
            const tick=(now)=>{const t=Math.min(1,(now-t0)/dur),ease=1-Math.pow(1-t,3);cell.mesh.position.lerpVectors(start,target,ease);if(t<1)requestAnimationFrame(tick);else{cell.mesh.visible=false;resolve()}};
            requestAnimationFrame(tick);
          },i*120)));
        }catch(err){missing++;console.error(`Cash collect failed R${c+1}/row${r+1}`,err)}
      }
      await Promise.all(fly);
      await new Promise(r=>setTimeout(r,100));

      // Respawn each cash foreground at its original cell and let the authored RETURN animation
      // bridge from collect back to the standard symbol. cashBack never moved.
      const returns=[];
      for(const g of gems){
        const [c,r]=g.position,cell=this.cells[c]?.[r];if(!cell)continue;
        cell.mesh.position.set(-VIEW_W/2+LAYOUT.cellWidth/2+c*LAYOUT.cellWidth,VIEW_H/2-LAYOUT.cellHeight/2-r*LAYOUT.cellHeight,0);
        setRenderLayer(cell.mesh,10,0);cell.mesh.visible=true;
        returns.push(this.playReturnThenIdle(cell));
      }
      if(wStarted){setRenderLayer(wCell.mesh,10,0);returns.push(this.playReturnThenIdle(wCell))}
      await Promise.all(returns);
      events.push(`W${wi+1} R${wc+1}/row${wr+1}: collect → return → idle`);
      if(wi<collectors.length-1)await new Promise(r=>setTimeout(r,100));
    }
    this.eventLog=[`MULTI COLLECT: ${collectors.length} W · ${gems.length} cash · sequential passes`,...events,...gems.map(g=>`R${g.position[0]+1}/row${g.position[1]+1}: collect → return → next W`)].slice(0,20);
    return {requested:collectors.length*(gems.length+1),played,missing};
  }
  forceWinAll(matrix){
    // Always request the mathematical 4x4, not merely whatever happened to register.
    const ensure=this.ensureMatrix(matrix,'idle');
    const positions=[];for(let c=0;c<LAYOUT.columns;c++)for(let r=0;r<LAYOUT.rows;r++)positions.push([c,r]);
    const result=this.playWin(positions,'FORCE SPINE WIN'); result.ensure=ensure; return result;
  }
  diagnostic(){return this.eventLog.length?this.eventLog.join('\n'):'No Spine win event yet';}
  update(dt){
    if(!this.ready)return;
    if(this.anticipationFx){try{this.anticipationFx.update(dt)}catch(err){console.error('Anticipation FX update failed',err);this.stopAnticipationFx()}}
    // One bad cell must not tear down all 16 or falsify runtime readiness.
    for(let c=0;c<LAYOUT.columns;c++)for(let r=0;r<LAYOUT.rows;r++){const cell=this.cells[c]?.[r];if(!cell?.mesh?.visible)continue;try{
      // The first render must use t=0, not time accumulated before this cell
      // existed. Only the post-render handoff releases the animation clock.
      if(cell.awaitingFirstRender)continue;
      const target=cell.targetBrightness??1,current=cell.brightness??1;
      const speed=target<current?18:13; cell.brightness=current+(target-current)*(1-Math.exp(-speed*dt));
      if(Math.abs(cell.brightness-target)<.005)cell.brightness=target;
      this.setCellBrightness(cell,cell.brightness);
      if(cell.backMesh?.skeleton?.color){cell.backMesh.skeleton.color.r=cell.brightness;cell.backMesh.skeleton.color.g=cell.brightness;cell.backMesh.skeleton.color.b=cell.brightness;cell.backMesh.update(dt)}
      cell.mesh.update(dt)
    }catch(err){
      console.error(`Spine runtime update failed at ${c}:${r}; reverting that cell to PNG.`,err);
      this.lastError=`UPDATE R${c+1}/row${r+1} ${cell.sym}: ${err?.message||err}`; this.cellErrors.push(this.lastError);this.cellErrors=this.cellErrors.slice(-8);
      const img=slots[c]?.[r+1];if(img)img.style.opacity='1';this.removeCell(c,r);
    }}
  }
}

const manager=new SpineSymbolManager();
manager.flushPngHides=flushPngHides;
return manager;
}
