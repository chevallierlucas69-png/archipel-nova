import * as THREE from 'three';
import { PointerLockControls } from './vendor/PointerLockControls.js';

const host = document.querySelector('#game');
const overlay = document.querySelector('#message');
const lobby = document.querySelector('#lobby');
const playButton = document.querySelector('#play');
const shop = document.querySelector('#shop');
const creditsLabel = document.querySelector('#credits');
const shopItems = document.querySelector('#shop-items');
const settingsPanel = document.querySelector('#settings');
const buildHelp = document.querySelector('.build-help');
const locationLabel = document.querySelector('#location');
const zoneLabel = document.querySelector('#zone');
const buildStatus = document.querySelector('#build-status');
const healthFill = document.querySelector('#health-fill');
const shieldFill = document.querySelector('#shield-fill');
const notice = document.querySelector('#notice');
const accountScreen = document.querySelector('#account-screen');
const authView = document.querySelector('#auth-view');
const profileView = document.querySelector('#profile-view');
const authForm = document.querySelector('#auth-form');
let authMode = 'login';
let novaUser = null;
let novaSocket = null;
let matchmaking = false;
const onlineStatus = document.querySelector('#online-status');

function selectedOnlineMode() {
  return ['solo', 'creative', 'box'][document.querySelector('#mode').selectedIndex] ?? 'solo';
}

function updateOnlineStatus(text, online = true) {
  onlineStatus.innerHTML = `<span class="online-dot"></span> ${text}`;
  onlineStatus.classList.toggle('offline', !online);
}

function connectNovaOnline() {
  if (!novaUser || novaSocket?.readyState === WebSocket.OPEN || novaSocket?.readyState === WebSocket.CONNECTING) return;
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  novaSocket = new WebSocket(`${scheme}//${location.host}/ws`);
  novaSocket.addEventListener('open', () => updateOnlineStatus('Connecté à Nova Online'));
  novaSocket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.type === 'presence') updateOnlineStatus(`${message.online} joueur${message.online > 1 ? 's' : ''} en ligne`);
    if (message.type === 'queue.updated' && matchmaking && message.mode === selectedOnlineMode()) {
      playButton.textContent = `RECHERCHE · ${message.players} JOUEUR${message.players > 1 ? 'S' : ''}`;
    }
    if (message.type === 'match.found' && matchmaking) {
      matchmaking = false;
      playButton.disabled = false;
      playButton.textContent = 'JOUER';
      launchOnlineMatch(message.match);
    }
  });
  novaSocket.addEventListener('close', () => {
    novaSocket = null;
    updateOnlineStatus('Nova Online déconnecté', false);
    if (novaUser) setTimeout(connectNovaOnline, 2000);
  });
}

function applyAccount(user) {
  novaUser = user;
  if (!user) return;
  const initial = user.username.charAt(0).toUpperCase();
  document.querySelector('#open-account').childNodes[0].nodeValue = initial;
  document.querySelector('#profile-avatar').textContent = initial;
  document.querySelector('#profile-name').textContent = user.username;
  document.querySelectorAll('.player-name > b, .player-data > b').forEach(label => { label.textContent = user.username; });
  connectNovaOnline();
}

function showAccount(required = false) {
  authView.classList.toggle('hidden', Boolean(novaUser));
  profileView.classList.toggle('hidden', !novaUser);
  document.querySelector('#close-account').classList.toggle('hidden', required && !novaUser);
  accountScreen.classList.remove('hidden');
  if (!novaUser) setTimeout(() => document.querySelector('#auth-username').focus(), 50);
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('[data-auth-mode]').forEach(button => button.classList.toggle('active', button.dataset.authMode === mode));
  document.querySelector('#account-title').textContent = mode === 'login' ? 'Connexion' : 'Créer un compte';
  document.querySelector('#auth-subtitle').textContent = mode === 'login' ? 'Content de te revoir sur l’Archipel.' : 'Choisis ton identité de joueur Nova.';
  document.querySelector('#auth-submit').textContent = mode === 'login' ? 'SE CONNECTER' : 'CRÉER MON COMPTE';
  document.querySelector('#auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  document.querySelector('#auth-error').textContent = '';
}

async function loadAccount() {
  try {
    const response = await fetch('/api/account', { cache: 'no-store' });
    const data = await response.json();
    if (data.user) applyAccount(data.user);
  } catch {
    // Le compte reste facultatif : une panne de session ne doit jamais bloquer Jouer ou Boutique.
    novaUser = null;
  }
}

document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
document.querySelector('#toggle-password').addEventListener('click', () => {
  const input = document.querySelector('#auth-password');
  input.type = input.type === 'password' ? 'text' : 'password';
});
document.querySelector('#open-account').addEventListener('click', () => showAccount(false));
document.querySelector('#close-account').addEventListener('click', () => accountScreen.classList.add('hidden'));
authForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = document.querySelector('#auth-submit');
  const errorLabel = document.querySelector('#auth-error');
  submit.disabled = true; errorLabel.textContent = '';
  try {
    const response = await fetch(`/api/${authMode === 'login' ? 'login' : 'register'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: authForm.username.value, password: authForm.password.value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Impossible de continuer.');
    applyAccount(data.user);
    authForm.reset();
    accountScreen.classList.add('hidden');
  } catch (error) { errorLabel.textContent = error.message; }
  finally { submit.disabled = false; }
});
document.querySelector('#logout-account').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  if (novaSocket) novaSocket.close();
  novaUser = null; setAuthMode('login');
  authView.classList.remove('hidden'); profileView.classList.add('hidden');
  document.querySelector('#close-account').classList.add('hidden');
});
loadAccount();
const crosshair = document.querySelector('#crosshair');
const hitmarker = document.querySelector('#hitmarker');
const fpsCounter = document.querySelector('#fps-counter');
const damageVignette = document.querySelector('#damage-vignette');
const reloadBar = document.querySelector('#reload-bar');
const interactPrompt = document.querySelector('#interact');
const questText = document.querySelector('#quest-text');
const questProgress = document.querySelector('#quest-progress');
const dropPrompt = document.querySelector('#drop-prompt');
const dropStats = document.querySelector('#drop-stats');
const altitudeLabel = document.querySelector('#altitude');
const fallSpeedLabel = document.querySelector('#fall-speed');
const mapPlayer = document.querySelector('#map-player');
const mapZone = document.querySelector('#map-zone');
const worldMap = document.querySelector('#world-map');
const worldMapPlayer = document.querySelector('#world-map-player');
const worldMapZone = document.querySelector('#world-map-zone');
const inventoryHud = document.querySelector('#inventory');
const weaponNameLabel = document.querySelector('#weapon-name');
const matchStats = document.querySelector('#match-stats');
const pauseMenu = document.querySelector('#pause-menu');
const compassStrip = document.querySelector('#compass-strip');
const arenaScore = document.querySelector('#arena-score');
const arenaGoalFill = document.querySelector('#arena-goal-fill');
const arenaGoalValue = document.querySelector('#arena-goal-value');
const arenaTeamScore = document.querySelector('#arena-team-score');
const arenaBuildScore = document.querySelector('#arena-build-score');
const arenaTeamLabel = document.querySelector('#arena-team-label');
const arenaRivalLabel = document.querySelector('#arena-rival-label');
const scene = new THREE.Scene();
const staticObstacles = [];
const obstacleGrid = new Map();
const obstacleCellSize = 48;
scene.background = new THREE.Color(0x86c7e8);
scene.fog = new THREE.Fog(0xa8c7c8, 230, 790);

const camera = new THREE.PerspectiveCamera(70, host.clientWidth / host.clientHeight, 0.1, 900);
camera.position.set(0, 7, 70);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
host.appendChild(renderer.domElement);

// Ciel atmospherique en degradé : horizon lumineux et bleu plus profond au zenith.
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(840, 32, 18),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x3989c4) },
      horizonColor: { value: new THREE.Color(0xb9d7d2) },
      bottomColor: { value: new THREE.Color(0x668c9b) }
    },
    vertexShader: 'varying float vHeight; void main(){vHeight=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 topColor;uniform vec3 horizonColor;uniform vec3 bottomColor;varying float vHeight;void main(){float upper=smoothstep(0.0,.72,vHeight);float lower=smoothstep(-.28,.04,vHeight);vec3 c=mix(bottomColor,horizonColor,lower);c=mix(c,topColor,upper);gl_FragColor=vec4(c,1.0);}'
  })
);
skyDome.renderOrder = -10;
scene.add(skyDome);

// Bras et arme visibles à la première personne, colorés par le skin équipé.
scene.add(camera);
const viewModel = new THREE.Group();
const skinMaterial = new THREE.MeshStandardMaterial({ color: 0x27bbdf, roughness: .75 });
const gloveMaterial = new THREE.MeshStandardMaterial({ color: 0x18233a, roughness: .9 });
const weaponMaterial = new THREE.MeshStandardMaterial({ color: 0x313a49, metalness: .65, roughness: .3 });
const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(.12, .55, 4, 8), skinMaterial);
const rightArm = leftArm.clone();
leftArm.position.set(-.3, -.31, -.72); rightArm.position.set(.3, -.31, -.72);
leftArm.rotation.set(Math.PI / 2.7, 0, -.18); rightArm.rotation.set(Math.PI / 2.7, 0, .18);
const leftGlove = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), gloveMaterial);
const rightGlove = leftGlove.clone();
leftGlove.position.set(-.21, -.3, -1.03); rightGlove.position.set(.21, -.3, -1.03);
const weapon = new THREE.Mesh(new THREE.BoxGeometry(.16, .18, .72), weaponMaterial);
weapon.position.set(.12, -.28, -1.18);
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, .55, 8), weaponMaterial);
barrel.rotation.x = Math.PI / 2; barrel.position.set(.12, -.25, -1.67);
viewModel.add(leftArm, rightArm, leftGlove, rightGlove, weapon, barrel);
viewModel.scale.setScalar(.58);
viewModel.position.set(.08, -.42, -.72);
viewModel.renderOrder = 20;
camera.add(viewModel);
let weaponKick = 0;

// Gardien Nova visible en jeu, en vue troisième personne légère.
let avatarTextureReady = false;
const avatarTexture = new THREE.TextureLoader().load('assets/nova-guardian.png', () => { avatarTextureReady = true; });
avatarTexture.colorSpace = THREE.SRGBColorSpace;
const playerAvatar = new THREE.Sprite(new THREE.SpriteMaterial({ map: avatarTexture, transparent: true, alphaTest: .04, depthTest: false, depthWrite: false }));
playerAvatar.scale.set(2.25, 5.5, 1);
playerAvatar.center.set(.5, 0);
playerAvatar.position.set(-1.35, -3.65, -6.6);
playerAvatar.visible = false;
playerAvatar.renderOrder = 999;
camera.add(playerAvatar);

// Modèle 3D Nova réellement intégré au monde pendant les parties.
const playerModel = new THREE.Group();
const modelNavy = new THREE.MeshStandardMaterial({color:0x101a31,roughness:.48,metalness:.32});
const modelBlue = new THREE.MeshStandardMaterial({color:0x173f68,roughness:.42,metalness:.4});
const modelGold = new THREE.MeshStandardMaterial({color:0xd69b2f,roughness:.24,metalness:.82});
const modelBlack = new THREE.MeshStandardMaterial({color:0x070b12,roughness:.7,metalness:.18});
const modelCyan = new THREE.MeshStandardMaterial({color:0x4eeaff,emissive:0x159bc0,emissiveIntensity:2.2,roughness:.2,metalness:.4});
function modelPart(geometry,material,parent,x,y,z){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
const modelTorso=modelPart(new THREE.CapsuleGeometry(.53,1.42,10,18),modelBlue,playerModel,0,3.72,0);modelTorso.scale.set(1.08,1,.72);
modelPart(new THREE.CapsuleGeometry(.62,.12,5,16),modelGold,playerModel,0,4.35,-.02).scale.z=.72;
const collar=modelPart(new THREE.CylinderGeometry(.78,.58,.62,8,1,true),modelNavy,playerModel,0,4.65,0);collar.scale.z=.72;
const helmet=modelPart(new THREE.SphereGeometry(.52,20,14),modelGold,playerModel,0,5.28,0);helmet.scale.set(.88,1.08,.82);
modelPart(new THREE.CapsuleGeometry(.34,.12,5,14),modelBlack,playerModel,0,5.32,-.43).rotation.z=Math.PI/2;
modelPart(new THREE.BoxGeometry(.58,.12,.035),modelCyan,playerModel,0,5.4,-.57);
for(const x of [-.25,.25]){const ear=modelPart(new THREE.ConeGeometry(.13,.66,8),modelGold,playerModel,x,5.91,0);ear.rotation.z=x<0?.13:-.13;}
const chestCore=modelPart(new THREE.OctahedronGeometry(.22,0),modelCyan,playerModel,0,3.94,-.63);chestCore.scale.y=1.35;
for(const x of [-.43,.43]){const trim=modelPart(new THREE.BoxGeometry(.08,1.35,.07),modelCyan,playerModel,x,3.7,-.59);trim.rotation.z=x<0?-.1:.1;}
for(const x of [-.38,.38]){const tail=modelPart(new THREE.BoxGeometry(.58,1.85,.16),modelNavy,playerModel,x,2.25,.24);tail.rotation.z=x<0?.13:-.13;tail.rotation.x=-.08;const edge=modelPart(new THREE.BoxGeometry(.08,1.7,.19),modelCyan,tail,x<0?-.25:.25,0,-.01);}
const modelArmLeft=new THREE.Group(),modelArmRight=new THREE.Group();
for(const [side,arm] of [[-1,modelArmLeft],[1,modelArmRight]]){arm.position.set(side*.67,4.18,0);playerModel.add(arm);const shoulder=modelPart(new THREE.SphereGeometry(.25,12,8),modelGold,arm,0,-.08,0);shoulder.scale.set(1.25,.82,.95);modelPart(new THREE.CapsuleGeometry(.145,.9,7,12),modelBlue,arm,0,-.61,0);modelPart(new THREE.CapsuleGeometry(.19,.22,6,10),modelGold,arm,0,-1.18,0);modelPart(new THREE.CapsuleGeometry(.135,.62,7,12),modelBlack,arm,0,-1.58,0);}
const modelLegLeft=new THREE.Group(),modelLegRight=new THREE.Group();
for(const [side,leg] of [[-1,modelLegLeft],[1,modelLegRight]]){leg.position.set(side*.29,2.72,0);playerModel.add(leg);modelPart(new THREE.CapsuleGeometry(.205,1.2,8,12),modelNavy,leg,0,-.76,0);const knee=modelPart(new THREE.SphereGeometry(.22,10,7),modelGold,leg,0,-1.48,-.08);knee.scale.set(1.08,.82,.9);modelPart(new THREE.CapsuleGeometry(.18,.76,8,12),modelBlack,leg,0,-1.94,0);const boot=modelPart(new THREE.CapsuleGeometry(.24,.38,7,12),modelNavy,leg,0,-2.42,-.17);boot.rotation.x=Math.PI/2;boot.scale.z=1.25;modelPart(new THREE.BoxGeometry(.36,.06,.65),modelCyan,boot,0,.05,-.03);}
playerModel.visible=false;playerModel.scale.setScalar(.88);scene.add(playerModel);
const modelForward=new THREE.Vector3(),modelRightVector=new THREE.Vector3();

function updatePlayerAvatar() {
  const shouldShow = controls.isLocked && matchActive && dropState !== 'bus';
  playerAvatar.visible = false;
  playerModel.visible = shouldShow;
  viewModel.visible = false;
  if (!shouldShow) return;
  const motion = Math.min(1, smoothSpeed / 42);
  const airborne = dropState === 'falling' || dropState === 'gliding';
  camera.getWorldDirection(modelForward);modelForward.y=0;if(modelForward.lengthSq()<.001)modelForward.set(0,0,-1);modelForward.normalize();
  modelRightVector.set(modelForward.z,0,-modelForward.x);
  const thirdPersonDistance = currentMode !== 'solo' ? 8.2 : 5.4;
  playerModel.scale.setScalar(currentMode !== 'solo' ? .78 : .88);
  playerModel.position.copy(camera.position).addScaledVector(modelForward,thirdPersonDistance).addScaledVector(modelRightVector,-1.15);
  playerModel.position.y=airborne
    ? camera.position.y-5.4
    : currentMode !== 'solo' && isInsideCreativeArena(playerModel.position.x, playerModel.position.z)
      ? arenaFloorY+.08
      : terrainHeightAt(playerModel.position.x,playerModel.position.z)+.08;
  playerModel.rotation.y=Math.atan2(-modelForward.x,-modelForward.z);
  const stride=Math.sin(cameraBobTime)*.62*motion;
  modelLegLeft.rotation.x=airborne?.18:stride;modelLegRight.rotation.x=airborne?-.18:-stride;
  modelArmLeft.rotation.x=airborne?-1.05:-stride*.7;modelArmRight.rotation.x=airborne?-1.05:stride*.7;
  playerModel.rotation.z=THREE.MathUtils.lerp(playerModel.rotation.z,0,.2);
}

// Planeur Nova visible au-dessus du joueur pendant la descente.
const glider = new THREE.Group();
const gliderWing = new THREE.Mesh(new THREE.SphereGeometry(1.2, 18, 10, 0, Math.PI * 2, 0, Math.PI * .45), new THREE.MeshStandardMaterial({ color: 0x42cdea, emissive: 0x0b6680, emissiveIntensity: .8, side: THREE.DoubleSide }));
gliderWing.scale.set(1.8, .35, .7); gliderWing.position.set(0, 1.4, -2.1); glider.add(gliderWing);
for (const x of [-.8, .8]) { const line = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 1.5, 5), new THREE.MeshBasicMaterial({ color: 0xe7fbff })); line.position.set(x, .7, -1.75); line.rotation.z = x < 0 ? -.5 : .5; glider.add(line); }
glider.visible = false; camera.add(glider);
let audioContext = null;
function gameSound(type) {
  if (Number(gameSettings?.volume ?? 50) <= 0) return;
  audioContext ??= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  const volume = Number(gameSettings?.volume ?? 50) / 100;
  const sounds = {
    shot: [105, 45, .09, .16], hit: [720, 430, .07, .08], eliminate: [440, 880, .22, .1],
    pickup: [520, 760, .14, .08], hurt: [130, 75, .16, .1], build: [240, 175, .08, .08],
    uiHover: [420, 520, .045, .025], uiClick: [310, 610, .085, .045]
  };
  const [start, end, duration, level] = sounds[type] ?? sounds.hit;
  oscillator.type = type === 'shot' || type === 'hurt' ? 'sawtooth' : 'sine';
  oscillator.frequency.setValueAtTime(start, now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
  gain.gain.setValueAtTime(level * volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
  oscillator.connect(gain).connect(audioContext.destination); oscillator.start(now); oscillator.stop(now + duration);
}

// Retour sonore discret sur toute l'interface, sans fichier audio externe.
document.addEventListener('pointerover', event => {
  if (audioContext && event.target.closest('button') && !event.relatedTarget?.closest?.('button')) gameSound('uiHover');
});
document.addEventListener('click', event => {
  if (event.target.closest('button')) gameSound('uiClick');
});

const skins = [
  { id: 'nova', name: 'Éclaireur Nova', description: 'Tenue officielle de l’Archipel.', price: 0, color: '#27bbdf', letter: 'N', rarity: 'RARE', accent: '#6de8ff' },
  { id: 'ember', name: 'Braise', description: 'Explorateur des terres volcaniques.', price: 500, color: '#f06442', letter: 'B', rarity: 'ATYPIQUE', accent: '#ff9d5c' },
  { id: 'flora', name: 'Sylve', description: 'Gardienne des prairies sauvages.', price: 650, color: '#49b85c', letter: 'S', rarity: 'RARE', accent: '#8cf69a' },
  { id: 'void', name: 'Nébuleux', description: 'Voyageur venu du vide cosmique.', price: 800, color: '#8658dc', letter: 'V', rarity: 'ÉPIQUE', accent: '#ba8cff' },
  { id: 'frost', name: 'Cryo', description: 'Spécialiste des zones glacées.', price: 700, color: '#78d9f3', letter: 'C', rarity: 'ÉPIQUE', accent: '#c5f5ff' },
  { id: 'gold', name: 'Solarius', description: 'Champion légendaire de Nova.', price: 1000, color: '#e8b72e', letter: 'S', rarity: 'LÉGENDAIRE', accent: '#ffe26b' },
  { id: 'shadow', name: 'Spectre', description: 'Agent silencieux des zones obscures.', price: 750, color: '#343b5f', letter: 'X', rarity: 'ÉPIQUE', accent: '#8b92ff' },
  { id: 'tide', name: 'Néréide', description: 'Protectrice des cités englouties.', price: 650, color: '#168fac', letter: 'N', rarity: 'RARE', accent: '#58f0e8' },
  { id: 'mecha', name: 'Titan-07', description: 'Unité blindée forgée pour le combat.', price: 900, color: '#65788a', letter: '07', rarity: 'ÉPIQUE', accent: '#ff674f' },
  { id: 'sakura', name: 'Kitsune', description: 'Messagère mystique aux neuf légendes.', price: 850, color: '#d65e91', letter: 'K', rarity: 'ÉPIQUE', accent: '#ffc1df' },
  { id: 'toxic', name: 'Vortex', description: 'Expérience instable du laboratoire Nova.', price: 1100, color: '#58a52d', letter: 'V', rarity: 'LÉGENDAIRE', accent: '#b9ff47' },
  { id: 'celestial', name: 'Astréon', description: 'Gardien mythique de la faille céleste.', price: 1500, color: '#4f63d8', letter: 'A', rarity: 'MYTHIQUE', accent: '#f1a9ff' }
];
let credits = Number(localStorage.getItem('novaCredits') ?? 1500);
let ownedSkins = JSON.parse(localStorage.getItem('novaOwned') ?? '["nova"]');
let equippedSkin = localStorage.getItem('novaEquipped') ?? 'nova';
let shopFilter = 'all';
let shopToastTimer;
const gemStore = document.querySelector('#gem-store');
const gemPacks = [
  { gems: 500, bonus: 0, price: '4,99 €', label: 'ÉTINCELLE' },
  { gems: 1200, bonus: 100, price: '9,99 €', label: 'ÉCLAT', popular: true },
  { gems: 2800, bonus: 400, price: '19,99 €', label: 'NOVA' },
  { gems: 6500, bonus: 1500, price: '39,99 €', label: 'SUPERNOVA', best: true }
];

function renderGemPacks() {
  const host = document.querySelector('#gem-packs');
  host.innerHTML = '';
  for (const pack of gemPacks) {
    const total = pack.gems + pack.bonus;
    const card = document.createElement('article');
    card.className = `gem-pack${pack.popular ? ' popular' : ''}${pack.best ? ' best' : ''}`;
    card.innerHTML = `${pack.popular ? '<strong class="pack-ribbon">POPULAIRE</strong>' : pack.best ? '<strong class="pack-ribbon">MEILLEURE VALEUR</strong>' : ''}<div class="gem-cluster"><i></i><i></i><i></i></div><small>${pack.label}</small><h3>${total.toLocaleString('fr-FR')} <span>GEMMES</span></h3>${pack.bonus ? `<p>dont <b>+${pack.bonus.toLocaleString('fr-FR')} bonus</b></p>` : '<p>Pack standard</p>'}<button><span>${pack.price}</span><small>OBTENIR · DÉMO</small></button>`;
    card.querySelector('button').addEventListener('click', () => {
      credits += total;
      saveShop();
      renderShop();
      gemStore.classList.add('hidden');
      shop.classList.remove('hidden');
      showShopToast(`+${total.toLocaleString('fr-FR')} Gemmes Nova ajoutées · démo`);
    });
    host.appendChild(card);
  }
}

function showShopToast(message, type = 'success') {
  const toast = document.querySelector('#shop-toast');
  toast.textContent = message;
  toast.className = `shop-toast visible ${type}`;
  clearTimeout(shopToastTimer);
  shopToastTimer = setTimeout(() => { toast.className = 'shop-toast'; }, 2400);
}

function setShopFilter(filter) {
  shopFilter = filter;
  document.querySelectorAll('[data-shop-filter]').forEach(item => item.classList.toggle('active', item.dataset.shopFilter === filter));
  renderShop();
}

function saveShop() {
  localStorage.setItem('novaCredits', credits);
  localStorage.setItem('novaOwned', JSON.stringify(ownedSkins));
  localStorage.setItem('novaEquipped', equippedSkin);
}

const characterMarkup = skin => `<div class="shop-character"><i class="shop-cape"></i><i class="shop-crown"></i><i class="shop-horns"></i><i class="shop-head"></i><i class="shop-body"></i><i class="shop-core"></i><i class="shop-shoulder left"></i><i class="shop-shoulder right"></i><i class="shop-arm left"></i><i class="shop-arm right"></i><i class="shop-leg left"></i><i class="shop-leg right"></i><b>${skin.letter}</b></div>`;
const skinViewer = document.createElement('div');
skinViewer.className = 'skin-viewer hidden';
skinViewer.innerHTML = `<div class="skin-viewer-panel"><button class="skin-viewer-close" aria-label="Fermer">×</button><div class="skin-viewer-scene"><span class="viewer-rarity"></span><div class="viewer-character"></div><div class="viewer-platform"></div><button class="rotate-skin rotate-left">‹</button><button class="rotate-skin rotate-right">›</button><small>GLISSE POUR TOURNER · 360°</small></div><div class="skin-viewer-info"><p>APERÇU DE L'APPARENCE</p><h2></h2><b class="viewer-badge"></b><span class="viewer-description"></span><div class="viewer-price"></div><button class="viewer-action"></button></div></div>`;
shop.appendChild(skinViewer);
let viewedSkin=null,viewerRotation=0,viewerDragging=false,viewerPointerX=0;
function updateViewerRotation(){skinViewer.querySelector('.viewer-character .shop-character')?.style.setProperty('transform',`rotateY(${viewerRotation}deg)`);}
function openSkinViewer(skin){
  viewedSkin=skin;viewerRotation=0;const owned=ownedSkins.includes(skin.id),equipped=equippedSkin===skin.id;
  const sceneBox=skinViewer.querySelector('.skin-viewer-scene');sceneBox.dataset.skin=skin.id;sceneBox.style.setProperty('--skin',skin.color);sceneBox.style.setProperty('--accent',skin.accent);sceneBox.className=`skin-viewer-scene rarity-${skin.rarity.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}`;
  skinViewer.querySelector('.viewer-character').innerHTML=characterMarkup(skin);skinViewer.querySelector('.viewer-rarity').textContent=skin.rarity;skinViewer.querySelector('h2').textContent=skin.name;skinViewer.querySelector('.viewer-description').textContent=skin.description;
  skinViewer.querySelector('.viewer-badge').textContent=skin.id==='celestial'?'EXCLUSIF':skin.id==='gold'||skin.id==='sakura'?'POPULAIRE':'NOUVEAU';
  skinViewer.querySelector('.viewer-price').innerHTML=owned?'DÉJÀ DANS TON CASIER':`<i class="nova-gem"></i><strong>${skin.price.toLocaleString('fr-FR')}</strong> GEMMES`;
  const action=skinViewer.querySelector('.viewer-action');action.textContent=equipped?'✓ TENUE ACTUELLE':owned?'ÉQUIPER':`OBTENIR · ✦ ${skin.price.toLocaleString('fr-FR')}`;action.disabled=equipped;skinViewer.classList.remove('hidden');updateViewerRotation();
}
skinViewer.querySelector('.skin-viewer-close').addEventListener('click',()=>skinViewer.classList.add('hidden'));
skinViewer.querySelector('.rotate-left').addEventListener('click',()=>{viewerRotation-=30;updateViewerRotation();});skinViewer.querySelector('.rotate-right').addEventListener('click',()=>{viewerRotation+=30;updateViewerRotation();});
skinViewer.querySelector('.viewer-action').addEventListener('click',()=>{if(viewedSkin){buyOrEquip(viewedSkin);openSkinViewer(viewedSkin);}});
skinViewer.querySelector('.skin-viewer-scene').addEventListener('pointerdown',event=>{if(event.target.closest('button'))return;viewerDragging=true;viewerPointerX=event.clientX;event.currentTarget.setPointerCapture(event.pointerId);});
skinViewer.querySelector('.skin-viewer-scene').addEventListener('pointermove',event=>{if(!viewerDragging)return;viewerRotation+=event.clientX-viewerPointerX;viewerPointerX=event.clientX;updateViewerRotation();});skinViewer.querySelector('.skin-viewer-scene').addEventListener('pointerup',()=>viewerDragging=false);

function renderShop() {
  creditsLabel.textContent = credits.toLocaleString('fr-FR');
  const lobbyCredits = document.querySelector('#lobby-credits');
  if (lobbyCredits) lobbyCredits.textContent = credits.toLocaleString('fr-FR');
  const navCredits = document.querySelector('#nav-credits');
  if (navCredits) navCredits.textContent = credits.toLocaleString('fr-FR');
  shopItems.innerHTML = '';
  const visibleSkins = skins.filter(skin => shopFilter === 'all' || (shopFilter === 'owned' ? ownedSkins.includes(skin.id) : !ownedSkins.includes(skin.id)));
  document.querySelector('#shop-count').textContent = `${visibleSkins.length} APPARENCE${visibleSkins.length > 1 ? 'S' : ''}`;
  document.querySelector('#collection-count').textContent = `${ownedSkins.length} / ${skins.length}`;
  document.querySelector('#collection-fill').style.width = `${ownedSkins.length / skins.length * 100}%`;
  for (const [visibleIndex, skin] of visibleSkins.entries()) {
    const owned = ownedSkins.includes(skin.id);
    const equipped = equippedSkin === skin.id;
    const card = document.createElement('article');
    card.className = `shop-item rarity-${skin.rarity.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}${equipped ? ' equipped' : ''}${owned ? ' owned' : ''}${!owned && credits < skin.price ? ' unaffordable' : ''}`;
    card.style.setProperty('--skin', skin.color);
    card.style.setProperty('--accent', skin.accent);
    card.dataset.skin = skin.id;
    card.innerHTML = `<div class="skin-preview"><span class="rarity">${skin.rarity}</span><span class="skin-stars"></span><div class="shop-character"><i class="shop-crown"></i><i class="shop-horns"></i><i class="shop-head"></i><i class="shop-body"></i><i class="shop-core"></i><i class="shop-shoulder left"></i><i class="shop-shoulder right"></i><i class="shop-arm left"></i><i class="shop-arm right"></i><i class="shop-leg left"></i><i class="shop-leg right"></i><b>${skin.letter}</b></div>${equipped ? '<span class="equipped-badge">ÉQUIPÉ</span>' : owned ? '<span class="owned-badge">POSSÉDÉ</span>' : ''}</div><div class="shop-info"><div class="shop-name-line"><h3>${skin.name}</h3><span>${owned ? 'COLLECTION' : 'NOUVEAU'}</span></div><p>${skin.description}</p><button ${equipped ? 'disabled' : ''}>${equipped ? '✓ TENUE ACTUELLE' : owned ? 'ÉQUIPER' : `OBTENIR · ✦ ${skin.price.toLocaleString('fr-FR')}`}</button></div>`;
    card.querySelector('button').addEventListener('click', () => buyOrEquip(skin));
    const promoBadge=document.createElement('span');promoBadge.className='promo-badge';promoBadge.textContent=skin.id==='celestial'?'EXCLUSIF':visibleIndex%4===1?'POPULAIRE':'NOUVEAU';card.querySelector('.skin-preview').appendChild(promoBadge);
    const previewHint=document.createElement('span');previewHint.className='preview-hint';previewHint.textContent='APERÇU 360°';card.querySelector('.skin-preview').appendChild(previewHint);
    card.querySelector('.skin-preview').addEventListener('click',()=>openSkinViewer(skin));
    shopItems.appendChild(card);
  }
}

function buyOrEquip(skin, announce = true) {
  const wasOwned = ownedSkins.includes(skin.id);
  if (!ownedSkins.includes(skin.id)) {
    if (credits < skin.price) { showShopToast(`Il te manque ${(skin.price - credits).toLocaleString('fr-FR')} éclats`, 'error'); return; }
    credits -= skin.price;
    ownedSkins.push(skin.id);
    document.querySelector('.credits')?.classList.add('balance-changed');
    setTimeout(()=>document.querySelector('.credits')?.classList.remove('balance-changed'),650);
  }
  equippedSkin = skin.id;
  const avatar = document.querySelector('.lobby-avatar');
  avatar.textContent = skin.letter;
  avatar.style.background = `linear-gradient(145deg, ${skin.color}, #17213e)`;
  skinMaterial.color.set(skin.color);
  document.querySelector('.stage-avatar')?.style.setProperty('--avatar', skin.color);
  saveShop();
  renderShop();
  if (announce) showShopToast(wasOwned ? `${skin.name} est maintenant équipée` : `${skin.name} rejoint ton casier !`);
}

document.querySelector('#open-shop').addEventListener('click', () => { setShopFilter('all'); shop.classList.remove('hidden'); });
document.querySelector('#nav-shop').addEventListener('click', () => { setShopFilter('all'); shop.classList.remove('hidden'); });
document.querySelector('#nav-locker').addEventListener('click', () => { setShopFilter('owned'); shop.classList.remove('hidden'); });
document.querySelector('#nav-quests').addEventListener('click', () => flashNotice('DÉFIS DU JOUR AFFICHÉS À DROITE'));
document.querySelector('#close-shop').addEventListener('click', () => shop.classList.add('hidden'));
document.querySelector('#shop-close-icon').addEventListener('click', () => shop.classList.add('hidden'));
document.querySelector('#open-gem-store').addEventListener('click', () => { renderGemPacks(); gemStore.classList.remove('hidden'); });
document.querySelector('#close-gem-store').addEventListener('click', () => gemStore.classList.add('hidden'));
for (const button of document.querySelectorAll('[data-shop-filter]')) {
  button.addEventListener('click', () => setShopFilter(button.dataset.shopFilter));
}
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !skinViewer.classList.contains('hidden')) { skinViewer.classList.add('hidden'); return; }
  if (event.key === 'Escape' && !accountScreen.classList.contains('hidden')) {
    if (novaUser) accountScreen.classList.add('hidden');
    return;
  }
  if (event.key === 'Escape' && !gemStore.classList.contains('hidden')) { gemStore.classList.add('hidden'); return; }
  if (event.key === 'Escape' && !shop.classList.contains('hidden')) shop.classList.add('hidden');
});
buyOrEquip(skins.find(skin => skin.id === equippedSkin) ?? skins[0], false);

for (const button of document.querySelectorAll('.mode-card')) {
  button.addEventListener('click', () => {
    document.querySelector('#mode').selectedIndex = Number(button.dataset.mode);
    document.querySelectorAll('.mode-card').forEach(card => card.classList.toggle('selected', card === button));
  });
}
const rewardButton = document.querySelector('#daily-reward');
const rewardKey = `novaDaily-${new Date().toISOString().slice(0, 10)}`;
if (localStorage.getItem(rewardKey)) { rewardButton.disabled = true; rewardButton.textContent = 'CADEAU DÉJÀ RÉCUPÉRÉ'; }
rewardButton.addEventListener('click', () => {
  if (localStorage.getItem(rewardKey)) return;
  credits += 100; localStorage.setItem(rewardKey, '1'); saveShop(); renderShop();
  rewardButton.disabled = true; rewardButton.textContent = 'CADEAU RÉCUPÉRÉ · +100 ✦';
});

scene.add(new THREE.HemisphereLight(0xd9efff, 0x526544, 1.72));
const sun = new THREE.DirectionalLight(0xffe7bd, 2.65);
sun.position.set(-90, 140, 60); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = sun.shadow.camera.bottom = -480;
sun.shadow.camera.right = sun.shadow.camera.top = 480;sun.shadow.radius=4;sun.shadow.bias=-.00035; scene.add(sun);

const mat = (color, roughness = .85) => new THREE.MeshStandardMaterial({ color, roughness });
let worldSeed = 0x4e4f5641;
function worldRandom() {
  worldSeed |= 0;
  worldSeed = worldSeed + 0x6d2b79f5 | 0;
  let value = Math.imul(worldSeed ^ worldSeed >>> 15, 1 | worldSeed);
  value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
}
function groundUnderFootprint(x, z, width, depth) {
  let lowest = Infinity;
  for (const offsetX of [-.5, 0, .5]) {
    for (const offsetZ of [-.5, 0, .5]) {
      lowest = Math.min(lowest, terrainHeightAt(x + width * offsetX, z + depth * offsetZ));
    }
  }
  return lowest;
}
const addBox = (x, y, z, sx, sy, sz, color) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(color));
  mesh.position.set(x, groundUnderFootprint(x, z, sx, sz) + y - .08, z);
  mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
  if (sy >= 3 && sx >= 2 && sz >= 2) registerObstacle(mesh, sx / 2 + 1, sz / 2 + 1);
  return mesh;
};

function registerObstacle(mesh, radiusX, radiusZ = radiusX) {
  const obstacle = { mesh, radiusX, radiusZ };
  staticObstacles.push(obstacle);
  const minimumCellX = Math.floor((mesh.position.x - radiusX) / obstacleCellSize);
  const maximumCellX = Math.floor((mesh.position.x + radiusX) / obstacleCellSize);
  const minimumCellZ = Math.floor((mesh.position.z - radiusZ) / obstacleCellSize);
  const maximumCellZ = Math.floor((mesh.position.z + radiusZ) / obstacleCellSize);
  for (let cellX = minimumCellX; cellX <= maximumCellX; cellX++) {
    for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ++) {
      const key = `${cellX}:${cellZ}`;
      if (!obstacleGrid.has(key)) obstacleGrid.set(key, []);
      obstacleGrid.get(key).push(obstacle);
    }
  }
  return mesh;
}

function nearbyStaticObstacles(x, z, padding = 0) {
  const centerX = Math.floor(x / obstacleCellSize);
  const centerZ = Math.floor(z / obstacleCellSize);
  const radius = Math.max(1, Math.ceil(padding / obstacleCellSize));
  const nearby = new Set();
  for (let cellX = centerX - radius; cellX <= centerX + radius; cellX++) {
    for (let cellZ = centerZ - radius; cellZ <= centerZ + radius; cellZ++) {
      for (const obstacle of obstacleGrid.get(`${cellX}:${cellZ}`) ?? []) nearby.add(obstacle);
    }
  }
  return nearby;
}

function isStaticPositionBlocked(x, z, padding = 0) {
  const centerX = Math.floor(x / obstacleCellSize);
  const centerZ = Math.floor(z / obstacleCellSize);
  for (let cellX = centerX - 1; cellX <= centerX + 1; cellX++) {
    for (let cellZ = centerZ - 1; cellZ <= centerZ + 1; cellZ++) {
      for (const obstacle of obstacleGrid.get(`${cellX}:${cellZ}`) ?? []) {
        const position = obstacle.mesh.position;
        if (Math.abs(x - position.x) < obstacle.radiusX + padding &&
          Math.abs(z - position.z) < obstacle.radiusZ + padding) return true;
      }
    }
  }
  return false;
}

function findSafeWorldPosition(originX, originZ, initialAngle, initialRadius) {
  const goldenAngle = 2.3999632297;
  for (let attempt = 0; attempt < 32; attempt++) {
    const angle = initialAngle + attempt * goldenAngle;
    const radius = initialRadius + Math.floor(attempt / 5) * 7;
    const x = originX + Math.cos(angle) * radius;
    const z = originZ + Math.sin(angle) * radius;
    if (Math.hypot(x, z) > 390 || isStaticPositionBlocked(x, z, 2.8)) continue;
    if (enemies?.some?.(enemy => Math.hypot(enemy.position.x - x, enemy.position.z - z) < 7)) continue;
    return { x, z };
  }
  return { x: originX, z: originZ };
}

// Île vallonnée originale.
const terrainGeo = new THREE.PlaneGeometry(900, 900, 120, 120);
terrainGeo.rotateX(-Math.PI / 2);
const pos = terrainGeo.attributes.position;
function terrainHeightAt(x, z) {
  const edge = Math.hypot(x, z) / 450;
  const hills = Math.sin(x * .035) * 3 + Math.cos(z * .04) * 2 + Math.sin((x + z) * .018) * 4;
  const snowBiome = THREE.MathUtils.clamp((-x - 35) / 190, 0, 1) * THREE.MathUtils.clamp((-z - 35) / 190, 0, 1);
  const desertBiome = THREE.MathUtils.clamp((z - 80) / 220, 0, 1);
  const craterDistance = Math.hypot(x - 155, z + 25);
  const alpineRelief = snowBiome * (7 + Math.sin(x * .055) * 5 + Math.cos(z * .048) * 4);
  const canyonRelief = desertBiome * (2 + Math.sin(x * .025 + z * .04) * 3);
  const craterRelief = 10 * Math.exp(-Math.pow(craterDistance - 55, 2) / 650) - 7 * Math.exp(-craterDistance * craterDistance / 1250);
  const westernHills=11*Math.exp(-((x+245)**2+(z-45)**2)/6200);
  const easternCliffs=15*Math.exp(-((x-265)**2+(z+105)**2)/4800);
  const centralValley=-7*Math.exp(-((x+28)**2)/2400)*Math.exp(-(z**2)/24000);
  return hills + alpineRelief + canyonRelief + craterRelief + westernHills + easternCliffs + centralValley - Math.max(0, edge - .72) * 55;
}
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), z = pos.getZ(i);
  pos.setY(i, terrainHeightAt(x, z));
}
terrainGeo.computeVertexNormals();
const terrainColors = [];
for (let i = 0; i < pos.count; i++) {
  const height = pos.getY(i);
  const noise = Math.sin(pos.getX(i) * .12) * Math.cos(pos.getZ(i) * .1) * .045;
  const color = new THREE.Color(height < -3 ? 0x8b7954 : height > 6 ? 0x467d45 : 0x4f914c);
  color.offsetHSL(noise, 0, noise * .55);
  terrainColors.push(color.r, color.g, color.b);
}
terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));

// Texture de sol dédiée au monde 3D : la carte tactique n'est plus étirée au sol.
function createTerrainTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  const grass = new THREE.Color(0x5b914b), snow = new THREE.Color(0xdde7e3), desert = new THREE.Color(0xb78a55), tropical = new THREE.Color(0x51a261), volcanic = new THREE.Color(0x41444d);
  const color = new THREE.Color();
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const x = (px / size - .5) * 900, z = (py / size - .5) * 900;
    const snowMix = THREE.MathUtils.clamp(Math.min((-x - 30) / 145, (-z - 35) / 145), 0, 1);
    const desertMix = THREE.MathUtils.clamp((z - 75) / 165, 0, 1);
    const tropicalMix = THREE.MathUtils.clamp((x - 150) / 150, 0, 1) * THREE.MathUtils.clamp((z - 30) / 150, 0, 1);
    const craterMix = THREE.MathUtils.clamp(1 - Math.abs(Math.hypot(x - 155, z + 25) - 42) / 75, 0, .86);
    color.copy(grass).lerp(snow, snowMix).lerp(desert, desertMix).lerp(tropical, tropicalMix).lerp(volcanic, craterMix);
    const broad = Math.sin(x * .055) * Math.cos(z * .047) * .055;
    const fine = (Math.sin(x * .31 + z * .19) + Math.cos(z * .37 - x * .13)) * .018;
    const grain=(Math.sin(x*1.73+z*.91)+Math.cos(z*2.11-x*.73)+Math.sin((x-z)*3.17))*.007;
    color.offsetHSL(broad * .18, grain*.5, broad + fine + grain);
    const index = (py * size + px) * 4;
    image.data[index] = color.r * 255; image.data[index + 1] = color.g * 255; image.data[index + 2] = color.b * 255; image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  // Petits cailloux, touffes et irrégularités visibles au niveau du joueur.
  for(let detail=0;detail<4200;detail++){
    const px=worldRandom()*size,py=worldRandom()*size,radius=.35+worldRandom()*1.4;
    context.globalAlpha=.06+worldRandom()*.1;context.fillStyle=detail%3===0?'#e6d2a2':detail%3===1?'#243d27':'#493c2f';context.beginPath();context.arc(px,py,radius,0,Math.PI*2);context.fill();
  }
  context.lineCap = context.lineJoin = 'round';
  context.strokeStyle = '#367f9d'; context.lineWidth = 13; context.globalAlpha = .9;
  context.beginPath(); context.moveTo(405, 0); context.bezierCurveTo(350, 210, 545, 300, 445, 495); context.bezierCurveTo(355, 670, 600, 760, 535, 1024); context.stroke();
  context.strokeStyle = '#756b5a'; context.lineWidth = 7; context.globalAlpha = .82;
  for (const offset of [220, 500, 770]) { context.beginPath(); context.moveTo(0, offset); context.bezierCurveTo(260, offset - 100, 610, offset + 120, 1024, offset - 30); context.stroke(); }
  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}
const terrainDetailTexture = createTerrainTexture();
const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({
  map: terrainDetailTexture,
  roughness: .88,
  metalness: 0,
  envMapIntensity: .3,
  emissive: 0x162412,
  emissiveIntensity: .16
}));
terrain.receiveShadow = true; scene.add(terrain);

// Arène d'entraînement Nova : une zone bleue quadrillée dédiée au mode Créatif.
const creativeArena = new THREE.Group();
creativeArena.name = 'Arène Nova';
creativeArena.visible = false;
const arenaCenter = new THREE.Vector3(0, 0, 70);
const arenaFloorY = (() => {
  let highestTerrain = -Infinity;
  for (let offsetX = -38; offsetX <= 38; offsetX += 4) {
    for (let offsetZ = -38; offsetZ <= 38; offsetZ += 4) {
      highestTerrain = Math.max(highestTerrain, terrainHeightAt(arenaCenter.x + offsetX, arenaCenter.z + offsetZ));
    }
  }
  return highestTerrain + 1.1;
})();
const isInsideCreativeArena = (x, z) => Math.abs(x - arenaCenter.x) <= 35.5 && Math.abs(z - arenaCenter.z) <= 35.5;
const arenaFloorMaterial = new THREE.MeshStandardMaterial({ color: 0x246fd0, roughness: .62, metalness: .18, emissive: 0x0b2e71, emissiveIntensity: .34 });
const arenaLineMaterial = new THREE.MeshBasicMaterial({ color: 0x75dfff, transparent: true, opacity: .48, depthWrite: false });
const arenaTransform = new THREE.Object3D();
const arenaFloor = new THREE.InstancedMesh(new THREE.BoxGeometry(7.72, .32, 7.72), arenaFloorMaterial, 81);
let arenaTileIndex = 0;
for (let tileX = -4; tileX <= 4; tileX++) {
  for (let tileZ = -4; tileZ <= 4; tileZ++) {
    arenaTransform.position.set(arenaCenter.x + tileX * 8, arenaFloorY, arenaCenter.z + tileZ * 8);
    arenaTransform.rotation.set(0, 0, 0);
    arenaTransform.updateMatrix();
    arenaFloor.setMatrixAt(arenaTileIndex++, arenaTransform.matrix);
  }
}
arenaFloor.instanceMatrix.needsUpdate = true;
arenaFloor.receiveShadow = true;
creativeArena.add(arenaFloor);
const arenaWallMaterial = new THREE.MeshStandardMaterial({ color: 0x174c9b, roughness: .48, metalness: .28, emissive: 0x0b2b72, emissiveIntensity: .42 });
const arenaWalls = new THREE.InstancedMesh(new THREE.BoxGeometry(.7, 18, 15.2), arenaWallMaterial, 16);
let arenaWallIndex = 0;
for (const side of [-1, 1]) {
  for (const offset of [-24, -8, 8, 24]) {
    arenaTransform.position.set(arenaCenter.x + side * 36, arenaFloorY + 9, arenaCenter.z + offset);
    arenaTransform.rotation.set(0, 0, 0);
    arenaTransform.updateMatrix();
    arenaWalls.setMatrixAt(arenaWallIndex++, arenaTransform.matrix);
    arenaTransform.position.set(arenaCenter.x + offset, arenaFloorY + 9, arenaCenter.z + side * 36);
    arenaTransform.rotation.set(0, Math.PI / 2, 0);
    arenaTransform.updateMatrix();
    arenaWalls.setMatrixAt(arenaWallIndex++, arenaTransform.matrix);
  }
}
arenaWalls.instanceMatrix.needsUpdate = true;
arenaWalls.castShadow = arenaWalls.receiveShadow = true;
creativeArena.add(arenaWalls);
const arenaRing = new THREE.Mesh(new THREE.RingGeometry(4.2, 6.6, 40), arenaLineMaterial);
arenaRing.rotation.x = -Math.PI / 2;
arenaRing.position.set(arenaCenter.x - 22, arenaFloorY + .2, arenaCenter.z + 20);
creativeArena.add(arenaRing);
const arenaCeiling = new THREE.Mesh(new THREE.BoxGeometry(73, .7, 73), new THREE.MeshStandardMaterial({ color: 0x10284d, roughness: .5, metalness: .38, emissive: 0x071939, emissiveIntensity: .35 }));
arenaCeiling.position.set(arenaCenter.x, arenaFloorY + 18, arenaCenter.z);
creativeArena.add(arenaCeiling);
const arenaLightStrips = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, .18, 54), new THREE.MeshBasicMaterial({ color: 0x8cecff, toneMapped: false }), 3);
let arenaLightIndex = 0;
for (const offset of [-22, 0, 22]) {
  arenaTransform.position.set(arenaCenter.x + offset, arenaFloorY + 17.6, arenaCenter.z);
  arenaTransform.rotation.set(0, 0, 0);
  arenaTransform.updateMatrix();
  arenaLightStrips.setMatrixAt(arenaLightIndex++, arenaTransform.matrix);
  const roomLight = new THREE.PointLight(0x78ddff, 52, 43, 2);
  roomLight.position.set(arenaCenter.x + offset, arenaFloorY + 14.5, arenaCenter.z);
  creativeArena.add(roomLight);
}
arenaLightStrips.instanceMatrix.needsUpdate = true;
creativeArena.add(arenaLightStrips);
scene.add(creativeArena);

// Carte aérienne propre, utilisée uniquement depuis le Bus Nova et en haute altitude.
const aerialTexture = new THREE.TextureLoader().load('assets/nova-island-map.png');
aerialTexture.colorSpace = THREE.SRGBColorSpace;
aerialTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
// La carte aérienne dépasse les limites jouables pour rester continue dès le départ du bus.
const aerialMap = new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),new THREE.MeshBasicMaterial({map:aerialTexture,fog:false,toneMapped:false}));
aerialMap.rotation.x=-Math.PI/2;aerialMap.position.y=14;aerialMap.visible=false;aerialMap.renderOrder=4;scene.add(aerialMap);

const water = new THREE.Mesh(new THREE.CircleGeometry(1000, 128), new THREE.MeshPhysicalMaterial({ color: 0x176fa5, roughness: .12, metalness: .05, transparent: true, opacity: .88, transmission: .08, clearcoat: .8, clearcoatRoughness: .2 }));
water.rotation.x = -Math.PI / 2; water.position.y = -10; scene.add(water);

// Soleil, nuages et profondeur atmosphérique.
const sunDisk = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe5a1 }));
sunDisk.position.set(-260, 175, -410); scene.add(sunDisk);
const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xf1f7fb, transparent: true, opacity: .68, depthWrite: false });
const clouds = [];
for (let i = 0; i < 18; i++) {
  const cloud = new THREE.Group();
  for (let puff = 0; puff < 5; puff++) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(8 + worldRandom() * 7, 12, 8), cloudMaterial);
    mesh.scale.y = .45; mesh.position.set(puff * 10 - 20, worldRandom() * 4, worldRandom() * 7); cloud.add(mesh);
  }
  cloud.position.set(-400 + worldRandom() * 800, 105 + worldRandom() * 55, -350 + worldRandom() * 700);
  cloud.userData.speed = 1.2 + worldRandom() * 1.4; scene.add(cloud); clouds.push(cloud);
}

// Transport aérien original de la Saison Zéro : le Bus Nova.
const novaBus = new THREE.Group();
const balloonMaterial = new THREE.MeshStandardMaterial({ color: 0x3b8fe3, roughness: .42, metalness: .08 });
const busMaterial = new THREE.MeshStandardMaterial({ color: 0x194f86, roughness: .55, metalness: .35 });
const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x65e4ff, emissive: 0x168fb0, emissiveIntensity: 1.5, metalness: .5 });
const balloon = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), balloonMaterial);
balloon.scale.set(1, 1.28, 1); balloon.position.y = 15; novaBus.add(balloon);
const cabin = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 15), busMaterial);
cabin.position.y = 1; cabin.castShadow = true; novaBus.add(cabin);
const nose = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.8, 3), trimMaterial);
nose.position.set(0, 1.4, -8.3); novaBus.add(nose);
for (const x of [-3.5, 3.5]) {
  const engine = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.35, 4, 12), busMaterial);
  engine.rotation.x = Math.PI / 2; engine.position.set(x, .5, 2); engine.castShadow = true; novaBus.add(engine);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(.85, 16), trimMaterial);
  glow.position.set(x, .5, 4.05); novaBus.add(glow);
}
for (const x of [-2.8, 2.8]) for (const z of [-5, 0, 5]) {
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 14, 5), new THREE.MeshBasicMaterial({ color: 0x172238 }));
  cable.position.set(x, 8, z); cable.rotation.z = x < 0 ? -.08 : .08; novaBus.add(cable);
}
const beacon = new THREE.PointLight(0x57e9ff, 16, 35);
beacon.position.set(0, -1, 5); novaBus.add(beacon);

// Silhouette propre au Bus Nova : ailes, vitres, embleme et propulsion visible.
const windowMaterial = new THREE.MeshStandardMaterial({color:0x8beaff,emissive:0x2abbd7,emissiveIntensity:1.2,metalness:.25,roughness:.16});
for(const x of [-2.55,2.55]) for(const z of [-4.5,-1.5,1.5,4.5]){
  const windowMesh=new THREE.Mesh(new THREE.BoxGeometry(.16,1.35,1.65),windowMaterial);
  windowMesh.position.set(x,1.55,z);novaBus.add(windowMesh);
}
for(const x of [-6.3,6.3]){
  const wing=new THREE.Mesh(new THREE.BoxGeometry(7,.35,5),busMaterial);
  wing.position.set(x,.6,1.8);wing.rotation.z=x<0?-.06:.06;wing.castShadow=true;novaBus.add(wing);
  const wingTip=new THREE.Mesh(new THREE.BoxGeometry(1,.55,5.4),trimMaterial);wingTip.position.set(x,.6,1.8);novaBus.add(wingTip);
}
const novaEmblem=new THREE.Mesh(new THREE.OctahedronGeometry(1.15,0),trimMaterial);novaEmblem.scale.y=.35;novaEmblem.position.set(0,3.25,-2);novaEmblem.rotation.x=Math.PI/2;novaBus.add(novaEmblem);
const thrusterGeometry=new THREE.BufferGeometry();
const thrusterPositions=new Float32Array(72);
for(let i=0;i<24;i++){thrusterPositions[i*3]=(i%2?3.5:-3.5)+(worldRandom()-.5)*.7;thrusterPositions[i*3+1]=.5+(worldRandom()-.5)*.8;thrusterPositions[i*3+2]=4.5+worldRandom()*12;}
thrusterGeometry.setAttribute('position',new THREE.BufferAttribute(thrusterPositions,3));
const busThrusters=new THREE.Points(thrusterGeometry,new THREE.PointsMaterial({color:0x7cecff,size:.75,transparent:true,opacity:.82,blending:THREE.AdditiveBlending,depthWrite:false}));novaBus.add(busThrusters);
novaBus.position.set(-460, 115, -180); novaBus.rotation.y = Math.PI / 2;
novaBus.visible = false; scene.add(novaBus);
let busFlightTime = 0;

// Vie dans le ciel : oiseaux stylises et poussiere portee par le vent.
const birds=[];
for(let i=0;i<7;i++){
  const bird=new THREE.Group();
  const birdMaterial=new THREE.MeshBasicMaterial({color:0x17253a,side:THREE.DoubleSide});
  for(const side of [-1,1]){const wing=new THREE.Mesh(new THREE.ConeGeometry(1.4,.18,3),birdMaterial);wing.scale.set(1,.25,1);wing.rotation.z=side*.72;wing.position.x=side*1.1;bird.add(wing);}
  bird.position.set(-330+worldRandom()*660,55+worldRandom()*55,-300+worldRandom()*600);bird.userData.speed=7+worldRandom()*5;bird.userData.phase=worldRandom()*6;scene.add(bird);birds.push(bird);
}
const windGeometry=new THREE.BufferGeometry();const windPositions=new Float32Array(150);
for(let i=0;i<50;i++){windPositions[i*3]=-360+worldRandom()*720;windPositions[i*3+1]=4+worldRandom()*30;windPositions[i*3+2]=-360+worldRandom()*720;}
windGeometry.setAttribute('position',new THREE.BufferAttribute(windPositions,3));
const windParticles=new THREE.Points(windGeometry,new THREE.PointsMaterial({color:0xd9f7dc,size:.45,transparent:true,opacity:.34,depthWrite:false}));scene.add(windParticles);

function tree(x, z, scale = 1, variant = 0) {
  const ground = terrainHeightAt(x, z);
  const group = new THREE.Group();
  group.position.set(x, ground, z);
  group.rotation.y = worldRandom() * Math.PI * 2;

  const trunkColor = [0x71452b, 0x825034, 0x5e3c29][variant % 3];
  const leafColors = [0x17653a, 0x237747, 0x315f35, 0x0f7048];
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.62 * scale, .92 * scale, 6.5 * scale, 8), mat(trunkColor));
  trunk.position.y = 3.25 * scale; trunk.castShadow = trunk.receiveShadow = true; group.add(trunk);

  const foliageMaterial = mat(leafColors[variant % leafColors.length]);
  const layers = variant % 3 === 0 ? 3 : 2;
  for (let layer = 0; layer < layers; layer++) {
    const width = (4.5 - layer * .9) * scale;
    const height = (6.2 - layer * .45) * scale;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(width, height, 9), foliageMaterial);
    crown.position.y = (7 + layer * 3.1) * scale;
    crown.rotation.y = layer * .55;
    crown.castShadow = crown.receiveShadow = true;
    group.add(crown);
  }

  // Quelques branches visibles donnent une silhouette moins géométrique.
  for (const side of [-1, 1]) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(.13 * scale, .24 * scale, 3.1 * scale, 6), mat(trunkColor));
    branch.position.set(side * 1.05 * scale, 6.1 * scale, 0);
    branch.rotation.z = side * Math.PI / 3;
    branch.castShadow = true; group.add(branch);
  }
  scene.add(group);
  registerObstacle(group, 1.1 * scale, 1.1 * scale);
}
// Forêt instanciée : quelques appels GPU au lieu de plus de mille objets séparés.
const forestTrees=[];
for(let i=0;i<220;i++){
  const angle=worldRandom()*Math.PI*2,radius=45+worldRandom()*340,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
  const sparseBiome=z>115||(x<-65&&z<-65);
  const riverDistance=Math.abs(x+205+z*.16);
  const spawnDistance=Math.hypot(x,z-70);
  if(riverDistance>27&&spawnDistance>58&&(!sparseBiome||worldRandom()>.72))forestTrees.push({x,z,scale:.62+worldRandom()*.52,variant:i,rotation:worldRandom()*Math.PI*2});
}
document.documentElement.dataset.worldFingerprint = forestTrees
  .slice(0, 24)
  .map(treeData => `${treeData.x.toFixed(2)},${treeData.z.toFixed(2)},${treeData.scale.toFixed(2)}`)
  .join('|');
const forestTrunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.62,.92,6.5,7),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95}),forestTrees.length);
const forestCrowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9,flatShading:true}),forestTrees.length*3);
const forestDummy=new THREE.Object3D(),trunkPalette=[0x71452b,0x825034,0x5e3c29],leafPalette=[0x2d7743,0x3c8851,0x477c3e,0x247c50,0x66884a];
for(const [index,treeData] of forestTrees.entries()){
  const ground=terrainHeightAt(treeData.x,treeData.z),scale=treeData.scale;
  forestDummy.position.set(treeData.x,ground+3.25*scale,treeData.z);forestDummy.rotation.set(0,treeData.rotation,0);forestDummy.scale.setScalar(scale);forestDummy.updateMatrix();forestTrunks.setMatrixAt(index,forestDummy.matrix);forestTrunks.setColorAt(index,new THREE.Color(trunkPalette[treeData.variant%trunkPalette.length]));
  const layers=treeData.variant%3===0?3:2;
  for(let layer=0;layer<3;layer++){
    const crownIndex=index*3+layer;
    if(layer>=layers){forestDummy.scale.setScalar(0);forestDummy.updateMatrix();forestCrowns.setMatrixAt(crownIndex,forestDummy.matrix);continue;}
    const width=(4.5-layer*.72)*scale,height=(5.5-layer*.35)*scale;
    const lateral=(layer-1)*1.15*scale;
    forestDummy.position.set(treeData.x+Math.cos(treeData.rotation+layer*2.1)*lateral,ground+(7.1+layer*2.15)*scale,treeData.z+Math.sin(treeData.rotation+layer*2.1)*lateral);
    forestDummy.rotation.set(0,treeData.rotation+layer*.75,(layer-1)*.08);
    forestDummy.scale.set(width*.86,height*.55,width*.78);forestDummy.updateMatrix();forestCrowns.setMatrixAt(crownIndex,forestDummy.matrix);forestCrowns.setColorAt(crownIndex,new THREE.Color(leafPalette[treeData.variant%leafPalette.length]));
  }
  const collisionAnchor=new THREE.Object3D();collisionAnchor.position.set(treeData.x,ground,treeData.z);registerObstacle(collisionAnchor,1.1*scale,1.1*scale);
}
forestTrunks.instanceMatrix.needsUpdate=true;forestCrowns.instanceMatrix.needsUpdate=true;if(forestTrunks.instanceColor)forestTrunks.instanceColor.needsUpdate=true;if(forestCrowns.instanceColor)forestCrowns.instanceColor.needsUpdate=true;
forestTrunks.castShadow=forestTrunks.receiveShadow=true;forestCrowns.castShadow=forestCrowns.receiveShadow=true;scene.add(forestTrunks,forestCrowns);

// Sous-bois varie en seulement quelques appels GPU : buissons, herbes et fleurs.
function scatterNature(geometry,material,count,place){
  const mesh=new THREE.InstancedMesh(geometry,material,count);const dummy=new THREE.Object3D();
  for(let i=0;i<count;i++){
    let angle,radius,x,z;
    do {
      angle=worldRandom()*Math.PI*2;radius=32+Math.sqrt(worldRandom())*345;x=Math.cos(angle)*radius;z=Math.sin(angle)*radius;
    } while(Math.abs(x+205+z*.16)<25);
    const data=place(i,x,z)??{};dummy.position.set(x,terrainHeightAt(x,z)+(data.y??0),z);dummy.rotation.set(data.rx??0,worldRandom()*Math.PI*2,data.rz??0);const scale=data.scale??1;dummy.scale.set(scale*(data.sx??1),scale*(data.sy??1),scale*(data.sz??1));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=false;mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
const bushes=scatterNature(new THREE.IcosahedronGeometry(1.5,1),new THREE.MeshStandardMaterial({color:0x246d3c,roughness:1,flatShading:true}),95,(i,x,z)=>({y:1,scale:.65+(i%7)*.08,sx:1.35,sy:.75}));
const grassTufts=scatterNature(new THREE.ConeGeometry(.8,3.2,5),new THREE.MeshStandardMaterial({color:0x4b8c3d,roughness:1,side:THREE.DoubleSide}),140,(i,x,z)=>({y:1.2,scale:.45+(i%5)*.07,sx:.38,sz:.38,rz:(i%3-1)*.12}));
const flowers=scatterNature(new THREE.SphereGeometry(.38,5,4),new THREE.MeshStandardMaterial({color:0xd77cdc,emissive:0x4d173f,emissiveIntensity:.18,roughness:.8}),55,(i,x,z)=>({y:.5,scale:.55+(i%4)*.08,sy:.45}));

function detailedBuilding(x,z,width,depth,height,color,type='house'){
  const group=new THREE.Group(),ground=terrainHeightAt(x,z),wallMaterial=new THREE.MeshStandardMaterial({color,roughness:.78});
  const walls=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),wallMaterial);walls.position.y=height/2;walls.castShadow=walls.receiveShadow=true;group.add(walls);
  const roofGeometry=type==='warehouse'?new THREE.BoxGeometry(width+1,1.1,depth+1):new THREE.ConeGeometry(Math.max(width,depth)*.72,5,4);
  const roof=new THREE.Mesh(roofGeometry,new THREE.MeshStandardMaterial({color:type==='station'?0x265f8c:0x3b3440,roughness:.65}));roof.position.y=height+(type==='warehouse'?.6:2.2);if(type!=='warehouse')roof.rotation.y=Math.PI/4;roof.castShadow=true;group.add(roof);
  const door=new THREE.Mesh(new THREE.BoxGeometry(Math.min(4,width*.25),height*.52,.28),new THREE.MeshStandardMaterial({color:0x253344,roughness:.65}));door.position.set(0,height*.26,depth/2+.16);group.add(door);
  const glassMaterial=new THREE.MeshStandardMaterial({color:0x75cde8,emissive:0x174963,emissiveIntensity:.35,metalness:.2,roughness:.18});
  for(const side of [-1,1]){const windowMesh=new THREE.Mesh(new THREE.BoxGeometry(Math.min(3,width*.2),2.5,.3),glassMaterial);windowMesh.position.set(side*width*.28,height*.62,depth/2+.17);group.add(windowMesh);}
  if(type==='station'){const canopy=new THREE.Mesh(new THREE.BoxGeometry(width+8,.8,depth*.62),new THREE.MeshStandardMaterial({color:0xe9edf0,roughness:.5}));canopy.position.set(0,4,depth*.75);group.add(canopy);for(const side of [-1,1]){const pump=new THREE.Mesh(new THREE.BoxGeometry(1.2,2.4,1),new THREE.MeshStandardMaterial({color:0xf0a931,roughness:.55}));pump.position.set(side*3,1.2,depth*.78);group.add(pump);}}
  group.position.set(x,ground,z);scene.add(group);registerObstacle(group,width*.48,depth*.48);return group;
}

// POI 1 : Port Aurore, maintenant compose de vrais batiments.
for (let i = 0; i < 7; i++) detailedBuilding(-125+(i%3)*18,-65+Math.floor(i/3)*20,13,14,9+(i%2)*4,[0xd98457,0x4a82a5,0xb95a63][i%3],i===5?'warehouse':'house');
addBox(-112, 1, -30, 70, 2, 8, 0x8a6849);

// POI 2 : Citadelle Nova, avec remparts, tours et façade lisible.
function addNovaCitadel(x,z){
  const group=new THREE.Group();
  const ground=groundUnderFootprint(x,z,52,44);
  const stone=new THREE.MeshStandardMaterial({color:0x59677a,roughness:.82,metalness:.06});
  const stoneDark=new THREE.MeshStandardMaterial({color:0x354457,roughness:.88});
  const roofMaterial=new THREE.MeshStandardMaterial({color:0x28394f,roughness:.68,metalness:.15});
  const citadelGlass=new THREE.MeshStandardMaterial({color:0x74dff2,emissive:0x17677c,emissiveIntensity:.65,roughness:.16,metalness:.25});
  const keep=new THREE.Mesh(new THREE.BoxGeometry(31,22,25),stone);keep.position.y=11;keep.castShadow=keep.receiveShadow=true;group.add(keep);
  const gate=new THREE.Mesh(new THREE.BoxGeometry(7,10,.5),stoneDark);gate.position.set(0,5,12.7);group.add(gate);
  const gateArch=new THREE.Mesh(new THREE.TorusGeometry(3.5,.6,7,18,Math.PI),stoneDark);gateArch.position.set(0,10,13);gateArch.rotation.z=Math.PI;group.add(gateArch);
  for(const side of [-1,1]){
    const wing=new THREE.Mesh(new THREE.BoxGeometry(15,13,31),stone);wing.position.set(side*22,6.5,0);wing.castShadow=wing.receiveShadow=true;group.add(wing);
    for(const depth of [-13,13]){
      const tower=new THREE.Mesh(new THREE.CylinderGeometry(6.8,8,29,12),stoneDark);tower.position.set(side*27,14.5,depth);tower.castShadow=tower.receiveShadow=true;group.add(tower);
      const roof=new THREE.Mesh(new THREE.ConeGeometry(8.8,8,12),roofMaterial);roof.position.set(side*27,33,depth);roof.castShadow=true;group.add(roof);
      for(const level of [8,17,25]){
        const slit=new THREE.Mesh(new THREE.BoxGeometry(1.3,3,.35),citadelGlass);slit.position.set(side*27,level,depth+(depth>0?6.85:-6.85));group.add(slit);
      }
    }
  }
  for(const side of [-1,1])for(const level of [7,14]){
    const windowMesh=new THREE.Mesh(new THREE.BoxGeometry(4,3,.35),citadelGlass);
    windowMesh.position.set(side*8,level,12.7);group.add(windowMesh);
  }
  const banner=new THREE.Mesh(new THREE.PlaneGeometry(5,10),new THREE.MeshStandardMaterial({color:0x416fd2,emissive:0x142c63,emissiveIntensity:.35,side:THREE.DoubleSide}));
  banner.position.set(0,16,12.98);group.add(banner);
  const emblem=new THREE.Mesh(new THREE.OctahedronGeometry(1.35,0),trimMaterial);emblem.position.set(0,18,13.3);emblem.scale.y=1.4;group.add(emblem);
  group.position.set(x,ground,z);scene.add(group);registerObstacle(group,34,23);
}
addNovaCitadel(72,-102);

// POI 3 : Ferme Solaire avec entrepot et station de ravitaillement.
detailedBuilding(92,88,34,24,14,0xb84b3c,'warehouse');
detailedBuilding(145,78,18,12,8,0xd7d9d5,'station');
for (let x = 55; x <= 130; x += 15) for (let z = 115; z <= 145; z += 15) {
  const panel = addBox(x, 2.5, z, 10, .5, 6, 0x183f70); panel.rotation.x = -.25;
}

// Silhouettes de POI reconnaissables depuis le Bus.
function addLighthouse(x,z){
  const group=new THREE.Group();const base=terrainHeightAt(x,z);
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(3.2,5.2,27,12),new THREE.MeshStandardMaterial({color:0xf2eee2,roughness:.72}));tower.position.y=13.5;tower.castShadow=true;group.add(tower);
  for(const y of [7,15,23]){const stripe=new THREE.Mesh(new THREE.CylinderGeometry(3.65,4.15,3.2,12),new THREE.MeshStandardMaterial({color:0xd94a4f,roughness:.7}));stripe.position.y=y;group.add(stripe);}
  const lantern=new THREE.Mesh(new THREE.CylinderGeometry(4.3,4.3,4,12),windowMaterial);lantern.position.y=29;group.add(lantern);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(5.2,4,12),new THREE.MeshStandardMaterial({color:0x24334b,roughness:.6}));roof.position.y=33;group.add(roof);
  const beam=new THREE.SpotLight(0xfff0b0,45,150,.16,.65,1);beam.position.set(0,29,0);beam.target.position.set(90,18,20);group.add(beam,beam.target);
  group.position.set(x,base,z);scene.add(group);registerObstacle(group,5,5);
}
addLighthouse(-315,-18);
function addWatchTower(x,z,color){
  const group=new THREE.Group();const base=terrainHeightAt(x,z);const material=new THREE.MeshStandardMaterial({color,roughness:.82});
  for(const dx of [-4,4])for(const dz of [-4,4]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.5,.8,16,7),material);leg.position.set(dx,8,dz);group.add(leg);}
  const deck=new THREE.Mesh(new THREE.BoxGeometry(13,1.2,13),material);deck.position.y=16;deck.castShadow=true;group.add(deck);
  const cabinTower=new THREE.Mesh(new THREE.BoxGeometry(9,6,9),new THREE.MeshStandardMaterial({color:0x354d5b,roughness:.7}));cabinTower.position.y=19.5;group.add(cabinTower);
  const roofTower=new THREE.Mesh(new THREE.ConeGeometry(8,4,4),new THREE.MeshStandardMaterial({color:0x703c2e,roughness:.8}));roofTower.position.y=24.5;roofTower.rotation.y=Math.PI/4;group.add(roofTower);
  group.position.set(x,base,z);scene.add(group);registerObstacle(group,6,6);
}
addWatchTower(278,215,0x80552e);addWatchTower(-72,255,0x8a6941);

// Lieu emblematique : la Tour Nova domine la ville et sert de repere sur toute l'ile.
const novaTower=new THREE.Group();
const towerBase=terrainHeightAt(8,-18);
for(let level=0;level<5;level++){
  const floor=new THREE.Mesh(new THREE.CylinderGeometry(10-level*.75,12-level*.75,10,8),new THREE.MeshStandardMaterial({color:level%2?0x263b58:0x334d6e,metalness:.28,roughness:.48}));floor.position.y=5+level*9;floor.rotation.y=level*.18;floor.castShadow=true;novaTower.add(floor);
  const lightRing=new THREE.Mesh(new THREE.TorusGeometry(10.8-level*.75,.28,7,24),trimMaterial);lightRing.rotation.x=Math.PI/2;lightRing.position.y=9.5+level*9;novaTower.add(lightRing);
}
const towerCrystal=new THREE.Mesh(new THREE.OctahedronGeometry(5,0),new THREE.MeshStandardMaterial({color:0x8feeff,emissive:0x425cff,emissiveIntensity:2.2,metalness:.3,roughness:.18}));towerCrystal.position.y=55;towerCrystal.castShadow=true;novaTower.add(towerCrystal);
novaTower.scale.setScalar(.7);
novaTower.position.set(8,towerBase,-18);scene.add(novaTower);registerObstacle(novaTower,9,9);

// Temple Ancien dans les falaises chaudes.
const ancientTemple=new THREE.Group();const templeBase=terrainHeightAt(-242,148),templeStone=new THREE.MeshStandardMaterial({color:0x9b805b,roughness:.96});
for(let step=0;step<4;step++){const stair=new THREE.Mesh(new THREE.BoxGeometry(34-step*4,2,24-step*3),templeStone);stair.position.y=1+step*1.8;ancientTemple.add(stair);}
for(const x of [-11,-4,4,11]){const pillar=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.8,13,8),templeStone);pillar.position.set(x,12,-4);pillar.castShadow=true;ancientTemple.add(pillar);}
const templeRoof=new THREE.Mesh(new THREE.BoxGeometry(31,3,14),templeStone);templeRoof.position.set(0,19,-4);ancientTemple.add(templeRoof);ancientTemple.position.set(-242,templeBase,148);scene.add(ancientTemple);registerObstacle(ancientTemple,16,12);

// Nouveaux paysages : rivière, montagnes, rochers et maisons ouvertes.
const river=new THREE.Mesh(new THREE.PlaneGeometry(35,520,18,1),new THREE.MeshPhysicalMaterial({color:0x2389ba,roughness:.12,transparent:true,opacity:.82,clearcoat:1}));
river.rotation.x=-Math.PI/2;river.rotation.z=.16;river.position.set(-205,-1,15);scene.add(river);

// Routes 3D qui relient réellement les POI et suivent le relief.
function addRoadRoute(points,width=8){
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
  const segments=Math.max(24,points.length*14);
  const roadGeometry=new THREE.BoxGeometry(1,1,1);
  const roadMaterial=new THREE.MeshStandardMaterial({color:0x4d5152,roughness:.96,metalness:0});
  const road=new THREE.InstancedMesh(roadGeometry,roadMaterial,segments);
  const markerCount=Math.floor(segments/3);
  const markers=new THREE.InstancedMesh(roadGeometry,new THREE.MeshStandardMaterial({color:0xe5d7a5,roughness:.8}),markerCount);
  const dummy=new THREE.Object3D();
  let markerIndex=0;
  for(let index=0;index<segments;index++){
    const start=curve.getPoint(index/segments),end=curve.getPoint((index+1)/segments);
    const middle=start.clone().add(end).multiplyScalar(.5);
    const length=Math.hypot(end.x-start.x,end.z-start.z)+.35;
    middle.y=(terrainHeightAt(start.x,start.z)+terrainHeightAt(end.x,end.z))*.5+.18;
    dummy.position.copy(middle);dummy.rotation.set(0,Math.atan2(end.x-start.x,end.z-start.z),0);dummy.scale.set(width,.18,length);dummy.updateMatrix();road.setMatrixAt(index,dummy.matrix);
    if(index%3===1&&markerIndex<markerCount){
      dummy.position.y+=.13;dummy.scale.set(.28,.08,length*.52);dummy.updateMatrix();markers.setMatrixAt(markerIndex++,dummy.matrix);
    }
  }
  road.instanceMatrix.needsUpdate=true;markers.instanceMatrix.needsUpdate=true;
  road.receiveShadow=true;scene.add(road,markers);
}
addRoadRoute([[-132,-65],[-92,-38],[-38,-30],[8,-18],[56,12],[104,48],[145,78]],8);
addRoadRoute([[8,-18],[25,-48],[49,-79],[72,-102]],7);
addRoadRoute([[-132,-65],[-170,-28],[-188,34],[-215,91],[-242,148]],7);
addRoadRoute([[8,-18],[58,38],[108,92],[174,132],[245,174]],7);

// Ponts et petits recits environnementaux autour de la riviere.
function addBridge(x,z,rotation=0){const group=new THREE.Group(),ground=terrainHeightAt(x,z);const deck=new THREE.Mesh(new THREE.BoxGeometry(56,2.2,9),new THREE.MeshStandardMaterial({color:0x77634f,roughness:.82}));deck.position.y=3;deck.castShadow=deck.receiveShadow=true;group.add(deck);for(const side of [-1,1]){const rail=new THREE.Mesh(new THREE.BoxGeometry(56,.7,.55),new THREE.MeshStandardMaterial({color:0x343c45,metalness:.45,roughness:.5}));rail.position.set(0,5,side*4.2);group.add(rail);}group.position.set(x,ground,z);group.rotation.y=rotation;scene.add(group);}
addBridge(-205,28,.16);addBridge(-175,174,.16);
function addAbandonedBoat(x,z,rotation=0){const boat=new THREE.Group();const hull=new THREE.Mesh(new THREE.ConeGeometry(4.5,13,4),new THREE.MeshStandardMaterial({color:0x744b35,roughness:.84}));hull.rotation.z=Math.PI/2;hull.scale.y=.45;boat.add(hull);const cabinBoat=new THREE.Mesh(new THREE.BoxGeometry(4,2.8,3),new THREE.MeshStandardMaterial({color:0xd5d0bb,roughness:.7}));cabinBoat.position.y=2;boat.add(cabinBoat);boat.position.set(x,terrainHeightAt(x,z)+1.2,z);boat.rotation.y=rotation;scene.add(boat);}
addAbandonedBoat(-220,82,.35);addAbandonedBoat(286,188,-.7);

// Details entre les POI : clotures, panneaux, pylones et vehicules abandonnes.
function addRoadDetail(x,z,type,index){const group=new THREE.Group(),ground=terrainHeightAt(x,z),dark=new THREE.MeshStandardMaterial({color:0x37424b,roughness:.72});if(type==='pylon'){for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.22,.42,15,6),dark);leg.position.set(side*2,7.5,0);leg.rotation.z=side*.12;group.add(leg);}const bar=new THREE.Mesh(new THREE.BoxGeometry(9,.5,.5),dark);bar.position.y=14;group.add(bar);}else{const body=new THREE.Mesh(new THREE.BoxGeometry(7,2.5,3.5),new THREE.MeshStandardMaterial({color:[0x9f3e45,0x315f87,0xc18a32][index%3],roughness:.68}));body.position.y=2;group.add(body);const top=new THREE.Mesh(new THREE.BoxGeometry(3.8,1.7,3),dark);top.position.y=3.8;group.add(top);}group.position.set(x,ground,z);group.rotation.y=index*.63;scene.add(group);}
for(let i=0;i<8;i++)addRoadDetail(-145+i*42,-8+Math.sin(i)*28,i%3===0?'pylon':'car',i);

// Cascade Nova : un repere lumineux visible depuis la vallee, avec brume animee.
const waterfall = new THREE.Group();
const waterfallSheet = new THREE.Mesh(new THREE.PlaneGeometry(18,34,1,8),new THREE.MeshPhysicalMaterial({color:0x78e9ff,emissive:0x147da2,emissiveIntensity:.55,transparent:true,opacity:.74,roughness:.08,side:THREE.DoubleSide,depthWrite:false}));
waterfallSheet.position.y=17;waterfallSheet.rotation.y=.22;waterfall.add(waterfallSheet);
const waterfallPool = new THREE.Mesh(new THREE.CircleGeometry(18,28),new THREE.MeshPhysicalMaterial({color:0x1aa5c4,transparent:true,opacity:.72,roughness:.1,clearcoat:1}));
waterfallPool.rotation.x=-Math.PI/2;waterfallPool.position.set(0,.25,8);waterfall.add(waterfallPool);
waterfall.position.set(-238,terrainHeightAt(-238,-172)+1,-172);scene.add(waterfall);
const mistGeometry = new THREE.BufferGeometry();
const mistPositions = new Float32Array(54);
for(let i=0;i<18;i++){mistPositions[i*3]=(worldRandom()-.5)*24;mistPositions[i*3+1]=worldRandom()*12;mistPositions[i*3+2]=2+worldRandom()*15;}
mistGeometry.setAttribute('position',new THREE.BufferAttribute(mistPositions,3));
const waterfallMist = new THREE.Points(mistGeometry,new THREE.PointsMaterial({color:0xd6fbff,size:2.8,transparent:true,opacity:.6,depthWrite:false,sizeAttenuation:true}));
waterfall.add(waterfallMist);
for(let i=0;i<14;i++){
  const a=i/14*Math.PI*2,r=340+Math.sin(i*2.3)*25,x=Math.cos(a)*r,z=Math.sin(a)*r;
  const mountain=new THREE.Group();
  for(let peak=0;peak<3;peak++){
    const height=31+(i%4)*6-peak*4;
    const width=27-peak*4;
    const rock=new THREE.Mesh(new THREE.ConeGeometry(width,height,7,3),new THREE.MeshStandardMaterial({color:peak%2?0x687468:0x788077,roughness:1,flatShading:true}));
    rock.position.set((peak-1)*15,height*.5,peak*7);
    rock.rotation.y=a+peak*.7;
    rock.scale.z=.82;
    rock.castShadow=rock.receiveShadow=true;
    mountain.add(rock);
  }
  mountain.position.set(x,terrainHeightAt(x,z),z);scene.add(mountain);registerObstacle(mountain,22,20);
}
for(let i=0;i<45;i++){const x=-330+worldRandom()*660,z=-330+worldRandom()*660;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1.5+worldRandom()*2.8),new THREE.MeshStandardMaterial({color:0x72766f,roughness:1}));rock.scale.y=.7;rock.position.set(x,terrainHeightAt(x,z)+1.2,z);rock.castShadow=true;scene.add(rock);registerObstacle(rock,1.7,1.7);}

// Reliefs visibles correspondant aux quatre grands biomes de la carte Nova.
for (const [x,z,size] of [[-250,-235,1.25],[-185,-280,1],[-285,-145,.9],[-135,-205,.8]]) {
  const mountain = new THREE.Group();
  const peakHeight=66*size,peakWidth=38*size;
  const stone = new THREE.Mesh(new THREE.ConeGeometry(peakWidth,peakHeight,8,4),new THREE.MeshStandardMaterial({color:0x687580,roughness:1,flatShading:true}));
  stone.position.y=peakHeight*.5;stone.scale.z=.82;stone.rotation.y=(x+z)*.013;stone.castShadow=true; mountain.add(stone);
  const snow = new THREE.Mesh(new THREE.ConeGeometry(peakWidth*.46,peakHeight*.28,8,2),new THREE.MeshStandardMaterial({color:0xeaf4f3,roughness:.92,flatShading:true}));
  snow.position.y=peakHeight*.86;snow.scale.z=.82;snow.rotation.y=stone.rotation.y;snow.castShadow=true; mountain.add(snow);
  for(const side of [-1,1]){
    const shoulder=new THREE.Mesh(new THREE.ConeGeometry(peakWidth*.48,peakHeight*.5,7,2),new THREE.MeshStandardMaterial({color:0x758078,roughness:1,flatShading:true}));
    shoulder.position.set(side*peakWidth*.52,peakHeight*.25,peakWidth*.08);shoulder.rotation.y=stone.rotation.y+side*.25;shoulder.scale.z=.78;shoulder.castShadow=true;mountain.add(shoulder);
  }
  mountain.position.set(x,terrainHeightAt(x,z),z); scene.add(mountain); registerObstacle(mountain,15*size,15*size);
}
for (const [x,z,sx,sy] of [[-170,245,18,12],[-45,285,25,16],[95,235,21,14],[180,300,16,11]]) {
  const mesa = new THREE.Mesh(new THREE.CylinderGeometry(sx*.72,sx,sy,9),new THREE.MeshStandardMaterial({color:0xb85f32,roughness:1}));
  mesa.position.set(x,terrainHeightAt(x,z)+sy/2,z); mesa.castShadow=mesa.receiveShadow=true; scene.add(mesa); registerObstacle(mesa,sx*.75,sx*.75);
}
for(let i=0;i<18;i++){
  const angle=i/18*Math.PI*2,radius=38+worldRandom()*42,x=155+Math.cos(angle)*radius,z=-25+Math.sin(angle)*radius;
  const volcanic=new THREE.Mesh(new THREE.DodecahedronGeometry(3+worldRandom()*4),new THREE.MeshStandardMaterial({color:0x252735,roughness:.92,emissive:0x162848,emissiveIntensity:.25}));
  volcanic.scale.y=1.35;volcanic.position.set(x,terrainHeightAt(x,z)+2,z);volcanic.castShadow=true;scene.add(volcanic);registerObstacle(volcanic,3,3);
}
function palm(x,z,scale=1){const group=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.35,.65,8*scale,7),mat(0x9a6538));trunk.position.y=4*scale;trunk.rotation.z=.08;group.add(trunk);for(let i=0;i<6;i++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(1.5*scale,7*scale,5),mat(0x238957));leaf.scale.x=.28;leaf.rotation.z=Math.PI/2;leaf.rotation.y=i/6*Math.PI*2;leaf.position.set(Math.cos(i/6*Math.PI*2)*2.2*scale,8*scale,Math.sin(i/6*Math.PI*2)*2.2*scale);group.add(leaf);}group.position.set(x,terrainHeightAt(x,z),z);scene.add(group);registerObstacle(group,.8*scale,.8*scale);}
for(const [x,z] of [[255,135],[285,175],[235,205],[315,105],[205,155],[330,210]]) palm(x,z,.9+worldRandom()*.35);
function openHouse(x,z,color){addBox(x,3,z,12,6,1,color);addBox(x-5.5,3,z,1,6,12,color);addBox(x+5.5,3,z,1,6,12,color);addBox(x,3,z+5.5,12,6,1,color);const roof=addBox(x,7,z,13,.7,13,0x49382e);roof.rotation.z=.12;}
openHouse(-245,145,0xd4a65d);openHouse(225,-175,0x5d9bc2);

// Cristal central et coffres interactifs.
const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(8, 0), new THREE.MeshStandardMaterial({ color: 0x55e7ff, emissive: 0x126b9c, emissiveIntensity: 2.4 }));
crystal.position.set(155, terrainHeightAt(155,-25)+14, -25); crystal.castShadow = true; scene.add(crystal);
const crystalBaseY = crystal.position.y;
const chests = [];
// Le loot est volontairement concentre dans les POI les plus contestes.
for (const [x,z] of [[-100,-45],[-122,-72],[-92,-34],[62,-84],[78,-112],[105,72],[118,96],[12,-8],[22,-28],[155,-25],[-242,148],[-315,-18]]) {
  const chest = addBox(x, 2.5, z, 5, 5, 4, 0xffbd28);
  chest.position.y=terrainHeightAt(x,z)+2.5;
  chest.material = new THREE.MeshStandardMaterial({ color: 0xd99b22, emissive: 0x6d3d05, emissiveIntensity: .65, roughness: .6 });
  chest.userData.opened = false; chests.push(chest);
}

const enemies = [];
const pickups = [];
const enemyGeometry = new THREE.CapsuleGeometry(2.1, 4.5, 5, 10);
const enemySkins = [
  { name: 'Sentinelle', suit: 0xe34e62, accent: 0xffcf55, visor: 0x64ddff },
  { name: 'Spectre', suit: 0x6446a8, accent: 0xc77dff, visor: 0xff5bea },
  { name: 'Forestier', suit: 0x328556, accent: 0xa8d85e, visor: 0x76ffd1 },
  { name: 'Cryo', suit: 0x479ac2, accent: 0xd8f7ff, visor: 0x45eaff },
  { name: 'Solaire', suit: 0xd78b25, accent: 0xffe169, visor: 0xff713d },
  { name: 'Ombre', suit: 0x282c3c, accent: 0x69738f, visor: 0xff365f },
  { name: 'Volt', suit: 0x166b7a, accent: 0x50f4dc, visor: 0xe6ff55 },
  { name: 'Rift', suit: 0x8c397c, accent: 0xff72dd, visor: 0x8cf7ff },
  { name: 'Nomade', suit: 0x8c643d, accent: 0xe2b878, visor: 0x75ddff },
  { name: 'Titan', suit: 0x525c69, accent: 0xb8c5d1, visor: 0xffa844 },
  { name: 'Corail', suit: 0xd85f68, accent: 0x55ddd0, visor: 0xfff18b },
  { name: 'Cosmos', suit: 0x27327c, accent: 0x778cff, visor: 0xff76ea }
];

function createEnemy(skin, variant) {
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: skin.suit, roughness: .68 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x17243a, roughness: .8 });
  const skinTones = [0xd8a17e, 0x9c674c, 0xe2b18d, 0xb9795b];
  const enemy = new THREE.Mesh(new THREE.CapsuleGeometry(1.15, 3, 6, 12), bodyMaterial);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.78, 16, 12), new THREE.MeshStandardMaterial({ color: skinTones[variant % skinTones.length], roughness: .88 }));
  head.scale.set(1, 1.12, .92); head.position.y = 3.18; enemy.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.84, 12, 8, 0, Math.PI * 2, 0, Math.PI * .54), darkMaterial);
  hair.position.y = 3.55; hair.rotation.z = (variant % 3 - 1) * .08; enemy.add(hair);
  for (const x of [-.25, .25]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.055, 7, 5), darkMaterial);
    eye.position.set(x, 3.25, .72); enemy.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.25, .035, .035), darkMaterial);
  mouth.position.set(0, 2.94, .76); enemy.add(mouth);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(1.65, 2.25, .38), darkMaterial);
  vest.position.set(0, .85, 1.04); vest.scale.x = .9; enemy.add(vest);
  const vestLight = new THREE.Mesh(new THREE.BoxGeometry(.2, .75, .08), new THREE.MeshStandardMaterial({ color: skin.visor, emissive: skin.visor, emissiveIntensity: 1 }));
  vestLight.position.set(0, .9, 1.27); enemy.add(vestLight);
  const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(.5), new THREE.MeshStandardMaterial({ color: skin.accent, emissive: skin.accent, emissiveIntensity: .7 }));
  emblem.scale.setScalar(.42); emblem.position.set(0, .55, 1.33); enemy.add(emblem);
  const limbMaterial = new THREE.MeshStandardMaterial({ color: skin.suit, roughness: .75 });
  for (const x of [-1.48, 1.48]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.27, 2.15, 5, 8), limbMaterial);
    arm.position.set(x * .88, .7, 0); arm.rotation.z = x < 0 ? -.08 : .08; enemy.add(arm);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(.35, 9, 7), darkMaterial);
    glove.position.set(x * .94, -.72, 0); enemy.add(glove);
  }
  for (const x of [-.62, .62]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.36, 2.35, 5, 8), darkMaterial);
    leg.position.set(x, -2.65, 0); enemy.add(leg);
    const knee = new THREE.Mesh(new THREE.BoxGeometry(.65, .52, .35), new THREE.MeshStandardMaterial({ color: skin.accent, roughness: .7 }));
    knee.position.set(x, -2.35, .38); enemy.add(knee);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(.72, .55, 1.15), darkMaterial);
    boot.position.set(x, -4.25, .25); enemy.add(boot);
  }
  if (variant % 2) {
    const shoulderGeometry = new THREE.BoxGeometry(.8, .4, .9);
    for (const x of [-1.28, 1.28]) { const shoulder = new THREE.Mesh(shoulderGeometry, new THREE.MeshStandardMaterial({ color: skin.accent, roughness: .55 })); shoulder.position.set(x, 1.7, 0); enemy.add(shoulder); }
  }
  if (variant % 4 === 2) {
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.8, .65), new THREE.MeshStandardMaterial({ color: skin.accent, roughness: .7 }));
    backpack.position.set(0, .9, -1.15); enemy.add(backpack);
  }
  if (variant % 5 === 3) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 1.2, 6), darkMaterial);
    antenna.position.set(.45, 4.25, 0); antenna.rotation.z = -.18; enemy.add(antenna);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), vestLight.material);
    tip.position.set(.56, 4.85, 0); enemy.add(tip);
  }
  enemy.scale.setScalar(.92 + (variant % 3) * .04);
  enemy.traverse(part => { part.castShadow = true; part.userData.enemyRoot = enemy; });
  enemy.userData.skinName = skin.name;
  enemy.userData.walkPhase = variant * .8;
  enemy.userData.arms = enemy.children.filter(part => part.geometry?.type === 'CapsuleGeometry' && part.position.y > 0);
  enemy.userData.legs = enemy.children.filter(part => part.geometry?.type === 'CapsuleGeometry' && part.position.y < 0);
  return enemy;
}

function spawnEnemies() {
  for (const enemy of enemies) scene.remove(enemy);
  enemies.length = 0;
  const enemyTotal = 16;
  const contestedZones=[[8,-18],[72,-102],[-112,-60],[155,-25],[92,88],[-242,148],[-315,-18],[278,215]];
  for (let i = 0; i < enemyTotal; i++) {
    const enemy = createEnemy(enemySkins[i % enemySkins.length], i);
    const [zoneX,zoneZ]=contestedZones[i%contestedZones.length],angle=(i*2.4)%6.28,radius=12+(i%3)*9;
    const safePosition=findSafeWorldPosition(zoneX,zoneZ,angle,radius);
    const enemyX=safePosition.x,enemyZ=safePosition.z;
    enemy.position.set(enemyX, terrainHeightAt(enemyX, enemyZ) + 4.45, enemyZ);
    enemy.castShadow = true; enemy.userData.health = 100; enemy.userData.cooldown = Math.random();
    scene.add(enemy); enemies.push(enemy);
  }
}

let boxSpawnSequence = 0;
function spawnBoxEnemy() {
  if (!matchActive || currentMode !== 'box' || eliminations >= arenaGoal) return;
  const variant = boxSpawnSequence++;
  const enemy = createEnemy(enemySkins[variant % enemySkins.length], variant);
  const boxSpawns = [[-25,-20],[0,-24],[25,-20],[-26,10],[26,10],[0,22]];
  const [offsetX, offsetZ] = boxSpawns[variant % boxSpawns.length];
  enemy.position.set(arenaCenter.x + offsetX, arenaFloorY + 4.45, arenaCenter.z + offsetZ);
  enemy.castShadow = true;
  enemy.userData.health = 100;
  enemy.userData.cooldown = .8 + Math.random();
  enemy.userData.boxEnemy = true;
  scene.add(enemy);
  enemies.push(enemy);
  updateCombatHud();
}

function spawnBoxEnemies(total = 5) {
  for (const enemy of enemies) scene.remove(enemy);
  enemies.length = 0;
  boxSpawnSequence = 0;
  for (let index = 0; index < total; index++) spawnBoxEnemy();
}

function spawnPickup(position, kind) {
  const color = kind === 'heal' ? 0x42e778 : kind === 'shield' ? 0x42c9f5 : 0xffd84a;
  const pickup = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .7 }));
  pickup.position.copy(position);
  pickup.userData.baseY = currentMode === 'box' ? arenaFloorY + 2.5 : terrainHeightAt(position.x, position.z) + 2.5;
  pickup.position.y = pickup.userData.baseY;
  pickup.userData.kind = kind;
  pickup.userData.phase = Math.random() * 6;
  scene.add(pickup); pickups.push(pickup);
}

function clearPickups() { for (const pickup of pickups) scene.remove(pickup); pickups.length = 0; }

let playerHealth = 100, playerShield = 50, ammo = 30, reserveAmmo = 120, eliminations = 0;
const weapons = [
  { id:'rifle', name:'Fusil Nova', rarity:'Rare', color:'#4b91ff', damage:34, fireRate:130, magazine:30, ammo:30, reserve:120, spread:0 },
  { id:'shotgun', name:'Pompe Titan', rarity:'Épique', color:'#b45cff', damage:22, pellets:6, fireRate:720, magazine:5, ammo:5, reserve:25, spread:.055 },
  { id:'pistol', name:'Pistolet Volt', rarity:'Atypique', color:'#5bdd72', damage:24, fireRate:240, magazine:16, ammo:16, reserve:64, spread:.012 },
  { id:'sniper', name:'Précision Cryo', rarity:'Légendaire', color:'#ffad32', damage:105, fireRate:1250, magazine:1, ammo:1, reserve:8, spread:0 }
];
for (const weapon of weapons) weapon.baseDamage = weapon.damage;
let activeWeaponIndex = 0;
const activeWeapon = () => weapons[activeWeaponIndex];

function renderInventory() {
  inventoryHud.innerHTML = weapons.map((weapon,index)=>`<div class="inventory-slot ${index===activeWeaponIndex?'active':''}" style="--rarity:${weapon.color}"><b>${index+1} · ${weapon.name}</b><span>${weapon.ammo}/${weapon.reserve}</span></div>`).join('');
  const weapon = activeWeapon(); weaponNameLabel.textContent = `${weapon.name} · ${weapon.rarity}`; weaponNameLabel.style.color = weapon.color;
  ammo = weapon.ammo; reserveAmmo = weapon.reserve;
}
function equipWeapon(index) { if (!weapons[index]) return; activeWeaponIndex=index; buildMode=false; reloading=false; reloadBar.classList.add('hidden'); renderInventory(); updateCombatHud(); flashNotice(`${activeWeapon().name.toUpperCase()} ÉQUIPÉ`); }
let buildMode = false, reloading = false, lastShot = 0, matchActive = false;
let reloadTimer = null;
let matchGeneration = 0;
let matchTime = 0, stormRadius = 400, openedChests = 0, currentMode = 'solo';
let arenaProgress = 0;
let boxDeaths = 0;
const arenaGoal = 15;
const stormPhases=[{time:20,radius:400},{time:80,radius:300},{time:145,radius:210},{time:205,radius:130},{time:260,radius:65}];
let dropState = 'grounded';
let dropVelocity = 0;
const raycaster = new THREE.Raycaster();

function updateCombatHud() {
  healthFill.style.width = `${Math.max(0, playerHealth)}%`; shieldFill.style.width = `${Math.max(0, playerShield)}%`;
  document.querySelector('#health-text').textContent = Math.ceil(playerHealth);
  document.querySelector('#shield-text').textContent = Math.ceil(playerShield);
  document.querySelector('#ammo').textContent = ammo; document.querySelector('#reserve-ammo').textContent = reserveAmmo;
  document.querySelector('#enemy-count').textContent = enemies.length; document.querySelector('#eliminations').textContent = eliminations;
}
function updateArenaHud() {
  const progress = Math.min(arenaGoal, currentMode === 'box' ? eliminations : arenaProgress);
  arenaGoalValue.textContent = progress;
  arenaTeamLabel.textContent = currentMode === 'box' ? 'ÉLIMINATIONS' : 'NOVA';
  arenaRivalLabel.textContent = currentMode === 'box' ? 'MORTS' : 'STRUCTURES';
  arenaTeamScore.textContent = currentMode === 'box' ? progress : progress >= arenaGoal ? '1' : '0';
  arenaBuildScore.textContent = currentMode === 'box' ? boxDeaths : progress;
  arenaGoalFill.style.width = `${progress / arenaGoal * 100}%`;
}
function flashNotice(text, duration = 1100) { notice.textContent = text; notice.classList.remove('hidden'); clearTimeout(flashNotice.timer); flashNotice.timer = setTimeout(() => notice.classList.add('hidden'), duration); }
function damagePlayer(amount) {
  if (dropState !== 'grounded') return;
  const blocked = Math.min(playerShield, amount); playerShield -= blocked; playerHealth -= amount - blocked; updateCombatHud();
  gameSound('hurt'); damageVignette.classList.add('active'); clearTimeout(damagePlayer.timer); damagePlayer.timer = setTimeout(() => damageVignette.classList.remove('active'), 140);
  if (playerHealth <= 0 && currentMode === 'box') {
    boxDeaths++;
    playerHealth = 100;
    playerShield = 50;
    camera.position.set(arenaCenter.x, arenaFloorY + 7, arenaCenter.z + 25);
    camera.rotation.set(0, 0, 0);
    updateArenaHud();
    updateCombatHud();
    flashNotice('RÉAPPARITION BOX PVP', 1300);
  } else if (playerHealth <= 0) finishMatch(false);
}
function reload() {
  const weapon=activeWeapon(); if (reloading || weapon.ammo === weapon.magazine || weapon.reserve === 0) return;
  const generation = matchGeneration;
  reloading = true; flashNotice('RECHARGEMENT...', 900); reloadBar.classList.remove('hidden');
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    if (generation !== matchGeneration || !matchActive) {
      reloading = false;
      reloadBar.classList.add('hidden');
      return;
    }
    const amount=Math.min(weapon.magazine-weapon.ammo,weapon.reserve);
    weapon.ammo+=amount; weapon.reserve-=amount; ammo=weapon.ammo; reserveAmmo=weapon.reserve;
    reloading=false; reloadTimer=null; reloadBar.classList.add('hidden');
    renderInventory(); updateCombatHud(); gameSound('pickup');
  }, weapon.id==='sniper'?1300:900);
}
function shoot() {
  const weapon=activeWeapon(); if (!matchActive || dropState !== 'grounded' || buildMode || reloading || performance.now()-lastShot<weapon.fireRate) return;
  if (weapon.ammo<=0) { reload(); return; }
  lastShot=performance.now(); weapon.ammo--; ammo=weapon.ammo; reserveAmmo=weapon.reserve; renderInventory(); updateCombatHud();
  gameSound('shot');
  weaponKick = .16;
  crosshair.classList.add('shooting'); setTimeout(() => crosshair.classList.remove('shooting'), 70);
  let hitEnemy=null; let totalDamage=0; const shots=weapon.pellets??1;
  for(let pellet=0;pellet<shots;pellet++) {
    const spread=weapon.spread??0;
    raycaster.setFromCamera(new THREE.Vector2((Math.random()-.5)*spread,(Math.random()-.5)*spread),camera);
    const hit=raycaster.intersectObjects(enemies,true)[0];
    if(!hit) continue;
    const target=hit.object.userData.enemyRoot??hit.object;
    if(!hasClearCombatLine(camera.position.x,camera.position.z,target.position.x,target.position.z,camera.position.y,target.position.y)) continue;
    if(hitEnemy&&hitEnemy!==target) continue;
    hitEnemy=target;
    totalDamage+=weapon.damage;
  }
  if (!hitEnemy) return;
  hitmarker.classList.remove('hidden'); setTimeout(() => hitmarker.classList.add('hidden'), 100);
  gameSound('hit');
  hitEnemy.userData.health -= totalDamage;
  const originalColor = hitEnemy.material.emissive.getHex(); hitEnemy.material.emissive.set(0xffffff);
  setTimeout(() => hitEnemy?.material?.emissive?.set(originalColor), 70);
  if (hitEnemy.userData.health <= 0) {
    const dropPosition = hitEnemy.position.clone();
    scene.remove(hitEnemy); enemies.splice(enemies.indexOf(hitEnemy), 1); eliminations++;
    gameSound('eliminate');
    spawnPickup(dropPosition, ['ammo', 'heal', 'shield'][Math.floor(Math.random() * 3)]);
    if (currentMode === 'box') {
      updateArenaHud();
      if (eliminations >= arenaGoal) finishMatch(true);
      else {
        flashNotice(`ÉLIMINATION BOX · ${eliminations}/${arenaGoal}`);
        const generation = matchGeneration;
        setTimeout(() => {
          if (generation === matchGeneration && matchActive && currentMode === 'box') spawnBoxEnemy();
        }, 650);
      }
    } else {
      flashNotice('ÉLIMINATION · BUTIN DISPONIBLE');
      if (!enemies.length) finishMatch(true);
    }
    updateCombatHud();
  }
}
function finishMatch(victory) {
  matchActive=false;controls.unlock();const xp=eliminations*120+openedChests*250+(victory?1000:0);credits+=Math.floor(xp/20);const totalXp=Number(localStorage.getItem('novaXP')??0)+xp;localStorage.setItem('novaXP',totalXp);localStorage.setItem('novaLevel',Math.floor(totalXp/1500)+1);saveShop();document.querySelector('#stats-title').textContent=victory?'VICTOIRE NOVA':'ÉLIMINÉ';document.querySelector('#stats-elims').textContent=eliminations;document.querySelector('#stats-time').textContent=`${Math.floor(matchTime/60)}:${String(Math.floor(matchTime%60)).padStart(2,'0')}`;document.querySelector('#stats-xp').textContent=xp;matchStats.classList.remove('hidden');overlay.classList.add('hidden');
}
function updateQuest() { questText.textContent = openedChests >= 2 ? 'Mission terminée !' : `Ouvre 2 coffres · ${openedChests}/2`; questProgress.style.width = `${Math.min(100, openedChests * 50)}%`; }
function openNearbyChest() {
  const chest = chests.find(item => !item.userData.opened && Math.hypot(camera.position.x - item.position.x, camera.position.z - item.position.z) < 7);
  if (!chest) return;
  chest.userData.opened = true; chest.rotation.z = -.22; chest.material.color.set(0x765324); chest.material.emissiveIntensity = 0;
  openedChests++;
  const chestWeapon = activeWeapon();
  chestWeapon.reserve += 35;
  reserveAmmo = chestWeapon.reserve;
  playerShield = Math.min(100, playerShield + 20);
  materialStock.wood += 60;
  materialStock.stone += 40;
  materialStock.metal += 25;
  materials = materialStock[selectedMaterial];
  spawnPickup(chest.position.clone().add(new THREE.Vector3(2, 0, 0)), 'heal');
  const rewardedWeapon=weapons[Math.floor(Math.random()*weapons.length)];rewardedWeapon.reserve+=rewardedWeapon.magazine;rewardedWeapon.damage=Math.min(rewardedWeapon.damage+2,rewardedWeapon.id==='sniper'?125:45);renderInventory();flashNotice(`${rewardedWeapon.name.toUpperCase()} AMÉLIORÉ`);
  flashNotice(openedChests === 2 ? 'MISSION TERMINÉE · +250 NOVA' : 'COFFRE OUVERT · BUTIN RÉCUPÉRÉ');
  if (openedChests === 2) { credits += 250; saveShop(); }
  updateQuest(); updateCombatHud(); updateBuildStatus();
}
function startMatch() {
  currentMode = ['solo', 'creative', 'box'][document.querySelector('#mode').selectedIndex] ?? 'solo';
  const arenaMode = currentMode !== 'solo';
  playerHealth = 100; playerShield = 50; ammo = 30; reserveAmmo = 120; eliminations = 0; buildMode = false;
  for (const weapon of weapons) {
    weapon.ammo=weapon.magazine;
    weapon.reserve=weapon.id==='rifle'?120:weapon.id==='shotgun'?25:weapon.id==='pistol'?64:8;
    weapon.damage=weapon.baseDamage;
  }
  activeWeaponIndex=0; renderInventory();
  materials = arenaMode ? 9999 : 500; matchActive = true; matchTime = 0; stormRadius = 400; openedChests = 0;
  materialStock.wood=arenaMode?9999:500;materialStock.stone=arenaMode?9999:300;materialStock.metal=arenaMode?9999:200;
  arenaProgress = 0;
  boxDeaths = 0;
  creativeArena.visible = arenaMode;
  arenaFloorMaterial.color.set(currentMode === 'box' ? 0x3f4652 : 0x246fd0);
  arenaFloorMaterial.emissive.set(currentMode === 'box' ? 0x211006 : 0x0b2e71);
  arenaWallMaterial.color.set(currentMode === 'box' ? 0x8f4b19 : 0x174c9b);
  arenaWallMaterial.emissive.set(currentMode === 'box' ? 0x5a2105 : 0x0b2b72);
  document.body.classList.toggle('creative-mode', arenaMode);
  document.body.classList.toggle('box-pvp-mode', currentMode === 'box');
  updateArenaHud();
  if (arenaMode) selectBuild('wall');
  busFlightTime = 0; novaBus.position.set(-460, 115, -180); novaBus.visible = true;
  dropState = currentMode === 'solo' ? 'bus' : 'grounded';
  document.body.classList.toggle('dropping', dropState !== 'grounded');
  if (dropState === 'bus') {
    camera.position.copy(novaBus.position).add(new THREE.Vector3(0, 8, 24));
    camera.rotation.set(-.14, 0, 0);
    dropPrompt.textContent = 'ESPACE · SAUTER DU BUS NOVA'; dropPrompt.classList.remove('hidden', 'gliding'); dropStats.classList.remove('hidden');
  } else {
    camera.position.set(arenaCenter.x, arenaFloorY + 7, arenaCenter.z + 25);
    camera.rotation.set(0, 0, 0);
    dropPrompt.classList.add('hidden'); dropStats.classList.add('hidden');
  }
  for (const chest of chests) { chest.userData.opened = false; chest.rotation.z = 0; chest.material.color.set(0xd99b22); chest.material.emissiveIntensity = .65; }
  clearPickups();
  if (currentMode === 'solo') spawnEnemies();
  else if (currentMode === 'box') spawnBoxEnemies();
  else { for (const enemy of enemies) scene.remove(enemy); enemies.length = 0; }
  setAerialMode(dropState === 'bus');
  updateQuest(); updateCombatHud(); updateBuildStatus();
  flashNotice(currentMode === 'creative'
    ? 'ARÈNE NOVA · 1 MUR · 2 SOL · 3 RAMPE · 6 CÔNE'
    : currentMode === 'box'
      ? 'BOX PVP · PREMIER À 15 ÉLIMINATIONS'
      : 'SURVIS ET ÉLIMINE LES ADVERSAIRES', 2200);
}

// Anneau de tempête.
const storm = new THREE.Mesh(new THREE.CylinderGeometry(400, 400, 90, 128, 1, true), new THREE.MeshBasicMaterial({ color: 0x8d45e8, transparent: true, opacity: .13, side: THREE.DoubleSide }));
storm.position.y = 25; scene.add(storm);

let aerialMode=false;
let aerialVisibility=null;
function setAerialMode(active){
  if(active===aerialMode)return;
  aerialMode=active;
  if(active){
    const keep=new Set([camera,skyDome,water,sunDisk,novaBus,aerialMap,windParticles,...clouds,...birds]);
    aerialVisibility=new Map();
    for(const child of scene.children){
      if(keep.has(child)||child.isLight)continue;
      aerialVisibility.set(child,child.visible);child.visible=false;
    }
    aerialMap.visible=true;
    for(const enemy of enemies)enemy.visible=false;
  }else{
    aerialMap.visible=false;
    if(aerialVisibility){for(const [child,visible] of aerialVisibility)child.visible=visible;aerialVisibility=null;}
    for(const enemy of enemies)enemy.visible=true;
  }
}

// Système de construction sur grille.
const buildTypes = {
  wall: { label: 'Mur', geometry: new THREE.BoxGeometry(8, 8, .45), y: 4 },
  floor: { label: 'Sol', geometry: new THREE.BoxGeometry(8, .45, 8), y: .25 },
  ramp: { label: 'Rampe', geometry: new THREE.BoxGeometry(8, .5, 10), y: 2.5, tilt: Math.PI / 7 },
  roof: { label: 'Toit', geometry: new THREE.ConeGeometry(5.7, 4, 4), y: 2 },
  cone: { label: 'Cône', geometry: new THREE.ConeGeometry(5.4, 4.5, 4), y: 2.25 }
};
let selectedBuild = 'wall';
let buildRotation = 0;
let materials = 500;
const materialTypes={wood:{label:'Bois',color:0xb88955,health:150,cost:10},stone:{label:'Pierre',color:0x85888d,health:300,cost:12},metal:{label:'Métal',color:0x55778d,health:500,cost:15}};
let selectedMaterial='wood';
const materialStock={wood:500,stone:300,metal:200};
const defaultBuildKeys = { wall: 'mouse4', floor: '2', ramp: 'mouse5', rotate: 'r' };
let buildKeys = { ...defaultBuildKeys, ...JSON.parse(localStorage.getItem('novaBuildKeys') ?? '{}') };
// Le clic gauche reste réservé au tir et au placement.
for (const action of Object.keys(buildKeys)) {
  if (buildKeys[action] === 'mouse1') buildKeys[action] = defaultBuildKeys[action];
}
const placedBuilds = [];
function clearPlacedBuilds() {
  for (const piece of placedBuilds) scene.remove(piece);
  placedBuilds.length = 0;
}
window.__novaDiagnostics = () => ({
  mode: currentMode,
  enemies: enemies.length,
  invalidEnemyPositions: enemies.filter(enemy => currentMode === 'box'
    ? !isInsideCreativeArena(enemy.position.x, enemy.position.z)
    : isStaticPositionBlocked(enemy.position.x, enemy.position.z, 1.6)).length,
  citadelBlocksShots: !hasClearCombatLine(15, -102, 130, -102),
  pickups: pickups.length,
  builds: placedBuilds.length,
  arenaVisible: creativeArena.visible,
  arenaProgress,
  staticObstacles: staticObstacles.length,
  obstacleCells: obstacleGrid.size,
  collisionCandidatesAtSpawn: nearbyStaticObstacles(0, 70, 1).size,
  sceneChildren: scene.children.length,
  geometries: renderer.info.memory.geometries,
  textures: renderer.info.memory.textures,
  drawCalls: renderer.info.render.calls,
  triangles: renderer.info.render.triangles
});
const previewMaterial = new THREE.MeshStandardMaterial({
  color: 0x55d8ff,
  emissive: 0x126b8c,
  emissiveIntensity: .45,
  transparent: true,
  opacity: .24,
  depthWrite: false,
  side: THREE.DoubleSide
});
let buildPreview = new THREE.Mesh(buildTypes.wall.geometry, previewMaterial);
scene.add(buildPreview);

function selectBuild(type) {
  selectedBuild = type;
  buildPreview.geometry = buildTypes[type].geometry;
  document.querySelectorAll('[data-arena-build]').forEach(button => button.classList.toggle('active', button.dataset.arenaBuild === type));
  updateBuildStatus();
}

function updateBuildStatus() {
  materials=materialStock[selectedMaterial];
  buildStatus.textContent = `Construction : ${buildTypes[selectedBuild].label} · Matériaux : ${materials}`;
  previewMaterial.color.set(materials >= 10 ? 0x55d8ff : 0xff4455);
  buildHelp.innerHTML = `<b>${displayKey(buildKeys.wall)}</b> Mur · <b>${displayKey(buildKeys.ramp)}</b> Rampe · <b>5</b> Toit · <b>6</b> Cône · <b>T</b> Matériau · <b>G</b> Modifier · <b>X</b> Détruire`;
}

function displayKey(key) {
  const names = { ' ': 'ESPACE', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', mouse1: 'CLIC G', mouse2: 'CLIC D', mouse3: 'MOLETTE', mouse4: 'SOURIS 4', mouse5: 'SOURIS 5' };
  return names[key] ?? key.toUpperCase();
}

function updateBuildPreview() {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  direction.y = 0;
  direction.normalize();
  const distance = selectedBuild === 'floor' ? 10 : 12;
  const gridX=Math.round((camera.position.x+direction.x*distance)/8)*8;
  const gridZ=Math.round((camera.position.z+direction.z*distance)/8)*8;
  const buildGround = currentMode !== 'solo' && isInsideCreativeArena(gridX, gridZ) ? arenaFloorY : terrainHeightAt(gridX,gridZ);
  buildPreview.position.set(gridX,buildGround+buildTypes[selectedBuild].y,gridZ);
  buildPreview.rotation.set(0, buildRotation, 0);
  if (selectedBuild === 'ramp') buildPreview.rotation.x = -buildTypes.ramp.tilt;
  buildPreview.visible = controls.isLocked && buildMode;
}

function placeBuild() {
  const material=materialTypes[selectedMaterial];
  if (!controls.isLocked || materialStock[selectedMaterial] < material.cost) return;
  const pieceMaterial = new THREE.MeshStandardMaterial({ color:material.color,roughness:selectedMaterial==='metal'?.45:.9,metalness:selectedMaterial==='metal'?.55:0 });
  const piece = new THREE.Mesh(buildTypes[selectedBuild].geometry, pieceMaterial);
  piece.position.copy(buildPreview.position);
  piece.rotation.copy(buildPreview.rotation);
  piece.castShadow = piece.receiveShadow = true;
  piece.userData.buildType = selectedBuild;
  piece.userData.health=material.health; piece.userData.maxHealth=material.health; piece.userData.materialType=selectedMaterial;
  scene.add(piece);
  addBuildDetails(piece, selectedBuild);
  placedBuilds.push(piece);
  materialStock[selectedMaterial]-=material.cost; materials=materialStock[selectedMaterial];
  gameSound('build');
  if (currentMode === 'creative' && arenaProgress < arenaGoal) {
    arenaProgress++;
    updateArenaHud();
    if (arenaProgress === arenaGoal) {
      gameSound('eliminate');
      flashNotice('OBJECTIF ATTEINT · ARÈNE NOVA TERMINÉE !', 2600);
    }
  }
  updateBuildStatus();
}

document.querySelectorAll('[data-arena-build]').forEach(button => button.addEventListener('click', event => {
  event.stopPropagation();
  buildMode = true;
  selectBuild(button.dataset.arenaBuild);
  if (controls.isLocked) flashNotice(`${buildTypes[selectedBuild].label.toUpperCase()} SÉLECTIONNÉ`);
}));

function targetBuild(){raycaster.setFromCamera(new THREE.Vector2(0,0),camera);return raycaster.intersectObjects(placedBuilds,true).map(hit=>placedBuilds.find(piece=>piece===hit.object||piece===hit.object.parent)).find(Boolean);}
function damageTargetBuild(){const piece=targetBuild();if(!piece)return;piece.userData.health-=100;flashNotice(`STRUCTURE ${Math.max(0,piece.userData.health)} PV`);if(piece.userData.health<=0){scene.remove(piece);placedBuilds.splice(placedBuilds.indexOf(piece),1);}}
function editTargetBuild(){const piece=targetBuild();if(!piece)return;if(piece.userData.buildType==='wall'){piece.scale.y=piece.scale.y===1?.55:1;flashNotice('MUR MODIFIÉ');}else{piece.rotation.y+=Math.PI/2;flashNotice('STRUCTURE TOURNÉE');}}

function addBuildDetails(piece, type) {
  const group = new THREE.Group();
  const beamMaterial = new THREE.MeshStandardMaterial({ color: 0x6f4728, roughness: 1 });
  const beam = (sx, sy, sz, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), beamMaterial);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
  };

  if (type === 'wall') {
    beam(.35, 8, .7, -3.6, 0, 0); beam(.35, 8, .7, 3.6, 0, 0);
    beam(8, .35, .7, 0, -3.6, 0); beam(8, .35, .7, 0, 3.6, 0);
    beam(.3, 10.5, .75, 0, 0, 0); group.children.at(-1).rotation.z = Math.PI / 4;
  } else if (type === 'floor') {
    for (const offset of [-3.5, 0, 3.5]) beam(8, .35, .45, 0, .25, offset);
  } else {
    for (const offset of [-3.5, 3.5]) beam(.4, .55, 10, offset, .3, 0);
  }
  piece.add(group);
}

function rampHeightAt(piece, x, z) {
  const local = piece.worldToLocal(new THREE.Vector3(x, 0, z));
  if (Math.abs(local.x) > 4.2 || Math.abs(local.z) > 5.2) return null;
  return piece.position.y + 2.5 - (local.z / 10) * 5;
}

function walkableHeight(x, z) {
  let height = currentMode !== 'solo' && isInsideCreativeArena(x, z) ? arenaFloorY + 7 : terrainHeightAt(x, z) + 7;
  for (const piece of placedBuilds) {
    const type = piece.userData.buildType;
    if (type === 'floor' && Math.abs(x - piece.position.x) < 4.2 && Math.abs(z - piece.position.z) < 4.2) {
      height = Math.max(height, piece.position.y + 6.8);
    }
    if (type === 'ramp') {
      const rampHeight = rampHeightAt(piece, x, z);
      if (rampHeight !== null) height = Math.max(height, rampHeight + 4.5);
    }
    if ((type === 'roof' || type === 'cone') && Math.abs(x-piece.position.x)<5 && Math.abs(z-piece.position.z)<5) height=Math.max(height,piece.position.y+4.5);
  }
  return height;
}

function blockedByWall(from, to) {
  for (const piece of placedBuilds) {
    if (piece.userData.buildType !== 'wall') continue;
    const local = piece.worldToLocal(new THREE.Vector3(to.x, piece.position.y, to.z));
    if (Math.abs(local.x) < 4.6 && Math.abs(local.z) < 1.2 && Math.abs(camera.position.y - piece.position.y) < 5) return true;
  }
  return false;
}

function isBlockedByPlacedWall(x, z, height = 4) {
  for (const piece of placedBuilds) {
    if (piece.userData.buildType !== 'wall') continue;
    const local = piece.worldToLocal(new THREE.Vector3(x, piece.position.y, z));
    if (Math.abs(local.x) < 4.9 && Math.abs(local.z) < 1.5 && Math.abs(height - piece.position.y) < 7) return true;
  }
  return false;
}

function segmentIntersectsObstacle(fromX, fromZ, toX, toZ, obstacle, padding = 0) {
  const center = obstacle.mesh.position;
  const minX = center.x - obstacle.radiusX - padding;
  const maxX = center.x + obstacle.radiusX + padding;
  const minZ = center.z - obstacle.radiusZ - padding;
  const maxZ = center.z + obstacle.radiusZ + padding;
  const dx = toX - fromX, dz = toZ - fromZ;
  let minimum = 0, maximum = 1;
  for (const [start, delta, lower, upper] of [[fromX, dx, minX, maxX], [fromZ, dz, minZ, maxZ]]) {
    if (Math.abs(delta) < 1e-6) {
      if (start < lower || start > upper) return false;
      continue;
    }
    const first = (lower - start) / delta, second = (upper - start) / delta;
    const near = Math.min(first, second), far = Math.max(first, second);
    minimum = Math.max(minimum, near);
    maximum = Math.min(maximum, far);
    if (minimum > maximum) return false;
  }
  return maximum > .03 && minimum < .97;
}

function hasClearCombatLine(fromX, fromZ, toX, toZ, fromY = terrainHeightAt(fromX, fromZ) + 4, toY = terrainHeightAt(toX, toZ) + 4) {
  if (currentMode !== 'box' && staticObstacles.some(obstacle => segmentIntersectsObstacle(fromX, fromZ, toX, toZ, obstacle, .25))) return false;
  const samples = Math.max(6, Math.ceil(Math.hypot(toX - fromX, toZ - fromZ) / 2.5));
  for (let sample = 1; sample < samples; sample++) {
    const progress = sample / samples;
    const x = THREE.MathUtils.lerp(fromX, toX, progress);
    const z = THREE.MathUtils.lerp(fromZ, toZ, progress);
    const shotHeight = THREE.MathUtils.lerp(fromY, toY, progress);
    if (currentMode !== 'box' && terrainHeightAt(x, z) + .8 > shotHeight) return false;
    if (isBlockedByPlacedWall(x, z, currentMode === 'box' ? arenaFloorY + 4 : terrainHeightAt(x, z) + 4)) return false;
  }
  return true;
}

function blockedByWorld(to) {
  const centerX=Math.floor(to.x/obstacleCellSize),centerZ=Math.floor(to.z/obstacleCellSize);
  for(let cellX=centerX-1;cellX<=centerX+1;cellX++) {
    for(let cellZ=centerZ-1;cellZ<=centerZ+1;cellZ++) {
      for(const obstacle of obstacleGrid.get(`${cellX}:${cellZ}`)??[]) {
        const position=obstacle.mesh.position;
        if(Math.abs(to.x-position.x)<obstacle.radiusX+.5&&Math.abs(to.z-position.z)<obstacle.radiusZ+.5&&Math.abs(camera.position.y-position.y)<14)return true;
      }
    }
  }
  for (const enemy of enemies) if (Math.hypot(to.x-enemy.position.x,to.z-enemy.position.z)<2.4) return true;
  return false;
}

const controls = new PointerLockControls(camera, renderer.domElement);
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = Math.PI - 0.12;
const defaultSettings = { sensitivity: 1, fov: 70, volume: 50, headbob: 50, quality: 'high', showHelp: true, showFps: true, showHat: true, showWeapon: true, fpsLimit: 60, difficulty:'normal' };
let gameSettings = { ...defaultSettings, ...JSON.parse(localStorage.getItem('novaSettings') ?? '{}') };

function applySettings() {
  const realistic = gameSettings.quality === 'realistic';
  controls.pointerSpeed = Number(gameSettings.sensitivity);
  camera.fov = Number(gameSettings.fov);
  camera.updateProjectionMatrix();
  buildHelp.style.display = gameSettings.showHelp ? '' : 'none';
  fpsCounter.style.display = gameSettings.showFps ? '' : 'none';
  const lobbyHat = document.querySelector('.avatar-hat');
  const lobbyWeapon = document.querySelector('.avatar-weapon');
  if (lobbyHat) lobbyHat.style.display = gameSettings.showHat ? '' : 'none';
  if (lobbyWeapon) lobbyWeapon.style.display = gameSettings.showWeapon ? '' : 'none';
  viewModel.visible = Boolean(gameSettings.showWeapon) && matchActive && dropState === 'grounded';
  const ratios = { low: 0.75, medium: 1, high: Math.min(devicePixelRatio, 2), realistic: Math.min(devicePixelRatio, 2) };
  renderer.setPixelRatio(ratios[gameSettings.quality] ?? 1);
  renderer.shadowMap.enabled = gameSettings.quality !== 'low';
  renderer.toneMappingExposure = realistic ? .96 : 1.08;
  scene.fog.near = realistic ? 240 : 190;
  scene.fog.far = realistic ? 900 : 760;
  camera.far = realistic ? 1200 : 900;
  camera.updateProjectionMatrix();
  sun.intensity = realistic ? 3.15 : 2.65;
  sun.shadow.mapSize.set(realistic ? 4096 : 2048, realistic ? 4096 : 2048);
  water.material.roughness = realistic ? .06 : .12;
  water.material.clearcoat = realistic ? 1 : .8;
  renderer.setSize(host.clientWidth, host.clientHeight);
}

function fillSettingsForm() {
  document.querySelector('#sensitivity').value = gameSettings.sensitivity;
  document.querySelector('#fov').value = gameSettings.fov;
  document.querySelector('#volume').value = gameSettings.volume;
  document.querySelector('#headbob').value = gameSettings.headbob;
  document.querySelector('#quality').value = gameSettings.quality;
  document.querySelector('#show-help').checked = gameSettings.showHelp;
  document.querySelector('#show-fps').checked = gameSettings.showFps;
  document.querySelector('#show-hat').checked = gameSettings.showHat;
  document.querySelector('#show-weapon').checked = gameSettings.showWeapon;
  document.querySelector('#fps-limit').value = String(gameSettings.fpsLimit);
  document.querySelector('#difficulty').value = gameSettings.difficulty;
  refreshKeybindButtons();
  updateSettingLabels();
}

function refreshKeybindButtons() {
  for (const button of document.querySelectorAll('.keybind-button')) {
    button.textContent = displayKey(buildKeys[button.dataset.bind]);
    button.classList.remove('listening');
  }
}

let listeningForBind = null;
for (const button of document.querySelectorAll('.keybind-button')) {
  button.addEventListener('click', () => {
    refreshKeybindButtons();
    listeningForBind = button.dataset.bind;
    button.textContent = 'Appuie...';
    button.classList.add('listening');
  });
}

addEventListener('keydown', event => {
  if (!listeningForBind) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const newKey = event.key.toLowerCase();
  const duplicate = Object.entries(buildKeys).find(([action, key]) => action !== listeningForBind && key === newKey);
  if (duplicate) buildKeys[duplicate[0]] = buildKeys[listeningForBind];
  buildKeys[listeningForBind] = newKey;
  listeningForBind = null;
  refreshKeybindButtons();
}, true);

addEventListener('mousedown', event => {
  if (!listeningForBind) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const mouseKey = `mouse${event.button + 1}`;
  if (mouseKey === 'mouse1') {
    flashNotice('LE CLIC GAUCHE EST RÉSERVÉ AU TIR');
    listeningForBind = null;
    refreshKeybindButtons();
    return;
  }
  const duplicate = Object.entries(buildKeys).find(([action, key]) => action !== listeningForBind && key === mouseKey);
  if (duplicate) buildKeys[duplicate[0]] = buildKeys[listeningForBind];
  buildKeys[listeningForBind] = mouseKey;
  listeningForBind = null;
  refreshKeybindButtons();
}, true);

function updateSettingLabels() {
  document.querySelector('#sensitivity-value').textContent = Number(document.querySelector('#sensitivity').value).toFixed(1);
  document.querySelector('#fov-value').textContent = `${document.querySelector('#fov').value}°`;
  document.querySelector('#volume-value').textContent = `${document.querySelector('#volume').value}%`;
  document.querySelector('#headbob-value').textContent = `${document.querySelector('#headbob').value}%`;
}

for (const id of ['sensitivity', 'fov', 'volume', 'headbob']) document.querySelector(`#${id}`).addEventListener('input', updateSettingLabels);
document.querySelector('#open-settings').addEventListener('click', () => { fillSettingsForm(); settingsPanel.classList.remove('hidden'); });
document.querySelector('#close-settings').addEventListener('click', () => {
  gameSettings = {
    sensitivity: Number(document.querySelector('#sensitivity').value),
    fov: Number(document.querySelector('#fov').value),
    volume: Number(document.querySelector('#volume').value),
    headbob: Number(document.querySelector('#headbob').value),
    quality: document.querySelector('#quality').value,
    showHelp: document.querySelector('#show-help').checked,
    showFps: document.querySelector('#show-fps').checked,
    showHat: document.querySelector('#show-hat').checked,
    showWeapon: document.querySelector('#show-weapon').checked,
    fpsLimit: Number(document.querySelector('#fps-limit').value),
    difficulty: document.querySelector('#difficulty').value
  };
  localStorage.setItem('novaSettings', JSON.stringify(gameSettings));
  localStorage.setItem('novaBuildKeys', JSON.stringify(buildKeys));
  applySettings();
  updateBuildStatus();
  settingsPanel.classList.add('hidden');
  if(matchActive&&!controls.isLocked)pauseMenu.classList.remove('hidden');
});
document.querySelector('#reset-settings').addEventListener('click', () => { gameSettings = { ...defaultSettings }; buildKeys = { ...defaultBuildKeys }; fillSettingsForm(); });
applySettings();
updateBuildStatus();
overlay.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => overlay.classList.add('hidden'));
controls.addEventListener('unlock', () => { keys.clear(); if(matchActive){pauseMenu.classList.remove('hidden');overlay.classList.add('hidden');}else{overlay.textContent='Clique pour continuer';overlay.classList.remove('hidden');} });
function launchOnlineMatch(match) {
  sessionStorage.setItem('novaMatch', JSON.stringify(match));
  lobby.classList.add('hidden');
  document.body.classList.add('playing');
  reset();
  startMatch();
  controls.lock();
  viewModel.visible = false;
  flashNotice(`PARTIE ${match.id.slice(0, 8).toUpperCase()} · ${match.players.length} JOUEUR${match.players.length > 1 ? 'S' : ''}`);
}

playButton.addEventListener('click', async () => {
  if (!novaUser) {
    showAccount(true);
    return;
  }
  if (matchmaking) {
    await fetch('/api/matchmaking/leave', { method: 'POST' });
    matchmaking = false;
    playButton.disabled = false;
    playButton.textContent = 'JOUER';
    return;
  }
  connectNovaOnline();
  matchmaking = true;
  playButton.textContent = 'RECHERCHE…';
  try {
    const response = await fetch('/api/matchmaking/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: selectedOnlineMode() })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Matchmaking indisponible.');
    playButton.textContent = `RECHERCHE · ${data.players} JOUEUR${data.players > 1 ? 'S' : ''}`;
  } catch (error) {
    matchmaking = false;
    playButton.textContent = 'JOUER';
    flashNotice(error.message);
  }
});
const keys = new Set();
let verticalVelocity = 0;
let grounded = true;
addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (key === 'm' && !e.repeat && controls.isLocked) {
    worldMap.classList.toggle('hidden');
    return;
  }
  keys.add(key);
  if (e.repeat) return;
  if ((currentMode === 'creative' || (currentMode === 'box' && buildMode)) && ({ '1': 'wall', '2': 'floor', '3': 'ramp', '6': 'cone' })[key]) {
    buildMode = true;
    selectBuild(({ '1': 'wall', '2': 'floor', '3': 'ramp', '6': 'cone' })[key]);
    flashNotice(`${buildTypes[selectedBuild].label.toUpperCase()} SÉLECTIONNÉ`);
    return;
  }
  if (key === buildKeys.wall) selectBuild('wall');
  if (key === buildKeys.floor) selectBuild('floor');
  if (key === buildKeys.ramp) selectBuild('ramp');
  if (key === buildKeys.rotate) buildRotation += Math.PI / 2;
  if (key === '5' && buildMode) selectBuild('roof');
  if (key === '6' && buildMode) selectBuild('cone');
  if (key === 't' && buildMode) { const order=['wood','stone','metal']; selectedMaterial=order[(order.indexOf(selectedMaterial)+1)%order.length]; updateBuildStatus(); flashNotice(materialTypes[selectedMaterial].label.toUpperCase()); }
  if (key === 'g' && buildMode) editTargetBuild();
  if (key === 'x' && buildMode) damageTargetBuild();
  if (key === 'b') { buildMode = !buildMode; flashNotice(buildMode ? 'MODE CONSTRUCTION' : 'MODE COMBAT'); updateBuildStatus(); }
  if (key === '4') { buildMode = false; flashNotice('ARME ÉQUIPÉE'); updateBuildPreview(); }
  if (['1','2','3','4'].includes(key) && !buildMode) equipWeapon(Number(key)-1);
  if (key === 'r' && !buildMode) reload();
  if (key === ' ' && dropState === 'bus') {
    dropState = 'falling'; dropVelocity = -18; novaBus.visible = true;
    dropPrompt.textContent = 'CHUTE LIBRE · LE PLANEUR S’OUVRE AUTOMATIQUEMENT'; dropPrompt.classList.add('gliding');
    return;
  }
  if (key === ' ' && grounded && controls.isLocked && dropState === 'grounded') { verticalVelocity = 12.5; grounded = false; }
  if (key === 'e' && controls.isLocked) openNearbyChest();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('mousedown', event => {
  const mouseKey = `mouse${event.button + 1}`;
  if (mouseKey === buildKeys.wall) { buildMode = true; selectBuild('wall'); flashNotice('MUR SÉLECTIONNÉ'); return; }
  if (mouseKey === buildKeys.floor) { buildMode = true; selectBuild('floor'); flashNotice('SOL SÉLECTIONNÉ'); return; }
  if (mouseKey === buildKeys.ramp) { buildMode = true; selectBuild('ramp'); flashNotice('RAMPE SÉLECTIONNÉE'); return; }
  if (mouseKey === buildKeys.rotate) { buildRotation += Math.PI / 2; return; }
  if (event.button === 2) { buildMode = false; flashNotice('ARME ÉQUIPÉE'); return; }
  if (event.button === 0) buildMode ? placeBuild() : shoot();
});
renderer.domElement.addEventListener('wheel', event => {
  if (event.deltaY > 0) { buildMode = false; flashNotice('ARME ÉQUIPÉE'); }
}, { passive: true });
renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());
renderer.domElement.addEventListener('auxclick', event => event.preventDefault());

function reset() {
  setAerialMode(false);
  matchGeneration++;
  matchActive = false;
  clearTimeout(reloadTimer);
  reloadTimer = null;
  reloading = false;
  clearPickups();
  for (const enemy of enemies) scene.remove(enemy);
  enemies.length = 0;
  clearPlacedBuilds();
  novaBus.visible = false;
  glider.visible = false;
  playerModel.visible = false;
  creativeArena.visible = false;
  document.body.classList.remove('creative-mode');
  document.body.classList.remove('box-pvp-mode');
  buildPreview.visible = false;
  dropState = 'grounded';
  dropVelocity = 0;
  pauseMenu.classList.add('hidden');
  reloadBar.classList.add('hidden');
  dropPrompt.classList.add('hidden');
  dropStats.classList.add('hidden');
  camera.position.set(0, terrainHeightAt(0, 70) + 7, 70);
  camera.rotation.set(0, 0, 0);
  verticalVelocity = 0;
  grounded = true;
  smoothSpeed = 0;
  document.body.classList.remove('dropping');
  keys.clear();
}
document.querySelector('#restart').addEventListener('click', () => {
  controls.unlock();
  reset();
  overlay.classList.add('hidden');
  lobby.classList.remove('hidden');
  document.body.classList.remove('playing');
  viewModel.visible = false;
});
document.querySelector('#fullscreen').addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.querySelector('.game-shell').requestFullscreen();
    else await document.exitFullscreen();
  } catch { flashNotice('PLEIN ÉCRAN INDISPONIBLE'); }
});
document.querySelector('#stats-lobby').addEventListener('click',()=>{matchStats.classList.add('hidden');reset();lobby.classList.remove('hidden');document.body.classList.remove('playing');renderShop();});
document.querySelector('#resume-game').addEventListener('click',()=>{pauseMenu.classList.add('hidden');controls.lock();});
document.querySelector('#pause-settings').addEventListener('click',()=>{pauseMenu.classList.add('hidden');fillSettingsForm();settingsPanel.classList.remove('hidden');});
document.querySelector('#leave-game').addEventListener('click',()=>{matchActive=false;pauseMenu.classList.add('hidden');reset();lobby.classList.remove('hidden');document.body.classList.remove('playing');renderShop();});

function currentLocation(x, z) {
  if (Math.hypot(x - 8, z + 18) < 58) return 'Nova City · Tour Nova';
  if (Math.hypot(x + 242, z - 148) < 52) return 'Temple Ancien';
  if (Math.hypot(x + 315, z + 18) < 48) return 'Île du Phare';
  if (Math.hypot(x - 278, z - 215) < 65) return 'Lagon Bleu';
  if (x < -80 && z < -80) return 'Pics Cryo';
  if (z > 150) return 'Canyons Solaires';
  if (x > 190 && z > 70) return 'Lagons Azur';
  if (Math.hypot(x - 155, z + 25) < 90) return 'Cratère Nova';
  if (Math.hypot(x + 112, z + 60) < 48) return 'Port Aurore';
  if (Math.hypot(x - 72, z + 102) < 48) return 'Citadelle Nova';
  if (Math.hypot(x - 95, z - 105) < 58) return 'Ferme Solaire';
  if (Math.hypot(x, z) < 35) return 'Carrefour Central';
  return 'Prairies Sauvages';
}

const clock = new THREE.Clock();
let cameraBobTime = 0;
let smoothSpeed = 0;
let fpsFrames = 0;
let fpsElapsed = 0;
let lastRenderedAt = 0;
function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  const fpsLimit = Number(gameSettings.fpsLimit);
  const minimumFrameTime = fpsLimit > 0 ? 1000 / fpsLimit : 0;
  if (minimumFrameTime && now - lastRenderedAt < minimumFrameTime) return;
  lastRenderedAt = now - (minimumFrameTime ? (now - lastRenderedAt) % minimumFrameTime : 0);
  const dt = Math.min(clock.getDelta(), .04);
  viewModel.visible = Boolean(gameSettings.showWeapon) && document.body.classList.contains('playing') && controls.isLocked && dropState === 'grounded';
  const facing = THREE.MathUtils.euclideanModulo(camera.rotation.y, Math.PI * 2) / (Math.PI * 2);
  compassStrip.style.transform = `translateX(${(facing - .5) * -288}px)`;
  fpsFrames++;
  fpsElapsed += dt;
  if (fpsElapsed >= .5) {
    const fps = Math.round(fpsFrames / fpsElapsed);
    fpsCounter.textContent = `FPS : ${fps}`;
    fpsCounter.style.color = fps >= 50 ? '#6fffa1' : fps >= 30 ? '#ffe56b' : '#ff6b76';
    fpsFrames = 0; fpsElapsed = 0;
  }
  if (controls.isLocked) {
    if (dropState === 'bus') {
      camera.position.copy(novaBus.position).add(new THREE.Vector3(0, 8, 24));
      setAerialMode(true);
      altitudeLabel.textContent = `${Math.max(0,Math.round(camera.position.y-aerialMap.position.y))} m`;
      fallSpeedLabel.textContent = 'BUS';
    }
    const previousPosition = camera.position.clone();
    const forwardInput = Number(keys.has('w') || keys.has('z')) - Number(keys.has('s'));
    const sideInput = Number(keys.has('d')) - Number(keys.has('a') || keys.has('q'));
    const inputLength = Math.hypot(forwardInput, sideInput);
    const moving = inputLength > 0;
    const sprinting = moving && keys.has('shift');
    const desiredSpeed = moving ? (sprinting ? 68 : 42) : 0;
    smoothSpeed = THREE.MathUtils.lerp(smoothSpeed, desiredSpeed, Math.min(1, dt * 9));
    const speed = smoothSpeed * dt;
    if (moving && dropState !== 'bus') {
      controls.moveForward((forwardInput / inputLength) * speed);
      controls.moveRight((sideInput / inputLength) * speed);
    }
    const islandDistance = Math.hypot(camera.position.x, camera.position.z);
    if (islandDistance > 405) {
      camera.position.x = previousPosition.x;
      camera.position.z = previousPosition.z;
    }
    if (currentMode !== 'solo' && !isInsideCreativeArena(camera.position.x, camera.position.z)) {
      camera.position.x = previousPosition.x;
      camera.position.z = previousPosition.z;
    }
    if (blockedByWall(previousPosition, camera.position) || (currentMode === 'solo' && blockedByWorld(camera.position))) {
      camera.position.x = previousPosition.x;
      camera.position.z = previousPosition.z;
    }
    const targetHeight = walkableHeight(camera.position.x, camera.position.z);
    if (moving) cameraBobTime += dt * (sprinting ? 13 : 9);
    const bobAmount = (Number(gameSettings.headbob) / 100) * (moving ? (sprinting ? .34 : .2) : 0);
    if (dropState === 'falling' || dropState === 'gliding') {
      const heightAboveGround = camera.position.y - targetHeight;
      setAerialMode(heightAboveGround > 72);
      if (heightAboveGround < 36 && dropState === 'falling') {
        dropState = 'gliding'; dropVelocity = -7;
        dropPrompt.textContent = 'PLANEUR NOVA DÉPLOYÉ'; flashNotice('PLANEUR DÉPLOYÉ');
      }
      glider.visible = dropState === 'gliding';
      altitudeLabel.textContent = `${Math.max(0, Math.round(heightAboveGround))} m`;
      fallSpeedLabel.textContent = `${Math.round(Math.abs(dropVelocity) * 6)} km/h`;
      dropVelocity = Math.max(dropState === 'gliding' ? -7 : -28, dropVelocity - 15 * dt);
      camera.position.y += dropVelocity * dt;
      if (moving) {
        controls.moveForward((forwardInput / inputLength) * dt * 20);
        controls.moveRight((sideInput / inputLength) * dt * 20);
      }
      if (camera.position.y <= targetHeight) {
        camera.position.y = targetHeight; dropState = 'grounded'; grounded = true; dropVelocity = 0;
        setAerialMode(false);
        document.body.classList.remove('dropping');
        dropPrompt.classList.add('hidden'); flashNotice('ATTERRISSAGE · BONNE CHANCE !', 1500);
        dropStats.classList.add('hidden'); glider.visible = false;
      }
    } else if (!grounded || verticalVelocity > 0) {
      verticalVelocity -= 28 * dt;
      camera.position.y += verticalVelocity * dt;
      if (camera.position.y <= targetHeight) { camera.position.y = targetHeight; verticalVelocity = 0; grounded = true; }
    } else {
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetHeight + Math.sin(cameraBobTime) * bobAmount, Math.min(1, dt * 12));
    }
    const targetFov = Number(gameSettings.fov) + (sprinting ? 7 : 0);
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, dt * 7));
    camera.updateProjectionMatrix();
    weaponKick = THREE.MathUtils.lerp(weaponKick, 0, Math.min(1, dt * 16));
    const weaponBob = moving ? Math.sin(cameraBobTime) * .012 : 0;
    viewModel.position.set(
      Math.cos(cameraBobTime * .5) * (moving ? .006 : 0),
      -.42 + weaponBob * .25,
      -.72 + weaponKick * .2
    );
    viewModel.rotation.z = THREE.MathUtils.lerp(viewModel.rotation.z, sideInput * -.012, Math.min(1, dt * 8));
  } else {
    smoothSpeed = THREE.MathUtils.lerp(smoothSpeed, 0, Math.min(1, dt * 9));
  }
  if (matchActive) {
    matchTime += dt;
    busFlightTime += dt;
    if (busFlightTime < 42) {
      novaBus.position.x += dt * 27;
      novaBus.position.z += dt * 9;
      novaBus.position.y = 115 + Math.sin(busFlightTime * .8) * 2;
      novaBus.rotation.z = Math.sin(busFlightTime * .55) * .025;
      balloon.rotation.y += dt * .08;
    } else novaBus.visible = false;
    if(currentMode!=='solo')stormRadius=400;else{let current=stormPhases[0],next=stormPhases.at(-1);for(let i=0;i<stormPhases.length-1;i++){if(matchTime>=stormPhases[i].time&&matchTime<stormPhases[i+1].time){current=stormPhases[i];next=stormPhases[i+1];break;}}const progress=THREE.MathUtils.clamp((matchTime-current.time)/(next.time-current.time),0,1);stormRadius=THREE.MathUtils.lerp(current.radius,next.radius,progress);}
    storm.scale.set(stormRadius / 400, 1, stormRadius / 400);
    for (const enemy of enemies) {
      const dx = camera.position.x - enemy.position.x, dz = camera.position.z - enemy.position.z, distance = Math.hypot(dx, dz);
      if (distance < 75 && distance > 7) {
        const difficultySpeed={easy:3.7,normal:5,hard:6.4}[gameSettings.difficulty]??5;
        const stepX=dx/distance*dt*difficultySpeed,stepZ=dz/distance*dt*difficultySpeed;
        const nextX=enemy.position.x+stepX,nextZ=enemy.position.z+stepZ;
        const blocked=(x,z)=>currentMode === 'box'
          ? !isInsideCreativeArena(x,z)||isBlockedByPlacedWall(x,z,enemy.position.y)
          : isStaticPositionBlocked(x,z,1.7)||isBlockedByPlacedWall(x,z,enemy.position.y);
        if(!blocked(nextX,nextZ)){
          enemy.position.x=nextX;enemy.position.z=nextZ;
        }else if(!blocked(nextX,enemy.position.z)){
          enemy.position.x=nextX;
        }else if(!blocked(enemy.position.x,nextZ)){
          enemy.position.z=nextZ;
        }else{
          enemy.userData.walkPhase+=dt*2;
        }
        enemy.rotation.x = 0;
        enemy.rotation.y = Math.atan2(dx, dz);
      }
      const enemyGround = currentMode === 'box' ? arenaFloorY + 4.45 : terrainHeightAt(enemy.position.x, enemy.position.z) + 4.45;
      enemy.position.y = THREE.MathUtils.lerp(enemy.position.y, enemyGround, Math.min(1, dt * 10));
      if (distance < 75 && distance > 7) {
        enemy.userData.walkPhase += dt * 7;
        const swing = Math.sin(enemy.userData.walkPhase) * .42;
        enemy.userData.arms?.forEach((arm, index) => { arm.rotation.x = index % 2 ? swing : -swing; });
        enemy.userData.legs?.forEach((leg, index) => { leg.rotation.x = index % 2 ? -swing : swing; });
        enemy.rotation.x = 0;
        enemy.rotation.z = Math.sin(enemy.userData.walkPhase * 2) * .008;
      }
      enemy.userData.cooldown -= dt;
      if(distance<55&&enemy.userData.cooldown<=0&&dropState==='grounded'){
        const mult={easy:.55,normal:1,hard:1.45}[gameSettings.difficulty]??1;
        if(hasClearCombatLine(enemy.position.x,enemy.position.z,camera.position.x,camera.position.z,enemy.position.y,camera.position.y)){
          damagePlayer((4+Math.random()*4)*mult);
          gameSound('shot');
        }
        enemy.userData.cooldown=(1.4+Math.random())/mult;
      }
      if(enemy.userData.health<45&&!enemy.userData.coverBuilt){const cover=new THREE.Mesh(buildTypes.wall.geometry,new THREE.MeshStandardMaterial({color:0x85888d,roughness:.9}));cover.position.set(enemy.position.x+Math.sin(enemy.rotation.y)*3,currentMode==='box'?arenaFloorY+4:terrainHeightAt(enemy.position.x,enemy.position.z)+4,enemy.position.z+Math.cos(enemy.rotation.y)*3);cover.rotation.y=enemy.rotation.y;cover.userData.buildType='wall';cover.userData.health=180;scene.add(cover);placedBuilds.push(cover);enemy.userData.coverBuilt=true;}
      const loot=pickups.find(item=>Math.hypot(item.position.x-enemy.position.x,item.position.z-enemy.position.z)<3);if(loot){enemy.userData.health=Math.min(100,enemy.userData.health+20);scene.remove(loot);pickups.splice(pickups.indexOf(loot),1);}
    }
    const stormDistance = Math.hypot(camera.position.x, camera.position.z);
    if (currentMode === 'solo' && dropState === 'grounded' && stormDistance > stormRadius) damagePlayer(dt * 8);
    const nearbyChest = chests.some(item => !item.userData.opened && Math.hypot(camera.position.x - item.position.x, camera.position.z - item.position.z) < 7);
    interactPrompt.classList.toggle('hidden', !nearbyChest);
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pickup = pickups[i];
      pickup.rotation.y += dt * 2.3; pickup.position.y = pickup.userData.baseY + Math.sin(performance.now() * .003 + pickup.userData.phase) * .45;
      if (Math.hypot(camera.position.x - pickup.position.x, camera.position.z - pickup.position.z) < 4) {
        if (pickup.userData.kind === 'ammo') {
          const weapon = activeWeapon();
          weapon.reserve += 30;
          reserveAmmo = weapon.reserve;
          renderInventory();
          flashNotice('+30 MUNITIONS');
        }
        if (pickup.userData.kind === 'heal') { playerHealth = Math.min(100, playerHealth + 35); flashNotice('+35 VIE'); }
        if (pickup.userData.kind === 'shield') { playerShield = Math.min(100, playerShield + 25); flashNotice('+25 BOUCLIER'); }
        scene.remove(pickup); pickups.splice(i, 1); updateCombatHud();
        gameSound('pickup');
      }
    }
  }
  crystal.rotation.y += dt * .8; crystal.position.y = crystalBaseY + Math.sin(performance.now() * .002) * 1.5;
  towerCrystal.rotation.y += dt * .55;towerCrystal.position.y=55+Math.sin(performance.now()*.0017)*1.2;
  water.material.opacity = .84 + Math.sin(performance.now() * .0007) * .025;
  waterfallSheet.material.opacity = .68 + Math.sin(performance.now() * .004) * .08;
  waterfallPool.rotation.z += dt * .08;
  const mistAttribute = waterfallMist.geometry.attributes.position;
  for(let i=0;i<mistAttribute.count;i++){
    const nextY=mistAttribute.getY(i)+dt*(1.2+(i%4)*.35);
    mistAttribute.setY(i,nextY>12?0:nextY);
    mistAttribute.setX(i,mistAttribute.getX(i)+Math.sin(performance.now()*.001+i)*dt*.18);
  }
  mistAttribute.needsUpdate=true;
  const thrustAttribute=busThrusters.geometry.attributes.position;
  for(let i=0;i<thrustAttribute.count;i++){
    const nextZ=thrustAttribute.getZ(i)+dt*(18+(i%5)*3);
    thrustAttribute.setZ(i,nextZ>17?4.5:nextZ);
    thrustAttribute.setX(i,(i%2?3.5:-3.5)+Math.sin(now*.006+i)*.3);
  }
  thrustAttribute.needsUpdate=true;
  for(const bird of birds){
    bird.position.x+=bird.userData.speed*dt;
    bird.position.y+=Math.sin(now*.002+bird.userData.phase)*dt*.45;
    bird.children[0].rotation.z=-.62+Math.sin(now*.008+bird.userData.phase)*.22;
    bird.children[1].rotation.z=.62-Math.sin(now*.008+bird.userData.phase)*.22;
    if(bird.position.x>390)bird.position.x=-390;
  }
  const windAttribute=windParticles.geometry.attributes.position;
  for(let i=0;i<windAttribute.count;i++){
    const nextX=windAttribute.getX(i)+dt*(5+(i%6));windAttribute.setX(i,nextX>390?-390:nextX);
    windAttribute.setY(i,windAttribute.getY(i)+Math.sin(now*.0015+i)*dt*.16);
  }
  windAttribute.needsUpdate=true;
  for (const cloud of clouds) {
    cloud.position.x += cloud.userData.speed * dt;
    if (cloud.position.x > 430) cloud.position.x = -430;
  }
  updateBuildPreview();
  updatePlayerAvatar();
  locationLabel.textContent = currentLocation(camera.position.x, camera.position.z);
  zoneLabel.textContent = `${Math.round(stormRadius)} m`;
  mapPlayer.style.left = `${THREE.MathUtils.clamp(50 + camera.position.x / 9, 8, 92)}%`;
  mapPlayer.style.top = `${THREE.MathUtils.clamp(50 + camera.position.z / 9, 8, 92)}%`;
  worldMapPlayer.style.left = mapPlayer.style.left;
  worldMapPlayer.style.top = mapPlayer.style.top;
  const mapZoneSize = THREE.MathUtils.clamp(stormRadius / 400 * 70, 18, 70);
  mapZone.style.width = mapZone.style.height = `${mapZoneSize}%`;
  mapZone.style.left = mapZone.style.top = `${(100 - mapZoneSize) / 2}%`;
  worldMapZone.style.width = worldMapZone.style.height = `${mapZoneSize}%`;
  worldMapZone.style.left = worldMapZone.style.top = `${(100 - mapZoneSize) / 2}%`;
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();
  renderer.setSize(host.clientWidth, host.clientHeight);
});
