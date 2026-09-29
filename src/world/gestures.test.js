import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasGestures } from './gestures.js';

test('a short tap tolerates small touch jitter', () => {
  const gesture = createCanvasGestures();
  gesture.start(1, 100, 200, 0);
  assert.equal(gesture.move(1, 104, 201), null);
  assert.deepEqual(gesture.end(1, 104, 201, 140), { x: 104, y: 201 });
  assert.equal(gesture.size, 0);
});

test('a drag never becomes a tap even after returning to its starting point', () => {
  const gesture = createCanvasGestures();
  gesture.start(1, 100, 200, 0);
  assert.deepEqual(gesture.move(1, 120, 202), { type: 'drag', dx: 20, dy: 2 });
  gesture.move(1, 100, 200);
  assert.equal(gesture.end(1, 100, 200, 250), null);
});

test('pinch ratios compose correctly as separate fingers move', () => {
  const gesture = createCanvasGestures();
  gesture.start(1, 100, 200, 0);
  gesture.start(2, 200, 200, 50);
  const first = gesture.move(1, 50, 200);
  const second = gesture.move(2, 250, 200);
  assert.equal(first.type, 'pinch');
  assert.ok(Math.abs(first.scale * second.scale - 0.5) < 1e-10);
  assert.equal(gesture.end(1, 50, 200, 200), null);
  assert.equal(gesture.end(2, 250, 200, 250), null);
});

test('one finger can keep looking after a pinch without a jump or accidental tap', () => {
  const gesture = createCanvasGestures();
  gesture.start(1, 100, 200, 0);
  gesture.start(2, 200, 200, 50);
  gesture.move(2, 250, 200);
  gesture.end(1, 100, 200, 250);
  assert.deepEqual(gesture.move(2, 253, 204), { type: 'drag', dx: 3, dy: 4 });
  assert.equal(gesture.end(2, 253, 204, 300), null);
});

test('cancellation during a pinch keeps the surviving pointer usable and suppresses taps', () => {
  const gesture = createCanvasGestures();
  gesture.start(1, 100, 200, 0);
  gesture.start(2, 200, 200, 30);
  gesture.cancel(2);
  assert.deepEqual(gesture.move(1, 102, 200), { type: 'drag', dx: 2, dy: 0 });
  assert.equal(gesture.end(1, 102, 200, 90), null);
  gesture.start(3, 50, 50, 100);
  assert.deepEqual(gesture.end(3, 50, 50, 160), { x: 50, y: 50 });
});

test('replacing a pinch finger rebases the distance instead of jumping', () => {
  const gesture = createCanvasGestures();
  gesture.start(1, 0, 100, 0);
  gesture.start(2, 100, 100, 10);
  gesture.start(3, 400, 100, 20);
  gesture.end(1, 0, 100, 30);
  assert.equal(gesture.move(3, 400, 100).scale, 1);
  assert.equal(gesture.move(3, 700, 100).scale, 0.5);
  assert.equal(gesture.end(2, 100, 100, 60), null);
  assert.equal(gesture.end(3, 700, 100, 70), null);
});

test('crossing very close fingers cannot create an infinite or enormous zoom ratio', () => {
  const gesture = createCanvasGestures();
  gesture.start(1, 100, 200, 0);
  gesture.start(2, 110, 200, 10);
  assert.equal(gesture.move(2, 100, 200).scale, 1);
  assert.equal(gesture.move(2, 200, 200).scale, 1);
  assert.equal(gesture.move(2, 210, 200).scale, 100 / 110);
});

test('long presses and large pointer-up displacement cannot accidentally walk', () => {
  const gesture = createCanvasGestures();
  gesture.start(1, 100, 200, 0);
  assert.equal(gesture.end(1, 100, 200, 1000), null);
  gesture.start(2, 100, 200, 1100);
  assert.equal(gesture.end(2, 125, 200, 1200), null);
});

test('an active joystick can suppress walking taps while preserving one-finger camera drag', () => {
  const gesture = createCanvasGestures();
  gesture.start(1, 100, 200, 0, { tapAllowed: false });
  assert.equal(gesture.end(1, 100, 200, 100), null);
  gesture.start(2, 100, 200, 200, { tapAllowed: false });
  assert.deepEqual(gesture.move(2, 130, 200), { type: 'drag', dx: 30, dy: 0 });
  assert.equal(gesture.move(90, 80, 200), null);
  assert.equal(gesture.end(90, 80, 200, 240), null);
  assert.equal(gesture.size, 1);
});

test('a joystick engaged and released during a pending canvas tap cannot start a route', () => {
  const gesture = createCanvasGestures();
  // The canvas finger arrives first, then a thumb engages even at neutral.
  gesture.start(1, 100, 200, 0);
  gesture.suppressTaps();
  // Releasing the joystick does not make the old canvas contact a fresh tap.
  assert.equal(gesture.end(1, 100, 200, 200), null);
  // A new deliberate canvas tap after both contacts finish works normally.
  gesture.start(2, 100, 200, 250);
  assert.deepEqual(gesture.end(2, 100, 200, 300), { x: 100, y: 200 });
});

test('a canvas finger held while a neutral joystick moves and releases never becomes a tap', () => {
  const gesture = createCanvasGestures();
  // Joystick engagement, not its current displacement, supplies tapAllowed.
  gesture.start(1, 100, 200, 0, { tapAllowed: false });
  gesture.suppressTaps();
  assert.equal(gesture.end(1, 100, 200, 200), null);
  gesture.start(2, 100, 200, 250);
  gesture.suppressTaps();
  assert.deepEqual(gesture.move(2, 115, 200), { type: 'drag', dx: 15, dy: 0 });
  assert.equal(gesture.end(2, 115, 200, 300), null);
});

test('clearing a paused gesture invalidates late pointer-up and lost-capture events', () => {
  const gesture = createCanvasGestures();
  gesture.start(1, 100, 200, 0);
  gesture.start(2, 200, 200, 30);
  assert.deepEqual(gesture.clear(), [1, 2]);
  assert.equal(gesture.end(1, 100, 200, 100), null);
  assert.equal(gesture.cancel(2), null);
  assert.equal(gesture.size, 0);
  gesture.start(3, 10, 20, 150);
  assert.deepEqual(gesture.end(3, 10, 20, 200), { x: 10, y: 20 });
});
