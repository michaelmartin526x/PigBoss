// Frozen pure evaluator extracted verbatim from the supplied v0.20.7 for regression comparison.
const MODES=[['A',410],['B',410],['C',45],['D',45],['E',45],['F',45]];
const paylines=[[[0,1],[1,1],[2,1],[3,1]],[[0,0],[1,0],[2,0],[3,0]],[[0,2],[1,2],[2,2],[3,2]],[[0,3],[1,3],[2,3],[3,3]],[[0,0],[1,1],[2,2],[3,3]],[[0,3],[1,2],[2,1],[3,0]],[[0,1],[1,0],[2,0],[3,0]],[[0,2],[1,1],[2,1],[3,1]],[[0,3],[1,2],[2,2],[3,2]],[[0,1],[1,0],[2,1],[3,0]],[[0,2],[1,1],[2,2],[3,1]],[[0,3],[1,2],[2,3],[3,2]]];
const pay={W:[0,0,1000,5000],M:[0,0,500,2000],G:[0,0,300,1500],D:[0,0,200,1000],E:[0,0,200,1000],A:[0,0,50,250],K:[0,0,50,250],Q:[0,0,50,250],J:[0,0,50,250],T:[0,0,50,250],C:[0,0,50,250]};
const GEM_VALUES={Z:20,Y:10,X:8,V:5,U:3,S:2,R:1};
const GEM_SYMBOLS=new Set(Object.keys(GEM_VALUES));

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

export {evaluateSpin,evaluateFeatureSpin};
