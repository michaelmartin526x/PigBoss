import * as THREE from 'three';
import { LAYOUT, BLUR_SYMBOLS, DECLARED_RTP } from './engine/config.js';
import { GameEngine } from './engine/game-engine.js';
import { seededRandom } from './engine/random.js';
import { AudioManager } from './presentation/audio.js';
import { createSpinePresentation } from './presentation/spine.js';
import { createReelAnimator } from './presentation/reels.js';
import { loadReelSprites } from './presentation/reel-sprites.js';

const params=new URLSearchParams(location.search),debugEnabled=params.get('debug')==='1';
const response=await fetch('reels.json');
if(!response.ok)throw new Error('Reel data unavailable: '+response.status);
const reels=await response.json();
const engine=new GameEngine(reels,{random:debugEnabled&&params.has('seed')?seededRandom(Number(params.get('seed'))):Math.random});
const {matrixFromStops}=engine.rules;
const audioManager=new AudioManager();
const reelSprites=await loadReelSprites(BLUR_SYMBOLS);
const game=document.querySelector('#game'), spin=document.querySelector('#spin');
const winEl=document.querySelector('#win'), creditEl=document.querySelector('#credit'), stakeEl=document.querySelector('#stake'), status=document.querySelector('#status'), debugEl=document.querySelector('#debug-content');
const splash=document.querySelector('#splash'), featureEntry=document.querySelector('#feature-entry'), featureComplete=document.querySelector('#feature-complete');

const featureEntryPanel=document.querySelector('#feature-entry-panel'), featureTotalEl=document.querySelector('#feature-total');
const freeLeftEl=document.querySelector('#free-left'), featureWinEl=document.querySelector('#feature-win');
const host=document.querySelector('#three'), reelWindow=document.querySelector('#reel-window'), fxLayer=document.querySelector('#fx-layer');

// Only six sprites exist per reel: one above, four visible, one below.
// They are recycled while the strip moves, so reel motion is continuous without rendering all 80 stops.
const columns=[], tracks=[], slots=[];
for(let c=0;c<LAYOUT.columns;c++){
  const col=document.createElement('div'); col.className='reel-column';
  const track=document.createElement('div'); track.className='reel-track';
  const imgs=[];
  for(let i=0;i<LAYOUT.rows+2;i++){
    const sprite=document.createElement('canvas');sprite.className='reel-symbol';
    sprite.width=LAYOUT.cellWidth;sprite.height=LAYOUT.cellHeight;sprite.setAttribute('aria-hidden','true');
    track.appendChild(sprite);imgs.push(sprite);
  }
  col.appendChild(track); reelWindow.appendChild(col); columns.push(col);tracks.push(track);slots.push(imgs);
}

const VIEW_W=LAYOUT.columns*LAYOUT.cellWidth,VIEW_H=LAYOUT.rows*LAYOUT.cellHeight,scene=new THREE.Scene();
const camera=new THREE.OrthographicCamera(-VIEW_W/2,VIEW_W/2,VIEW_H/2,-VIEW_H/2,.1,10);camera.position.z=5;
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;fxLayer.appendChild(renderer.domElement);

document.querySelector('#debug').hidden=!debugEnabled;
// A non-repeating seeded run can be replayed with ?debug=1&seed=123.
function resize(){renderer.setSize(Math.max(1,host.clientWidth),Math.max(1,host.clientHeight),false)}
addEventListener('resize',resize);resize();
let currentMatrix=null,lastDebugCore='Press anywhere to start.';
const spineSymbols=createSpinePresentation({scene,slots,getMatrix:()=>currentMatrix});
const animateSpin=createReelAnimator({reels,matrixFromStops,spineSymbols,columns,tracks,fillTrack,
  report:text=>{lastDebugCore=text+'\n'+lastDebugCore;refreshDebug()}});
function setImg(img,s,blur=false){
  reelSprites.draw(img,s,blur&&BLUR_SYMBOLS.has(s),spineSymbols.reelImage(s));
}
function fillTrack(c,strip,centerStop,blur=false){for(let i=0;i<LAYOUT.rows+2;i++)setImg(slots[c][i],strip[(centerStop-2+i+strip.length)%strip.length],blur)}
function draw(mode,stops){currentMatrix=matrixFromStops(mode,stops);for(let c=0;c<LAYOUT.columns;c++){fillTrack(c,reels[`reel${mode}${c+1}`],stops[c]);tracks[c].style.transform='translateY(-16.6666667%)'}}

function diagnosticStats(){
  const sessionRtp=engine.totalStakedCents?engine.totalReturnedCents/engine.totalStakedCents*100:0;
  return `\n\nSPINE\n${spineSymbols.ready?'READY':'PNG FALLBACK'} · ${spineSymbols.data.size} registered · ${spineSymbols.cellCount()} active${spineSymbols.lastError?'\n'+spineSymbols.lastError:''}\n\nACCOUNTANCY / RTP\nDeclared reference RTP (unverified): ${DECLARED_RTP.toFixed(3)}%\nSession RTP: ${sessionRtp.toFixed(3)}%\nPaid spins: ${engine.paidSpins}\nTotal staked: ${money(engine.totalStakedCents/100)}\nTotal returned: ${money(engine.totalReturnedCents/100)}\nCredit: ${money(engine.creditCents/100)}\nState: ${engine.state}`;
}
function refreshDebug(){if(debugEnabled)debugEl.textContent=lastDebugCore+diagnosticStats()}
function renderDebug(result,stops,m){
  const rows=[0,1,2,3].map(r=>[0,1,2,3].map(c=>m[c][r]).join('  ')).join('\n');
  const lines=result.lineWins.length?result.lineWins.map(w=>`L${String(w.line).padStart(2,'0')}  ${w.symbol} x${w.count}  = ${w.amount.toFixed(2)}`).join('\n'):'None';
  const gems=result.gems.length?result.gems.map(g=>`${g.symbol}(${g.value}) @ R${g.position[0]+1}/row${g.position[1]+1}`).join(', '):'None';
  const collectors=result.wPositions.length?result.wPositions.map(p=>`R${p[0]+1}/row${p[1]+1}`).join(', '):'None';
  lastDebugCore=`REEL SET: ${result.mode}\nSTOPS: ${stops.join(', ')}\n\nFINAL 4x4\n${rows}\n\nLINE WINS\n${lines}\nLine subtotal: ${result.lineWin.toFixed(2)}\n\nCOLLECTOR\nW visible: ${result.wPositions.length} (${collectors})\nEligible gems: ${gems}\nCollector active: ${result.collectorActive?'YES':'NO'}\nCollector award: ${result.collectorAmount.toFixed(2)}\n\nSCATTERS\nF count: ${result.scatterCount}${result.freeSpins?` -> ${result.freeSpins} FREE SPINS`:''}\n\nTOTAL WIN: ${result.totalWin.toFixed(2)}`;
  refreshDebug();
}

async function presentSpin(record){
  const {mode,stops,result,isFeature,matrix}=record;
  await animateSpin(mode,stops);draw(mode,stops);
  const spineEnsure=spineSymbols.ensureMatrix(matrix,'idle');
  // Let the last reel display its matching landing pose before a simultaneous
  // win/collection can replace it. The award has already been settled.
  await spineSymbols.whenLandingRendered();
  // v0.19.5 — genuine result -> Spine choreography. Keep each source explicit so diagnostics
  // prove whether a line win, collector win, or scatter trigger actually drove animation.
  const lineWinPositions=[];
  for(const w of result.lineWins)lineWinPositions.push(...w.positions);
  const collectorPositions=[];
  if(result.collectorActive){collectorPositions.push(...result.wPositions);for(const g of result.gems)collectorPositions.push(g.position)}
  const scatterPositions=[];
  if(result.scatterCount>=3){for(let c=0;c<4;c++)for(let r=0;r<4;r++)if(currentMatrix[c][r]==='F')scatterPositions.push([c,r])}
  // v0.20.7: explicit presentation dispatch. Ordinary line/scatter wins use the proven
  // WIN route; collector choreography is a separate event and can never swallow WIN routing.
  let lineReport={requested:0,played:0,missing:0};
  let scatterReport={requested:0,played:0,missing:0};
  let collectReport={requested:0,played:0,missing:0};
  try{if(lineWinPositions.length)lineReport=spineSymbols.playWin(lineWinPositions,'LINE PRESENTATION')}catch(err){console.error('Non-fatal Spine line presentation error',err)}
  try{if(scatterPositions.length)scatterReport=spineSymbols.playWin(scatterPositions,'SCATTER PRESENTATION')}catch(err){console.error('Non-fatal Spine scatter presentation error',err)}
  if(result.collectorActive){try{collectReport=await spineSymbols.playCollector(result)}catch(err){console.error('Non-fatal Spine collect presentation error',err)}}
  const uniqueCount=(positions)=>new Set(positions.map(([c,r])=>`${c}:${r}`)).size;
  const spineRouteSummary=`LINE PRESENTATION: requested ${uniqueCount(lineWinPositions)} · played ${lineReport.played} · missing ${lineReport.missing}\nCOLLECT PRESENTATION: requested ${uniqueCount(collectorPositions)} · played ${collectReport.played} · missing ${collectReport.missing}\nSCATTER PRESENTATION: requested ${uniqueCount(scatterPositions)} · played ${scatterReport.played} · missing ${scatterReport.missing}`;
  renderDebug(result,stops,currentMatrix);
  lastDebugCore += `\n\nSPINE CELL REGISTRATION\nrequested ${spineEnsure.requested} · created ${spineEnsure.created} · existing ${spineEnsure.existing} · failed ${spineEnsure.failed}\n${spineSymbols.cellDiagnostic(currentMatrix)}\n\nSPINE RESULT ROUTING\n${spineRouteSummary}\n${spineSymbols.diagnostic()}`;refreshDebug();
  if(isFeature){lastDebugCore=`FEATURE SPIN · ${mode}\n`+lastDebugCore+`\n\nFEATURE TOTAL: ${(engine.featureTotalCents/100).toFixed(2)}`;refreshDebug()}
  return result;
}

const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
let busy=false, autoplayActive=false, autoplayEpoch=0;
function money(v){return Number(v).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}
function updateAccount(showAward=true){
  creditEl.textContent=money(engine.creditCents/100);
  stakeEl.textContent=money(engine.stakeCents/100);
  winEl.textContent=money(showAward?engine.lastWinCents/100:0);
  freeLeftEl.textContent=engine.freeSpinsLeft;
  featureWinEl.textContent=money(engine.featureTotalCents/100);
}
function setScreen(el,on){el.classList.toggle('active',on)}
function stopAutoplay(){autoplayActive=false;autoplayEpoch++;document.querySelector('#autoplay').classList.remove('active')}
function showBase(){
  game.classList.remove('feature-mode');
  for(const screen of [splash,featureEntry,featureComplete])setScreen(screen,false);
  spin.disabled=false;status.textContent='GOOD LUCK!';updateAccount();refreshDebug();
}
async function safelyPresent(record){
  try{await presentSpin(record)}
  catch(error){
    console.error('Presentation failed; preserving settled result.',error);
    try{spineSymbols.resetToPng()}catch(_){}
    for(const col of columns)col.classList.remove('running','slow','anticipating','settle');
    draw(record.mode,record.stops);
    renderDebug(record.result,record.stops,record.matrix);
    lastDebugCore+='\nPresentation fallback: '+(error?.message||error);refreshDebug();
  }
}
async function doSpin(forced=false){
  // Event objects must never become forced outcomes.
  forced=forced===true;
  if(busy||engine.state!=='BASE_GAME')return;
  audioManager.enterBase();
  const record=engine.beginBase({forced});
  if(!record){stopAutoplay();status.textContent='INSUFFICIENT CREDIT';return}
  busy=true;spin.disabled=true;game.classList.add('spinning');status.textContent='SPINNING...';
  // Money is already settled internally. Reveal it only after the reels land.
  winEl.textContent='0.00';
  creditEl.textContent=money((engine.creditCents-(record.forced?0:record.awardCents))/100);
  await safelyPresent(record);
  engine.completeBase(record.id);
  updateAccount();refreshDebug();game.classList.remove('spinning');
  status.textContent=record.awardCents>0?'WINNER!!!':'GOOD LUCK!';
  if(record.forced){lastDebugCore='DEBUG: excluded from credit and session RTP\n'+lastDebugCore;refreshDebug()}
  if(engine.state==='FEATURE_TRANSITION'){
    stopAutoplay();
    // Keep busy AND engine state locked during the entire entry delay.
    await wait(900);
    engine.showFeatureEntry();
    featureEntryPanel.src=`assets/free/Enter_FreeSpins_Panel_${engine.pendingFreeSpins}.png`;
    setScreen(featureEntry,true);busy=false;
    refreshDebug();
  }else{
    busy=false;spin.disabled=false;
    if(autoplayActive){
      const epoch=autoplayEpoch;
      await wait(record.awardCents>0?650:260);
      if(autoplayActive&&epoch===autoplayEpoch&&!busy&&engine.state==='BASE_GAME')doSpin();
    }
  }
}
async function startFeature(){
  if(busy||!engine.startFeature())return;
  busy=true;spin.disabled=true;setScreen(featureEntry,false);game.classList.add('feature-mode');updateAccount();
  refreshDebug();
  await wait(350);
  while(engine.state==='FREE_SPINS'){
    status.textContent=`FREE SPIN ${engine.pendingFreeSpins-engine.freeSpinsLeft+1} OF ${engine.pendingFreeSpins}`;
    const record=engine.beginFeatureSpin();
    await safelyPresent(record);
    engine.completeFeatureSpin(record.id);updateAccount();refreshDebug();
    status.textContent=record.result.collectorActive?`COLLECT x${record.result.collectorMultiplier}`:(record.awardCents>0?`FREE SPIN WIN ${money(record.awardCents/100)}`:'FREE SPIN');
    await wait(record.awardCents>0?850:420);
  }
  featureTotalEl.textContent=money(engine.featureTotalCents/100);
  status.textContent=`FEATURE WIN ${money(engine.featureTotalCents/100)}`;
  setScreen(featureComplete,true);busy=false;
  refreshDebug();
}
function continueAction(){
  if(busy)return;
  if(engine.enterBase()){audioManager.enterBase();showBase()}
  else if(engine.state==='FEATURE_ENTRY')startFeature();
  else if(engine.finishFeature()){showBase();status.textContent=engine.lastWinCents>0?'WINNER!!!':'GOOD LUCK!'}
}
spin.addEventListener('click',()=>doSpin());
const settingsDialog=document.querySelector('#settings-dialog');
document.querySelector('#settings').addEventListener('click',()=>{stopAutoplay();settingsDialog.showModal()});
document.querySelector('#music-volume').addEventListener('input',e=>audioManager.setVolume(e.target.value));
document.querySelector('#music-muted').addEventListener('change',e=>{audioManager.setMuted(e.target.checked);if(!e.target.checked&&engine.state!=='START')audioManager.enterBase()});
document.querySelector('#debug-feature').addEventListener('click',()=>{
  if(!debugEnabled||busy||engine.state!=='BASE_GAME')return;
  stopAutoplay();doSpin(true);
});
document.querySelector('#autoplay').addEventListener('click',()=>{
  if(!['BASE_GAME','SPINNING'].includes(engine.state))return;
  autoplayEpoch++;
  autoplayActive=!autoplayActive;
  document.querySelector('#autoplay').classList.toggle('active',autoplayActive);
  if(autoplayActive&&!busy)doSpin();
});
for(const screen of [splash,featureEntry,featureComplete])screen.addEventListener('click',continueAction);
addEventListener('keydown',e=>{
  if(e.code!=='Space'||e.repeat||settingsDialog.open)return;
  const tag=(e.target?.tagName||'').toLowerCase();
  if(['input','textarea','select','button'].includes(tag)||e.target?.isContentEditable)return;
  e.preventDefault();
  if(['START','FEATURE_ENTRY','FEATURE_COMPLETE'].includes(engine.state))continueAction();else doSpin();
});
updateAccount();refreshDebug();
// Initial art does not consume the gameplay RNG stream.
draw('A',[0,0,0,0]);let spineFrame=performance.now();
renderer.setAnimationLoop(()=>{
  const now=performance.now(),dt=Math.min(.05,(now-spineFrame)/1000);spineFrame=now;
  spineSymbols.update(dt);renderer.render(scene,camera);spineSymbols.flushPngHides();
});
spineSymbols.init().then(()=>refreshDebug());
setTimeout(()=>audioManager.trySplashAmbient(),80);
