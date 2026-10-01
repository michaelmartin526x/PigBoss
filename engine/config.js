export const MODES=[['A',410],['B',410],['C',45],['D',45],['E',45],['F',45]];
export const paylines=[[[0,1],[1,1],[2,1],[3,1]],[[0,0],[1,0],[2,0],[3,0]],[[0,2],[1,2],[2,2],[3,2]],[[0,3],[1,3],[2,3],[3,3]],[[0,0],[1,1],[2,2],[3,3]],[[0,3],[1,2],[2,1],[3,0]],[[0,1],[1,0],[2,0],[3,0]],[[0,2],[1,1],[2,1],[3,1]],[[0,3],[1,2],[2,2],[3,2]],[[0,1],[1,0],[2,1],[3,0]],[[0,2],[1,1],[2,2],[3,1]],[[0,3],[1,2],[2,3],[3,2]]];
export const pay={W:[0,0,1000,5000],M:[0,0,500,2000],G:[0,0,300,1500],D:[0,0,200,1000],E:[0,0,200,1000],A:[0,0,50,250],K:[0,0,50,250],Q:[0,0,50,250],J:[0,0,50,250],T:[0,0,50,250],C:[0,0,50,250]};
export const GEM_VALUES={Z:20,Y:10,X:8,V:5,U:3,S:2,R:1};
export const GEM_SYMBOLS=new Set(Object.keys(GEM_VALUES));


export const LAYOUT = Object.freeze({ columns: 4, rows: 4, cellWidth: 165, cellHeight: 145 });
export const MOTION = Object.freeze({ durations: [1080,1270,1460,1650], steps: [22,26,30,34] });
export const DECLARED_RTP = 96.651;
export const SPINE_SYMBOLS = ['A','D','E','F','G','J','K','M','Q','R','S','T','U','V','W','X','Y','Z'];
export const BLUR_SYMBOLS = new Set([...SPINE_SYMBOLS, 'C']);
