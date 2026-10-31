import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, rand, pick, TAU, makeCanvasTexture } from './utils.js';

export const CITY = {
  lines: Array.from({ length: 10 }, (_, i) => -378 + i * 84),
  cell: 84,
  road: 18,
  block: 66,
  half: 378,
  playHalf: 370,
};

const PALETTES = [0xbf6b4f, 0xcfa87c, 0x8b9aa8, 0x9c7b8f, 0x7e957f, 0xc98a5e, 0x6f7f9c, 0xb0a08a];
const DISTRICTS = [
  'GANG SENGKETA', 'PASAR PAGI', 'TERMINAL TELUR',
  'KAMPUNG AYAM', 'KOTA TUA', 'BLOK JAGO',
  'PANTAI KREMES', 'BUKIT BULU', 'HUTAN BETIS',
];

const BILLBOARDS = [
  { x: -280, z: -168, ry: -Math.PI / 2, text: 'ROOSTER CITY', sub: 'SAN AYAM', bg: '#d8452e', fg: '#ffe9a8' },
  { x: 196, z: 210, ry: Math.PI / 2, text: 'AYAM GORENG', sub: 'PAK JAGO · 24 JAM', bg: '#f2c53d', fg: '#2a1608' },
  { x: -126, z: 280, ry: Math.PI, text: 'JANGAN RUSUH', sub: 'KOTA INI MILIK KITA', bg: '#1d2733', fg: '#ffc531' },
  { x: 42, z: -280, ry: 0, text: 'PISTOL?', sub: 'ILEGAL, TAPI SERU', bg: '#5a2c6e', fg: '#ffd8ff' },
  { x: 280, z: -42, ry: -Math.PI / 2, text: 'SAN AYAM', sub: 'KOTA TANPA TIDUR', bg: '#197a6a', fg: '#e7fff8' },
];

function makeFacadeTextures(seed, anisotropy) {
  const rng = mulberry32(seed);
  const lit = [];
  for (let i = 0; i < 16; i++) lit.push(rng() < 0.22);
  const facade = makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d8d2c4';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) {
      ctx.fillStyle = 'rgba(66,56,46,.20)';
      ctx.fillRect(0, y * 64 + 55, w, 4);
    }
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const px = x * 64 + 12;
        const py = y * 64 + 12;
        const on = lit[y * 4 + x];
        ctx.fillStyle = on ? '#ffe6ad' : '#26303d';
        ctx.fillRect(px, py, 40, 34);
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.fillRect(px + 3, py + 3, 34, 8);
        ctx.strokeStyle = 'rgba(34,30,28,.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, 40, 34);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.fillRect(0, 0, 6, h);
  }, { anisotropy });
  const emissive = makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (!lit[y * 4 + x]) continue;
        ctx.fillStyle = '#ffcf82';
        ctx.fillRect(x * 64 + 12, y * 64 + 12, 40, 34);
      }
    }
  }, { anisotropy });
  return { facade, emissive };
}

function windowBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faces = [
    [d, h], [d, h],
    [w, d], [w, d],
    [w, h], [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const uRep = Math.max(1, Math.round(faces[f][0] / 9.5));
    const vRep = Math.max(1, Math.round(faces[f][1] / 9.5));
    for (let i = f * 4; i < f * 4 + 4; i++) {
      uv.setXY(i, uv.getX(i) * uRep, uv.getY(i) * vRep);
    }
  }
  return g;
}

function makeSky(scene) {
  const geo = new THREE.SphereGeometry(1100, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x18365f) },
      mid: { value: new THREE.Color(0xd9774f) },
      bottom: { value: new THREE.Color(0xffc27a) },
      sunDir: { value: new THREE.Vector3(-0.48, 0.2, 0.86).normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(bottom, mid, smoothstep(-0.02, 0.24, h));
        col = mix(col, top, smoothstep(0.2, 0.7, h));
        float sun = pow(max(dot(d, sunDir), 0.0), 320.0);
        float glow = pow(max(dot(d, sunDir), 0.0), 9.0);
        col += vec3(1.0, 0.82, 0.5) * sun * 1.5;
        col += vec3(1.0, 0.45, 0.18) * glow * 0.2;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  scene.add(sky);

  // sun glow sprite
  const sunDir = mat.uniforms.sunDir.value;
  const sunTex = makeCanvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,246,214,1)');
    g.addColorStop(0.22, 'rgba(255,213,140,.95)');
    g.addColorStop(0.55, 'rgba(255,150,70,.35)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { repeat: false });
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sun.position.copy(sunDir).multiplyScalar(880);
  sun.scale.set(260, 260, 1);
  scene.add(sun);

  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(28, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, toneMapped: false, fog: false })
  );
  sunDisc.position.copy(sunDir).multiplyScalar(840);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);
  return { sky, sun, sunDir };
}

function makeMountains(scene) {
  const rng = mulberry32(9137);
  const geos = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + rng() * 0.16;
    const r = 620 + rng() * 190;
    const height = 55 + rng() * 130;
    const radius = 90 + rng() * 120;
    const g = new THREE.ConeGeometry(radius, height, 5, 1);
    g.translate(Math.cos(a) * r, height / 2 - 6, Math.sin(a) * r);
    geos.push(g);
  }
  const mesh = new THREE.Mesh(
    mergeGeometries(geos, false),
    new THREE.MeshStandardMaterial({ color: 0x5a4d69, roughness: 1, flatShading: true })
  );
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  scene.add(mesh);
  return mesh;
}

function makePalmGeometry() {
  const trunk = new THREE.CylinderGeometry(0.16, 0.3, 5.2, 5);
  trunk.translate(0, 2.6, 0);
  const fronds = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.ConeGeometry(0.62, 3.8, 4, 1);
    g.scale(1, 1, 0.32);
    g.translate(0, 1.9, 0);
    g.rotateZ(1.16);
    g.rotateY((i / 7) * TAU + 0.3);
    g.translate(0, 4.9, 0);
    fronds.push(g);
  }
  const leaves = mergeGeometries(fronds, false);
  return { trunk, leaves };
}

function makeBillboard(def, anisotropy) {
  const group = new THREE.Group();
  const tex = makeCanvasTexture(512, 224, (ctx, w, h) => {
    ctx.fillStyle = def.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(0, h - 28, w, 28);
    ctx.fillStyle = def.fg;
    ctx.textAlign = 'center';
    ctx.font = '400 86px "Anton", Impact, sans-serif';
    ctx.fillText(def.text, w / 2, 108);
    ctx.font = '700 34px "Barlow Condensed", sans-serif';
    ctx.letterSpacing = '4px';
    ctx.fillText(def.sub, w / 2, 164);
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);
  }, { repeat: false, anisotropy });
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 5.7),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
  );
  panel.position.y = 8.2;
  group.add(panel);
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(13.2, 5.9, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9 })
  );
  back.position.set(0, 8.2, -0.16);
  group.add(back);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4b4f57, roughness: 0.8, metalness: 0.3 });
  for (const sx of [-4.6, 4.6]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 8.4, 6), postMat);
    post.position.set(sx, 4.2, -0.4);
    post.castShadow = true;
    group.add(post);
  }
  group.position.set(def.x, 0, def.z);
  group.rotation.y = def.ry;
  return group;
}

export function buildWorld(scene, renderer) {
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const colliders = [];
  const buildings = [];
  const solidMeshes = [];
  const sidewalkPoints = [];
  const carSpots = [];
  const intersections = [];
  const rng = mulberry32(20261031);

  const { sunDir } = makeSky(scene);

  scene.fog = new THREE.Fog(0xdf9c6c, 150, 640);

  const hemi = new THREE.HemisphereLight(0xb8d6ff, 0x6b5138, 1.35);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffc08a, 2.7);
  sun.position.set(-120, 160, 170);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 460;
  sun.shadow.camera.left = -95;
  sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95;
  sun.shadow.camera.bottom = -95;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.045;
  scene.add(sun);
  const sunTarget = new THREE.Object3D();
  scene.add(sunTarget);
  sun.target = sunTarget;

  const ambient = new THREE.AmbientLight(0xffd9b8, 0.5);
  scene.add(ambient);

  makeMountains(scene);

  // desert floor + asphalt city base
  const desert = new THREE.Mesh(
    new THREE.PlaneGeometry(1900, 1900),
    new THREE.MeshStandardMaterial({ color: 0xa37e5a, roughness: 1 })
  );
  desert.rotation.x = -Math.PI / 2;
  desert.position.y = -0.09;
  desert.receiveShadow = true;
  scene.add(desert);

  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800),
    new THREE.MeshStandardMaterial({ color: 0x353941, roughness: 0.96 })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.02;
  base.receiveShadow = true;
  scene.add(base);

  // road dashes
  const dashGeos = [];
  for (const line of CITY.lines) {
    for (let t = -368; t <= 368; t += 14) {
      if (CITY.lines.some((l) => Math.abs(t - l) < 10)) continue;
      const gv = new THREE.PlaneGeometry(0.34, 5.6);
      gv.rotateX(-Math.PI / 2);
      gv.translate(line, 0.012, t);
      dashGeos.push(gv);
      const gh = new THREE.PlaneGeometry(5.6, 0.34);
      gh.rotateX(-Math.PI / 2);
      gh.translate(t, 0.012, line);
      dashGeos.push(gh);
    }
  }
  const dashMesh = new THREE.Mesh(
    mergeGeometries(dashGeos, false),
    new THREE.MeshStandardMaterial({ color: 0xd8cfa8, roughness: 0.85, emissive: 0x3a321d, emissiveIntensity: 0.25 })
  );
  dashMesh.receiveShadow = true;
  scene.add(dashMesh);

  // sidewalk blocks
  const walkGeos = [];
  const parkGeos = [];
  const blockCenters = [];
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const cx = -336 + i * 84;
      const cz = -336 + j * 84;
      blockCenters.push([cx, cz]);
      const slab = new THREE.BoxGeometry(66, 0.18, 66);
      slab.translate(cx, 0.07, cz);
      walkGeos.push(slab);
      for (const [sx, sz] of [[-31, -31], [31, -31], [-31, 31], [31, 31], [0, -31], [0, 31], [-31, 0], [31, 0]]) {
        sidewalkPoints.push({ x: cx + sx + (sx === 0 ? rand(-18, 18) : 0), z: cz + sz + (sz === 0 ? rand(-18, 18) : 0) });
      }
    }
  }
  const walkMesh = new THREE.Mesh(
    mergeGeometries(walkGeos, false),
    new THREE.MeshStandardMaterial({ color: 0xaaa69c, roughness: 0.95 })
  );
  walkMesh.receiveShadow = true;
  scene.add(walkMesh);

  // facades
  const tex = makeFacadeTextures(4711, anisotropy);
  const wallMaterials = PALETTES.map((color) => new THREE.MeshStandardMaterial({
    color,
    map: tex.facade,
    emissiveMap: tex.emissive,
    emissive: 0xffb15c,
    emissiveIntensity: 0.55,
    roughness: 0.93,
    metalness: 0.02,
  }));
  const wallGeos = PALETTES.map(() => []);
  const trimGeos = [];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x615f5c, roughness: 0.98 });

  function addBuilding(cx, cz, w, d, h, paletteIndex) {
    const g = windowBox(w, h, d);
    g.translate(cx, h / 2 + 0.16, cz);
    wallGeos[paletteIndex].push(g);

    const roof = new THREE.BoxGeometry(w + 0.5, 0.55, d + 0.5);
    roof.translate(cx, h + 0.42, cz);
    trimGeos.push(roof);

    const plinth = new THREE.BoxGeometry(w + 0.7, 1.15, d + 0.7);
    plinth.translate(cx, 0.72, cz);
    trimGeos.push(plinth);

    if (h > 22 && rng() < 0.5) {
      const ac = new THREE.BoxGeometry(rand(1.2, 2.4), rand(0.6, 1.2), rand(1.2, 2.4));
      ac.translate(cx + rand(-w / 3, w / 3), h + 1.0, cz + rand(-d / 3, d / 3));
      trimGeos.push(ac);
    }
    if (h > 42 && rng() < 0.45) {
      const tank = new THREE.CylinderGeometry(1.25, 1.25, 2.1, 8);
      tank.translate(cx + rand(-w / 3, w / 3), h + 2.4, cz + rand(-d / 3, d / 3));
      trimGeos.push(tank);
    }

    colliders.push({ minX: cx - w / 2 - 0.2, maxX: cx + w / 2 + 0.2, minZ: cz - d / 2 - 0.2, maxZ: cz + d / 2 + 0.2, h });
    buildings.push({ x: cx, z: cz, w, d, h });
  }

  for (const [bx, bz] of blockCenters) {
    const dist = Math.hypot(bx, bz) / 480;
    const centerBoost = Math.pow(Math.max(0, 1 - dist), 1.7);
    const baseH = 9 + 62 * centerBoost;
    const roll = rng();

    if (roll < 0.085) {
      // little park
      const grass = new THREE.BoxGeometry(58, 0.22, 58);
      grass.translate(bx, 0.15, bz);
      parkGeos.push(grass);
      continue;
    }

    if (roll < 0.36) {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          if (rng() < 0.12) continue;
          const w = rand(22, 25.5);
          const d = rand(22, 25.5);
          const h = baseH * rand(0.55, 1.25) + rand(0, 6);
          addBuilding(bx + sx * 14.5, bz + sz * 14.5, w, d, Math.max(7, h), Math.floor(rng() * PALETTES.length));
        }
      }
    } else if (roll < 0.56) {
      for (const sx of [-1, 1]) {
        const w = rand(22, 25.5);
        const d = rand(48, 54);
        const h = baseH * rand(0.6, 1.3) + rand(0, 8);
        addBuilding(bx + sx * 14.7, bz, w, d, Math.max(8, h), Math.floor(rng() * PALETTES.length));
      }
    } else {
      const w = rand(34, 52);
      const d = rand(34, 52);
      let h = baseH * rand(0.7, 1.35) + rand(0, 10);
      if (rng() < 0.14) h += 28;
      addBuilding(bx, bz, w, d, Math.max(9, h), Math.floor(rng() * PALETTES.length));
    }
  }

  wallGeos.forEach((geos, i) => {
    if (!geos.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), wallMaterials[i]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    solidMeshes.push(mesh);
  });

  const trimMesh = new THREE.Mesh(mergeGeometries(trimGeos, false), roofMat);
  trimMesh.castShadow = true;
  trimMesh.receiveShadow = true;
  scene.add(trimMesh);
  solidMeshes.push(trimMesh);

  if (parkGeos.length) {
    const parkMesh = new THREE.Mesh(
      mergeGeometries(parkGeos, false),
      new THREE.MeshStandardMaterial({ color: 0x517a3c, roughness: 1 })
    );
    parkMesh.receiveShadow = true;
    scene.add(parkMesh);
  }

  // palms (instanced)
  const palm = makePalmGeometry();
  const palmCount = 78;
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5533, roughness: 0.95 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7d3b, roughness: 0.9, side: THREE.DoubleSide });
  const trunks = new THREE.InstancedMesh(palm.trunk, trunkMat, palmCount);
  const leaves = new THREE.InstancedMesh(palm.leaves, leafMat, palmCount);
  trunks.castShadow = true;
  leaves.castShadow = true;
  trunks.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < palmCount; i++) {
    let p;
    if (i < 60) p = pick(sidewalkPoints);
    else {
      const b = pick(blockCenters);
      p = { x: b[0] + rand(-24, 24), z: b[1] + rand(-24, 24) };
    }
    const s = rand(0.8, 1.35);
    dummy.position.set(p.x, 0.12, p.z);
    dummy.rotation.set(0, rand(0, TAU), 0);
    dummy.scale.set(s, s * rand(0.9, 1.15), s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    leaves.setMatrixAt(i, dummy.matrix);
  }
  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  scene.add(trunks, leaves);

  // street lights
  const poleGeos = [];
  const lampGeos = [];
  for (const line of CITY.lines) {
    for (let t = -360; t <= 360; t += 48) {
      if (CITY.lines.some((l) => Math.abs(t - l) < 18)) continue;
      // along vertical roads
      poleGeos.push(new THREE.CylinderGeometry(0.11, 0.16, 7, 5).translate(line + 10.5, 3.5, t));
      poleGeos.push(new THREE.BoxGeometry(2.1, 0.14, 0.14).translate(line + 9.5, 6.95, t));
      lampGeos.push(new THREE.BoxGeometry(0.85, 0.18, 0.42).translate(line + 8.6, 6.86, t));
      // along horizontal roads
      poleGeos.push(new THREE.CylinderGeometry(0.11, 0.16, 7, 5).translate(t, 3.5, line + 10.5));
      poleGeos.push(new THREE.BoxGeometry(0.14, 0.14, 2.1).translate(t, 6.95, line + 9.5));
      lampGeos.push(new THREE.BoxGeometry(0.42, 0.18, 0.85).translate(t, 6.86, line + 8.6));
    }
  }
  const poleMesh = new THREE.Mesh(
    mergeGeometries(poleGeos, false),
    new THREE.MeshStandardMaterial({ color: 0x3a3e45, roughness: 0.7, metalness: 0.35 })
  );
  poleMesh.castShadow = true;
  scene.add(poleMesh);
  const lampMesh = new THREE.Mesh(
    mergeGeometries(lampGeos, false),
    new THREE.MeshStandardMaterial({ color: 0xffe0a8, emissive: 0xffb45c, emissiveIntensity: 1.4, roughness: 0.4 })
  );
  scene.add(lampMesh);

  // hydrants & bins
  const hydrantGeos = [];
  const binGeos = [];
  for (let i = 0; i < 44; i++) {
    const p = pick(sidewalkPoints);
    if (i % 2 === 0) {
      hydrantGeos.push(new THREE.CylinderGeometry(0.18, 0.22, 0.75, 6).translate(p.x, 0.55, p.z));
      hydrantGeos.push(new THREE.SphereGeometry(0.2, 6, 5).translate(p.x, 0.95, p.z));
    } else {
      binGeos.push(new THREE.BoxGeometry(0.62, 1.0, 0.62).translate(p.x, 0.68, p.z));
    }
  }
  const hydrantMesh = new THREE.Mesh(
    mergeGeometries(hydrantGeos, false),
    new THREE.MeshStandardMaterial({ color: 0xc23b2b, roughness: 0.7 })
  );
  hydrantMesh.castShadow = true;
  scene.add(hydrantMesh);
  const binMesh = new THREE.Mesh(
    mergeGeometries(binGeos, false),
    new THREE.MeshStandardMaterial({ color: 0x2f4a37, roughness: 0.95 })
  );
  binMesh.castShadow = true;
  scene.add(binMesh);

  // billboards
  for (const b of BILLBOARDS) {
    const bb = makeBillboard(b, anisotropy);
    scene.add(bb);
  }

  // mission spots at intersections
  const missionSpots = [
    { x: -294, z: -126, name: 'GANG SENGKETA' },
    { x: 210, z: 126, name: 'KOTA TUA' },
    { x: -126, z: 294, name: 'PANTAI KREMES' },
    { x: 126, z: -294, name: 'TERMINAL TELUR' },
  ];

  for (const lx of CITY.lines) {
    for (const lz of CITY.lines) {
      intersections.push({ x: lx, z: lz });
    }
  }

  // parked car spots along curbs
  const usedSpots = new Set();
  for (let i = 0; i < 34; i++) {
    const vertical = rng() < 0.5;
    const line = pick(CITY.lines);
    const side = rng() < 0.5 ? -1 : 1;
    const t = rand(-340, 340);
    if (CITY.lines.some((l) => Math.abs(t - l) < 14)) continue;
    const key = `${line.toFixed(0)}:${t.toFixed(0)}:${vertical}`;
    if (usedSpots.has(key)) continue;
    usedSpots.add(key);
    if (vertical) {
      carSpots.push({ x: line + side * 6.4, z: t, heading: side > 0 ? Math.PI : 0 });
    } else {
      carSpots.push({ x: t, z: line + side * 6.4, heading: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
  }

  function districtAt(x, z) {
    const ix = Math.max(0, Math.min(2, Math.floor((x + 378) / 252)));
    const iz = Math.max(0, Math.min(2, Math.floor((z + 378) / 252)));
    return DISTRICTS[iz * 3 + ix];
  }

  function randomRoadPoint(minDistFromPlayer = 0, px = 0, pz = 0) {
    for (let tries = 0; tries < 40; tries++) {
      const vertical = rng() < 0.5;
      const line = pick(CITY.lines);
      const t = rand(-340, 340);
      const x = vertical ? line + rand(-4, 4) : t;
      const z = vertical ? t : line + rand(-4, 4);
      if (Math.hypot(x - px, z - pz) < minDistFromPlayer) continue;
      return { x, z, vertical };
    }
    return { x: 0, z: 0, vertical: true };
  }

  return {
    colliders,
    buildings,
    solidMeshes,
    sidewalkPoints,
    carSpots,
    intersections,
    missionSpots,
    districtAt,
    randomRoadPoint,
    sun,
    sunTarget,
    sunDir,
    playHalf: CITY.playHalf,
    lines: CITY.lines,
  };
}
