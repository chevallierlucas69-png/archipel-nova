import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cdpPort=Number(process.argv[2]??9223),appPort=Number(process.argv[3]??8765);
const viewportWidth=Number(process.argv[4]??1600),viewportHeight=Number(process.argv[5]??900);
const targets = await fetch(`http://127.0.0.1:${cdpPort}/json`).then(response => response.json());
const page = targets.find(target => target.type === 'page' && target.url.includes(`127.0.0.1:${appPort}`));
if (!page) throw new Error(`Page Archipel Nova introuvable sur le port CDP ${cdpPort}.`);

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const runtimeErrors = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    runtimeErrors.push(message.params.args.map(argument => argument.value ?? argument.description).join(' '));
  }
  if (message.method === 'Log.entryAdded' && ['error','warning'].includes(message.params.entry.level)) runtimeErrors.push(message.params.entry.text);
});

function rpc(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function clickSelector(selector) {
  const location = await rpc('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const element=document.querySelector(${JSON.stringify(selector)});
      if(!element) return null;
      const rect=element.getBoundingClientRect();
      return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,visible:rect.width>0&&rect.height>0};
    })()`
  });
  const point = location.result.value;
  if (!point?.visible) throw new Error(`Element non cliquable : ${selector}`);
  await rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await rpc('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

await rpc('Runtime.enable');
await rpc('Page.enable');
await rpc('Network.enable');
await rpc('Log.enable');
await rpc('Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: viewportHeight, deviceScaleFactor: 1, mobile: false });

const sessions = JSON.parse(fs.readFileSync(path.join(root, '.nova-data', 'sessions.json'), 'utf8'));
const validSession = sessions.find(([, session]) => session.expiresAt > Date.now());
if (validSession) {
  await rpc('Network.setCookie', { name: 'nova_session', value: validSession[0], url: `http://127.0.0.1:${appPort}`, httpOnly: true, sameSite: 'Strict' });
}

await rpc('Page.reload', { ignoreCache: true });
await new Promise(resolve => setTimeout(resolve, 3500));

const evaluation = await rpc('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => {
    const lobby = document.querySelector('#lobby');
    const shop = document.querySelector('#shop');
    return {
      title: document.title,
      accountHidden: document.querySelector('#account-screen').classList.contains('hidden'),
      lobbyHidden: lobby.classList.contains('hidden'),
      shopHidden: shop.classList.contains('hidden'),
      lobbyCharacterRemoved: !document.querySelector('.realistic-avatar') && !document.querySelector('.stage-avatar') && !document.querySelector('.lobby-stage'),
      lobbyBackground: getComputedStyle(lobby).backgroundImage,
      activeLobbyTab: document.querySelector('.nav-tabs .nav-active').textContent.trim(),
      navShopBackgroundImage: getComputedStyle(document.querySelector('#nav-shop')).backgroundImage,
      canvasCount: document.querySelectorAll('canvas').length,
      shopCards: document.querySelectorAll('.shop-item').length,
      worldFingerprint: document.documentElement.dataset.worldFingerprint,
      bodyOverflow: getComputedStyle(document.body).overflow,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }
    };
  })()`
});

fs.mkdirSync(path.join(root, '.audit'), { recursive: true });
const screenshot = await rpc('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
fs.writeFileSync(path.join(root, '.audit', 'lobby.png'), Buffer.from(screenshot.data, 'base64'));

await clickSelector('#nav-shop');
await new Promise(resolve => setTimeout(resolve, 700));
const shopEvaluation = await rpc('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => ({
    visible: !document.querySelector('#shop').classList.contains('hidden'),
    panel: document.querySelector('.shop-panel').getBoundingClientRect().toJSON(),
    cards: [...document.querySelectorAll('.shop-item')].map(card => card.getBoundingClientRect().toJSON()),
    scrollHeight: document.querySelector('.shop-panel').scrollHeight,
    clientHeight: document.querySelector('.shop-panel').clientHeight,
    documentScrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: [...document.querySelectorAll('body *')].map(element => ({ element, rect: element.getBoundingClientRect() })).filter(item => item.rect.right > innerWidth + 1 || item.rect.left < -1).slice(0, 12).map(item => ({ tag: item.element.tagName, className: item.element.className, left: item.rect.left, right: item.rect.right, width: item.rect.width }))
  }))()`
});
const shopScreenshot = await rpc('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
fs.writeFileSync(path.join(root, '.audit', 'shop.png'), Buffer.from(shopScreenshot.data, 'base64'));

await clickSelector('#shop-close-icon');
await clickSelector('#play');
await new Promise(resolve => setTimeout(resolve, 2800));
const gameEvaluation = await rpc('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => ({
    playing: document.body.classList.contains('playing'),
    lobbyHidden: document.querySelector('#lobby').classList.contains('hidden'),
    matchHudVisible: getComputedStyle(document.querySelector('#combat-hud')).display !== 'none',
    minimapVisible: getComputedStyle(document.querySelector('.minimap')).display !== 'none',
    fps: document.querySelector('#fps-counter').textContent,
    enemyCount: document.querySelector('#enemy-count').textContent,
    dropPrompt: document.querySelector('#drop-prompt').textContent,
    diagnostics: window.__novaDiagnostics(),
    canvas: document.querySelector('#game canvas').getBoundingClientRect().toJSON()
  }))()`
});
const gameScreenshot = await rpc('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
fs.writeFileSync(path.join(root, '.audit', 'game.png'), Buffer.from(gameScreenshot.data, 'base64'));

await rpc('Runtime.evaluate', {
  expression: `document.querySelector('#leave-game').click();document.querySelector('#play').click()`
});
await new Promise(resolve => setTimeout(resolve, 2200));
const replayEvaluation = await rpc('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => ({
    playing: document.body.classList.contains('playing'),
    lobbyHidden: document.querySelector('#lobby').classList.contains('hidden'),
    enemyCount: document.querySelector('#enemy-count').textContent,
    reloadHidden: document.querySelector('#reload-bar').classList.contains('hidden'),
    pauseHidden: document.querySelector('#pause-menu').classList.contains('hidden'),
    diagnostics: window.__novaDiagnostics()
  }))()`
});

// Une partie créative démarre directement au sol : elle sert d'audit visuel de la carte.
await rpc('Runtime.evaluate', {
  expression: `document.querySelector('#leave-game').click();document.querySelector('#mode').selectedIndex=1;document.querySelector('#play').click()`
});
await new Promise(resolve => setTimeout(resolve, 1800));
const groundEvaluation = await rpc('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => {
    const inventory=document.querySelector('#inventory').getBoundingClientRect();
    const buildHelp=document.querySelector('.build-help').getBoundingClientRect();
    const buildStatus=document.querySelector('#build-status').getBoundingClientRect();
    const minimap=document.querySelector('.minimap').getBoundingClientRect();
    const safeZone=document.querySelector('.hud>span:nth-child(2)').getBoundingClientRect();
    const seasonHud=document.querySelector('.season-hud').getBoundingClientRect();
    const compass=document.querySelector('.compass').getBoundingClientRect();
    const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    return {
      playing: document.body.classList.contains('playing'),
      lobbyHidden: document.querySelector('#lobby').classList.contains('hidden'),
      enemyCount: document.querySelector('#enemy-count').textContent,
      location: document.querySelector('#location').textContent,
      dropStatsHidden: document.querySelector('#drop-stats').classList.contains('hidden') && getComputedStyle(document.querySelector('#drop-stats')).display === 'none',
      inventoryBuildHelpOverlap: overlaps(inventory,buildHelp),
      buildStatusMinimapOverlap: overlaps(buildStatus,minimap),
      safeZoneSeasonOverlap: overlaps(safeZone,seasonHud),
      safeZoneCompassOverlap: overlaps(safeZone,compass),
      creativeMode: document.body.classList.contains('creative-mode'),
      arenaScoreVisible: getComputedStyle(document.querySelector('#arena-score')).display !== 'none',
      arenaBuildsVisible: getComputedStyle(document.querySelector('#arena-builds')).display !== 'none',
      arenaGoal: document.querySelector('#arena-goal-value').textContent,
      inventory: inventory.toJSON(),
      buildHelp: buildHelp.toJSON(),
      diagnostics: window.__novaDiagnostics()
    };
  })()`
});
const groundScreenshot = await rpc('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
fs.writeFileSync(path.join(root, '.audit', 'map-ground.png'), Buffer.from(groundScreenshot.data, 'base64'));

// La Box PVP est un troisième mode distinct, avec ennemis et objectif d'éliminations.
await rpc('Runtime.evaluate', {
  expression: `document.querySelector('#leave-game').click();document.querySelector('#mode').selectedIndex=2;document.querySelector('#play').click()`
});
await new Promise(resolve => setTimeout(resolve, 1800));
const boxEvaluation = await rpc('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => ({
    playing: document.body.classList.contains('playing'),
    boxMode: document.body.classList.contains('box-pvp-mode'),
    arenaHudVisible: getComputedStyle(document.querySelector('#arena-score')).display !== 'none',
    buildSelectorVisible: getComputedStyle(document.querySelector('#arena-builds')).display !== 'none',
    enemyCount: document.querySelector('#enemy-count').textContent,
    goal: document.querySelector('#arena-goal-value').textContent,
    teamLabel: document.querySelector('#arena-team-label').textContent,
    rivalLabel: document.querySelector('#arena-rival-label').textContent,
    diagnostics: window.__novaDiagnostics()
  }))()`
});
const boxScreenshot = await rpc('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
fs.writeFileSync(path.join(root, '.audit', 'box-pvp.png'), Buffer.from(boxScreenshot.data, 'base64'));

const expectedHeadlessErrors=['THREE.PointerLockControls: Unable to use Pointer Lock API','Uncaught (in promise)','Failed to load resource: net::ERR_NETWORK_IO_SUSPENDED'];
const unexpectedErrors=runtimeErrors.filter(error=>!expectedHeadlessErrors.includes(error)&&!error.startsWith('The AudioContext was not allowed to start.'));
const report={...evaluation.result.value,shop:shopEvaluation.result.value,game:gameEvaluation.result.value,replay:replayEvaluation.result.value,ground:groundEvaluation.result.value,box:boxEvaluation.result.value,runtimeErrors,unexpectedErrors};
const replayResourcesStable=report.replay.diagnostics.geometries===report.game.diagnostics.geometries&&report.replay.diagnostics.textures===report.game.diagnostics.textures;
report.passed=report.accountHidden&&report.lobbyCharacterRemoved&&report.activeLobbyTab.includes('JOUER')&&report.navShopBackgroundImage==='none'&&report.shop.visible&&report.shop.cards.length===12&&report.shop.horizontalOverflow.length===0&&report.game.playing&&report.game.matchHudVisible&&report.game.diagnostics.invalidEnemyPositions===0&&report.game.diagnostics.citadelBlocksShots&&report.replay.playing&&report.replay.lobbyHidden&&report.replay.enemyCount==='16'&&report.replay.diagnostics.enemies===16&&report.replay.diagnostics.invalidEnemyPositions===0&&report.replay.diagnostics.citadelBlocksShots&&report.replay.diagnostics.builds===0&&report.replay.reloadHidden&&report.replay.pauseHidden&&replayResourcesStable&&report.ground.playing&&report.ground.lobbyHidden&&report.ground.enemyCount==='0'&&report.ground.creativeMode&&report.ground.arenaScoreVisible&&report.ground.arenaBuildsVisible&&report.ground.arenaGoal==='0'&&!report.ground.inventoryBuildHelpOverlap&&!report.ground.buildStatusMinimapOverlap&&!report.ground.safeZoneSeasonOverlap&&!report.ground.safeZoneCompassOverlap&&report.ground.diagnostics.enemies===0&&report.ground.diagnostics.builds===0&&report.ground.dropStatsHidden&&report.box.playing&&report.box.boxMode&&report.box.arenaHudVisible&&report.box.buildSelectorVisible&&report.box.enemyCount==='5'&&report.box.goal==='0'&&report.box.teamLabel==='ÉLIMINATIONS'&&report.box.rivalLabel==='MORTS'&&report.box.diagnostics.mode==='box'&&report.box.diagnostics.arenaVisible&&report.box.diagnostics.enemies===5&&report.box.diagnostics.invalidEnemyPositions===0&&unexpectedErrors.length===0;
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
socket.close();
