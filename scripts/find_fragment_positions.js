/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('fs');
const s=fs.readFileSync('app/page.tsx','utf8');
let idx=0;
while(true){
	const i=s.indexOf('<>', idx);
	if(i===-1) break;
	const start=Math.max(0,i-40);
	const end=Math.min(s.length,i+40);
	console.log('pos',i,'context:\n'+s.slice(start,end).replace(/\n/g,'\\n'));
	idx=i+2;
}
console.log('done');