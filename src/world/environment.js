import * as THREE from 'three';

// The same height function grounds the landscape, paths, props, and visitor.
export const WORLD_RADIUS = 38;
export const WORLD_STATIONS = [
  { id: 'talk', label: 'Listening Cove', subtitle: 'Make room for what is here', x: -12, z: 8, color: '#d78e81', icon: '◎' },
  { id: 'landscape', label: 'Mirror Pool', subtitle: 'Notice your inner weather', x: 12, z: 9, color: '#789fba', icon: '≈' },
  { id: 'compass', label: 'Compass Hill', subtitle: 'Find a direction that feels like you', x: 0, z: -16, color: '#b89a58', icon: '✧' },
  { id: 'replay', label: 'Rehearsal Theatre', subtitle: 'Try another way to respond', x: -21, z: -7, color: '#af8daf', icon: '↻' },
  { id: 'skills', label: 'Stillwater Garden', subtitle: 'Practice a little steadiness', x: 22, z: -9, color: '#7c9c81', icon: '⌁' },
  { id: 'wisdom', label: 'Wisdom Grove', subtitle: 'Sit with a different perspective', x: -12, z: -23, color: '#b39a6b', icon: '☼' },
];

const TAU = Math.PI * 2;
const smooth = (a, b, value) => {
  const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const blend = (a, b, t) => a + (b - a) * t;
const gaussian = (x, z, cx, cz, width) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / width);

function rawHeight(x, z) {
  const rolling = 0.82 + Math.sin(x * 0.13) * Math.cos(z * 0.105) * 0.37
    + Math.sin(z * 0.18 + x * 0.065) * 0.19
    + gaussian(x, z, 0, -16, 160) * 1.95
    + gaussian(x, z, -14, -24, 95) * 0.85
    + gaussian(x, z, 19, -7, 95) * 0.45;
  return blend(rolling, -0.78, smooth(32, 41, Math.hypot(x, z)));
}

export function terrainHeight(x, z) {
  let height = rawHeight(x, z);
  for (const station of WORLD_STATIONS) {
    const distance = Math.hypot(x - station.x, z - station.z);
    height = blend(height, rawHeight(station.x, station.z), 1 - smooth(3.8, 7.7, distance));
  }
  return height;
}

function seededRandom(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const PATH_ROUTES = [
  [[0, 18], [0, 13], [-0.4, 8], [1.2, 1], [0, -7], [0, -16]],
  [[0, 9], [-4.5, 10.4], [-8.1, 10.8], [-12, 8]],
  [[0, 6], [4.5, 6], [8.3, 7], [12, 9]],
  [[0.6, 1], [-6.6, 1.4], [-13.8, -1.7], [-18.5, -3.7], [-21, -7]],
  [[0.9, -2], [8, -1.3], [14.6, -3.5], [19.2, -6], [22, -9]],
  [[0, -9.3], [-5.4, -14.8], [-8.2, -19.1], [-12, -23]],
  [[-12, 8], [-16.2, 6.5], [-19.8, 1.2], [-21, -7]],
  [[12, 9], [17.9, 9.1], [22.2, 4.2], [23.8, -2.4], [22, -9]],
];

export function createEnvironment(scene) {
  const world = new THREE.Group();
  world.name = 'HPY · a world to wander';
  scene.add(world);
  const colliders = [];
  const random = seededRandom(170329);
  const animate = [];
  const blooms = new Map();
  const materials = new Set();
  const geometries = new Set();
  const batches = new Map();
  const matrix = new THREE.Object3D();
  const scratchColor = new THREE.Color();

  const makeMaterial = options => {
    const material = new THREE.MeshStandardMaterial({ roughness: 0.89, metalness: 0, ...options });
    materials.add(material);
    return material;
  };
  const standard = makeMaterial({ color: '#ffffff' });
  const glow = makeMaterial({ color: '#ffffff', emissive: '#e6b97c', emissiveIntensity: 0.35, roughness: 0.65 });
  const poolMaterial = makeMaterial({ color: '#91bdc1', roughness: 0.23, metalness: 0.12, transparent: true, opacity: 0.91 });
  const sandMaterial = makeMaterial({ color: '#e5d8b4', roughness: 1 });
  const geometry = (shape, value) => {
    if (value) {
      geometries.add(value);
      return value;
    }
    return shapes[shape];
  };
  const shapes = {
    ball: geometry(null, new THREE.SphereGeometry(1, 12, 8)),
    leaf: geometry(null, new THREE.IcosahedronGeometry(1, 1)),
    pebble: geometry(null, new THREE.IcosahedronGeometry(1, 0)),
    cylinder: geometry(null, new THREE.CylinderGeometry(1, 1, 1, 12)),
    cone: geometry(null, new THREE.ConeGeometry(1, 1, 9)),
    box: geometry(null, new THREE.BoxGeometry(1, 1, 1)),
    stem: geometry(null, new THREE.CylinderGeometry(0.035, 0.05, 1, 5)),
    ring: geometry(null, new THREE.TorusGeometry(1, 0.032, 5, 48)),
    petal: geometry(null, new THREE.SphereGeometry(1, 7, 5)),
  };

  // Repeated plants and building components share instanced draw calls.
  function place(shape, color, x, y, z, sx = 1, sy = sx, sz = sx, rotation = [0, 0, 0], options = {}) {
    const mat = options.glow ? glow : standard;
    const key = `${shape}:${options.glow ? 'glow' : 'solid'}:${options.station || ''}`;
    if (!batches.has(key)) batches.set(key, { geometry: shapes[shape], material: mat, station: options.station, items: [] });
    batches.get(key).items.push({ x, y, z, sx, sy, sz, rotation, color });
  }

  function mesh(geo, material, position = [0, 0, 0], scale = [1, 1, 1], parent = world) {
    geometries.add(geo);
    materials.add(material);
    const object = new THREE.Mesh(geo, material);
    object.position.set(...position);
    object.scale.set(...scale);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  const paths = PATH_ROUTES.map(route => new THREE.CatmullRomCurve3(route.map(([x, z]) => new THREE.Vector3(x, 0, z))).getPoints(route.length * 16));
  function pathDistance(x, z) {
    let distance = Infinity;
    for (const path of paths) {
      for (let index = 1; index < path.length; index++) {
        const a = path[index - 1];
        const b = path[index];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
        distance = Math.min(distance, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
      }
    }
    return distance;
  }
  function clearingDistance(x, z) {
    let distance = Math.hypot(x, z - 14) - 3.5;
    for (const station of WORLD_STATIONS) distance = Math.min(distance, Math.hypot(x - station.x, z - station.z) - 5.6);
    return distance;
  }
  function clearForProp(x, z, radius = 0.5) {
    return clearingDistance(x, z) > radius && pathDistance(x, z) > 1.6 + radius
      && !colliders.some(collider => Math.hypot(x - collider.x, z - collider.z) < collider.r + radius + 0.8);
  }
  function collider(x, z, r) {
    if (WORLD_STATIONS.some(station => Math.hypot(x - station.x, z - station.z) < 3.4 + r)) return;
    if (pathDistance(x, z) < 1.35 + r) return;
    colliders.push({ x, z, r });
  }

  // Broad, continuously walkable land, with a warm sandy shoreline.
  const groundPositions = [];
  const groundColors = [];
  const groundIndices = [];
  const sectors = 160;
  const rings = 54;
  const grassGreen = new THREE.Color('#a7bf86');
  const mossGreen = new THREE.Color('#8eac80');
  const limeGreen = new THREE.Color('#bbc98e');
  const sandy = new THREE.Color('#e4d6b2');
  const muted = new THREE.Color('#9aac9c');
  for (let ring = 0; ring <= rings; ring++) {
    for (let sector = 0; sector <= sectors; sector++) {
      const angle = sector / sectors * TAU;
      const edge = 40 + Math.sin(angle * 3 + 0.5) * 0.45 + Math.sin(angle * 7) * 0.28;
      const radius = ring / rings * edge;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const y = terrainHeight(x, z);
      groundPositions.push(x, y, z);
      scratchColor.copy(grassGreen)
        .lerp(mossGreen, (Math.sin(x * 0.12 + z * 0.16) * 0.5 + 0.5) * 0.6)
        .lerp(limeGreen, gaussian(x, z, 3, -10, 250) * 0.35)
        .lerp(muted, gaussian(x, z, 14, 10, 65) * 0.32)
        .lerp(sandy, smooth(31.5, 36, radius));
      groundColors.push(scratchColor.r, scratchColor.g, scratchColor.b);
      if (ring < rings && sector < sectors) {
        const a = ring * (sectors + 1) + sector;
        const b = a + sectors + 1;
        groundIndices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const terrainGeo = new THREE.BufferGeometry();
  terrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(groundPositions, 3));
  terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3));
  terrainGeo.setIndex(groundIndices);
  terrainGeo.computeVertexNormals();
  const terrain = mesh(terrainGeo, makeMaterial({ vertexColors: true, roughness: 1 }));
  terrain.name = 'Walkable island';
  terrain.castShadow = false;
  terrain.userData.walkable = true;
  terrain.userData.ground = true;

  const water = mesh(new THREE.CircleGeometry(240, 96), makeMaterial({ color: '#a9cac4', roughness: 0.6, metalness: 0.06 }), [0, -0.57, 0]);
  water.rotation.x = -Math.PI / 2;
  water.castShadow = false;
  const shoreWaveMaterial = makeMaterial({ color: '#f5efd9', transparent: true, opacity: 0.34, depthWrite: false });
  for (let index = 0; index < 3; index++) {
    const wave = mesh(new THREE.TorusGeometry(41.1 + index * 2.2, 0.065, 4, 160), shoreWaveMaterial, [0, -0.55 + index * 0.008, 0]);
    wave.rotation.x = -Math.PI / 2;
    wave.scale.set(1, 0.974, 1);
    wave.castShadow = false;
    animate.push({ kind: 'shore', object: wave, phase: index * 2.1, base: 1 });
  }

  // Winding paths conform exactly to the terrain and stay clear of tree trunks.
  const pathPositions = [];
  const pathIndices = [];
  for (let routeIndex = 0; routeIndex < paths.length; routeIndex++) {
    const path = paths[routeIndex];
    const base = pathPositions.length / 3;
    for (let index = 0; index < path.length; index++) {
      const previous = path[Math.max(0, index - 1)];
      const next = path[Math.min(path.length - 1, index + 1)];
      const angle = Math.atan2(next.z - previous.z, next.x - previous.x);
      const width = (routeIndex > 5 ? 0.71 : 1.03) + Math.sin(index * 0.3 + routeIndex) * 0.045;
      for (const side of [-1, 1]) {
        const x = path[index].x - Math.sin(angle) * width * side;
        const z = path[index].z + Math.cos(angle) * width * side;
        pathPositions.push(x, terrainHeight(x, z) + 0.036 + routeIndex * 0.0015, z);
      }
      if (index < path.length - 1) {
        const a = base + index * 2;
        pathIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    // Occasional flagstones make the route tactile without becoming a dotted line.
    path.forEach((point, index) => {
      if (index % 8 !== 3 || WORLD_STATIONS.some(station => Math.hypot(point.x - station.x, point.z - station.z) < 3.6)) return;
      const next = path[Math.min(path.length - 1, index + 1)];
      const angle = Math.atan2(next.x - point.x, next.z - point.z);
      place('cylinder', index % 3 ? '#eddbbd' : '#e6ceb0', point.x, terrainHeight(point.x, point.z) + 0.051, point.z, 0.54, 0.026, 0.29, [0, angle, 0]);
    });
  }
  const pathGeo = new THREE.BufferGeometry();
  pathGeo.setAttribute('position', new THREE.Float32BufferAttribute(pathPositions, 3));
  pathGeo.setIndex(pathIndices);
  pathGeo.computeVertexNormals();
  const pathMesh = mesh(pathGeo, makeMaterial({ color: '#e8cdb0', roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  pathMesh.castShadow = false;
  pathMesh.userData.walkable = true;

  function tree(x, z, size = 1, color = '#829a71', blossom = false) {
    const y = terrainHeight(x, z);
    const trunkHeight = 2.9 * size;
    place('cylinder', '#ad9474', x, y + trunkHeight * 0.48, z, 0.19 * size, trunkHeight, 0.19 * size, [0, 0, -0.055]);
    place('cylinder', '#b59a7c', x + 0.28 * size, y + trunkHeight * 0.7, z + 0.06, 0.12 * size, 1.28 * size, 0.12 * size, [0.1, 0, -0.62]);
    const lobes = [[0, 3.28, 0, 1.22, 1.27], [-0.88, 2.76, 0.11, 0.9, 0.89], [0.84, 2.96, -0.08, 0.88, 1.04], [0.12, 2.65, 0.63, 0.98, 0.8]];
    lobes.forEach(([dx, dy, dz, width, height], index) => {
      const tint = new THREE.Color(color).lerp(new THREE.Color('#c3cd98'), index * 0.075);
      place('leaf', tint, x + dx * size, y + dy * size, z + dz * size, width * size, height * size, width * size, [0, random() * TAU, 0.08]);
    });
    if (blossom) {
      for (let index = 0; index < 8; index++) {
        const angle = index / 8 * TAU;
        place('ball', '#e3b6b4', x + Math.cos(angle) * size, y + (2.9 + random() * 0.8) * size, z + Math.sin(angle) * 0.9 * size, 0.25 * size);
      }
    }
    collider(x, z, 0.45 * size);
  }

  function rock(x, z, size = 1, color = '#c4be9d') {
    const y = terrainHeight(x, z);
    place('pebble', color, x, y + size * 0.29, z, size * 0.82, size * 0.65, size, [0.06, random() * TAU, 0.13]);
    if (size > 0.6) collider(x, z, size * 0.8);
  }

  const treePalette = ['#7f9d7b', '#a5b783', '#91a681', '#b5c58b', '#91aaa0'];
  let planted = 0;
  for (let attempt = 0; attempt < 1300 && planted < 112; attempt++) {
    const angle = random() * TAU;
    const radius = Math.sqrt(random()) * 33;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const size = 0.66 + random() * 0.65;
    if (!clearForProp(x, z, 1.1 * size)) continue;
    // Leave broad sight lines from the arrival point and between destinations.
    if (z > 11 && Math.abs(x) < 7) continue;
    tree(x, z, size, treePalette[Math.floor(random() * treePalette.length)], random() > 0.88);
    planted++;
  }
  for (let attempt = 0; attempt < 120; attempt++) {
    const angle = random() * TAU;
    const radius = 6 + random() * 30;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const size = 0.34 + random() * 0.8;
    if (clearForProp(x, z, size)) rock(x, z, size, attempt % 3 ? '#b9b59c' : '#b4b4a8');
  }

  // Tufts, clover, and flowers give walking close to the ground its own detail.
  for (let attempt = 0; attempt < 1550; attempt++) {
    const angle = random() * TAU;
    const radius = Math.sqrt(random()) * 33.5;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (pathDistance(x, z) < 1.35 || clearingDistance(x, z) < -0.9) continue;
    const y = terrainHeight(x, z);
    const size = 0.65 + random() * 0.8;
    if (attempt % 4 === 0) {
      place('leaf', attempt % 3 ? '#96ab72' : '#afbb78', x, y + 0.14, z, 0.38 * size, 0.25 * size, 0.33 * size);
      continue;
    }
    if (attempt % 5 !== 0) {
      place('cone', attempt % 2 ? '#88a76c' : '#b8c889', x, y + 0.2 * size, z, 0.11 * size, 0.44 * size, 0.055 * size, [0.08, random() * TAU, 0.1]);
      place('cone', '#a4bb7b', x + 0.1, y + 0.15 * size, z + 0.03, 0.08 * size, 0.32 * size, 0.04 * size, [0, random() * TAU, -0.22]);
      continue;
    }
    const height = 0.25 + random() * 0.22;
    place('stem', '#78956c', x, y + height / 2, z, 1, height, 1);
    const color = ['#e4b69d', '#c8b8d5', '#f3e4b4', '#eee5cf'][attempt % 4];
    for (let petal = 0; petal < 4; petal++) {
      const a = petal / 4 * TAU;
      place('petal', color, x + Math.cos(a) * 0.105, y + height, z + Math.sin(a) * 0.105, 0.13, 0.055, 0.1, [0, -a, 0]);
    }
    place('ball', '#d8b366', x, y + height + 0.025, z, 0.05);
  }

  function lantern(x, z, size = 1, station) {
    const y = terrainHeight(x, z);
    const options = station ? { station } : {};
    place('cylinder', '#ad9477', x, y + 0.62 * size, z, 0.055 * size, 1.25 * size, 0.055 * size, [0, 0, 0], options);
    place('cylinder', '#d4b38b', x, y + 1.27 * size, z, 0.23 * size, 0.1 * size, 0.23 * size, [0, 0, 0], options);
    place('ball', '#f6dfae', x, y + 1.48 * size, z, 0.19 * size, 0.24 * size, 0.19 * size, [0, 0, 0], { ...options, glow: true });
    place('cone', '#b89877', x, y + 1.78 * size, z, 0.28 * size, 0.19 * size, 0.28 * size, [0, 0, 0], options);
  }

  paths.slice(0, 6).forEach((path, routeIndex) => {
    path.forEach((point, index) => {
      if (index % 29 !== 15 || clearingDistance(point.x, point.z) < 0) return;
      const next = path[Math.min(index + 1, path.length - 1)];
      const angle = Math.atan2(next.z - point.z, next.x - point.x);
      const side = (index + routeIndex) % 2 ? 1 : -1;
      lantern(point.x - Math.sin(angle) * 1.65 * side, point.z + Math.cos(angle) * 1.65 * side, 0.9);
    });
  });

  function bench(cx, cz, angle, station, color = '#c29e7d') {
    const y = terrainHeight(cx, cz);
    const options = { station };
    const local = (dx, dy, dz, sx, sy, sz, tint = color) => place('box', tint,
      cx + dx * Math.cos(angle) + dz * Math.sin(angle), y + dy,
      cz - dx * Math.sin(angle) + dz * Math.cos(angle), sx, sy, sz, [0, angle, 0], options);
    local(0, 0.61, 0, 2.25, 0.16, 0.62);
    local(0, 1.05, -0.28, 2.25, 0.5, 0.13);
    local(-0.8, 0.27, 0, 0.15, 0.55, 0.5, '#e2d1b2');
    local(0.8, 0.27, 0, 0.15, 0.55, 0.5, '#e2d1b2');
    collider(cx, cz, 1.12);
  }

  function arch(x, z, width, height, color, station, rotation = 0) {
    const y = terrainHeight(x, z);
    const outer = width / 2;
    const inner = outer - 0.4;
    const spring = height - outer;
    const shape = new THREE.Shape();
    shape.moveTo(-outer, 0);
    shape.lineTo(-outer, spring);
    shape.absarc(0, spring, outer, Math.PI, 0, true);
    shape.lineTo(outer, 0);
    shape.lineTo(inner, 0);
    shape.lineTo(inner, spring);
    shape.absarc(0, spring, inner, 0, Math.PI, false);
    shape.lineTo(-inner, 0);
    shape.closePath();
    const object = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.47, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 2, steps: 1, curveSegments: 24 }), makeMaterial({ color }), [x, y, z]);
    object.rotation.y = rotation;
    object.userData.station = station;
    collider(x - outer * Math.cos(rotation), z + outer * Math.sin(rotation), 0.42);
    collider(x + outer * Math.cos(rotation), z - outer * Math.sin(rotation), 0.42);
    return object;
  }

  function pool(x, z, rx, rz, station, color = '#91bdc1') {
    const y = terrainHeight(x, z) + 0.062;
    const material = color === '#91bdc1' ? poolMaterial : makeMaterial({ color, roughness: 0.28, metalness: 0.12 });
    const poolMesh = mesh(new THREE.CylinderGeometry(1, 1, 0.04, 64), material, [x, y, z], [rx, 1, rz]);
    poolMesh.userData.station = station;
    poolMesh.castShadow = false;
    const edge = mesh(new THREE.TorusGeometry(1, 0.042, 6, 64), sandMaterial, [x, y + 0.022, z], [rx, rz, 1]);
    edge.rotation.x = -Math.PI / 2;
    edge.userData.station = station;
    edge.castShadow = false;
    for (let index = 0; index < 3; index++) {
      const ripple = mesh(new THREE.TorusGeometry(0.26 + index * 0.27, 0.012, 4, 40), makeMaterial({ color: '#e3ead4', transparent: true, opacity: 0.45, depthWrite: false }), [x + 0.1, y + 0.032, z - 0.1], [1.4, 1, 1]);
      ripple.rotation.x = -Math.PI / 2;
      ripple.castShadow = false;
      animate.push({ kind: 'ripple', object: ripple, phase: index * 2, base: 1.4 });
    }
  }

  WORLD_STATIONS.forEach(station => {
    const { x, z, id, color } = station;
    const y = terrainHeight(x, z);
    const options = { station: id };
    const paving = mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.035, 48), makeMaterial({ color: '#e9d9ba' }), [x, y + 0.023, z]);
    paving.castShadow = false;
    paving.userData.station = id;
    paving.userData.walkable = true;
    const inlay = mesh(new THREE.TorusGeometry(3.17, 0.035, 5, 64), makeMaterial({ color, transparent: true, opacity: 0.7 }), [x, y + 0.049, z]);
    inlay.rotation.x = -Math.PI / 2;
    inlay.castShadow = false;
    inlay.userData.station = id;
    // Small central sigils identify a destination without blocking its entrance.
    place('ring', color, x, y + 0.07, z + 0.2, 0.72, 0.72, 0.72, [-Math.PI / 2, 0, 0], options);
    lantern(x - 3.7, z + 0.8, 1, id);
    lantern(x + 3.7, z + 0.8, 1, id);

    // One small flower records a practiced moment, with no score or judgement.
    const bloom = new THREE.Group();
    bloom.name = `A moment carried from ${station.label}`;
    bloom.position.set(x + 1.65, y + 0.055, z + 1.5);
    bloom.scale.setScalar(0.001);
    bloom.visible = false;
    bloom.userData.station = id;
    world.add(bloom);
    const bloomMaterial = makeMaterial({ color, emissive: color, emissiveIntensity: 0.09 });
    mesh(shapes.cylinder, makeMaterial({ color: '#859966' }), [0, 0.38, 0], [0.035, 0.76, 0.035], bloom);
    mesh(shapes.ball, makeMaterial({ color: '#eacb87', emissive: '#dec088', emissiveIntensity: 0.16 }), [0, 0.84, 0], [0.13, 0.1, 0.13], bloom);
    for (let petal = 0; petal < 5; petal++) {
      const angle = petal / 5 * TAU;
      const blossom = mesh(shapes.ball, bloomMaterial, [Math.cos(angle) * 0.2, 0.79, Math.sin(angle) * 0.2], [0.27, 0.11, 0.17], bloom);
      blossom.rotation.y = -angle;
    }
    blooms.set(id, bloom);

    if (id === 'talk') {
      arch(x, z - 3.5, 4.5, 4.85, '#e4b5a0', id, 0.05);
      arch(x, z - 3.72, 3.3, 4, '#ead3b1', id, 0.05);
      bench(x - 4, z - 0.8, 1.03, id, '#c69782');
      bench(x + 4.1, z - 1.1, -1.04, id, '#c69782');
      place('ball', '#dba496', x, y + 3.33, z - 3.4, 0.52, 0.55, 0.52, [0, 0, 0], options);
      const hoop = mesh(new THREE.TorusGeometry(0.88, 0.035, 6, 48), makeMaterial({ color: '#fff0cd', emissive: '#c8a885', emissiveIntensity: 0.15 }), [x, y + 3.36, z - 3.17]);
      hoop.userData.station = id;
      animate.push({ kind: 'orbit', object: hoop, phase: 0 });
      tree(x - 5.5, z - 3.4, 1.35, '#a1b788', true);
      tree(x + 5.3, z - 4, 1.1, '#aec29a', true);
    }

    if (id === 'landscape') {
      pool(x, z - 3.7, 3.1, 2.15, id);
      // A moon gate behind water offers a literal frame for reflection.
      const gate = mesh(new THREE.TorusGeometry(2.35, 0.24, 10, 72), makeMaterial({ color: '#e9e0c9' }), [x, y + 2.6, z - 4.2]);
      gate.userData.station = id;
      place('cylinder', '#d9d5bc', x - 2.13, y + 0.32, z - 4.2, 0.44, 0.64, 0.44, [0, 0, 0], options);
      place('cylinder', '#d9d5bc', x + 2.13, y + 0.32, z - 4.2, 0.44, 0.64, 0.44, [0, 0, 0], options);
      collider(x - 2.13, z - 4.2, 0.46);
      collider(x + 2.13, z - 4.2, 0.46);
      for (let index = 0; index < 5; index++) {
        const px = x - 1.85 + index * 0.84;
        place('cylinder', '#dfd9bc', px, y + 0.135, z - 2.9 + Math.sin(index * 0.7) * 0.3, 0.42, 0.16, 0.31, [0, index * 0.4, 0], options);
      }
      for (let index = 0; index < 7; index++) {
        const a = index * 1.39;
        const px = x + Math.cos(a) * 2.3;
        const pz = z - 3.7 + Math.sin(a) * 1.5;
        place('cylinder', '#8fa780', px, y + 0.1, pz, 0.25, 0.018, 0.21, [0, a, 0], options);
        if (index % 2 === 0) place('ball', '#edc6bd', px, y + 0.21, pz, 0.13, 0.11, 0.13, [0, 0, 0], options);
      }
      bench(x + 4.4, z - 0.8, -1.3, id);
      tree(x - 5.6, z - 4.5, 1.2, '#8ca9a0');
      tree(x + 5.5, z - 4.3, 1.12, '#9eb6a3');
    }

    if (id === 'compass') {
      const cy = terrainHeight(x, z - 2.2);
      place('cylinder', '#dbc39d', x, cy + 0.15, z - 2.2, 1.57, 0.28, 1.57, [0, 0, 0], options);
      place('cylinder', '#f0dfbd', x, cy + 0.72, z - 2.2, 0.68, 1.2, 0.68, [0, 0, 0], options);
      place('ball', '#e5b663', x, cy + 2.78, z - 2.2, 0.72, 0.72, 0.72, [0, 0, 0], { ...options, glow: true });
      for (let index = 0; index < 3; index++) {
        const ring = mesh(new THREE.TorusGeometry(1.57, index === 2 ? 0.068 : 0.105, 8, 64), makeMaterial({ color: index === 2 ? '#f3dfb1' : '#bc995d', metalness: 0.18, roughness: 0.57 }), [x, cy + 2.78, z - 2.2]);
        ring.rotation.set(index === 1 ? Math.PI / 2 : 0.28, index === 2 ? 1.03 : 0, index === 2 ? 0.75 : 0);
        ring.userData.station = id;
        animate.push({ kind: 'compass', object: ring, phase: index * 1.2, index });
      }
      for (let index = 0; index < 8; index++) {
        const a = index / 8 * TAU;
        const r = index % 2 ? 1.32 : 1.78;
        place('box', '#c5a768', x + Math.sin(a) * r, y + 0.062, z + 0.7 + Math.cos(a) * r, 0.085, 0.016, index % 2 ? 0.38 : 0.66, [0, a, 0], options);
      }
      for (const side of [-1, 1]) {
        place('cylinder', '#e6d7b6', x + side * 3.4, terrainHeight(x + side * 3.4, z - 3.7) + 0.45, z - 3.7, 0.42, 0.9, 0.42, [0, 0, 0], options);
        place('ball', '#bcbda0', x + side * 3.4, y + 1.27, z - 3.7, 0.59, 0.4, 0.59, [0, 0, 0], options);
      }
      bench(x + 4.4, z + 0.1, -1.2, id, '#b8a185');
    }

    if (id === 'replay') {
      arch(x, z - 3.3, 5.2, 4.8, '#bfa5b9', id);
      arch(x, z - 3.55, 4.15, 4.04, '#eddac2', id);
      place('cylinder', '#d2bcbd', x, y + 0.065, z - 2.8, 2.72, 0.1, 1.72, [0, 0, 0], options);
      for (const side of [-1, 1]) {
        place('cylinder', '#a781a0', x + side * 1.92, y + 2.34, z - 3.36, 0.34, 3.55, 0.23, [0, 0, side * -0.035], options);
        place('ball', '#e0c6b2', x + side * 1.92, y + 0.71, z - 3.35, 0.3, 0.18, 0.3, [0, 0, 0], options);
      }
      bench(x - 4.4, z + 0.2, 0.88, id, '#b696a6');
      bench(x + 4.4, z + 0.2, -0.88, id, '#b696a6');
      place('ball', '#e9bf99', x - 0.62, y + 3.9, z - 3.1, 0.36, 0.45, 0.15, [0, 0, 0.16], options);
      place('ball', '#eadbc2', x + 0.2, y + 3.93, z - 3.08, 0.36, 0.45, 0.15, [0, 0, -0.16], options);
      tree(x - 5.3, z - 3.5, 1.1, '#a7ae8d', true);
      tree(x + 5.4, z - 4.3, 1.3, '#929d8a', true);
    }

    if (id === 'skills') {
      pool(x - 3.1, z - 2.6, 1.4, 2.5, id, '#9eccc2');
      pool(x + 3.1, z - 2.6, 1.4, 2.5, id, '#9eccc2');
      for (let index = 0; index < 5; index++) {
        const width = 1.12 - index * 0.17;
        place('ball', index % 2 ? '#c8bfaa' : '#e3d9bd', x + Math.sin(index * 1.4) * 0.12, y + 0.43 + index * 0.5, z - 2.65,
          width, 0.32 - index * 0.022, width * 0.77, [0, index * 0.55, 0], options);
      }
      const breathing = mesh(new THREE.TorusGeometry(1.33, 0.038, 6, 64), makeMaterial({ color: '#dbdeaf', emissive: '#b5b66c', emissiveIntensity: 0.23 }), [x, y + 1.7, z - 2.9]);
      breathing.rotation.x = -Math.PI / 2;
      breathing.userData.station = id;
      animate.push({ kind: 'breathe', object: breathing, phase: 0, base: 1 });
      for (const side of [-1, 1]) {
        for (let index = 0; index < 4; index++) {
          const px = x + side * (4.2 + Math.sin(index) * 0.18);
          const pz = z - 3.7 + index * 0.8;
          const py = terrainHeight(px, pz);
          const height = 2.8 + Math.sin(index * 2.1) * 0.7;
          place('cylinder', '#9eac75', px, py + height / 2, pz, 0.1, height, 0.1, [0, 0, side * 0.03], options);
          for (let leaf = 0; leaf < 3; leaf++) {
            place('leaf', '#aabd8a', px + side * 0.3, py + height - 0.7 + leaf * 0.28, pz + Math.sin(leaf) * 0.23, 0.6, 0.12, 0.22, [0, leaf * 1.7, side * -0.25], options);
          }
        }
      }
      bench(x + 4.6, z + 1, -1.1, id, '#9fac8a');
    }

    if (id === 'wisdom') {
      // A generous, spreading tree makes a grove, rather than a temple to solve.
      const tx = x;
      const tz = z - 4.2;
      const ty = terrainHeight(tx, tz);
      place('cylinder', '#a79070', tx, ty + 2.3, tz, 0.49, 4.6, 0.44, [0, 0, 0.06], options);
      for (let index = 0; index < 5; index++) {
        const a = index / 5 * TAU;
        place('cylinder', '#b19b78', tx + Math.sin(a) * 0.95, ty + 3.4, tz + Math.cos(a) * 0.8, 0.17, 2.9, 0.17, [Math.cos(a) * 0.75, 0, -Math.sin(a) * 0.75], options);
        place('leaf', index % 2 ? '#bec894' : '#acbd8c', tx + Math.sin(a) * 2, ty + 4.5 + Math.sin(index * 1.7) * 0.33, tz + Math.cos(a) * 1.8, 2.26, 1.13, 2.13, [0, a, 0], options);
      }
      place('leaf', '#c8ce9e', tx, ty + 5.55, tz, 2.2, 1.08, 2.05, [0, 0.3, 0], options);
      collider(tx, tz, 0.76);
      for (let index = 0; index < 9; index++) {
        const a = index / 9 * TAU;
        const px = tx + Math.sin(a) * 2.23;
        const pz = tz + Math.cos(a) * 2.03;
        place('stem', '#cab98b', px, ty + 3.9, pz, 0.6, 1.3, 0.6, [0, 0, 0], options);
        place('petal', index % 2 ? '#e1c59b' : '#f2e4bd', px, ty + 3.25, pz, 0.14, 0.24, 0.08, [0, a, -0.12], options);
      }
      bench(x - 4.3, z - 0.5, 0.94, id, '#bb9e79');
      bench(x + 4.3, z - 0.5, -0.94, id, '#bb9e79');
      for (let index = 0; index < 8; index++) {
        const a = index / 8 * TAU;
        place('petal', '#c5ac78', x + Math.sin(a) * 1.3, y + 0.07, z + 0.45 + Math.cos(a) * 1.3, 0.12, 0.02, 0.34, [0, a, 0], options);
      }
    }
  });

  // Arrival garden: an open gateway ahead, with room to learn to wander.
  arch(0, 17.3, 4.7, 4.7, '#d9c7a9', undefined);
  lantern(-3.4, 16.5, 1.05);
  lantern(3.4, 16.5, 1.05);
  for (const side of [-1, 1]) {
    tree(side * 7.8, 17, 1.18, side > 0 ? '#c2c998' : '#a6bb90', true);
    rock(side * 4.4, 18.1, 0.74, '#c9bfa0');
  }

  // Distant coastlines, hazy mountains, and soft banks of cloud extend the world.
  const distantColors = ['#c0c5c1', '#c7c7bf', '#bac5bd', '#cec7c6'];
  for (let index = 0; index < 19; index++) {
    const a = index / 19 * TAU + 0.13;
    const distance = 98 + random() * 39;
    const x = Math.sin(a) * distance;
    const z = Math.cos(a) * distance;
    const height = 10 + random() * 17;
    place('cone', distantColors[index % 4], x, height * 0.33 - 3.5, z, 15 + random() * 9, height, 9 + random() * 13, [0, a, 0]);
    place('leaf', '#b9c4b4', x, -0.62, z + 3, 18 + random() * 5, 2.3, 13 + random() * 6, [0, a, 0]);
  }
  for (let index = 0; index < 9; index++) {
    const angle = index / 9 * TAU;
    const x = Math.cos(angle) * (70 + random() * 50);
    const z = Math.sin(angle) * (70 + random() * 50);
    const y = 26 + random() * 12;
    for (let puff = 0; puff < 4; puff++) {
      place('ball', '#f2ecdd', x + puff * 3.5, y + Math.sin(puff) * 1.2, z, 5, 1.65 + random(), 2.9, [0, angle, 0]);
    }
  }

  const fireflies = [];
  for (let index = 0; index < 26; index++) {
    const station = WORLD_STATIONS[index % WORLD_STATIONS.length];
    const a = random() * TAU;
    const radius = 1.5 + random() * 3;
    fireflies.push({ x: station.x + Math.cos(a) * radius, y: terrainHeight(station.x, station.z) + 1 + random() * 1.8, z: station.z + Math.sin(a) * radius, phase: random() * TAU });
  }
  const fireflyMesh = new THREE.InstancedMesh(shapes.ball, makeMaterial({ color: '#ffebac', emissive: '#f6d795', emissiveIntensity: 0.8, roughness: 0.4 }), fireflies.length);
  fireflyMesh.name = 'Quiet fireflies';
  fireflyMesh.frustumCulled = false;
  world.add(fireflyMesh);

  for (const [key, batch] of batches) {
    const instances = new THREE.InstancedMesh(batch.geometry, batch.material, batch.items.length);
    instances.name = `Illustrated world · ${key}`;
    instances.castShadow = !key.startsWith('stem') && !key.startsWith('petal');
    instances.receiveShadow = true;
    if (batch.station) instances.userData.station = batch.station;
    batch.items.forEach((item, index) => {
      matrix.position.set(item.x, item.y, item.z);
      matrix.rotation.set(...item.rotation);
      matrix.scale.set(item.sx, item.sy, item.sz);
      matrix.updateMatrix();
      instances.setMatrixAt(index, matrix.matrix);
      instances.setColorAt(index, scratchColor.set(item.color));
    });
    instances.computeBoundingSphere();
    world.add(instances);
  }

  let disposed = false;
  function update(time = 0, dt = 1 / 60) {
    if (disposed) return;
    for (const bloom of blooms.values()) {
      if (bloom.visible && bloom.scale.x < 1) bloom.scale.setScalar(Math.min(1, bloom.scale.x + Math.max(0, dt) * 1.7));
    }
    for (const item of animate) {
      if (item.kind === 'shore') {
        const breath = 1 + Math.sin(time * 0.2 + item.phase) * 0.011;
        item.object.scale.set(breath, breath * 0.974, 1);
      } else if (item.kind === 'ripple') {
        const amount = 1 + Math.sin(time * 0.63 + item.phase) * 0.09;
        item.object.scale.set(amount * item.base, amount, 1);
      } else if (item.kind === 'orbit') {
        item.object.rotation.y = Math.sin(time * 0.22) * 0.32;
      } else if (item.kind === 'compass') {
        item.object.rotation.z = time * (item.index === 1 ? -0.065 : 0.045) + item.phase;
        if (item.index === 2) item.object.rotation.y = 1.03 + Math.sin(time * 0.16) * 0.23;
      } else if (item.kind === 'breathe') {
        item.object.scale.setScalar(1 + Math.sin(time * 0.7) * 0.11);
      }
    }
    fireflies.forEach((fly, index) => {
      matrix.position.set(fly.x + Math.sin(time * 0.3 + fly.phase) * 0.45, fly.y + Math.sin(time * 0.5 + fly.phase) * 0.22, fly.z + Math.cos(time * 0.24 + fly.phase) * 0.3);
      matrix.rotation.set(0, 0, 0);
      matrix.scale.setScalar(0.045 + (Math.sin(time * 1.3 + fly.phase) * 0.5 + 0.5) * 0.027);
      matrix.updateMatrix();
      fireflyMesh.setMatrixAt(index, matrix.matrix);
    });
    fireflyMesh.instanceMatrix.needsUpdate = true;
  }
  update(0);

  return {
    colliders,
    update,
    markCompleted(id, { immediate = false } = {}) {
      if (disposed) return;
      const bloom = blooms.get(id);
      if (!bloom) return;
      if (immediate) {
        bloom.visible = true;
        bloom.scale.setScalar(1);
        return;
      }
      if (bloom.visible) return;
      bloom.visible = true;
      bloom.scale.setScalar(0.25);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(world);
      geometries.forEach(value => value.dispose());
      materials.forEach(value => value.dispose());
      world.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
      world.clear();
      batches.clear();
      animate.length = 0;
    },
  };
}
