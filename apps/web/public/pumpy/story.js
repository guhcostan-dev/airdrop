/* Scroll position alone places the mascot; every frame is a pure function of it, in both directions. */
(() => {
  'use strict';
  const section = document.querySelector('.scroll-story');
  const hero = document.querySelector('.hero-mascot');
  if (!section || !hero?.querySelector('svg') || !window.PumpyScroll) return;
  // Keep the original actor/SVG in one viewport layer, including at rest. A
  // normal-flow button retains the title's layout and keyboard interaction.
  const traveler = hero;
  const oldTraveler = document.querySelector('.story-traveler');
  if (oldTraveler && oldTraveler !== hero) oldTraveler.remove();
  const heroSlot = document.createElement('button');
  heroSlot.className = 'hero-mascot-slot';
  heroSlot.type = 'button';
  heroSlot.setAttribute('aria-label', hero.getAttribute('aria-label') || 'Cumprimentar o Pumpy');
  heroSlot.setAttribute('title', hero.getAttribute('title') || 'Dê um oi ao Pumpy');
  Object.assign(heroSlot.style, {display: 'block', width: '1.45em', height: '1.45em',
    padding: '0', border: '0', background: 'none', borderRadius: '30%',
    font: 'inherit', lineHeight: '1', marginTop: '-.11em'});
  heroSlot.addEventListener('click', () => hero.click());
  let fixed = false;
  hero.classList.add('story-traveler');
  hero.style.display = 'block';
  function placeActor(enabled) {
    if (enabled && !fixed) {
      const initial = hero.getBoundingClientRect();
      hero.before(heroSlot);
      document.body.append(hero);
      fixed = true;
      hero.tabIndex = -1;
      hero.setAttribute('aria-hidden', 'true');
      Object.assign(hero.style, {position: 'fixed', left: '0', top: '0', margin: '0',
        pointerEvents: 'none', transformOrigin: '0 0', transition: 'none',
        width: `${initial.width}px`, height: `${initial.height}px`,
        transform: `translate3d(${initial.left}px, ${initial.top + window.scrollY}px, 0)`});
    } else if (!enabled && fixed) {
      heroSlot.replaceWith(hero);
      fixed = false;
      hero.removeAttribute('aria-hidden');
      hero.removeAttribute('tabindex');
      for (const key of ['position', 'left', 'top', 'margin', 'pointerEvents', 'transformOrigin',
        'transform', 'width', 'height', 'clipPath', 'opacity', 'visibility', 'transition']) hero.style[key] = '';
      const capture = {pose: null};
      hero.dispatchEvent(new CustomEvent('pumpy:read-pose', {detail: capture}));
      if (capture.pose) hero.dispatchEvent(new CustomEvent('pumpy:scroll-pose', {detail: capture.pose}));
    }
  }
  const heroBounds = () => (fixed ? heroSlot : hero).getBoundingClientRect();
  const stage = section.querySelector('.story-stage');
  const canvas = section.querySelector('.story-canvas');
  const request = section.querySelector('.story-request');
  const text = section.querySelector('.story-request-text');
  const tools = section.querySelector('.story-composer-tools');
  const send = section.querySelector('.story-send');
  const answer = section.querySelector('.story-answer');
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const startsLight = root.dataset.theme === 'light';
  root.dataset.startTheme = startsLight ? 'light' : 'dark';
  // Invert the starting palette only when the reply covers the viewport.
  function setPageInverted(inverted) {
    const light = startsLight !== inverted;
    const theme = light ? 'light' : 'dark';
    if (root.dataset.theme === theme) return;
    root.dataset.theme = theme;
    themeColor?.setAttribute('content', light ? '#ffffff' : '#0b0b0c');
    window.dispatchEvent(new CustomEvent('pumpy:theme-changed'));
  }
  const thinking = section.querySelector('.story-thinking');
  const anchor = section.querySelector('.story-dot-anchor');
  const hint = section.querySelector('.story-scroll-hint');
  const heroSection = document.querySelector('.hero');
  const heroContent = heroSection.querySelector('.hero-content');
  const header = document.querySelector('.header');
  const nutritionSection = document.querySelector('.nutrition-story');
  const nutritionDock = nutritionSection?.querySelector('.nutrition-dock');
  const fullText = text.textContent;
  const motion = window.PumpyScroll;
  const visualScroll = () => motion.read();
  function shiftedRect(element, shift = 0) {
    const rect = element.getBoundingClientRect();
    return {left: rect.left, right: rect.right, width: rect.width, height: rect.height,
      top: rect.top + shift, bottom: rect.bottom + shift};
  }
  // The browser pins each stage natively. Measurements follow the visual clock, so
  // a wheel notch eases Pumpy instead of teleporting it along with the stage.
  function stageOffset(owner, ownerStage, headerHeight, y) {
    const rect = owner.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const height = ownerStage.offsetHeight;
    const stageTop = Math.max(top - y, Math.min(headerHeight, top + owner.offsetHeight - y - height));
    return stageTop - ownerStage.getBoundingClientRect().top;
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dots = [-1, 1].map(() => {
    const dot = document.createElement('span');
    dot.className = 'story-split-dot';
    dot.setAttribute('aria-hidden', 'true');
    document.body.append(dot);
    return dot;
  });
  const clamp = (n) => Math.min(1, Math.max(0, n));
  const range = (n, a, b) => clamp((n - a) / (b - a));
  const ease = (n) => n * n * (3 - 2 * n);
  const mix = (a, b, t) => a + (b - a) * t;
  const limitGaze = (n) => Math.min(.095, Math.max(-.095, n));
  // Fixed actors sit outside the stage, so match its visible bounds once they
  // become chat UI. Keep the hero's flight free to cross the section boundary.
  function clipToStage(element, x, y, width, height, bounds) {
    if (!bounds) {
      element.style.clipPath = '';
      return;
    }
    const left = Math.max(x, bounds.left);
    const top = Math.max(y, bounds.top);
    const right = Math.min(x + width, bounds.right);
    const bottom = Math.min(y + height, bounds.bottom);
    element.style.clipPath = right <= left || bottom <= top
      ? 'inset(100% 0 0 0)'
      : `inset(${top - y}px ${x + width - right}px ${y + height - bottom}px ${left - x}px)`;
  }
  // The body becomes a surface by revealing one solid full-screen layer through a
  // mask. Resizing a drawn layer would reallocate and repaint it on every frame.
  // A solid color needs no drawing at all, so even its first frame is instant.
  function paintSurface(x, y, width, height, radius, tail, bounds) {
    const coverWidth = window.innerWidth + 8, coverHeight = window.innerHeight + 8;
    traveler.classList.add('is-surface');
    const left = bounds ? Math.max(x, bounds.left) : x, top = bounds ? Math.max(y, bounds.top) : y;
    const right = bounds ? Math.min(x + width, bounds.right) : x + width;
    const bottom = bounds ? Math.min(y + height, bounds.bottom) : y + height;
    traveler.style.width = `${coverWidth}px`;
    traveler.style.height = `${coverHeight}px`;
    traveler.style.transform = 'translate(-4px, -4px)';
    traveler.style.clipPath = right <= left || bottom <= top ? 'inset(100% 0 0 0)'
      : `inset(${top + 4}px ${coverWidth - 4 - right}px ${coverHeight - 4 - bottom}px ${left + 4}px round ${radius}px ${radius}px ${radius}px ${tail}px)`;
    traveler.dispatchEvent(new CustomEvent('pumpy:scroll-pose', {detail: {surface: {
      width: coverWidth, height: coverHeight, radius: 0, tail: 0,
    }}}));
  }
  function nutritionStart() {
    if (!nutritionDock || !nutritionSection.classList.contains('is-animated')) return null;
    return nutritionSection.getBoundingClientRect().top + window.scrollY - header.getBoundingClientRect().height;
  }
  // Share of the workout-to-nutrition handoff spent turning the message into
  // Pumpy. The remainder is its flight to the photo.
  const handoffForming = .62;
  let enabled = false, metrics, launchPose = null, launchOrigin = null;

  function reset() {
    stage.inert = false;
    if (!enabled) nutritionSection?.style.removeProperty('--workout-reveal');
    section.classList.remove('is-scroll', 'is-inverting');
    traveler.classList.remove('is-surface');
    traveler.style.removeProperty('--pumpy-body');
    const nextStart = nutritionStart();
    if (!enabled || nextStart === null || window.scrollY < nextStart) {
      traveler.classList.remove('is-active');
      traveler.style.clipPath = '';
    }
    hero.style.opacity = '';
    hero.style.visibility = '';
    hero.removeAttribute('data-scroll-suspended');
    launchPose = launchOrigin = null;
    dots.forEach((dot) => { dot.style.opacity = '0'; dot.style.clipPath = ''; });
    [request, text, tools, answer, thinking, canvas].forEach((el) => el.removeAttribute('style'));
    text.textContent = fullText;
    answer.removeAttribute('aria-hidden');
    tools.inert = false;
  }
  let measuredViewport = null;
  function measure() {
    const viewport = motion.viewport();
    measuredViewport = viewport;
    const previousLaunch = {launchPose, launchOrigin};
    enabled = motion.storyFits(viewport);
    reset();
    // A separate CSS entrance would move/fade the source during the SVG handoff.
    heroContent.style.animation = enabled ? 'none' : '';
    placeActor(enabled);
    if (!enabled) { render(); return; }
    section.classList.add('is-scroll');
    const headerHeight = header.getBoundingClientRect().height;
    section.style.setProperty('--story-header', `${headerHeight}px`);
    const rect = section.getBoundingClientRect();
    const heroRect = heroBounds();
    const readingHold = nutritionSection ? viewport.height * .35 : 0;
    metrics = {
      heroX: heroRect.left + heroRect.width * .5,
      heroY: heroRect.top + window.scrollY + heroRect.height * .635,
      heroSize: heroRect.width,
      headerHeight,
      start: rect.top + window.scrollY - headerHeight,
      // Extra section height is a reading pause, not a slower message animation.
      distance: Math.max(1, section.offsetHeight - stage.offsetHeight - readingHold),
      readingHold,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      canvasTop: canvas.offsetTop,
      answerHeight: answer.offsetHeight,
      stageHeight: stage.offsetHeight,
    };
    ({launchPose, launchOrigin} = previousLaunch);
    render();
  }
  function render() {
    if (!enabled) {
      // Reduced motion and very short viewports keep the full conversation in
      // normal flow; only the page palette follows the reader.
      const answerTop = answer.getBoundingClientRect().top + window.scrollY - visualScroll();
      setPageInverted(visualScroll() > 0 && answerTop < window.innerHeight * .5);
      return;
    }
    const nextStart = nutritionStart();
    const scroll = visualScroll();
    // Browsers may round scrollTo to a physical/CSS pixel below this fractional
    // layout boundary, so arrival keeps a 1px tolerance.
    const atNutrition = nextStart !== null && scroll >= nextStart - 1;
    if (launchPose === null) {
      const origin = heroBounds();
      metrics.heroX = origin.left + origin.width * .5;
      metrics.heroY = origin.top + window.scrollY + origin.height * .635;
      metrics.heroSize = origin.width;
    }
    const drift = stageOffset(section, stage, metrics.headerHeight, scroll);
    const stageTop = stage.getBoundingClientRect().top + drift;
    stage.inert = stageTop >= window.innerHeight || stageTop + metrics.stageHeight <= metrics.headerHeight;
    // Ownership follows the section boundary in both directions.
    if (atNutrition) {
      nutritionSection.style.setProperty('--workout-reveal', '1');
      traveler.classList.remove('is-surface');
      setPageInverted(true);
      traveler.style.removeProperty('--pumpy-body');
      section.classList.remove('is-inverting');
      answer.style.opacity = '0';
      answer.setAttribute('aria-hidden', 'true');
      thinking.style.opacity = '0';
      hint.style.opacity = '0';
      dots.forEach((dot) => { dot.style.opacity = '0'; });
      hero.setAttribute('data-scroll-suspended', '');
      return;
    }
    const handoffStart = metrics.start + metrics.distance * .87 + metrics.readingHold;
    const handoffProgress = nextStart === null ? 0 : range(scroll, handoffStart, nextStart);
    const p = clamp((scroll - metrics.start) / metrics.distance);
    const opening = range(p, .58, .8);
    const finalTop = Math.min(metrics.canvasTop, metrics.stageHeight - metrics.answerHeight - 155);
    canvas.style.top = `${mix(metrics.canvasTop, finalTop, ease(opening))}px`;
    const sectionRect = shiftedRect(section, window.scrollY - scroll);
    const canvasRect = shiftedRect(canvas, drift);
    const sent = ease(range(p, .23, .38));
    const mobile = metrics.width < 500;
    const bubbleWidth = Math.min(mobile ? metrics.width * .94 : 408, metrics.width);
    const bubbleHeight = mobile ? 78 : 72;
    // Keep the composer below the centered hero so the first movement still descends.
    const belowHero = metrics.heroY - metrics.headerHeight - metrics.canvasTop + 94;
    const initialY = Math.min(metrics.height - 160, Math.max(145, metrics.height * .37, belowHero));
    const width = mix(metrics.width, bubbleWidth, sent);
    const height = mix(148, bubbleHeight, sent);
    const x = mix(0, metrics.width - bubbleWidth, sent);
    const y = mix(initialY, 0, sent);
    request.style.width = `${width}px`;
    request.style.height = `${height}px`;
    request.style.transform = `translate(${x}px, ${y}px)`;
    request.style.borderRadius = `${mix(28, 24, sent)}px ${mix(28, 24, sent)}px ${mix(28, 6, sent)}px ${mix(28, 24, sent)}px`;
    text.style.fontSize = `${mix(mobile ? 20 : 25, mobile ? 15 : 16, sent)}px`;
    text.style.top = `${mix(23, 15, sent)}px`;
    const typed = Math.floor(mix(0, fullText.length, range(p, .025, .205)));
    const content = fullText.slice(0, typed);
    if (text.textContent !== content) text.textContent = content;
    text.setAttribute('aria-label', fullText);
    tools.style.opacity = String(1 - range(p, .21, .29));
    tools.inert = p > .29;

    if (handoffProgress > 0) {
      const flight = range(handoffProgress, handoffForming, 1);
      // The photo appears under Pumpy as it arrives, never across its path.
      nutritionSection.style.setProperty('--workout-reveal', String(ease(range(flight, .72, 1))));
      renderNutritionHandoff(range(handoffProgress, 0, handoffForming), flight, drift, stageTop);
      return;
    }
    nutritionSection?.style.setProperty('--workout-reveal', '0');
    setPageInverted(false);
    section.classList.remove('is-inverting');
    traveler.style.removeProperty('--pumpy-body');
    answer.style.transform = '';
    answer.style.transformOrigin = '';
    request.style.opacity = '';

    // Descend straight to the composer, watch the sent message, then join the reply.
    const departure = 0;
    const active = (scroll > departure || opening > 0) && sectionRect.bottom > 0 && sectionRect.top < window.innerHeight;
    if (active && launchPose === null) {
      const capture = {pose: null};
      hero.dispatchEvent(new CustomEvent('pumpy:read-pose', {detail: capture}));
      const origin = hero.getBoundingClientRect();
      launchPose = capture.pose;
      launchOrigin = scroll < metrics.start + metrics.distance * .12
        ? {x: origin.left + origin.width * .5, y: origin.top + origin.height * .635, scroll}
        : {x: metrics.heroX, y: metrics.heroY, scroll: departure};
    }
    const returnPose = !active ? launchPose : null;
    if (!active) launchPose = launchOrigin = null;
    heroSlot.inert = active;
    heroSlot.tabIndex = active ? -1 : 0;
    const launchScroll = launchOrigin?.scroll ?? departure;
    const descent = ease(range(scroll, launchScroll, metrics.start + metrics.distance * .12));
    const travel = ease(range(p, .205, .49));
    const dotRect = shiftedRect(anchor, drift);
    const dotX = dotRect.left + dotRect.width / 2;
    const dotY = dotRect.top + dotRect.height / 2;
    const composerX = canvasRect.left + metrics.width * .5;
    const composerY = metrics.headerHeight + metrics.canvasTop + initialY - 62;
    const morph = ease(range(p, .38, .49));
    const stageRect = shiftedRect(stage, drift);
    const stageClip = morph === 1 ? {
      top: Math.max(metrics.headerHeight, stageRect.top),
      right: Math.min(window.innerWidth, stageRect.right),
      bottom: Math.min(window.innerHeight, stageRect.bottom),
      left: Math.max(0, stageRect.left),
    } : null;
    const originX = launchOrigin?.x ?? metrics.heroX;
    const originY = launchOrigin?.y ?? metrics.heroY;
    const launchX = mix(originX, composerX, descent);
    const launchY = mix(originY, composerY, descent);
    const arcTop = Math.max(metrics.headerHeight + 25, Math.min(composerY, dotY) - 145);
    const leftWaypoint = mobile ? Math.max(4, dotX - 34) : Math.max(40, dotX - 60);
    const bezier = (a, b, c, d, t) => (1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t*t*c + t**3*d;
    const centerX = bezier(launchX, composerX - metrics.width * .30, leftWaypoint, dotX, travel);
    const centerY = bezier(launchY, arcTop, arcTop, dotY, travel);
    const size = mix(metrics.heroSize, 14, morph);
    hero.toggleAttribute('data-scroll-suspended', active);
    traveler.classList.add('is-active');
    traveler.style.visibility = 'visible';
    // Float above the sent message; only move behind the text when becoming its surface.
    traveler.classList.toggle('is-flying', morph < 1);
    traveler.style.opacity = '1';
    const requestRect = shiftedRect(request, drift);
    const writingProgress = typed / fullText.length;
    const readingGaze = mix(-.095, .095, writingProgress);
    const followingGaze = limitGaze((requestRect.left + width * .5 - centerX) / 1100);
    const gazeX = mix(readingGaze, followingGaze, ease(range(p, .215, .30)));
    const gazeY = limitGaze((requestRect.top + Math.min(35, height * .5) - centerY) / 900);
    const surprise = ease(range(scroll, departure, departure + 55)) * (1 - ease(range(descent, .65, 1)));

    // At the fully circular pose, use pixel geometry on the SAME body/path.
    // The two satellites physically merge into it before it grows into the balloon.
    if (morph === 1) {
      const answerRect = shiftedRect(answer, drift);
      const growX = ease(range(opening, .15, .72));
      const growY = ease(range(opening, .19, 1));
      const shellWidth = mix(8.4, answerRect.width, growX);
      const shellHeight = mix(8.4, answerRect.height, growY);
      const shellX = mix(dotX - 4.2, answerRect.left, growX);
      const shellY = mix(dotY - 4.2, answerRect.top, growY);
      const radius = Math.min(mix(4.2, 24, ease(opening)), shellWidth / 2, shellHeight / 2);
      paintSurface(shellX, shellY, shellWidth, shellHeight, radius, mix(4.2, 7, growY), stageClip);
      const insetTop = Math.max(0, shellY - answerRect.top);
      const insetLeft = Math.max(0, shellX - answerRect.left);
      const insetRight = Math.max(0, answerRect.right - shellX - shellWidth);
      const insetBottom = Math.max(0, answerRect.bottom - shellY - shellHeight);
      answer.style.clipPath = `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px round ${radius}px)`;
    } else {
      traveler.classList.remove('is-surface');
      traveler.style.clipPath = '';
      traveler.style.width = `${size}px`;
      traveler.style.height = `${size}px`;
      traveler.style.transform = `translate(${centerX - size * .5}px, ${centerY - size * .635}px)`;
      const pose = motion.withMomentum({
        dot: morph, gazeX: gazeX * (1 - morph), gazeY: gazeY * (1 - morph),
        eyeScaleX: 1 + surprise * .5,
        leftEyeScaleY: 1 + surprise * .38, rightEyeScaleY: 1 + surprise * .38,
        leftEyeSmile: 0, rightEyeSmile: 0,
        rotation: -.10 * Math.sin(travel * Math.PI),
      });
      // Pick up the live hero pose rather than snapping from an idle gesture to rest.
      const handoff = ease(range(scroll, launchScroll, launchScroll + 120));
      if (launchPose && handoff < 1) {
        const unitKeys = ['scaleX', 'scaleY', 'eyeScaleX', 'leftEyeScaleY', 'rightEyeScaleY', 'eyeSpacing'];
        for (const [key, from] of Object.entries(launchPose)) {
          const target = pose[key] ?? (unitKeys.includes(key) ? 1 : 0);
          const difference = target - from;
          const delta = key === 'yaw' || key === 'pitch' ? Math.atan2(Math.sin(difference), Math.cos(difference)) : difference;
          pose[key] = from + delta * handoff;
        }
      }
      if (active || returnPose) traveler.dispatchEvent(new CustomEvent('pumpy:scroll-pose', {detail: active ? pose : returnPose}));
      answer.style.clipPath = 'inset(0 0 100% 0)';
    }
    const split = ease(range(p, .46, .52));
    const merge = ease(range(opening, 0, .22));
    dots.forEach((dot, i) => {
      const direction = i === 0 ? -1 : 1;
      const pulse = Math.sin(range(p, .51, .60) * Math.PI * 4 + i * 1.8) * 2 * range(p, .51, .53);
      // Remove only once both satellites are completely inside the growing body.
      dot.style.opacity = String(active && opening < .24 ? split : 0);
      const x = dotX + direction * 12 * split * (1 - merge) - 4.2;
      const y = dotY - 4.2 + pulse * (1 - merge);
      dot.style.transform = `translate(${x}px, ${y}px)`;
      clipToStage(dot, x, y, 8.4, 8.4, stageClip);
    });
    thinking.style.opacity = String(ease(range(p, .49, .53)) * (1 - merge));
    answer.style.opacity = String(ease(range(opening, .30, .48)));
    answer.setAttribute('aria-hidden', String(opening < .30));
    hint.style.opacity = opening > 0 ? '0' : '1';
  }
  function renderNutritionHandoff(handoff, flight, drift, stageTop) {
    // Measure the original letters, never the previous frame's transformed bounds.
    answer.style.transform = '';
    const answerRect = shiftedRect(answer, drift);
    const dockRect = shiftedRect(nutritionDock, stageOffset(nutritionSection,
      nutritionSection.querySelector('.nutrition-stage'), metrics.headerHeight, visualScroll()));
    const expand = ease(range(handoff, 0, .42));
    const gather = ease(range(handoff, .04, .70));
    const unroll = ease(range(handoff, .72, 1));
    const inkX = answerRect.left + answerRect.width / 2;
    const inkY = answerRect.top + answerRect.height / 2;
    // Where the message rests while pinned, so the path depends only on the scroll
    // position and not on how far the stage has already slid away.
    const focusX = Math.max(55, Math.min(window.innerWidth - 55, inkX));
    const focusY = Math.max(metrics.headerHeight + 65, Math.min(window.innerHeight - 70,
      inkY - (stageTop - metrics.headerHeight)));
    // Every line contracts as one group. Text is never enlarged or singled out.
    const inkScale = mix(1, 8.4 / Math.max(1, answerRect.width, answerRect.height), gather);
    const center = ease(range(handoff, 0, .55));
    const inkVisibility = 1 - ease(range(handoff, .62, .73));

    section.classList.add('is-inverting');
    // Swap the page palette only once the SAME contrasting SVG surface covers every edge.
    // On reversal the expanded reply surface masks the switch back just as well.
    setPageInverted(handoff >= .42);
    answer.style.transformOrigin = '50% 50%';
    answer.style.transform = `translate(${(focusX - inkX) * center}px, ${(focusY - inkY) * center}px) scale(${inkScale})`;
    answer.style.clipPath = 'none';
    answer.style.opacity = String(inkVisibility);
    answer.setAttribute('aria-hidden', String(inkVisibility < .3));
    request.style.opacity = String(1 - ease(range(handoff, 0, .18)));
    thinking.style.opacity = hint.style.opacity = '0';
    dots.forEach((dot) => { dot.style.opacity = '0'; });
    traveler.classList.add('is-active');
    traveler.classList.toggle('is-flying', handoff >= .42);
    traveler.style.visibility = 'visible';
    hero.setAttribute('data-scroll-suspended', '');
    heroSlot.inert = true;

    if (handoff < .42) {
      // A little overscan keeps rounded corners outside the viewport at the cut.
      traveler.style.setProperty('--pumpy-body', startsLight ? '#0b0b0c' : '#fff');
      traveler.style.opacity = '1';
      paintSurface(mix(answerRect.left, -4, expand), mix(answerRect.top, -4, expand),
        mix(answerRect.width, window.innerWidth + 8, expand), mix(answerRect.height, window.innerHeight + 8, expand),
        mix(24, 0, expand), mix(7, 0, expand));
    } else {
      traveler.classList.remove('is-surface');
      traveler.style.clipPath = '';
      // The complete message compresses to a dot; its ink becomes the original actor.
      // No second mascot, cross-faded image, or replacement SVG is introduced.
      traveler.style.removeProperty('--pumpy-body');
      traveler.style.opacity = String(ease(range(handoff, .62, .73)));
      const travel = ease(flight);
      const centerX = mix(focusX, dockRect.left + dockRect.width * .5, travel)
        + Math.sin(flight * Math.PI) ** 2 * 32 * unroll;
      const centerY = mix(focusY, dockRect.top + dockRect.height * .635, travel);
      const size = mix(14, dockRect.width, unroll);
      traveler.style.width = traveler.style.height = `${size}px`;
      traveler.style.transform = `translate(${centerX - size * .5}px, ${centerY - size * .635}px)`;
      traveler.dispatchEvent(new CustomEvent('pumpy:scroll-pose', {detail: motion.withMomentum({
        dot: 1 - unroll, gazeX: 0, gazeY: .08 * unroll,
        eyeScaleX: 1, leftEyeScaleY: 1, rightEyeScaleY: 1, rotation: 0,
      })}));
    }
  }
  const schedule = () => motion.request();
  function seek(progress) {
    if (enabled) window.scrollTo({top: metrics.start + metrics.distance * progress, behavior: 'smooth'});
    else answer.scrollIntoView({behavior: 'auto', block: 'center'});
  }
  send.addEventListener('click', () => seek(.51));
  motion.subscribe(() => render());
  window.addEventListener('resize', () => {
    const viewport = motion.viewport();
    if (viewport.width !== measuredViewport?.width || viewport.height !== measuredViewport?.height) measure();
    else schedule();
  });
  window.addEventListener('pageshow', measure);
  reduced.addEventListener('change', measure);
  measure();
})();
