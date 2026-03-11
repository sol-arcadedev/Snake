/**
 * Nokia 3210 Snake - UI Controller
 * Plays the Nokia intro video first, then initializes the game.
 */
(function () {
  const video = document.getElementById('intro-video');
  const canvas = document.getElementById('game-canvas');
  let gameStarted = false;

  function startGame() {
    if (gameStarted) return;
    gameStarted = true;

    // Hide video, show canvas
    video.style.display = 'none';
    video.pause();
    canvas.removeAttribute('style');  // clear the inline display:none

    // Initialize game
    Game.init(canvas);

    // Keyboard input (added after init so no race condition)
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
        Game.handleStart();
        return;
      }

      if (absDx > absDy) {
        Game.handleDirection(dx > 0 ? 1 : -1, 0);
      } else {
        Game.handleDirection(0, dy > 0 ? 1 : -1);
      }
    }, { passive: false });

    canvas.addEventListener('click', () => {
      Game.handleStart();
    });
  }

  // When intro video ends, switch to the game
  video.addEventListener('ended', startGame);

  // If video fails to load or play, skip straight to game
  video.addEventListener('error', startGame);

  // Allow skipping the intro by clicking/tapping the video
  video.addEventListener('click', () => startGame());
  video.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startGame();
  }, { passive: false });

  // Allow skipping with any key press
  document.addEventListener('keydown', function skipIntro(e) {
    if (gameStarted) return;
    e.preventDefault();
    startGame();
    document.removeEventListener('keydown', skipIntro);
  });
})();
