const fs = require('fs');
const SRC = '/Users/logancarlile/Downloads/LoOG Record Book Worksheet - Sheet1.csv';
const rows = fs.readFileSync(SRC, 'utf8').split(/\r?\n/).map(l => l.split(','));

const managers = {};       // name -> seasons[]
const blocks = {};         // trailing tables
let table = null;

for (const r of rows) {
  const c0 = (r[0]||'').trim();
  if (!c0) continue;
  if (c0 === 'Team') continue;
  if (c0.startsWith('Career')) continue;

  // trailing named tables
  if (['Playoffs','Division Titles','Playoff Appearances','Most Seasons With Losing Record',
       'Most Seasons With Winning Record','Most Second Place Finishes'].includes(c0)) {
    table = c0; blocks[table] = {}; continue;
  }

  const year = parseInt(r[1], 10);
  if (Number.isInteger(year) && year > 2000) {
    table = null;
    (managers[c0] = managers[c0] || []).push({
      year, w: +r[2], l: +r[3], pf: +r[4], pa: +r[5],
      pfpg: +r[6], papg: +r[7], note: (r[8]||'').trim() || null,
    });
    continue;
  }
  if (table) {
    blocks[table][c0] = table === 'Playoffs'
      ? { w: +r[1], l: +r[2] }
      : +r[1];
  }
}

// ESPN-verified corrections to the spreadsheet. The sheet is exact on W/L/PF/PA
// (all 96 season rows match the box scores); these three fields were not.
const ESPN = JSON.parse(fs.readFileSync("espn.json", "utf8"));

const out = [];
for (const [name, seasons] of Object.entries(managers)) {
  seasons.sort((a,b)=>a.year-b.year);
  // "Biggest Loser" is the last-place finisher in ESPN's final standings. The sheet
  // applied that rule in some years and "worst regular-season record" in others.
  seasons.forEach(s => {
    if (s.note === "Biggest Loser") s.note = null;
    if (ESPN.lastPlace[s.year] === name) s.note = "Biggest Loser";
  });
  const sum = (k)=>seasons.reduce((s,x)=>s+x[k],0);
  const w = sum('w'), l = sum('l');
  const po = blocks['Playoffs'][name] || {w:0,l:0};
  out.push({
    name, seasons,
    w, l, g: w+l, pct: w/(w+l),
    pf: +sum('pf').toFixed(2), pa: +sum('pa').toFixed(2),
    pfpg: +(sum('pf')/(w+l)).toFixed(2), papg: +(sum('pa')/(w+l)).toFixed(2),
    titles:   seasons.filter(s=>s.note==='Champion').length,
    runnerUp: seasons.filter(s=>s.note==='Runner Up').length,
    loser:    seasons.filter(s=>s.note==='Biggest Loser').length,
    winningSeasons: seasons.filter(s=>s.w>s.l).length,
    losingSeasons:  seasons.filter(s=>s.w<s.l).length,
    tiedSeasons:    seasons.filter(s=>s.w===s.l).length,
    playoffW: po.w, playoffL: po.l,
    // sheet undercounted playoff appearances by 6 and division titles by 2
    playoffApps: (ESPN.playoffYears[name] || []).length,
    playoffYears: ESPN.playoffYears[name] || [],
    divTitles:   ESPN.divTitles[name],
    sheetApps:   blocks["Playoff Appearances"][name],
    sheetDiv:    blocks["Division Titles"][name],
  });
}
out.sort((a,b)=>b.pct-a.pct);

// ---- verify sheet aggregates against recomputed values
console.log('=== cross-check vs sheet trailing tables ===');
for (const m of out) {
  const msgs = [];
  const sheetWin = blocks['Most Seasons With Winning Record'][m.name];
  const sheetLose = blocks['Most Seasons With Losing Record'][m.name];
  const sheet2nd = blocks['Most Second Place Finishes'][m.name];
  if (sheetWin !== m.winningSeasons) msgs.push(`winning ${sheetWin}->${m.winningSeasons}`);
  if (sheetLose !== m.losingSeasons) msgs.push(`losing ${sheetLose}->${m.losingSeasons}`);
  if (sheet2nd !== m.runnerUp) msgs.push(`2nd ${sheet2nd}->${m.runnerUp}`);
  if (m.playoffApps !== null && m.playoffApps < (m.playoffW+m.playoffL>0?1:0)) msgs.push('apps<games');
  console.log(String(m.name).padEnd(9), `${m.w}-${m.l}`.padEnd(8), (m.pct*100).toFixed(1).padStart(5),
    'sea='+m.seasons.length, 'W/L/T='+[m.winningSeasons,m.losingSeasons,m.tiedSeasons].join('/'),
    'po='+m.playoffW+'-'+m.playoffL, 'apps='+m.playoffApps, 'div='+m.divTitles,
    msgs.length? '  ⚠ '+msgs.join(' ') : '');
}
const years = [...new Set(out.flatMap(m=>m.seasons.map(s=>s.year)))].sort();
console.log('\nyears:', years.join(','));
for (const y of years) {
  const f = out.flatMap(m=>m.seasons.filter(s=>s.year===y).map(s=>({...s,name:m.name})));
  const ch=f.find(s=>s.note==='Champion'), ru=f.find(s=>s.note==='Runner Up'), bl=f.find(s=>s.note==='Biggest Loser');
  console.log(y, 'teams='+f.length, 'champ='+(ch?.name||'—'), 'ru='+(ru?.name||'—'), 'loser='+(bl?.name||'—'));
}
fs.writeFileSync('data.json', JSON.stringify(out, null, 1));
console.log('\nwrote data.json');
