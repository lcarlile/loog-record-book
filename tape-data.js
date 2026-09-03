// Derives everything the rewind needs from the existing league files.
const fs = require('fs');
const path = require('path');

function build(sl) {
  const dir = path.join(__dirname, 'data', sl);
  const D = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
  const E = JSON.parse(fs.readFileSync(path.join(dir, 'espn.json'), 'utf8'));

  // "A/B 5-3" -> A's record against B
  const h2h = {};
  E.h2h.forEach(str => {
    const m = str.match(/^(.+?)\/(.+?) (\d+)-(\d+)$/);
    if (!m) return;
    const [, a, b, w, l] = m;
    (h2h[a] = h2h[a] || []).push({ vs: b, w: +w, l: +l });
    (h2h[b] = h2h[b] || []).push({ vs: a, w: +l, l: +w });
  });

  const draftCareer = Object.fromEntries((E.draftCareer || []).map(r => [r[0], r]));

  // A restrained palette drawn from the book's own world, assigned by position so
  // that no two managers in a league sit next to each other on the same tone.
  const ACCENT = [
    ['#C79A3A','#F2DCA0'], ['#A84152','#F0B3BC'], ['#3E8E77','#A9E3CF'],
    ['#6689B8','#C3D8EF'], ['#BC7C33','#F4CE96'], ['#8A6BAE','#D6C4EA'],
    ['#2F8E97','#A6E2E8'], ['#9A9138','#E6DC96'], ['#B5654A','#F2BCA9'],
    ['#4E8CA0','#B4DCE8'], ['#A55C86','#EBBBD5'], ['#79924A','#D2E3A4'],
    ['#C08A5E','#F3D3B8'],
  ];

  // ESPN's final rank comes out of the placement bracket, but from 2017-2021 this
  // league awarded last place on the worst regular-season record instead. In 2018
  // that put Chase 9th on ESPN while the league called him the biggest loser, and a
  // block reading "9th" coloured as last place is just a contradiction on screen.
  // Positions here follow whichever rule the league actually used that year.
  const RECORD_ERA = E.lastPlaceRecordThrough || 0;
  const posByYear = {};
  const allSeasons = {};
  Object.values(D).forEach(mm => mm.seasons.forEach(x =>
    (allSeasons[x.year] = allSeasons[x.year] || []).push({ n: mm.name, ...x })));
  Object.entries(allSeasons).forEach(([y, rows]) => {
    const ordered = [...rows].sort((a, b) => a.fin - b.fin);
    const loser = ordered.find(r => r.note === 'Biggest Loser');
    if (loser && ordered[ordered.length - 1] !== loser) {
      ordered.splice(ordered.indexOf(loser), 1);
      ordered.push(loser);                       // the league's last place is last
    }
    posByYear[y] = Object.fromEntries(ordered.map((r, i) => [r.n, i + 1]));
  });

  const order = Object.values(D);
  return order.map((m, mi) => {
    const S = m.seasons, n = S.length;
    const sum = k => S.reduce((t, s) => t + s[k], 0);
    const W = sum('w'), L = sum('l'), winPct = W / (W + L || 1);
    const cnt = note => S.filter(s => s.note === note);

    // best season: by finish, then by record
    const best = [...S].sort((a, b) => (a.fin - b.fin) || ((b.w - b.l) - (a.w - a.l)))[0];
    const worst = [...S].sort((a, b) => (b.fin - a.fin) || ((a.w - a.l) - (b.w - b.l)))[0];

    // rivalries: only pairings with enough games to mean anything
    const rv = (h2h[m.name] || []).filter(r => r.w + r.l >= 4);
    const rate = r => r.w / (r.w + r.l);
    const victim  = rv.length ? [...rv].sort((a, b) => rate(b) - rate(a) || (b.w + b.l) - (a.w + a.l))[0] : null;
    const nemesis = rv.length ? [...rv].sort((a, b) => rate(a) - rate(b) || (b.w + b.l) - (a.w + a.l))[0] : null;

    const dc = draftCareer[m.name];
    const mine = arr => (arr || []).filter(r => r[1] === m.name);
    const steal = mine(E.steals)[0], bust = mine(E.busts)[0];

    const allPlay = (E.luck && E.luck[m.name]) ? E.luck[m.name][0] : null;
    const titles = cnt('Champion').length, lasts = cnt('Biggest Loser').length;
    const runnerUps = cnt('Runner Up').length;
    const playoffs = ((E.playoffYears || {})[m.name] || []).length;
    const playoffRate = playoffs / (n || 1);

    let verdict;
    const d = allPlay === null ? 0 : allPlay - winPct * 100;
    if (titles >= 3)                          verdict = ['Dynasty', 'Three or more rings. The rest of the league plays for second.'];
    else if (titles >= 1 && lasts >= 1)       verdict = ['Feast or famine', 'A title and a toilet. No middle gear whatsoever.'];
    else if (titles >= 1)                     verdict = ['Champion', 'Got their name on the trophy. Nobody can take that back.'];
    else if (runnerUps >= 2)                  verdict = ['The bridesmaid', 'Made the final more than once. Won it none of those times.'];
    else if (lasts >= 2)                      verdict = ['Porcelain collector', 'More trips to the toilet bowl than anyone should own.'];
    else if (playoffRate >= .7)               verdict = ['Always invited, never crowned', 'Reliably in the playoffs. Reliably out of them again.'];
    else if (d >= 4)                          verdict = ['Unluckiest man alive', 'Scored like a contender. Got the schedule of a doormat.'];
    else if (d <= -4)                         verdict = ['Living right', 'The scoreboard has been kinder than the box score deserved.'];
    else if (winPct >= .55)                   verdict = ['Quietly excellent', 'No fanfare, no collapse, just a winning record year on year.'];
    else if (cnt('Third').length >= 2)        verdict = ['Podium furniture', 'Third place knows their name. The top two never learned it.'];
    else if ((E.weeklyHigh||{})[m.name] >= 8) verdict = ['Scoreboard merchant', 'Tops the league most weeks. Tops the standings never.'];
    else if (winPct < .42)                    verdict = ['Character-building years', 'A career spent making everyone else feel better about theirs.'];
    else                                      verdict = ['Still writing the story', 'The good chapter has to be coming. Statistically.'];

    // one cell per season, so the whole career reads as a shape
    const strip = S.map(x => ({
      y: x.year,
      t: x.note === 'Champion' ? 'g' : x.note === 'Runner Up' ? 's'
       : x.note === 'Third' ? 'b' : x.note === 'Biggest Loser' ? 'p'
       : ((E.playoffYears || {})[m.name] || []).includes(x.year) ? 'x' : 'o',
      fin: (posByYear[x.year] || {})[m.name] || x.fin, r: `${x.w}-${x.l}`,
    }));

    return {
      accent: ACCENT[mi % ACCENT.length],
      strip,
      name: m.name, league: sl, seasons: n,
      first: S[0].year, last: S[n - 1].year,
      w: W, l: L, winPct: +(winPct * 100).toFixed(1),
      pf: Math.round(sum('pf')), ppg: +(sum('pfpg') / n).toFixed(1),
      titles, runnerUps, thirds: cnt('Third').length, lasts,
      playoffs, divTitles: (E.divTitles || {})[m.name] || 0,
      allPlay,
      best: { y: best.year, r: `${best.w}–${best.l}`, fin: best.fin, note: best.note, ppg: best.pfpg },
      worst: { y: worst.year, r: `${worst.w}–${worst.l}`, fin: worst.fin },
      leagueWeeks: (E.weeklyHigh || {})[m.name] || 0,
      heartbreak: (E.heartbreak || {})[m.name] || 0,
      streak: (E.winStreak || {})[m.name] || null,
      favourite: (E.favourite || {})[m.name] || null,
      draft: dc ? { per: dc[1], grade: dc[2], years: dc[3], total: dc[4] } : null,
      steal: steal ? { y: steal[0], p: steal[2], pos: steal[3], rd: steal[4], val: steal[5] } : null,
      bust:  bust  ? { y: bust[0],  p: bust[2],  pos: bust[3],  rd: bust[4],  val: bust[5] }  : null,
      victim, nemesis, verdict,
      plates: {
        gold:   cnt('Champion').map(s => ({ y: s.year, r: `${s.w}–${s.l}` })),
        silver: cnt('Runner Up').map(s => ({ y: s.year, r: `${s.w}–${s.l}` })),
        bronze: cnt('Third').map(s => ({ y: s.year, r: `${s.w}–${s.l}` })),
        loo:    cnt('Biggest Loser').map(s => ({ y: s.year, r: `${s.w}–${s.l}` })),
      },
    };
  });
}

// Ranks are only meaningful against the rest of the league, so they are a second pass.
function withRanks(rows) {
  const rank = (key, dir = -1) => {
    const sorted = [...rows].sort((a, b) => dir * (a[key] - b[key]));
    sorted.forEach((r, i) => (r.rank = { ...(r.rank || {}), [key]: i + 1 }));
  };
  rank('pf'); rank('winPct'); rank('titles'); rank('playoffs');
  rows.forEach(r => (r.of = rows.length));
  return rows;
}
const buildRanked = sl => withRanks(build(sl));
module.exports = { build: buildRanked };
