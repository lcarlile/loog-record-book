'use strict';
/* Turns the raw ESPN pull into data.json + espn.json. Every rule the league
   actually plays by lives here, so next year is one command. */
const fs = require('fs');

const path = require('path');
const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const r2 = n => +n.toFixed(2);
const POS = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };

function run({ season, YEARS, CHECK, CFG, dir }) {
  /* Rules that differ between leagues. lastPlace.recordThrough is the last season
     the wooden spoon went to the worst record; null means the consolation bracket
     always decided it. */
  const RULES = (CFG && CFG.rules) || {};
  const LAST_BY_RECORD_THROUGH = (RULES.lastPlace && RULES.lastPlace.recordThrough) || 0;
  const KEEPERS = !!(RULES.keepers && RULES.keepers.enabled);
  /* Some leagues only play/acknowledge the first N rounds of the consolation ladder;
     ESPN schedules a final round regardless. When set, the wooden spoon goes to whoever
     loses every one of those N rounds, and the teams below the playoff cut are ranked
     by that record rather than by ESPN's final placing. */
  const CONS_ROUNDS = (RULES.lastPlace && RULES.lastPlace.consolationRounds) || 0;
  const KEEPER_OFFSET = (RULES.keepers && RULES.keepers.costOffset) || 1;
  const OUT = dir || __dirname;
  fs.mkdirSync(OUT, { recursive: true });
  const LAST = YEARS[YEARS.length - 1];
  const names = [...new Set(YEARS.flatMap(y => season[y].teams.map(t => t.m)))];

  /* ---- per-season finishes ---- */
  const finish = {};                                   // year -> {champ, ru, third, last}
  YEARS.forEach(y => {
    const ts = season[y].teams, n = ts.length;
    const champ = ts.find(t => t.fin === 1), ru = ts.find(t => t.fin === 2);
    const byRecord = ts.slice().sort((a, b) => (a.w - a.l) - (b.w - b.l) || a.pf - b.pf)[0];
    const byBracket = ts.find(t => t.fin === n);
    const third = ts.find(t => t.fin === 3);

    let last = (y <= LAST_BY_RECORD_THROUGH ? byRecord : byBracket);
    if (CONS_ROUNDS) {
      const cons = season[y].sched.filter(g => g.tier === 'LOSERS_CONSOLATION_LADDER');
      const wks = [...new Set(cons.map(g => g.wk))].sort((a, b) => a - b).slice(0, CONS_ROUNDS);
      const rec = {};
      cons.filter(g => wks.includes(g.wk) && g.as !== g.bs).forEach(g => {
        const w = g.as > g.bs ? g.a : g.b, l = g.as > g.bs ? g.b : g.a;
        (rec[w] = rec[w] || [0, 0])[0]++; (rec[l] = rec[l] || [0, 0])[1]++;
      });
      const winless = Object.keys(rec).filter(m => rec[m][0] === 0);
      if (winless.length === 1) last = ts.find(t => t.m === winless[0]) || last;
      /* re-rank below the playoff cut: consolation wins, then record, then points */
      const inBracket = new Set(season[y].sched
        .filter(g => g.tier === 'WINNERS_BRACKET').flatMap(g => [g.a, g.b]));
      const below = ts.filter(t => !inBracket.has(t.m))
        .sort((a, b) => ((rec[b.m] || [0])[0] - (rec[a.m] || [0])[0])
                     || ((b.w - b.l) - (a.w - a.l)) || (b.pf - a.pf));
      below.forEach((t, i) => t.fin = inBracket.size + i + 1);
    }
    finish[y] = { champ: champ && champ.m, ru: ru && ru.m, third: third && third.m,
                  last: last.m };
  });

  /* ---- playoffs & divisions ---- */
  const po = {}, playoffYears = {}, divTitles = {};
  names.forEach(n => { po[n] = [0, 0]; playoffYears[n] = []; divTitles[n] = 0; });
  YEARS.forEach(y => {
    const seen = new Set();
    season[y].sched.filter(g => g.tier === 'WINNERS_BRACKET').forEach(g => {
      if (g.as === g.bs) return;
      const w = g.as > g.bs ? g.a : g.b, l = g.as > g.bs ? g.b : g.a;
      po[w][0]++; po[l][1]++; seen.add(g.a); seen.add(g.b);
    });
    seen.forEach(n => playoffYears[n].push(y));
    const byDiv = {};
    season[y].teams.forEach(t => (byDiv[t.div] = byDiv[t.div] || []).push(t));
    Object.values(byDiv).forEach(d => {
      const win = d.slice().sort((a, b) => (b.w - b.l) - (a.w - a.l) || b.pf - a.pf)[0];
      divTitles[win.m]++;
    });
  });

  /* ---- manager records ---- */
  const managers = names.map(name => {
    const seasons = YEARS.filter(y => season[y].teams.some(t => t.m === name)).map(y => {
      const t = season[y].teams.find(x => x.m === name);
      const g = t.w + t.l;
      const note = finish[y].champ === name ? 'Champion'
                 : finish[y].ru === name ? 'Runner Up'
                 : finish[y].last === name ? 'Biggest Loser'
                 : finish[y].third === name ? 'Third' : null;
      return { year: y, w: t.w, l: t.l, pf: t.pf, pa: t.pa,
               pfpg: r2(t.pf / g), papg: r2(t.pa / g), note, fin: t.fin };
    });
    const sum = k => seasons.reduce((s, x) => s + x[k], 0);
    const w = sum('w'), l = sum('l');
    return { name, seasons, w, l, g: w + l, pct: w / (w + l),
             pf: r2(sum('pf')), pa: r2(sum('pa')),
             pfpg: r2(sum('pf') / (w + l)), papg: r2(sum('pa') / (w + l)),
             titles: seasons.filter(s => s.note === 'Champion').length,
             runnerUp: seasons.filter(s => s.note === 'Runner Up').length,
             third: seasons.filter(s => s.note === 'Third').length,
             loser: seasons.filter(s => s.note === 'Biggest Loser').length,
             winningSeasons: seasons.filter(s => s.w > s.l).length,
             losingSeasons: seasons.filter(s => s.w < s.l).length,
             tiedSeasons: seasons.filter(s => s.w === s.l).length,
             playoffW: po[name][0], playoffL: po[name][1],
             playoffApps: playoffYears[name].length, playoffYears: playoffYears[name],
             divTitles: divTitles[name] };
  }).sort((a, b) => b.pct - a.pct);

  /* ---- box-score records ---- */
  const rows = YEARS.flatMap(y => season[y].sched.map(g => ({ y, ...g })));
  const teamGames = rows.flatMap(g => [
    { y: g.y, wk: g.wk, me: g.a, pts: g.as, opp: g.b, opp_pts: g.bs },
    { y: g.y, wk: g.wk, me: g.b, pts: g.bs, opp: g.a, opp_pts: g.as }]);
  const top = (a, k, n) => a.slice().sort((x, z) => z[k] - x[k]).slice(0, n);
  const bot = (a, k, n) => a.slice().sort((x, z) => x[k] - z[k]).slice(0, n);
  const gTuple = g => [g.me, g.pts, g.opp, g.opp_pts, g.y, g.wk];
  const marg = rows.filter(g => g.as !== g.bs).map(g => ({
    y: g.y, wk: g.wk, d: Math.abs(g.as - g.bs),
    w: g.as > g.bs ? g.a : g.b, wp: Math.max(g.as, g.bs),
    l: g.as > g.bs ? g.b : g.a, lp: Math.min(g.as, g.bs) }));
  const mTuple = m => [m.w, m.wp, m.l, m.lp, m.y, m.wk];

  /* head to head, streaks, luck, weekly highs */
  const H = {}, hb = {};
  rows.forEach(g => {
    if (g.as === g.bs) return;
    const w = g.as > g.bs ? g.a : g.b, l = g.as > g.bs ? g.b : g.a;
    (H[w] = H[w] || {})[l] = H[w][l] || [0, 0]; H[w][l][0]++;
    (H[l] = H[l] || {})[w] = H[l][w] || [0, 0]; H[l][w][1]++;
    if (Math.abs(g.as - g.bs) < 5) hb[l] = (hb[l] || 0) + 1;
  });
  const h2h = [];
  names.slice().sort().forEach((a, i) => names.slice().sort().forEach((b, j) => {
    if (j <= i || !H[a] || !H[a][b]) return;
    h2h.push(`${a}/${b} ${H[a][b][0]}-${H[a][b][1]}`);
  }));

  const ord = rows.slice().sort((p, q) => p.y - q.y || p.wk - q.wk);
  const seq = {};
  ord.forEach(g => { if (g.as === g.bs) return;
    (seq[g.a] = seq[g.a] || []).push([g.y, g.wk, g.as > g.bs]);
    (seq[g.b] = seq[g.b] || []).push([g.y, g.wk, g.bs > g.as]); });
  const streak = want => Object.fromEntries(names.map(n => {
    let c = 0, mx = 0, st = null, at = ['', ''];
    (seq[n] || []).forEach(([y, wk, won]) => {
      if (won === want) { if (!c) st = `${y} W${wk}`; c++; if (c > mx) { mx = c; at = [st, `${y} W${wk}`]; } }
      else c = 0; });
    return [n, [mx, at[0], at[1]]];
  }));

  const wk = {}, AP = {}, ACT = {};
  rows.forEach(g => { const k = `${g.y}-${g.wk}`; (wk[k] = wk[k] || []).push([g.a, g.as], [g.b, g.bs]); });
  rows.forEach(g => { if (g.as === g.bs) return;
    ACT[g.a] = ACT[g.a] || [0, 0]; ACT[g.b] = ACT[g.b] || [0, 0];
    ACT[g.as > g.bs ? g.a : g.b][0]++; ACT[g.as > g.bs ? g.b : g.a][1]++; });
  Object.values(wk).forEach(list => list.forEach(([n, p]) => {
    AP[n] = AP[n] || [0, 0];
    list.forEach(([m, q]) => { if (m === n) return; p > q ? AP[n][0]++ : p < q && AP[n][1]++; }); }));
  const luck = Object.fromEntries(names.map(n => {
    const ap = AP[n], ac = ACT[n];
    return [n, [+(ac[0] / (ac[0] + ac[1]) * 100).toFixed(1),
                +(ap[0] / (ap[0] + ap[1]) * 100).toFixed(1)]]; }));

  const regWk = {};
  rows.filter(g => g.tier === 'NONE').forEach(g => {
    const k = `${g.y}-${g.wk}`; (regWk[k] = regWk[k] || []).push([g.a, g.as], [g.b, g.bs]); });
  const weeklyHigh = {}, weeklyLow = {};
  Object.values(regWk).forEach(list => {
    const s = list.slice().sort((x, z) => z[1] - x[1]);
    weeklyHigh[s[0][0]] = (weeklyHigh[s[0][0]] || 0) + 1;
    weeklyLow[s[s.length - 1][0]] = (weeklyLow[s[s.length - 1][0]] || 0) + 1; });

  const pair = {};
  rows.forEach(g => { if (g.as === g.bs) return;
    const k = [g.a, g.b].sort().join('/');
    pair[k] = pair[k] || { g: 0, w: {} }; pair[k].g++;
    const w = g.as > g.bs ? g.a : g.b; pair[k].w[w] = (pair[k].w[w] || 0) + 1; });
  const ps = Object.entries(pair).filter(([, v]) => v.g >= 10).map(([k, v]) => {
    const [x, z] = k.split('/'), wx = v.w[x] || 0, wz = v.w[z] || 0;
    return { x, z, wx, wz, g: v.g, skew: Math.abs(wx / v.g - 0.5) }; });
  const lopsided = ps.slice().sort((a, b) => b.skew - a.skew).slice(0, 6)
    .map(r => r.wx >= r.wz ? `${r.x} ${r.wx}-${r.wz} ${r.z}` : `${r.z} ${r.wz}-${r.wx} ${r.x}`);
  const evenRivalry = ps.slice().sort((a, b) => a.skew - b.skew || b.g - a.g).slice(0, 6)
    .map(r => `${r.x} ${r.wx}-${r.wz} ${r.z} (${r.g}g)`);

  /* ---- draft ---- */
  const picks = YEARS.flatMap(y => season[y].picks).filter(p => p.pos != null);
  const byYP = {};
  picks.forEach(p => (byYP[`${p.y}|${p.pos}`] = byYP[`${p.y}|${p.pos}`] || []).push(p));
  Object.values(byYP).forEach(a => {
    a.slice().sort((x, z) => x.o - z.o).forEach((p, i) => p.dr = i + 1);
    a.slice().sort((x, z) => z.pts - x.pts).forEach((p, i) => p.fr = i + 1); });

  // keeper = ended last season on that roster and taken exactly one round earlier
  const draftedAt = {}; picks.forEach(p => { if (p.n) draftedAt[`${p.y}|${p.n}`] = p.r; });
  picks.forEach(p => {
    p.disc = false;
    if (!KEEPERS || p.y === YEARS[0] || !p.n) return;
    if (!season[p.y - 1] || !season[p.y - 1].roster[`${p.m}|${p.n}`]) return;
    const prev = draftedAt[`${p.y - 1}|${p.n}`];
    if (prev !== undefined && p.r === prev - KEEPER_OFFSET) p.disc = true; });

  // scoring changed over the years -> put seasons on a common scale
  const posAll = {}, posYr = {};
  picks.forEach(p => { (posAll[p.pos] = posAll[p.pos] || []).push(p.pts);
                       (posYr[`${p.pos}|${p.y}`] = posYr[`${p.pos}|${p.y}`] || []).push(p.pts); });
  picks.forEach(p => { const my = mean(posYr[`${p.pos}|${p.y}`]);
    p.np = p.pts * (my > 0 ? mean(posAll[p.pos]) / my : 1); });

  const realPicks = picks.filter(p => !p.disc);
  const byPR = {};
  realPicks.forEach(p => (byPR[`${p.pos}|${p.dr}`] = byPR[`${p.pos}|${p.dr}`] || []).push(p.np));
  const expect = (pos, dr) => { let v = [];
    for (let d = dr - 2; d <= dr + 2; d++) { const a = byPR[`${pos}|${d}`]; if (a) v = v.concat(a); }
    return v.length ? mean(v) : 0; };
  picks.forEach(p => p.val = p.np - expect(p.pos, p.dr));
  YEARS.forEach(y => { const c = mean(picks.filter(p => p.y === y && !p.disc).map(p => p.val));
    picks.filter(p => p.y === y).forEach(p => p.val = +(p.val - c).toFixed(1)); });

  const SKILL = p => p.pos !== 5 && p.pos !== 16;
  const pTuple = p => [p.y, p.m, p.n, POS[p.pos], `R${p.r}`,
                       (p.val > 0 ? '+' : '') + Math.round(p.val), p.pts];
  const skill = realPicks.filter(SKILL);
  const steals = skill.slice().sort((a, b) => b.val - a.val).slice(0, 8).map(pTuple);
  const busts = skill.filter(p => p.r <= 3).sort((a, b) => a.val - b.val).slice(0, 8).map(pTuple);
  const keeps = picks.filter(p => p.disc);
  const bestKeeps = keeps.slice().sort((a, b) => b.val - a.val).slice(0, 8)
    .map(p => [p.y, p.m, p.n, `R${p.r}`, (p.val > 0 ? '+' : '') + Math.round(p.val), p.pts]);
  const keeperValue = names.map(m => {
    const k = keeps.filter(p => p.m === m);
    return [m, Math.round(mean(k.map(p => p.val)) || 0), k.length]; })
    .filter(k => k[2] >= 4).sort((a, b) => b[1] - a[1]);

  const ms = {};
  realPicks.forEach(p => (ms[`${p.m}|${p.y}`] = ms[`${p.m}|${p.y}`] || []).push(p.val));
  const msA = Object.entries(ms).map(([k, v]) => ({ k, a: mean(v) }));
  const sdv = msA.map(x => x.a).sort((a, b) => a - b);
  const letter = (a, pool) => { const q = pool.filter(x => x < a).length / pool.length;
    return q >= .90 ? 'A' : q >= .75 ? 'A-' : q >= .60 ? 'B+' : q >= .45 ? 'B'
         : q >= .30 ? 'B-' : q >= .18 ? 'C+' : q >= .10 ? 'C' : q >= .04 ? 'C-' : 'D'; };
  const draftGrade = {};
  msA.forEach(x => draftGrade[x.k] = [+x.a.toFixed(1), letter(x.a, sdv)]);
  const bestDrafts = msA.slice().sort((a, b) => b.a - a.a).slice(0, 8).map(x => {
    const [m, y] = x.k.split('|');
    return [m, +y, +x.a.toFixed(1), letter(x.a, sdv)]; });

  const K = 120;   // shrink small samples toward zero
  const car = names.map(m => {
    const v = realPicks.filter(p => p.m === m).map(p => p.val);
    const drafts = new Set(picks.filter(p => p.m === m).map(p => p.y)).size;
    const raw = mean(v);
    return { m, drafts, raw, adj: raw * v.length / (v.length + K) }; })
    .sort((a, b) => b.adj - a.adj);
  const cs = car.map(c => c.adj).sort((a, b) => a - b);
  const CL = a => { const q = cs.filter(x => x < a).length / cs.length;
    return q >= .88 ? 'A' : q >= .70 ? 'A-' : q >= .55 ? 'B+' : q >= .42 ? 'B'
         : q >= .28 ? 'B-' : q >= .15 ? 'C+' : 'C'; };
  const draftCareer = car.map(c => [c.m, +c.adj.toFixed(1), CL(c.adj), c.drafts, +c.raw.toFixed(1)]);

  const draftR1 = picks.filter(p => p.r === 1).sort((a, b) => a.y - b.y || a.o - b.o)
    .map(p => [p.y, p.m, p.n]);
  const favourite = {};
  names.forEach(m => { const c = {};
    picks.filter(p => p.m === m && p.n).forEach(p => c[p.n] = (c[p.n] || 0) + 1);
    const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    if (best) favourite[m] = [best[0], best[1]]; });

  /* ---- assemble ---- */
  const espn = {
    h2h, luck, winStreak: streak(true), lossStreak: streak(false),
    teamsByYear: Object.fromEntries(YEARS.map(y => [y, season[y].teams.length])),
    highWeek: top(teamGames, 'pts', 6).map(gTuple),
    lowWeek: bot(teamGames, 'pts', 6).map(gTuple),
    blowout: top(marg, 'd', 5).map(mTuple),
    closest: bot(marg, 'd', 6).map(mTuple),
    lopsided, evenRivalry, weeklyHigh, weeklyLow, heartbreak: hb,
    regularSeasonWeeks: Object.keys(regWk).length,
    boxScores: rows.length,
    lastPlace: Object.fromEntries(YEARS.map(y => [y, finish[y].last])),
    lastPlaceRecordThrough: LAST_BY_RECORD_THROUGH,
    lastPlaceRule: LAST_BY_RECORD_THROUGH
      ? { [`${YEARS[0]}-${LAST_BY_RECORD_THROUGH}`]: 'worst regular-season record',
          [`${LAST_BY_RECORD_THROUGH + 1}-${LAST}`]: 'last in final standings' }
      : { [`${YEARS[0]}-${LAST}`]: 'last in final standings' },
    keepers: KEEPERS,
    consolationRounds: CONS_ROUNDS,
    playoffYears, divTitles,
    draftR1, favourite, draftGrade, draftCareer, bestDrafts,
    steals, busts, bestKeeps, keeperValue,
    draftTotals: { picks: picks.length, graded: realPicks.length, discountedKeepers: keeps.length },
    draftMethod: 'A pick is worth the points it scored above what that draft slot normally returns at its position. Points are put on a common scale across seasons (scoring changed over the years) and each season is centred on zero, so a manager is measured against the field he actually drafted against. Keepers taken at a discounted round are excluded from grades and scored separately.',
  };

  /* ---- report + write ---- */
  const sum = k => managers.reduce((s, m) => s + m[k], 0);
  console.log(`\nSeasons ${YEARS[0]}-${LAST} | ${managers.length} managers | ${rows.length} matchups`);
  console.log(`  titles ${sum('titles')}  runners-up ${sum('runnerUp')}  last place ${sum('loser')}  (expect ${YEARS.length} each)`);
  console.log(`  playoff appearances ${sum('playoffApps')}  division titles ${sum('divTitles')}`);
  console.log(`  wins ${sum('w')} = losses ${sum('l')}  ${sum('w') === sum('l') ? 'ok' : 'MISMATCH'}`);
  console.log(`  draft ${picks.length} picks, ${realPicks.length} graded, ${keeps.length} discounted keepers`);

  /* structural invariants - these hold in any season, so they catch a bad pull */
  const N = YEARS.length;
  const bracketSizes = new Set(YEARS.map(y =>
    new Set(season[y].sched.filter(g => g.tier === 'WINNERS_BRACKET')
      .flatMap(g => [g.a, g.b])).size));
  const expectApps = YEARS.reduce((acc, y) =>
    acc + new Set(season[y].sched.filter(g => g.tier === 'WINNERS_BRACKET')
      .flatMap(g => [g.a, g.b])).size, 0);
  const expectDiv = YEARS.reduce((acc, y) => acc + Object.keys(season[y].divs).length, 0);
  const tests = [
    ['one champion per season',    sum('titles') === N],
    ['one runner-up per season',   sum('runnerUp') === N],
    ['one third place per season', sum('third') === N],
    ['one last place per season',  sum('loser') === N],
    ['wins equal losses',          sum('w') === sum('l')],
    ['playoff appearances add up', sum('playoffApps') === expectApps],
    ['division titles add up',     sum('divTitles') === expectDiv],
    ['every pick graded or kept',  realPicks.length + keeps.length === picks.length],
    ['every manager named',        managers.every(m => !!m.name && m.name.trim() !== '')],
    ['bracket size steady',        bracketSizes.size === 1],
  ];
  let failed = 0;
  console.log('\nChecks');
  tests.forEach(t => { if (!t[1]) failed++;
    console.log('  ' + (t[1] ? 'pass' : 'FAIL') + '  ' + t[0]); });
  if (failed) {
    console.error('\n' + failed + ' check(s) failed - not writing. Something is wrong with the pull.\n');
    process.exit(1);
  }
  /* --check does a semantic diff, not a byte diff: field order and formatting are noise,
     a changed number is not. */
  function semanticDiff(prevM, prevE) {
    const d = [];
    const byName = Object.fromEntries(prevM.map(m => [m.name, m]));
    managers.forEach(m => {
      const p = byName[m.name];
      if (!p) { d.push(`manager ${m.name} is new`); return; }
      ['w','l','titles','runnerUp','third','loser','playoffApps','playoffW','playoffL','divTitles']
        .forEach(k => { if (p[k] !== m[k]) d.push(`${m.name}.${k}: ${p[k]} -> ${m[k]}`); });
      if (p.seasons.length !== m.seasons.length)
        d.push(`${m.name}: ${p.seasons.length} seasons -> ${m.seasons.length}`);
      m.seasons.forEach(s => {
        const q = p.seasons.find(x => x.year === s.year);
        if (!q) { d.push(`${m.name} ${s.year} is new`); return; }
        ['w','l','fin','note'].forEach(k => {
          if (q[k] !== s[k]) d.push(`${m.name} ${s.year}.${k}: ${q[k]} -> ${s[k]}`); });
        if (Math.abs((q.pf||0) - s.pf) > 0.02) d.push(`${m.name} ${s.year}.pf: ${q.pf} -> ${s.pf}`);
      });
    });
    prevM.forEach(p => { if (!managers.some(m => m.name === p.name)) d.push(`manager ${p.name} vanished`); });
    const cmp = (k, f) => {
      const A = JSON.stringify((prevE[k]||[]).map(f)), B = JSON.stringify((espn[k]||[]).map(f));
      if (A !== B) d.push(`espn.${k} changed`);
    };
    cmp('h2h', x => x); cmp('steals', x => x[2]); cmp('busts', x => x[2]);
    cmp('bestKeeps', x => x[2]); cmp('draftCareer', x => x[0] + ':' + x[2]);
    cmp('bestDrafts', x => x[0] + x[1]); cmp('lopsided', x => x); cmp('evenRivalry', x => x);
    ['weeklyHigh','weeklyLow','heartbreak','luck','playoffYears','divTitles','lastPlace'].forEach(k => {
      if (JSON.stringify(prevE[k]) !== JSON.stringify(espn[k])) d.push(`espn.${k} changed`); });
    if (Object.keys(prevE.draftGrade||{}).length !== Object.keys(espn.draftGrade||{}).length)
      d.push('espn.draftGrade count changed');
    return d;
  }
  const P = f => path.join(OUT, f);
  if (CHECK) {
    const haveBoth = fs.existsSync(P('data.json')) && fs.existsSync(P('espn.json'));
    if (!haveBoth) { console.log('\nNothing committed to compare against.\n'); process.exit(0); }
    const d = semanticDiff(JSON.parse(fs.readFileSync(P('data.json'), 'utf8')),
                           JSON.parse(fs.readFileSync(P('espn.json'), 'utf8')));
    if (!d.length) {
      console.log('\nReproduces every committed figure. Nothing written.\n');
      process.exit(0);
    }
    console.log('\n' + d.length + ' difference(s) against the committed data:');
    d.slice(0, 40).forEach(x => console.log('  ' + x));
    if (d.length > 40) console.log('  ... and ' + (d.length - 40) + ' more');
    console.log('\nIf these are expected (a new season), run without --check.\n');
    process.exit(1);
  }
  for (const [file, value] of Object.entries({ 'data.json': managers, 'espn.json': espn })) {
    fs.writeFileSync(P(file), JSON.stringify(value, null, 1));
    console.log('  wrote ' + path.relative(process.cwd(), P(file)));
  }
  console.log('\nNow run:  node build.js --league ' + (CFG ? CFG.slug : 'loog') + '\n');
}
module.exports = { run };
