import * as THREE from 'three';
import { buildWorld } from './world.js';
import { createRooster, createHuman, createCar, createPickup, createMarker } from './models.js';
import { Sound } from './audio.js';
import { clamp, damp, dampAngle, rand, randInt, pick, TAU, makeCanvasTexture, makeLabelSprite, circleRectResolve } from './utils.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const startScreen = $('start-screen');
const pauseScreen = $('pause-screen');
const deathScreen = $('death-screen');
const hud = $('hud');
const loading = $('loading');
const moneyNum = $('money-num');
const healthBar = $('health-bar');
const healthNum = $('health-num');
const wantedStars = [...document.querySelectorAll('#wanted .star')];
const missionHud = $('mission-hud');
const missionTitle = $('mission-title');
const missionObj = $('mission-obj');
const missionTimerEl = $('mission-timer');
const notifsEl = $('notifs');
const promptEl = $('prompt');
const promptKey = $('prompt-key');
const promptText = $('prompt-text');
const crosshair = $('crosshair');
const speedo = $('speedo');
const speedNum = $('speed-num');
const weaponName = $('weapon-name');
const ammoEl = $('ammo');
const weaponIcon = $('weapon-icon');
const damageEl = $('damage');
const flashEl = $('flash');
const areaEl = $('area-name');
const areaText = $('area-text');
const touchControls = $('touch-controls');
const stickBase = $('stick-base');
const stickKnob = $('stick-knob');
const deathText = $('death-text');

const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const WANTED_THRESHOLDS = [0, 50, 140, 270, 420, 600];

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.6 : 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);

const state = {
  mode: 'menu',
  time: 0,
  money: 250,
  wanted: 0,
  wantedPoints: 0,
  lastCrime: -100,
  weapon: 'pistol',
  ammo: 12,
  maxAmmo: 120,
  driving: null,
  mission: null,
  shootCd: 0,
  lastHorn: -10,
  damageFlash: 0,
  areaTimer: 0,
  district: '',
  pedsTimer: 0,
  copTimer: 0,
  miniTimer: 0,
  hud: {},
  shake: 0,
};

const sound = new Sound();
let world = null;
const vehicles = [];
const npcs = [];
const pickups = [];
const effects = [];
const missionDefs = [];
let mission = null;
let heli = null;

const rooster = createRooster();
scene.add(rooster);
const player = {
  group: rooster,
  pos: rooster.position,
  yaw: 0,
  speed: 0,
  vy: 0,
  y: 0,
  grounded: true,
  health: 100,
  maxHealth: 100,
  dead: false,
  lastHurt: -100,
  attackT: 0,
};

const cam = { yaw: 0, pitch: 0.28, dist: 5.8, curDist: 5.8, target: new THREE.Vector3(), pos: new THREE.Vector3() };
const keys = new Set();
const touch = { moveX: 0, moveY: 0, sprint: false, attack: false };
const raycaster = new THREE.Raycaster();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

function fmtMoney(n) { return Math.max(0, Math.floor(n)).toLocaleString('id-ID'); }
function dist2D(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function distToPlayer(x, z) { return Math.hypot(x - player.pos.x, z - player.pos.z); }

function notify(text, cls = '') {
  const el = document.createElement('div');
  el.className = 'notif ' + cls;
  el.textContent = text;
  notifsEl.appendChild(el);
  while (notifsEl.children.length > 4) notifsEl.firstElementChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3800);
}

function showArea(name) {
  areaText.textContent = name;
  areaEl.classList.add('show');
  state.areaTimer = 2.6;
}

function setMoney() {
  moneyNum.textContent = fmtMoney(state.money);
}
function setHealthUI() {
  const pct = clamp(player.health / player.maxHealth, 0, 1);
  healthBar.style.width = (pct * 100).toFixed(1) + '%';
  healthBar.style.background = pct > 0.55
    ? 'linear-gradient(90deg,#45c95a,#8ee06a)'
    : pct > 0.28
      ? 'linear-gradient(90deg,#ffb31c,#ffd75e)'
      : 'linear-gradient(90deg,#ff3b2f,#ff6b5a)';
  healthNum.textContent = Math.max(0, Math.ceil(player.health));
}
function setWantedUI() {
  wantedStars.forEach((s, i) => {
    s.classList.toggle('on', i < state.wanted);
    s.classList.toggle('hot', i < state.wanted && state.wanted >= 4);
  });
}
function setWeaponUI() {
  const pistol = state.weapon === 'pistol';
  weaponName.textContent = pistol ? 'PISTOL' : 'PUKULAN';
  ammoEl.innerHTML = pistol ? `${state.ammo}<small>/∞</small>` : '∞';
  weaponIcon.style.opacity = pistol ? '0.92' : '0.15';
  crosshair.classList.toggle('hidden', !pistol || isTouch || state.mode !== 'playing' || !!state.driving);
}
function flashDamage() {
  state.damageFlash = 0.75;
}
function shakeCamera(amount) {
  state.shake = Math.min(1.6, state.shake + amount);
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------
function isFree(x, z, pad = 0.6) {
  if (Math.abs(x) > 366 || Math.abs(z) > 366) return false;
  for (const c of world.colliders) {
    if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) return false;
  }
  return true;
}

function findFreePoint(cx, cz, minR, maxR) {
  for (let i = 0; i < 40; i++) {
    const a = rand(0, TAU);
    const r = rand(minR, maxR);
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    if (isFree(x, z, 0.9)) return { x, z };
  }
  return { x: cx, z: cz };
}

function makeVehicle(opts) {
  const group = createCar(opts);
  group.position.set(opts.x, 0, opts.z);
  group.rotation.y = opts.heading || 0;
  scene.add(group);
  const car = {
    group,
    pos: group.position,
    heading: opts.heading || 0,
    speed: 0,
    health: opts.health ?? 100,
    maxHealth: opts.health ?? 100,
    type: opts.type || 'sedan',
    police: !!opts.police,
    traffic: !!opts.traffic,
    mission: !!opts.mission,
    axis: opts.axis,
    line: opts.line,
    dir: opts.dir || 1,
    baseSpeed: opts.baseSpeed ?? 8,
    dead: false,
    occupied: false,
    smokeTimer: 0,
    color: group.userData.color,
  };
  group.userData.car = car;
  vehicles.push(car);
  return car;
}

function spawnTrafficCar() {
  for (let tries = 0; tries < 20; tries++) {
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const line = pick(world.lines);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const t = rand(-350, 350);
    const x = axis === 'x' ? t : line - dir * 4.5;
    const z = axis === 'z' ? t : line - dir * 4.5;
    if (distToPlayer(x, z) < 22) continue;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = makeVehicle({
      x, z, heading, axis, line, dir, traffic: true,
      type: pick(['sedan', 'sport', 'van']),
      baseSpeed: rand(6, 9.5),
    });
    car.speed = car.baseSpeed;
    return car;
  }
  return null;
}

function nearestCar(maxDist = 3.8) {
  let best = null;
  let bestD = maxDist;
  for (const car of vehicles) {
    if (car.dead || car === state.driving) continue;
    const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function toggleVehicle() {
  if (state.mode !== 'playing' || player.dead) return;
  if (state.driving) { exitVehicle(); return; }
  const car = nearestCar(3.9);
  if (!car) return;
  const wasTraffic = car.traffic;
  state.driving = car;
  car.traffic = false;
  car.occupied = true;
  car.speed = 0;
  player.group.visible = false;
  cam.yaw = car.heading;
  cam.pitch = 0.22;
  cam.dist = 8.4;
  sound.enterCar();
  if (wasTraffic) {
    addCrime(18);
    notify('Mobil dibajak! W untuk gas.', 'bad');
  } else if (car.mission) {
    notify('Mobil misi diambil. Gas!', 'good');
  }
  promptEl.classList.add('hidden');
  speedo.classList.remove('hidden');
  crosshair.classList.add('hidden');
}

function exitVehicle() {
  const car = state.driving;
  if (!car) return;
  state.driving = null;
  car.occupied = false;
  car.speed = 0;
  const rx = -Math.cos(car.heading);
  const rz = Math.sin(car.heading);
  let px = car.pos.x + rx * 2.5;
  let pz = car.pos.z + rz * 2.5;
  if (!isFree(px, pz, 0.7)) {
    px = car.pos.x - rx * 2.5;
    pz = car.pos.z - rz * 2.5;
  }
  if (!isFree(px, pz, 0.7)) {
    px = car.pos.x - Math.sin(car.heading) * 3.2;
    pz = car.pos.z - Math.cos(car.heading) * 3.2;
  }
  player.pos.set(px, 0, pz);
  player.y = 0;
  player.vy = 0;
  player.grounded = true;
  player.yaw = car.heading;
  player.group.visible = true;
  cam.yaw = car.heading;
  cam.pitch = 0.3;
  cam.dist = 6.3;
  snapCamera();
  sound.enterCar();
  speedo.classList.add('hidden');
}

function damageCar(car, amount) {
  if (!car || car.dead) return;
  car.health -= amount;
  if (car.health <= 0) explodeCar(car);
}

function explodeCar(car) {
  if (car.dead) return;
  car.dead = true;
  const wasDriving = state.driving === car;
  if (wasDriving) {
    state.driving = null;
    player.group.visible = true;
    player.pos.set(car.pos.x, 0, car.pos.z);
    player.y = 0;
    speedo.classList.add('hidden');
  }
  spawnExplosion(new THREE.Vector3(car.pos.x, 0.8, car.pos.z), 1.25);
  scene.remove(car.group);
  addCrime(70);
  if (mission && mission.car === car) failMission('Mobil misi hancur.');
  for (const npc of npcs) {
    if (!npc.alive) continue;
    if (Math.hypot(npc.pos.x - car.pos.x, npc.pos.z - car.pos.z) < 7.5) {
      killNpc(npc, { byPlayer: true });
    }
  }
  for (const other of vehicles) {
    if (other === car || other.dead) continue;
    if (Math.hypot(other.pos.x - car.pos.x, other.pos.z - car.pos.z) < 8) {
      damageCar(other, 75);
    }
  }
  if (!wasDriving) {
    const d = distToPlayer(car.pos.x, car.pos.z);
    if (d < 8.5) hurtPlayer(42 * (1 - d / 8.5), 'ledakan mobil');
  } else {
    die('Mobil kamu meledak. Ayam goreng, literally.');
  }
}

function updateVehicle(car, dt) {
  if (car.dead) return;
  const isPlayer = state.driving === car;

  if (isPlayer) {
    let throttle = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) + touch.moveY;
    let steer = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0) - touch.moveX;
    throttle = clamp(throttle, -1, 1);
    steer = clamp(steer, -1, 1);
    const handbrake = keys.has('Space') || (isTouch && touch.brake);
    const accel = car.type === 'sport' ? 25 : car.type === 'van' ? 14 : 19;
    const maxSpeed = car.type === 'sport' ? 33 : car.type === 'van' ? 21 : 27;

    if (throttle !== 0) car.speed += throttle * accel * dt * (car.speed < 0 && throttle > 0 ? 1.7 : 1);
    car.speed *= Math.exp(-(handbrake ? 3.6 : throttle === 0 ? 1.15 : 0.32) * dt);
    car.speed = clamp(car.speed, -9, maxSpeed);

    if (Math.abs(car.speed) > 0.15) {
      car.heading += steer * 1.95 * dt * clamp(Math.abs(car.speed) / 7, 0, 1) * Math.sign(car.speed) * (handbrake ? 0.72 : 1);
    }

    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    car.pos.x += fx * car.speed * dt;
    car.pos.z += fz * car.speed * dt;

    for (const c of world.colliders) {
      if (circleRectResolve(car.pos, 1.55, c)) {
        const impact = Math.abs(car.speed);
        if (impact > 6) {
          damageCar(car, impact * 0.6);
          sound.hit();
          shakeCamera(impact * 0.035);
          spawnSparks(new THREE.Vector3(car.pos.x, 1, car.pos.z), 6);
        }
        car.speed *= -0.22;
        break;
      }
    }

    car.pos.x = clamp(car.pos.x, -366, 366);
    car.pos.z = clamp(car.pos.z, -366, 366);

    if (Math.abs(car.speed) > 4) {
      for (const npc of npcs) {
        if (!npc.alive) continue;
        if (Math.hypot(npc.pos.x - car.pos.x, npc.pos.z - car.pos.z) < 2.5) {
          killNpc(npc, { byPlayer: true, byCar: true });
          car.speed *= 0.93;
          shakeCamera(0.15);
        }
      }
    }

    for (const other of vehicles) {
      if (other === car || other.dead) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 6.76 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (2.6 - d) / 2;
        car.pos.x -= (dx / d) * push;
        car.pos.z -= (dz / d) * push;
        other.pos.x += (dx / d) * push;
        other.pos.z += (dz / d) * push;
        const impact = Math.abs(car.speed);
        if (impact > 5) {
          damageCar(car, impact * 0.35);
          damageCar(other, impact * 0.5);
          spawnSparks(new THREE.Vector3(car.pos.x, 1, car.pos.z), 8);
          sound.hit();
          shakeCamera(impact * 0.03);
          car.speed *= -0.18;
          if (other.traffic) other.speed = 0;
        }
      }
    }

    if (keys.has('KeyH') || (mouseDown && state.time - state.lastHorn > 0.9)) {
      if (state.time - state.lastHorn > 0.75) {
        state.lastHorn = state.time;
        sound.horn();
      }
    }
  } else if (car.traffic) {
    let brake = false;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const dx = player.pos.x - car.pos.x;
    const dz = player.pos.z - car.pos.z;
    const ahead = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (ahead > 0 && ahead < 13 && side < 3.2) brake = true;
    car.speed = damp(car.speed, brake ? 0 : car.baseSpeed, brake ? 5 : 1.2, dt);
    if (car.axis === 'x') {
      car.pos.x += car.dir * car.speed * dt;
      if (car.pos.x > 368) car.pos.x = -368;
      if (car.pos.x < -368) car.pos.x = 368;
    } else {
      car.pos.z += car.dir * car.speed * dt;
      if (car.pos.z > 368) car.pos.z = -368;
      if (car.pos.z < -368) car.pos.z = 368;
    }
  }

  car.group.position.set(car.pos.x, 0, car.pos.z);
  car.group.rotation.y = car.heading;

  const wheels = car.group.userData.wheels;
  if (wheels) {
    const spin = car.speed * dt / 0.37;
    for (const w of wheels) w.rotation.x += spin;
  }

  if (car.health < 36) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.16;
      spawnSmoke(new THREE.Vector3(car.pos.x, 0.9, car.pos.z));
    }
  }

  if (car.police && car.group.userData.lightbar) {
    const lb = car.group.userData.lightbar;
    const on = Math.sin(state.time * 11) > 0;
    lb.redMat.emissiveIntensity = on ? 3.2 : 0.2;
    lb.blueMat.emissiveIntensity = on ? 0.2 : 3.2;
  }
}

function updateVehicles(dt) {
  for (const car of vehicles) updateVehicle(car, dt);
  for (let i = vehicles.length - 1; i >= 0; i--) {
    if (vehicles[i].dead) vehicles.splice(i, 1);
  }
}

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------
function spawnNpc(x, z, role = 'ped', opts = {}) {
  const group = createHuman(role);
  const heading = opts.heading ?? rand(0, TAU);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  const maxHealth = role === 'cop' ? 80 : role === 'gang' ? (opts.health || 60) : 35;
  const npc = {
    group,
    pos: group.position,
    role,
    heading,
    speed: 0,
    health: maxHealth,
    maxHealth,
    alive: true,
    state: role === 'ped' ? 'wander' : 'chase',
    timer: rand(0.5, 4),
    attackCd: rand(0.6, 2.2),
    fleeTimer: 0,
    leaveTimer: 0,
    deadTimer: 0,
    homeX: x,
    homeZ: z,
    missionTag: opts.missionTag || null,
    label: null,
  };
  group.userData.npc = npc;
  npcs.push(npc);
  return npc;
}

function removeNpc(npc) {
  scene.remove(npc.group);
  const i = npcs.indexOf(npc);
  if (i >= 0) npcs.splice(i, 1);
}

function moveNpc(npc, heading, speed, dt) {
  npc.heading = dampAngle(npc.heading, heading, 7, dt);
  const dx = Math.sin(npc.heading);
  const dz = Math.cos(npc.heading);
  npc.pos.x += dx * speed * dt;
  npc.pos.z += dz * speed * dt;
  let hit = false;
  for (const c of world.colliders) {
    if (circleRectResolve(npc.pos, 0.42, c)) { hit = true; break; }
  }
  npc.pos.x = clamp(npc.pos.x, -366, 366);
  npc.pos.z = clamp(npc.pos.z, -366, 366);
  npc.speed = speed;
  npc.group.position.set(npc.pos.x, 0, npc.pos.z);
  npc.group.rotation.y = npc.heading;
  npc.group.userData.update(dt, speed);
  if (hit) npc.heading += rand(1.8, 3.6);
}

function hasLineOfSight(from, to) {
  const dir = tmpDir.copy(to).sub(from);
  const d = dir.length();
  if (d < 0.5) return true;
  dir.normalize();
  raycaster.set(from, dir);
  raycaster.far = d - 0.6;
  const hits = raycaster.intersectObjects(world.solidMeshes, false);
  return hits.length === 0;
}

function npcShoot(npc) {
  const target = state.driving ? state.driving.pos : player.pos;
  const origin = new THREE.Vector3(npc.pos.x, 1.45, npc.pos.z);
  const end = new THREE.Vector3(target.x + rand(-0.7, 0.7), state.driving ? 1.0 : 1.35, target.z + rand(-0.7, 0.7));
  spawnTracer(origin, end, npc.role === 'cop' ? 0x9fd4ff : 0xffa060);
  spawnMuzzleFlash(origin, 0.5);
  sound.shot();
  if (Math.random() < 0.68) {
    if (state.driving) damageCar(state.driving, 7);
    else hurtPlayer(7, npc.role === 'cop' ? 'tembakan polisi' : 'tembakan gangster');
  }
}

function updateNpc(npc, dt) {
  if (!npc.alive) {
    npc.deadTimer += dt;
    if (npc.deadTimer > 7) removeNpc(npc);
    return;
  }
  const d = distToPlayer(npc.pos.x, npc.pos.z);
  const toPlayer = Math.atan2(player.pos.x - npc.pos.x, player.pos.z - npc.pos.z);

  if (npc.role === 'ped') {
    if (npc.fleeTimer > 0) npc.fleeTimer -= dt;
    if (state.wanted > 0 && d < 11) npc.fleeTimer = Math.max(npc.fleeTimer, 0.8);
    if (npc.fleeTimer > 0) {
      const away = Math.atan2(npc.pos.x - player.pos.x, npc.pos.z - player.pos.z);
      moveNpc(npc, away + rand(-0.2, 0.2), 4.7, dt);
    } else {
      npc.timer -= dt;
      if (npc.timer <= 0) {
        npc.timer = rand(2, 5.5);
        if (Math.hypot(npc.pos.x - npc.homeX, npc.pos.z - npc.homeZ) > 32) {
          npc.heading = Math.atan2(npc.homeX - npc.pos.x, npc.homeZ - npc.pos.z);
        } else {
          npc.heading = rand(0, TAU);
        }
      }
      moveNpc(npc, npc.heading, 1.15, dt);
    }
    return;
  }

  if (npc.role === 'cop' && state.wanted === 0) {
    npc.leaveTimer += dt;
    if (npc.leaveTimer > 12 || d > 130) { removeNpc(npc); return; }
    const away = Math.atan2(npc.pos.x - player.pos.x, npc.pos.z - player.pos.z);
    moveNpc(npc, away, 3.2, dt);
    return;
  }

  if (npc.role === 'gang') {
    if (d > 55 && npc.missionTag !== 'target') {
      moveNpc(npc, Math.atan2(npc.homeX - npc.pos.x, npc.homeZ - npc.pos.z), 1.0, dt);
      return;
    }
  }

  const preferred = npc.role === 'cop' ? 13 : 10;
  if (d > preferred + 2) moveNpc(npc, toPlayer, npc.role === 'cop' ? 5.5 : 5.0, dt);
  else if (d < preferred - 5) moveNpc(npc, toPlayer + Math.PI, 2.2, dt);
  else {
    moveNpc(npc, toPlayer + Math.PI / 2, 1.6, dt);
  }

  npc.attackCd -= dt;
  if (d < 34 && npc.attackCd <= 0) {
    const origin = new THREE.Vector3(npc.pos.x, 1.5, npc.pos.z);
    const target = new THREE.Vector3(player.pos.x, 1.2, player.pos.z);
    if (hasLineOfSight(origin, target)) {
      npcShoot(npc);
      npc.attackCd = rand(1.0, 1.7);
    } else {
      npc.attackCd = 0.35;
    }
  }
  if (d < 2.4 && npc.attackCd <= 0) {
    hurtPlayer(8, 'hantaman');
    npc.attackCd = 1.1;
  }
}

function updateNpcs(dt) {
  for (let i = npcs.length - 1; i >= 0; i--) {
    if (i < npcs.length) updateNpc(npcs[i], dt);
  }
  state.pedsTimer -= dt;
  if (state.pedsTimer <= 0) {
    state.pedsTimer = 3.5;
    const peds = npcs.filter((n) => n.role === 'ped' && n.alive).length;
    if (peds < 22) {
      for (let i = 0; i < 2; i++) {
        const spot = pick(world.sidewalkPoints);
        if (distToPlayer(spot.x, spot.z) > 45) spawnNpc(spot.x, spot.z, 'ped');
      }
    }
  }
}

function alarmPeds(radius = 32) {
  for (const npc of npcs) {
    if (npc.role === 'ped' && npc.alive && distToPlayer(npc.pos.x, npc.pos.z) < radius) {
      npc.fleeTimer = Math.max(npc.fleeTimer, 5);
    }
  }
}

function killNpc(npc, opts = {}) {
  if (!npc.alive) return;
  npc.alive = false;
  npc.deadTimer = 0;
  npc.state = 'dead';
  npc.group.rotation.z = (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 2 - rand(0, 0.25));
  npc.group.position.y = 0.18;
  spawnBlood(new THREE.Vector3(npc.pos.x, 1.1, npc.pos.z));
  sound.hit();
  if (npc.label) { npc.group.remove(npc.label); npc.label = null; }
  if (opts.byPlayer) {
    addCrime(npc.role === 'cop' ? 90 : npc.role === 'gang' ? 45 : 55);
    if (npc.role === 'ped' && Math.random() < 0.65) dropCash(npc.pos, randInt(20, 95));
    if (npc.role === 'cop' && Math.random() < 0.5) dropAmmo(npc.pos);
  }
  onNpcKilled(npc);
}

function clearCops() {
  for (let i = npcs.length - 1; i >= 0; i--) {
    if (npcs[i].role === 'cop') {
      scene.remove(npcs[i].group);
      npcs.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
const glowTex = makeCanvasTexture(128, 128, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,250,225,1)');
  g.addColorStop(0.25, 'rgba(255,210,120,.9)');
  g.addColorStop(0.6, 'rgba(255,130,50,.32)');
  g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}, { repeat: false });

const scorchTex = makeCanvasTexture(128, 128, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(10,8,6,.92)');
  g.addColorStop(0.55, 'rgba(18,14,10,.72)');
  g.addColorStop(1, 'rgba(20,16,12,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}, { repeat: false });

const particleGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
const smokeGeo = new THREE.SphereGeometry(0.5, 6, 5);
const particleMats = new Map();
function pmat(color) {
  if (!particleMats.has(color)) {
    particleMats.set(color, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, toneMapped: false }));
  }
  return particleMats.get(color);
}
const smokeMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2c, transparent: true, opacity: 0.34, depthWrite: false });

function spawnParticles(pos, color, count, opts = {}) {
  const { speed = 6, gravity = 14, life = 0.8, size = 1, smoke = false } = opts;
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(smoke ? smokeGeo : particleGeo, smoke ? smokeMat : pmat(color));
    mesh.position.copy(pos);
    mesh.position.x += rand(-0.4, 0.4);
    mesh.position.y += rand(-0.2, 0.7);
    mesh.position.z += rand(-0.4, 0.4);
    const s = rand(0.5, 1.3) * size;
    mesh.scale.setScalar(smoke ? s * 0.7 : s);
    scene.add(mesh);
    const a = rand(0, TAU);
    const up = rand(0.2, 1);
    effects.push({
      type: 'particle',
      mesh,
      vel: new THREE.Vector3(Math.cos(a) * rand(0.2, 1) * speed, up * speed, Math.sin(a) * rand(0.2, 1) * speed),
      life: life * rand(0.7, 1.3),
      maxLife: life,
      gravity,
      grow: smoke ? rand(0.5, 1.1) : 0,
      baseScale: mesh.scale.x,
    });
  }
}

function spawnBlood(pos) { spawnParticles(pos, 0xa3131a, 12, { speed: 4.5, gravity: 18, life: 0.7, size: 0.9 }); }
function spawnSparks(pos, count = 8) { spawnParticles(pos, 0xffc040, count, { speed: 8, gravity: 20, life: 0.5, size: 0.7 }); }
function spawnSmoke(pos) { spawnParticles(pos, 0x333333, 1, { speed: 0.8, gravity: -1.4, life: 1.6, size: 1.4, smoke: true }); }

function spawnTracer(from, to, color = 0xffe7a0) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, toneMapped: false });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  effects.push({ type: 'tracer', obj: line, life: 0.09, maxLife: 0.09 });
}

function spawnMuzzleFlash(pos, scale = 1) {
  const mat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const sp = new THREE.Sprite(mat);
  sp.position.copy(pos);
  sp.scale.setScalar(0.9 * scale);
  scene.add(sp);
  effects.push({ type: 'flash', obj: sp, life: 0.07, maxLife: 0.07, grow: 2.2 });
}

function spawnExplosion(pos, scale = 1) {
  const mat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const sp = new THREE.Sprite(mat);
  sp.position.copy(pos);
  sp.position.y += 1.2;
  sp.scale.setScalar(3.2 * scale);
  scene.add(sp);
  effects.push({ type: 'flash', obj: sp, life: 0.42, maxLife: 0.42, grow: 14 * scale });

  spawnParticles(pos, 0xffb020, Math.round(26 * scale), { speed: 13, gravity: 16, life: 0.9, size: 1.4 });
  spawnParticles(pos, 0xff5a18, Math.round(14 * scale), { speed: 9, gravity: 10, life: 1.1, size: 1.8 });
  spawnParticles(pos, 0x222222, Math.round(12 * scale), { speed: 3, gravity: -2.2, life: 1.8, size: 2.6, smoke: true });

  const light = new THREE.PointLight(0xff8a30, 18, 40, 2);
  light.position.copy(pos);
  light.position.y += 1.5;
  scene.add(light);
  effects.push({ type: 'light', obj: light, life: 0.5, maxLife: 0.5 });

  const scorch = new THREE.Mesh(
    new THREE.PlaneGeometry(7 * scale, 7 * scale),
    new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, opacity: 0.85 })
  );
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.set(pos.x, 0.035, pos.z);
  scene.add(scorch);
  effects.push({ type: 'scorch', obj: scorch, life: 26, maxLife: 26 });

  const d = distToPlayer(pos.x, pos.z);
  if (d < 45) shakeCamera(clamp(1.5 - d / 40, 0.2, 1.4));
  sound.explosion();
  alarmPeds(60);
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    if (e.life <= 0) {
      scene.remove(e.obj);
      if (e.type === 'tracer' || e.type === 'flash' || e.type === 'scorch') {
        if (e.obj.geometry) e.obj.geometry.dispose();
        if (e.obj.material) { if (e.obj.material.map && e.type !== 'scorch') e.obj.material.map = null; e.obj.material.dispose(); }
      }
      effects.splice(i, 1);
      continue;
    }
    if (e.type === 'particle') {
      e.vel.y -= e.gravity * dt;
      e.mesh.position.addScaledVector(e.vel, dt);
      if (e.mesh.position.y < 0.05) { e.mesh.position.y = 0.05; e.vel.y *= -0.25; e.vel.x *= 0.7; e.vel.z *= 0.7; }
      const k = e.life / e.maxLife;
      e.mesh.scale.setScalar(e.baseScale * (e.grow ? (1 + (1 - k) * e.grow * 2) : k));
      e.mesh.rotation.x += dt * 3;
      e.mesh.rotation.z += dt * 2;
    } else if (e.type === 'tracer') {
      e.obj.material.opacity = Math.max(0, e.life / e.maxLife);
    } else if (e.type === 'flash') {
      const k = 1 - e.life / e.maxLife;
      e.obj.material.opacity = 1 - k;
      e.obj.scale.setScalar(e.obj.scale.x + e.grow * dt * 8);
    } else if (e.type === 'light') {
      e.obj.intensity = 18 * (e.life / e.maxLife);
    } else if (e.type === 'scorch') {
      e.obj.material.opacity = Math.min(0.85, e.life / 4);
    }
  }
}

// ---------------------------------------------------------------------------
// Player damage / death
// ---------------------------------------------------------------------------
function hurtPlayer(amount, source = 'kerusuhan') {
  if (state.mode !== 'playing' || player.dead) return;
  player.health -= amount;
  player.lastHurt = state.time;
  flashDamage();
  shakeCamera(clamp(amount * 0.03, 0.12, 0.55));
  sound.hit();
  setHealthUI();
  if (player.health <= 0) die(source);
}

function die(source) {
  if (player.dead) return;
  player.dead = true;
  player.health = 0;
  setHealthUI();
  if (state.driving) {
    const car = state.driving;
    car.speed = 0;
    state.driving = null;
    player.group.visible = true;
    player.pos.set(car.pos.x, 0, car.pos.z);
    speedo.classList.add('hidden');
  }
  state.mode = 'dead';
  if (mission) failMission('Kamu tumbang.');
  state.wanted = 0;
  state.wantedPoints = 0;
  setWantedUI();
  deathText.textContent = `Kamu tumbang karena ${source}. Bangun lagi di rumah sakit, dompet sedikit lebih ringan.`;
  deathScreen.classList.remove('hidden');
  crosshair.classList.add('hidden');
  promptEl.classList.add('hidden');
  sound.death();
  if (document.pointerLockElement) document.exitPointerLock();
}

// ---------------------------------------------------------------------------
// Combat & wanted level
// ---------------------------------------------------------------------------
function damageNpc(npc, amount) {
  if (!npc.alive) return;
  npc.health -= amount;
  spawnBlood(new THREE.Vector3(npc.pos.x, 1.1, npc.pos.z));
  sound.hit();
  if (npc.role === 'ped') npc.fleeTimer = 8;
  if (npc.health <= 0) killNpc(npc, { byPlayer: true });
}

function shoot() {
  if (state.mode !== 'playing' || player.dead || state.driving) return;
  if (state.weapon !== 'pistol') { punch(); return; }
  if (state.shootCd > 0) return;
  if (state.ammo <= 0) {
    notify('Amunisi habis! Cari kotak amunisi kuning.', 'bad');
    state.shootCd = 0.6;
    sound.click();
    return;
  }
  state.ammo--;
  setWeaponUI();
  state.shootCd = 0.24;
  player.attackT = 0.24;
  player.yaw = cam.yaw;
  sound.shot();
  addCrime(4);
  alarmPeds(42);
  shakeCamera(0.14);

  const origin = new THREE.Vector3(player.pos.x, 1.45 + player.y, player.pos.z);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir).normalize();

  raycaster.set(origin, dir);
  raycaster.far = 75;
  const wallHits = raycaster.intersectObjects(world.solidMeshes, false);
  let maxDist = wallHits.length ? wallHits[0].distance : 75;

  let bestNpc = null;
  let bestCar = null;
  let bestT = maxDist;
  for (const npc of npcs) {
    if (!npc.alive) continue;
    tmpV.set(npc.pos.x - origin.x, 1.15 - origin.y, npc.pos.z - origin.z);
    const t = tmpV.dot(dir);
    if (t < 0.5 || t > maxDist) continue;
    const perp = tmpV.addScaledVector(dir, -t).length();
    if (perp < 1.15 + t * 0.028 && t < bestT) { bestT = t; bestNpc = npc; }
  }
  for (const car of vehicles) {
    if (car.dead || car === state.driving) continue;
    tmpV.set(car.pos.x - origin.x, 0.9 - origin.y, car.pos.z - origin.z);
    const t = tmpV.dot(dir);
    if (t < 0.5 || t > maxDist) continue;
    const perp = tmpV.addScaledVector(dir, -t).length();
    if (perp < 2.3 && t < bestT) { bestT = t; bestCar = car; }
  }

  let end;
  if (bestNpc) {
    end = new THREE.Vector3(bestNpc.pos.x, 1.15, bestNpc.pos.z);
    damageNpc(bestNpc, 40);
  } else if (bestCar) {
    end = new THREE.Vector3(bestCar.pos.x, 0.9, bestCar.pos.z);
    damageCar(bestCar, 16);
    spawnSparks(end, 6);
  } else {
    end = origin.clone().addScaledVector(dir, maxDist);
  }

  const fwdX = Math.sin(player.yaw);
  const fwdZ = Math.cos(player.yaw);
  const muzzle = new THREE.Vector3(
    player.pos.x + fwdX * 1.0 - fwdZ * 0.3,
    1.45 + player.y,
    player.pos.z + fwdZ * 1.0 + fwdX * 0.3
  );
  spawnTracer(muzzle, end);
  spawnMuzzleFlash(muzzle);
}

function punch() {
  if (state.mode !== 'playing' || player.dead || state.driving) return;
  if (state.shootCd > 0) return;
  state.shootCd = 0.38;
  player.attackT = 0.3;
  player.yaw = cam.yaw;
  sound.punch();
  shakeCamera(0.08);
  const fx = Math.sin(player.yaw);
  const fz = Math.cos(player.yaw);
  let hit = false;
  for (const npc of npcs) {
    if (!npc.alive) continue;
    const dx = npc.pos.x - player.pos.x;
    const dz = npc.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.0 && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.25) {
      damageNpc(npc, 36);
      npc.pos.x += (dx / Math.max(d, 0.1)) * 0.7;
      npc.pos.z += (dz / Math.max(d, 0.1)) * 0.7;
      hit = true;
    }
  }
  for (const car of vehicles) {
    if (car.dead) continue;
    if (Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z) < 3.2) {
      damageCar(car, 5);
      spawnSparks(new THREE.Vector3(car.pos.x, 1, car.pos.z), 4);
      hit = true;
    }
  }
  if (hit) { addCrime(10); alarmPeds(18); }
}

function switchWeapon() {
  if (state.mode !== 'playing') return;
  state.weapon = state.weapon === 'pistol' ? 'fist' : 'pistol';
  setWeaponUI();
  sound.click();
}

function addCrime(points) {
  if (state.mode !== 'playing') return;
  state.wantedPoints = clamp(state.wantedPoints + points, 0, 900);
  state.lastCrime = state.time;
  recalcWanted();
}

function recalcWanted() {
  let s = 0;
  for (let i = 5; i >= 1; i--) {
    if (state.wantedPoints >= WANTED_THRESHOLDS[i]) { s = i; break; }
  }
  if (s > state.wanted) {
    state.wanted = s;
    setWantedUI();
    sound.star();
    notify(`BINTANG ${s} — polisi makin banyak!`, 'bad');
    if (s >= 4) notify('Helikopter polisi diterjunkan!', 'bad');
  } else if (s < state.wanted) {
    state.wanted = s;
    setWantedUI();
    if (s === 0) notify('Bintang hilang. Kota tenang... untuk sekarang.', 'good');
  }
}

function updateWanted(dt) {
  if (state.wanted > 0 && state.time - state.lastCrime > 10) {
    if (mission && mission.def.id === 'survive') return;
    state.wantedPoints = Math.max(0, state.wantedPoints - 7 * dt);
    recalcWanted();
  }
}

function spawnCopNear() {
  for (let i = 0; i < 20; i++) {
    const p = world.randomRoadPoint(48, player.pos.x, player.pos.z);
    if (distToPlayer(p.x, p.z) > 40 && isFree(p.x, p.z, 0.8)) {
      const cop = spawnNpc(p.x, p.z, 'cop');
      cop.attackCd = rand(1.2, 2.4);
      return cop;
    }
  }
  return null;
}

function updatePolice(dt) {
  if (state.wanted === 0) return;
  const desired = Math.min(10, state.wanted * 2);
  const current = npcs.filter((n) => n.role === 'cop' && n.alive).length;
  state.copTimer -= dt;
  if (current < desired && state.copTimer <= 0) {
    spawnCopNear();
    state.copTimer = Math.max(0.7, 2.4 - state.wanted * 0.3);
  }
}

function buildHeli() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2b46, roughness: 0.55, metalness: 0.4 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe6e6e0, roughness: 0.5, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.25, 4.2), dark);
  body.castShadow = true;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), white);
  nose.scale.set(1, 0.8, 1.2);
  nose.position.set(0, -0.05, 2.1);
  g.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 4.2), dark);
  tail.position.set(0, 0.1, -3.8);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.9), white);
  fin.position.set(0, 0.55, -5.7);
  g.add(fin);
  const rotor = new THREE.Group();
  rotor.position.y = 0.95;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.35, 6), white);
  rotor.add(hub);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.05, 0.28), white);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  g.add(rotor);
  for (const sx of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), white);
    skid.position.set(sx, -1.0, 0);
    g.add(skid);
  }
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(6.5, 34, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  cone.position.y = 17;
  scene.add(cone);
  scene.add(g);
  return { group: g, rotor, cone, angle: 0, fireCd: 2.5 };
}

function updateHeli(dt) {
  if (state.wanted >= 4 && !heli) heli = buildHeli();
  if (state.wanted < 3 && heli) {
    scene.remove(heli.group);
    scene.remove(heli.cone);
    heli = null;
    return;
  }
  if (!heli) return;
  heli.angle += dt * 0.38;
  const x = player.pos.x + Math.cos(heli.angle) * 52;
  const z = player.pos.z + Math.sin(heli.angle) * 52;
  heli.group.position.set(x, 34, z);
  heli.group.rotation.y = Math.atan2(player.pos.x - x, player.pos.z - z);
  heli.rotor.rotation.y += dt * 32;
  heli.cone.position.set(x, 17, z);
  heli.cone.material.opacity = 0.075 + Math.sin(state.time * 7) * 0.02;
  heli.fireCd -= dt;
  if (heli.fireCd <= 0) {
    heli.fireCd = 1.7;
    const from = new THREE.Vector3(x, 33, z);
    const to = state.driving
      ? new THREE.Vector3(state.driving.pos.x, 1, state.driving.pos.z)
      : new THREE.Vector3(player.pos.x, 1.2, player.pos.z);
    spawnTracer(from, to, 0xbfe3ff);
    spawnMuzzleFlash(from, 0.8);
    sound.shot();
    if (Math.random() < 0.62) {
      if (state.driving) damageCar(state.driving, 8);
      else hurtPlayer(6, 'tembakan helikopter');
    }
  }
}

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------
function addPickup(type, x, z, value = 0, permanent = false) {
  const group = createPickup(type);
  group.position.set(x, 0.6, z);
  group.userData.baseY = 0.6;
  scene.add(group);
  const p = { group, type, x, z, active: true, respawn: permanent ? Infinity : 0, value };
  pickups.push(p);
  return p;
}

function dropCash(pos, amount) {
  addPickup('cash', pos.x, pos.z, amount, true);
}
function dropAmmo(pos) {
  addPickup('ammo', pos.x, pos.z, 20, true);
}

function collectPickup(p) {
  p.active = false;
  p.group.visible = false;
  p.respawn = p.respawn === Infinity ? Infinity : state.time + 45;
  sound.pickup();
  if (p.type === 'cash') {
    const amount = p.value || randInt(25, 110);
    state.money += amount;
    setMoney();
    sound.money();
    notify(`+$${amount}`, 'money');
  } else if (p.type === 'health') {
    player.health = Math.min(player.maxHealth, player.health + 35);
    setHealthUI();
    notify('+35 NYAWA', 'good');
  } else {
    state.ammo = Math.min(state.maxAmmo, state.ammo + 20);
    setWeaponUI();
    notify('+20 AMUNISI', 'good');
  }
}

function updatePickups(dt) {
  for (const p of pickups) {
    if (!p.active) {
      if (p.respawn !== Infinity && state.time >= p.respawn) {
        const spot = pick(world.sidewalkPoints);
        p.x = spot.x;
        p.z = spot.z;
        p.group.position.set(spot.x, 0.6, spot.z);
        p.group.visible = true;
        p.active = true;
      }
      continue;
    }
    p.group.userData.update(state.time);
    if (distToPlayer(p.group.position.x, p.group.position.z) < 1.8) collectPickup(p);
  }
}

function spawnInitialPickups() {
  const types = ['cash', 'cash', 'cash', 'health', 'health', 'ammo'];
  for (let i = 0; i < 26; i++) {
    let spot = pick(world.sidewalkPoints);
    for (let t = 0; t < 10 && distToPlayer(spot.x, spot.z) < 30; t++) spot = pick(world.sidewalkPoints);
    addPickup(types[i % types.length], spot.x, spot.z);
  }
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------
function initMissions() {
  const defs = [
    { id: 'delivery', title: 'AYAM GORENG EXPRESS', color: 0xffc531, time: 115, reward: 600, x: -126, z: -42 },
    { id: 'rampage', title: 'RAMPAGE KAMPUNG', color: 0xff5a3c, time: 95, reward: 800, x: 210, z: 126 },
    { id: 'hit', title: 'BURONAN AYAM', color: 0xc45aff, time: 115, reward: 1000, x: -126, z: 294 },
    { id: 'survive', title: 'PANIC BUTTON', color: 0x4fc3ff, time: 60, reward: 1500, x: 126, z: -294 },
  ];
  defs.forEach((def) => {
    def.cooldown = 0;
    const marker = createMarker(def.color, 'MISI', 1);
    marker.position.set(def.x, 0, def.z);
    marker.visible = false;
    scene.add(marker);
    def.marker = marker;
    missionDefs.push(def);
  });
}

function nearestMissionDef(range = 4.8) {
  let best = null;
  let bestD = range;
  for (const def of missionDefs) {
    if (state.time < def.cooldown) continue;
    const d = Math.hypot(def.x - player.pos.x, def.z - player.pos.z);
    if (d < bestD) { bestD = d; best = def; }
  }
  return best;
}

function startMission(def) {
  if (mission || state.mode !== 'playing' || !def) return;
  const m = {
    def,
    timer: def.time,
    phase: 'start',
    kills: 0,
    index: 0,
    checkpoints: [],
    car: null,
    carMarker: null,
    target: null,
    spawned: [],
  };
  mission = m;
  sound.click();
  missionDefs.forEach((d) => { d.marker.visible = false; });

  if (def.id === 'delivery') {
    const car = makeVehicle({ x: def.x + 9, z: def.z, heading: Math.PI / 2, color: 0xf2c53d, type: 'sport', mission: true });
    m.car = car;
    const cm = createMarker(0xf2c53d, 'MOBIL', 0.7);
    cm.position.set(car.pos.x, 0, car.pos.z);
    scene.add(cm);
    m.carMarker = cm;
    const candidates = world.intersections.filter((p2) => {
      const d = Math.hypot(p2.x - def.x, p2.z - def.z);
      return d > 150 && d < 340 && Math.abs(p2.x) < 350 && Math.abs(p2.z) < 350;
    });
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const cp of candidates.slice(0, 3)) {
      const marker = createMarker(0x65e06a, 'PAKET', 0.72);
      marker.position.set(cp.x, 0, cp.z);
      marker.visible = false;
      scene.add(marker);
      m.checkpoints.push({ x: cp.x, z: cp.z, marker });
    }
    notify(`MISI: ${def.title}`, 'good');
    notify('Ambil mobil kuning bertanda MOBIL.', '');
  } else if (def.id === 'rampage') {
    for (let i = 0; i < 6; i++) {
      const p = findFreePoint(def.x, def.z, 9, 34);
      const npc = spawnNpc(p.x, p.z, 'gang', { missionTag: 'rampage' });
      m.spawned.push(npc);
    }
    notify(`MISI: ${def.title}`, 'good');
    notify('Habisi 6 gangster di sekitar sini!', 'bad');
  } else if (def.id === 'hit') {
    const p = findFreePoint(def.x, def.z, 45, 90);
    const target = spawnNpc(p.x, p.z, 'gang', { missionTag: 'target', health: 160 });
    target.label = makeLabelSprite('TARGET', { border: '#c45aff', color: '#ffe8ff', scale: 0.62 });
    target.label.position.y = 2.6;
    target.group.add(target.label);
    m.target = target;
    m.spawned.push(target);
    for (let i = 0; i < 2; i++) {
      const q = findFreePoint(p.x, p.z, 3, 8);
      const guard = spawnNpc(q.x, q.z, 'gang', { missionTag: 'bodyguard', health: 80 });
      m.spawned.push(guard);
    }
    notify(`MISI: ${def.title}`, 'good');
    notify('Cari target bertanda TARGET ungu.', '');
  } else if (def.id === 'survive') {
    state.wantedPoints = Math.max(state.wantedPoints, WANTED_THRESHOLDS[4] + 10);
    recalcWanted();
    notify(`MISI: ${def.title}`, 'good');
    notify('Bertahan 60 detik. Polisi sudah dikerahkan!', 'bad');
  }
  missionHud.classList.remove('hidden');
}

function onNpcKilled(npc) {
  const m = mission;
  if (!m) return;
  if (m.def.id === 'rampage' && npc.missionTag === 'rampage') {
    m.kills++;
    notify(`Gangster tumbang (${m.kills}/6)`, 'good');
    if (m.kills >= 6) { completeMission(); return; }
  }
  if (m.def.id === 'hit' && npc === m.target) {
    completeMission();
  }
}

function updateMissions(dt) {
  if (!mission) return;
  const m = mission;
  const def = m.def;
  m.timer -= dt;

  if (m.timer <= 0) {
    if (def.id === 'survive') completeMission();
    else failMission('Waktu habis.');
    return;
  }

  if (def.id === 'delivery') {
    if (m.carMarker) {
      m.carMarker.position.set(m.car.pos.x, 0, m.car.pos.z);
      m.carMarker.visible = m.phase === 'start';
    }
    if (m.phase === 'start' && state.driving === m.car) {
      m.phase = 'deliver';
      m.carMarker.visible = false;
      m.checkpoints.forEach((cp) => { cp.marker.visible = true; });
      sound.pickup();
      notify('Paket dimuat! Antar ke 3 titik hijau.', 'good');
    }
    if (m.phase === 'deliver') {
      const cp = m.checkpoints[m.index];
      if (cp && state.driving === m.car && Math.hypot(m.car.pos.x - cp.x, m.car.pos.z - cp.z) < 7.5) {
        cp.marker.visible = false;
        m.index++;
        sound.pickup();
        if (m.index >= m.checkpoints.length) {
          completeMission();
          return;
        }
        notify(`Paket diantar (${m.index}/3)`, 'good');
      }
    }
  } else if (def.id === 'survive') {
    if (state.wanted < 4) {
      state.wantedPoints = Math.max(state.wantedPoints, WANTED_THRESHOLDS[4] + 10);
      recalcWanted();
    }
  }

  let obj = '';
  if (def.id === 'delivery') {
    if (m.phase === 'start') obj = 'Ambil mobil kuning bertanda MOBIL';
    else if (state.driving !== m.car) obj = `Kembali ke mobil! Paket ${m.index}/3`;
    else obj = `Antar paket ke titik hijau (${m.index}/3)`;
  } else if (def.id === 'rampage') {
    obj = `Habisi gangster (${m.kills}/6)`;
  } else if (def.id === 'hit') {
    const d = m.target && m.target.alive ? Math.round(distToPlayer(m.target.pos.x, m.target.pos.z)) : 0;
    obj = `Habisi target ungu — ${d} m`;
  } else {
    obj = `Bertahan hidup — ${Math.ceil(m.timer)} detik`;
  }
  missionTitle.textContent = def.title;
  missionObj.textContent = obj;
  const t = Math.max(0, Math.ceil(m.timer));
  missionTimerEl.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  missionTimerEl.classList.toggle('warn', t <= 10);
}

function cleanupMission() {
  const m = mission;
  if (!m) return;
  for (const cp of m.checkpoints) {
    scene.remove(cp.marker);
  }
  if (m.carMarker) scene.remove(m.carMarker);
  if (m.car && !m.car.dead) {
    if (state.driving === m.car) {
      state.driving = null;
      player.group.visible = true;
      player.pos.set(m.car.pos.x, 0, m.car.pos.z);
      player.y = 0;
      player.grounded = true;
      cam.dist = 6.3;
      cam.pitch = 0.3;
      speedo.classList.add('hidden');
    }
    m.car.dead = true;
    scene.remove(m.car.group);
    const i = vehicles.indexOf(m.car);
    if (i >= 0) vehicles.splice(i, 1);
  }
  for (const npc of m.spawned) {
    if (npc.alive) removeNpc(npc);
  }
  mission = null;
  missionHud.classList.add('hidden');
  missionDefs.forEach((d) => { d.marker.visible = state.time >= d.cooldown; });
}

function completeMission() {
  if (!mission) return;
  const def = mission.def;
  state.money += def.reward;
  setMoney();
  sound.missionComplete();
  notify(`MISI SELESAI: ${def.title}`, 'good');
  notify(`+$${def.reward}`, 'money');
  def.cooldown = state.time + 18;
  if (def.id === 'survive') {
    state.wantedPoints = Math.min(state.wantedPoints, WANTED_THRESHOLDS[2]);
    recalcWanted();
  }
  cleanupMission();
  def.marker.visible = false;
}

function failMission(reason) {
  if (!mission) return;
  const def = mission.def;
  cleanupMission();
  def.cooldown = state.time + 10;
  sound.missionFail();
  notify(`MISI GAGAL — ${reason}`, 'bad');
}

function updateMarkers() {
  for (const def of missionDefs) {
    def.marker.visible = !mission && state.mode === 'playing' && state.time >= def.cooldown;
    def.marker.userData.update(state.time);
  }
}

// ---------------------------------------------------------------------------
// Player & camera
// ---------------------------------------------------------------------------
function jump() {
  if (state.mode !== 'playing' || player.dead || state.driving) return;
  if (!player.grounded) return;
  player.grounded = false;
  player.vy = 7.6;
  sound.jump();
}

function updatePlayer(dt) {
  player.attackT = Math.max(0, player.attackT - dt);
  state.shootCd = Math.max(0, state.shootCd - dt);

  if (player.dead) return;

  if (state.driving) {
    player.pos.set(state.driving.pos.x, 0, state.driving.pos.z);
    player.group.visible = false;
    return;
  }

  player.group.visible = true;

  let mx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + touch.moveX;
  let my = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0) + touch.moveY;
  mx = clamp(mx, -1, 1);
  my = clamp(my, -1, 1);
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.sprint;
  const fwdX = Math.sin(cam.yaw);
  const fwdZ = Math.cos(cam.yaw);
  const rightX = -Math.cos(cam.yaw);
  const rightZ = Math.sin(cam.yaw);
  let dx = fwdX * my + rightX * mx;
  let dz = fwdZ * my + rightZ * mx;
  const len = Math.hypot(dx, dz);
  const moving = len > 0.08;
  if (moving) { dx /= len; dz /= len; }
  const targetSpeed = moving ? (sprint ? 8.4 : 4.5) : 0;
  player.speed = damp(player.speed, targetSpeed, moving ? 12 : 16, dt);

  if (moving && player.speed > 0.05) {
    player.pos.x += dx * player.speed * dt;
    player.pos.z += dz * player.speed * dt;
    player.yaw = dampAngle(player.yaw, Math.atan2(dx, dz), 14, dt);
  }
  if (mouseDown || touch.attack) {
    player.yaw = dampAngle(player.yaw, cam.yaw, 20, dt);
  }

  if (!player.grounded) {
    player.vy -= 24 * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.grounded = true;
    }
  }

  for (const c of world.colliders) {
    circleRectResolve(player.pos, 0.5, c);
  }
  for (const car of vehicles) {
    if (car.dead) continue;
    const ddx = player.pos.x - car.pos.x;
    const ddz = player.pos.z - car.pos.z;
    const d = Math.hypot(ddx, ddz);
    if (d < 1.85 && d > 0.001) {
      player.pos.x += (ddx / d) * (1.85 - d);
      player.pos.z += (ddz / d) * (1.85 - d);
    }
  }
  player.pos.x = clamp(player.pos.x, -366, 366);
  player.pos.z = clamp(player.pos.z, -366, 366);
  player.group.position.set(player.pos.x, player.y, player.pos.z);
  player.group.rotation.y = player.yaw;

  const attack = player.attackT > 0 ? Math.sin((1 - player.attackT / 0.3) * Math.PI) : 0;
  rooster.userData.update(dt, {
    speed: player.speed,
    grounded: player.grounded && player.y <= 0.01,
    sprint,
    attack,
    time: state.time,
  });

  if (state.time - player.lastHurt > 18 && player.health < player.maxHealth) {
    player.health = Math.min(player.maxHealth, player.health + 2 * dt);
    if (Math.ceil(player.health) !== state.hud.health) setHealthUI();
  }

  if ((mouseDown || touch.attack) && state.shootCd <= 0) {
    if (state.weapon === 'pistol') shoot();
    else punch();
  }
}

function updateSun() {
  world.sun.position.set(player.pos.x - 110, 150, player.pos.z - 150);
  world.sunTarget.position.set(player.pos.x, 0, player.pos.z);
  world.sunTarget.updateMatrixWorld();
}

function updateCamera(dt) {
  const driving = state.driving;
  const tx = driving ? driving.pos.x : player.pos.x;
  const tz = driving ? driving.pos.z : player.pos.z;
  const ty = (driving ? 1.25 : 1.45) + (driving ? 0 : player.y);
  tmpV.set(tx, ty, tz);
  cam.target.lerp(tmpV, 1 - Math.exp(-14 * dt));

  const moving = driving ? Math.abs(driving.speed) > 1 : player.speed > 0.6;
  if (state.mode === 'playing' && moving && state.time - lastLook > 1.1) {
    const want = driving ? driving.heading : player.yaw;
    cam.yaw = dampAngle(cam.yaw, want, driving ? 2.6 : 1.1, dt);
  }
  if (driving && state.time - lastLook > 1.1) {
    cam.pitch = damp(cam.pitch, 0.2, 2, dt);
  }

  const cp = Math.cos(cam.pitch);
  const dirX = Math.sin(cam.yaw) * cp;
  const dirY = Math.sin(cam.pitch);
  const dirZ = Math.cos(cam.yaw) * cp;

  let desired = cam.dist;
  raycaster.set(cam.target, new THREE.Vector3(-dirX, -dirY, -dirZ));
  raycaster.far = desired;
  const hits = raycaster.intersectObjects(world.solidMeshes, false);
  if (hits.length) desired = Math.max(1.3, hits[0].distance - 0.35);
  cam.curDist = damp(cam.curDist, desired, hits.length ? 22 : 8, dt);

  cam.pos.set(
    cam.target.x - dirX * cam.curDist,
    cam.target.y - dirY * cam.curDist,
    cam.target.z - dirZ * cam.curDist
  );
  if (cam.pos.y < 0.55) cam.pos.y = 0.55;

  if (state.shake > 0.001) {
    const s = state.shake;
    cam.pos.x += rand(-s, s) * 0.28;
    cam.pos.y += rand(-s, s) * 0.22;
    cam.pos.z += rand(-s, s) * 0.28;
    state.shake = Math.max(0, state.shake - dt * 2.8);
  }

  camera.position.copy(cam.pos);
  camera.lookAt(cam.target.x, cam.target.y + 0.15, cam.target.z);
}

function snapCamera() {
  const driving = state.driving;
  const tx = driving ? driving.pos.x : player.pos.x;
  const tz = driving ? driving.pos.z : player.pos.z;
  const ty = (driving ? 1.25 : 1.45) + (driving ? 0 : player.y);
  cam.target.set(tx, ty, tz);
  cam.curDist = cam.dist;
  const cp = Math.cos(cam.pitch);
  camera.position.set(
    tx - Math.sin(cam.yaw) * cp * cam.dist,
    ty - Math.sin(cam.pitch) * cam.dist,
    tz - Math.cos(cam.yaw) * cp * cam.dist
  );
  camera.lookAt(tx, ty + 0.15, tz);
}

function updateMenuCamera() {
  const t = state.time * 0.055;
  camera.position.set(Math.cos(t) * 255, 92 + Math.sin(t * 1.3) * 12, Math.sin(t) * 255);
  camera.lookAt(0, 26, 0);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
let mouseDown = false;
let lastLook = -100;
let dragging = false;
let dragMoved = 0;
let dragX = 0;
let dragY = 0;
let touchLookId = null;
let touchLookX = 0;
let touchLookY = 0;
let stickId = null;

function requestLock() {
  if (isTouch) return;
  try {
    const p = canvas.requestPointerLock?.();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* ignore */ }
}

function shootOrPunch() {
  if (state.weapon === 'pistol') shoot();
  else punch();
}

function interact() {
  if (state.mode !== 'playing' || mission) return;
  const def = nearestMissionDef(5.0);
  if (def) startMission(def);
}

function setupInput() {
  window.addEventListener('keydown', (e) => {
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Escape') {
      if (state.mode === 'playing') pauseGame();
      else if (state.mode === 'paused') resumeGame();
      return;
    }
    if (state.mode !== 'playing') return;
    if (e.code === 'KeyF') toggleVehicle();
    else if (e.code === 'KeyE') interact();
    else if (e.code === 'KeyQ') switchWeapon();
    else if (e.code === 'Digit1') { state.weapon = 'fist'; setWeaponUI(); }
    else if (e.code === 'Digit2') { state.weapon = 'pistol'; setWeaponUI(); }
    else if (e.code === 'Space') jump();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'playing') return;
    if (e.pointerType === 'touch') {
      touchLookId = e.pointerId;
      touchLookX = e.clientX;
      touchLookY = e.clientY;
      return;
    }
    if (e.button === 2) {
      e.preventDefault();
      punch();
      return;
    }
    if (e.button === 0) {
      if (document.pointerLockElement === canvas) {
        mouseDown = true;
        shootOrPunch();
      } else {
        dragging = true;
        dragMoved = 0;
        dragX = e.clientX;
        dragY = e.clientY;
      }
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') {
      if (touchLookId === e.pointerId) {
        const dx = e.clientX - touchLookX;
        const dy = e.clientY - touchLookY;
        touchLookX = e.clientX;
        touchLookY = e.clientY;
        cam.yaw -= dx * 0.005;
        cam.pitch = clamp(cam.pitch + dy * 0.004, 0.02, 1.05);
        lastLook = state.time;
      }
      return;
    }
    if (document.pointerLockElement === canvas && state.mode === 'playing') {
      cam.yaw -= e.movementX * 0.0022;
      cam.pitch = clamp(cam.pitch + e.movementY * 0.0019, 0.02, 1.05);
      lastLook = state.time;
    } else if (dragging) {
      const dx = e.clientX - dragX;
      const dy = e.clientY - dragY;
      dragX = e.clientX;
      dragY = e.clientY;
      dragMoved += Math.abs(dx) + Math.abs(dy);
      cam.yaw -= dx * 0.004;
      cam.pitch = clamp(cam.pitch + dy * 0.003, 0.02, 1.05);
      lastLook = state.time;
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') {
      if (touchLookId === e.pointerId) touchLookId = null;
      return;
    }
    if (e.button === 0) {
      if (dragging) {
        if (dragMoved < 7) { shootOrPunch(); requestLock(); }
        dragging = false;
      }
      mouseDown = false;
    }
  });

  // virtual joystick
  function updateStick(e) {
    const r = stickBase.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = r.width * 0.36;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    touch.moveX = dx / max;
    touch.moveY = -dy / max;
    stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  stickBase.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    stickId = e.pointerId;
    stickBase.setPointerCapture(e.pointerId);
    updateStick(e);
  });
  stickBase.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) { e.preventDefault(); updateStick(e); }
  });
  const endStick = (e) => {
    if (e.pointerId === stickId) {
      stickId = null;
      touch.moveX = 0;
      touch.moveY = 0;
      stickKnob.style.transform = 'translate(0px, 0px)';
    }
  };
  stickBase.addEventListener('pointerup', endStick);
  stickBase.addEventListener('pointercancel', endStick);

  document.querySelectorAll('.tbtn').forEach((btn) => {
    const action = btn.dataset.action;
    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add('pressed');
      if (action === 'attack') { touch.attack = true; shootOrPunch(); }
      else if (action === 'sprint') touch.sprint = true;
      else if (action === 'jump') jump();
      else if (action === 'enter') toggleVehicle();
      else if (action === 'switch') switchWeapon();
    };
    const up = (e) => {
      e.preventDefault();
      btn.classList.remove('pressed');
      if (action === 'attack') touch.attack = false;
      if (action === 'sprint') touch.sprint = false;
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  });

  $('start-btn').addEventListener('click', startGame);
  $('resume-btn').addEventListener('click', resumeGame);
  $('respawn-btn').addEventListener('click', respawn);
  window.addEventListener('resize', onResize);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.6 : 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function startGame() {
  if (!world || state.mode !== 'menu') return;
  sound.init();
  sound.click();
  startScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  if (isTouch) touchControls.classList.remove('hidden');
  state.mode = 'playing';
  player.pos.set(-210, 0, -42);
  player.y = 0;
  player.vy = 0;
  player.grounded = true;
  player.yaw = 0;
  player.group.rotation.set(0, 0, 0);
  player.group.visible = true;
  player.health = 100;
  player.dead = false;
  cam.yaw = 0;
  cam.pitch = 0.3;
  cam.dist = 6.3;
  snapCamera();
  setMoney();
  setHealthUI();
  setWantedUI();
  setWeaponUI();
  updateSun();
  showArea(world.districtAt(player.pos.x, player.pos.z));
  notify('Selamat datang di ROOSTER CITY', 'good');
  notify('Cari tanda MISI. Bikin rusuh untuk dapat bintang.', '');
  requestLock();
}

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  pauseScreen.classList.remove('hidden');
  mouseDown = false;
  touch.attack = false;
  if (document.pointerLockElement) document.exitPointerLock();
  sound.update(0, false, 0);
}

function resumeGame() {
  if (state.mode !== 'paused') return;
  state.mode = 'playing';
  pauseScreen.classList.add('hidden');
  state.lastCrime = state.time;
  requestLock();
  sound.init();
}

function respawn() {
  deathScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  state.mode = 'playing';
  state.driving = null;
  player.dead = false;
  player.health = 100;
  player.pos.set(-210, 0, -42);
  player.y = 0;
  player.vy = 0;
  player.grounded = true;
  player.yaw = 0;
  player.group.rotation.set(0, 0, 0);
  player.group.visible = true;
  state.money = Math.max(0, state.money - 100);
  state.wanted = 0;
  state.wantedPoints = 0;
  state.lastCrime = state.time;
  state.damageFlash = 0;
  mouseDown = false;
  touch.attack = false;
  touch.sprint = false;
  if (heli) {
    scene.remove(heli.group);
    scene.remove(heli.cone);
    heli = null;
  }
  clearCops();
  cam.yaw = 0;
  cam.pitch = 0.3;
  cam.dist = 6.3;
  snapCamera();
  setMoney();
  setHealthUI();
  setWantedUI();
  setWeaponUI();
  updateSun();
  showArea(world.districtAt(player.pos.x, player.pos.z));
  notify('Kamu bangkit di rumah sakit. -$100', 'bad');
  requestLock();
}

// ---------------------------------------------------------------------------
// HUD & minimap
// ---------------------------------------------------------------------------
const mini = $('minimap');
const mctx = mini.getContext('2d');
const MS = mini.width;
const attackBtn = document.querySelector('[data-action="attack"]');
const enterBtn = document.querySelector('[data-action="enter"]');
let lastPromptText = '';
let lastPromptKey = '';

function updateHud(dt) {
  const hp = Math.ceil(player.health);
  if (state.hud.health !== hp) {
    state.hud.health = hp;
    setHealthUI();
  }

  if (state.driving) {
    speedo.classList.remove('hidden');
    const kmh = Math.round(Math.abs(state.driving.speed) * 3.6);
    if (state.hud.speed !== kmh) { state.hud.speed = kmh; speedNum.textContent = kmh; }
  } else {
    speedo.classList.add('hidden');
  }

  let pKey = '';
  let pText = '';
  if (state.mode === 'playing' && !player.dead) {
    if (state.driving) {
      pKey = 'F';
      pText = 'Keluar mobil';
    } else if (!mission) {
      const def = nearestMissionDef(4.8);
      if (def) {
        pKey = 'E';
        pText = 'Mulai misi: ' + def.title;
      } else {
        const car = nearestCar(3.9);
        if (car) {
          pKey = 'F';
          pText = car.traffic ? 'Bajak mobil' : 'Masuk mobil';
        }
      }
    }
  }
  if (pText) {
    promptEl.classList.remove('hidden');
    if (pText !== lastPromptText || pKey !== lastPromptKey) {
      lastPromptText = pText;
      lastPromptKey = pKey;
      promptKey.textContent = pKey;
      promptText.textContent = pText;
    }
  } else {
    promptEl.classList.add('hidden');
  }

  const showCross = state.weapon === 'pistol' && !state.driving && !isTouch && state.mode === 'playing' && !player.dead;
  crosshair.classList.toggle('hidden', !showCross);

  state.damageFlash = Math.max(0, state.damageFlash - dt * 2.4);
  const low = player.health < 30 ? 0.14 : 0;
  damageEl.style.opacity = Math.min(0.85, state.damageFlash + low);

  if (state.areaTimer > 0) {
    state.areaTimer -= dt;
    if (state.areaTimer <= 0) areaEl.classList.remove('show');
  }
  const d = world.districtAt(player.pos.x, player.pos.z);
  if (d !== state.district) {
    state.district = d;
    if (state.mode === 'playing' && state.areaTimer <= 0) showArea(d);
  }

  if (isTouch) {
    attackBtn.textContent = state.driving ? 'Klakson' : state.weapon === 'pistol' ? 'Tembak' : 'Pukul';
    enterBtn.textContent = state.driving ? 'Keluar' : 'Mobil';
  }

  state.miniTimer -= dt;
  if (state.miniTimer <= 0) {
    state.miniTimer = 0.08;
    drawMinimap();
  }
}

function drawMinimap() {
  const w = MS;
  const cx = w / 2;
  const cy = w / 2;
  const range = 170;
  const scale = w / (range * 2);
  const px = player.pos.x;
  const pz = player.pos.z;
  const yaw = state.driving ? state.driving.heading : player.yaw;

  mctx.save();
  mctx.clearRect(0, 0, w, w);
  mctx.beginPath();
  mctx.arc(cx, cy, cx - 3, 0, TAU);
  mctx.clip();
  mctx.fillStyle = '#121a22';
  mctx.fillRect(0, 0, w, w);
  mctx.translate(cx, cy);
  mctx.rotate(yaw - Math.PI);

  mctx.strokeStyle = '#3a4552';
  mctx.lineWidth = 18 * scale;
  for (const l of world.lines) {
    const x = (l - px) * scale;
    mctx.beginPath();
    mctx.moveTo(x, -range * scale);
    mctx.lineTo(x, range * scale);
    mctx.stroke();
    const z = (l - pz) * scale;
    mctx.beginPath();
    mctx.moveTo(-range * scale, z);
    mctx.lineTo(range * scale, z);
    mctx.stroke();
  }

  for (const b of world.buildings) {
    if (Math.abs(b.x - px) > range + 35 || Math.abs(b.z - pz) > range + 35) continue;
    mctx.fillStyle = b.h > 40 ? '#2c3b4c' : '#1f2a36';
    mctx.fillRect((b.x - px - b.w / 2) * scale, (b.z - pz - b.d / 2) * scale, b.w * scale, b.d * scale);
  }

  for (const p of pickups) {
    if (!p.active) continue;
    if (Math.abs(p.group.position.x - px) > range || Math.abs(p.group.position.z - pz) > range) continue;
    mctx.fillStyle = p.type === 'health' ? '#ff6b5a' : p.type === 'ammo' ? '#ffd23f' : '#8ee06a';
    mctx.beginPath();
    mctx.arc((p.group.position.x - px) * scale, (p.group.position.z - pz) * scale, 2.2, 0, TAU);
    mctx.fill();
  }

  if (!mission) {
    for (const def of missionDefs) {
      if (state.time < def.cooldown) continue;
      mctx.fillStyle = '#ffc531';
      mctx.beginPath();
      mctx.arc((def.x - px) * scale, (def.z - pz) * scale, 5, 0, TAU);
      mctx.fill();
      mctx.strokeStyle = 'rgba(0,0,0,.7)';
      mctx.lineWidth = 1.5;
      mctx.stroke();
    }
  } else if (mission.def.id === 'delivery' && mission.phase === 'deliver') {
    const cp = mission.checkpoints[mission.index];
    if (cp) {
      mctx.fillStyle = '#65e06a';
      mctx.beginPath();
      mctx.arc((cp.x - px) * scale, (cp.z - pz) * scale, 6, 0, TAU);
      mctx.fill();
    }
  }
  if (mission && mission.def.id === 'hit' && mission.target && mission.target.alive) {
    const tx = (mission.target.pos.x - px) * scale;
    const tz = (mission.target.pos.z - pz) * scale;
    mctx.strokeStyle = '#c45aff';
    mctx.lineWidth = 3;
    mctx.beginPath();
    mctx.arc(tx, tz, 7, 0, TAU);
    mctx.stroke();
  }
  if (mission && mission.def.id === 'delivery' && mission.phase === 'start' && mission.car && !mission.car.dead) {
    mctx.fillStyle = '#f2c53d';
    mctx.beginPath();
    mctx.arc((mission.car.pos.x - px) * scale, (mission.car.pos.z - pz) * scale, 5, 0, TAU);
    mctx.fill();
  }

  for (const car of vehicles) {
    if (car.dead) continue;
    const dx = car.pos.x - px;
    const dz = car.pos.z - pz;
    if (Math.abs(dx) > range || Math.abs(dz) > range) continue;
    mctx.fillStyle = car.police ? (Math.sin(state.time * 11) > 0 ? '#ff4b3e' : '#4b8dff') : '#7fd7ff';
    mctx.beginPath();
    mctx.arc(dx * scale, dz * scale, 2.6, 0, TAU);
    mctx.fill();
  }

  for (const npc of npcs) {
    if (!npc.alive) continue;
    const dx = npc.pos.x - px;
    const dz = npc.pos.z - pz;
    if (Math.abs(dx) > range || Math.abs(dz) > range) continue;
    mctx.fillStyle = npc.role === 'cop' ? '#ff4b3e' : npc.role === 'gang' ? '#c45aff' : 'rgba(255,255,255,.38)';
    mctx.beginPath();
    mctx.arc(dx * scale, dz * scale, npc.role === 'ped' ? 1.6 : 2.8, 0, TAU);
    mctx.fill();
  }

  mctx.restore();

  mctx.save();
  mctx.fillStyle = '#ffffff';
  mctx.strokeStyle = 'rgba(0,0,0,.8)';
  mctx.lineWidth = 2.5;
  mctx.beginPath();
  mctx.moveTo(cx, cy - 10);
  mctx.lineTo(cx + 7, cy + 8);
  mctx.lineTo(cx, cy + 3.5);
  mctx.lineTo(cx - 7, cy + 8);
  mctx.closePath();
  mctx.fill();
  mctx.stroke();

  const nx = cx + (-Math.sin(yaw)) * (cx - 19);
  const ny = cy + (Math.cos(yaw)) * (cy - 19);
  mctx.fillStyle = 'rgba(8,10,14,.72)';
  mctx.beginPath();
  mctx.arc(nx, ny, 11, 0, TAU);
  mctx.fill();
  mctx.fillStyle = '#ffc531';
  mctx.font = '700 13px "Barlow Condensed", sans-serif';
  mctx.textAlign = 'center';
  mctx.textBaseline = 'middle';
  mctx.fillText('N', nx, ny + 0.5);
  mctx.restore();
}

// ---------------------------------------------------------------------------
// Game loop & boot
// ---------------------------------------------------------------------------
function updatePlaying(dt) {
  updatePlayer(dt);
  updateVehicles(dt);
  updateNpcs(dt);
  updatePickups(dt);
  updateMissions(dt);
  updateWanted(dt);
  updatePolice(dt);
  updateHeli(dt);
  updateMarkers();
  updateHud(dt);
  updateCamera(dt);
  updateSun();
  sound.update(state.driving ? state.driving.speed : 0, !!state.driving, state.wanted);
}

function updateIdle(dt) {
  state.damageFlash = Math.max(0, state.damageFlash - dt * 2.4);
  damageEl.style.opacity = state.damageFlash;
  if (state.areaTimer > 0) {
    state.areaTimer -= dt;
    if (state.areaTimer <= 0) areaEl.classList.remove('show');
  }
  if (state.mode === 'menu') updateMenuCamera();
  sound.update(0, false, 0);
}

let lastFrame = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;
  state.time += dt;
  if (state.mode === 'playing') updatePlaying(dt);
  else updateIdle(dt);
  updateEffects(dt);
  renderer.render(scene, camera);
}

async function boot() {
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { /* ignore */ }
  player.pos.set(-210, 0, -42);
  world = buildWorld(scene, renderer);
  initMissions();

  const spots = [...world.carSpots].sort(() => Math.random() - 0.5).slice(0, 15);
  for (const s of spots) {
    if (Math.hypot(s.x + 210, s.z + 42) < 12) continue;
    makeVehicle({ x: s.x, z: s.z, heading: s.heading, type: pick(['sedan', 'sedan', 'sport', 'van']) });
  }
  makeVehicle({ x: -210, z: -18, heading: 0, type: 'sedan', color: 0x2f6fb5 });
  for (let i = 0; i < 7; i++) spawnTrafficCar();

  let spawned = 0;
  for (let i = 0; i < 200 && spawned < 24; i++) {
    const spot = pick(world.sidewalkPoints);
    if (distToPlayer(spot.x, spot.z) < 22) continue;
    spawnNpc(spot.x, spot.z, 'ped');
    spawned++;
  }
  spawnInitialPickups();

  player.pos.set(-210, 0, -42);
  player.group.position.set(-210, 0, -42);
  player.group.rotation.y = 0;
  player.yaw = 0;
  cam.yaw = 0;
  setMoney();
  setHealthUI();
  setWantedUI();
  setWeaponUI();
  setupInput();
  updateSun();
  const compassEl = $('compass');
  if (compassEl) compassEl.style.display = 'none';

  window.__rooster = {
    state, player, world, vehicles, npcs, pickups, missionDefs, scene, camera, renderer, cam, snapCamera,
    start: startGame,
    teleport(x, z) { player.pos.set(x, 0, z); player.y = 0; snapCamera(); },
    stars(n) { state.wantedPoints = WANTED_THRESHOLDS[clamp(n, 0, 5)] || 0; state.wanted = clamp(n, 0, 5); state.lastCrime = state.time; setWantedUI(); },
    money(n) { state.money = n; setMoney(); },
    mission(id) { const d = missionDefs.find((m) => m.id === id); if (d) startMission(d); },
    getMission() { return mission; },
    setHealth(n) { player.health = n; setHealthUI(); },
    hurt(n) { hurtPlayer(n, 'kerusuhan'); },
    damageCar(car, n) { damageCar(car, n); },
    killNpc(npc) { killNpc(npc, { byPlayer: true }); },
  };

  requestAnimationFrame(() => {
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 220);
  });
  animate(performance.now());
}

boot();
