// 卡片滑動
(() => {
  document.querySelectorAll('.cards-shell').forEach(shell => {
    const viewport = shell.querySelector('.cards-viewport');
    const track    = shell.querySelector('.cards');
    const btnPrev  = shell.querySelector('.left');
    const btnNext  = shell.querySelector('.right');
    if (!viewport || !track) return;

    const stepBy   = 1;     // 每次移動幾張
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
        c.classList.add('__clone'); c.setAttribute('aria-hidden','true');
        head.appendChild(c);
      }
      track.insertBefore(head, track.firstChild);

      // 尾部：取最前 cloneCount 張放最後
      const tail = document.createDocumentFragment();
      for (let i = 0; i < cloneCount; i++) {
        const c = baseCards[i].cloneNode(true);
        c.classList.add('__clone'); c.setAttribute('aria-hidden','true');
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
      const total     = cardsInTrack().length;
      const realStart = cloneCount;
      const realEnd   = cloneCount + baseCount - 1;
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
      track.style.transform = `translate3d(${ -index*(cardW+gap) + dx }px,0,0)`;
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
  const {
    Engine, World, Bodies, Body, Composite,
    Mouse, MouseConstraint, Events
  } = Matter;

  // ------- 參數，可視需要微調 -------
  const ZONE_SEL  = '#fallzone';
  const LIST_SEL  = '#chips';
  const RESTITUTION = 0.25; // 彈性
  const FRICTION    = 0.25;
  const DENSITY     = 0.0015;
  const SLEEPING    = true; // 啟用睡眠提升效能
  const TOP_DROP_Y  = 10;   // 生成時的起始高度 (px，自容器頂)
  const WALL_THICK  = 200;  // 牆厚，給大一點以免穿牆
  const GROUND_H    = 200;  // 地板厚度

  let engine = null;
  let world  = null;
  let rafId  = null;
  let started = false;
  let destroyed = false;

  function init() {
    if (started) return;
    started = true;

    const zone  = document.querySelector(ZONE_SEL);
    const list  = document.querySelector(LIST_SEL);
    if (!zone || !list) return;

    // 讓觸控預設可以垂直捲
    zone.style.touchAction = 'pan-y';

    // 建立引擎
    engine = Engine.create({ enableSleeping: SLEEPING });
    world  = engine.world;
    world.gravity.y = 1; // 重力

    // 尺寸
    const zoneRect = zone.getBoundingClientRect();
    const W = zoneRect.width;
    const H = zoneRect.height;

    // 邊界（厚一點以免滑太快穿牆）
    const ground   = Bodies.rectangle(W/2, H + GROUND_H/2, W + WALL_THICK*2, GROUND_H, { isStatic: true });
    const roof     = Bodies.rectangle(W/2, -WALL_THICK/2,  W + WALL_THICK*2, WALL_THICK, { isStatic: true });
    const wallLeft = Bodies.rectangle(-WALL_THICK/2, H/2,  WALL_THICK, H + WALL_THICK*2, { isStatic: true });
    const wallRight= Bodies.rectangle(W + WALL_THICK/2, H/2, WALL_THICK, H + WALL_THICK*2, { isStatic: true });
    World.add(world, [ground, roof, wallLeft, wallRight]);

    // 讓每一顆 <li> 變成剛體
    const chips = Array.from(list.children).filter(el => el.tagName === 'LI');
    const bodies = [];

    chips.forEach((el, i) => {
      const w = el.offsetWidth  || 160;
      const h = el.offsetHeight || 54;

      // 在容器內部隨機 X，Y 從上方一點點開始掉
      const x = Math.random() * (W - w) + w/2;
      const y = TOP_DROP_Y + Math.random() * 20;

      const body = Bodies.rectangle(x, y, w, h, {
        chamfer: { radius: h/2 },
        restitution: RESTITUTION,
        friction: FRICTION,
        density: DENSITY
      });

      // 給一點點初始角度 & 隨機轉速
      Body.rotate(body, (Math.random()-0.5) * 0.2);
      Body.setAngularVelocity(body, (Math.random()-0.5) * 0.05);

      World.add(world, body);
      bodies.push({ body, el });
    });

    // 滑鼠拖拽（不讓 wheel 影響頁面滾動，等會用捕獲攔掉）
    const mouse = Mouse.create(zone); // 綁在 zone 上
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, render: { visible: false } }
    });
    World.add(world, mouseConstraint);

    // ***關鍵***：在捕獲階段攔掉 wheel/touchmove，只 stop，不 preventDefault
    // 這樣事件不會傳到 Matter 的 wheel handler（它會 preventDefault），頁面就能正常捲動
    const stopMatterWheel = (e) => { e.stopImmediatePropagation(); };
    zone.addEventListener('wheel',           stopMatterWheel, { capture: true, passive: true });
    zone.addEventListener('mousewheel',      stopMatterWheel, { capture: true, passive: true });
    zone.addEventListener('DOMMouseScroll',  stopMatterWheel, { capture: true, passive: true });
    zone.addEventListener('touchmove',       stopMatterWheel, { capture: true, passive: true });

    // 將剛體位置/角度同步到 DOM
    Events.on(engine, 'afterUpdate', () => {
      for (const { body, el } of bodies) {
        const { x, y } = body.position;
        el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${body.angle}rad)`;
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.top  = '0';
        el.style.willChange = 'transform';
      }
    });

    // requestAnimationFrame 手動步進（比 Render.run 更省）
    const step = (t) => {
      Engine.update(engine, 1000 / 60);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);

    // 視窗縮放：重建世界（最穩定）
    const onResize = debounce(() => rebuild(zone, list), 200);
    window.addEventListener('resize', onResize);

    // 視窗/頁籤不可見 → 暫停；回來 → 繼續
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause();
      else resume();
    });

    // 進出視口：出視口就暫停、進視口就繼續
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.target !== zone) return;
        if (e.isIntersecting) resume(); else pause();
      });
    }, { threshold: 0.01 });
    io.observe(zone);

    // 保存到 zone，供重建/清理
    zone.__fallchips = { engine, world, bodies, mouse, mouseConstraint, rafId, io, onResize, listeners: { stopMatterWheel } };

    // 工具
    function pause() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }
    function resume() {
      if (!rafId) rafId = requestAnimationFrame(step);
    }
  }

  function rebuild(zone, list) {
    destroy(zone); // 先清理
    started = false; // 允許重建
    init(); // 重新初始化
  }

  function destroy(zoneEl) {
    const zone = zoneEl || document.querySelector(ZONE_SEL);
    const ctx = zone && zone.__fallchips;
    if (!ctx || destroyed) return;

    destroyed = true;

    // 解除事件
    window.removeEventListener('resize', ctx.onResize);
    ctx.io && ctx.io.disconnect();

    const { stopMatterWheel } = ctx.listeners || {};
    if (stopMatterWheel) {
      zone.removeEventListener('wheel',           stopMatterWheel, { capture: true });
      zone.removeEventListener('mousewheel',      stopMatterWheel, { capture: true });
      zone.removeEventListener('DOMMouseScroll',  stopMatterWheel, { capture: true });
      zone.removeEventListener('touchmove',       stopMatterWheel, { capture: true });
    }

    // 停 raf
    if (ctx.rafId) cancelAnimationFrame(ctx.rafId);

    // 清物理世界
    try {
      Composite.clear(ctx.engine.world, false);
      Engine.clear(ctx.engine);
    } catch (_) {}

    zone.__fallchips = null;
    destroyed = false;
  }

  // 小工具：防抖
  function debounce(fn, delay = 200) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // 只在 fallzone 真的進入視口時才啟動，避免初載負擔
  const zoneEl = document.querySelector(ZONE_SEL);
  if (!zoneEl) return;

  const onceIO = new IntersectionObserver((entries, io) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        init();
        io.disconnect();
      }
    });
  }, { threshold: 0.01 });
  onceIO.observe(zoneEl);
})();
