# The Rewind — per-manager career view

A tap-through, Spotify-Wrapped-shaped sequence for one manager, ending in their
trophy case. Lives alongside the record book, links from any manager name.

## Shape

Seven cards, advanced by tap anywhere / arrow keys / swipe. Story-style progress
segments across the top. Back goes one card. Escape exits to the picker.

| # | Card | Carries |
|---|------|---------|
| 1 | **Open** | Name, seasons played, first–last year, league |
| 2 | **The ledger** | Career W–L, win %, points for, playoff appearances |
| 3 | **The peak** | Best season by finish, its record and scoring; weeks led the league |
| 4 | **Rivalries** | Best head-to-head (victim) and worst (nemesis) |
| 5 | **The draft** | Career grade, best steal, worst bust |
| 6 | **The verdict** | One computed line characterising the career |
| 7 | **The case** | Trophy case: brass/silver/bronze plates, paper on porcelain |

## Verdict rules

First match wins, most specific first. Every manager must match something, so the
last rule is unconditional.

1. `titles >= 3` → **Dynasty**
2. `titles >= 1 && lastPlaces >= 1` → **Feast or famine**
3. `titles >= 1` → **Champion**
4. `runnerUps >= 2 && titles === 0` → **The bridesmaid**
5. `lastPlaces >= 2` → **Porcelain collector**
6. `playoffRate >= 0.7 && titles === 0` → **Always invited, never crowned**
7. `allPlay - winPct >= 4` → **Unluckiest man alive**
8. `winPct - allPlay >= 4` → **Living right**
9. `winPct >= 0.55` → **Quietly excellent**
10. *(else)* → **Still writing the story**

## Data

Everything comes from the existing `data/<league>/{data,espn}.json`; the rewind adds
no new ESPN calls. Derived per manager at build time: career totals, best/worst
season, head-to-head extremes parsed from the `h2h` strings, draft grade from
`draftCareer`, steals/busts filtered from the league-wide lists.

## Motion

Numbers count up; content staggers in. Under `prefers-reduced-motion: reduce`
everything appears at once with no transitions. No card depends on animation to be
readable.

## Deep links

`?l=<league>&m=<manager>` opens straight to that person's card 1, so a manager can
share their own. No query string shows the picker.

## Non-goals

No autoplay, no audio, no per-week granularity (the box scores aren't retained),
no sharing image generation.
