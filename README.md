# LoOG Record Book

A visual record book for the **League of Ordinary Gentlemen** family fantasy football league.
Live site: https://lcarlile.github.io/loog-record-book/

Nine seasons (2017-2025): champions, all-time standings, head-to-head, draft history and
grades, single-week extremes, schedule luck, and season-by-season standings.

## Updating after a season

Everything is derived from the ESPN league, so this is two commands.

```sh
node refresh.js     # pull ESPN, recompute, rewrite data.json + espn.json
node build.js       # rebuild index.html and recordbook.html
git commit -am "2026 season" && git push
```

GitHub Pages redeploys itself. The spreadsheet is no longer needed - every figure it
held was verified against ESPN and is now computed directly.

**Add the new season to `YEARS` in `refresh.js` first.** That is the only edit each year.

### Credentials

The league is private, so `refresh.js` needs your ESPN cookies. Sign in at
fantasy.espn.com, then DevTools > Application > Cookies, and copy `espn_s2` and `SWID`.
Either export them:

```sh
export ESPN_S2='...' SWID='{...}'
```

or create `.espn-auth.json` (gitignored, never committed):

```json
{ "espn_s2": "...", "SWID": "{...}" }
```

### Useful flags

| Command | What it does |
|---|---|
| `node refresh.js` | full pull, rewrite the data files, cache the raw pull |
| `node refresh.js --check` | pull and compare against what is committed; writes nothing |
| `node refresh.js --cached` | recompute from the last pull with no network and no cookies |

`refresh.js` runs nine structural checks before writing (one champion per season, wins
equal losses, playoff appearances add up, and so on) and refuses to write if any fail.
Needs Node 18+; if `node -v` is older, use `~/.nvm/versions/node/v22.22.0/bin/node`.

## Files

| File | What it is |
|---|---|
| `index.html` | the site. Standalone, self-contained. **Generated - do not edit.** |
| `recordbook.html` | same page as a fragment, for publishing as a Claude Artifact. **Generated.** |
| `template.html` | the real source: markup, CSS and JS. **Edit this one.** |
| `refresh.js` | pulls the league from ESPN |
| `compute.js` | turns the raw pull into `data.json` + `espn.json`; every league rule lives here |
| `build.js` | inlines the data into `template.html` and writes both outputs |
| `data.json`, `espn.json` | generated data |
| `parse.js` | superseded. Read the old spreadsheet CSV; kept only for reference. |

## League rules encoded in `compute.js`

- **Last place** changed meaning. Through 2021 it was the worst regular-season record;
  from 2022, when the league grew to twelve and added a consolation bracket, it is
  whoever finished last in the final standings. See `LAST_BY_RECORD_THROUGH`.
- **Keepers** cost the round you drafted the player in, minus one, for up to two years.
  Nothing above a 1st. The draft is offline and keepers are entered by hand, so ESPN
  flags none of them. They are detected as: ended last season on that manager's roster
  and taken exactly one round earlier than drafted. That rule reproduces the two-year cap
  on its own. Discounted keepers are excluded from draft grades and scored separately.
  Waiver keeps are priced at average draft round, so they stay in.
- **Draft value** is points above what that draft slot normally returns at its position.
  Points are normalised across seasons (scoring changed) and each season is centred on
  zero. Busts are limited to rounds 1-3; kickers and defences are left out of steals and
  busts. Career grade is shrunk toward zero by sample size, since managers joined in
  different years.
- **Seasons finishing exactly .500** are their own category, not losses.
