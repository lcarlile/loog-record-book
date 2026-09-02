#!/usr/bin/env node
/*
 * refresh.js - pulls the whole league from ESPN and rebuilds data.json + espn.json.
 *
 *   node refresh.js            rebuild the data files
 *   node refresh.js --check    pull fresh, compare with what is committed, write nothing
 *
 * Needs a modern Node (18+ for global fetch). Auth comes from the environment or
 * a local .espn-auth.json, which is gitignored - see README.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const MAJOR = +process.versions.node.split('.')[0];
if (MAJOR < 18) {
  console.error(`\nThis needs Node 18 or newer (found ${process.versions.node}) for global fetch.`);
  console.error('If you use nvm:  nvm use 22   or run it directly, e.g.');
  console.error('  ~/.nvm/versions/node/v22.22.0/bin/node refresh.js\n');
  process.exit(1);
}

const CHECK  = process.argv.includes('--check');
const CACHED = process.argv.includes('--cached');   // recompute from the last pull, no network
const CACHE  = path.join(__dirname, '.espn-cache.json');
const LEAGUE = 1197565;
const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const HOST = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl';

/* ---------- auth ---------------------------------------------------------- */
function auth() {
  let s2 = process.env.ESPN_S2, swid = process.env.SWID;
  const f = path.join(__dirname, '.espn-auth.json');
  if ((!s2 || !swid) && fs.existsSync(f)) {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    s2 = s2 || j.espn_s2; swid = swid || j.SWID;
  }
  if (!s2 || !swid) {
    console.error(`
The league is private, so this needs your ESPN cookies.

  1. Sign in to ESPN in your browser and open fantasy.espn.com
  2. DevTools > Application > Cookies > https://fantasy.espn.com
  3. Copy the values of  espn_s2  and  SWID

Then either export them:
  export ESPN_S2='...'  SWID='{...}'

or create loog/.espn-auth.json (already gitignored):
  { "espn_s2": "...", "SWID": "{...}" }
`);
    process.exit(1);
  }
  return `espn_s2=${s2}; SWID=${swid}`;
}
const COOKIE = CACHED ? null : auth();

/* ---------- fetching ------------------------------------------------------ */
const base = y => y < 2019
  ? `${HOST}/leagueHistory/${LEAGUE}?seasonId=${y}&`
  : `${HOST}/seasons/${y}/segments/0/leagues/${LEAGUE}?`;

async function api(y, query, filter) {
  const headers = { cookie: COOKIE, accept: 'application/json' };
  if (filter) headers['x-fantasy-filter'] = JSON.stringify(filter);
  const res = await fetch(base(y) + query, { headers });
  if (res.status === 401) {
    console.error('\nESPN returned 401. Your cookies are wrong or expired - grab them again.\n');
    process.exit(1);
  }
  if (!res.ok) throw new Error(`${y} ${query} -> HTTP ${res.status}`);
  let j = await res.json();
  return Array.isArray(j) ? j[0] : j;
}

const NAME = {
  'Logan Carlile': 'Logan', 'Jordan Baumiller': 'Jordan', 'Chase Carlile': 'Chase',
  'Zach Johnson': 'Zach', 'Daniel Johnson': 'Danny', 'Steve Johnson': 'Steve',
  'Conner  Johnson': 'Conner', 'Conner Johnson': 'Conner', 'Dan Devilbiss': 'Dan',
  'Kim D': 'Kim', 'Karen Edwards': 'Karen', 'Kaila Beach': 'Kaila', 'Caitlyn Darrah': 'Caitlyn',
};
const unknown = new Set();
function managerMap(j) {
  const mem = {};
  (j.members || []).forEach(m => mem[m.id] = `${m.firstName || ''} ${m.lastName || ''}`.trim());
  const out = {};
  (j.teams || []).forEach(t => {
    const raw = (t.owners || []).map(o => mem[o]).join('/');
    if (!NAME[raw]) unknown.add(raw);
    out[t.id] = NAME[raw] || raw;
  });
  return out;
}

/* ---------- pull ---------------------------------------------------------- */
const season = {};          // year -> { mgr, teams, sched, divs, picks, roster }
async function pull() {
  for (const y of YEARS) {
    process.stdout.write(`  ${y} `);
    const core = await api(y, 'view=mTeam&view=mSettings&view=mMatchupScore');
    const mgr = managerMap(core);
    const teams = (core.teams || []).map(t => {
      const o = t.record.overall;
      return { id: t.id, m: mgr[t.id], w: o.wins, l: o.losses, ties: o.ties,
               pf: +o.pointsFor.toFixed(2), pa: +o.pointsAgainst.toFixed(2),
               div: t.divisionId, fin: t.rankCalculatedFinal };
    });
    const sched = (core.schedule || []).filter(g => g.home && g.away)
      .map(g => ({ wk: g.matchupPeriodId, tier: g.playoffTierType || 'NONE',
                   a: mgr[g.home.teamId], as: +(g.home.totalPoints || 0).toFixed(2),
                   b: mgr[g.away.teamId], bs: +(g.away.totalPoints || 0).toFixed(2) }))
      .filter(g => g.as > 0 || g.bs > 0);
    const ss = core.settings.scheduleSettings || {};
    const divs = {}; (ss.divisions || []).forEach(d => divs[d.id] = d.name);

    const draft = await api(y, 'view=mDraftDetail');
    const rawPicks = (draft.draftDetail && draft.draftDetail.picks) || [];
    const ids = [...new Set(rawPicks.map(p => p.playerId))];
    const info = {};
    for (let i = 0; i < ids.length; i += 120) {
      const chunk = await api(y, 'view=kona_player_info',
        { players: { filterIds: { value: ids.slice(i, i + 120) } } });
      (chunk.players || []).forEach(e => {
        const pl = e.player || {};
        const st = (pl.stats || []).find(x =>
          x.statSourceId === 0 && x.statSplitTypeId === 0 && x.seasonId === y);
        info[pl.id] = { n: pl.fullName, pos: pl.defaultPositionId,
                        pts: st ? +st.appliedTotal.toFixed(1) : 0 };
      });
    }
    const picks = rawPicks.map(p => {
      const f = info[p.playerId] || {};
      return { y, r: p.roundId, o: p.overallPickNumber, m: mgr[p.teamId],
               n: f.n || null, pos: f.pos == null ? null : f.pos, pts: f.pts || 0 };
    });

    let roster = {};
    if (y < YEARS[YEARS.length - 1]) {          // last season needs no follow-on keeper check
      const sp = y >= 2021 ? 17 : 16;
      const r = await api(y, `view=mRoster&view=mTeam&scoringPeriodId=${sp}`);
      const rm = managerMap(r);
      (r.teams || []).forEach(t => ((t.roster && t.roster.entries) || []).forEach(e => {
        const pl = e.playerPoolEntry && e.playerPoolEntry.player;
        if (pl) roster[`${rm[t.id]}|${pl.fullName}`] = 1;
      }));
    }
    season[y] = { teams, sched, divs, picks, roster, weeks: ss.matchupPeriodCount };
    process.stdout.write(`ok (${teams.length} teams, ${picks.length} picks)\n`);
  }
  if (unknown.size) console.log('  ! unmapped owners:', [...unknown].join(', '));
}

module.exports = { season, YEARS, api };
if (require.main === module) {
  (async () => {
    if (CACHED) {
      if (!fs.existsSync(CACHE)) {
        console.error('\nNo .espn-cache.json yet - run once without --cached first.\n');
        process.exit(1);
      }
      Object.assign(season, JSON.parse(fs.readFileSync(CACHE, 'utf8')));
      console.log('\nUsing cached ESPN pull (no network).');
    } else {
      console.log('\nPulling ESPN...');
      await pull();
      fs.writeFileSync(CACHE, JSON.stringify(season));
      console.log('  cached the raw pull to .espn-cache.json');
    }
    require('./compute.js').run({ season, YEARS, CHECK });
  })().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
}
