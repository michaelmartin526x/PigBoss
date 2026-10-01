import { MODES, paylines, pay, GEM_VALUES, GEM_SYMBOLS, LAYOUT } from './config.js';
export function transformGemsToC(m){return m.map(col=>col.map(s=>GEM_SYMBOLS.has(s)?'C':s))}
export function evaluateLines(m){
  const wins=[]; let total=0;
  paylines.forEach((line,i)=>{
    const seq=line.map(([c,r])=>m[c][r]),s=seq[0]; if(!pay[s])return;
    let n=1; while(n<4&&seq[n]===s)n++;
    if(n>=3){const amount=pay[s][n-1]/100;total+=amount;wins.push({line:i+1,symbol:s,count:n,amount,positions:line.slice(0,n)})}
  });
  return {total,wins};
}
export function scatter(m){return m.flat().filter(s=>s==='F').length}
export function evaluateSpin(mode,m){
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
export function evaluateFeatureSpin(mode,m){
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

export function createRules(reels, random = Math.random) {
  const modes = [...MODES.map(([name]) => name), 'FA','FB','FC','FD'];
  for (const mode of modes) for (let c=1; c<=LAYOUT.columns; c++) {
    const strip = reels['reel'+mode+c];
    if (!Array.isArray(strip) || strip.length < LAYOUT.rows || strip.some(s => ![...Object.keys(pay), ...GEM_SYMBOLS, 'F'].includes(s))) {
      throw new Error('Invalid reel strip: '+mode+c);
    }
  }
  const chooseMode = () => {
    let x = random() * MODES.reduce((sum,[,weight]) => sum+weight,0);
    for (const [mode,weight] of MODES) { x-=weight; if(x<0) return mode; }
    return MODES[0][0];
  };
  const chooseStops = mode => Array.from({length:LAYOUT.columns},(_,c) => Math.floor(random()*reels['reel'+mode+(c+1)].length));
  const matrixFromStops = (mode,stops) => {
    if (!modes.includes(mode) || stops.length !== LAYOUT.columns) throw new Error('Invalid stops');
    return stops.map((p,c) => {
      const strip = reels['reel'+mode+(c+1)];
      if (!Number.isInteger(p) || p<0 || p>=strip.length) throw new Error('Invalid stop');
      return Array.from({length:LAYOUT.rows},(_,r)=>strip[(p+r-1+strip.length)%strip.length]);
    });
  };
  return {chooseMode, chooseStops, matrixFromStops,
    resolve(isFeature=false, forced) {
      const mode = forced?.mode ?? (isFeature ? 'F'+['A','B','C','D'][Math.floor(random()*4)] : chooseMode());
      const stops = forced?.stops?.slice() ?? chooseStops(mode);
      const matrix = matrixFromStops(mode,stops);
      return {mode, stops, matrix, result: isFeature ? evaluateFeatureSpin(mode,matrix) : evaluateSpin(mode,matrix)};
    }
  };
}
