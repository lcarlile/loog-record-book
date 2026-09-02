# LoOG Record Book

A visual record book for the **League of Ordinary Gentlemen** family fantasy football league.
Live site: https://lcarlile.github.io/loog-record-book/

Nine seasons (2017-2025): champions, all-time standings, head-to-head, draft history and
grades, single-week extremes, schedule luck, and season-by-season standings.

## Two leagues, one codebase

Each league is a config in `leagues/`. The code, the design and every metric are shared;
only the id, seasons, rules and branding differ.

| League | Config | Seasons | Page |
|---|---|---|---|
| League of Ordinary Gentlemen | `leagues/loog.json` | 2017- | `/` |
| The League | `leagues/the-league.json` | 2021- | [own repo](https://lcarlile.github.io/the-league-record-book/) |

## Updating after a season

```sh
./refresh.sh                        # loog
node build.js

./refresh.sh --league the-league    # the other league
node build.js --league the-league
./publish.sh the-league             # pushes to its own site repo

git commit -am "2026 season" && git push
```

Add the new season to `years` in that league's config first. That is the only yearly edit.

### Adding another league

Copy a config in `leagues/`, set `leagueId`, `years`, `out`, `brand` and `rules`, then run
the two commands with `--league <slug>`. Manager names resolve from ESPN member ids, so
someone renaming themselves does not split into two people; `nameOverrides` handles
nicknames, keyed by member id or full name.

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
