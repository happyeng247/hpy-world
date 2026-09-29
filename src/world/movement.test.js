import test from 'node:test';
import assert from 'node:assert/strict';
import { keyboardVector, stepMove, isWalkable, planPath, segmentClear, clampToWorld } from './movement.js';

test('opposing keyboard directions cancel and diagonal speed is normalized', () => {
  assert.deepEqual(keyboardVector(new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD'])), { x: 0, y: 0 });
  const diagonal = keyboardVector(new Set(['ArrowUp', 'KeyD']));
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);
  assert.deepEqual(keyboardVector(new Set(['KeyW', 'ArrowUp'])), { x: 0, y: 1 });
});

test('movement remains inside the circular island and travels along its edge', () => {
  const moved = stepMove({ x: 34.8, z: 0 }, { x: 10, z: 4 });
  assert.ok(Math.hypot(moved.x, moved.z) <= 35.00001);
  assert.ok(moved.z > 0);
  assert.deepEqual(clampToWorld({ x: 0, z: 70 }), { x: 0, z: 35 });
});

test('a long movement cannot tunnel through a small trunk', () => {
  const obstacle = [{ x: 0, z: 0, r: 0.1 }];
  const moved = stepMove({ x: -8, z: 0 }, { x: 20, z: 0 }, obstacle);
  assert.ok(moved.x < -0.51, `x=${moved.x}`);
  assert.ok(isWalkable(moved, obstacle));
});

test('movement slides around a circular obstacle while keeping player clearance', () => {
  const obstacle = [{ x: 0, z: 0, r: 1 }];
  const moved = stepMove({ x: -2, z: 0.65 }, { x: 3, z: 0 }, obstacle);
  assert.ok(moved.x > 0);
  assert.ok(moved.z > 1);
  assert.ok(isWalkable(moved, obstacle));
});

test('pathfinding detours around blocked direct routes with safe segments', () => {
  const obstacles = [{ x: 0, z: 0, r: 3 }, { x: 0, z: 4, r: 1.2 }];
  const origin = { x: -9, z: 0 }, target = { x: 9, z: 0 };
  assert.equal(segmentClear(origin, target, obstacles), false);
  const path = planPath(origin, target, obstacles);
  assert.ok(path.length > 1);
  assert.deepEqual(path.at(-1), target);
  let previous = origin;
  for (const waypoint of path) {
    assert.ok(segmentClear(previous, waypoint, obstacles), `${JSON.stringify(previous)} to ${JSON.stringify(waypoint)}`);
    previous = waypoint;
  }
});

test('a click inside scenery resolves to reachable ground outside the obstacle', () => {
  const obstacles = [{ x: 0, z: 0, r: 2 }];
  const path = planPath({ x: -8, z: 1 }, { x: 0, z: 0 }, obstacles);
  assert.ok(path.length > 0);
  assert.ok(isWalkable(path.at(-1), obstacles));
});

test('a path starting against a trunk first steps away without cutting through it', () => {
  const obstacles = [{ x: 0, z: 0, r: 0.2974143897781614 }];
  const origin = { x: -0.35875719488908, z: -0.6213856891287773 };
  const path = planPath(origin, { x: 12, z: 8 }, obstacles);
  assert.ok(path.length);
  let previous = origin;
  for (const waypoint of path) {
    assert.ok(segmentClear(previous, waypoint, obstacles));
    previous = waypoint;
  }
});

test('an unreachable destination returns no route', () => {
  const obstacles = Array.from({ length: 48 }, (_, index) => ({ x: Math.cos(index * Math.PI / 24) * 5, z: Math.sin(index * Math.PI / 24) * 5, r: 0.6 }));
  assert.deepEqual(planPath({ x: 0, z: 0 }, { x: 10, z: 0 }, obstacles), []);
});

test('a route can be followed without collision or leaving the island', () => {
  const obstacles = [{ x: -1, z: 1, r: 2 }, { x: 5, z: -3, r: 2.3 }, { x: 9, z: 2, r: 1 }];
  let position = { x: -12, z: 8 };
  const path = planPath(position, { x: 15, z: -9 }, obstacles);
  assert.ok(path.length);
  for (const waypoint of path) {
    for (let frame = 0; frame < 3000 && Math.hypot(waypoint.x - position.x, waypoint.z - position.z) > 0.025; frame++) {
      const dx = waypoint.x - position.x, dz = waypoint.z - position.z;
      const distance = Math.hypot(dx, dz), amount = Math.min(0.1, distance);
      position = stepMove(position, { x: dx * amount / distance, z: dz * amount / distance }, obstacles);
      assert.ok(isWalkable(position, obstacles));
    }
    assert.ok(Math.hypot(waypoint.x - position.x, waypoint.z - position.z) < 0.03);
  }
});
