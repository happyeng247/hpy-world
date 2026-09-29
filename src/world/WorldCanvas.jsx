import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { createEnvironment, terrainHeight, WORLD_RADIUS, WORLD_STATIONS } from './environment.js';
import { keyboardVector, stepMove, planPath, isWalkable, nearestWalkable } from './movement.js';
import { createCanvasGestures } from './gestures.js';

const SPAWN = { x: 0, z: 14 };
const INTERACTION_RADIUS = 3.3;
let savedPose = null;

function makeAvatar(color) {
  const group = new THREE.Group();
  group.name = 'You, exploring';
  const materials = {
    coat: new THREE.MeshStandardMaterial({ color, roughness: 0.84 }),
    skin: new THREE.MeshStandardMaterial({ color: '#e6b48f', roughness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: '#4b3556', roughness: 0.85 }),
    cream: new THREE.MeshStandardMaterial({ color: '#fff1d7', roughness: 0.9 }),
    rose: new THREE.MeshStandardMaterial({ color: '#d7889d', roughness: 0.84 }),
    shoe: new THREE.MeshStandardMaterial({ color: '#f8e8d8', roughness: 0.9 }),
  };
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  function part(geometry, material, position, scale, parent = group) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const body = new THREE.Group(); group.add(body);
  part(new THREE.CapsuleGeometry(0.34, 0.4, 5, 18), materials.coat, [0, 1.0, 0], [1.14, 1, 0.93], body);
  part(sphere, materials.coat, [0, 1.35, 0.14], [0.36, 0.24, 0.33], body);
  part(sphere, materials.skin, [0, 1.69, -0.035], [0.36, 0.39, 0.35], body);
  // The face points toward local -Z, matching the movement heading.
  part(sphere, materials.dark, [-0.12, 1.73, -0.35], [0.033, 0.052, 0.02], body);
  part(sphere, materials.dark, [0.12, 1.73, -0.35], [0.033, 0.052, 0.02], body);
  part(sphere, materials.rose, [-0.21, 1.63, -0.326], [0.055, 0.022, 0.014], body);
  part(sphere, materials.rose, [0.21, 1.63, -0.326], [0.055, 0.022, 0.014], body);
  part(new THREE.SphereGeometry(0.386, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), materials.cream, [0, 1.76, -0.03], [1, 0.82, 1], body);
  part(new THREE.CylinderGeometry(0.43, 0.43, 0.09, 28), materials.cream, [0, 1.78, -0.045], [1, 1, 1], body);
  part(sphere, materials.coat, [0, 2.12, -0.03], [0.09, 0.085, 0.09], body);
  part(new THREE.TorusGeometry(0.29, 0.075, 7, 24), materials.rose, [0, 1.4, -0.02], null, body).rotation.x = Math.PI / 2;
  const scarf = part(new THREE.BoxGeometry(0.14, 0.38, 0.055), materials.rose, [0.14, 1.16, -0.32], null, body);
  scarf.rotation.z = -0.12;
  part(new THREE.CapsuleGeometry(0.22, 0.26, 4, 14), materials.cream, [0, 1.02, 0.3], [1.2, 1, 0.6], body);
  part(sphere, materials.rose, [0, 1.0, 0.455], [0.06, 0.06, 0.025], body);
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * 0.37, 1.25, 0); body.add(arm);
    part(new THREE.CapsuleGeometry(0.105, 0.31, 3, 12), materials.coat, [side * 0.04, -0.23, 0], null, arm);
    part(sphere, materials.skin, [side * 0.04, -0.44, 0], [0.104, 0.12, 0.1], arm);
    arm.rotation.z = side * 0.08; arms.push(arm);
    const leg = new THREE.Group(); leg.position.set(side * 0.17, 0.7, 0); group.add(leg);
    part(new THREE.CapsuleGeometry(0.13, 0.29, 3, 12), materials.dark, [0, -0.22, 0], null, leg);
    part(sphere, materials.shoe, [0, -0.53, -0.07], [0.15, 0.11, 0.23], leg); legs.push(leg);
  }
  group.scale.setScalar(1.08);
  return { group, body, arms, legs, scarf, coat: materials.coat };
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(32, 32, 2, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,247,255,0.9)');
  glow.addColorStop(0.24, 'rgba(222,186,255,0.4)');
  glow.addColorStop(1, 'rgba(206,153,255,0)');
  context.fillStyle = glow; context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function editableTarget(target) {
  return Boolean(target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'));
}

function stationOnObject(object) {
  for (let current = object; current; current = current.parent) {
    const tag = current.userData.station ?? current.userData.stationId;
    if (tag) return typeof tag === 'string' ? tag : tag.id;
  }
  return null;
}

const WorldCanvas = forwardRef(function WorldCanvas({
  paused = false, reducedMotion = false, characterColor = '#b590d0', completed = [],
  onUpdate, onInteract, onDiscover, onError, onReady,
}, forwardedRef) {
  const canvasRef = useRef(null), runtimeRef = useRef(null);
  const latest = useRef({});
  latest.current = { paused, reducedMotion, characterColor, completed, onUpdate, onInteract, onDiscover, onError, onReady };

  useImperativeHandle(forwardedRef, () => ({
    travelTo: (id) => runtimeRef.current?.travelTo(id) ?? false,
    resetView: () => runtimeRef.current?.resetView(),
    zoomBy: (amount) => runtimeRef.current?.zoomBy(amount) ?? false,
    setMood: (mood) => runtimeRef.current?.setMood(mood),
    setMovement: (movement) => runtimeRef.current?.setMovement(movement),
  }), []);

  useEffect(() => { runtimeRef.current?.setPaused(paused); }, [paused]);
  useEffect(() => { runtimeRef.current?.setColor(characterColor); }, [characterColor]);
  useEffect(() => { runtimeRef.current?.setCompleted(completed); }, [completed, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    let renderer, scene, environment, observer, frame = 0, disposed = false, failed = false;
    let removeListeners = () => {}, releaseInputs = () => {};
    const textures = new Set();
    function cleanup() {
      if (disposed) return;
      disposed = true; cancelAnimationFrame(frame); releaseInputs(); removeListeners(); observer?.disconnect(); runtimeRef.current = null;
      environment?.dispose?.();
      if (scene) {
        const geometries = new Set(), materials = new Set();
        scene.traverse((object) => {
          if (object.isInstancedMesh) object.dispose();
          if (object.isLight && object.shadow) object.shadow.dispose();
          if (object.geometry) geometries.add(object.geometry);
          for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) materials.add(material);
        });
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        scene.clear();
      }
      textures.forEach((texture) => texture.dispose()); renderer?.dispose();
    }
    function fail(error) {
      if (failed || disposed) return;
      failed = true;
      cleanup();
      latest.current.onError?.(error);
    }
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      scene = new THREE.Scene();

      const sky = document.createElement('canvas'); sky.width = 2; sky.height = 512;
      const context = sky.getContext('2d'), gradient = context.createLinearGradient(0, 0, 0, 512);
      gradient.addColorStop(0, '#cbbcdf'); gradient.addColorStop(0.45, '#ecddd9'); gradient.addColorStop(1, '#f6e8d6');
      context.fillStyle = gradient; context.fillRect(0, 0, 2, 512);
      const skyTexture = new THREE.CanvasTexture(sky); skyTexture.colorSpace = THREE.SRGBColorSpace;
      textures.add(skyTexture); scene.background = skyTexture;
      scene.fog = new THREE.Fog('#eddfd8', 42, 97);
      scene.add(new THREE.HemisphereLight('#fff0df', '#c0afa2', 2.6));
      const sun = new THREE.DirectionalLight('#ffe7c9', 3.1);
      sun.position.set(-24, 43, 18); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -43, right: 43, top: 43, bottom: -43, near: 1, far: 105 });
      sun.shadow.normalBias = 0.06; sun.shadow.bias = -0.00012; sun.shadow.radius = 3;
      scene.add(sun); scene.add(sun.target);
      const fill = new THREE.DirectionalLight('#d9cdff', 0.65); fill.position.set(12, 13, -24); scene.add(fill);
      environment = createEnvironment(scene);
      const obstacles = environment.colliders || [];
      const movementOptions = { radius: WORLD_RADIUS - 3 };
      const avatar = makeAvatar(latest.current.characterColor); scene.add(avatar.group);
      const initial = savedPose && isWalkable(savedPose, obstacles, movementOptions) ? savedPose : SPAWN;
      let position = nearestWalkable(initial, obstacles, movementOptions) || { ...SPAWN };
      let heading = savedPose?.heading || 0, cameraYaw = savedPose?.cameraYaw ?? 0.22, targetYaw = cameraYaw;
      let cameraDistance = 17.5, targetDistance = 17.5;
      avatar.group.position.set(position.x, terrainHeight(position.x, position.z), position.z);
      avatar.group.rotation.y = heading;
      const camera = new THREE.PerspectiveCamera(49, 1, 0.1, 180);
      const cameraFocus = new THREE.Vector3(position.x, terrainHeight(position.x, position.z), position.z);
      const desiredCamera = new THREE.Vector3(), targetLook = new THREE.Vector3();
      const orb = new THREE.Group(); scene.add(orb);
      const orbCoreMaterial = new THREE.MeshStandardMaterial({ color: '#c9a1e4', emissive: '#8e62bd', emissiveIntensity: 0.28, roughness: 0.2, metalness: 0.15 });
      const orbCore = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 16), orbCoreMaterial); orb.add(orbCore);
      const orbRing = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.018, 8, 32), new THREE.MeshStandardMaterial({ color: '#ffe3bd', emissive: '#dbb3a0', emissiveIntensity: 0.2, roughness: 0.4 }));
      orbRing.rotation.set(1.1, 0.4, 0.3); orb.add(orbRing);
      const glowTexture = makeGlowTexture(); textures.add(glowTexture);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, transparent: true, opacity: 0.5, depthWrite: false })); glow.scale.set(1.5, 1.5, 1); orb.add(glow);
      orb.position.set(position.x + 1.0, avatar.group.position.y + 1.7, position.z + 0.7);
      const destinationMarker = new THREE.Group(); scene.add(destinationMarker); destinationMarker.visible = false;
      const ringMaterial = new THREE.MeshBasicMaterial({ color: '#765b9b', transparent: true, opacity: 0.65, depthWrite: false });
      const markerRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.34, 40), ringMaterial); markerRing.rotation.x = -Math.PI / 2; destinationMarker.add(markerRing);
      const markerDot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), ringMaterial); markerDot.rotation.x = -Math.PI / 2; markerDot.position.y = 0.004; destinationMarker.add(markerDot);
      const routeMaterial = new THREE.MeshBasicMaterial({ color: '#fff4dd', transparent: true, opacity: 0.65, depthWrite: false });
      const trailDots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.065, 10), routeMaterial, 90); trailDots.count = 0; scene.add(trailDots);
      const dotMatrix = new THREE.Object3D(); dotMatrix.rotation.x = -Math.PI / 2;
      const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), projection = new THREE.Vector3(), orbTarget = new THREE.Vector3();
      const keys = new Set(), discovered = new Set();
      const gestures = createCanvasGestures();
      let joystick = { x: 0, y: 0 }, joystickEngaged = false, route = [], destination = null, walking = false, nearest = null;
      let hop = 0, hopVelocity = 0, stride = 0, walkAmount = 0, mood = 'steady';
      let width = 1, height = 1, ready = false;
      let lastTime = performance.now(), elapsed = 0, lastUpdate = -Infinity, lastDraw = -Infinity, stalled = 0;
      const limit = (value, min, max) => Math.max(min, Math.min(max, value));
      const inputBlocked = () => latest.current.paused || document.hidden || editableTarget(document.activeElement);

      function setRoute(points, id = null) {
        route = points; destination = id; stalled = 0;
        destinationMarker.visible = points.length > 0;
        if (points.length) {
          const end = points.at(-1);
          destinationMarker.position.set(end.x, terrainHeight(end.x, end.z) + 0.085, end.z);
        }
        let count = 0, previous = position;
        for (const point of points) {
          const dx = point.x - previous.x, dz = point.z - previous.z, distance = Math.hypot(dx, dz);
          for (let offset = 0.75; offset < distance && count < 90; offset += 0.9) {
            const x = previous.x + dx * offset / distance, z = previous.z + dz * offset / distance;
            dotMatrix.position.set(x, terrainHeight(x, z) + 0.07, z); dotMatrix.updateMatrix(); trailDots.setMatrixAt(count++, dotMatrix.matrix);
          }
          previous = point;
        }
        trailDots.count = count; trailDots.instanceMatrix.needsUpdate = true;
      }
      function clearMovement() {
        keys.clear(); joystick = { x: 0, y: 0 }; joystickEngaged = false; setRoute([]); walking = false;
        hop = 0; hopVelocity = 0;
        for (const id of gestures.clear()) releaseCapture(id);
        canvas.style.cursor = 'grab';
      }
      releaseInputs = clearMovement;
      function travelTo(id) {
        if (inputBlocked()) return false;
        const station = WORLD_STATIONS.find((item) => item.id === id);
        if (!station) return false;
        const angle = Math.atan2(position.z - station.z, position.x - station.x);
        let best = null;
        for (let i = 0; i < 12; i++) {
          const offset = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 6;
          const goal = { x: station.x + Math.cos(angle + offset) * 2.2, z: station.z + Math.sin(angle + offset) * 2.2 };
          if (!isWalkable(goal, obstacles, { ...movementOptions, padding: 0.12 })) continue;
          const path = planPath(position, goal, obstacles, movementOptions);
          if (path.length) { best = path; break; }
        }
        if (!best) return false;
        keys.clear(); joystick = { x: 0, y: 0 }; setRoute(best, station.id); lastUpdate = -Infinity;
        return true;
      }
      function interact() {
        if (inputBlocked()) return;
        const close = WORLD_STATIONS.filter((station) => Math.hypot(station.x - position.x, station.z - position.z) <= INTERACTION_RADIUS)
          .sort((a, b) => Math.hypot(a.x - position.x, a.z - position.z) - Math.hypot(b.x - position.x, b.z - position.z))[0];
        if (close) { clearMovement(); latest.current.onInteract?.(close.id); }
      }
      function groundClick(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(scene.children, true);
        const groundHit = hits.find((hit) => {
          for (let current = hit.object; current; current = current.parent) if (current.userData.walkable || current.userData.ground) return true;
          return false;
        });
        const stationHit = hits.find((hit) => stationOnObject(hit.object) && (!groundHit || hit.distance <= groundHit.distance + 0.1));
        if (stationHit) { travelTo(stationOnObject(stationHit.object)); return; }
        if (!groundHit || Math.hypot(groundHit.point.x, groundHit.point.z) > WORLD_RADIUS - 2) return;
        const path = planPath(position, { x: groundHit.point.x, z: groundHit.point.z }, obstacles, movementOptions);
        if (path.length) { keys.clear(); joystick = { x: 0, y: 0 }; setRoute(path); }
      }
      function keyDown(event) {
        if (inputBlocked() || editableTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
          event.preventDefault(); keys.add(event.code);
          if (!event.code.startsWith('Shift')) setRoute([]);
        } else if ((event.code === 'KeyE' || event.code === 'Enter') && !event.repeat && !(event.code === 'Enter' && event.target?.closest?.('button, a'))) {
          event.preventDefault(); interact();
        } else if (event.code === 'Space' && !event.target?.closest?.('button, a')) {
          event.preventDefault();
          if (!event.repeat && !latest.current.reducedMotion && hop === 0) hopVelocity = 4.4;
        }
      }
      function keyUp(event) { keys.delete(event.code); }
      function releaseCapture(id) {
        // A browser interruption can release capture before its cancel event.
        try { if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); } catch { /* Already released. */ }
      }
      function pointerDown(event) {
        if (inputBlocked() || (event.pointerType === 'mouse' && event.button !== 0)) return;
        if (!gestures.start(event.pointerId, event.clientX, event.clientY, performance.now(), { tapAllowed: !joystickEngaged })) return;
        if (event.cancelable) event.preventDefault();
        canvas.focus({ preventScroll: true });
        try { canvas.setPointerCapture(event.pointerId); }
        catch { gestures.cancel(event.pointerId); }
      }
      function pointerMove(event) {
        if (!gestures.has(event.pointerId)) return;
        if (inputBlocked()) { clearMovement(); return; }
        if (event.cancelable) event.preventDefault();
        const change = gestures.move(event.pointerId, event.clientX, event.clientY);
        if (change?.type === 'pinch') {
          targetDistance = limit(targetDistance * change.scale, 11, 24);
        } else if (change?.type === 'drag') {
          targetYaw -= change.dx * 0.005;
          canvas.style.cursor = 'grabbing';
        }
      }
      function pointerUp(event) {
        const tap = gestures.end(event.pointerId, event.clientX, event.clientY, performance.now());
        releaseCapture(event.pointerId);
        canvas.style.cursor = gestures.size ? 'grabbing' : 'grab';
        // A second finger can look while the first holds the joystick. Releasing
        // that finger must not start a route and cancel the ongoing manual walk.
        if (tap && !inputBlocked() && !joystickEngaged) groundClick(tap.x, tap.y);
      }
      function pointerCancel(event) {
        gestures.cancel(event.pointerId);
        releaseCapture(event.pointerId);
        canvas.style.cursor = gestures.size ? 'grabbing' : 'grab';
      }
      function wheel(event) {
        if (inputBlocked()) return;
        event.preventDefault(); targetDistance = limit(targetDistance + event.deltaY * 0.012, 11, 24);
      }
      function visibility() { if (document.hidden) clearMovement(); lastTime = performance.now(); }
      function lostContext(event) {
        event.preventDefault();
        if (!disposed && !failed) { clearMovement(); fail(new Error('The 3D view lost its graphics connection.')); }
      }
      function resize() {
        const rect = canvas.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height);
        renderer.setSize(width, height, false); camera.aspect = width / height;
        camera.fov = width < 700 ? 58 : 49; camera.updateProjectionMatrix(); lastUpdate = -Infinity;
      }
      function updateCamera(dt, snap = false) {
        const smoothing = snap || latest.current.reducedMotion ? 1 : 1 - Math.exp(-dt * 7.5);
        cameraYaw += (targetYaw - cameraYaw) * smoothing; cameraDistance += (targetDistance - cameraDistance) * smoothing;
        const targetY = terrainHeight(position.x, position.z);
        targetLook.set(position.x, targetY, position.z); cameraFocus.lerp(targetLook, smoothing);
        const sine = Math.sin(cameraYaw), cosine = Math.cos(cameraYaw), heightOffset = cameraDistance * 0.66;
        desiredCamera.set(cameraFocus.x + sine * cameraDistance, cameraFocus.y + heightOffset, cameraFocus.z + cosine * cameraDistance);
        camera.position.copy(desiredCamera);
        targetLook.set(cameraFocus.x - sine * 2.7, cameraFocus.y + 1.2, cameraFocus.z - cosine * 2.7);
        camera.lookAt(targetLook); camera.updateMatrixWorld();
      }
      function emitUpdate(time) {
        if (time - lastUpdate < 125) return;
        lastUpdate = time;
        const projected = WORLD_STATIONS.map((station) => {
          const distance = Math.hypot(station.x - position.x, station.z - position.z);
          projection.set(station.x, terrainHeight(station.x, station.z) + 3.7, station.z).project(camera);
          return { id: station.id, x: (projection.x * 0.5 + 0.5) * width, y: (-projection.y * 0.5 + 0.5) * height, distance, visible: projection.z > -1 && projection.z < 1 && Math.abs(projection.x) < 1.03 && Math.abs(projection.y) < 1.03 && distance < 42 };
        });
        latest.current.onUpdate?.({ position: { ...position }, nearest, walking, destination, heading: cameraYaw, projected });
      }
      function render(time) {
        if (disposed || failed) return;
        frame = requestAnimationFrame(render);
        if (document.hidden) { lastTime = time; return; }
        const blocked = inputBlocked();
        if ((blocked || latest.current.reducedMotion) && time - lastDraw < 1000 / (blocked ? 12 : 30)) return;
        const dt = Math.min(Math.max((time - lastTime) / 1000, 0), 0.045); lastTime = time;
        lastDraw = time;
        if (!blocked) elapsed += dt;
        let move = { x: 0, z: 0 }, speed = 0;
        if (!blocked) {
          const keyboard = keyboardVector(keys), ix = keyboard.x + joystick.x, iy = keyboard.y + joystick.y, inputLength = Math.hypot(ix, iy);
          if (inputLength > 0.04) {
            const magnitude = Math.min(1, inputLength), x = ix / inputLength, y = iy / inputLength;
            speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 7.2 : 4.7) * magnitude;
            move = { x: (x * Math.cos(cameraYaw) - y * Math.sin(cameraYaw)) * speed * dt, z: (-x * Math.sin(cameraYaw) - y * Math.cos(cameraYaw)) * speed * dt };
          } else if (route.length) {
            while (route.length && Math.hypot(route[0].x - position.x, route[0].z - position.z) < 0.12) route.shift();
            if (route.length) {
              const dx = route[0].x - position.x, dz = route[0].z - position.z, distance = Math.hypot(dx, dz);
              speed = 4.7; const amount = Math.min(speed * dt, distance);
              move = { x: dx * amount / distance, z: dz * amount / distance };
            } else { setRoute([]); }
          }
        }
        const next = stepMove(position, move, obstacles, movementOptions), moved = Math.hypot(next.x - position.x, next.z - position.z);
        walking = !blocked && moved > 0.0005;
        if (walking) {
          const desiredHeading = Math.atan2(-(next.x - position.x), -(next.z - position.z));
          const difference = Math.atan2(Math.sin(desiredHeading - heading), Math.cos(desiredHeading - heading));
          heading += difference * (latest.current.reducedMotion ? 1 : Math.min(1, dt * 13));
          stride += moved * 3.5; stalled = 0;
        } else if (route.length && !blocked) {
          stalled += dt;
          if (stalled > 1) setRoute([]);
        }
        position = next;
        const terrainY = terrainHeight(position.x, position.z);
        if (!blocked && !latest.current.reducedMotion) { hopVelocity -= 12 * dt; hop = Math.max(0, hop + hopVelocity * dt); if (hop === 0) hopVelocity = 0; }
        if (latest.current.reducedMotion) { hop = 0; hopVelocity = 0; }
        walkAmount += ((walking ? 1 : 0) - walkAmount) * Math.min(1, dt * 13);
        avatar.group.position.set(position.x, terrainY + hop, position.z); avatar.group.rotation.y = heading;
        const animation = latest.current.reducedMotion ? 0 : walkAmount;
        avatar.body.position.y = Math.abs(Math.sin(stride)) * 0.055 * animation;
        avatar.legs[0].rotation.x = Math.sin(stride) * 0.55 * animation; avatar.legs[1].rotation.x = -Math.sin(stride) * 0.55 * animation;
        avatar.arms[0].rotation.x = -Math.sin(stride) * 0.4 * animation; avatar.arms[1].rotation.x = Math.sin(stride) * 0.4 * animation;
        avatar.scarf.rotation.x = Math.sin(elapsed * 2) * 0.06 * (latest.current.reducedMotion ? 0 : 1) + walkAmount * 0.2;
        orbTarget.set(position.x + Math.cos(heading) * 1.05 + Math.sin(heading) * 0.5, terrainY + 1.65 + (latest.current.reducedMotion ? 0 : Math.sin(elapsed * 2.3) * 0.16), position.z - Math.sin(heading) * 1.05 + Math.cos(heading) * 0.5);
        orb.position.lerp(orbTarget, latest.current.reducedMotion ? 1 : Math.min(1, dt * 3.8));
        if (!latest.current.reducedMotion && !blocked) orbRing.rotation.z += dt * 0.25;
        if (destinationMarker.visible && !latest.current.reducedMotion) destinationMarker.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.09);
        updateCamera(dt);
        nearest = null; let closestDistance = INTERACTION_RADIUS;
        for (const station of WORLD_STATIONS) {
          const distance = Math.hypot(station.x - position.x, station.z - position.z);
          if (distance < closestDistance) { nearest = station; closestDistance = distance; }
          if (!blocked && distance < 4.3 && !discovered.has(station.id)) { discovered.add(station.id); latest.current.onDiscover?.(station.id); }
        }
        if (!blocked) environment.update?.(latest.current.reducedMotion ? 0 : elapsed, latest.current.reducedMotion ? 0 : dt);
        savedPose = { ...position, heading, cameraYaw };
        try { renderer.render(scene, camera); } catch (error) {
          fail(error); return;
        }
        emitUpdate(time);
        if (!ready) { ready = true; latest.current.onReady?.(); }
      }

      runtimeRef.current = {
        travelTo,
        resetView() { targetYaw = 0.22; targetDistance = 17.5; },
        zoomBy(amount) {
          if (inputBlocked() || !Number.isFinite(amount)) return false;
          const next = limit(targetDistance + amount, 11, 24);
          if (next === targetDistance) return false;
          targetDistance = next;
          return true;
        },
        setMood(value) {
          mood = value;
          const tones = { steady: '#c9a1e4', tender: '#eba5b8', restless: '#e6c183', curious: '#91c5b0', hopeful: '#a1bedb', calm: '#91c5b0', sad: '#a1bedb', anxious: '#e6c183' };
          orbCoreMaterial.color.set(tones[mood] || '#c9a1e4');
        },
        setMovement(value = {}) {
          if (inputBlocked()) { clearMovement(); return; }
          const x = Number.isFinite(value.x) ? value.x : 0, y = Number.isFinite(value.y) ? value.y : 0, length = Math.max(1, Math.hypot(x, y));
          const engaged = typeof value.active === 'boolean' ? value.active : Math.hypot(x, y) > 0.04;
          if (engaged && !joystickEngaged) gestures.suppressTaps();
          joystickEngaged = engaged;
          joystick = engaged ? { x: x / length, y: y / length } : { x: 0, y: 0 };
          if (engaged) setRoute([]);
        },
        setPaused(value) { if (value) clearMovement(); lastTime = performance.now(); },
        setColor(value) { avatar.coat.color.set(value); },
        setCompleted(ids) { for (const id of ids || []) environment.markCompleted?.(id, { immediate: latest.current.reducedMotion }); },
      };
      runtimeRef.current.setCompleted(latest.current.completed);
      removeListeners = () => {
        window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', clearMovement);
        document.removeEventListener('visibilitychange', visibility);
        canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerCancel);
        canvas.removeEventListener('lostpointercapture', pointerCancel);
        canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('webglcontextlost', lostContext);
      };
      window.addEventListener('keydown', keyDown);
      window.addEventListener('keyup', keyUp);
      window.addEventListener('blur', clearMovement);
      document.addEventListener('visibilitychange', visibility);
      canvas.addEventListener('pointerdown', pointerDown);
      canvas.addEventListener('pointermove', pointerMove);
      canvas.addEventListener('pointerup', pointerUp);
      canvas.addEventListener('pointercancel', pointerCancel);
      canvas.addEventListener('lostpointercapture', pointerCancel);
      canvas.addEventListener('wheel', wheel, { passive: false });
      canvas.addEventListener('webglcontextlost', lostContext);
      observer = new ResizeObserver(resize); observer.observe(canvas);
      resize(); updateCamera(1, true); frame = requestAnimationFrame(render);
    } catch (error) {
      fail(error);
    }
    return cleanup;
  }, []);

  return <canvas ref={canvasRef} className="world-canvas" role="img" tabIndex={0}
    aria-label="Your explorable HPY island. Tap the ground to walk, drag one finger to look around, and pinch with two fingers to zoom. You can also use the movement control or the island map. On a keyboard, walk with W A S D or arrow keys and press E near a place to enter."
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'grab', outlineOffset: '-5px' }} />;
});

export default WorldCanvas;
