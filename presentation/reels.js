import { LAYOUT, MOTION } from '../engine/config.js';
import { anticipationPlan, anticipationDistance, presentationStrip, wrap } from './motion.js';

export function createReelAnimator({reels,matrixFromStops,spineSymbols,columns,tracks,fillTrack,report}) {
async function animateSpin(mode,targetStops){
  spineSymbols.resetToPng();
  const baseDurations=MOTION.durations;
  const targetMatrix=matrixFromStops(mode,targetStops);
  const totalSteps=MOTION.steps;
  // Preserve the reference normal-spin travel and timing.
  const starts=targetStops.map((p,c)=>{const strip=reels[`reel${mode}${c+1}`];return(p+totalSteps[c])%strip.length});
  const lastWhole=[-1,-1,-1,-1],lastBlur=[null,null,null,null],done=[false,false,false,false],start=performance.now();
  const landedScatters=[0,0,0,0];
  const special=[null,null,null,null];
  const presentationStrips=[null,null,null,null];
  const anticipationTiming=[];
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
  function makePresentationStrip(c,targetDistance){
    return presentationStrip(reels['reel'+mode+(c+1)],starts[c],targetDistance,targetMatrix[c]).strip;
  }
  function startHold(c,now){
    if(done[c]||special[c])return;
    const m=normalMotion(c,now);
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
    // Hard rule: never reverse and never accelerate when anticipation starts.
    v=Math.max(v,0.0018);
    const decelMs=500;
    const cruiseMs=Math.max(0,duration);
    // Choose a nearby FORWARD presentation landing. It does not need to be an
    // 80-stop-equivalent absolute coordinate because the temporary strip below
    // carries the already-determined final symbols into that landing window.
    const plan=anticipationPlan(d,v,cruiseMs,decelMs);
    presentationStrips[c]=makePresentationStrip(c,plan.targetDistance);
    special[c]={phase:'anticipate',startTime:now,...plan,distance:d,velocity:v,wallStart:now};
    lastWhole[c]=-1;
    columns[c].classList.add('anticipating');
    try{spineSymbols.startAnticipationFx(c)}catch(_){}
    report(`REEL ${c+1}: ANTICIPATING (${(duration/1000).toFixed(2)}s + 0.50s decel)`);
  }
  function beginSequence(now){
    if(sequenceActive||landedScatters.reduce((a,b)=>a+b,0)<2)return;
    sequenceActive=true;
    // Stage 1: reel 3 teases. Reel 4 is intercepted and kept genuinely moving,
    // so it cannot quietly land while reel 3 is doing its tease.
    if(!done[2])startAnticipation(2,now,1000);
    if(!done[3])startHold(3,now);
  }
  function advanceSequence(c,now){
    // Reel 4 gets its OWN tease only after reel 3 has physically landed.
    // This is true whether reel 3 hit the third scatter or missed it: reel 4 may
    // be teasing the feature itself, or the 10->15 spin upgrade.
    if(sequenceActive&&c===2&&!done[3])startAnticipation(3,now,1300);
  }
  function specialMotion(c,now){
    const a=special[c];
    if(a.phase==='hold'){
      const dt=now-a.startTime;
      return {distance:a.startDistance+a.startVelocity*dt,finished:false};
    }
    const dt=now-a.startTime;
    return {distance:anticipationDistance(a,dt),finished:dt>=a.cruiseMs+a.decelMs};
  }

  return new Promise((resolve,reject)=>{
    function frame(now){
      try {
      const elapsed=now-start;
      for(let c=0;c<LAYOUT.columns;c++){
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
        const realStrip=reels[`reel${mode}${c+1}`],strip=(a&&presentationStrips[c])?presentationStrips[c]:realStrip,center=(starts[c]-whole+strip.length*10)%strip.length;
        if(whole!==lastWhole[c]||useBlur!==lastBlur[c]){lastWhole[c]=whole;lastBlur[c]=useBlur;fillTrack(c,strip,center,useBlur)}
        tracks[c].style.transform=`translate3d(0,${(-16.6666667 + frac*16.6666667).toFixed(5)}%,0)`;
        const normalT=Math.min(1,elapsed/baseDurations[c]);
        columns[c].classList.toggle('running',!a&&normalT<.52);columns[c].classList.toggle('slow',!!a||normalT>=.52);
        if(finished){
          fillTrack(c,strip,a?wrap(starts[c]-a.targetDistance,strip.length):targetStops[c],false);tracks[c].style.transform='translateY(-16.6666667%)';
          // Presentation is deliberately non-blocking: mark gameplay landing first, then notify Spine safely.
          columns[c].classList.remove('running','slow','anticipating');columns[c].classList.add('settle');
          try{spineSymbols.stopAnticipationFx(c)}catch(_){}
          if(a){const actual=(now-a.wallStart)/1000;anticipationTiming.push(`R${c+1} total anticipation-to-land: ${actual.toFixed(2)}s`);report(`REEL ${c+1}: LANDED · ${actual.toFixed(2)}s`);}
          setTimeout(()=>columns[c].classList.remove('settle'),75);done[c]=true;
          // Spine cannot delay or abort reel completion.
          try{spineSymbols.landColumn(c,targetMatrix[c])}catch(err){console.error('Non-fatal Spine landing error',err)}
          landedScatters[c]=targetMatrix[c].filter(sym=>sym==='F').length;
          // Only a physically landed second scatter can start the sequence.
          beginSequence(now);
          advanceSequence(c,now);
        }
      }
      if(done.every(Boolean)){if(anticipationTiming.length){report(`ANTICIPATION TIMING\n${anticipationTiming.join('\n')}`);}resolve()}else requestAnimationFrame(frame)
      } catch(error) { reject(error); }
    }requestAnimationFrame(frame)
  })
}

return animateSpin;
}
