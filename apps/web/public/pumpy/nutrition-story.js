/* One photo, one Pumpy, scrubbed by scroll: the white fill becomes Pumpy again as its gray track curls. */
(() => {
  'use strict';
  const section = document.querySelector('.nutrition-story');
  const traveler = document.querySelector('.story-traveler');
  if (!section || !traveler || !window.PumpyScroll) return;
  const $ = (selector) => section.querySelector(selector);
  const motion = window.PumpyScroll;
  const readViewport = () => motion.viewport();
  let layoutViewport = {...readViewport()};
  const visualScroll = () => motion.read();
  function viewRect(element) {
    const rect = element.getBoundingClientRect();
    return {left: rect.left, right: rect.right, width: rect.width, height: rect.height,
      top: rect.top, bottom: rect.bottom};
  }
  const setText = (element, value) => { if (element.textContent !== value) element.textContent = value; };
  const stage = $('.nutrition-stage'), canvas = $('.nutrition-canvas');
  const composer = $('.nutrition-composer');
  const photo = $('.nutrition-photo'), question = $('.nutrition-question'), dock = $('.nutrition-dock');
  const result = $('.nutrition-photo-result'), analysis = $('.nutrition-analysis');
  const receipt = $('.nutrition-receipt'), note = $('.nutrition-note');
  const scan = $('.nutrition-scan'), pins = [...section.querySelectorAll('.nutrition-pin')];
  const send = $('.nutrition-send'), save = $('.nutrition-save'), replay = $('.nutrition-replay');
  const total = $('.nutrition-total'), track = $('.nutrition-progress');
  const overview = $('.nutrition-overview'), sun = $('.nutrition-sun');
  const overviewTrigger = $('.nutrition-overview-trigger');
  const dashboard = $('.nutrition-dashboard'), dashboardTrigger = $('.nutrition-dashboard-trigger');
  const widgets = [...dashboard.querySelectorAll('.nutrition-widget')];
  const widgetShells = widgets.map(widget => widget.parentElement);
  const sunSlot = dashboard.querySelector('.widget-sun-slot');
  const phone = dashboard.querySelector('.nutrition-widget-phone');
  const integrations = dashboard.querySelector('.nutrition-widget-integrations');
  const integrationIcons = [...dashboard.querySelectorAll('.bento-integration')];
  const notifications = [...dashboard.querySelectorAll('.bento-notification')];
  const device = dashboard.querySelector('.bento-device');
  const sunHeading = $('.nutrition-overview-heading'), sunMetrics = $('.nutrition-sun-metrics');
  const sunCenter = $('.nutrition-sun-center');
  const dashboardLabel = $('.nutrition-dashboard-label');
  const metricItems = [...sunMetrics.children];
  const monthDays = [...dashboard.querySelectorAll('.widget-month-day')];
  const weightLine = dashboard.querySelector('.widget-weight-chart .weight-line');
  const trainingBars = [...dashboard.querySelectorAll('.widget-training-bar')];
  const footerCaption = $('.nutrition-footer > span');
  const footer = document.querySelector('.site-footer');
  const footerMascot = document.querySelector('.footer-pumpy');
  const footerMessages = document.querySelector('.footer-messages');
  footerMessages?.classList.add('is-ready');
  weightLine.setAttribute('pathLength', '1');
  const grayTrack = $('.nutrition-track'), grayPath = grayTrack.querySelector('path');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const range = (n, a, b) => clamp((n - a) / (b - a));
  const ease = (n) => n * n * (3 - 2 * n);
  const mix = (a, b, t) => a + (b - a) * t;
  const place = (el, x, y) => { el.style.transform = `translate(${x}px, ${y}px)`; };
  const reveal = (el, value) => {
    el.style.opacity = String(value);
    // A hidden element frees its layer; a transparent one keeps it in memory.
    el.style.visibility = value > 0 ? '' : 'hidden';
    el.inert = value < .98;
    el.setAttribute('aria-hidden', String(value < .5));
  };
  // A single centerline bends from a flat bar into a closed ring. Its bounds
  // stay centered, so neither end has to jump or be clamped during the curl.
  function curvedTrack(cx, cy, width, sweep) {
    if (sweep < .00001) return `M${cx - width / 2} ${cy} H${cx + width / 2}`;
    const half = sweep / 2;
    const radius = width / (2 * (sweep < Math.PI ? Math.sin(half) : 1));
    const middle = (1 + Math.cos(half)) / 2;
    const points = Array.from({length: 129}, (_, i) => {
      const angle = -half + sweep * i / 128;
      return `${i ? 'L' : 'M'}${(cx + radius * Math.sin(angle)).toFixed(4)} ${(cy + radius * (Math.cos(angle) - middle)).toFixed(4)}`;
    });
    return points.join(' ') + (sweep >= 2 * Math.PI ? ' Z' : '');
  }
  function trackColor(amount, compact = 0) {
    const light = document.documentElement.dataset.theme === 'light';
    // The source is the composited --line-strong tone; the destination is NutritionSun's track.
    const from = light ? [215, 215, 213] : [42, 42, 43];
    const circle = light ? [218, 218, 223] : [26, 27, 27];
    const to = circle.map((value, i) => mix(value, [26, 27, 27][i], compact));
    return `rgb(${from.map((channel, i) => Math.round(mix(channel, to[i], amount))).join(',')})`;
  }
  function widgetGeometry() {
    const rect = viewRect(sunSlot);
    const padding = 0;
    const width = rect.width;
    const size = Math.min(width, rect.height);
    return {rect, padding, width, size};
  }
  let overviewLayout = null, widgetPaint = null, trackGeometry = null;
  function layoutOverview(width, size, progress, phoneSize = widgetGeometry().size) {
    const signature = [width, size, progress, phoneSize, layoutViewport.width > 600, document.documentElement.dataset.theme].join(':');
    if (overviewLayout === signature) return;
    overviewLayout = signature;
    const text = 1 - ease(range(progress, .05, .5));
    overview.style.width = `${width}px`;
    overview.style.setProperty('--nutrition-sun-size', `${size}px`);
    sunHeading.style.height = `${mix(25.5, 0, progress)}px`;
    sunHeading.style.marginBottom = `${mix(layoutViewport.width <= 600 ? 18 : 24, 0, progress)}px`;
    sunHeading.style.overflow = 'hidden'; sunHeading.style.opacity = String(text);
    sunCenter.style.opacity = '1';
    const screenProgress = ease(range(progress, .35, 1));
    overview.style.setProperty('--sun-number-size', `${mix(29, phoneSize * .105, progress)}px`);
    overview.style.setProperty('--sun-unit-size', `${mix(10, phoneSize * .038, progress)}px`);
    overview.style.setProperty('--sun-number-spacing', `${mix(-1, -.3, progress)}px`);
    setText(sunCenter.querySelector('strong'), Math.round(mix(1280, 1780, screenProgress)).toLocaleString('pt-BR'));
    setText(sunCenter.querySelector('span'), `de ${Math.round(mix(2000, 2000, screenProgress)).toLocaleString('pt-BR')} ativos`);
    overview.setAttribute('aria-label', screenProgress > .5
      ? 'Resumo da tela do Airdrop: 1.780 de 2.000 dispositivos atualizados, 98,4% Hermes HBC, 99,9% crash-free e 96,5% cache hit'
      : 'Resumo ilustrativo do rollout: 1.280 de 2.000 dispositivos, 96% Hermes HBC, 99,8% crash-free, 94% cache hit e 38 ms de latência');
    const light = document.documentElement.dataset.theme === 'light';
    const colors = [
      ['protein', [229,72,72], [255,0,0]], ['carbs', [67,166,83], [0,255,0]],
      ['fat', [201,154,22], [255,196,0]], ['calories', [231,118,25], [255,122,0]],
      ['text', [37,38,36], [242,243,239]], ['muted', [133,135,129], [146,149,143]],
    ];
    colors.forEach(([name, lightColor, darkColor]) => {
      const start = light ? lightColor : darkColor;
      sun.style.setProperty(`--sun-${name}`, `rgb(${start.map((value, i) => Math.round(mix(value, darkColor[i], screenProgress))).join(',')})`);
    });
    sunMetrics.style.height = `${mix(58, 0, progress)}px`;
    sunMetrics.style.marginTop = `${mix(24, 0, progress)}px`;
    sunMetrics.style.overflow = 'hidden'; sunMetrics.style.opacity = String(text);
    sunMetrics.inert = progress > .2;
    sunMetrics.setAttribute('aria-hidden', String(progress > .5));
    sun.style.setProperty('--sun-track', trackColor(1, progress));
  }
  function paintStaticOverview() {
    const mobile = layoutViewport.width <= 760;
    if (mobile) {
      const width = Math.min(460, canvas.clientWidth || Math.max(1, layoutViewport.width - 40));
      const size = Math.min(300, width);
      layoutOverview(width, size, 0, size);
      // Natural content heights keep every metric readable on narrow phones.
      sunHeading.style.height = sunHeading.style.overflow = '';
      sunMetrics.style.height = sunMetrics.style.overflow = '';
    } else {
      const widget = widgetGeometry();
      layoutOverview(widget.width, widget.size, 1);
    }
    sun.dispatchEvent(new CustomEvent('pumpy:sun-progress', {
      detail: {animated: false, screenProgress: mobile ? 0 : 1},
    }));
  }
  const cardEntrance = (beat, index) => ease(range(beat, index + .08, index + (index === 0 ? .9 : .48)));
  function paintWidgets(beat) {
    if (widgetPaint === beat) return;
    widgetPaint = beat;
    widgetShells.forEach((shell) => {
      const i = Number(shell.dataset.bentoBeat);
      const enter = cardEntrance(beat, i);
      reveal(shell, enter);
      place(shell, 0, i === 0 ? 0 : 18 * (1 - enter));
    });
    // Dozens of tiny simultaneous animations are invisible at phone size but costly.
    const phone = layoutViewport.width <= 760;
    if (!phone) monthDays.forEach((day, i) => {
      const enter = ease(range(beat, 1.18 + i * .02, 1.35 + i * .02));
      day.style.opacity = String(enter);
      day.style.transform = `scale(${mix(.85, 1, enter)})`;
    });
    const line = ease(range(beat, 2.18, 2.92));
    weightLine.ownerSVGElement.style.setProperty('--weight-progress', String(line));
    weightLine.style.strokeDasharray = '1 1'; weightLine.style.strokeDashoffset = String(1 - line);
    trainingBars.forEach((bar, i) => {
      bar.style.transform = `scaleY(${ease(range(beat, 2.15 + i * .17, 2.45 + i * .17))})`;
    });
    notifications.forEach((notification, i) => {
      const enter = ease(range(beat, 1.32 + i * .38, 1.62 + i * .38));
      reveal(notification, enter);
      notification.style.transform = `translateY(${-26 * (1 - enter)}px) scale(${mix(.94, 1, enter)})`;
    });
    if (!phone) integrationIcons.forEach((icon, i) => {
      const enter = ease(range(beat, 3.15 + i * .09, 3.48 + i * .09));
      reveal(icon, enter);
      place(icon, 0, 10 * (1 - enter));
    });
  }
  const center = (rect) => ({x: rect.left + rect.width / 2, y: rect.top + rect.height / 2});
  const between = (a, b, t) => ({x: mix(a.x, b.x, t), y: mix(a.y, b.y, t)});
  function cubic(a, b, c, d, t) {
    const v = 1 - t;
    return {x: v*v*v*a.x + 3*v*v*t*b.x + 3*v*t*t*c.x + t*t*t*d.x,
      y: v*v*v*a.y + 3*v*v*t*b.y + 3*v*t*t*c.y + t*t*t*d.y};
  }
  function dashboardPosition(beat) {
    const x = (layoutViewport.width - dashboard.offsetWidth) / 2;
    if (layoutViewport.width > 760) return {x, y: Math.max(80, (stage.offsetHeight - dashboard.offsetHeight - 20) / 2)};
    // Browser chrome changes only the framing, never the scene's stops or pose.
    const availableHeight = Math.min(stage.offsetHeight, innerHeight - metrics.headerHeight);
    const top = Math.max(64, Math.min(90, availableHeight - widgets[0].parentElement.offsetHeight - 70));
    const maxPan = Math.max(0, dashboard.offsetHeight + top - availableHeight + 70);
    const revealBottom = shell => Math.min(maxPan, Math.max(0, shell.offsetTop + shell.offsetHeight + top - availableHeight + 70));
    const stops = [0, 0, revealBottom(phone.parentElement), revealBottom(widgets[2].parentElement), maxPan];
    const i = Math.min(3, Math.floor(beat));
    const pan = mix(stops[i], stops[i + 1], ease(clamp(beat - i)));
    return {x, y: top - pan};
  }
  function widgetMotion(beat, start) {
    const cardRect = widget => {
      const r = viewRect(widget);
      const group = Number(widget.parentElement.dataset.bentoBeat);
      const slide = group === 0 ? 0 : 18 * (1 - cardEntrance(beat, group));
      return {left: r.left, top: r.top - slide, width: r.width, height: r.height, right: r.right};
    };
    const cal = cardRect(widgets[0]), app = cardRect(phone), weight = cardRect(widgets[2]), apps = cardRect(integrations);
    const floor = metrics.headerHeight + 46;
    const mobile = layoutViewport.width <= 760;
    const stops = [
      {x: cal.right - (mobile ? 30 : 25), y: Math.max(floor, cal.top + 25)},
      {x: mobile ? app.left + 34 : app.left + app.width / 2, y: Math.max(floor, mobile ? app.top + 38 : app.top - 60)},
      {x: weight.right - 28, y: Math.max(floor, weight.top + 26)},
      {x: apps.right - 34, y: Math.max(floor, apps.top + 26)},
    ];
    const index = Math.min(3, Math.max(0, Math.ceil(beat) - 1));
    const t = ease(clamp(beat - index));
    const from = index === 0 ? start : stops[index - 1], to = stops[index];
    let point;
    if ((index === 1 || index === 2) && !mobile) {
      // Travel over the phone, keeping the physical screen unobstructed.
      point = cubic(from, {x: from.x, y: floor}, {x: to.x, y: floor}, to, t);
    } else if (index === 3) {
      const edge = layoutViewport.width - 28;
      point = cubic(from, {x: edge, y: from.y}, {x: edge, y: to.y}, to, t);
    } else {
      point = cubic(from, {x: from.x, y: Math.max(floor, from.y - 24)}, {x: to.x, y: Math.max(floor, to.y - 24)}, to, t);
    }
    return {...point, size: mix(85, 64, ease(range(beat, .5, 1))), tilt: .09 * Math.sign(to.x - from.x) * Math.sin(t * Math.PI)};
  }
  function chartFocus(index, progress) {
    if (index === 0) return center(viewRect(sun));
    if (index === 1) {
      const app = center(viewRect(device));
      return between(app, center(viewRect(notifications[0])), ease(range(progress, .45, 1)));
    }
    if (index === 2) {
      const rect = viewRect(weightLine.ownerSVGElement);
      const point = weightLine.getPointAtLength(weightLine.getTotalLength() * ease(range(progress, .18, .92)));
      return {x: rect.left + point.x * rect.width / 280, y: rect.top + point.y * rect.height / 100};
    }
    const cursor = range(progress, .2, .9) * 3, i = Math.min(2, Math.floor(cursor));
    return between(center(viewRect(integrationIcons[i])), center(viewRect(integrationIcons[i + 1])), ease(cursor - i));
  }
  function widgetGaze(beat, position) {
    const index = Math.min(3, Math.max(0, Math.ceil(beat) - 1)), progress = clamp(beat - index);
    const focus = chartFocus(index, progress);
    const target = index === 0 ? focus : between(chartFocus(index - 1, 1), focus, ease(range(progress, 0, .25)));
    const dx = target.x - position.x, dy = target.y - position.y;
    return {x: .065 * dx / Math.hypot(dx, dy * .8, 35), y: .075 * dy / Math.hypot(dx * .7, dy, 35)};
  }
  // Interpolate the body center, so growing never pulls the feet/head off the route.
  function footerTravelPose(from, destination, progress) {
    const position = cubic(from,
      {x: from.x - Math.min(160, layoutViewport.width * .25), y: from.y + 45},
      {x: destination.x + 80, y: destination.y - 100}, destination, progress);
    // Grow late, so the huge final Pumpy never sweeps across the signup form.
    const size = mix(from.size, destination.size, ease(range(progress, .45, 1)));
    return {x: position.x - size * .5, y: position.y - size * .635, size};
  }
  // Viewport heights of scroll per chapter, and the share of each chapter that
  // holds its finished pose so a scene can be read before the next one starts.
  const CHAPTER = .5, CHAPTER_REST = .14;
  let enabled = false, metrics, paintedPhase = null;
  function phaseAtScroll(y) {
    const stops = metrics.phaseStops, last = stops.length - 1;
    if (y <= stops[0]) return 0;
    if (y >= stops[last]) return last;
    const index = Math.floor((y - stops[0]) / metrics.chapter);
    return index + range((y - stops[index]) / metrics.chapter, CHAPTER_REST, 1 - CHAPTER_REST);
  }
  function measure() {
    layoutViewport = {...readViewport()};
    stage.inert = false;
    overviewLayout = widgetPaint = trackGeometry = paintedPhase = null;
    section.style.height = '';
    const mobileLayout = layoutViewport.width <= 760;
    enabled = motion.storyFits(layoutViewport) && Boolean(traveler.querySelector('svg'));
    section.classList.toggle('is-animated', enabled);
    section.classList.toggle('has-live-sun', enabled || !mobileLayout);
    if (footerMascot) footerMascot.style.visibility = enabled ? 'hidden' : '';
    if (footerMessages) footerMessages.classList.toggle('is-visible', !enabled);
    for (const el of [composer, photo, question, dock, result, analysis, receipt, overview, overviewTrigger, dashboard, dashboardTrigger, sun, sunHeading, sunCenter, sunMetrics, footerCaption, grayTrack, note, send, replay, scan, ...pins]) {
      el.removeAttribute('style'); el.inert = false;
    }
    for (const el of [photo, result, analysis, receipt, overview, overviewTrigger, dashboard, dashboardTrigger, sunMetrics, question, note, replay]) el.removeAttribute('aria-hidden');
    for (const item of metricItems) {
      for (const property of ['position', 'min-height', 'width', 'left', 'top', 'gap']) item.style.removeProperty(property);
    }
    for (const el of [...monthDays, ...integrationIcons]) { el.removeAttribute('style'); el.inert = false; el.removeAttribute('aria-hidden'); }
    total.textContent = '1.280';
    if (grayTrack.parentElement !== canvas) canvas.insertBefore(grayTrack, note);
    if ((enabled || mobileLayout) && overview.parentElement !== canvas) canvas.insertBefore(overview, note);
    if (!enabled && !mobileLayout && overview.parentElement !== sunSlot) sunSlot.append(overview);
    widgets[0].removeAttribute('aria-hidden');
    if (!enabled) {
      canvas.inert = false;
      canvas.removeAttribute('aria-hidden');
      paintStaticOverview();
      paintWidgets(4);
      return;
    }
    const headerHeight = document.querySelector('.header').getBoundingClientRect().height;
    section.style.setProperty('--nutrition-header', `${headerHeight}px`);
    const rect = section.getBoundingClientRect();
    const receiptRect = receipt.getBoundingClientRect();
    const thumbRect = $('.nutrition-thumb-space').getBoundingClientRect();
    const start = rect.top + scrollY - headerHeight;
    const chapter = layoutViewport.height * CHAPTER;
    const phaseStops = Array.from({length: 8}, (_, index) => start + chapter * index);
    // Pumpy leaves the finished bento as the stage starts to slide away.
    const bentoGate = phaseStops[7] + chapter * .4;
    metrics = {
      start, headerHeight, chapter, phaseStops, bentoGate,
      sectionHeight: stage.offsetHeight + bentoGate - start, stageHeight: stage.offsetHeight,
      width: canvas.clientWidth, height: canvas.clientHeight, receiptHeight: receipt.offsetHeight, overviewHeight: overview.offsetHeight, sunSize: sun.offsetWidth,
      thumbX: thumbRect.left - receiptRect.left, thumbY: thumbRect.top - receiptRect.top,
    };
    section.style.height = `${metrics.sectionHeight}px`;
    const footerRect = footer?.getBoundingClientRect();
    // Pumpy lands at the beginning of a tall footer, or at the reachable document
    // end when the footer is shorter than the viewport.
    metrics.footerEntry = footerRect
      ? Math.max(metrics.bentoGate + 1, Math.min(
        footerRect.top + window.scrollY - headerHeight,
        footerRect.bottom + window.scrollY - layoutViewport.height))
      : metrics.start + metrics.sectionHeight;
    render();
  }
  let footerPoseSettled = false;
  function paintFooterFlight(scroll, stageTop) {
    if (!footer || !footerMascot) return;
    const footerProgress = range(scroll, metrics.bentoGate, metrics.footerEntry);
    // Start the timed conversation as the mascot approaches its final corner.
    // Hysteresis avoids restarting the messages on small scroll adjustments.
    if (footerProgress >= .65) footerMessages?.classList.add('is-visible');
    else if (footerProgress < .5) footerMessages?.classList.remove('is-visible');
    if (footerProgress <= 0) { footerPoseSettled = false; return; }
    const destination = footerMascot.getBoundingClientRect();
    // Leave from where the last card rests while pinned, whatever the stage's
    // current slide. After landing, ride along with the footer as it scrolls.
    const departure = widgetMotion(4, {x: 0, y: 0});
    const from = {x: departure.x, y: departure.y - (stageTop - metrics.headerHeight), size: departure.size};
    const to = {x: destination.left + destination.width * .5,
      y: destination.top + window.scrollY - Math.max(scroll, metrics.footerEntry) + destination.width * .635,
      size: destination.width};
    const pose = footerTravelPose(from, to, footerProgress);
    traveler.classList.add('is-active'); traveler.style.opacity = '1'; traveler.style.visibility = 'visible';
    // One layout size, scaled by the GPU: the huge body is drawn once, not per frame.
    traveler.style.width = traveler.style.height = `${to.size}px`;
    traveler.style.transform = `translate(${pose.x}px, ${pose.y}px) scale(${pose.size / to.size})`;
    const settle = ease(range(footerProgress, 0, .45));
    if (settle < 1 || !footerPoseSettled) {
      const gaze = widgetGaze(4, from);
      traveler.dispatchEvent(new CustomEvent('pumpy:scroll-pose', {detail: {
        gazeX: mix(gaze.x, .025, settle), gazeY: mix(gaze.y, -.12, settle),
        pitch: .16 * settle, rotation: -.07 * Math.sin(settle * Math.PI),
        eyeScaleX: mix(1.08, 1, settle), leftEyeScaleY: mix(1.04, 1, settle), rightEyeScaleY: mix(1.04, 1, settle),
      }}));
    }
    footerPoseSettled = settle === 1;
  }
  function render() {
    if (!enabled) return;
    const scroll = visualScroll();
    const stageRect = viewRect(stage);
    stage.inert = stageRect.top >= layoutViewport.height || stageRect.bottom <= metrics.headerHeight;
    // Before the section, the first scene only needs painting once.
    if (paintedPhase === 0 && scroll < metrics.start - 1) return;
    const phase = phaseAtScroll(scroll);
    // Once the finished bento slides away only Pumpy still moves.
    if (paintedPhase === phase && scroll > metrics.bentoGate) { paintFooterFlight(scroll, stageRect.top); return; }
    const sectionTop = metrics.start + metrics.headerHeight;
    const reading = clamp(phase), saved = ease(clamp(phase - 1));
    const overviewProgress = clamp(phase - 2);
    const widgetBeat = Math.max(0, Math.min(4, phase - 3));
    const widgetsProgress = clamp(widgetBeat), compact = ease(range(widgetBeat, 0, .9));
    const diaryVisibility = 1 - ease(range(overviewProgress, 0, .3));
    const {width: w, height: h, receiptHeight, overviewHeight, thumbX, thumbY} = metrics;
    const baseOverviewWidth = Math.min(460, w);
    const baseOverviewX = (w - baseOverviewWidth) / 2;
    const baseOverviewY = Math.max(28, (h - overviewHeight) / 2 - 8);
    const dashboardPositionNow = dashboardPosition(widgetBeat);
    place(dashboard, dashboardPositionNow.x, dashboardPositionNow.y);
    dashboard.style.visibility = widgetsProgress > 0 ? 'visible' : 'hidden';
    dashboard.inert = widgetsProgress < .98;
    dashboard.setAttribute('aria-hidden', String(widgetsProgress < .5));
    paintWidgets(widgetBeat);
    const canvasRect = viewRect(canvas);
    if (compact < 1 && overview.parentElement !== canvas) canvas.insertBefore(overview, note);
    if (compact < 1 && grayTrack.parentElement !== canvas) canvas.insertBefore(grayTrack, overview);
    const dashboardRect = viewRect(dashboard), widget = widgetGeometry();
    const overviewWidth = mix(baseOverviewWidth, widget.width, compact);
    const overviewX = mix(baseOverviewX, widget.rect.left + widget.padding - canvasRect.left, compact);
    const overviewY = mix(baseOverviewY, widget.rect.top + (widget.rect.height - widget.size) / 2 - canvasRect.top, compact) - Math.sin(compact * Math.PI) * 18;
    layoutOverview(overviewWidth, mix(metrics.sunSize, widget.size, compact), compact, widget.size);
    if (compact === 1) {
      // Move the original node into the screen, at the same coordinates. On reverse
      // it returns to the free canvas before the first frame of the outward flight.
      if (overview.parentElement !== sunSlot) sunSlot.append(overview);
      if (grayTrack.parentElement !== sun) sun.insertBefore(grayTrack, sun.firstElementChild);
      place(overview, 0, 0);
    } else place(overview, overviewX, overviewY);
    reveal(overview, ease(range(overviewProgress, .76, .98)));
    sun.dispatchEvent(new CustomEvent('pumpy:sun-progress', {detail: {progress: range(overviewProgress, .76, 1), screenProgress: ease(range(compact, .35, 1)), animated: true}}));
    reveal(photo, diaryVisibility);
    const photoSize = Math.min(380, w * .88, h - 230);
    const initialY = Math.max(95, (h - photoSize - 105) / 2);
    const initialX = (w - photoSize) / 2;
    const photoLift = ease(reading) * 14;
    // The attachment and prompt share one composer until send; the original
    // photo then leaves its fading surface to continue the diary transition.
    composer.style.setProperty('--composer-width', `${photoSize + 32}px`);
    composer.style.setProperty('--composer-height', `${photoSize + mix(88, 32, ease(reading))}px`);
    composer.style.setProperty('--composer-x', `${initialX - 16}px`);
    composer.style.setProperty('--composer-y', `${initialY - photoLift - 16}px`);
    composer.style.setProperty('--composer-opacity', String(1 - ease(range(reading, 0, .55))));
    const receiptWidth = Math.min(480, w), receiptX = (w - receiptWidth) / 2;
    const receiptY = Math.max(100, (h - receiptHeight) / 2);
    const currentSize = mix(photoSize, 80, saved);
    const photoX = mix(initialX, receiptX + thumbX, saved);
    const photoY = mix(initialY - photoLift, receiptY + thumbY, saved);
    // Scaled and masked as one layer, so the photo is not resampled every frame.
    const photoScale = currentSize / photoSize;
    photo.style.width = photo.style.height = `${photoSize}px`;
    photo.style.clipPath = `inset(0 round ${mix(mix(20, 28, ease(reading)), 16, saved) / photoScale}px)`;
    photo.style.transform = `translate(${photoX}px, ${photoY}px) scale(${photoScale})`;
    const dockX = w / 2 - photoSize * .30 - 42.5;
    const dockY = initialY - 55 - 85 * .635;
    place(dock, dockX, dockY);
    question.style.width = `${photoSize}px`;
    place(question, initialX, initialY + photoSize + 20);
    reveal(question, 1 - ease(range(reading, 0, .25)));
    reveal(result, ease(range(reading, .45, .92)) * (1 - ease(range(saved, 0, .32))));
    analysis.style.width = `${photoSize}px`;
    place(analysis, initialX, initialY + photoSize + 13 - photoLift);
    reveal(analysis, ease(range(reading, .65, 1)) * (1 - ease(range(saved, 0, .22))));
    receipt.style.width = `${receiptWidth}px`; place(receipt, receiptX, receiptY);
    reveal(receipt, ease(range(saved, .28, .68)) * diaryVisibility);
    const noteWidth = mix(mix(receiptWidth, baseOverviewWidth, ease(overviewProgress)), w, compact);
    note.style.width = `${noteWidth}px`;
    const overviewNoteY = mix(baseOverviewY + overviewHeight + 24, Math.min(dashboardRect.bottom - canvasRect.top + 12, h - 4), compact);
    place(note, (w - noteWidth) / 2, mix(mix(initialY + photoSize + 142 - photoLift, receiptY + receiptHeight + 30, saved), overviewNoteY, ease(overviewProgress)));
    reveal(note, ease(range(reading, .85, 1)));
    const showOverview = ease(range(saved, .85, 1)) * (1 - ease(range(overviewProgress, 0, .3)));
    reveal(overviewTrigger, showOverview);
    overviewTrigger.style.display = showOverview > 0 ? 'inline-block' : 'none';
    const showDashboard = ease(range(overviewProgress, .85, 1)) * (1 - ease(range(widgetBeat, 3.8, 4)));
    setText(dashboardLabel, widgetBeat >= 1 ? 'Continuar' : 'Ver telemetria');
    reveal(dashboardTrigger, showDashboard);
    dashboardTrigger.style.display = showDashboard > 0 ? 'inline-block' : 'none';
    footerCaption.style.opacity = String(1 - ease(range(widgetsProgress, .1, .6)));
    footerCaption.style.display = widgetsProgress === 1 ? 'none' : '';
    const showReplay = ease(range(widgetBeat, 3.85, 4));
    reveal(replay, showReplay);
    replay.style.display = showReplay > 0 ? 'inline-block' : 'none';
    const scanning = range(reading, 0, .65);
    scan.style.opacity = String(Math.sin(scanning * Math.PI) * (1 - saved));
    place(scan, 0, mix(12, photoSize - 18, scanning));
    pins.forEach((pin, i) => {
      pin.style.opacity = String(ease(range(reading, .10 + i * .10, .27 + i * .10)) * (1 - ease(range(reading, .72, 1))) * (1 - saved));
    });
    const accumulated = ease(range(saved, .55, 1));
    setText(total, Math.round(mix(760, 1280, accumulated)).toLocaleString('pt-BR'));
    const barRect = viewRect(track);
    const sunRect = viewRect(sun);
    const curl = ease(range(overviewProgress, .16, .76));
    const move = ease(range(overviewProgress, .10, .76));
    const scale = sunRect.width / 240;
    const thickness = mix(5, 3 * scale, move);
    const landed = compact === 1;
    const trackX = landed ? sunRect.width / 2 : mix(barRect.left + barRect.width / 2, sunRect.left + sunRect.width / 2, move) - canvasRect.left;
    const trackY = landed ? sunRect.height / 2 : mix(barRect.top + 2.5, sunRect.top + sunRect.height / 2, move) - canvasRect.top;
    const trackWidth = mix(barRect.width - 5, 232 * scale, move);
    grayTrack.setAttribute('viewBox', `0 0 ${landed ? sunRect.width : w} ${landed ? sunRect.height : h}`);
    grayTrack.style.zIndex = '0';
    grayTrack.style.opacity = String(ease(range(saved, .28, .68)));
    const geometry = [trackX, trackY, trackWidth, curl].join(':');
    if (trackGeometry !== geometry) {
      grayPath.setAttribute('d', curvedTrack(trackX, trackY, trackWidth, 2 * Math.PI * curl));
      trackGeometry = geometry;
    }
    grayPath.setAttribute('stroke-width', String(thickness));
    grayPath.setAttribute('stroke', trackColor(move, compact));
    // story.js owns this physical SVG until it reaches our dock. No second mascot.
    if (scroll >= metrics.start - 1) {
      const visible = sectionTop + metrics.sectionHeight - scroll > metrics.headerHeight;
      traveler.classList.toggle('is-active', visible); traveler.classList.add('is-flying');
      traveler.style.visibility = visible ? 'visible' : 'hidden';
      traveler.style.opacity = '1'; traveler.style.clipPath = '';
      const morph = ease(range(saved, .06, .58)), grow = ease(range(saved, .58, 1));
      const startX = canvasRect.left + dockX + 42.5 + ease(reading) * photoSize * .6;
      const startY = canvasRect.top + dockY + 85 * .635 - Math.sin(reading * Math.PI) * 24;
      const dotX = barRect.left + 2.5, dotY = barRect.top + 2.5;
      const centerX = mix(startX, dotX, morph);
      const centerY = mix(startY, dotY, morph) - Math.sin(morph * Math.PI) * 45;
      if (overviewProgress > 0) {
        // Pull the white fill into its own right tip, then unfold that same body
        // into Pumpy while it lifts away from the bending gray track.
        const squeeze = ease(range(overviewProgress, 0, .22));
        const flight = ease(range(overviewProgress, .14, .84));
        const unfold = ease(range(overviewProgress, .22, .50));
        const fillWidth = barRect.width * .64;
        const originX = mix(barRect.left + fillWidth / 2, barRect.left + fillWidth - 4.2, squeeze);
        const originalX = Math.min(layoutViewport.width - 52, canvasRect.left + baseOverviewX + (baseOverviewWidth + metrics.sunSize) / 2 - 16);
        const originalY = canvasRect.top + baseOverviewY + 25.5 + (layoutViewport.width <= 600 ? 18 : 24) - 24;
        const journey = widgetMotion(widgetBeat, {x: originalX, y: originalY});
        const destinationX = journey.x, destinationY = journey.y;
        const x = mix(originX, destinationX, flight);
        const y = mix(barRect.top + 2.5, destinationY, flight) - Math.sin(flight * Math.PI) * 38;
        if (overviewProgress <= .22) {
          const width = mix(fillWidth, 8.4, squeeze), height = mix(5, 8.4, squeeze);
          traveler.style.width = `${width}px`; traveler.style.height = `${height}px`;
          place(traveler, x - width / 2, y - height / 2);
          traveler.dispatchEvent(new CustomEvent('pumpy:scroll-pose', {detail: {surface: {
            width, height, radius: height / 2, tail: height / 2,
          }}}));
        } else {
          const size = mix(14, journey.size, unfold);
          traveler.style.width = traveler.style.height = `${size}px`;
          place(traveler, x - size * .5, y - size * .635);
          const gaze = widgetGaze(widgetBeat, {x, y}), attention = ease(range(widgetBeat, 0, .2));
          traveler.dispatchEvent(new CustomEvent('pumpy:scroll-pose', {detail: motion.withMomentum({
            dot: 1 - unfold, gazeX: mix(-.055, gaze.x, attention) * unfold, gazeY: mix(.07, gaze.y, attention) * unfold,
            rotation: mix(-.14 * Math.sin(flight * Math.PI), journey.tilt, attention) * unfold,
            eyeScaleX: mix(1, 1.08, attention), leftEyeScaleY: mix(1, 1.04, attention), rightEyeScaleY: mix(1, 1.04, attention),
          })}));
        }
      } else if (morph < 1) {
        const size = mix(85, 14, morph);
        traveler.style.width = traveler.style.height = `${size}px`;
        place(traveler, centerX - size * .5, centerY - size * .635);
        traveler.dispatchEvent(new CustomEvent('pumpy:scroll-pose', {detail: motion.withMomentum({
          dot: morph, gazeX: -.085 * ease(reading) * (1 - morph), gazeY: .08 * (1 - morph),
          rotation: .08 * Math.sin(reading * Math.PI) * (1 - morph),
        })}));
      } else {
        const width = mix(8.4, barRect.width * mix(.38, .64, accumulated), grow);
        const height = mix(8.4, 5, grow);
        traveler.style.width = `${width}px`; traveler.style.height = `${height}px`;
        place(traveler, mix(dotX - 4.2, barRect.left, grow), mix(dotY - 4.2, barRect.top, grow));
        traveler.dispatchEvent(new CustomEvent('pumpy:scroll-pose', {detail: {surface: {
          width, height, radius: height / 2, tail: height / 2,
        }}}));
      }
    }
    footerPoseSettled = false;
    paintFooterFlight(scroll, stageRect.top);
    paintedPhase = phase;
  }
  const schedule = () => { if (enabled) motion.request(); };
  const seekPhase = (index) => scrollTo({top: metrics.phaseStops[index], behavior: 'smooth'});
  send.addEventListener('click', () => { send.blur(); if (enabled) seekPhase(1); });
  save.addEventListener('click', () => {
    save.blur();
    if (enabled) seekPhase(2);
    else receipt.scrollIntoView({block: 'center', behavior: 'auto'});
  });
  replay.addEventListener('click', () => { replay.blur(); seekPhase(0); });
  overviewTrigger.addEventListener('click', () => {
    overviewTrigger.blur();
    if (enabled) seekPhase(3);
    else overview.scrollIntoView({block: 'center', behavior: 'auto'});
  });
  dashboardTrigger.addEventListener('click', () => {
    dashboardTrigger.blur();
    if (enabled) seekPhase(Math.min(7, Math.floor(phaseAtScroll(visualScroll())) + 1));
    else dashboard.scrollIntoView({block: 'center', behavior: 'auto'});
  });
  document.querySelectorAll('a[href="#recursos"]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    if (enabled) seekPhase(7);
    else dashboard.scrollIntoView({block: 'start', behavior: 'auto'});
  }));
  document.querySelectorAll('a[href="#inspecao"]').forEach((link) => link.addEventListener('click', (event) => {
    if (enabled) { event.preventDefault(); seekPhase(0); }
  }));
  motion.subscribe(() => render());
  addEventListener('pumpy:theme-changed', () => {
    overviewLayout = paintedPhase = null;
    if (!enabled) paintStaticOverview();
    else schedule();
  });
  addEventListener('resize', () => {
    const next = readViewport();
    // Mobile browser chrome can change innerHeight without changing the layout.
    // Preserve the current stop, SVG ownership and pose through those events.
    if (next.width === layoutViewport.width && next.height === layoutViewport.height) { schedule(); return; }
    measure();
  });
  // Decode the scenes after the page has loaded, not when they first appear mid-scroll.
  addEventListener('load', () => section.querySelectorAll('img').forEach((image) => {
    image.loading = 'eager';
    image.decode?.().catch(() => {});
  }), {once: true});
  addEventListener('pageshow', measure);
  reduced.addEventListener('change', measure);
  measure();
})();
