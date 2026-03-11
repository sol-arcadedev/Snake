/**
 * Nokia 3210 Snake - UI Controller
 * Overlays game on the real Nokia 3210 photo.
 *
 * Controls:
 * - Keyboard: Arrow keys / WASD, Enter to start, P to pause
 * - Keypad overlay: tap 2/4/6/8 on the phone image, 5 to start
 * - Swipe on screen area
 */
(function () {
  const canvas = document.getElementById('game-canvas');

  // Initialize game
  Game.init(canvas);

  // Keyboard input
  document.addEventListener('keydown', Game.handleKey);

  // Invisible keypad touch targets over the photo
  document.querySelectorAll('.touch-key').forEach(key => {
    key.addEventListener('click', () => {
      const k = key.dataset.key;
      switch (k) {
        case '2': Game.handleDirection(0, -1); break;
        case '4': Game.handleDirection(-1, 0); break;
        case '6': Game.handleDirection(1, 0); break;
        case '8': Game.handleDirection(0, 1); break;
        case '5': Game.handleStart(); break;
      }
    });
  });

  // Prevent double-tap zoom on touch devices
  document.querySelectorAll('.touch-key').forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      btn.click();
    }, { passive: false });
  });

  // Swipe support on the screen canvas
  let touchStartX = 0;
  let touchStartY = 0;

  canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (!e.changedTouches.length) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < 12) {
      // Tap on screen = start/select
      Game.handleStart();
      return;
    }

    if (absDx > absDy) {
      Game.handleDirection(dx > 0 ? 1 : -1, 0);
    } else {
      Game.handleDirection(0, dy > 0 ? 1 : -1);
    }
  }, { passive: false });

  // Also allow clicking on the screen to start
  canvas.addEventListener('click', () => {
    Game.handleStart();
  });
})();
