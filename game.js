const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const message = document.querySelector('#message');
const keys = new Set();
const mouse = { x: 480, y: 300, down: false };
let state;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function reset() {
  state = {
    running: true, time: 0, lastShot: 0, score: 0,
    player: { x: 480, y: 300, r: 14, speed: 220, health: 100, shield: 50 },
    bullets: [], pickups: [], enemies: [],
    storm: { x: 480, y: 300, radius: 430, minRadius: 105 }
  };
  for (let i = 0; i < 9; i++) spawnEnemy();
  for (let i = 0; i < 7; i++) spawnPickup();
  message.classList.add('hidden');
}

function randomPoint(margin = 35) {
  return { x: margin + Math.random() * (canvas.width - margin * 2), y: margin + Math.random() * (canvas.height - margin * 2) };
}
function spawnEnemy() {
  let p;
  do p = randomPoint(); while (state?.player && distance(p, state.player) < 180);
  state.enemies.push({ ...p, r: 13, health: 60, speed: 52 + Math.random() * 28, hitCooldown: 0 });
}
function spawnPickup() {
  const p = randomPoint();
  state.pickups.push({ ...p, r: 9, kind: Math.random() < .5 ? 'shield' : 'health' });
}

function shoot() {
  if (state.time - state.lastShot < .16) return;
  state.lastShot = state.time;
  const p = state.player;
  const angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  state.bullets.push({ x: p.x, y: p.y, vx: Math.cos(angle) * 580, vy: Math.sin(angle) * 580, r: 4, life: 1.25 });
}

function damagePlayer(amount) {
  const p = state.player;
  const blocked = Math.min(p.shield, amount);
  p.shield -= blocked;
  p.health -= amount - blocked;
  if (p.health <= 0) endGame(false);
}
function endGame(won) {
  state.running = false;
  message.textContent = `${won ? 'VICTOIRE !' : 'ÉLIMINÉ'}\n${state.score} élimination${state.score > 1 ? 's' : ''}`;
  message.classList.remove('hidden');
}

function update(dt) {
  if (!state.running) return;
  state.time += dt;
  const p = state.player;
  let dx = 0, dy = 0;
  if (keys.has('w') || keys.has('z') || keys.has('arrowup')) dy--;
  if (keys.has('s') || keys.has('arrowdown')) dy++;
  if (keys.has('a') || keys.has('q') || keys.has('arrowleft')) dx--;
  if (keys.has('d') || keys.has('arrowright')) dx++;
  const length = Math.hypot(dx, dy) || 1;
  p.x = clamp(p.x + dx / length * p.speed * dt, p.r, canvas.width - p.r);
  p.y = clamp(p.y + dy / length * p.speed * dt, p.r, canvas.height - p.r);
  if (mouse.down) shoot();

  state.storm.radius = Math.max(state.storm.minRadius, 430 - state.time * 5.2);
  if (distance(p, state.storm) > state.storm.radius) damagePlayer(13 * dt);

  for (const b of state.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
  for (const e of state.enemies) {
    const angle = Math.atan2(p.y - e.y, p.x - e.x);
    e.x += Math.cos(angle) * e.speed * dt; e.y += Math.sin(angle) * e.speed * dt;
    e.hitCooldown -= dt;
    if (distance(e, p) < e.r + p.r + 2 && e.hitCooldown <= 0) { damagePlayer(12); e.hitCooldown = .75; }
  }
  for (const b of state.bullets) for (const e of state.enemies) {
    if (b.life > 0 && e.health > 0 && distance(b, e) < b.r + e.r) { e.health -= 30; b.life = 0; }
  }
  const defeated = state.enemies.filter(e => e.health <= 0).length;
  state.score += defeated;
  state.enemies = state.enemies.filter(e => e.health > 0);
  state.bullets = state.bullets.filter(b => b.life > 0 && b.x > 0 && b.x < canvas.width && b.y > 0 && b.y < canvas.height);
  state.pickups = state.pickups.filter(item => {
    if (distance(item, p) >= item.r + p.r) return true;
    if (item.kind === 'health') p.health = Math.min(100, p.health + 30);
    else p.shield = Math.min(100, p.shield + 25);
    return false;
  });
  if (!state.enemies.length) endGame(true);
}

function circle(x, y, r, color) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
function bar(x, y, width, value, color) { ctx.fillStyle = '#07131dcc'; ctx.fillRect(x, y, width, 13); ctx.fillStyle = color; ctx.fillRect(x, y, width * clamp(value / 100, 0, 1), 13); }
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#315b42'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#ffffff0d'; ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = 0; y < canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

  const s = state.storm;
  ctx.save(); ctx.fillStyle = '#7137ba66'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalCompositeOperation = 'destination-out'; circle(s.x, s.y, s.radius, '#000'); ctx.restore();
  ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.strokeStyle = '#c08aff'; ctx.lineWidth = 4; ctx.stroke();
  for (const item of state.pickups) circle(item.x, item.y, item.r, item.kind === 'health' ? '#5bf282' : '#56d9ff');
  for (const b of state.bullets) circle(b.x, b.y, b.r, '#ffe066');
  for (const e of state.enemies) { circle(e.x, e.y, e.r, '#ff586d'); bar(e.x - 14, e.y - 22, 28, e.health / .6, '#ff586d'); }
  const p = state.player;
  circle(p.x, p.y, p.r + 4, '#ffffff33'); circle(p.x, p.y, p.r, '#46c9ff');
  const angle = Math.atan2(mouse.y - p.y, mouse.x - p.x); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(angle) * 23, p.y + Math.sin(angle) * 23); ctx.stroke();
  bar(20, 20, 190, p.health, '#5bf282'); bar(20, 39, 190, p.shield, '#56d9ff');
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui'; ctx.fillText(`PV ${Math.ceil(p.health)}  •  Bouclier ${Math.ceil(p.shield)}`, 20, 72); ctx.fillText(`Ennemis : ${state.enemies.length}  •  Éliminations : ${state.score}`, 20, 96);
  ctx.textAlign = 'right'; ctx.fillText(`Zone : ${Math.ceil(s.radius)} m`, canvas.width - 20, 30); ctx.textAlign = 'left';
}

addEventListener('keydown', e => { keys.add(e.key.toLowerCase()); if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault(); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); mouse.x = (e.clientX-r.left)*canvas.width/r.width; mouse.y = (e.clientY-r.top)*canvas.height/r.height; });
canvas.addEventListener('mousedown', () => mouse.down = true);
addEventListener('mouseup', () => mouse.down = false);
document.querySelector('#restart').addEventListener('click', reset);

reset();
let last = performance.now();
function loop(now) { const dt = Math.min((now - last) / 1000, .033); last = now; update(dt); draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
