/**
 * Nokia 3210 Snake – pixel-accurate recreation
 *
 * Rendering: each "LCD pixel" = SCALE screen pixels.
 * Grid 84×52 LCD pixels (4 rows score, 1px border, rest = play field).
 * Game cells are 3×3 LCD pixels.
 * Head/tail/body all drawn with authentic Nokia shapes.
 */
const Game = (() => {
  const SCALE = 6;
  const GRID_W = 84;
  const GRID_H = 52;
  const SCORE_ROWS = 4;

  const BG = '#c7de4f';
  const PIXEL = '#111';

  const CELL = 3;
  const PLAY_X = 1;
  const PLAY_Y = SCORE_ROWS + 1;
  const PLAY_W = Math.floor((GRID_W - 2) / CELL);
  const PLAY_H = Math.floor((GRID_H - SCORE_ROWS - 2) / CELL);

  let canvas, ctx;
  let snake, dir, nextDir, food, score, alive, tickMs;
  let highScore;
  let state; // 'menu' | 'playing' | 'paused' | 'gameover'
  let onStateChange;
  let rafId, lastTime;

  // ─── Bitmap digits 3×5 ───
  const DIGITS = {
    0:['111','101','101','101','111'],
    1:['010','110','010','010','111'],
    2:['111','001','111','100','111'],
    3:['111','001','111','001','111'],
    4:['101','101','111','001','001'],
    5:['111','100','111','001','111'],
    6:['111','100','111','101','111'],
    7:['111','001','010','010','010'],
    8:['111','101','111','101','111'],
    9:['111','101','111','001','111'],
  };

  const FONT = {
    'A':[0x2,0x5,0x7,0x5,0x5],'B':[0x6,0x5,0x6,0x5,0x6],'C':[0x3,0x4,0x4,0x4,0x3],
    'D':[0x6,0x5,0x5,0x5,0x6],'E':[0x7,0x4,0x7,0x4,0x7],'F':[0x7,0x4,0x7,0x4,0x4],
    'G':[0x7,0x4,0x5,0x5,0x7],'H':[0x5,0x5,0x7,0x5,0x5],'I':[0x7,0x2,0x2,0x2,0x7],
    'K':[0x5,0x5,0x6,0x5,0x5],'L':[0x4,0x4,0x4,0x4,0x7],'M':[0x5,0x7,0x7,0x5,0x5],
    'N':[0x5,0x5,0x7,0x7,0x5],'O':[0x7,0x5,0x5,0x5,0x7],'P':[0x7,0x5,0x7,0x4,0x4],
    'R':[0x7,0x5,0x7,0x6,0x5],'S':[0x7,0x4,0x7,0x1,0x7],'T':[0x7,0x2,0x2,0x2,0x2],
    'U':[0x5,0x5,0x5,0x5,0x7],'V':[0x5,0x5,0x5,0x5,0x2],'W':[0x5,0x5,0x7,0x7,0x5],
    'X':[0x5,0x5,0x2,0x5,0x5],'Y':[0x5,0x5,0x2,0x2,0x2],
    '>':[0x4,0x2,0x1,0x2,0x4],' ':[0x0,0x0,0x0,0x0,0x0],
    '-':[0x0,0x0,0x7,0x0,0x0],':':[0x0,0x1,0x0,0x1,0x0],
  };

  // ─── Init ───
  function init(canvasEl, stateChangeCb) {
    canvas = canvasEl;
    canvas.width = GRID_W * SCALE;
    canvas.height = GRID_H * SCALE;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    onStateChange = stateChangeCb;
    highScore = parseInt(localStorage.getItem('nokia_snake_high') || '0', 10);
    state = 'menu';
    render();
  }

  // ─── Low-level drawing ───
  function drawPixel(x, y) {
    ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
  }

  function clearPixel(x, y) {
    ctx.fillStyle = BG;
    ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    ctx.fillStyle = PIXEL;
  }

  function cls() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function cellToLCD(cx, cy) {
    return { px: PLAY_X + cx * CELL, py: PLAY_Y + cy * CELL };
  }

  // ─── Score digits ───
  function drawNumber(n, x, y) {
    const s = n.toString();
    for (let i = 0; i < s.length; i++) {
      const d = DIGITS[s[i]];
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 3; col++)
          if (d[row][col] === '1')
            drawPixel(x + i * 4 + col, y + row);
    }
  }

  // ─── Text (3×5 font) ───
  function drawChar(ch, x, y) {
    // Try digit first
    if (DIGITS[ch]) {
      const d = DIGITS[ch];
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 3; col++)
          if (d[row][col] === '1')
            drawPixel(x + col, y + row);
      return;
    }
    const g = FONT[ch.toUpperCase()];
    if (!g) return;
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++)
        if (g[r] & (4 >> c))
          drawPixel(x + c, y + r);
  }

  function drawText(str, x, y, sp) {
    sp = sp || 4;
    for (let i = 0; i < str.length; i++)
      drawChar(str[i], x + i * sp, y);
  }

  function measureText(str, sp) {
    sp = sp || 4;
    return str.length * sp - (sp - 3);
  }

  function drawTextCentered(str, y, sp) {
    sp = sp || 4;
    drawText(str, Math.floor((GRID_W - measureText(str, sp)) / 2), y, sp);
  }

  // ─── Border ───
  function drawBorder() {
    ctx.fillStyle = PIXEL;
    for (let x = 0; x < GRID_W; x++) {
      drawPixel(x, SCORE_ROWS);
      drawPixel(x, GRID_H - 1);
    }
    for (let y = SCORE_ROWS; y < GRID_H; y++) {
      drawPixel(0, y);
      drawPixel(GRID_W - 1, y);
    }
  }

  // ─── Snake parts ───
  function drawBody(cx, cy) {
    const { px, py } = cellToLCD(cx, cy);
    drawPixel(px, py);
    drawPixel(px + 1, py);
    drawPixel(px, py + 1);
    drawPixel(px + 1, py + 1);
  }

  function drawHead(cx, cy, dx, dy) {
    const { px, py } = cellToLCD(cx, cy);

    if (dx === 1) {
      // moving right: 3 wide, 2 tall, eye at top-right
      drawPixel(px, py); drawPixel(px+1, py); drawPixel(px+2, py);
      drawPixel(px, py+1); drawPixel(px+1, py+1); drawPixel(px+2, py+1);
      clearPixel(px+2, py);
    } else if (dx === -1) {
      // moving left: eye at top-left
      drawPixel(px, py); drawPixel(px+1, py); drawPixel(px+2, py);
      drawPixel(px, py+1); drawPixel(px+1, py+1); drawPixel(px+2, py+1);
      clearPixel(px, py);
    } else if (dy === -1) {
      // moving up: 2 wide, 3 tall, eye at top-right
      drawPixel(px, py); drawPixel(px+1, py);
      drawPixel(px, py+1); drawPixel(px+1, py+1);
      drawPixel(px, py+2); drawPixel(px+1, py+2);
      clearPixel(px+1, py);
    } else {
      // moving down: eye at bottom-right
      drawPixel(px, py); drawPixel(px+1, py);
      drawPixel(px, py+1); drawPixel(px+1, py+1);
      drawPixel(px, py+2); drawPixel(px+1, py+2);
      clearPixel(px+1, py+2);
    }
  }

  function drawTail(cx, cy, prevX, prevY) {
    const { px, py } = cellToLCD(cx, cy);
    const tdx = prevX - cx;
    const tdy = prevY - cy;

    if (tdx === 1) {
      drawPixel(px+1, py); drawPixel(px+1, py+1); drawPixel(px, py);
    } else if (tdx === -1) {
      drawPixel(px, py); drawPixel(px, py+1); drawPixel(px+1, py);
    } else if (tdy === 1) {
      drawPixel(px, py+1); drawPixel(px+1, py+1); drawPixel(px, py);
    } else {
      drawPixel(px, py); drawPixel(px+1, py); drawPixel(px, py+1);
    }
  }

  function drawFood(cx, cy) {
    const { px, py } = cellToLCD(cx, cy);
    drawPixel(px+1, py);
    drawPixel(px, py+1);
    drawPixel(px+1, py+1);
    drawPixel(px+2, py+1);
    drawPixel(px+1, py+2);
  }

  // ─── Game logic ───
  function resetGame() {
    snake = [];
    for (let i = 0; i < 4; i++)
      snake.push({ x: 10 - i, y: Math.floor(PLAY_H / 2) });
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    alive = true;
    tickMs = 120;
    placeFood();
  }

  function placeFood() {
    while (true) {
      const x = Math.floor(Math.random() * PLAY_W);
      const y = Math.floor(Math.random() * PLAY_H);
      if (!snake.some(s => s.x === x && s.y === y)) {
        food = { x, y };
        return;
      }
    }
  }

  function step() {
    if (!alive) return;

    dir = nextDir;
    const head = snake[0];
    const nh = { x: head.x + dir.x, y: head.y + dir.y };

    if (nh.x < 0 || nh.x >= PLAY_W || nh.y < 0 || nh.y >= PLAY_H) {
      alive = false;
      state = 'gameover';
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('nokia_snake_high', String(highScore));
      }
      playBeep(200, 80);
      setTimeout(() => playBeep(150, 120), 100);
      if (onStateChange) onStateChange(state);
      return;
    }

    if (snake.some(s => s.x === nh.x && s.y === nh.y)) {
      alive = false;
      state = 'gameover';
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('nokia_snake_high', String(highScore));
      }
      playBeep(200, 80);
      setTimeout(() => playBeep(150, 120), 100);
      if (onStateChange) onStateChange(state);
      return;
    }

    snake.unshift(nh);

    if (nh.x === food.x && nh.y === food.y) {
      score += 1;
      placeFood();
      tickMs = Math.max(60, tickMs - 2);
      playBeep(600, 40);
    } else {
      snake.pop();
    }
  }

  // ─── Render ───
  function render() {
    cls();
    ctx.fillStyle = PIXEL;

    if (state === 'menu') {
      drawBorder();
      drawTextCentered('SNAKE', 0, 5);
      drawText('> START', 14, PLAY_Y + 8);
      drawText('HIGH ' + String(highScore), 14, PLAY_Y + 18);
      return;
    }

    if (state === 'paused') {
      drawBorder();
      drawNumber(score, 1, 0);
      drawTextCentered('PAUSED', PLAY_Y + 12, 5);
      return;
    }

    if (state === 'gameover') {
      drawBorder();
      drawNumber(score, 1, 0);
      // Draw the final snake state
      drawGameSnake();
      // Death line across the middle
      ctx.fillStyle = PIXEL;
      const midY = Math.floor((SCORE_ROWS + GRID_H) / 2);
      for (let x = 4; x < GRID_W - 4; x++) drawPixel(x, midY);
      return;
    }

    // --- Playing ---
    drawBorder();
    drawNumber(score, 1, 0);
    drawGameSnake();
  }

  function drawGameSnake() {
    ctx.fillStyle = PIXEL;
    // Food
    drawFood(food.x, food.y);
    // Body (skip head and tail)
    for (let i = 1; i < snake.length - 1; i++)
      drawBody(snake[i].x, snake[i].y);
    // Tail
    if (snake.length > 1) {
      const tail = snake[snake.length - 1];
      const prev = snake[snake.length - 2];
      drawTail(tail.x, tail.y, prev.x, prev.y);
    }
    // Head
    ctx.fillStyle = PIXEL;
    drawHead(snake[0].x, snake[0].y, dir.x, dir.y);
  }

  // ─── Game loop (requestAnimationFrame) ───
  function gameLoop(timestamp) {
    if (state !== 'playing') return;
    if (timestamp - lastTime > tickMs) {
      step();
      lastTime = timestamp;
    }
    render();
    rafId = requestAnimationFrame(gameLoop);
  }

  function startLoop() {
    lastTime = performance.now();
    rafId = requestAnimationFrame(gameLoop);
  }

  function stopLoop() {
    cancelAnimationFrame(rafId);
  }

  // ─── State management ───
  function startGame() {
    resetGame();
    state = 'playing';
    if (onStateChange) onStateChange(state);
    startLoop();
  }

  function pause() {
    if (state !== 'playing') return;
    stopLoop();
    state = 'paused';
    render();
    if (onStateChange) onStateChange(state);
  }

  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    if (onStateChange) onStateChange(state);
    startLoop();
  }

  // ─── Public input handlers ───
  function handleDirection(dx, dy) {
    if (state === 'menu' || state === 'gameover') { handleStart(); return; }
    if (state === 'paused') { resume(); return; }
    if (state !== 'playing') return;

    if (dx !== 0 && dir.x === 0) nextDir = { x: dx, y: 0 };
    else if (dy !== 0 && dir.y === 0) nextDir = { x: 0, y: dy };
  }

  function handleStart() {
    if (state === 'menu') startGame();
    else if (state === 'playing') pause();
    else if (state === 'paused') resume();
    else if (state === 'gameover') {
      state = 'menu';
      render();
      if (onStateChange) onStateChange(state);
    }
  }

  function handleKey(e) {
    const k = e.key.toLowerCase();
    switch (k) {
      case 'arrowup':    case 'w': handleDirection(0, -1);  e.preventDefault(); break;
      case 'arrowdown':  case 's': handleDirection(0, 1);   e.preventDefault(); break;
      case 'arrowleft':  case 'a': handleDirection(-1, 0);  e.preventDefault(); break;
      case 'arrowright': case 'd': handleDirection(1, 0);   e.preventDefault(); break;
      case 'enter': case ' ':      handleStart();           e.preventDefault(); break;
      case 'p': if (state === 'playing') pause(); else if (state === 'paused') resume(); break;
    }
  }

  // ─── Sound ───
  let audioCtx;
  function playBeep(freq, dur) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur / 1000);
    } catch (e) {}
  }

  return {
    init,
    handleKey,
    handleDirection,
    handleStart,
    getState: () => state,
    getScore: () => score,
  };
})();
