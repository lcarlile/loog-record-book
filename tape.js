const app = document.getElementById('app');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ord = n => n + (['th','st','nd','rd'][(n % 100 - 20) % 10] || ['th','st','nd','rd'][n % 100] || 'th');
let M = null, i = 0;

/* ---------- cards ---------- */
const stat = (n, k, d = 0) => `<div class="stat ${REDUCED?'':'in'}" style="animation-delay:${d}ms">
  <div class="n" data-to="${n}">${REDUCED ? n : 0}</div><div class="k">${k}</div></div>`;

const CARDS = [
  m => ({ eyebrow: LEAGUES[m.league], body: `
    <h1 class="hero ${REDUCED?'':'in'}">${esc(m.name)}</h1>
    <p class="sub ${REDUCED?'':'in'}" style="animation-delay:180ms">
      ${m.seasons} seasons, ${m.first} to ${m.last}.<br>Here is how that actually went.</p>` }),

  m => ({ eyebrow: 'The ledger', body: `
    <h2 class="big ${REDUCED?'':'in'}">${m.w}–${m.l}</h2>
    <p class="lede ${REDUCED?'':'in'}" style="animation-delay:120ms">
      ${m.w + m.l} games played. ${m.pf.toLocaleString()} points scored,
      ${m.ppg} a week on average.</p>
    <div class="stats">
      ${stat(m.winPct, 'Win %', 220)}
      ${stat(m.playoffs, 'Playoff trips', 320)}
      ${stat(m.divTitles, 'Division titles', 420)}
      ${m.allPlay !== null ? stat(m.allPlay, 'All-play %', 520) : ''}
    </div>
    <p class="rankline ${REDUCED?'':'in'}" style="animation-delay:600ms">
      <em>${ord(m.rank.pf)}</em> for points scored and <em>${ord(m.rank.winPct)}</em> by
      win rate, out of ${m.of}.</p>` }),

  m => ({ eyebrow: 'Every season', body: `
    <h2 class="big ${REDUCED?'':'in'}">${m.first}<span style="opacity:.4">&ndash;</span>${m.last}</h2>
    <p class="lede ${REDUCED?'':'in'}" style="animation-delay:120ms">
      One block a season, and where it finished. This is the shape of the whole thing.</p>
    <div class="strip">${m.strip.map((c, k) => `
      <div class="cell ${REDUCED?'':'pop'}" style="animation-delay:${200 + k * 70}ms">
        <div class="bar b-${c.t}" title="${c.y}: ${c.r}, ${ord(c.fin)}"><span>${ord(c.fin)}</span></div>
        <div class="y">'${String(c.y).slice(2)}</div></div>`).join('')}</div>
    <div class="legend ${REDUCED?'':'in'}" style="animation-delay:${200 + m.strip.length * 70 + 120}ms">
      <i><b class="b-g"></b>Champion</i><i><b class="b-s"></b>Runner-up</i>
      <i><b class="b-b"></b>Third</i><i><b class="b-p"></b>Biggest loser</i>
      <i><b class="b-x"></b>Playoffs</i><i><b class="b-o"></b>Missed out</i>
    </div>` }),

  m => ({ eyebrow: 'The peak', body: `
    <h2 class="big ${REDUCED?'':'in'}">${m.best.y}</h2>
    <p class="lede ${REDUCED?'':'in'}" style="animation-delay:120ms">
      Went <strong>${m.best.r}</strong> at ${m.best.ppg} a week and finished
      <strong>${ord(m.best.fin)}</strong>${m.best.note ? ` — ${esc(m.best.note.toLowerCase())}` : ''}.</p>
    <div class="stats">
      ${stat(m.leagueWeeks, 'Weeks top-scored', 240)}
      ${m.streak ? stat(m.streak[0], 'Longest win streak', 340) : ''}
      ${stat(m.heartbreak, 'Losses scoring above par', 440)}
    </div>` }),

  m => ({ eyebrow: 'Rivalries', body: `
    <h2 class="big ${REDUCED?'':'in'}">Who you beat<br>and who beat you</h2>
    <div class="duo">
      ${m.victim ? `<div class="box good ${REDUCED?'':'pop'}" style="animation-delay:180ms">
        <div class="k">Your favourite opponent</div>
        <div class="v">${esc(m.victim.vs)}</div>
        <div class="m">${m.victim.w}–${m.victim.l} all time</div></div>` : ''}
      ${m.nemesis ? `<div class="box bad ${REDUCED?'':'pop'}" style="animation-delay:300ms">
        <div class="k">Your nemesis</div>
        <div class="v">${esc(m.nemesis.vs)}</div>
        <div class="m">${m.nemesis.w}–${m.nemesis.l} all time</div></div>` : ''}
    </div>
    ${m.favourite ? `<p class="lede ${REDUCED?'':'in'}" style="animation-delay:420ms">
      You drafted <strong>${esc(m.favourite[0])}</strong> ${m.favourite[1]} times.
      Make of that what you will.</p>` : ''}` }),

  m => ({ eyebrow: 'The draft', body: `
    <h2 class="big ${REDUCED?'':'in'}">Grade: ${m.draft ? esc(m.draft.grade) : '—'}</h2>
    <p class="lede ${REDUCED?'':'in'}" style="animation-delay:120ms">
      ${m.draft ? `${m.draft.per > 0 ? '+' : ''}${m.draft.per} points of value per draft across
        ${m.draft.years} of them.` : 'Not enough draft history to grade.'}</p>
    <div class="duo">
      ${m.steal ? `<div class="box good ${REDUCED?'':'pop'}" style="animation-delay:240ms">
        <div class="k">Best pick</div><div class="v">${esc(m.steal.p)}</div>
        <div class="m">${m.steal.y} · ${esc(m.steal.rd)} · ${esc(m.steal.val)}</div></div>` : ''}
      ${m.bust ? `<div class="box bad ${REDUCED?'':'pop'}" style="animation-delay:360ms">
        <div class="k">Worst pick</div><div class="v">${esc(m.bust.p)}</div>
        <div class="m">${m.bust.y} · ${esc(m.bust.rd)} · ${esc(m.bust.val)}</div></div>` : ''}
    </div>` }),

  m => ({ eyebrow: 'The verdict', body: `
    <h2 class="hero ${REDUCED?'':'in'}" style="font-size:clamp(34px,8vw,80px)">${esc(m.verdict[0])}</h2>
    <p class="sub ${REDUCED?'':'in'}" style="animation-delay:200ms">${esc(m.verdict[1])}</p>` }),

  m => ({ eyebrow: 'The case', room: true, body: caseHTML(m) }),
];

/* ---------- the trophy case ---------- */
const WEB = c => `<svg class="web ${c}" viewBox="0 0 100 100" fill="none" stroke="currentColor"
  stroke-width="1.1"><path d="M0 0 L100 0 M0 0 L92 38 M0 0 L70 70 M0 0 L38 92 M0 0 L0 100"/>
  <path d="M22 0 Q17 17 0 22 M42 0 Q34 34 0 42 M64 0 Q52 52 0 64 M88 0 Q72 72 0 88"/></svg>`;

function caseHTML(m) {
  const P = m.plates, bare = !P.gold.length && !P.silver.length && !P.bronze.length;
  const plate = (cls, big, lab, d, k) => `<div class="plate ${cls} ${REDUCED?'':'pop'}"
    style="animation-delay:${180 + k * 90}ms"><div class="yr">${d.y}</div>
    <div class="big2">${big}</div><div class="lab">${lab}</div><div class="rec">${d.r}</div></div>`;
  let k = 0;
  const top = P.gold.map(d => plate('gold', '1st', 'Champion', d, k++)).join('');
  const bot = [...P.silver.map(d => plate('silver', '2nd', 'Runner-up', d, k++)),
               ...P.bronze.map(d => plate('bronze', '3rd', 'Third', d, k++))].join('');
  return `<div class="roomWrap"><div class="caseWrap">
    <div class="case ${REDUCED?'':'in'}"><div class="crown"></div>
      <div class="felt"><div class="lights"></div>
        ${bare ? WEB('tl') + WEB('tr') + WEB('bl') : ''}
        ${bare ? '<div class="dust">Nothing but dust in here.</div>'
               : (top ? `<div class="shelf">${top}</div>` : '') + (bot ? `<div class="shelf">${bot}</div>` : '')}
      </div><div class="plaque">${esc(m.name)}</div>
    </div></div>
    ${P.loo.length ? `<div class="floor">${P.loo.map((d, j) => `
      <div class="loo ${REDUCED?'':'pop'}" style="animation-delay:${380 + j * 110}ms">
        <div class="yr">${d.y}</div><div class="lab">Biggest<br>Loser</div>
        <div class="rec">${d.r}</div></div>`).join('')}</div>`
      : '<div class="floor"></div>'}
  </div>`;
}

/* ---------- deck ---------- */
function renderDeck() {
  const c = CARDS[i](M);
  app.innerHTML = `<div class="deck" style="--acc:${M.accent[0]};--acc2:${M.accent[1]}">
    <div class="bars">${CARDS.map((_, k) =>
      `<i class="${k < i ? 'done' : k === i ? 'on' : ''}"><b></b></i>`).join('')}</div>
    <div class="top"><span class="who2">${esc(M.name)} · ${LEAGUES[M.league]}</span>
      <span class="topnav">
        <button id="exit">All managers</button>
        ${BACK ? `<a href="${BACK}">Record book</a>` : ''}
      </span></div>
    <div class="card${c.room ? ' room' : ''}">
      ${c.room
        ? `<div class="eyebrow ${REDUCED?'':'in'}">${esc(c.eyebrow)}</div>${c.body}`
        : `<div class="inner"><div class="eyebrow ${REDUCED?'':'in'}">${esc(c.eyebrow)}</div>${c.body}</div>`}
    </div>
    <div class="nav"><span><em>${i + 1}</em> / ${CARDS.length}</span>
      ${i === CARDS.length - 1
        ? `<span class="ends"><button id="again">Pick someone else</button>${
            BACK ? `<a href="${BACK}">Back to the record book</a>` : ''}</span>`
        : '<span>Tap to continue</span>'}</div>
  </div>`;
  document.getElementById('exit').onclick = e => { e.stopPropagation(); pickerScreen(); };
  const again = document.getElementById('again');
  if (again) again.onclick = e => { e.stopPropagation(); pickerScreen(); };
  countUp();
}

// numbers tick up rather than appearing; the label is readable throughout
function countUp() {
  if (REDUCED) return;
  app.querySelectorAll('.n[data-to]').forEach(el => {
    const to = +el.dataset.to, dec = String(to).includes('.') ? 1 : 0, t0 = performance.now(), D = 780;
    (function step(t) {
      const p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  });
}

const go = d => { const n = i + d; if (n < 0 || n >= CARDS.length) return; i = n; renderDeck(); };

addEventListener('keydown', e => {
  if (!M) return;
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); }
  if (e.key === 'ArrowLeft') go(-1);
  if (e.key === 'Escape') pickerScreen();
});
addEventListener('click', e => {
  if (!M || e.target.closest('button, a')) return;
  // tapping the left sixth goes back, anywhere else advances
  go(e.clientX < innerWidth / 6 ? -1 : 1);
});
let tx = null;
addEventListener('touchstart', e => tx = e.changedTouches[0].clientX, { passive: true });
addEventListener('touchend', e => {
  if (!M || tx === null) return;
  const dx = e.changedTouches[0].clientX - tx;
  if (Math.abs(dx) > 45) { go(dx < 0 ? 1 : -1); tx = null; }
});

/* ---------- picker ---------- */
function pickerScreen() {
  M = null; history.replaceState(null, '', location.pathname);
  const group = sl => DATA.filter(d => d.league === sl).map(d =>
    `<button class="who" data-l="${d.league}" data-m="${esc(d.name)}">
      <b>${esc(d.name)}</b><span>${d.seasons} seasons · ${d.w}–${d.l}</span></button>`).join('');
  app.innerHTML = `<div class="pick">
    ${BACK ? `<a class="back" href="${BACK}">\u2190 Back to the record book</a>` : ''}
    <h1>The Tape</h1>
    <p class="dek">Every season on the books, one manager at a time. Pick a name and tap
       through — it ends where it should, at the trophy case.</p>
    ${Object.entries(LEAGUES).map(([k, v]) =>
      // a single-league page does not need to caption the only league it has
      `${Object.keys(LEAGUES).length > 1 ? `<h2>${v}</h2>` : ''}
       <div class="grid">${group(k)}</div>`).join('')}
  </div>`;
  app.querySelectorAll('.who').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    start(b.dataset.l, b.dataset.m);
  });
}

function start(l, name) {
  M = DATA.find(d => d.league === l && d.name === name);
  if (!M) return pickerScreen();
  i = Math.min(CARDS.length - 1, Math.max(0, +(new URLSearchParams(location.search).get('c') || 1) - 1));
  history.replaceState(null, '', `?l=${encodeURIComponent(l)}&m=${encodeURIComponent(name)}`);
  renderDeck();
}

const q = new URLSearchParams(location.search);
// A per-league page only carries one league, so ?m= alone is a valid deep link;
// ?l= is only needed where the page holds more than one.
const ONLY = Object.keys(LEAGUES).length === 1 ? Object.keys(LEAGUES)[0] : null;
if (q.get('m')) start(q.get('l') || ONLY, q.get('m')); else pickerScreen();


/* dev only: report anything wider than the viewport */
if (q.get('probe')) {          // PROBE  (q is captured before replaceState rewrites the URL)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const V = document.documentElement.clientWidth, bad = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > V + 0.5 || r.left < -0.5)
        bad.push(`${el.className||el.tagName} L${r.left.toFixed(0)} R${r.right.toFixed(0)} W${r.width.toFixed(0)}`);
    });
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;top:0;right:0;z-index:99;background:#000;color:#0f0;'
      + 'font:11px/1.35 monospace;padding:6px;white-space:pre-wrap';
    d.textContent = 'VIEWPORT ' + V + '\n' + (bad.slice(0, 10).join('\n') || 'all inside');
    document.body.appendChild(d);
  }));
}
