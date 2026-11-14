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
  const next = isDark() ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
  syncToggle();
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
