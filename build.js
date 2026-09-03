/* Builds a league's page from template.html + its data.
 *   node build.js                 loog (default)
 *   node build.js --league <slug>
 */
const fs = require('fs');
const path = require('path');

const argOf = f => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : null; };
const SLUG = argOf('--league') || 'loog';
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'leagues', SLUG + '.json'), 'utf8'));
const DIR = path.join(__dirname, 'data', SLUG);

for (const f of ['data.json', 'espn.json']) {
  if (!fs.existsSync(path.join(DIR, f))) {
    console.error(`\nMissing data/${SLUG}/${f} - run ./refresh.sh --league ${SLUG} first.\n`);
    process.exit(1);
  }
}
const managers = JSON.parse(fs.readFileSync(path.join(DIR, 'data.json'), 'utf8'));
const espn = JSON.parse(fs.readFileSync(path.join(DIR, 'espn.json'), 'utf8'));
const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');

const brand = Object.assign({ leagueId: CFG.leagueId, years: CFG.years }, CFG.brand);
const page = tpl
  .replace('__TITLE__', brand.title)
  .replace('/*__DATA__*/', JSON.stringify({ managers, espn }))
  .replace('/*__BRAND__*/', JSON.stringify(brand));

const write = (rel, body) => {
  const p = path.join(__dirname, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  console.log(`  ${rel.padEnd(26)} ${(body.length / 1024).toFixed(1)}KB`);
};

write(CFG.out.fragment, page);

/* standalone document for GitHub Pages */
const title = brand.title;
const links = (page.match(/<link\b[^>]*>/g) || []).join('\n');
const body = page.replace(/<title>[\s\S]*?<\/title>\s*/, '').replace(/<link\b[^>]*>\s*/g, '');
const DESC = brand.description || '';

write(CFG.out.site, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<meta name="description" content="${DESC}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${DESC}">
<meta property="og:url" content="${brand.site || ''}">
<meta property="og:image" content="${(brand.site || '') + 'og.png'}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${title}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${(brand.site || '') + 'og.png'}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#127942;</text></svg>">
${links}
<style>
  :root{color-scheme:light dark}
  body{margin:0}
  img{max-width:100%}
  [hidden]{display:none!important}
</style>
</head>
<body>
${body}
</body>
</html>
`);
/* ---------- the rewind: its own page, one per league ---------- */
if (CFG.out.tape) {
  const { build: tapeRows } = require('./tape-data.js');
  const rows = tapeRows(SLUG);
  const rtpl = fs.readFileSync(path.join(__dirname, 'tape-template.html'), 'utf8');
  const rdesc = `A season-by-season career retrospective for every manager in ${brand.title.replace(/ Record Book$/, '')}.`;
  write(CFG.out.tape, rtpl
    .replace(/__TITLE__/g, brand.title.replace(/ Record Book$/, '') + ' \u00b7 The Tape')
    .replace(/__DESC__/g, rdesc)
    .replace('/*__CSS__*/', fs.readFileSync(path.join(__dirname, 'tape.css'), 'utf8'))
    .replace('/*__JS__*/', fs.readFileSync(path.join(__dirname, 'tape.js'), 'utf8'))
    .replace('/*__DATA__*/', JSON.stringify(rows))
    .replace('/*__LEAGUES__*/', JSON.stringify({ [SLUG]: brand.leagueName || brand.title }))
    .replace('/*__BACK__*/', JSON.stringify(brand.backHref || null)));
}

console.log(`\n  built ${SLUG} (${managers.length} managers, ${CFG.years.length} seasons)\n`);
