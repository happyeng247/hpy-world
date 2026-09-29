import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './landscape.css';

export const LANDSCAPE_REGIONS = [
  { id: 'feel', label: 'What I feel', prompt: 'What is here right now—and where do you notice it in your body?', color: '#dc927c', glyph: '01' },
  { id: 'need', label: 'What I need', prompt: 'Under the feeling, what might be asking for care?', color: '#7f9f80', glyph: '02' },
  { id: 'value', label: 'What I value', prompt: 'What quality would you like to bring to this moment?', color: '#c5a45e', glyph: '03' },
  { id: 'choose', label: 'What I can choose', prompt: 'What small response is yours to choose, even if the outcome is not?', color: '#a795bd', glyph: '04' },
  { id: 'release', label: 'What I release', prompt: 'What are you carrying that you may not need to solve today?', color: '#84a7b1', glyph: '05' },
];

const terrainColors = ['#e9a28a', '#a7b59a', '#e2c893', '#bca8c8', '#a6c1c6'];

function addMesh(group, geometry, material, position = [0, 0, 0], scale) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createScene(canvas, compact, onChoose, onHover, onFailure) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xffffff, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4.25, 4.25, 3.2, -3.2, 0.1, 80);
  const world = new THREE.Group();
  scene.add(world);
  scene.add(new THREE.HemisphereLight('#fff6e7', '#c4a99e', 2.8));
  const sun = new THREE.DirectionalLight('#fff8eb', 3.8);
  sun.position.set(-3, 8, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 20 });
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.0002;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#f8e1dd', 1.7);
  fill.position.set(4, 3, -4);
  scene.add(fill);

  const mats = new Map();
  function mat(color, extra = {}) {
    const key = color + JSON.stringify(extra);
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0, ...extra }));
    return mats.get(key);
  }
  const ivory = mat('#fff0d4');
  const pale = mat('#f9d7c3');
  const green = mat('#9fbca0');
  const lime = mat('#c9d39b');
  const trunk = mat('#c3a187');
  const rose = mat('#d78c79');

  const sphere = new THREE.SphereGeometry(1, 40, 24);
  const pebble = new THREE.SphereGeometry(1, 20, 12);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 64);
  const path = new THREE.TorusGeometry(0.57, 0.09, 10, 64, Math.PI * 1.34);
  const islands = [];
  const hitObjects = [];
  const floats = [];
  const markers = [];
  const arrangements = [
    { p: [-0.38, 0.38, 0.65], s: 1.12 },
    { p: [-2.1, 0.08, -0.76], s: 0.79 },
    { p: [-0.16, 0.48, -1.84], s: 0.75 },
    { p: [1.85, 0.23, -0.67], s: 0.81 },
    { p: [1.63, -0.12, 1.2], s: 0.72 },
  ];

  function makeTree(group, x, z, size = 1, color = green) {
    addMesh(group, cylinder, trunk, [x, 0.37 * size, z], [0.05 * size, 0.57 * size, 0.05 * size]);
    addMesh(group, sphere, color, [x, 0.86 * size, z], [0.3 * size, 0.48 * size, 0.3 * size]);
    addMesh(group, sphere, color, [x - 0.16 * size, 0.66 * size, z + 0.04], [0.21 * size, 0.31 * size, 0.21 * size]);
  }

  function makeArch(group) {
    const arch = new THREE.Shape();
    arch.moveTo(-0.51, 0);
    arch.lineTo(-0.51, 0.64);
    arch.absarc(0, 0.64, 0.51, Math.PI, 0, true);
    arch.lineTo(0.51, 0);
    arch.lineTo(0.29, 0);
    arch.lineTo(0.29, 0.64);
    arch.absarc(0, 0.64, 0.29, 0, Math.PI, false);
    arch.lineTo(-0.29, 0);
    arch.closePath();
    const geometry = new THREE.ExtrudeGeometry(arch, { depth: 0.21, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 32 });
    const archMesh = addMesh(group, geometry, ivory, [0.06, 0.15, -0.19]);
    archMesh.rotation.y = -0.12;
    addMesh(group, cylinder, pale, [0.04, 0.14, -0.01], [0.64, 0.1, 0.38]);
    const archStep = addMesh(group, cylinder, ivory, [0.05, 0.13, 0.47], [0.3, 0.05, 0.17]);
    archStep.rotation.y = 0.13;
    const arc = addMesh(group, path, pale, [-0.02, 0.145, 0.06]);
    arc.rotation.x = -Math.PI / 2;
    arc.rotation.z = -0.52;
    makeTree(group, -0.62, -0.19, 0.71, green);
    makeTree(group, 0.57, -0.35, 0.42, lime);
    addMesh(group, pebble, rose, [-0.5, 0.23, 0.56], [0.14, 0.12, 0.1]);
  }

  arrangements.forEach(({ p, s }, index) => {
    const island = new THREE.Group();
    island.position.set(...p);
    island.scale.setScalar(s);
    world.add(island);
    islands.push(island);
    floats.push({ group: island, y: p[1], offset: index * 1.47, amount: 0.045 });
    // The top and underside are separate clay forms, giving each island a soft terrace.
    addMesh(island, sphere, mat(terrainColors[index]), [0, -0.25, 0], [1.04, 0.4, 0.86]);
    addMesh(island, cylinder, mat(index === 0 ? '#efd0ad' : ['#efd0ad', '#dbe0bd', '#f6e4ba', '#dfd2e2', '#d3e0d8'][index]), [0, 0.045, 0], [0.99, 0.13, 0.81]);
    addMesh(island, sphere, mat(terrainColors[index]), [0.06, -0.46, -0.02], [0.59, 0.21, 0.52]);
    if (index === 0) makeArch(island);
    if (index === 1) {
      makeTree(island, 0.1, -0.07, 0.92, green);
      makeTree(island, -0.43, 0.19, 0.64, lime);
      makeTree(island, 0.48, 0.3, 0.47, green);
      addMesh(island, pebble, ivory, [-0.09, 0.14, 0.44], [0.24, 0.08, 0.16]);
    }
    if (index === 2) {
      const disc = addMesh(island, cylinder, ivory, [0, 0.2, 0], [0.45, 0.21, 0.45]);
      disc.rotation.y = 0.4;
      const ring = addMesh(island, new THREE.TorusGeometry(0.4, 0.12, 16, 64), mat('#e9ba73'), [0.0, 0.83, -0.03]);
      ring.rotation.y = -0.32;
      const core = addMesh(island, sphere, pale, [0.0, 0.83, -0.03], [0.16, 0.16, 0.16]);
      core.userData.kind = 'sun';
      makeTree(island, -0.51, 0.17, 0.48, lime);
      addMesh(island, pebble, mat('#e6b379'), [0.42, 0.18, 0.35], [0.12, 0.1, 0.13]);
    }
    if (index === 3) {
      for (let step = 0; step < 4; step++) {
        addMesh(island, new THREE.BoxGeometry(0.53, 0.18 + step * 0.18, 0.28), mat(step % 2 ? '#f5deca' : '#fff0dd'), [0.03, 0.17 + step * 0.09, 0.42 - step * 0.24]);
      }
      addMesh(island, sphere, mat('#d49b95'), [0.03, 1.09, -0.34], [0.21, 0.21, 0.21]);
      makeTree(island, -0.55, -0.14, 0.61, green);
      addMesh(island, sphere, lime, [0.53, 0.26, 0.21], [0.2, 0.16, 0.22]);
    }
    if (index === 4) {
      addMesh(island, cylinder, mat('#91b7ba'), [-0.03, 0.12, 0.08], [0.66, 0.026, 0.49]);
      const ripple = addMesh(island, new THREE.TorusGeometry(0.3, 0.013, 6, 64), mat('#dfece0'), [-0.06, 0.139, 0.11]);
      ripple.rotation.x = -Math.PI / 2;
      ripple.scale.set(1, 0.67, 1);
      addMesh(island, pebble, ivory, [0.11, 0.2, 0.07], [0.25, 0.13, 0.19]);
      addMesh(island, pebble, mat('#d7b79d'), [0.09, 0.4, 0.09], [0.18, 0.11, 0.15]);
      addMesh(island, pebble, ivory, [0.11, 0.57, 0.08], [0.11, 0.07, 0.09]);
      makeTree(island, -0.51, -0.36, 0.49, green);
    }
    const marker = addMesh(island, new THREE.TorusGeometry(1.15, 0.014, 6, 90), new THREE.MeshStandardMaterial({ color: '#d78e77', transparent: true, opacity: 0, roughness: 1, depthWrite: false }), [0, -0.15, 0]);
    marker.rotation.x = -Math.PI / 2;
    marker.scale.y = 0.83;
    marker.castShadow = false;
    markers.push(marker);
    island.traverse(child => {
      if (child.isMesh && child !== marker) {
        child.userData.region = index;
        hitObjects.push(child);
      }
    });
  });

  // Small stepping stones invite a meander without defining a correct route.
  [
    [-1.28, -0.01, -0.25, 0.16], [-1.52, -0.03, -0.46, 0.12],
    [0.57, 0.11, -1.08, 0.12], [0.89, 0.02, -1.11, 0.17],
    [1.65, -0.03, 0.18, 0.13], [1.69, -0.11, 0.48, 0.11],
    [0.59, -0.22, 1.54, 0.13], [0.88, -0.24, 1.6, 0.16],
    [-1.74, -0.52, 1.37, 0.2], [2.35, -0.37, 0.54, 0.11],
    [-0.78, -0.33, -2.3, 0.13], [0.98, -0.37, -1.97, 0.1],
  ].forEach(([x, y, z, r], index) => {
    const stone = addMesh(world, pebble, index % 3 === 0 ? pale : ivory, [x, y, z], [r, r * 0.53, r * 0.86]);
    stone.rotation.y = index * 0.7;
    floats.push({ group: stone, y, offset: index * 0.8, amount: 0.028 });
  });

  // A faint ground shadow anchors the otherwise airy scene.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const context = shadowCanvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(142,107,83,0.13)');
  gradient.addColorStop(0.55, 'rgba(142,107,83,0.055)');
  gradient.addColorStop(1, 'rgba(142,107,83,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
  const groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(8, 6.6), shadowMat);
  groundShadow.rotation.x = -Math.PI / 2;
  groundShadow.position.y = -1.03;
  scene.add(groundShadow);

  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = media.matches;
  let manuallyPaused = false;
  let yaw = 0.03;
  let pitch = 0.65;
  let dragging = false;
  let down = null;
  let hoverIndex = -1;
  let selectedIndex = -1;
  let frame = 0;
  let disposed = false;
  let hasInteracted = false;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const start = performance.now();

  function updateCamera() {
    const angle = 0.59 + yaw;
    const distance = 10;
    camera.position.set(Math.sin(angle) * Math.cos(pitch) * distance, Math.sin(pitch) * distance, Math.cos(angle) * Math.cos(pitch) * distance);
    camera.lookAt(0, 0.22, -0.1);
  }
  function render(time = performance.now()) {
    if (disposed) return;
    const elapsed = (time - start) / 1000;
    if (!reducedMotion && !manuallyPaused) {
      for (const item of floats) item.group.position.y = item.y + Math.sin(elapsed * 0.65 + item.offset) * item.amount;
      if (!hasInteracted) yaw = Math.sin(elapsed * 0.12) * 0.11;
    }
    markers.forEach((marker, index) => {
      marker.material.opacity = selectedIndex === index ? 0.64 : hoverIndex === index ? 0.28 : 0;
    });
    updateCamera();
    renderer.render(scene, camera);
    if (!reducedMotion && !manuallyPaused) frame = requestAnimationFrame(render);
  }
  function draw() { if (reducedMotion || manuallyPaused) render(); }
  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const verticalSpan = Math.max(compact ? 5.75 : 5.4, 7.8 / aspect);
    camera.left = -verticalSpan * aspect / 2;
    camera.right = verticalSpan * aspect / 2;
    camera.top = verticalSpan / 2;
    camera.bottom = -verticalSpan / 2;
    camera.updateProjectionMatrix();
    draw();
  }
  function pick(event) {
    const bounds = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hitObjects, false);
    return hits[0]?.object.userData.region ?? -1;
  }
  function pointerDown(event) {
    if (event.button !== 0) return;
    if (dragging) return;
    dragging = true;
    down = { pointerId: event.pointerId, previousX: event.clientX, previousY: event.clientY, distance: 0 };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  }
  function pointerMove(event) {
    if (dragging && down) {
      if (event.pointerId !== down.pointerId) return;
      const dx = event.clientX - down.previousX;
      const dy = event.clientY - down.previousY;
      down.distance += Math.abs(dx) + Math.abs(dy);
      if (down.distance > 6) {
        hasInteracted = true;
        yaw -= dx * 0.006;
        pitch = Math.max(0.35, Math.min(1.12, pitch + dy * 0.003));
      }
      down.previousX = event.clientX;
      down.previousY = event.clientY;
      onHover(null);
      draw();
      return;
    }
    hoverIndex = pick(event);
    canvas.style.cursor = hoverIndex >= 0 ? 'pointer' : 'grab';
    onHover(hoverIndex >= 0 ? LANDSCAPE_REGIONS[hoverIndex].label : null);
    draw();
  }
  function pointerUp(event) {
    if (!dragging) return;
    if (down && event.pointerId !== down.pointerId) return;
    if (down && down.distance <= 6) {
      const index = pick(event);
      if (index >= 0) {
        selectedIndex = index;
        onChoose(LANDSCAPE_REGIONS[index]);
      }
    }
    dragging = false;
    down = null;
    canvas.style.cursor = 'grab';
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    draw();
  }
  function pointerCancel(event) {
    if (down && event.pointerId !== down.pointerId) return;
    dragging = false;
    down = null;
    canvas.style.cursor = 'grab';
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  function pointerLeave() {
    if (dragging) return;
    hoverIndex = -1;
    onHover(null);
    draw();
  }
  function motionChange(event) {
    reducedMotion = event.matches;
    cancelAnimationFrame(frame);
    render();
  }
  function contextLost(event) {
    event.preventDefault();
    onFailure();
  }
  const listeners = [['pointerdown', pointerDown], ['pointermove', pointerMove], ['pointerup', pointerUp], ['pointercancel', pointerCancel], ['pointerleave', pointerLeave], ['webglcontextlost', contextLost]];
  listeners.forEach(([name, fn]) => canvas.addEventListener(name, fn));
  media.addEventListener('change', motionChange);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  render();

  return {
    pause(paused) {
      manuallyPaused = paused;
      cancelAnimationFrame(frame);
      render();
    },
    select(id) {
      selectedIndex = LANDSCAPE_REGIONS.findIndex(region => region.id === id);
      draw();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      media.removeEventListener('change', motionChange);
      listeners.forEach(([name, fn]) => canvas.removeEventListener(name, fn));
      const geometries = new Set();
      const materials = new Set();
      scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      shadowTexture.dispose();
      renderer.dispose();
    },
  };
}

function FallbackGarden() {
  return <div className="landscape-fallback" aria-hidden="true">
    <div className="landscape-fallback-orbit" />
    <div className="landscape-fallback-island landscape-fallback-island-main"><span className="landscape-fallback-arch" /><span className="landscape-fallback-tree" /></div>
    <div className="landscape-fallback-island landscape-fallback-island-green"><span className="landscape-fallback-tree" /></div>
    <div className="landscape-fallback-island landscape-fallback-island-sun"><span className="landscape-fallback-sun" /></div>
    <div className="landscape-fallback-island landscape-fallback-island-lilac"><span className="landscape-fallback-steps" /></div>
    <div className="landscape-fallback-island landscape-fallback-island-blue"><span className="landscape-fallback-pond" /></div>
  </div>;
}

export default function Landscape({ compact = false, onSelect }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const callbackRef = useRef(onSelect);
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [systemStill, setSystemStill] = useState(false);
  callbackRef.current = onSelect;

  function choose(region) {
    setSelected(region.id);
    sceneRef.current?.select(region.id);
    callbackRef.current?.(region);
  }
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = event => setSystemStill(event.matches);
    setSystemStill(media.matches);
    media.addEventListener('change', updatePreference);
    try {
      sceneRef.current = createScene(canvasRef.current, compact, region => {
        setSelected(region.id);
        callbackRef.current?.(region);
      }, setHover, () => {
        sceneRef.current?.dispose();
        sceneRef.current = null;
        setFailed(true);
      });
    } catch (error) {
      setFailed(true);
    }
    return () => {
      media.removeEventListener('change', updatePreference);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [compact]);
  useEffect(() => { sceneRef.current?.pause(paused); }, [paused, compact]);

  return <div className={`inner-landscape${compact ? ' inner-landscape-compact' : ''}`}>
    <div className="landscape-stage">
      <div className="landscape-halo" aria-hidden="true" />
      {failed ? <FallbackGarden /> : <canvas ref={canvasRef} className="landscape-canvas" role="img" aria-label="A floating garden with five pastel islands representing feelings, needs, values, choices, and release. In the full garden, use the buttons below to explore each island." />}
      {!failed && !systemStill && <button className="landscape-motion" type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Resume garden motion' : 'Pause garden motion'} title={paused ? 'Resume motion' : 'Make it still'}>{paused ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5 12 8l-6.5 4.5Z" /></svg> : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4v8M10 4v8" /></svg>}</button>}
      {!compact && <div className="landscape-instruction" aria-hidden="true"><span className="landscape-instruction-dot" />{hover || 'Drag to wander · choose an island'}</div>}
    </div>
    {!compact && <div className="landscape-regions" aria-label="Explore your inner landscape">
      {LANDSCAPE_REGIONS.map(region => <button type="button" key={region.id} className={`landscape-region${selected === region.id ? ' is-selected' : ''}`} style={{ '--region-color': region.color }} aria-pressed={selected === region.id} onClick={() => choose(region)}><span className="landscape-region-dot" aria-hidden="true" /><span>{region.label}</span></button>)}
    </div>}
  </div>;
}

export { Landscape as InnerLandscape };
