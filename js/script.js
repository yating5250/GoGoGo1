// 卡片滑動
(() => {
  document.querySelectorAll('.cards-shell').forEach(shell => {
    const viewport = shell.querySelector('.cards-viewport');
    const track = shell.querySelector('.cards');
    const btnPrev = shell.querySelector('.left');
    const btnNext = shell.querySelector('.right');
    if (!viewport || !track) return;

    const stepBy = 1;     // 每次移動幾張
    const withLoop = true;  // 無限循環

    // 原始真卡（只抓一次）
    const baseCards = Array.from(track.children).filter(el => el.classList.contains('card'));
    const baseCount = baseCards.length;
    if (!baseCount) return;

    // 狀態
    let cardW = 0, gap = 0, visibleCount = 1, cloneCount = 0, index = 0;
    let dragging = false, startX = 0, lastX = 0;

    const getGap = () => {
      const cs = getComputedStyle(track);
      const g = parseFloat(cs.columnGap || cs.gap || '0');
      return isNaN(g) ? 0 : g;
    };

    const removeClones = () => track.querySelectorAll('.card.__clone').forEach(n => n.remove());
    const cardsInTrack = () => Array.from(track.children).filter(el => el.classList.contains('card'));

    const applyTransform = () => {
      const x = -index * (cardW + gap);
      track.style.transform = `translate3d(${x}px,0,0)`;
    };

    const buildClones = () => {
      removeClones();
      cloneCount = Math.min(baseCount, Math.max(1, visibleCount + 1));

      // 頭部：取最後 cloneCount 張放最前
      const head = document.createDocumentFragment();
      for (let i = baseCount - cloneCount; i < baseCount; i++) {
        const c = baseCards[i].cloneNode(true);
        c.classList.add('__clone'); c.setAttribute('aria-hidden', 'true');
        head.appendChild(c);
      }
      track.insertBefore(head, track.firstChild);

      // 尾部：取最前 cloneCount 張放最後
      const tail = document.createDocumentFragment();
      for (let i = 0; i < cloneCount; i++) {
        const c = baseCards[i].cloneNode(true);
        c.classList.add('__clone'); c.setAttribute('aria-hidden', 'true');
        tail.appendChild(c);
      }
      track.appendChild(tail);

      // 起始定位到第一張真卡
      index = cloneCount;
      track.style.transition = 'none';
      applyTransform();
      track.getBoundingClientRect(); // 強制回流
      track.style.transition = '';
    };

    function measure() {
      const cs = getComputedStyle(track);
      gap = getGap();
      cardW = track.querySelector('.card').getBoundingClientRect().width;

      const cssCols = parseInt(cs.getPropertyValue('--cols')) || 0;
      if (cssCols > 0) {
        visibleCount = cssCols;
      } else {
        // 後備算法
        const viewportW = viewport.clientWidth;
        visibleCount = Math.max(1, Math.floor((viewportW + gap) / (cardW + gap)));
      }
      buildClones();
    }

    function normalizeIfNeeded() {
      const total = cardsInTrack().length;
      const realStart = cloneCount;
      const realEnd = cloneCount + baseCount - 1;
      let jumped = false;

      if (index > realEnd) { index -= baseCount; jumped = true; }
      else if (index < realStart) { index += baseCount; jumped = true; }

      if (jumped) {
        track.style.transition = 'none';
        applyTransform();
        track.getBoundingClientRect();
        track.style.transition = '';
      }
    }

    function moveBy(dir) {
      index += dir * stepBy;
      track.style.transition = 'transform 300ms ease';
      applyTransform();
    }

    track.addEventListener('transitionend', () => { if (withLoop) normalizeIfNeeded(); });

    btnPrev?.addEventListener('click', () => moveBy(-1));
    btnNext?.addEventListener('click', () => moveBy(1));

    // // 滾輪
    // viewport.addEventListener('wheel', (e) => {
    //   if (Math.abs(e.deltaX) + Math.abs(e.deltaY) < 1) return;
    //   e.preventDefault();
    //   moveBy((e.deltaX || e.deltaY) > 0 ? 1 : -1);
    // }, { passive: false });

    // 拖曳
    viewport.addEventListener('pointerdown', e => {
      dragging = true; startX = lastX = e.clientX;
      track.style.transition = 'none';
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      track.style.transform = `translate3d(${-index * (cardW + gap) + dx}px,0,0)`;
      lastX = e.clientX;
    });
    viewport.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      const dx = lastX - startX;
      const threshold = (cardW + gap) * 0.2;
      if (Math.abs(dx) > threshold) moveBy(dx < 0 ? 1 : -1);
      else { track.style.transition = 'transform 200ms ease'; applyTransform(); }
    });

    // RWD：重算
    const ro = new ResizeObserver(() => measure());
    ro.observe(viewport);

    // init
    measure();
  });
})();

// 多選
(() => {
  document.querySelectorAll('.choicebox .choices').forEach(list => {
    // 點擊切換
    list.addEventListener('click', (e) => {
      const choice = e.target.closest('.choice');
      if (!choice || !list.contains(choice)) return;

      const isActive = choice.classList.toggle('is-active');
      choice.setAttribute('aria-pressed', isActive ? 'true' : 'false');

      // 這裡如果要即時回傳/篩選，可讀取目前被選取的文字：
      // const selected = [...list.querySelectorAll('.choice.is-active h4')].map(n => n.textContent.trim());
      // console.log(selected);
    });

    // 鍵盤 Space/Enter 切換
    list.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      const choice = e.target.closest('.choice');
      if (!choice || !list.contains(choice)) return;
      e.preventDefault();
      const isActive = choice.classList.toggle('is-active');
      choice.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  });
})();


// HAHSH
(() => {
  const { Engine, World, Bodies, Body, Composite, Mouse, MouseConstraint, Events } = Matter;

  // ===== 可調參數 =====
  const TRIGGER_SEL = '.s-b-hahs'; // 進到這區就播放一次
  const ZONE_SEL = '#fallzone'; // 掉落容器（要 overflow:hidden）
  const LIST_SEL = '#chips';    // 內含 <li> 籌碼

  const RESTITUTION = 0.25;
  const FRICTION = 0.25;
  const DENSITY = 0.0015;
  const SLEEPING = true;
  const TOP_DROP_Y = 10;
  const WALL_THICK = 200;
  const GROUND_H = 200;
  const MARGIN = 8;   // 生成時左右內縮，避免一出生就卡牆

  const IO_THRESHOLD = 0.5; // 👈 進視窗比例（>=50%）
  let isPlaying = false;

  let started = false;
  let destroyed = false;

  function init() {
    if (started) return;
    started = true;

    const zone = document.querySelector(ZONE_SEL);
    const list = document.querySelector(LIST_SEL);
    if (!zone || !list) return;

    zone.style.touchAction = 'pan-y';

    // ---- 以 padding 盒為座標系（(0,0) 就是內容區左上角）----
    const W = zone.clientWidth;   // 已含 padding
    const H = zone.clientHeight;

    // ---- 建立引擎/世界 ----
    const engine = Engine.create({ enableSleeping: SLEEPING });
    const world = engine.world;
    world.gravity.y = 1;

    // ---- 牆體：對齊 0..W / 0..H ----
    const ground = Bodies.rectangle(W / 2, H + GROUND_H / 2, W + WALL_THICK * 2, GROUND_H, { isStatic: true });
    const roof = Bodies.rectangle(W / 2, -WALL_THICK / 2, W + WALL_THICK * 2, WALL_THICK, { isStatic: true });
    const wallLeft = Bodies.rectangle(-WALL_THICK / 2, H / 2, WALL_THICK, H + WALL_THICK * 2, { isStatic: true });
    const wallRight = Bodies.rectangle(W + WALL_THICK / 2, H / 2, WALL_THICK, H + WALL_THICK * 2, { isStatic: true });
    World.add(world, [ground, roof, wallLeft, wallRight]);

    // ---- 每個 <li> 變剛體 ----
    const chips = Array.from(list.children).filter(el => el.tagName === 'LI');
    const bodies = [];

    chips.forEach((el) => {
      // 清前次 transform，交給物理世界接管
      el.style.transform = '';
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.top = '0';
      el.style.willChange = 'transform';

      const w = el.offsetWidth || 160;
      const h = el.offsetHeight || 54;

      const minX = w / 2 + MARGIN;
      const maxX = Math.max(minX, W - w / 2 - MARGIN);
      const x = Math.random() * (maxX - minX) + minX;  // 內容區內生成
      const y = TOP_DROP_Y + Math.random() * 20;

      const body = Bodies.rectangle(x, y, w, h, {
        chamfer: { radius: h / 2 },
        restitution: RESTITUTION,
        friction: FRICTION,
        density: DENSITY
      });

      Body.rotate(body, (Math.random() - 0.5) * 0.2);
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);

      World.add(world, body);
      bodies.push({ body, el });
    });

    // ---- 滑鼠拖拽 ----
    const mouse = Mouse.create(zone);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, render: { visible: false } }
    });
    World.add(world, mouseConstraint);

    // 捕獲階段攔掉 wheel/touchmove 傳進 Matter（保留頁面可捲）
    const stopMatterWheel = (e) => { e.stopImmediatePropagation(); };
    zone.addEventListener('wheel', stopMatterWheel, { capture: true, passive: true });
    zone.addEventListener('mousewheel', stopMatterWheel, { capture: true, passive: true });
    zone.addEventListener('DOMMouseScroll', stopMatterWheel, { capture: true, passive: true });
    zone.addEventListener('touchmove', stopMatterWheel, { capture: true, passive: true });

    // ---- 同步剛體到 DOM ----
    const onAfterUpdate = () => {
      for (const { body, el } of bodies) {
        const { x, y } = body.position;
        el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${body.angle}rad)`;
      }
    };
    Events.on(engine, 'afterUpdate', onAfterUpdate);

    // ---- 手動步進 ----
    let rafId = null;
    const step = () => {
      Engine.update(engine, 1000 / 60);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);

    // ---- RWD：重建 ----
    const onResize = debounce(() => rebuild(zone, list), 200);
    window.addEventListener('resize', onResize);

    // ---- 頁籤可見性：暫停/恢復 ----
    const onVisibility = () => { document.hidden ? pause() : resume(); };
    document.addEventListener('visibilitychange', onVisibility);

    // 保存 context
    zone.__fallchips = {
      engine, world, bodies, mouse, mouseConstraint,
      rafId, onAfterUpdate, onResize, onVisibility,
      listeners: { stopMatterWheel }
    };

    function pause() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
    function resume() { if (!rafId) rafId = requestAnimationFrame(step); }
  }

  function rebuild(zone, list) {
    destroy(zone, list);
    started = false;
    init();
  }

  function destroy(zoneEl, listEl) {
    const zone = zoneEl || document.querySelector(ZONE_SEL);
    const list = listEl || document.querySelector(LIST_SEL);
    const ctx = zone && zone.__fallchips;
    if (!ctx || destroyed) return;

    destroyed = true;

    window.removeEventListener('resize', ctx.onResize);
    document.removeEventListener('visibilitychange', ctx.onVisibility);

    const { stopMatterWheel } = ctx.listeners || {};
    if (stopMatterWheel) {
      zone.removeEventListener('wheel', stopMatterWheel, { capture: true });
      zone.removeEventListener('mousewheel', stopMatterWheel, { capture: true });
      zone.removeEventListener('DOMMouseScroll', stopMatterWheel, { capture: true });
      zone.removeEventListener('touchmove', stopMatterWheel, { capture: true });
    }

    if (ctx.rafId) cancelAnimationFrame(ctx.rafId);
    try { Events.off(ctx.engine, 'afterUpdate', ctx.onAfterUpdate); } catch (_) { }
    try { Composite.clear(ctx.engine.world, false); Engine.clear(ctx.engine); } catch (_) { }

    // 清 DOM transform（避免殘影）
    if (list) Array.from(list.children).forEach(el => { el.style.transform = ''; });

    zone.__fallchips = null;
    destroyed = false;
  }

  function debounce(fn, delay = 200) {
    let t = null;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  // ===== 觸發：每次 .s-b-hahs 進入視窗 >=50% 就播放（若在播就略過） =====
  const triggerEl = document.querySelector(TRIGGER_SEL);
  const zoneEl = document.querySelector(ZONE_SEL);
  const listEl = document.querySelector(LIST_SEL);
  if (!triggerEl || !zoneEl || !listEl) return;

  let inView = false;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.target !== triggerEl) return;
      if (e.isIntersecting && !inView) {
        inView = true;
        if (!isPlaying) {
          isPlaying = true;
          rebuild(zoneEl, listEl);
          // 播放結束時機：簡單起見給一個超時（也可改成監聽速度或靜止）
          setTimeout(() => { isPlaying = false; }, 2000);
        }
      } else if (!e.isIntersecting && inView) {
        inView = false;
        // 離開視口就暫停 raf（省效能）
        const ctx = zoneEl.__fallchips;
        if (ctx && ctx.rafId) { cancelAnimationFrame(ctx.rafId); ctx.rafId = null; }
      }
    });
  }, { threshold: IO_THRESHOLD });
  io.observe(triggerEl);

  // 初次不自動 init；由進視窗時觸發
})();

// 眨眼眼動
(function () {
  const hero = document.querySelector('#banner .hero');
  const svg = hero?.querySelector('.gogo-eyes');
  if (!hero || !svg) return;

  const eyeL = svg.querySelector('#eyeL');
  const eyeR = svg.querySelector('#eyeR');
  const pL = svg.querySelector('#pL');
  const pR = svg.querySelector('#pR');
  const lids = svg.querySelector('.lids');
  const nose = svg.querySelector('#nose');

  // 鼻子基準位置
  let baseTx = 0, baseTy = 0, baseRest = "";
  if (nose) {
    const t = nose.getAttribute('transform') || "";
    const m = t.match(/translate\(\s*([\-0-9.]+)[ ,]([\-0-9.]+)\s*\)/i);
    if (m) { baseTx = parseFloat(m[1]); baseTy = parseFloat(m[2]); }
    baseRest = t.replace(/translate\(\s*([\-0-9.]+)[ ,]([\-0-9.]+)\s*\)/i, "").trim();
  }

  // 參數
  const SPRING_K = 0.1;
  const DAMPING = 0.65;
  const RETURN_EASE = 0.1;
  const NOSE_FOLLOW = 0.55;
  const BLINK_MIN = 1800, BLINK_MAX = 4200;

  // 幾何
  const VB = svg.viewBox.baseVal;
  const L = { cx: +eyeL.getAttribute('cx'), cy: +eyeL.getAttribute('cy'), r: +eyeL.getAttribute('r') };
  const R = { cx: +eyeR.getAttribute('cx'), cy: +eyeR.getAttribute('cy'), r: +eyeR.getAttribute('r') };
  const pupil = { rx: +pL.getAttribute('rx') || 15, ry: +pR.getAttribute('ry') || 20 };
  const RAD_L = Math.max(0, L.r - Math.max(pupil.rx, pupil.ry)) * 2;
  const RAD_R = Math.max(0, R.r - Math.max(pupil.rx, pupil.ry)) * 2;

  // 座標
  let box = svg.getBoundingClientRect();
  new ResizeObserver(() => { box = svg.getBoundingClientRect(); }).observe(svg);

  let px = box.left + box.width / 2;
  let py = box.top + box.height / 2;
  let inside = false;

  let targetL = { dx: 0, dy: 0 }, curL = { dx: 0, dy: 0 }, velL = { dx: 0, dy: 0 };
  let targetR = { dx: 0, dy: 0 }, curR = { dx: 0, dy: 0 }, velR = { dx: 0, dy: 0 };
  let curN = { dx: 0, dy: 0 }, velN = { dx: 0, dy: 0 };

  const toVB = (x, y) => ({
    x: ((x - box.left) / box.width) * VB.width + VB.x,
    y: ((y - box.top) / box.height) * VB.height + VB.y
  });

  const clamp = (dx, dy, limit) => {
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(limit, len) / len;
    return { dx: dx * k, dy: dy * k };
  };

  const spring = (cur, vel, tgt) => {
    const ax = SPRING_K * (tgt.dx - cur.dx);
    const ay = SPRING_K * (tgt.dy - cur.dy);
    vel.dx = vel.dx * DAMPING + ax;
    vel.dy = vel.dy * DAMPING + ay;
    cur.dx += vel.dx;
    cur.dy += vel.dy;
  };

  function updateTargets() {
    const { x, y } = toVB(px, py);
    const l = clamp(x - L.cx, y - L.cy, RAD_L);
    const r = clamp(x - R.cx, y - R.cy, RAD_R);

    if (!inside) {
      targetL.dx += (0 - targetL.dx) * RETURN_EASE;
      targetL.dy += (0 - targetL.dy) * RETURN_EASE;
      targetR.dx += (0 - targetR.dx) * RETURN_EASE;
      targetR.dy += (0 - targetR.dy) * RETURN_EASE;
    } else {
      targetL = l; targetR = r;
    }
  }

  function render() {
    updateTargets();

    // 瞳孔
    spring(curL, velL, targetL);
    spring(curR, velR, targetR);
    pL.setAttribute('transform', `translate(${curL.dx},${curL.dy})`);
    pR.setAttribute('transform', `translate(${curR.dx},${curR.dy})`);

    // 鼻子
    const noseTarget = {
      dx: (curL.dx + curR.dx) * 0.5 * NOSE_FOLLOW,
      dy: (curL.dy + curR.dy) * 0.5 * NOSE_FOLLOW
    };
    spring(curN, velN, noseTarget);
    if (nose) {
      const t = `translate(${(baseTx + curN.dx).toFixed(2)},${(baseTy + curN.dy).toFixed(2)})${baseRest ? ' ' + baseRest : ''}`;
      nose.setAttribute('transform', t);
    }

    requestAnimationFrame(render);
  }

  // 滑鼠 + 觸控事件
  const move = (x, y) => { px = x; py = y; };
  hero.addEventListener('mousemove', e => { inside = true; move(e.clientX, e.clientY); });
  hero.addEventListener('mouseenter', () => { inside = true; });
  hero.addEventListener('mouseleave', () => { inside = false; });
  hero.addEventListener('touchstart', e => { if (e.touches[0]) { inside = true; move(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: true });
  hero.addEventListener('touchmove', e => { if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  hero.addEventListener('touchend', () => { inside = false; });



  requestAnimationFrame(render);
})();


// 爪印
(() => {
  const cursor = document.getElementById("custom-cursor");
  if (!cursor) return;

  // 三張爪印 PNG
  const PAWS = ["images/paw-1.png", "images/paw-2.png", "images/paw-3.png"];

  // 參數
  const PRINT_SIZE = 32;     // 爪印尺寸
  const ROTATE_RANGE = 18;     // 隨機旋轉 ±度數
  const RANDOM_MODE = true;   // true=隨機，false=循環
  const MAX_PAWS = 10;     // 同時最多存在數量（0 = 不限制）
  const PRINT_ALPHA = 0.8;    // 爪印透明度 0~1
  const BLOCK_SEL = "[data-no-paw]"; // 加在不想掉印的區塊上

  let idx = 0;
  const paws = [];

  // 判斷點擊目標是否在禁用區塊內
  const isBlocked = (el) => !!el && el.closest(BLOCK_SEL);

  // 游標跟著移動（純視覺）
  document.addEventListener("mousemove", (e) => {
    cursor.style.left = e.clientX + "px";
    cursor.style.top = e.clientY + "px";
  });

  // 掉一枚爪印（用 page 座標，定位在整個文件頁面）
  function dropPawAtPage(xPage, yPage) {
    const src = RANDOM_MODE
      ? PAWS[Math.floor(Math.random() * PAWS.length)]
      : PAWS[(idx++ % PAWS.length)];

    const img = document.createElement("img");
    img.className = "paw";
    img.src = src;
    img.alt = "";
    img.width = img.height = PRINT_SIZE;

    // 位置：整個頁面（非視窗）
    img.style.position = "absolute";
    img.style.left = xPage + "px";
    img.style.top = yPage + "px";
    img.style.opacity = String(PRINT_ALPHA);
    img.style.pointerEvents = "none";
    img.style.zIndex = "9999";

    // 隨機旋轉
    const rot = (Math.random() * 2 - 1) * ROTATE_RANGE;
    img.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;

    document.body.appendChild(img);
    paws.push(img);

    // 數量限制：超過就移除最舊的
    if (MAX_PAWS > 0 && paws.length > MAX_PAWS) {
      const oldest = paws.shift();
      oldest.remove();
    }
  }

  // 滑鼠點一下：若在禁用區塊就略過
  document.addEventListener("mousedown", (e) => {
    if (isBlocked(e.target)) return;
    cursor.classList.add("active");
    dropPawAtPage(e.pageX, e.pageY);
  });
  document.addEventListener("mouseup", () => {
    cursor.classList.remove("active");
  });

  // 觸控：用 elementFromPoint 檢查當下點位是否在禁用區塊
  document.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    if (!t) return;
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (isBlocked(el)) return;
    dropPawAtPage(t.pageX, t.pageY);
  }, { passive: true });
})();

// 標題字
(function ($) {
  // ===== 節奏/參數（可調） =====
  const UP_MS = 110;
  const DOWN_MS = 180;
  const GAP_MS = 70;
  const ARC_H = 44;
  const GAP_X = 6;
  const GAP_Y = 10;

  // 觸發設定
  const TITLE_SELECTOR = '#petmap-title'; // 你的 h1
  const HERO_SELECTOR = '.hero';         // 觸發區塊
  const IO_THRESHOLD = 0.5;             // 進可視比例
  const IO_ROOTMARGIN = '0px 0px -10% 0px';

  let isPlaying = false;

  function getBeforeMetrics(h1) {
    const cs = getComputedStyle(h1, '::before');
    return {
      ballW: parseFloat(cs.getPropertyValue('width')) || 0,
      baseLeft: parseFloat(cs.getPropertyValue('left')) || 0,
      baseTop: parseFloat(cs.getPropertyValue('top')) || 0,
    };
  }

  function tokenizeToSpans($title) {
    const text = $title.text();
    const chars = Array.from(text);
    $title.empty();
    const frag = $(document.createDocumentFragment());
    chars.forEach(ch => {
      if (/\s/.test(ch)) frag.append('<span class="sp">&nbsp;</span>');
      else frag.append($('<span class="ch"></span>').text(ch));
    });
    $title.append(frag);
  }

  function moveBallTo(h1, x, y, dur, ease) {
    h1.style.setProperty('--ball-dur', (dur | 0) + 'ms');
    h1.style.setProperty('--ball-ease', ease);
    h1.style.setProperty('--ball-x', x + 'px');
    h1.style.setProperty('--ball-y', y + 'px');
  }

  function targetForChar(h1, $char, metrics) {
    const pos = $char.position();
    const w = $char.outerWidth();
    const leftCenter = pos.left + (w - metrics.ballW) / 2 + GAP_X;
    const topBase = pos.top - GAP_Y;
    return { tx: leftCenter - metrics.baseLeft, ty: topBase - metrics.baseTop };
  }

  function hopBetween(h1, ta, tb, onLanded) {
    const midX = (ta.tx + tb.tx) / 2;
    const midY = Math.min(ta.ty, tb.ty) - ARC_H;
    moveBallTo(h1, midX, midY, UP_MS, 'cubic-bezier(.25,.1,.25,1)');
    setTimeout(() => {
      moveBallTo(h1, tb.tx, tb.ty, DOWN_MS, 'cubic-bezier(.25,.1,.25,1)');
      setTimeout(onLanded, DOWN_MS);
    }, UP_MS);
  }

  function bounceInPlace(h1, t, $char, cb) {
    const upH = ARC_H * 0.6;
    const upDur = 100, downDur = 150;
    moveBallTo(h1, t.tx, t.ty - upH, upDur, 'cubic-bezier(.25,.1,.25,1)');
    setTimeout(() => {
      moveBallTo(h1, t.tx, t.ty, downDur, 'cubic-bezier(.25,.1,.25,1)');
      setTimeout(() => {
        $char.removeClass('lit');   // 落地時還原最後一字
        setTimeout(cb, GAP_MS);
      }, downDur);
    }, upDur);
  }

  function ensureBallHitArea($title) {
    const h1 = $title[0];
    const metrics = getBeforeMetrics(h1);
    let $hit = $title.find('.ball-hit');
    if (!$hit.length) {
      $hit = $('<button type="button" class="ball-hit" aria-label="replay"></button>')
        .css({
          position: 'absolute',
          background: 'transparent',
          border: '0',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
          zIndex: 2
        })
        .appendTo($title);

      $hit.on('click', function (e) {
        e.preventDefault();
        if (isPlaying) return;
        replay($title);
      });
    }
    $hit.css({
      left: metrics.baseLeft + 'px',
      top: metrics.baseTop + 'px',
      width: metrics.ballW + 'px',
      height: metrics.ballW + 'px'
    });
  }

  function play($title, onDone) {
    isPlaying = true;
    tokenizeToSpans($title);
    ensureBallHitArea($title);

    const h1 = $title[0];
    const $chars = $title.find('.ch');
    if (!$chars.length) { isPlaying = false; onDone && onDone(); return; }

    let metrics = getBeforeMetrics(h1);
    let t0 = targetForChar(h1, $chars.eq(0), metrics);
    moveBallTo(h1, t0.tx, t0.ty, 0, 'linear');
    $chars.eq(0).addClass('lit');

    let i = 1;
    (function forward() {
      if (i < $chars.length) {
        metrics = getBeforeMetrics(h1);
        const ta = targetForChar(h1, $chars.eq(i - 1), metrics);
        const tb = targetForChar(h1, $chars.eq(i), metrics);
        hopBetween(h1, ta, tb, () => {
          $chars.eq(i).addClass('lit');
          setTimeout(() => { i++; forward(); }, GAP_MS);
        });
      } else {
        metrics = getBeforeMetrics(h1);
        const lastIdx = $chars.length - 1;
        const tLast = targetForChar(h1, $chars.eq(lastIdx), metrics);
        bounceInPlace(h1, tLast, $chars.eq(lastIdx), () => { backward(); });
      }
    })();

    function backward() {
      let j = $chars.length - 1;
      (function step() {
        if (j > 0) {
          metrics = getBeforeMetrics(h1);
          const ta = targetForChar(h1, $chars.eq(j), metrics);
          const tb = targetForChar(h1, $chars.eq(j - 1), metrics);
          hopBetween(h1, ta, tb, () => {
            $chars.eq(j - 1).removeClass('lit');
            setTimeout(() => { j--; step(); }, GAP_MS);
          });
        } else {
          $chars.eq(0).removeClass('lit');
          metrics = getBeforeMetrics(h1);
          const tFirst = targetForChar(h1, $chars.eq(0), metrics);
          const midX = (tFirst.tx + 0) / 2;
          const midY = Math.min(tFirst.ty, 0) - ARC_H;

          moveBallTo(h1, midX, midY, UP_MS, 'cubic-bezier(.25,.1,.25,1)');
          setTimeout(() => {
            moveBallTo(h1, 0, 0, DOWN_MS, 'cubic-bezier(.25,.1,.25,1)');
            setTimeout(() => {
              const plain = $title.text();
              $title.text(plain);
              ensureBallHitArea($title);
              isPlaying = false;
              onDone && onDone();
            }, DOWN_MS);
          }, UP_MS);
        }
      })();
    }
  }

  function replay($title) {
    $title.text($title.text());
    ensureBallHitArea($title);
    play($title);
  }

  $(function () {
    const $title = $(TITLE_SELECTOR);
    const $hero = $(HERO_SELECTOR);

    ensureBallHitArea($title);

    // 每次 .hero 進到視窗（>= threshold）就播放（若正在播則略過）
    if ($hero.length) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !isPlaying) {
            play($title);
          }
        });
      }, { root: null, threshold: IO_THRESHOLD, rootMargin: IO_ROOTMARGIN });
      io.observe($hero[0]);
    }

    // RWD：視窗尺寸變更只更新熱區位置
    let raf;
    $(window).on('resize', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => ensureBallHitArea($title));
    });
  });
})(jQuery);


// scroll to top
$(function () {
  const $dog = $('.liedog1');

  // 無障礙：讓 figure 可被鍵盤聚焦並像按鈕一樣使用
  $dog.attr({ role: 'button', tabindex: 0, 'aria-label': '回到最上方' });

  // 點狗 → 回到頂端
  function goTop() {
    $('html, body').stop(true).animate({ scrollTop: 0 }, 500);
  }

  $dog.on('click', function (e) {
    e.preventDefault();
    goTop();
  });

  // 鍵盤 Enter / Space 也可觸發
  $dog.on('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goTop();
    }
  });

  // 避免拖曳圖片造成鬼影
  $dog.find('img').on('dragstart', e => e.preventDefault());
});

// smoove
// 共用
$('.smoove').smoove({
  offset: '15%'
});

// 遠近載入
$('.smo-z').smoove({
  moveZ: '-500px'
});

// 透視
$('.smo-per').smoove({
  rotateX: '90deg',
  moveZ: '-500px'
});

// 捲動到位置
$('nav a[href^="#"]').on('click', function (e) {
  e.preventDefault(); // 阻止瞬間跳轉

  var target = $(this).attr('href'); // 例如 "#eat"

  // 確保 target 不是空的 (#登入不會動)
  if (target.length > 1 && $(target).length) {
    var position = $(target).offset().top; // 目標距離頁面頂端的位置

    $('html, body').animate(
      { scrollTop: position },
      800 // 動畫時間 (毫秒) → 800=0.8秒
    );
  }
});

$('a[href^="#"]').on('click', function (e) {
  e.preventDefault(); // 阻止瞬間跳轉

  var target = $(this).attr('href'); // 例如 "#about"

  // 確保不是空的 (#會員中心就不會觸發)
  if (target.length > 1 && $(target).length) {
    var position = $(target).offset().top; // 目標距離頁面頂端的位置

    $('html, body').animate(
      { scrollTop: position },
      800 // 動畫時間，800 = 0.8秒
    );
  }
});