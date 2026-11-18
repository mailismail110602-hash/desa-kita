const socket = io();

// Elemen DOM
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const btnEnter = document.getElementById('btn-enter');
const playerNameInput = document.getElementById('player-name');
const selectHat = document.getElementById('select-hat');
const inputSkin = document.getElementById('input-skin');
const inputShirt = document.getElementById('input-shirt');
const selectExpression = document.getElementById('select-expression');
const previewCanvas = document.getElementById('preview-canvas');
const prevCtx = previewCanvas.getContext('2d');

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let myId = null;
let players = {};
let worldData = { kasDesa: {kayu:0, batu:0, jerami:0}, buildings: [], rumahCount: 0 };

// Status Input Pemain
let keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };
let joystickMove = { x: 0, y: 0, active: false };

// Posisi & Kamera Pemain Lokal
let myPlayer = {
  x: 500,
  y: 500,
  speed: 3.5,
  dir: 'down',
  moving: false
};

// --- FUNGSI MENGGAMBAR KARAKTER BEAN-HEAD ---
function drawBeanHead(context, x, y, p, scale = 1) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);

  // Bayangan kaki
  context.fillStyle = 'rgba(0,0,0,0.15)';
  context.beginPath();
  context.arc(0, 32, 12, 0, Math.PI * 2);
  context.fill();

  // Badan / Baju
  context.fillStyle = p.shirtColor || '#8B4513';
  context.beginPath();
  context.roundRect(-14, 12, 28, 22, [6, 6, 2, 2]);
  context.fill();
  context.lineWidth = 2.5;
  context.strokeStyle = '#2b2b2b';
  context.stroke();

  // Kepala Besar (Bean-Head)
  context.fillStyle = p.skinColor || '#f5d0b1';
  context.beginPath();
  context.arc(0, -4, 22, 0, Math.PI * 2);
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = '#2b2b2b';
  context.stroke();

  // Ekspresi Wajah
  context.fillStyle = '#2b2b2b';
  if (p.expression === 'senyum') {
    context.beginPath();
    context.arc(-6, -6, 2.5, 0, Math.PI * 2);
    context.arc(6, -6, 2.5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(0, -2, 6, 0, Math.PI);
    context.stroke();
  } else if (p.expression === 'semangat') {
    context.fillRect(-8, -8, 4, 4);
    context.fillRect(4, -8, 4, 4);
    context.beginPath();
    context.arc(0, 0, 5, 0, Math.PI * 2);
    context.fill();
  } else { // tenang
    context.fillRect(-8, -7, 5, 2);
    context.fillRect(3, -7, 5, 2);
    context.beginPath();
    context.moveTo(-4, 2);
    context.lineTo(4, 2);
    context.stroke();
  }

  // Topi
  if (p.hat === 'peci') {
    context.fillStyle = '#111';
    context.beginPath();
    context.roundRect(-16, -30, 32, 12, [6, 6, 2, 2]);
    context.fill();
    context.stroke();
  } else if (p.hat === 'caping') {
    context.fillStyle = '#d4a373';
    context.beginPath();
    context.moveTo(0, -38);
    context.lineTo(-24, -22);
    context.lineTo(24, -22);
    context.closePath();
    context.fill();
    context.stroke();
  } else if (p.hat === 'cepol') {
    context.fillStyle = '#4a3525';
    context.beginPath();
    context.arc(0, -26, 8, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else if (p.hat === 'anak') {
    context.fillStyle = '#e63946';
    context.beginPath();
    context.arc(0, -24, 16, Math.PI, 0, false);
    context.fill();
    context.stroke();
    context.fillRect(4, -26, 14, 5);
  }

  context.restore();
}

// Pratinjau Karakter di Layar Masuk
function updatePreview() {
  prevCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  drawBeanHead(prevCtx, 50, 65, {
    skinColor: inputSkin.value,
    shirtColor: inputShirt.value,
    hat: selectHat.value,
    expression: selectExpression.value
  }, 1.1);
}

[selectHat, inputSkin, inputShirt, selectExpression].forEach(el => {
  el.addEventListener('input', updatePreview);
});
updatePreview();

// --- MASUK KE PERMAINAN ---
btnEnter.addEventListener('click', () => {
  const name = playerNameInput.value.trim() || 'Warga';
  loginScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');

  resizeCanvas();

  socket.emit('join-game', {
    name: name,
    skinColor: inputSkin.value,
    hat: selectHat.value,
    shirtColor: inputShirt.value,
    expression: selectExpression.value
  });

  requestAnimationFrame(gameLoop);
});

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

// --- SOCKET LISTENERS ---
socket.on('init-world', (data) => {
  myId = data.id;
  worldData = data.world;
  document.getElementById('stat-rumah').innerText = worldData.rumahCount || 0;
});

socket.on('update-players', (serverPlayers) => {
  players = serverPlayers;
  document.getElementById('stat-online').innerText = Object.keys(players).length;
});

socket.on('player-moved', (data) => {
  if (players[data.id]) {
    players[data.id].targetX = data.x;
    players[data.id].targetY = data.y;
    players[data.id].dir = data.dir;
    players[data.id].moving = data.moving;
  }
});

socket.on('remove-player', (id) => {
  delete players[id];
  document.getElementById('stat-online').innerText = Object.keys(players).length;
});

// --- KONTROL KEYBOARD ---
window.addEventListener('keydown', (e) => {
  if (keys.hasOwnProperty(e.key) || keys.hasOwnProperty(e.code)) {
    keys[e.key] = true;
    keys[e.code] = true;
  }
});

window.addEventListener('keyup', (e) => {
  if (keys.hasOwnProperty(e.key) || keys.hasOwnProperty(e.code)) {
    keys[e.key] = false;
    keys[e.code] = false;
  }
});

// --- JOYSTICK VIRTUAL MOBILE ---
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');
let joystickCenter = { x: 0, y: 0 };

joystickBase.addEventListener('touchstart', (e) => {
  const rect = joystickBase.getBoundingClientRect();
  joystickCenter.x = rect.left + rect.width / 2;
  joystickCenter.y = rect.top + rect.height / 2;
  joystickMove.active = true;
});

window.addEventListener('touchmove', (e) => {
  if (!joystickMove.active) return;
  const touch = e.touches[0];
  let dx = touch.clientX - joystickCenter.x;
  let dy = touch.clientY - joystickCenter.y;
  let dist = Math.sqrt(dx * dx + dy * dy);
  let maxDist = 40;

  if (dist > maxDist) {
    dx = (dx / dist) * maxDist;
    dy = (dy / dist) * maxDist;
  }

  joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
  joystickMove.x = dx / maxDist;
  joystickMove.y = dy / maxDist;
});

window.addEventListener('touchend', () => {
  if (joystickMove.active) {
    joystickMove.active = false;
    joystickMove.x = 0;
    joystickMove.y = 0;
    joystickStick.style.transform = `translate(0px, 0px)`;
  }
});

// --- GAME LOOP & RENDER ---
function gameLoop() {
  // Update posisi pemain lokal
  let vx = 0;
  let vy = 0;

  if (keys['w'] || keys['W'] || keys['ArrowUp'] || keys['KeyW']) vy -= 1;
  if (keys['s'] || keys['S'] || keys['ArrowDown'] || keys['KeyS']) vy += 1;
  if (keys['a'] || keys['A'] || keys['ArrowLeft'] || keys['KeyA']) vx -= 1;
  if (keys['d'] || keys['D'] || keys['ArrowRight'] || keys['KeyD']) vx += 1;

  if (joystickMove.active) {
    vx = joystickMove.x;
    vy = joystickMove.y;
  }

  myPlayer.moving = (vx !== 0 || vy !== 0);

  if (myPlayer.moving) {
    let len = Math.sqrt(vx * vx + vy * vy);
    vx /= len;
    vy /= len;

    myPlayer.x += vx * myPlayer.speed;
    myPlayer.y += vy * myPlayer.speed;

    if (Math.abs(vx) > Math.abs(vy)) {
      myPlayer.dir = vx > 0 ? 'right' : 'left';
    } else {
      myPlayer.dir = vy > 0 ? 'down' : 'up';
    }

    // Kirim posisi ke server
    socket.emit('player-move', {
      x: myPlayer.x,
      y: myPlayer.y,
      dir: myPlayer.dir,
      moving: myPlayer.moving
    });
  }

  if (players[myId]) {
    players[myId].x = myPlayer.x;
    players[myId].y = myPlayer.y;
  }

  // --- RENDER KANVAS ---
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Kamera mengikuti pemain lokal
  let cameraX = canvas.width / 2 - myPlayer.x;
  let cameraY = canvas.height / 2 - myPlayer.y;

  ctx.save();
  ctx.translate(cameraX, cameraY);

  // Gambar Latar Belakang Desa (Rumput & Alun-alun)
  ctx.fillStyle = '#7EC850';
  ctx.fillRect(-1000, -1000, 3000, 3000);

  // Garis Petak Alun-alun / Jalan
  ctx.strokeStyle = '#6ab04c';
  ctx.lineWidth = 4;
  ctx.strokeRect(-500, -500, 2000, 2000);

  // Alun-alun Tengah (Kas Desa / Gudang)
  ctx.fillStyle = '#d2b48c';
  ctx.fillRect(-80, -80, 160, 160);
  ctx.strokeStyle = '#8b5a2b';
  ctx.lineWidth = 4;
  ctx.strokeRect(-80, -80, 160, 160);
  ctx.fillStyle = '#5c4033';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏛️ KAS DESA', 0, -10);

  // Render Semua Pemain (dengan interpolasi posisi pemain lain)
  for (let id in players) {
    let p = players[id];
    if (id !== myId && p.targetX !== undefined) {
      p.x += (p.targetX - p.x) * 0.2;
      p.y += (p.targetY - p.y) * 0.2;
    }

    if (p.x !== undefined && p.y !== undefined) {
      drawBeanHead(ctx, p.x, p.y, p);

      // Tampilkan Nama di Atas Kepala
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText(p.name, p.x, p.y - 42);
      ctx.fillText(p.name, p.x, p.y - 42);
    }
  }

  ctx.restore();

  requestAnimationFrame(gameLoop);
}