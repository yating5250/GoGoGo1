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
  let inited = false;

  function startChipsPhysics() {
    if (inited) return;
    inited = true;

    const { Engine, World, Bodies, Body, Events, Runner, Mouse, MouseConstraint } = Matter;

    const container = document.getElementById('chips');
    if (!container) return;

    let W = container.clientWidth;
    let H = container.clientHeight;

    const engine = Engine.create();
    const world  = engine.world;
    const runner = Runner.create();
    Runner.run(runner, engine);

    const wallThickness = 80;
    const floorInset    = 2;

    // === 1) 邊界：地板 + 左右牆 +【天花板】 ===
    const ground   = Bodies.rectangle(W/2, H - floorInset + wallThickness/2, W, wallThickness, { isStatic: true });
    const wallLeft = Bodies.rectangle(-wallThickness/2, H/2, wallThickness, H, { isStatic: true });
    const wallRt   = Bodies.rectangle(W + wallThickness/2, H/2, wallThickness, H, { isStatic: true });
    const roofY    = -1; // 在容器頂緣內側一點點，避免被拖出去
    const roof     = Bodies.rectangle(W/2, roofY - wallThickness/2, W + wallThickness*2, wallThickness, { isStatic: true });
    World.add(world, [ground, wallLeft, wallRt, roof]);  // ← 多了 roof

    // === 2) 生成剛體：改成生在 roof 下方（或稍微在 roof 上方也行）===
    const items = Array.from(container.querySelectorAll(':scope > li')).map(el => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;

      const x = Math.random() * (W - w) + w / 2;

      // 方案 A：直接生在容器內、頂緣下 8px，重力會讓它自然落下：
      const y = 8 + h/2;

      // 方案 B（想要「從外面掉進來」的視覺）：生在 roof 上方一點：
      // const y = roofY - wallThickness - 10;

      const body = Bodies.rectangle(x, y, w, h, {
        chamfer: { radius: h / 2 },
        density: 0.0015,
        friction: 0.25,
        frictionAir: 0.02,
        restitution: 0.18,
        angle: (Math.random() * 36 - 18) * Math.PI / 180
      });
      World.add(world, body);
      return { el, body, w, h };
    });

    Events.on(engine, 'afterUpdate', () => {
      for (const it of items) {
        const { x, y } = it.body.position;
        it.el.style.transform =
          `translate(${x - it.w/2}px, ${y - it.h/2}px) rotate(${it.body.angle}rad)`;
      }
    });

    // 滑鼠拖拉
    const mouse = Mouse.create(container);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2 }
    });
    World.add(world, mouseConstraint);

    // === 3) RWD：記得重新定位 roof ===
    const ro = new ResizeObserver(() => {
      const newW = container.clientWidth;
      const newH = container.clientHeight;

      Body.setPosition(ground,   { x: newW/2, y: newH - floorInset + wallThickness/2 });
      Body.setPosition(wallLeft, { x: -wallThickness/2, y: newH/2 });
      Body.setPosition(wallRt,   { x: newW + wallThickness/2, y: newH/2 });
      Body.setPosition(roof,     { x: newW/2, y: roofY - wallThickness/2 });

      const ratio = newW / W || 1;
      items.forEach(({ body }) => {
        Body.setPosition(body, { x: body.position.x * ratio, y: body.position.y });
      });

      W = newW; H = newH;
    });
    ro.observe(container);
  }

  const zone = document.getElementById('fallzone');
  const io = new IntersectionObserver((ents) => {
    ents.forEach(e => {
      if (e.isIntersecting) {
        startChipsPhysics();
        io.unobserve(zone);
      }
    });
  });
  io.observe(zone);
})();