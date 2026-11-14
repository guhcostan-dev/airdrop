const icon = (name, className = '') => `<svg class="icon ${className}" aria-hidden="true"><use href="#${name}"/></svg>`;

const menuButton = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('#mobile-nav');
function closeMenu() {
  mobileMenu.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Abrir menu');
  menuButton.innerHTML = icon('menu');
}
menuButton.addEventListener('click', () => {
  if (!mobileMenu.hidden) { closeMenu(); return; }
  mobileMenu.hidden = false;
  menuButton.setAttribute('aria-expanded', 'true');
  menuButton.setAttribute('aria-label', 'Fechar menu');
  menuButton.innerHTML = icon('close');
});
mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !mobileMenu.hidden) {
    closeMenu();
    menuButton.focus();
  }
});
document.addEventListener('click', (event) => {
  if (!mobileMenu.hidden && !event.composedPath().includes(document.querySelector('.header'))) closeMenu();
});

// The capsule appears only after leaving the top of the page.
const siteHeader = document.querySelector('.header');
siteHeader.dataset.navStyle = 'capsule';
let navScrolled = false;
let navMotion = [];
const navSurface = siteHeader.querySelector('.header-inner');
const navPieces = [...siteHeader.querySelectorAll('.header-logo, .desktop-nav > a, .header-actions > *')];
const navReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const navTouch = window.matchMedia('(pointer: coarse)');
function setNavCollapsed(collapsed) {
  const animateCapsule = siteHeader.dataset.navStyle === 'capsule' && !navReducedMotion.matches;
  const previousWidth = navSurface.getBoundingClientRect().width;
  const previousRects = animateCapsule ? navPieces.map((piece) => piece.getBoundingClientRect()) : [];
  navMotion.forEach((animation) => animation.cancel());
  navMotion = [];
  siteHeader.classList.toggle('is-scrolled', collapsed);
  if (!animateCapsule) return;
  const easing = 'cubic-bezier(.22, 1, .36, 1)';
  const duration = collapsed ? 780 : 650;
  navPieces.forEach((piece, index) => {
    const before = previousRects[index];
    const after = piece.getBoundingClientRect();
    if (!before.width || !after.width) return;
    const scale = piece.classList.contains('header-logo') ? before.width / after.width : 1;
    navMotion.push(piece.animate([
      { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${scale})` },
      { transform: 'translate(0, 0) scale(1)' },
    ], { duration, easing, delay: collapsed ? Math.min(index * 14, 70) : 0, fill: 'backwards' }));
  });
  const nextWidth = navSurface.getBoundingClientRect().width;
  const blur = amount => navTouch.matches ? {} : { filter: `blur(${amount}px)` };
  navMotion.push(navSurface.animate([
    { transform: `scaleX(${previousWidth / nextWidth})`, opacity: collapsed ? 0 : 1, ...blur(3) },
    { transform: 'scaleX(1)', opacity: collapsed ? 1 : 0, ...blur(0) },
  ], { pseudoElement: '::before', duration, easing }));

}
function syncNavScroll() {
  const scrolled = window.scrollY > (navScrolled ? 24 : 64);
  if (scrolled === navScrolled) return;
  navScrolled = scrolled;
  setNavCollapsed(scrolled);
}
window.addEventListener('scroll', syncNavScroll, { passive: true });
window.addEventListener('pageshow', syncNavScroll);
syncNavScroll();
