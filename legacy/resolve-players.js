/* Resolves ESPN player ids to names using ESPN's public athlete API (no auth),
   caching results in players.json so this only ever runs for new ids. */
const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('draft-raw.json', 'utf8'));
const cache = fs.existsSync('players.json') ? JSON.parse(fs.readFileSync('players.json','utf8')) : {};

const ids = new Set();
raw.r1.forEach(s => ids.add(s.split('|')[2]));
raw.mostDrafted.forEach(s => ids.add(s.split(':')[0]));
raw.favourite.forEach(s => ids.add(s.split(':')[1]));

const NFL = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams/';
const ATH = 'https://sports.core.api.espn.com/v3/sports/football/nfl/athletes/';

const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
};

(async () => {
  const todo = [...ids].filter(id => !cache[id]);
  console.log(`${ids.size} ids total, ${todo.length} to fetch`);
  for (const id of todo) {
    let name = null;
    if (+id < 0) {                             // negative ids are team defenses
      const teamId = Math.abs(+id) - 16000;
      const j = await get(NFL + teamId);
      name = j && j.displayName ? j.displayName + ' D/ST' : null;
    } else {
      const j = await get(ATH + id);
      name = j && (j.displayName || j.fullName);
    }
    cache[id] = name || ('Player ' + id);
    if (!name) console.log('  unresolved:', id);
  }
  fs.writeFileSync('players.json', JSON.stringify(cache, null, 1));
  console.log('players.json written:', Object.keys(cache).length, 'names');
  console.log('\nsample:', [...ids].slice(0,5).map(i=>i+' = '+cache[i]).join('\n        '));
})();
