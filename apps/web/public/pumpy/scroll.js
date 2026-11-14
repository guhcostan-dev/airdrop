/* One visual clock over the browser's own scrolling.
   Input is never intercepted: wheel, trackpad, touch, keys and the scrollbar all
   move the native position, and every scene is a pure function of that position. */
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)');
  // A clicky wheel jumps ~100px per notch, so ease between notches. A trackpad is
  // nearly continuous. A phone reports its scroll position unevenly while the
  // browser moves the page, so a light smoothing keeps the scene from stuttering.
  const STEPPED_RESPONSE = 120, FINE_RESPONSE = 60, TOUCH_RESPONSE = 70, SPEED_RESPONSE = 170;
  const MIN_STORY_HEIGHT = 520, FULL_STRETCH_SPEED = 5;
  const listeners = new Set();
  const actual = () => Math.max(0, window.scrollY);
  // A refresh always starts over at the hero. Opening a link to a section still
  // lands on that section.
  window.history.scrollRestoration = 'manual';
  function startOver() {
    const reloaded = performance.getEntriesByType?.('navigation')[0]?.type === 'reload';
    if (window.location.hash && !reloaded || window.scrollY <= 0) return;
    // CSS smooth scrolling would replay the whole story on the way back up.
    const root = document.documentElement, behavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo({top: 0, behavior: 'auto'});
    root.style.scrollBehavior = behavior;
  }
  startOver();
  let value = actual(), target = value, speed = 0, frame = null, previousTime = 0;
  let response = coarse.matches ? TOUCH_RESPONSE : STEPPED_RESPONSE;
  let layoutViewport = null;

  function viewport() {
    const width = window.innerWidth, height = window.innerHeight;
    // A phone's toolbar and keyboard resize the visible area during a swipe.
    // Keep one layout until the width really changes, which includes rotation.
    const keepsHeight = width <= 760 || coarse.matches;
    if (!layoutViewport || width !== layoutViewport.width ||
        !keepsHeight && height !== layoutViewport.height) {
      layoutViewport = Object.freeze({width, height});
      document.documentElement.style.setProperty('--pumpy-viewport-height', `${height}px`);
    }
    return layoutViewport;
  }
  viewport();

  function publish(now) {
    for (const listener of [...listeners]) listener(value, now);
  }
  function cancelFrame() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    previousTime = 0;
  }
  function sync() {
    cancelFrame();
    speed = 0;
    value = target = actual();
    publish(performance.now());
  }
  function request() {
    if (document.hidden || reduced.matches || frame !== null) return;
    if (previousTime === 0) previousTime = performance.now();
    frame = window.requestAnimationFrame(tick);
  }
  function tick(now) {
    frame = null;
    if (document.hidden || reduced.matches) { sync(); return; }
    const elapsed = Math.max(0, Math.min(64, now - previousTime));
    previousTime = now;
    target = actual();
    const before = value;
    value += (target - value) * (1 - Math.exp(-elapsed / response));
    const settled = Math.abs(target - value) < .1;
    if (settled) value = target;
    if (elapsed) speed += ((value - before) / elapsed - speed) * (1 - Math.exp(-elapsed / SPEED_RESPONSE));
    if (settled && Math.abs(speed) < .004) speed = 0;
    publish(now);
    if (!settled || speed !== 0) request();
    if (frame === null) previousTime = 0;
  }
  // Scrolling has weight: Pumpy stretches along a fast move and looks where it is
  // going, then relaxes as the page comes to rest.
  function withMomentum(pose) {
    const amount = Math.sqrt(Math.min(1, Math.abs(speed) / FULL_STRETCH_SPEED)) * (1 - (pose.dot ?? 0));
    if (!amount) return pose;
    const direction = Math.sign(speed);
    return {...pose,
      scaleX: (pose.scaleX ?? 1) * (1 - .09 * amount),
      scaleY: (pose.scaleY ?? 1) * (1 + .13 * amount),
      rotation: (pose.rotation ?? 0) + .07 * direction * amount,
      gazeY: (pose.gazeY ?? 0) + .05 * direction * amount,
    };
  }

  window.addEventListener('wheel', event => {
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    response = Math.abs(event.deltaY * unit) >= 40 ? STEPPED_RESPONSE : FINE_RESPONSE;
  }, {passive: true});
  window.addEventListener('touchstart', () => { response = TOUCH_RESPONSE; }, {passive: true});

  window.PumpyScroll = Object.freeze({
    read: () => value,
    velocity: () => speed,
    viewport,
    request,
    withMomentum,
    storyFits: layout => !reduced.matches && layout.height >= MIN_STORY_HEIGHT,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  window.addEventListener('scroll', () => {
    target = actual();
    if (reduced.matches || document.hidden) { sync(); return; }
    request();
  }, {passive: true});
  window.addEventListener('pageshow', event => {
    if (!event.persisted) startOver();
    sync();
  }, {passive: true});
  for (const type of ['hashchange', 'popstate']) window.addEventListener(type, sync, {passive: true});
  function resume() {
    target = actual();
    if (document.hidden) sync();
    else request();
  }
  for (const type of ['resize', 'blur', 'focus']) window.addEventListener(type, resume, {passive: true});
  document.addEventListener('visibilitychange', resume);
  reduced.addEventListener('change', sync);
})();
