/* NutritionSun geometry and palette mirror the native DietNutritionSummary.
 * A parent scroll controller supplies progress; this renderer never runs a clock.
 */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const macros = [
    { label: 'Hermes HBC', value: 96, goal: 100 },
    { label: 'Crash-free', value: 99.8, goal: 100 },
    { label: 'Cache Hit', value: 94, goal: 100 },
  ];
  const screenMacros = [{value: 98.4, goal: 100}, {value: 99.9, goal: 100}, {value: 96.5, goal: 100}];
  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const cubicOut = (value) => 1 - (1 - clamp(value)) ** 3;
  // Native entrance delays/durations: macros 90/180/270 + 800ms; water 120 + 1000ms.
  const entrance = (progress, delay, duration) => cubicOut((progress * 1120 - delay) / duration);
  const element = (tag, attrs) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  };
  const circle = (radius, className) => element('circle', {
    cx: 120, cy: 120, r: radius, class: className, fill: 'none',
    'stroke-width': 3, 'stroke-linecap': 'round',
  });
  const arcProgress = new WeakMap();
  const setArc = (node, progress) => {
    if (arcProgress.get(node) === progress) return;
    arcProgress.set(node, progress);
    node.setAttribute('stroke-dasharray', `${progress} 1`);
    node.setAttribute('opacity', progress > 0 ? '1' : '0');
  };

  for (const sun of document.querySelectorAll('.nutrition-sun')) {
    if (sun.dataset.sunMounted === 'true') continue;
    const svg = sun.querySelector('.nutrition-sun-visual');
    if (!svg) continue;
    sun.dataset.sunMounted = 'true';
    svg.setAttribute('viewBox', '0 0 240 240');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const metrics = sun.parentElement.querySelector('.nutrition-sun-metrics');
    const buttons = metrics ? [...metrics.querySelectorAll('[data-sun-macro]')] : [];
    const calorieTrack = circle(116, 'nutrition-sun-track nutrition-sun-calorie-track');
    const calories = circle(116, 'nutrition-sun-calorie-fallback');
    const waterTrack = circle(56, 'nutrition-sun-track nutrition-sun-water-track');
    const water = circle(56, 'nutrition-sun-water-fill');
    for (const arc of [calories, water]) {
      arc.setAttribute('pathLength', '1');
      arc.setAttribute('transform', 'rotate(-90 120 120)');
    }
    svg.replaceChildren(calorieTrack, calories, waterTrack, water);
    const groups = [], rays = [];
    macros.forEach((macro, index) => {
      const group = element('g', { class: `nutrition-sun-rays nutrition-sun-rays-${index}` });
      const active = [];
      for (let tick = 0; tick < 24; tick++) {
        const angle = (index * 120 + 6 + tick * (108 / 23) - 90) * Math.PI / 180;
        const geometry = {
          x1: 120 + Math.cos(angle) * 68, y1: 120 + Math.sin(angle) * 68,
          x2: 120 + Math.cos(angle) * 98, y2: 120 + Math.sin(angle) * 98,
          'stroke-width': 2, 'stroke-linecap': 'round', pathLength: 1,
        };
        group.append(element('line', { ...geometry, class: 'nutrition-sun-track' }));
        const ray = element('line', { ...geometry, class: 'nutrition-sun-ray-fill' });
        group.append(ray);
        active.push(ray);
      }
      svg.append(group);
      groups.push(group);
      rays.push(active);
    });
    let selected = null;
    function select(index) {
      selected = selected === index ? null : index;
      groups.forEach((group, i) => { group.style.opacity = selected === null || selected === i ? '1' : '.18'; });
      buttons.forEach((button) => {
        const ownIndex = Number(button.dataset.sunMacro);
        button.setAttribute('aria-pressed', String(selected === ownIndex));
        button.style.opacity = selected === null || selected === ownIndex ? '1' : '.45';
      });
    }
    buttons.forEach((button) => {
      const index = Number(button.dataset.sunMacro);
      const macro = macros[index];
      if (!macro) return;
      button.setAttribute('type', 'button');
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `${macro.label}: ${macro.value}% de ${macro.goal}%. Destacar no gráfico.`);
      button.addEventListener('click', () => select(index));
    });
    let lastProgress = null, lastScreenProgress = null;
    function render(progress, screenProgress = 0) {
      const p = Number.isFinite(progress) ? clamp(progress) : 1;
      const screen = Number.isFinite(screenProgress) ? clamp(screenProgress) : 0;
      if (p === lastProgress && screen === lastScreenProgress) return;
      lastProgress = p;
      lastScreenProgress = screen;
      setArc(calories, mix(.64, 1780 / 2000, screen) * entrance(p, 60, 1000));
      setArc(water, .6 * entrance(p, 120, 1000) * (1 - screen));
      waterTrack.style.opacity = String(1 - screen);
      rays.forEach((active, index) => {
        // Native compound path trim traverses every 30px ray sequentially.
        const filledRays = 24 * mix(macros[index].value / macros[index].goal, screenMacros[index].value / screenMacros[index].goal, screen) * entrance(p, 90 + index * 90, 800);
        active.forEach((ray, tick) => setArc(ray, clamp(filledRays - tick)));
      });
    }
    sun.addEventListener('pumpy:sun-progress', (event) => {
      render(event.detail?.animated === false ? 1 : event.detail?.progress, event.detail?.screenProgress);
    });
    render(1);
  }
  dispatchEvent(new CustomEvent('pumpy:sun-ready'));
})();
