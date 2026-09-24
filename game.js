import * as THREE from 'three';

const MODES=[['A',410],['B',410],['C',45],['D',45],['E',45],['F',45]];
const paylines=[[[0,1],[1,1],[2,1],[3,1]],[[0,0],[1,0],[2,0],[3,0]],[[0,2],[1,2],[2,2],[3,2]],[[0,3],[1,3],[2,3],[3,3]],[[0,0],[1,1],[2,2],[3,3]],[[0,3],[1,2],[2,1],[3,0]],[[0,1],[1,0],[2,0],[3,0]],[[0,2],[1,1],[2,1],[3,1]],[[0,3],[1,2],[2,2],[3,2]],[[0,1],[1,0],[2,1],[3,0]],[[0,2],[1,1],[2,2],[3,1]],[[0,3],[1,2],[2,3],[3,2]]];
const pay={W:[0,0,1000,5000],M:[0,0,500,2000],G:[0,0,300,1500],D:[0,0,200,1000],E:[0,0,200,1000],A:[0,0,50,250],K:[0,0,50,250],Q:[0,0,50,250],J:[0,0,50,250],T:[0,0,50,250],C:[0,0,50,250]};
const GEM_VALUES={Z:20,Y:10,X:8,V:5,U:3,S:2,R:1};
const GEM_SYMBOLS=new Set(Object.keys(GEM_VALUES));

const game=document.querySelector('#game'), spin=document.querySelector('#spin');
const winEl=document.querySelector('#win'), creditEl=document.querySelector('#credit'), stakeEl=document.querySelector('#stake'), status=document.querySelector('#status'), debugEl=document.querySelector('#debug-content');
const splash=document.querySelector('#splash'), featureEntry=document.querySelector('#feature-entry'), featureComplete=document.querySelector('#feature-complete');
const featureEntryPanel=document.querySelector('#feature-entry-panel'), featureTotalEl=document.querySelector('#feature-total');
const freeLeftEl=document.querySelector('#free-left'), featureWinEl=document.querySelector('#feature-win');
let gameState='START',pendingFreeSpins=0,freeSpinsLeft=0,featureTotal=0;
let credit=1000.00, stake=1.00, lastWin=0.00, featureCreditPending=0.00;
let paidSpins=0,totalStaked=0,totalReturned=0;
let forceFeatureArmed=false, debugFeatureRun=false;
const THEORETICAL_RTP=96.651;
const host=document.querySelector('#three'), reelWindow=document.querySelector('#reel-window'), fxLayer=document.querySelector('#fx-layer');

// Only six sprites exist per reel: one above, four visible, one below.
// They are recycled while the strip moves, so reel motion is continuous without rendering all 80 stops.
const columns=[], tracks=[], slots=[];
for(let c=0;c<4;c++){
  const col=document.createElement('div'); col.className='reel-column';
  const track=document.createElement('div'); track.className='reel-track';
  const imgs=[];
  for(let i=0;i<6;i++){const img=document.createElement('img');img.alt='';img.draggable=false;track.appendChild(img);imgs.push(img)}
  col.appendChild(track); reelWindow.appendChild(col); columns.push(col);tracks.push(track);slots.push(imgs);
}

const VIEW_W=660,VIEW_H=580,scene=new THREE.Scene();
const camera=new THREE.OrthographicCamera(-VIEW_W/2,VIEW_W/2,VIEW_H/2,-VIEW_H/2,.1,10);camera.position.z=5;
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);fxLayer.appendChild(renderer.domElement);
function resize(){renderer.setSize(Math.max(1,host.clientWidth),Math.max(1,host.clientHeight),false)}addEventListener('resize',resize);resize();

const reels=await fetch('reels.json').then(r=>r.json());
const BLUR_SYMBOLS=new Set(['A','C','D','E','F','G','J','K','M','Q','R','S','T','U','V','W','X','Y','Z']);
// Preload both presentations so switching at speed never waits on image I/O.
for(const sym of BLUR_SYMBOLS){for(const src of [`assets/${sym}.png`,`assets/blur/${sym}_blur.png`]){const im=new Image();im.src=src}}
let busy=false,currentMatrix=null;
function chooseMode(){let x=Math.random()*1000;for(const [m,w] of MODES){x-=w;if(x<0)return m}return'A'}
function chooseStops(mode){return [0,1,2,3].map(c=>Math.floor(Math.random()*reels[`reel${mode}${c+1}`].length))}
function matrixFromStops(mode,stops){return [0,1,2,3].map(c=>{const s=reels[`reel${mode}${c+1}`],p=stops[c];return[-1,0,1,2].map(d=>s[(p+d+s.length)%s.length])})}
function setImg(img,s,blur=false){
  const useBlur=blur&&BLUR_SYMBOLS.has(s),key=`${s}:${useBlur?'b':'s'}`;
  if(img.dataset.renderKey!==key){img.src=useBlur?`assets/blur/${s}_blur.png`:`assets/${s}.png`;img.dataset.symbol=s;img.dataset.renderKey=key}
}
function fillTrack(c,strip,centerStop,blur=false){for(let i=0;i<6;i++)setImg(slots[c][i],strip[(centerStop-2+i+strip.length)%strip.length],blur)}
function draw(mode,stops){currentMatrix=matrixFromStops(mode,stops);for(let c=0;c<4;c++){fillTrack(c,reels[`reel${mode}${c+1}`],stops[c]);tracks[c].style.transform='translateY(-16.6666667%)'}}
function transformGemsToC(m){return m.map(col=>col.map(s=>GEM_SYMBOLS.has(s)?'C':s))}
function evaluateLines(m){
  const wins=[]; let total=0;
  paylines.forEach((line,i)=>{
    const seq=line.map(([c,r])=>m[c][r]),s=seq[0]; if(!pay[s])return;
    let n=1; while(n<4&&seq[n]===s)n++;
    if(n>=3){const amount=pay[s][n-1]/100;total+=amount;wins.push({line:i+1,symbol:s,count:n,amount,positions:line.slice(0,n)})}
  });
  return {total,wins};
}
function scatter(m){return m.flat().filter(s=>s==='F').length}
function evaluateSpin(mode,m){
  const wPositions=[]; const gems=[];
  for(let c=0;c<4;c++)for(let r=0;r<4;r++){
    const s=m[c][r]; if(s==='W')wPositions.push([c,r]);
    if(GEM_SYMBOLS.has(s))gems.push({symbol:s,value:GEM_VALUES[s],position:[c,r]});
  }
  // Revised PigBoss script behaviour:
  // A/B always transform gem-value symbols to C before ordinary line evaluation.
  // C-F branch on W: 0 W transforms gems to C; 1 W pays all visible gem values via paytableFishAll,
  // then evaluates ordinary paylines on the untransformed matrix. C-F strips are authored so W is confined
  // to one reel and the base-game branch expects 0 or 1 visible collector.
  const collectorMode=['C','D','E','F'].includes(mode);
  const collectorActive=collectorMode&&wPositions.length===1;
  const lineMatrix=(!collectorMode||wPositions.length===0)?transformGemsToC(m):m;
  const lineResult=evaluateLines(lineMatrix);
  const collectorAmount=collectorActive?gems.reduce((a,g)=>a+g.value,0):0;
  const f=scatter(m), freeSpins=f>=4?15:(f>=3?10:0);
  return {mode,lineMatrix,lineWins:lineResult.wins,lineWin:lineResult.total,wPositions,gems,collectorActive,collectorAmount,scatterCount:f,freeSpins,totalWin:lineResult.total+collectorAmount};
}
function evaluateFeatureSpin(mode,m){
  const wPositions=[],gems=[];
  for(let c=0;c<4;c++)for(let r=0;r<4;r++){
    const s=m[c][r]; if(s==='W')wPositions.push([c,r]);
    if(GEM_SYMBOLS.has(s))gems.push({symbol:s,value:GEM_VALUES[s],position:[c,r]});
  }
  // Revised feature script: FA-FD are chosen equally. Visible W count selects the fish
  // collector multiplier (0=no collect, 1=x1, 2=x2, 3=x3, 4=x4). Gems then transform
  // to C for the normal 12-line evaluation. Revised feature strips contain no X1 retrigger.
  const multiplier=Math.min(wPositions.length,4);
  const collectorAmount=multiplier?gems.reduce((a,g)=>a+g.value,0)*multiplier:0;
  const lineMatrix=transformGemsToC(m),lineResult=evaluateLines(lineMatrix);
  return {mode,lineMatrix,lineWins:lineResult.wins,lineWin:lineResult.total,wPositions,gems,collectorActive:multiplier>0,collectorMultiplier:multiplier,collectorAmount,scatterCount:0,freeSpins:0,totalWin:lineResult.total+collectorAmount};
}
let lastDebugCore='Press anywhere to start.';
let autoplayActive=false;
function diagnosticStats(){
  const sessionRtp=totalStaked>0?(totalReturned/totalStaked*100):0;
  return `\n\nACCOUNTANCY / RTP\nTheoretical RTP: ${THEORETICAL_RTP.toFixed(3)}%\nSession RTP: ${sessionRtp.toFixed(3)}%\nPaid spins: ${paidSpins}\nTotal staked: ${money(totalStaked)}\nTotal returned: ${money(totalReturned)}\nCredit: ${money(credit)}`;
}
function refreshDebug(){debugEl.textContent=lastDebugCore+diagnosticStats()}
function renderDebug(result,stops,m){
  const rows=[0,1,2,3].map(r=>[0,1,2,3].map(c=>m[c][r]).join('  ')).join('\n');
  const lines=result.lineWins.length?result.lineWins.map(w=>`L${String(w.line).padStart(2,'0')}  ${w.symbol} x${w.count}  = ${w.amount.toFixed(2)}`).join('\n'):'None';
  const gems=result.gems.length?result.gems.map(g=>`${g.symbol}(${g.value}) @ R${g.position[0]+1}/row${g.position[1]+1}`).join(', '):'None';
  const collectors=result.wPositions.length?result.wPositions.map(p=>`R${p[0]+1}/row${p[1]+1}`).join(', '):'None';
  lastDebugCore=`REEL SET: ${result.mode}\nSTOPS: ${stops.join(', ')}\n\nFINAL 4x4\n${rows}\n\nLINE WINS\n${lines}\nLine subtotal: ${result.lineWin.toFixed(2)}\n\nCOLLECTOR\nW visible: ${result.wPositions.length} (${collectors})\nEligible gems: ${gems}\nCollector active: ${result.collectorActive?'YES':'NO'}\nCollector award: ${result.collectorAmount.toFixed(2)}\n\nSCATTERS\nF count: ${result.scatterCount}${result.freeSpins?` -> ${result.freeSpins} FREE SPINS`:''}\n\nTOTAL WIN: ${result.totalWin.toFixed(2)}`;
  refreshDebug();
}
async function animateSpin(mode,targetStops){
  const baseDurations=[1080,1270,1460,1650];
  const targetMatrix=matrixFromStops(mode,targetStops);
  const totalSteps=[22,26,30,34];
  // starts[] is deliberately mutable. During anticipation we can rebase a reel by
  // whole symbols (start += K, distance += K) without changing a single rendered pixel.
  // That lets us add a few symbols of genuine travel instead of demanding a whole
  // 80-stop strip and accidentally accelerating the reel.
  const starts=targetStops.map((p,c)=>{const strip=reels[`reel${mode}${c+1}`];return(p+totalSteps[c])%strip.length});
  const lastWhole=[-1,-1,-1,-1],lastBlur=[null,null,null,null],done=[false,false,false,false],start=performance.now();
  const landedScatters=[0,0,0,0];
  const special=[null,null,null,null];
  let sequenceActive=false;
  const progress=t=>{
    if(t<.16){const q=t/.16;return .15*q*q*(3-2*q)}
    if(t<.52){const q=(t-.16)/.36;return .15+.50*q}
    const q=(t-.52)/.48;return .65+.35*(1-Math.pow(1-q,3.15))
  };
  const progressDerivative=t=>{
    if(t<.16){const q=t/.16;return .15*(6*q-6*q*q)/.16}
    if(t<.52)return .50/.36;
    const q=(t-.52)/.48;return .35*3.15*Math.pow(1-q,2.15)/.48;
  };
  function normalMotion(c,now){
    const elapsed=now-start,t=Math.min(1,elapsed/baseDurations[c]);
    return {distance:totalSteps[c]*progress(t),velocity:totalSteps[c]*progressDerivative(t)/baseDurations[c]};
  }
  function rebaseForTravel(c,distance,travel){
    // Pick only the whole-symbol headroom actually required for this tease.
    const K=Math.max(2,Math.ceil(distance+travel-totalSteps[c]+1));
    const strip=reels[`reel${mode}${c+1}`];
    starts[c]=(starts[c]+K)%strip.length;
    return {distance:distance+K,target:totalSteps[c]+K};
  }
  function startHold(c,now){
    if(done[c]||special[c])return;
    const m=normalMotion(c,now);
    // Hold never accelerates: it preserves the speed the reel had at interception.
    special[c]={phase:'hold',startTime:now,startDistance:m.distance,startVelocity:Math.max(m.velocity,0.0018),distance:m.distance,velocity:Math.max(m.velocity,0.0018)};
    columns[c].classList.add('anticipating');
  }
  function startAnticipation(c,now,duration){
    if(done[c])return;
    let d,v;
    if(special[c]&&special[c].phase==='hold'){
      const h=special[c],dt=now-h.startTime;
      d=h.startDistance+h.startVelocity*dt; v=h.startVelocity;
    }else{
      const m=normalMotion(c,now); d=m.distance; v=m.velocity;
    }
    // Never speed the reel back up. The cruise begins at exactly its current velocity.
    v=Math.max(v,0.0018);
    const decelMs=360, cruiseMs=Math.max(500,duration-decelMs);
    const cruiseTravel=v*cruiseMs;
    const decelTravel=v*decelMs*0.48;
    const rb=rebaseForTravel(c,d,cruiseTravel+decelTravel);
    d=rb.distance;
    // Rebase hold's visible coordinate too: start and distance changed by the same integer.
    const target=rb.target;
    special[c]={phase:'anticipate',startTime:now,startDistance:d,startVelocity:v,cruiseMs,decelMs,targetDistance:target,distance:d,velocity:v};
    lastWhole[c]=-1;
    columns[c].classList.add('anticipating');
    lastDebugCore=`REEL ${c+1}: ANTICIPATING\n`+lastDebugCore;refreshDebug();
  }
  function beginSequence(now){
    if(sequenceActive||landedScatters.reduce((a,b)=>a+b,0)<2)return;
    sequenceActive=true;
    // Stage 1: reel 3 teases. Reel 4 is intercepted and kept genuinely moving,
    // so it cannot quietly land while reel 3 is doing its tease.
    if(!done[2])startAnticipation(2,now,1200);
    if(!done[3])startHold(3,now);
  }
  function advanceSequence(c,now){
    // Reel 4 gets its OWN tease only after reel 3 has physically landed.
    // This is true whether reel 3 hit the third scatter or missed it: reel 4 may
    // be teasing the feature itself, or the 10->15 spin upgrade.
    if(sequenceActive&&c===2&&!done[3])startAnticipation(3,now,1500);
  }
  function specialMotion(c,now){
    const a=special[c];
    if(a.phase==='hold'){
      const dt=now-a.startTime;
      return {distance:a.startDistance+a.startVelocity*dt,finished:false};
    }
    const dt=now-a.startTime;
    if(dt<a.cruiseMs){
      return {distance:a.startDistance+a.startVelocity*dt,finished:false};
    }
    const u=Math.min(1,(dt-a.cruiseMs)/a.decelMs);
    const cruiseEnd=a.startDistance+a.startVelocity*a.cruiseMs;
    // Smooth monotonic deceleration into the exact rebased target. No speed-up phase.
    const ease=1-Math.pow(1-u,3);
    return {distance:cruiseEnd+(a.targetDistance-cruiseEnd)*ease,finished:u>=1};
  }
  return new Promise(resolve=>{
    function frame(now){
      const elapsed=now-start;
      for(let c=0;c<4;c++){
        if(done[c])continue;
        let exactDistance,useBlur=false,finished=false;
        const a=special[c];
        if(a){
          const sm=specialMotion(c,now); exactDistance=sm.distance; finished=sm.finished;
        }else{
          const t=Math.min(1,elapsed/baseDurations[c]);
          exactDistance=totalSteps[c]*progress(t);useBlur=t<.52;finished=elapsed>=baseDurations[c];
        }
        const whole=Math.floor(exactDistance),frac=exactDistance-whole;
        const strip=reels[`reel${mode}${c+1}`],center=(starts[c]-whole+strip.length*10)%strip.length;
        if(whole!==lastWhole[c]||useBlur!==lastBlur[c]){lastWhole[c]=whole;lastBlur[c]=useBlur;fillTrack(c,strip,center,useBlur)}
        tracks[c].style.transform=`translate3d(0,${(-16.6666667 + frac*16.6666667).toFixed(5)}%,0)`;
        const normalT=Math.min(1,elapsed/baseDurations[c]);
        columns[c].classList.toggle('running',!a&&normalT<.52);columns[c].classList.toggle('slow',!!a||normalT>=.52);
        if(finished){
          fillTrack(c,strip,targetStops[c],false);tracks[c].style.transform='translateY(-16.6666667%)';
          columns[c].classList.remove('running','slow','anticipating');columns[c].classList.add('settle');
          if(a){lastDebugCore=`REEL ${c+1}: LANDED\n`+lastDebugCore;refreshDebug();}
          setTimeout(()=>columns[c].classList.remove('settle'),75);done[c]=true;
          landedScatters[c]=targetMatrix[c].filter(sym=>sym==='F').length;
          // Only a physically landed second scatter can start the sequence.
          beginSequence(now);
          advanceSequence(c,now);
        }
      }
      if(done.every(Boolean))resolve();else requestAnimationFrame(frame)
    }requestAnimationFrame(frame)
  })
}
async function spinOnce(mode,isFeature=false,forcedStops=null){
  const stops=forcedStops?forcedStops.slice():chooseStops(mode);
  await animateSpin(mode,stops);draw(mode,stops);
  const result=isFeature?evaluateFeatureSpin(mode,currentMatrix):evaluateSpin(mode,currentMatrix);
  renderDebug(result,stops,currentMatrix);
  if(isFeature){lastDebugCore=`FEATURE SPIN · ${mode}\n`+lastDebugCore+`\n\nFEATURE TOTAL: ${featureTotal.toFixed(2)}`;refreshDebug()}
  return result;
}
function money(v){return Number(v).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}
function updateAccount(){creditEl.textContent=money(credit);stakeEl.textContent=money(stake);winEl.textContent=money(lastWin)}
function setScreen(el,on){el.classList.toggle('active',on)}
function enterBase(){gameState='BASE_GAME';game.classList.remove('feature-mode');setScreen(splash,false);setScreen(featureEntry,false);setScreen(featureComplete,false);spin.disabled=false;status.textContent='GOOD LUCK!';refreshDebug()}
function showFeatureEntry(n){
  gameState='FEATURE_ENTRY';pendingFreeSpins=n;spin.disabled=true;
  featureEntryPanel.src=`assets/free/Enter_FreeSpins_Panel_${n}.png`;setScreen(featureEntry,true);
}
async function startFeature(){
  if(gameState!=='FEATURE_ENTRY')return;
  setScreen(featureEntry,false);game.classList.add('feature-mode');gameState='FREE_SPINS';
  freeSpinsLeft=pendingFreeSpins;featureTotal=0;featureCreditPending=0;lastWin=0;featureWinEl.textContent='0.00';freeLeftEl.textContent=freeSpinsLeft;updateAccount();
  await new Promise(r=>setTimeout(r,350));
  while(freeSpinsLeft>0){
    status.textContent=`FREE SPIN ${pendingFreeSpins-freeSpinsLeft+1} OF ${pendingFreeSpins}`;
    const mode='F'+['A','B','C','D'][Math.floor(Math.random()*4)];
    const result=await spinOnce(mode,true);
    featureTotal+=result.totalWin*stake;featureCreditPending=featureTotal;lastWin=result.totalWin*stake;freeSpinsLeft--;freeLeftEl.textContent=freeSpinsLeft;featureWinEl.textContent=money(featureTotal);updateAccount();
    status.textContent=result.collectorActive?`COLLECT x${result.collectorMultiplier} · ${result.totalWin.toFixed(2)}`:(result.totalWin>0?`FREE SPIN WIN ${result.totalWin.toFixed(2)}`:'FREE SPIN');
    await new Promise(r=>setTimeout(r,result.totalWin>0?850:420));
  }
  gameState='FEATURE_COMPLETE';featureTotalEl.textContent=featureTotal.toFixed(2);setScreen(featureComplete,true);status.textContent=`FEATURE WIN ${featureTotal.toFixed(2)}`;
}
function finishFeature(){if(gameState!=='FEATURE_COMPLETE')return;setScreen(featureComplete,false);game.classList.remove('feature-mode');if(!debugFeatureRun){credit+=featureCreditPending;totalReturned+=featureCreditPending}lastWin=featureTotal;featureCreditPending=0;updateAccount();if(debugFeatureRun){lastDebugCore='DEBUG FEATURE COMPLETE (excluded from RTP/accountancy)\n'+lastDebugCore}refreshDebug();debugFeatureRun=false;gameState='BASE_GAME';spin.disabled=false;status.textContent=featureTotal>0?'WINNER!!!':'GOOD LUCK!'}
async function doSpin(){
  if(busy||gameState!=='BASE_GAME')return;
  const forced=forceFeatureArmed;
  forceFeatureArmed=false;
  if(!forced&&credit<stake){status.textContent='INSUFFICIENT CREDIT';return}
  busy=true;game.classList.add('spinning');spin.disabled=true;lastWin=0;
  if(!forced){credit-=stake;paidSpins++;totalStaked+=stake}
  updateAccount();refreshDebug();status.textContent='SPINNING...';
  // Debug feature test: A/0,0,0,0 visibly lands one F on every reel. This travels
  // through the normal reel/anticipation/result pipeline rather than jumping to the feature.
  const mode=forced?'A':chooseMode(),result=await spinOnce(mode,false,forced?[0,0,0,0]:null);
  lastWin=result.totalWin*stake;
  if(!forced){credit+=lastWin;totalReturned+=lastWin}
  updateAccount();
  if(forced){lastDebugCore='DEBUG: FEATURE FORCED (excluded from RTP/accountancy)\n'+lastDebugCore}
  refreshDebug();
  status.textContent=result.totalWin>0?'WINNER!!!':'GOOD LUCK!';
  game.classList.remove('spinning');busy=false;
  if(result.freeSpins){
    autoplayActive=false;document.querySelector('#autoplay').classList.remove('active');
    debugFeatureRun=forced;
    await new Promise(r=>setTimeout(r,900));showFeatureEntry(result.freeSpins);
  }else{
    spin.disabled=false;
    if(autoplayActive){await new Promise(r=>setTimeout(r,result.totalWin>0?650:260));if(autoplayActive&&!busy&&gameState==='BASE_GAME')doSpin()}
  }
}
function continueAction(){
  if(gameState==='START')enterBase();
  else if(gameState==='FEATURE_ENTRY')startFeature();
  else if(gameState==='FEATURE_COMPLETE')finishFeature();
}
spin.addEventListener('click',doSpin);
document.querySelector('#settings').addEventListener('click',()=>{
  if(busy||gameState!=='BASE_GAME')return;
  autoplayActive=false;document.querySelector('#autoplay').classList.remove('active');
  forceFeatureArmed=true;status.textContent='DEBUG: FORCE FEATURE';
  lastDebugCore='DEBUG: next spin forced to 4-scatter feature trigger\n(excluded from Session RTP and credit accountancy)';refreshDebug();
  setTimeout(()=>{if(forceFeatureArmed&&!busy&&gameState==='BASE_GAME')doSpin()},250);
});
document.querySelector('#autoplay').addEventListener('click',()=>{
  if(gameState!=='BASE_GAME')return;
  autoplayActive=!autoplayActive;document.querySelector('#autoplay').classList.toggle('active',autoplayActive);
  if(autoplayActive){if(!busy)doSpin()}
  else if(!busy)status.textContent='GOOD LUCK!';
});
[splash,featureEntry,featureComplete].forEach(el=>el.addEventListener('click',continueAction));
addEventListener('keydown',e=>{
  if(e.code!=='Space'||e.repeat)return;const tag=(e.target?.tagName||'').toLowerCase();if(['input','textarea','select'].includes(tag)||e.target?.isContentEditable)return;e.preventDefault();
  if(['START','FEATURE_ENTRY','FEATURE_COMPLETE'].includes(gameState))continueAction();else doSpin();
});
updateAccount();refreshDebug();
const initialMode='A',initialStops=chooseStops(initialMode);draw(initialMode,initialStops);renderer.setAnimationLoop(()=>renderer.render(scene,camera));
