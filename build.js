/* Builds two targets from template.html + the data files:
   recordbook.html - fragment for publishing as a Claude Artifact
   index.html      - standalone document for GitHub Pages            */
const fs = require('fs');
const managers = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const espn = JSON.parse(fs.readFileSync('espn.json', 'utf8'));
const tpl = fs.readFileSync('template.html', 'utf8');

const page = tpl.replace('/*__DATA__*/', JSON.stringify({ managers, espn }));
fs.writeFileSync('recordbook.html', page);

/* lift <title> and the font <link>s out of the fragment and into a real <head> */
const title = (page.match(/<title>([\s\S]*?)<\/title>/) || [, 'LoOG Record Book'])[1];
const links = (page.match(/<link\b[^>]*>/g) || []).join('\n');
const body = page
  .replace(/<title>[\s\S]*?<\/title>\s*/, '')
  .replace(/<link\b[^>]*>\s*/g, '');

const DESC = 'Nine seasons of League of Ordinary Gentlemen fantasy football - champions, '
  + 'all-time standings, head-to-head records and single-week extremes.';

const doc = `<!doctype html>
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
<meta name="twitter:card" content="summary">
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
`;
fs.writeFileSync('index.html', doc);
console.log('recordbook.html', (page.length/1024).toFixed(1)+'KB  (artifact fragment)');
console.log('index.html    ', (doc.length/1024).toFixed(1)+'KB  (github pages)');
