// Shared movement math. World coordinates use x (east) and z (south).
export const PLAYER_RADIUS = 0.42;

export function keyboardVector(keys) {
  const has = (key) => keys instanceof Set ? keys.has(key) : Boolean(keys?.[key]);
  let x = Number(has('KeyD') || has('ArrowRight')) - Number(has('KeyA') || has('ArrowLeft'));
  let y = Number(has('KeyW') || has('ArrowUp')) - Number(has('KeyS') || has('ArrowDown'));
  const length = Math.hypot(x, y);
  if (length > 1) { x /= length; y /= length; }
  return { x, y };
}

export function clampToWorld(point, radius = 35) {
  const length = Math.hypot(point.x, point.z);
  return length > radius ? { x: point.x * radius / length, z: point.z * radius / length } : { x: point.x, z: point.z };
}

export function isWalkable(point, colliders = [], { radius = 35, playerRadius = PLAYER_RADIUS, padding = 0 } = {}) {
  return Math.hypot(point.x, point.z) <= radius + 0.00001 && colliders.every((obstacle) => Math.hypot(point.x - obstacle.x, point.z - obstacle.z) >= obstacle.r + playerRadius + padding - 0.00001);
}

export function segmentClear(from, to, colliders = [], options = {}) {
  if (!isWalkable(from, colliders, options) || !isWalkable(to, colliders, options)) return false;
  const dx = to.x - from.x, dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const playerRadius = options.playerRadius ?? PLAYER_RADIUS;
  const padding = options.padding ?? 0;
  return colliders.every((obstacle) => {
    const fraction = lengthSquared ? Math.max(0, Math.min(1, ((obstacle.x - from.x) * dx + (obstacle.z - from.z) * dz) / lengthSquared)) : 0;
    const distance = Math.hypot(from.x + dx * fraction - obstacle.x, from.z + dz * fraction - obstacle.z);
    return distance >= obstacle.r + playerRadius + padding - 0.00001;
  });
}

export function stepMove(position, delta, colliders = [], { radius = 35, playerRadius = PLAYER_RADIUS } = {}) {
  if (![position.x, position.z, delta.x, delta.z].every(Number.isFinite)) return { x: position.x, z: position.z };
  // Small substeps prevent a fast frame (or sprint) from crossing a thin obstacle.
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / 0.16));
  const dx = delta.x / steps, dz = delta.z / steps;
  let current = clampToWorld(position, radius);
  for (let index = 0; index < steps; index++) {
    let next = clampToWorld({ x: current.x + dx, z: current.z + dz }, radius);
    for (let pass = 0; pass < 5; pass++) {
      let adjusted = false;
      for (const obstacle of colliders) {
        let ox = next.x - obstacle.x, oz = next.z - obstacle.z;
        let distance = Math.hypot(ox, oz);
        const clearance = obstacle.r + playerRadius + 0.0001;
        if (distance < clearance) {
          if (distance < 0.00001) {
            ox = current.x - obstacle.x; oz = current.z - obstacle.z;
            distance = Math.hypot(ox, oz);
            if (distance < 0.00001) { ox = 1; oz = 0; distance = 1; }
          }
          next = { x: obstacle.x + ox * clearance / distance, z: obstacle.z + oz * clearance / distance };
          adjusted = true;
        }
      }
      next = clampToWorld(next, radius);
      if (!adjusted) break;
    }
    // In an impossible narrow gap retain the last safe position instead of squeezing through.
    if (isWalkable(next, colliders, { radius, playerRadius })) current = next;
  }
  return current;
}

export function nearestWalkable(point, colliders = [], options = {}) {
  const limited = clampToWorld(point, options.radius ?? 35);
  const reachable = (candidate) => !options.reachableFrom || segmentClear(options.reachableFrom, candidate, colliders, { ...options, padding: 0 });
  if (isWalkable(limited, colliders, options) && reachable(limited)) return limited;
  for (let ring = 0.4; ring <= 6; ring += 0.4) {
    const candidates = [];
    for (let angle = 0; angle < 32; angle++) {
      const radians = angle * Math.PI / 16;
      const candidate = { x: limited.x + Math.cos(radians) * ring, z: limited.z + Math.sin(radians) * ring };
      if (isWalkable(candidate, colliders, options) && reachable(candidate)) candidates.push(candidate);
    }
    if (candidates.length) return candidates[0];
  }
  return null;
}

class MinHeap {
  data = [];
  push(item) {
    this.data.push(item);
    let index = this.data.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.data[parent].f <= item.f) break;
      this.data[index] = this.data[parent]; index = parent;
    }
    this.data[index] = item;
  }
  pop() {
    const first = this.data[0], end = this.data.pop();
    if (this.data.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1, right = left + 1;
        if (left >= this.data.length) break;
        let child = right < this.data.length && this.data[right].f < this.data[left].f ? right : left;
        if (this.data[child].f >= end.f) break;
        this.data[index] = this.data[child]; index = child;
      }
      this.data[index] = end;
    }
    return first;
  }
}

export function planPath(from, requestedGoal, colliders = [], options = {}) {
  const settings = { radius: 35, playerRadius: PLAYER_RADIUS, padding: 0.08, gridStep: 0.9, ...options };
  if (!isWalkable(from, colliders, { ...settings, padding: 0 })) return [];
  const goal = nearestWalkable(requestedGoal, colliders, settings);
  if (!goal) return [];
  // Allow a player already resting against a trunk to step away from it.
  const startSafe = nearestWalkable(from, colliders, { ...settings, reachableFrom: from });
  if (!startSafe) return [];
  if (segmentClear(startSafe, goal, colliders, settings)) return [startSafe, goal].filter((point) => Math.hypot(point.x - from.x, point.z - from.z) > 0.04);
  const step = settings.gridStep;
  const key = (x, z) => `${x},${z}`;
  const point = (node) => ({ x: node.x * step, z: node.z * step });
  function anchor(position) {
    const cx = Math.round(position.x / step), cz = Math.round(position.z / step);
    const candidates = [];
    for (let x = cx - 4; x <= cx + 4; x++) for (let z = cz - 4; z <= cz + 4; z++) {
      const node = { x, z };
      if (segmentClear(position, point(node), colliders, settings)) candidates.push(node);
    }
    candidates.sort((a, b) => Math.hypot(a.x * step - position.x, a.z * step - position.z) - Math.hypot(b.x * step - position.x, b.z * step - position.z));
    return candidates[0];
  }
  const first = anchor(startSafe), last = anchor(goal);
  if (!first || !last) return [];
  const heap = new MinHeap(), nodes = new Map(), closed = new Set();
  first.g = 0; first.f = Math.hypot(last.x - first.x, last.z - first.z);
  nodes.set(key(first.x, first.z), first); heap.push(first);
  let endpoint;
  while (heap.data.length && closed.size < 8500) {
    const current = heap.pop(), id = key(current.x, current.z);
    if (closed.has(id)) continue;
    if (current.x === last.x && current.z === last.z) { endpoint = current; break; }
    closed.add(id);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
      if (!x && !z) continue;
      const next = { x: current.x + x, z: current.z + z }, nextId = key(next.x, next.z);
      if (closed.has(nextId) || !segmentClear(point(current), point(next), colliders, settings)) continue;
      const g = current.g + Math.hypot(x, z), previous = nodes.get(nextId);
      if (previous && previous.g <= g) continue;
      Object.assign(next, { g, f: g + Math.hypot(last.x - next.x, last.z - next.z), parent: current });
      nodes.set(nextId, next); heap.push(next);
    }
  }
  if (!endpoint) return [];
  const reversed = [];
  for (let node = endpoint; node; node = node.parent) reversed.push(point(node));
  const raw = [startSafe, ...reversed.reverse(), goal];
  const path = []; let index = 0;
  while (index < raw.length - 1) {
    let furthest = index + 1;
    for (let candidate = raw.length - 1; candidate > index + 1; candidate--) {
      if (segmentClear(raw[index], raw[candidate], colliders, settings)) { furthest = candidate; break; }
    }
    path.push(raw[furthest]); index = furthest;
  }
  if (Math.hypot(startSafe.x - from.x, startSafe.z - from.z) > 0.04) path.unshift(startSafe);
  return path;
}
