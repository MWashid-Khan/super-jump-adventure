
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

const coinsEl = document.getElementById("coins");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const message = document.getElementById("message");
const description = document.getElementById("description");
const startBtn = document.getElementById("startBtn");

const keys = {
  left: false,
  right: false,
  jump: false
};

let player;
let platforms = [];
let coins = [];
let enemies = [];
let flag;
let camera = 0;
let worldWidth = 2400;
let level = 1;
let lives = 3;
let score = 0;
let running = false;
let invincible = 0;
let audioCtx = null;

const GRAVITY = 0.55;
const SPEED = 4.5;
const JUMP = -12;

// Sound effects
function sound(frequency, duration, type = "sine") {
  try {
    audioCtx ??= new (
      window.AudioContext ||
      window.webkitAudioContext
    )();

    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    gain.gain.setValueAtTime(
      0.08, audioCtx.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + duration
    );

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Game works even if sound is unavailable.
  }
}

// Update score, lives and level
function updateHUD() {
  coinsEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = level;
}

// Create game level
function createLevel() {
  worldWidth = 2300 + level * 500;
  camera = 0;
  invincible = 0;

  player = {
    x: 55,
    y: 300,
    w: 32,
    h: 43,
    vx: 0,
    vy: 0,
    grounded: false
  };

  platforms = [];
  coins = [];
  enemies = [];

  // Ground platforms with gaps
  for (let x = 0; x < worldWidth; x += 450) {
    platforms.push({
      x: x,
      y: 400,
      w: 360,
      h: 50
    });
  }

  // Floating platforms and coins
  for (
    let x = 230;
    x < worldWidth - 180;
    x += 310
  ) {
    const y = 295 -
      ((Math.floor(x / 310) % 2) * 45);

    platforms.push({
      x: x,
      y: y,
      w: 125,
      h: 18
    });

    coins.push({
      x: x + 55,
      y: y - 38,
      r: 12,
      collected: false
    });
  }

  // Ground coins
  for (
    let x = 120;
    x < worldWidth - 150;
    x += 145
  ) {
    if (x % 450 < 320) {
      coins.push({
        x: x,
        y: 355,
        r: 11,
        collected: false
      });
    }
  }

  // Moving enemies
  for (
    let x = 550;
    x < worldWidth - 200;
    x += Math.max(300, 600 - level * 65)
  ) {
    const sectionStart =
      Math.floor(x / 450) * 450;

    enemies.push({
      x: sectionStart + 180,
      y: 368,
      w: 32,
      h: 32,
      start: sectionStart + 90,
      end: sectionStart + 290,
      dir: 1,
      alive: true
    });
  }

  // Finish flag on safe ground
  const lastGround =
    Math.floor((worldWidth - 100) / 450) * 450;

  flag = {
    x: Math.min(lastGround + 200, worldWidth - 80),
    y: 310,
    w: 35,
    h: 90
  };

  updateHUD();
}

// Collision detection
function hit(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// Player loses a life
function hurtPlayer() {
  if (invincible > 0) return;

  lives--;
  sound(170, 0.35, "sawtooth");
  updateHUD();

  if (lives <= 0) {
    endGame(false);
    return;
  }

  player.x = Math.max(55, camera + 35);
  player.y = 150;
  player.vx = 0;
  player.vy = 0;
  invincible = 100;
}

// End game
function endGame(won) {
  running = false;

  keys.left = false;
  keys.right = false;
  keys.jump = false;

  overlay.classList.remove("hidden");

  message.textContent = won
    ? "🏆 You Win!"
    : "💔 Game Over!";

  description.textContent = won
    ? `Amazing! You collected ${score} coins!`
    : `You collected ${score} coins. Try again!`;

  startBtn.textContent = "Play Again";
}

// Next level
function nextLevel() {
  sound(800, 0.25);

  if (level >= 3) {
    endGame(true);
    return;
  }

  level++;
  createLevel();
}

// Game physics and logic
function update() {
  if (!running) return;

  if (invincible > 0) {
    invincible--;
  }

  player.vx = 0;

  if (keys.left) {
    player.vx = -SPEED;
  }

  if (keys.right) {
    player.vx = SPEED;
  }

  // Jump
  if (keys.jump && player.grounded) {
    player.vy = JUMP;
    player.grounded = false;
    sound(430, 0.12);
  }

  // Horizontal movement
  player.x += player.vx;

  player.x = Math.max(
    0,
    Math.min(worldWidth - player.w, player.x)
  );

  const previousBottom = player.y + player.h;

  // Gravity
  player.vy += GRAVITY;
  player.vy = Math.min(player.vy, 13);
  player.y += player.vy;
  player.grounded = false;

  // Platform collision
  for (const p of platforms) {
    const horizontal =
      player.x + player.w > p.x &&
      player.x < p.x + p.w;

    if (
      horizontal &&
      previousBottom <= p.y + 8 &&
      player.y + player.h >= p.y &&
      player.vy >= 0
    ) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.grounded = true;
    }
  }

  // Falling into a gap
  if (player.y > H + 60) {
    hurtPlayer();

    if (running) {
      const safeGround =
        Math.floor(player.x / 450) * 450;

      player.x = Math.max(55, safeGround + 30);
      player.y = 150;
      player.vy = 0;
    }
  }

  // Collect coins
  for (const c of coins) {
    if (c.collected) continue;

    const nearestX = Math.max(
      player.x,
      Math.min(c.x, player.x + player.w)
    );

    const nearestY = Math.max(
      player.y,
      Math.min(c.y, player.y + player.h)
    );

    if (
      Math.hypot(
        c.x - nearestX,
        c.y - nearestY
      ) < c.r
    ) {
      c.collected = true;
      score++;
      sound(900, 0.09);
      updateHUD();
    }
  }

  // Enemy movement and collision
  for (const e of enemies) {
    if (!e.alive) continue;

    e.x += e.dir * (1.1 + level * 0.3);

    if (e.x > e.end || e.x < e.start) {
      e.dir *= -1;
    }

    if (hit(player, e)) {
      // Jump on enemy
      if (
        player.vy > 0 &&
        previousBottom <= e.y + 12
      ) {
        e.alive = false;
        player.vy = -9;
        score += 3;

        sound(600, 0.14, "square");
        updateHUD();
      } else {
        hurtPlayer();

        if (!running) return;
      }
    }
  }

  // Reach finish flag
  if (hit(player, flag)) {
    nextLevel();
    return;
  }

  // Camera follows player
  camera = Math.max(
    0,
    Math.min(
      worldWidth - W,
      player.x - W * 0.32
    )
  );
}

// Background graphics
function drawBackground() {
  const sky = ctx.createLinearGradient(
    0, 0, 0, H
  );

  sky.addColorStop(0, "#67c8ff");
  sky.addColorStop(1, "#d7f7ff");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Sun
  ctx.fillStyle = "#fff7a5";
  ctx.beginPath();
  ctx.arc(760, 80, 37, 0, Math.PI * 2);
  ctx.fill();

  // Hills
  for (
    let x = -300;
    x < W + 400;
    x += 290
  ) {
    const px = x - (camera * 0.15 % 290);

    ctx.fillStyle = "#8bd7a5";
    ctx.beginPath();
    ctx.arc(px, 420, 170, Math.PI, 0);
    ctx.fill();
  }

  // Clouds
  for (
    let x = 100;
    x < W + 200;
    x += 260
  ) {
    const px = x - (camera * 0.25 % 260);

    ctx.fillStyle = "rgba(255,255,255,0.85)";

    for (const [dx, dy, r] of [
      [0, 0, 24],
      [25, -12, 30],
      [55, 0, 24]
    ]) {
      ctx.beginPath();
      ctx.arc(
        px + dx,
        100 + dy,
        r,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }
}

// Draw game graphics
function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();

  ctx.save();
  ctx.translate(-camera, 0);

  // Platforms
  for (const p of platforms) {
    ctx.fillStyle = "#85502c";
    ctx.fillRect(p.x, p.y, p.w, p.h);

    ctx.fillStyle = "#36c75a";
    ctx.fillRect(p.x, p.y, p.w, 12);

    ctx.fillStyle = "#239b45";
    ctx.fillRect(p.x, p.y + 10, p.w, 4);
  }

  // Coins
  for (const c of coins) {
    if (c.collected) continue;

    ctx.fillStyle = "#ffca20";
    ctx.strokeStyle = "#e68a00";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(
      c.x,
      c.y,
      c.r,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fff4a0";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("$", c.x, c.y + 5);
  }

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;

    ctx.fillStyle = "#e84453";
    ctx.beginPath();
    ctx.roundRect(
      e.x, e.y, e.w, e.h, 10
    );
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.fillRect(e.x + 7, e.y + 9, 6, 7);
    ctx.fillRect(e.x + 20, e.y + 9, 6, 7);

    ctx.fillStyle = "#252040";
    ctx.fillRect(e.x + 9, e.y + 11, 3, 4);
    ctx.fillRect(e.x + 22, e.y + 11, 3, 4);
  }

  // Finish flag
  ctx.fillStyle = "#eeeeee";
  ctx.fillRect(
    flag.x, flag.y, 6, flag.h
  );

  ctx.fillStyle = "#ffcc00";
  ctx.beginPath();
  ctx.moveTo(flag.x + 6, flag.y);
  ctx.lineTo(flag.x + 55, flag.y + 17);
  ctx.lineTo(flag.x + 6, flag.y + 34);
  ctx.closePath();
  ctx.fill();

  // Player character
  if (
    invincible === 0 ||
    Math.floor(invincible / 6) % 2 === 0
  ) {
    // Blue body
    ctx.fillStyle = "#245de0";
    ctx.beginPath();
    ctx.roundRect(
      player.x,
      player.y + 10,
      player.w,
      player.h - 10,
      7
    );
    ctx.fill();

    // Face
    ctx.fillStyle = "#ffdb9b";
    ctx.beginPath();
    ctx.arc(
      player.x + 16,
      player.y + 13,
      13,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Hat
    ctx.fillStyle = "#1744ae";
    ctx.fillRect(
      player.x + 3,
      player.y,
      26,
      8
    );

    // Eye
    ctx.fillStyle = "#222";
    ctx.fillRect(
      player.x + 20,
      player.y + 11,
      4,
      5
    );

    // Shoes
    ctx.fillStyle = "#f8f8ff";
    ctx.fillRect(
      player.x + 3,
      player.y + 35,
      11,
      8
    );

    ctx.fillRect(
      player.x + 19,
      player.y + 35,
      11,
      8
    );
  }

  ctx.restore();
}

// Main game loop
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// Start or restart game
function startGame() {
  level = 1;
  lives = 3;
  score = 0;

  keys.left = false;
  keys.right = false;
  keys.jump = false;

  createLevel();

  running = true;
  overlay.classList.add("hidden");

  sound(550, 0.1);
}

startBtn.addEventListener(
  "click",
  startGame
);

// Computer keyboard controls
document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();

  if (
    ["arrowleft", "arrowright", "arrowup", " "]
      .includes(k)
  ) {
    e.preventDefault();
  }

  if (k === "arrowleft" || k === "a") {
    keys.left = true;
  }

  if (k === "arrowright" || k === "d") {
    keys.right = true;
  }

  if (
    k === "arrowup" ||
    k === "w" ||
    k === " "
  ) {
    keys.jump = true;
  }
});

document.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();

  if (k === "arrowleft" || k === "a") {
    keys.left = false;
  }

  if (k === "arrowright" || k === "d") {
    keys.right = false;
  }

  if (
    k === "arrowup" ||
    k === "w" ||
    k === " "
  ) {
    keys.jump = false;
  }
});

// Mobile touch controls
function bindControl(id, key) {
  const btn = document.getElementById(id);

  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();

    btn.setPointerCapture(e.pointerId);
    keys[key] = true;
  });

  const release = (e) => {
    e.preventDefault();
    keys[key] = false;
  };

  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointercancel", release);

  btn.addEventListener(
    "lostpointercapture",
    () => {
      keys[key] = false;
    }
  );
}

bindControl("leftBtn", "left");
bindControl("rightBtn", "right");
bindControl("jumpBtn", "jump");

// Stop movement when browser loses focus
window.addEventListener("blur", () => {
  keys.left = false;
  keys.right = false;
  keys.jump = false;
});

// Initialize game
createLevel();
loop();
