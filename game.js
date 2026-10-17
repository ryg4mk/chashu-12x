(() => {
  'use strict';

  const START_COUNT = 6;
  const RAMEN_PRICE = 950;
  const SLICE_PRICE = 70;
  const SLICE_GRAMS = 12;
  const SLICE_MM = 7;
  const CASH = 6000;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  const ui = {
    score: $('score'),
    best: $('best'),
    total: $('total'),
    change: $('change'),
    weight: $('weight'),
    thickness: $('thickness'),
    overlay: $('overlay'),
    title: $('panel-title'),
    eyebrow: $('panel-eyebrow'),
    text: $('panel-text'),
    start: $('start-btn'),
    restart: $('restart'),
    toast: $('toast')
  };

  let W = 390;
  let H = 507;
  let dpr = 1;
  let last = 0;
  let time = 0;
  let state = 'menu';
  let score = START_COUNT;
  let best = START_COUNT;
  let pieces = [];
  let toastUntil = 0;
  let launcherX = 0;
  let launcherDir = 1;
  let lastSpawnTime = -9999;
  let gameOverReason = '';

  try {
    best = Math.max(START_COUNT, Number(localStorage.getItem('chashu-physics-best')) || START_COUNT);
  } catch (_) {}

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(320, rect.width);
    H = Math.max(400, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }
  resize();

  const bowl = () => ({
    cx: W * 0.5,
    bottomY: H * 0.83,
    topY: H * 0.53,
    bottomHalf: W * 0.17,
    topHalf: W * 0.30,
    rimY: H * 0.56
  });

  function getHalfWidth(y) {
    const b = bowl();
    const t = clamp((b.bottomY - y) / (b.bottomY - b.topY), 0, 1);
    return lerp(b.bottomHalf, b.topHalf, Math.pow(t, 0.72));
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function yen(v) {
    return `${Math.round(v).toLocaleString('ja-JP')}円`;
  }

  function makePiece(x, y, options = {}) {
    return {
      x,
      y,
      vx: options.vx || 0,
      vy: options.vy || 0,
      r: options.r || Math.min(W, H) * 0.048,
      angle: rand(-0.22, 0.22),
      spin: rand(-0.024, 0.024),
      seed: Math.random() * 100,
      touchedBowl: !!options.touchedBowl,
      inserted: !!options.inserted,
      spillGuard: !!options.spillGuard
    };
  }

  function initialPieces() {
    const b = bowl();
    const r = Math.min(W, H) * 0.048;
    return [
      makePiece(b.cx - r * 1.7, b.bottomY - r * 1.2, { touchedBowl: true, inserted: true, spillGuard: true }),
      makePiece(b.cx, b.bottomY - r * 1.24, { touchedBowl: true, inserted: true, spillGuard: true }),
      makePiece(b.cx + r * 1.7, b.bottomY - r * 1.18, { touchedBowl: true, inserted: true, spillGuard: true }),
      makePiece(b.cx - r * 0.85, b.bottomY - r * 3.02, { touchedBowl: true, inserted: true, spillGuard: true }),
      makePiece(b.cx + r * 0.95, b.bottomY - r * 3.06, { touchedBowl: true, inserted: true, spillGuard: true }),
      makePiece(b.cx, b.bottomY - r * 4.95, { touchedBowl: true, inserted: true, spillGuard: true })
    ];
  }

  function updateHud() {
    const total = RAMEN_PRICE + score * SLICE_PRICE;
    const change = CASH - total;
    ui.score.innerHTML = `${score}<span class="unit"> 枚</span>`;
    ui.best.innerHTML = `${best}<span class="unit"> 枚</span>`;
    ui.total.textContent = yen(total);
    ui.change.textContent = change >= 0 ? yen(change) : `${yen(Math.abs(change))}不足`;
    ui.change.style.color = change >= 0 ? '#a0e1a2' : '#ffb6a5';
    ui.weight.textContent = `${score * SLICE_GRAMS}g`;
    ui.thickness.textContent = `${score * SLICE_MM}mm`;
  }

  function showToast(message, duration = 1100) {
    ui.toast.textContent = message;
    ui.toast.classList.add('show');
    toastUntil = time + duration;
  }

  function hideToastIfNeeded() {
    if (time > toastUntil) ui.toast.classList.remove('show');
  }

  function resetGame() {
    pieces = initialPieces();
    score = START_COUNT;
    launcherX = -0.86;
    launcherDir = 1;
    lastSpawnTime = -9999;
    gameOverReason = '';
    state = 'play';
    ui.overlay.classList.add('hidden');
    ui.toast.classList.remove('show');
    updateHud();
  }

  function openGameOver() {
    state = 'over';
    const total = RAMEN_PRICE + score * SLICE_PRICE;
    ui.eyebrow.textContent = '器からチャーシューが落ちた！';
    ui.title.innerHTML = `${score}枚でストップ！`;
    ui.text.innerHTML = `${gameOverReason || 'チャーシューが器から落ちてしまいました。'}<br>お会計 ${yen(total)} / お釣り ${yen(CASH - total)}<br>もう一度山盛りに挑戦しよう！`;
    ui.start.innerHTML = 'もう一度プレイ <span>▶</span>';
    ui.overlay.classList.remove('hidden');
  }

  function spawnPiece() {
    if (state !== 'play') return;
    if (time - lastSpawnTime < 60) return;
    lastSpawnTime = time;

    const b = bowl();
    const x = b.cx + launcherX * (b.topHalf * 0.95);
    const y = H * 0.18;
    pieces.push(makePiece(x, y, { vx: rand(-18, 18), vy: 0 }));
    score += 1;
    if (score > best) {
      best = score;
      try { localStorage.setItem('chashu-physics-best', String(best)); } catch (_) {}
    }
    updateHud();
    if (score % 10 === 0) showToast(`${score}枚！ まだまだいける！`);
  }

  function endBySpill(piece) {
    if (state !== 'play') return;
    piece.spilled = true;
    gameOverReason = `外に落ちたチャーシューでゲームオーバー。`;
    showToast('器から落ちた！');
    openGameOver();
  }

  function physics(dt) {
    const b = bowl();
    launcherX += launcherDir * dt * 0.00115;
    if (launcherX > 0.94) { launcherX = 0.94; launcherDir = -1; }
    if (launcherX < -0.94) { launcherX = -0.94; launcherDir = 1; }

    const gravity = 1450;
    const bounce = 0.16;
    const friction = 0.988;

    for (const p of pieces) {
      if (p.spilled) continue;

      p.vy += gravity * dt / 1000;
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.angle += p.spin * dt / 16;
      p.spin *= 0.998;

      if (p.y + p.r >= b.bottomY) {
        p.y = b.bottomY - p.r;
        if (p.vy > 0) p.vy *= -bounce;
        p.vx *= 0.95;
        p.touchedBowl = true;
      }

      if (p.y + p.r > b.topY + 8) p.inserted = true;

      if (p.y >= b.topY - p.r * 0.4 && p.y <= b.bottomY + p.r) {
        const half = getHalfWidth(clamp(p.y, b.topY, b.bottomY));
        const dx = p.x - b.cx;
        const limit = half - p.r * 0.86;
        if (Math.abs(dx) > limit) {
          if (p.y < b.topY + p.r * 0.85 && p.inserted) {
            return endBySpill(p);
          }
          const side = Math.sign(dx) || 1;
          p.x = b.cx + side * limit;
          p.vx *= -0.28;
          p.vy *= 0.98;
          p.touchedBowl = true;
        }
      }

      if (p.inserted && p.y < b.topY - p.r * 0.2 && Math.abs(p.x - b.cx) > b.topHalf - p.r * 0.55) {
        return endBySpill(p);
      }
    }

    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < pieces.length; i++) {
        const a = pieces[i];
        if (a.spilled) continue;
        for (let j = i + 1; j < pieces.length; j++) {
          const b2 = pieces[j];
          if (b2.spilled) continue;
          const dx = b2.x - a.x;
          const dy = b2.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const minDist = a.r + b2.r;
          if (dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b2.x += nx * overlap * 0.5;
            b2.y += ny * overlap * 0.5;

            const rvx = b2.vx - a.vx;
            const rvy = b2.vy - a.vy;
            const sep = rvx * nx + rvy * ny;
            if (sep < 0) {
              const impulse = -sep * 0.36;
              a.vx -= nx * impulse;
              a.vy -= ny * impulse;
              b2.vx += nx * impulse;
              b2.vy += ny * impulse;
            }

            a.vx *= friction;
            b2.vx *= friction;
            a.spin += rand(-0.004, 0.004);
            b2.spin += rand(-0.004, 0.004);
          }
        }
      }
    }

    for (const p of pieces) {
      p.vx *= 0.998;
      if (Math.abs(p.vx) < 0.2) p.vx *= 0.94;
      if (Math.abs(p.vy) < 0.18) p.vy = 0;
    }
  }

  function drawRoundedRect(x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawVerticalText(text, x, y, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px "Yu Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let offset = 0;
    for (const ch of text) {
      ctx.fillText(ch, x, y + offset);
      offset += size * (ch === 'ー' ? 0.72 : 0.92);
    }
    ctx.restore();
  }

  function drawMenuBoards() {
    const labels = ['餃子', 'ライス', '野菜炒め', 'ラーメン', '特製チャーシューメン'];
    const startX = W * 0.16;
    const gap = W * 0.15;
    const boardW = W * 0.1;
    const boardH = H * 0.24;
    for (let i = 0; i < labels.length; i++) {
      const x = startX + gap * i;
      const y = H * 0.07 + Math.sin(i * 0.7) * 5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((-6 + i * 3) * Math.PI / 180);
      drawRoundedRect(-boardW / 2, 0, boardW, boardH, 8, '#8a5a2f');
      drawRoundedRect(-boardW / 2 + 4, 4, boardW - 8, boardH - 8, 7, '#c99761');
      ctx.fillStyle = '#7a4b23';
      ctx.fillRect(-boardW / 2 + 8, 12, boardW - 16, 3);
      drawVerticalText(labels[i], 0, 24, Math.max(14, W * 0.03), '#3b1d10');
      ctx.restore();
    }
  }

  function drawBackground() {
    const wall = ctx.createLinearGradient(0, 0, 0, H * 0.66);
    wall.addColorStop(0, '#704124');
    wall.addColorStop(0.5, '#8e5734');
    wall.addColorStop(1, '#3b2015');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H * 0.68);

    for (let i = 0; i < 8; i++) {
      const y = H * 0.68 + i * H * 0.06;
      ctx.fillStyle = i % 2 ? '#5f341e' : '#704126';
      ctx.fillRect(0, y, W, H * 0.06 + 1);
      ctx.strokeStyle = '#3a1f13';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + H * 0.06);
      ctx.lineTo(W, y + H * 0.06);
      ctx.stroke();
    }

    drawMenuBoards();
  }

  function drawBowlBase() {
    const b = bowl();
    const cx = b.cx;
    const bodyTop = b.rimY + H * 0.02;
    const bodyBottom = H * 0.96;
    const frontRx = b.topHalf * 1.06;
    const frontRy = H * 0.082;

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx + 12, bodyBottom - 4, frontRx * 1.03, frontRy * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyGrad = ctx.createLinearGradient(0, bodyTop, 0, bodyBottom);
    bodyGrad.addColorStop(0, '#fff1dc');
    bodyGrad.addColorStop(0.28, '#efc49a');
    bodyGrad.addColorStop(0.6, '#d37245');
    bodyGrad.addColorStop(1, '#59231b');

    ctx.beginPath();
    ctx.moveTo(cx - frontRx, b.rimY);
    ctx.quadraticCurveTo(cx - frontRx * 1.08, H * 0.78, cx - frontRx * 0.78, bodyBottom - 14);
    ctx.quadraticCurveTo(cx, bodyBottom + 6, cx + frontRx * 0.78, bodyBottom - 14);
    ctx.quadraticCurveTo(cx + frontRx * 1.08, H * 0.78, cx + frontRx, b.rimY);
    ctx.closePath();
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    ctx.strokeStyle = '#8e4537';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function drawSoupAndNoodles() {
    const b = bowl();
    const cx = b.cx;
    const soupRx = b.topHalf * 0.96;
    const soupRy = H * 0.086;

    ctx.fillStyle = '#fdf5ea';
    ctx.beginPath();
    ctx.ellipse(cx, b.rimY, soupRx * 1.07, soupRy * 1.13, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#743422';
    ctx.beginPath();
    ctx.ellipse(cx, b.rimY + 2, soupRx, soupRy, 0, 0, Math.PI * 2);
    ctx.fill();

    const soup = ctx.createRadialGradient(cx, b.rimY - 10, 10, cx, b.rimY, soupRx);
    soup.addColorStop(0, '#ffdd86');
    soup.addColorStop(0.65, '#eda242');
    soup.addColorStop(1, '#a65a22');
    ctx.fillStyle = soup;
    ctx.beginPath();
    ctx.ellipse(cx, b.rimY, soupRx * 0.92, soupRy * 0.84, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, b.rimY, soupRx * 0.89, soupRy * 0.8, 0, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < 22; i++) {
      const px = cx - soupRx * 0.74 + i * (soupRx * 1.46 / 21) + Math.sin(i * 1.2) * 5;
      const py = b.rimY + Math.cos(i * 1.07) * soupRy * 0.33;
      ctx.beginPath();
      ctx.moveTo(px - 18, py);
      ctx.bezierCurveTo(px - 5, py - 12, px + 8, py + 11, px + 22, py - 2);
      ctx.strokeStyle = i % 2 ? '#ffefb6cc' : '#f6c95ecc';
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 3 ? '#8bb24d' : '#c6d766';
      ctx.beginPath();
      ctx.ellipse(cx + Math.sin(i * 1.9) * soupRx * 0.56, b.rimY + Math.cos(i * 1.27) * soupRy * 0.44, 4.5, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = '#fff5de';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(cx, b.rimY, soupRx * 1.06, soupRy * 1.05, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawChashu(piece) {
    const flatten = 0.74;
    const w = piece.r * 2.1;
    const h = piece.r * 1.47;

    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.angle);
    ctx.shadowColor = 'rgba(28, 8, 6, 0.28)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.52, h * 0.52, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#7f3324';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, -1, w * 0.49, h * 0.48, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#b95636';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, -2, w * 0.40, h * 0.39, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f2bd92';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(-w * 0.08, -h * 0.03, w * 0.22, h * 0.19, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#d98b65';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, -2, w * 0.43, h * 0.42, 0.12, 0.14, 5.9);
    ctx.strokeStyle = '#ffe9c1';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const ang = piece.seed + i * 0.9;
      ctx.beginPath();
      ctx.ellipse(Math.cos(ang) * w * 0.18, Math.sin(ang) * h * 0.12, 2.4, 1.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#8e3829aa' : '#ffe3b0aa';
      ctx.fill();
    }

    ctx.restore();
  }

  function drawLauncher() {
    const b = bowl();
    const x = b.cx + launcherX * b.topHalf * 0.95;
    const y = H * 0.15;
    ctx.strokeStyle = 'rgba(255, 224, 176, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 36);
    ctx.lineTo(x, y - 4);
    ctx.stroke();

    ctx.fillStyle = '#f5dbaa';
    ctx.beginPath();
    ctx.roundRect(x - 22, y - 54, 44, 16, 8);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(x, y, b.topHalf * 0.18, H * 0.02, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 250, 210, 0.12)';
    ctx.fill();
  }

  function drawFrontRim() {
    const b = bowl();
    const cx = b.cx;
    const rimRx = b.topHalf * 1.08;
    const rimRy = H * 0.092;

    ctx.strokeStyle = '#a95742';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, b.rimY + 1, rimRx, rimRy, 0, Math.PI * 0.01, Math.PI * 0.99);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.ellipse(cx, b.rimY + rimRy * 0.16, rimRx * 0.88, rimRy * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawScene() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawBowlBase();
    drawSoupAndNoodles();

    const sorted = [...pieces].sort((a, b) => a.y - b.y);
    for (const p of sorted) drawChashu(p);

    drawFrontRim();
    if (state === 'play') drawLauncher();
  }

  function frame(ts) {
    const dt = Math.min(33, ts - last || 16);
    last = ts;
    time = ts;

    if (state === 'play') physics(dt);
    drawScene();
    hideToastIfNeeded();
    requestAnimationFrame(frame);
  }

  ui.start.addEventListener('click', (e) => {
    e.stopPropagation();
    resetGame();
  });

  ui.restart.addEventListener('click', (e) => {
    e.stopPropagation();
    resetGame();
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state === 'play') spawnPiece();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    if (document.activeElement && ['BUTTON', 'INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    e.preventDefault();
    if (state === 'play') spawnPiece();
    else resetGame();
  });

  window.addEventListener('blur', () => {
    last = 0;
  });

  pieces = initialPieces();
  updateHud();
  requestAnimationFrame(frame);
})();
