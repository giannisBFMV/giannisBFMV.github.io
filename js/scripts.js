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
