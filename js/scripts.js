const root = document.documentElement;
root.classList.add('js');

// Theme toggle: flips the effective theme and remembers the choice
const dark = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (root.dataset.theme || (dark.matches ? 'dark' : 'light')) === 'dark';
const toggle = document.querySelector('.theme-toggle');
const syncToggle = () => toggle.setAttribute('aria-pressed', String(isDark()));
syncToggle();
dark.addEventListener('change', syncToggle);
toggle.addEventListener('click', () => {
  const apply = () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    syncToggle();
  };
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return apply();
  // Fade + zoom lives in CSS; ready rejects when a rapid click skips the transition
  document.startViewTransition(apply).ready.catch(() => {});
});

// Active nav link for the section in view
const links = new Map([...document.querySelectorAll('.nav-links a')].map(a => [a.hash.slice(1), a]));
// The last section is too short to reach the observer band, so the bottom of the page claims it
const atBottom = () => innerHeight + scrollY >= root.scrollHeight - 2;
let inView = null;
const markActive = () => {
  const a = atBottom() ? [...links.values()].pop() : links.get(inView);
  if (!a) return;
  links.forEach(l => l.removeAttribute('aria-current'));
  a.setAttribute('aria-current', 'true');
};
const navObserver = new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) inView = e.target.id;
  markActive();
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('main section[id]').forEach(s => navObserver.observe(s));

// Scroll reveal (CSS only hides .reveal when motion is allowed)
const revealObserver = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (e.isIntersecting) { e.target.classList.add('is-visible'); revealObserver.unobserve(e.target); }
  }
}, { rootMargin: '0px 0px -10% 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// Back to top
const toTop = document.querySelector('.to-top');
const onScroll = () => { toTop.hidden = scrollY < 400; markActive(); };
addEventListener('scroll', onScroll, { passive: true });
onScroll();
toTop.addEventListener('click', () => {
  scrollTo({ top: 0 });
  document.querySelector('.brand').focus({ preventScroll: true });
});

document.getElementById('year').textContent = new Date().getFullYear();

// Hero typewriter: every char stays in the layout (visibility only), so nothing below moves
const cursor = Object.assign(document.createElement('span'), { className: 'cursor', textContent: '_' });
cursor.setAttribute('aria-hidden', 'true');
const heroH1 = document.querySelector('.hero h1');
if (matchMedia('(prefers-reduced-motion: reduce)').matches) heroH1.append(cursor);
else {
  const split = el => {
    // Screen readers get one full copy; the typed version is hidden from them
    const sr = Object.assign(document.createElement('span'), { className: 'sr-only', textContent: el.textContent });
    const typed = document.createElement('span');
    typed.setAttribute('aria-hidden', 'true');
    typed.append(...el.childNodes);
    el.append(sr, typed);
    const walker = document.createTreeWalker(typed, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    return texts.flatMap(t => {
      const chars = [...t.data].map(c => Object.assign(document.createElement('span'), { className: 'tw', textContent: c }));
      t.replaceWith(...chars);
      return chars;
    });
  };
  const type = (chars, ms) => new Promise(done => {
    let i = 0;
    const tick = () => {
      if (i === chars.length) return done();
      chars[i].classList.remove('tw');
      chars[i++].after(cursor);
      setTimeout(tick, ms);
    };
    tick();
  });
  const eyebrowChars = split(document.querySelector('.hero .eyebrow'));
  const h1Chars = split(heroH1);
  type(eyebrowChars, 1000 / eyebrowChars.length) // ~1s each part, whatever the text length
    .then(() => type(h1Chars, 1000 / h1Chars.length));
}

// Cursor spotlight: transform-only updates (compositor), at most one per frame
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const glow = document.createElement('div');
  glow.className = 'spotlight';
  glow.setAttribute('aria-hidden', 'true');
  document.body.prepend(glow);
  let x = 0, y = 0, frame = 0;
  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      glow.style.transform = `translate3d(${x - 300}px, ${y - 300}px, 0)`;
      glow.classList.add('is-on');
    });
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => glow.classList.remove('is-on'));
}

// Copy email: on clipboard failure the mailto link next to it still works
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mailLink = document.querySelector('.meta a[href^="mailto:"]');
const toast = document.querySelector('.toast');
let toastTimer = 0;
const showToast = msg => {
  toast.textContent = msg;
  toast.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2000);
};
const copyEmail = async () => {
  try {
    await navigator.clipboard.writeText(mailLink.href.slice(7));
    showToast('Email copied');
  } catch (e) {}
};
document.querySelector('.copy-btn').addEventListener('click', copyEmail);

// Command palette
const palette = document.querySelector('.palette');
const paletteInput = palette.querySelector('.palette-input');
const paletteList = palette.querySelector('.palette-list');
const paletteEmpty = palette.querySelector('.palette-empty');
const social = label => document.querySelector(`.socials a[aria-label="${label}"]`).href;
const commands = [
  ...[...links.values()].map(a => ({ label: `Go to ${a.textContent}`, run: () => a.click() })),
  { label: 'Toggle theme', run: () => toggle.click() },
  { label: 'Copy email', run: copyEmail },
  { label: 'Open GitHub', run: () => open(social('GitHub'), '_blank', 'noopener') },
  { label: 'Open LinkedIn', run: () => open(social('LinkedIn'), '_blank', 'noopener') },
  { label: 'Download / Print CV', run: () => print() },
];
let shown = [], active = 0;
const setActive = i => {
  const opts = paletteList.children;
  if (!opts.length) return paletteInput.removeAttribute('aria-activedescendant');
  active = (i + opts.length) % opts.length;
  [...opts].forEach((o, j) => o.setAttribute('aria-selected', String(j === active)));
  paletteInput.setAttribute('aria-activedescendant', opts[active].id);
  opts[active].scrollIntoView({ block: 'nearest' });
};
const renderPalette = () => {
  const q = paletteInput.value.trim().toLowerCase();
  shown = commands.filter(c => c.label.toLowerCase().includes(q));
  paletteList.replaceChildren(...shown.map((c, i) => {
    const li = Object.assign(document.createElement('li'), { id: `cmd-${i}`, textContent: c.label });
    li.setAttribute('role', 'option');
    li.addEventListener('click', () => runCommand(i));
    return li;
  }));
  paletteEmpty.hidden = shown.length > 0;
  setActive(0);
};
// Close first so focus returns to the page before the action (e.g. anchor jump) runs
const runCommand = i => { const c = shown[i]; if (!c) return; palette.close(); c.run(); };
const openPalette = () => {
  if (palette.open) return;
  paletteInput.value = '';
  renderPalette();
  palette.showModal();
};
paletteInput.addEventListener('input', renderPalette);
paletteInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setActive(active + (e.key === 'ArrowDown' ? 1 : -1)); }
  else if (e.key === 'Enter') { e.preventDefault(); runCommand(active); }
});
palette.addEventListener('click', e => {
  const r = palette.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) palette.close();
});
document.addEventListener('keydown', e => {
  const typing = e.target.closest('input, textarea, select, [contenteditable]');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
  else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); openPalette(); }
});
const hint = document.querySelector('.kbd-hint');
if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
  hint.querySelector('kbd').textContent = '⌘K';
  hint.setAttribute('aria-keyshortcuts', 'Meta+K');
}
hint.addEventListener('click', openPalette);

// Card hover glow: one delegated listener feeds the card-relative cursor position to CSS
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion) {
  addEventListener('pointermove', e => {
    const card = e.target.closest?.('.card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

// Highlight numbers: years since Sep 2021, then count up once when in view
const now = new Date();
const years = now.getFullYear() - 2021 - (now.getMonth() < 8 ? 1 : 0);
const yearsTile = document.querySelector('.stat-num[data-suffix]');
yearsTile.textContent = yearsTile.nextElementSibling.textContent = `${years}+`;
const statNums = [...document.querySelectorAll('.stat-num')];
if (!reducedMotion) {
  const finals = statNums.map(el => parseInt(el.textContent, 10));
  const render = p => statNums.forEach((el, i) => { el.textContent = Math.round(finals[i] * p) + (el.dataset.suffix || ''); });
  render(0);
  const statsObserver = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    statsObserver.disconnect();
    const start = performance.now();
    const step = t => {
      const p = Math.min(1, Math.max(0, t - start) / 1000);
      render(1 - (1 - p) ** 3); // ease-out cubic
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  statsObserver.observe(document.querySelector('.stats'));
}
