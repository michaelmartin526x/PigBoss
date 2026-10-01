import fs from 'node:fs';
import { createRules } from '../engine/rules.js';
import { seededRandom } from '../engine/random.js';
import { DECLARED_RTP } from '../engine/config.js';
const spins=Number(process.argv[2]||1000000),seed=Number(process.argv[3]||20260929);
if(!Number.isSafeInteger(spins)||spins<2||spins>100000000)throw new Error('Use 2–100000000 paid spins');
const reels=JSON.parse(fs.readFileSync(new URL('../reels.json',import.meta.url),'utf8'));
const rules=createRules(reels,seededRandom(seed));
let total=0,base=0,feature=0,features=0,freeSpins=0,hits=0,mean=0,m2=0,max=0;
for(let i=0;i<spins;i++){
  const r=rules.resolve().result;
  let cycle=r.totalWin;base+=r.totalWin;
  if(r.freeSpins)features++;
  for(let f=0;f<r.freeSpins;f++){const award=rules.resolve(true).result.totalWin;cycle+=award;feature+=award;freeSpins++}
  total+=cycle;if(cycle>0)hits++;max=Math.max(max,cycle);
  const delta=cycle-mean;mean+=delta/(i+1);m2+=delta*(cycle-mean);
}
const margin=1.96*Math.sqrt(m2/(spins-1)/spins)*100;
console.log(JSON.stringify({seed,paidSpins:spins,freeSpins,features,observedRtpPercent:total/spins*100,
  approximate95PercentInterval:[mean*100-margin,mean*100+margin],baseRtpPercent:base/spins*100,
  featureRtpPercent:feature/spins*100,paidCycleHitRatePercent:hits/spins*100,maxPaidCycleWinInStakes:max,
  declaredReferenceRtpPercent:DECLARED_RTP,note:'Seeded Monte Carlo estimate, not theoretical RTP or certification. Each sample includes the complete triggered feature.'},null,2));
