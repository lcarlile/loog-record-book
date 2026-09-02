/* Folds draft-raw.json + players.json into espn.json for the page build. */
const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('draft-raw.json', 'utf8'));
const P   = JSON.parse(fs.readFileSync('players.json', 'utf8'));
const e   = JSON.parse(fs.readFileSync('espn.json', 'utf8'));

e.draftR1 = raw.r1.map(s => { const [y,m,id] = s.split('|'); return [ +y, m, P[id] ]; });
e.draftedEveryYear = raw.mostDrafted.filter(s => +s.split(':')[1] === 9).map(s => P[s.split(':')[0]]);
e.favourite = {};
raw.favourite.forEach(s => { const [m,id,c] = s.split(':'); e.favourite[m] = [P[id], +c]; });
e.weeklyHigh = raw.weeklyHigh;
e.weeklyLow  = raw.weeklyLow;
e.heartbreak = raw.heartbreak;
e.lopsided   = raw.lopsided;
e.closest    = raw.closest;
e.regularSeasonWeeks = raw.regularSeasonWeeks;

fs.writeFileSync('espn.json', JSON.stringify(e, null, 1));
console.log('espn.json extended');
console.log('  round-1 picks   :', e.draftR1.length);
console.log('  drafted 9/9 yrs :', e.draftedEveryYear.length);
console.log('  weekly highs sum:', Object.values(e.weeklyHigh).reduce((a,b)=>a+b,0), '(want 122)');
console.log('  weekly lows sum :', Object.values(e.weeklyLow).reduce((a,b)=>a+b,0), '(want 122)');
