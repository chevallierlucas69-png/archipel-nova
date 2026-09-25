const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const port = Number(process.argv[2]) || 8765;
const dataDirectory = path.join(root, '.nova-data');
const usersFile = path.join(dataDirectory, 'users.json');
const sessionsFile = path.join(dataDirectory, 'sessions.json');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'
};
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
};

fs.mkdirSync(dataDirectory, { recursive: true });
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]', 'utf8');
if (!fs.existsSync(sessionsFile)) fs.writeFileSync(sessionsFile, '[]', 'utf8');
function readArray(file) {
  try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
const sessions = new Map(readArray(sessionsFile).filter(entry => Array.isArray(entry) && entry[1]?.expiresAt > Date.now()));
const sockets = new Map();
const queues = new Map([['solo', []], ['creative', []], ['box', []]]);
const matches = new Map();
const lobbies = new Map();

function saveSessions() {
  const temporary = `${sessionsFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify([...sessions]), 'utf8');
  fs.renameSync(temporary, sessionsFile);
}

function readUsers() {
  try { return JSON.parse(fs.readFileSync(usersFile, 'utf8')); } catch { return []; }
}

function saveUsers(users) {
  const temporary = `${usersFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(users, null, 2), 'utf8');
  fs.renameSync(temporary, usersFile);
}

function json(response, status, payload, headers = {}) {
  response.writeHead(status, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;
    request.on('data', chunk => {
      if (tooLarge) return;
      body += chunk;
      if (body.length > 16_384) tooLarge = true;
      if (body.length > 16_384) { const error = new Error('Requête trop volumineuse'); error.statusCode = 413; reject(error); }
    });
    request.on('end', () => {
      if (tooLarge) return;
      try { resolve(JSON.parse(body || '{}')); } catch { const error = new Error('Données invalides'); error.statusCode = 400; reject(error); }
    });
    request.on('error', reject);
  });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function safeEqual(left, right) {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getToken(request) {
  const match = (request.headers.cookie || '').match(/(?:^|;\s*)nova_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function currentUser(request) {
  const token = getToken(request);
  const session = token && sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) { sessions.delete(token); saveSessions(); }
    return null;
  }
  return readUsers().find(user => user.id === session.userId) || null;
}

function publicUser(user) {
  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

function publicLobby(lobby) {
  return {
    id: lobby.id, name: lobby.name, ownerId: lobby.ownerId, mode: lobby.mode,
    members: lobby.members.map(member => ({ id: member.id, username: member.username })),
    createdAt: lobby.createdAt
  };
}

function sendSocket(socket, payload) {
  if (socket.destroyed) return;
  const body = Buffer.from(JSON.stringify(payload));
  let header;
  if (body.length < 126) header = Buffer.from([0x81, body.length]);
  else {
    header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126;
    header.writeUInt16BE(body.length, 2);
  }
  socket.write(Buffer.concat([header, body]));
}

function broadcast(payload, predicate = () => true) {
  for (const [socket, client] of sockets) if (predicate(client)) sendSocket(socket, payload);
}

function presence() {
  const users = [...new Map([...sockets.values()].map(client => [client.user.id, publicUser(client.user)])).values()];
  broadcast({ type: 'presence', users, online: users.length });
}

function removeFromQueues(userId) {
  for (const [mode, entries] of queues) queues.set(mode, entries.filter(entry => entry.user.id !== userId));
}

function startQueuedMatch(mode) {
  const entries = queues.get(mode) || [];
  if (!entries.length) return;
  queues.set(mode, []);
  const match = {
    id: crypto.randomUUID(), mode,
    players: entries.map(entry => publicUser(entry.user)),
    server: { host: '127.0.0.1', port },
    createdAt: new Date().toISOString()
  };
  matches.set(match.id, match);
  for (const entry of entries) {
    for (const [socket, client] of sockets) {
      if (client.user.id === entry.user.id) sendSocket(socket, { type: 'match.found', match });
    }
  }
  setTimeout(() => matches.delete(match.id), 2 * 60 * 60 * 1000).unref();
}

function queuePlayer(user, mode) {
  removeFromQueues(user.id);
  const entries = queues.get(mode);
  entries.push({ user, joinedAt: Date.now() });
  broadcast({ type: 'queue.updated', mode, players: entries.length });
  if (entries.length >= 2) startQueuedMatch(mode);
  else setTimeout(() => {
    if ((queues.get(mode) || []).some(entry => entry.user.id === user.id)) startQueuedMatch(mode);
  }, 2500).unref();
}

function createSession(user, response) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  saveSessions();
  return { 'Set-Cookie': `nova_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800` };
}

async function handleApi(request, response, pathname) {
  if (pathname === '/api/account' && request.method === 'GET') {
    const user = currentUser(request);
    json(response, 200, { user: user ? publicUser(user) : null });
    return true;
  }
  if (pathname === '/api/register' && request.method === 'POST') {
    const { username = '', password = '' } = await readBody(request);
    const cleanName = String(username).trim();
    if (!/^[a-zA-Z0-9_-]{3,16}$/.test(cleanName)) return json(response, 400, { error: 'Le pseudo doit contenir 3 à 16 lettres, chiffres, _ ou -.' }) || true;
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) return json(response, 400, { error: 'Le mot de passe doit contenir entre 8 et 72 caractères.' }) || true;
    const users = readUsers();
    if (users.some(user => user.username.toLowerCase() === cleanName.toLowerCase())) return json(response, 409, { error: 'Ce pseudo est déjà utilisé.' }) || true;
    const credentials = hashPassword(password);
    const user = { id: crypto.randomUUID(), username: cleanName, ...credentials, createdAt: new Date().toISOString() };
    users.push(user); saveUsers(users);
    json(response, 201, { user: publicUser(user) }, createSession(user, response));
    return true;
  }
  if (pathname === '/api/login' && request.method === 'POST') {
    const { username = '', password = '' } = await readBody(request);
    const user = readUsers().find(item => item.username.toLowerCase() === String(username).trim().toLowerCase());
    const credentials = user && hashPassword(String(password), user.salt);
    if (!user || !safeEqual(credentials.hash, user.hash)) { json(response, 401, { error: 'Pseudo ou mot de passe incorrect.' }); return true; }
    json(response, 200, { user: publicUser(user) }, createSession(user, response));
    return true;
  }
  if (pathname === '/api/logout' && request.method === 'POST') {
    const token = getToken(request); if (token) { sessions.delete(token); saveSessions(); }
    json(response, 200, { ok: true }, { 'Set-Cookie': 'nova_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    return true;
  }
  if (pathname === '/api/status' && request.method === 'GET') {
    json(response, 200, {
      service: 'Nova Online', version: 1, online: new Set([...sockets.values()].map(client => client.user.id)).size,
      queues: Object.fromEntries([...queues].map(([mode, entries]) => [mode, entries.length])),
      matches: matches.size
    });
    return true;
  }
  if (pathname === '/api/lobbies' && request.method === 'GET') {
    json(response, 200, { lobbies: [...lobbies.values()].map(publicLobby) });
    return true;
  }
  if (pathname === '/api/lobbies' && request.method === 'POST') {
    const user = currentUser(request);
    if (!user) { json(response, 401, { error: 'Connexion Nova requise.' }); return true; }
    const body = await readBody(request);
    const mode = ['solo', 'creative', 'box'].includes(body.mode) ? body.mode : 'solo';
    const name = String(body.name || `Salon de ${user.username}`).trim().slice(0, 32);
    const lobby = { id: crypto.randomUUID(), name, ownerId: user.id, mode, members: [publicUser(user)], createdAt: new Date().toISOString() };
    lobbies.set(lobby.id, lobby);
    broadcast({ type: 'lobby.created', lobby: publicLobby(lobby) });
    json(response, 201, { lobby: publicLobby(lobby) });
    return true;
  }
  const lobbyJoin = pathname.match(/^\/api\/lobbies\/([a-f0-9-]+)\/join$/);
  if (lobbyJoin && request.method === 'POST') {
    const user = currentUser(request);
    const lobby = lobbies.get(lobbyJoin[1]);
    if (!user) { json(response, 401, { error: 'Connexion Nova requise.' }); return true; }
    if (!lobby) { json(response, 404, { error: 'Salon introuvable.' }); return true; }
    if (!lobby.members.some(member => member.id === user.id)) lobby.members.push(publicUser(user));
    broadcast({ type: 'lobby.updated', lobby: publicLobby(lobby) });
    json(response, 200, { lobby: publicLobby(lobby) });
    return true;
  }
  if (pathname === '/api/matchmaking/join' && request.method === 'POST') {
    const user = currentUser(request);
    if (!user) { json(response, 401, { error: 'Connexion Nova requise.' }); return true; }
    const body = await readBody(request);
    const mode = ['solo', 'creative', 'box'].includes(body.mode) ? body.mode : 'solo';
    queuePlayer(user, mode);
    json(response, 202, { status: 'queued', mode, players: queues.get(mode).length });
    return true;
  }
  if (pathname === '/api/matchmaking/leave' && request.method === 'POST') {
    const user = currentUser(request);
    if (user) removeFromQueues(user.id);
    json(response, 200, { ok: true });
    return true;
  }
  return false;
}

const server = http.createServer(async (request, response) => {
  try {
    for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);
    const pathname = decodeURIComponent(request.url.split('?')[0]);
    if (pathname.startsWith('/api/')) {
      if (!await handleApi(request, response, pathname)) json(response, 404, { error: 'Route introuvable.' });
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8', 'Allow': 'GET, HEAD' });
      response.end('Methode non autorisee'); return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(root, relative);
    const containsPrivateSegment = relative.split(/[\\/]/).some(segment => segment.startsWith('.'));
    if (containsPrivateSegment) { response.writeHead(403, securityHeaders).end('Acces refuse'); return; }
    if (!file.startsWith(root + path.sep) || file.startsWith(dataDirectory + path.sep)) { response.writeHead(403).end('Accès refusé'); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Fichier introuvable'); return; }
      response.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(data);
    });
  } catch (error) {
    json(response, error.statusCode || 500, { error: error.message || 'Erreur interne.' });
  }
});

server.on('upgrade', (request, socket) => {
  if (request.url !== '/ws') { socket.destroy(); return; }
  const user = currentUser(request);
  const key = request.headers['sec-websocket-key'];
  if (!user || !key) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy(); return;
  }
  const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  sockets.set(socket, { user });
  sendSocket(socket, { type: 'hello', user: publicUser(user), protocol: 1 });
  presence();
  socket.on('data', buffer => {
    try {
      const length = buffer[1] & 0x7f;
      if ((buffer[0] & 0x0f) === 8) return socket.end();
      const offset = length === 126 ? 4 : 2;
      const payloadLength = length === 126 ? buffer.readUInt16BE(2) : length;
      const mask = buffer.subarray(offset, offset + 4);
      const payload = buffer.subarray(offset + 4, offset + 4 + payloadLength);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      const message = JSON.parse(payload.toString('utf8'));
      if (message.type === 'ping') sendSocket(socket, { type: 'pong', at: Date.now() });
    } catch { sendSocket(socket, { type: 'error', error: 'Message WebSocket invalide.' }); }
  });
  socket.on('close', () => { sockets.delete(socket); removeFromQueues(user.id); presence(); });
  socket.on('error', () => { sockets.delete(socket); removeFromQueues(user.id); });
});

// Listen on every interface so the same server works locally and on a host
// such as Render. The hosting platform supplies PORT in production.
server.listen(port, '0.0.0.0', () => console.log(`Serveur Nova Online actif sur http://localhost:${port}`));
