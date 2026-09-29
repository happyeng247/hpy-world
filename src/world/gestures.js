// Tracks only pointers that began on the canvas. A joystick can own other
// pointers independently, without turning a one-finger look into a pinch.
export function createCanvasGestures({ dragThreshold = 8, tapDuration = 500 } = {}) {
  const pointers = new Map();
  let pinchDistance = null;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pairDistance = () => {
    const pair = [...pointers.values()].slice(0, 2);
    return pair.length === 2 ? distance(pair[0], pair[1]) : null;
  };

  function rebaseRemaining() {
    pinchDistance = pairDistance();
    for (const pointer of pointers.values()) {
      pointer.tapAllowed = false;
      pointer.startX = pointer.x;
      pointer.startY = pointer.y;
      // Continue looking with a finger left down after a pinch or cancellation.
      // Its current position becomes the baseline, avoiding a camera jump.
      pointer.dragging = pointers.size === 1;
    }
  }

  return {
    get size() { return pointers.size; },
    has(id) { return pointers.has(id); },
    ids() { return [...pointers.keys()]; },
    suppressTaps() {
      // Another control took ownership while these fingers were down. Keep
      // camera gestures alive, but never turn their later release into a walk.
      for (const pointer of pointers.values()) pointer.tapAllowed = false;
    },
    start(id, x, y, time, { tapAllowed = true } = {}) {
      if (![x, y, time].every(Number.isFinite) || pointers.has(id)) return false;
      pointers.set(id, { x, y, startX: x, startY: y, time, tapAllowed, dragging: false });
      if (pointers.size > 1) rebaseRemaining();
      return true;
    },
    move(id, x, y) {
      const pointer = pointers.get(id);
      if (!pointer || ![x, y].every(Number.isFinite)) return null;
      const dx = x - pointer.x, dy = y - pointer.y;
      pointer.x = x; pointer.y = y;
      if (pointers.size >= 2) {
        const nextDistance = pairDistance();
        // Very close / crossing fingers cannot produce a useful zoom ratio.
        const scale = pinchDistance >= 12 && nextDistance >= 12 ? pinchDistance / nextDistance : 1;
        pinchDistance = nextDistance;
        return { type: 'pinch', scale };
      }
      if (Math.hypot(x - pointer.startX, y - pointer.startY) > dragThreshold) {
        pointer.dragging = true;
        pointer.tapAllowed = false;
      }
      return pointer.dragging ? { type: 'drag', dx, dy } : null;
    },
    end(id, x, y, time, { cancelled = false } = {}) {
      const pointer = pointers.get(id);
      if (!pointer) return null;
      const tap = !cancelled && pointers.size === 1 && pointer.tapAllowed && !pointer.dragging
        && [x, y, time].every(Number.isFinite)
        && time >= pointer.time && time - pointer.time <= tapDuration
        && Math.hypot(x - pointer.startX, y - pointer.startY) <= dragThreshold;
      pointers.delete(id);
      if (pointers.size) rebaseRemaining();
      else pinchDistance = null;
      return tap ? { x, y } : null;
    },
    cancel(id) { return this.end(id, 0, 0, 0, { cancelled: true }); },
    clear() {
      const ids = [...pointers.keys()];
      pointers.clear();
      pinchDistance = null;
      return ids;
    },
  };
}
