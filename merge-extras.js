/* Folds draft-raw.json + players.json + draft-grades.json into espn.json. Idempotent. */
const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('draft-raw.json', 'utf8'));
const P   = JSON.parse(fs.readFileSync('players.json', 'utf8'));
const G   = JSON.parse(fs.readFileSync('draft-grades.json', 'utf8'));
const e   = JSON.parse(fs.readFileSync('espn.json', 'utf8'));

/* draft board */
e.draftR1 = raw.r1.map(s => { const [y,m,id] = s.split('|'); return [ +y, m, P[id] ]; });
e.draftedEveryYear = raw.mostDrafted.filter(s => +s.split(':')[1] === 9).map(s => P[s.split(':')[0]]);
e.favourite = {};
raw.favourite.forEach(s => { const [m,id,c] = s.split(':'); e.favourite[m] = [P[id], +c]; });

/* box-score extras */
e.weeklyHigh = raw.weeklyHigh;
e.weeklyLow  = raw.weeklyLow;
e.heartbreak = raw.heartbreak;
e.lopsided   = raw.lopsided;
e.evenRivalry = raw.closest;          // dead-even rivalries (strings) - was wrongly named `closest`
e.closest    = G.closestFinish;       // closest single-game finishes (arrays) - what the record book needs
e.regularSeasonWeeks = raw.regularSeasonWeeks;

/* draft grades */
const split = (s, n) => { const [k, v] = s.split('='); const [val, letter] = v.split(':'); return [k, +val, letter]; };
e.draftGrade = {};
G.grades.forEach(s => { const [k, val, letter] = split(s); e.draftGrade[k] = [val, letter]; });
e.draftCareer = G.career.map(s => { const [m, v, l] = s.split(':'); return [m, +v, l]; });
const pick = s => { const [y,m,n,pos,r,val,pts] = s.split('|'); return [+y,m,n,pos,r,val,+pts]; };
e.steals    = G.steals.map(pick);
e.busts     = G.busts.map(pick);
e.bestKeeps = G.bestKeeps.map(t => { const [y,m,n,r,val,pts] = t.split("|"); return [+y,m,n,r,val,+pts]; });
e.draftTotals = G.totals;
e.draftMethod = G.method;
delete e.keepsByMgr;   // superseded by keeperValue
e.bestDrafts = G.bestDrafts.map(t => { const [who, rest] = t.split("=");
  const [val, letter] = rest.split(":");
  const i = who.lastIndexOf(" ");
  return [who.slice(0,i), +who.slice(i+1), +val, letter]; });
e.keeperValue = G.keeperValue.map(t => { const [m,v,n] = t.split(":"); return [m, +v, +n]; });

fs.writeFileSync('espn.json', JSON.stringify(e, null, 1));
console.log('espn.json merged');
console.log('  closest (finishes) :', e.closest.length, 'arrays  ->', e.closest[0].join(' '));
console.log('  evenRivalry        :', e.evenRivalry.length, 'strings ->', e.evenRivalry[0]);
console.log('  draftGrade entries :', Object.keys(e.draftGrade).length);
console.log('  steals/busts/keeps :', e.steals.length, e.busts.length, e.bestKeeps.length);
