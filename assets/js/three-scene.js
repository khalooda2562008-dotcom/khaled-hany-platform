const MODES = {
  nova: { color: 0xf7c66b, secondary: 0x5eead4, scale: 1.04, speed: 0.55, shape: 'sphere', galaxy: true },
  ai: { color: 0x67e8f9, secondary: 0xa78bfa, scale: 1, speed: 1, shape: 'icosa' },
  engineering: { color: 0x7dd3fc, secondary: 0x60a5fa, scale: 0.92, speed: 0.72, shape: 'octa' },
  code: { color: 0x79e3c2, secondary: 0x67e8f9, scale: 0.86, speed: 1.25, shape: 'box' },
  creative: { color: 0xc4b5fd, secondary: 0xf0abfc, scale: 1.05, speed: 0.62, shape: 'torus' },
  projects: { color: 0x93c5fd, secondary: 0x67e8f9, scale: 0.95, speed: 0.88, shape: 'dodeca' },
  future: { color: 0xddd6fe, secondary: 0x67e8f9, scale: 1.12, speed: 0.48, shape: 'icosa' }
};

export async function createHeroScene(canvas, onFallback, options = {}) {
  let THREE;
  try {
    THREE = await import('three');
  } catch (error) {
    onFallback?.('تعذّر تحميل مكتبة Three.js. افتح الموقع مع اتصال بالإنترنت أو حمّل نسخة المكتبات محليًا.');
    return null;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: window.innerWidth > 760,
      powerPreference: 'low-power',
      stencil: false,
      depth: true
    });
  } catch (error) {
    onFallback?.('المتصفح أو الجهاز لا يوفّر WebGL 2 لهذه التجربة. يمكنك تصفّح الموقع بالكامل بدون المشهد ثلاثي الأبعاد.');
    return null;
  }

  const host = canvas.parentElement;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x080d19, 0.055);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
  camera.position.set(0, 0, 7.4);

  const lowPower = window.matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
  const dprCap = lowPower ? 1.15 : 1.65;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = false;

  const ambient = new THREE.AmbientLight(0x9dbde5, 1.2);
  const keyLight = new THREE.DirectionalLight(0xd7f7ff, 2.4);
  keyLight.position.set(3.6, 4.1, 5);
  const rimLight = new THREE.PointLight(0x4fdcf2, 27, 14, 2);
  rimLight.position.set(-3.4, 0.7, 1.5);
  const violetLight = new THREE.PointLight(0x9c7cff, 18, 12, 2);
  violetLight.position.set(2, -2.1, -2.5);
  scene.add(ambient, keyLight, rimLight, violetLight);

  const world = new THREE.Group();
  scene.add(world);
  const coreGroup = new THREE.Group();
  world.add(coreGroup);

  const coreGeometry = new THREE.IcosahedronGeometry(1.02, lowPower ? 3 : 4);
  const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: MODES.ai.color,
    metalness: 0.78,
    roughness: 0.23,
    clearcoat: 1,
    clearcoatRoughness: 0.16,
    emissive: MODES.ai.color,
    emissiveIntensity: 0.09
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.name = 'KhaledDigitalCore';
  coreGroup.add(core);
  const stageLoading = document.getElementById('stageLoading');
  import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
    const loader = new GLTFLoader();
    const requestedModel = typeof options.modelUrl === 'string' && options.modelUrl.startsWith('https://') ? options.modelUrl : '';
    const modelUrl = requestedModel || new URL('../models/khaled-digital-core.glb', import.meta.url).href;
    loader.load(modelUrl, gltf => {
      if (disposed) return;
      let sourceMesh = null;
      gltf.scene.traverse(object => { if (!sourceMesh && object.isMesh) sourceMesh = object; });
      if (mode !== 'nova' && sourceMesh?.geometry) {
        core.geometry.dispose();
        core.geometry = sourceMesh.geometry.clone();
        const sourceMaterial = Array.isArray(sourceMesh.material) ? sourceMesh.material[0] : sourceMesh.material;
        if (sourceMaterial?.map) {
          coreMaterial.map = sourceMaterial.map;
          coreMaterial.map.colorSpace = THREE.SRGBColorSpace;
          coreMaterial.metalness = sourceMaterial.metalness ?? coreMaterial.metalness;
          coreMaterial.roughness = sourceMaterial.roughness ?? coreMaterial.roughness;
          coreMaterial.needsUpdate = true;
        }
      }
      if (stageLoading) stageLoading.hidden = true;
      gltf.scene.traverse(object => { if (object.geometry) object.geometry.dispose(); if (object.material) { if (Array.isArray(object.material)) object.material.forEach(m => m.dispose()); else object.material.dispose(); } });
    }, undefined, error => {
      console.warn('[KhaledHany] GLB model could not load; using procedural geometry.', error);
      if (stageLoading) stageLoading.hidden = true;
    });
  }).catch(error => {
    console.warn('[KhaledHany] GLTFLoader unavailable; using procedural geometry.', error);
    if (stageLoading) stageLoading.hidden = true;
  });

  const innerGeometry = new THREE.IcosahedronGeometry(0.81, 1);
  const inner = new THREE.Mesh(innerGeometry, new THREE.MeshStandardMaterial({
    color: 0x0b1b2a,
    metalness: 0.6,
    roughness: 0.2,
    wireframe: true,
    transparent: true,
    opacity: 0.54,
    emissive: 0x0b5d74,
    emissiveIntensity: 0.17
  }));
  coreGroup.add(inner);

  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.22, 2),
    new THREE.MeshBasicMaterial({ color: 0x8beaf7, wireframe: true, transparent: true, opacity: 0.15 })
  );
  coreGroup.add(shell);

  const ringGroup = new THREE.Group();
  world.add(ringGroup);
  const ringMaterials = [
    new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.64 }),
    new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.58 }),
    new THREE.MeshBasicMaterial({ color: 0x8ac7fa, transparent: true, opacity: 0.31 })
  ];
  const rings = [
    new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.009, 8, 180), ringMaterials[0]),
    new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.006, 8, 180), ringMaterials[1]),
    new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.005, 8, 180), ringMaterials[2])
  ];
  rings[0].rotation.set(1.09, 0.22, 0.14);
  rings[1].rotation.set(0.47, 1.16, -0.28);
  rings[2].rotation.set(1.42, -0.66, 0.73);
  rings.forEach(ring => ringGroup.add(ring));

  const satelliteGroup = new THREE.Group();
  world.add(satelliteGroup);
  const satelliteMaterials = [
    new THREE.MeshPhysicalMaterial({ color: 0x67e8f9, metalness: 0.7, roughness: 0.24, emissive: 0x125b75, emissiveIntensity: 0.2 }),
    new THREE.MeshPhysicalMaterial({ color: 0xb7a3ff, metalness: 0.66, roughness: 0.28, emissive: 0x38276d, emissiveIntensity: 0.25 }),
    new THREE.MeshStandardMaterial({ color: 0x91d7ff, metalness: 0.62, roughness: 0.3 })
  ];
  const satelliteGeometries = [
    new THREE.OctahedronGeometry(0.105, 0),
    new THREE.BoxGeometry(0.13, 0.13, 0.13),
    new THREE.TetrahedronGeometry(0.13, 0)
  ];
  const satellites = [];
  const satelliteCount = lowPower ? 7 : 10;
  for (let i = 0; i < satelliteCount; i++) {
    const mesh = new THREE.Mesh(satelliteGeometries[i % satelliteGeometries.length], satelliteMaterials[i % satelliteMaterials.length]);
    mesh.userData = { angle: i / satelliteCount * Math.PI * 2, radius: 1.95 + (i % 3) * 0.22, vertical: Math.sin(i * 2.13) * 0.28, speed: (i % 2 ? -1 : 1) * (0.18 + i * 0.009) };
    satelliteGroup.add(mesh);
    satellites.push(mesh);
  }

  const particleCount = lowPower ? 260 : 620;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);
  const cA = new THREE.Color(0x67e8f9);
  const cB = new THREE.Color(0xa78bfa);
  for (let i = 0; i < particleCount; i++) {
    const radius = 2.1 + Math.random() * 2.35;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    particlePositions[i * 3 + 1] = radius * Math.cos(phi);
    particlePositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const color = cA.clone().lerp(cB, Math.random() * 0.72);
    particleColors[i * 3] = color.r;
    particleColors[i * 3 + 1] = color.g;
    particleColors[i * 3 + 2] = color.b;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
  const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({
    size: lowPower ? 0.018 : 0.023,
    transparent: true,
    opacity: 0.72,
    vertexColors: true,
    sizeAttenuation: true,
    depthWrite: false
  }));
  world.add(particles);

  // Spiral galaxy used by the "nova" scene: a warm disc that wraps the globe.
  const galaxyCount = lowPower ? 900 : 2200;
  const galaxyPositions = new Float32Array(galaxyCount * 3);
  const galaxyColors = new Float32Array(galaxyCount * 3);
  const gA = new THREE.Color(0xf7c66b);
  const gB = new THREE.Color(0x5eead4);
  for (let i = 0; i < galaxyCount; i++) {
    const t = i / galaxyCount;
    const arm = i % 3;
    const radius = 0.62 + t * 3.1;
    const angle = arm * (Math.PI * 2 / 3) + t * 5.6 + (Math.random() - 0.5) * 0.38;
    galaxyPositions[i * 3] = Math.cos(angle) * radius;
    galaxyPositions[i * 3 + 1] = (Math.random() - 0.5) * (0.1 + t * 0.55);
    galaxyPositions[i * 3 + 2] = Math.sin(angle) * radius;
    const color = gA.clone().lerp(gB, t * 0.85);
    galaxyColors[i * 3] = color.r;
    galaxyColors[i * 3 + 1] = color.g;
    galaxyColors[i * 3 + 2] = color.b;
  }
  const galaxyGeometry = new THREE.BufferGeometry();
  galaxyGeometry.setAttribute('position', new THREE.BufferAttribute(galaxyPositions, 3));
  galaxyGeometry.setAttribute('color', new THREE.BufferAttribute(galaxyColors, 3));
  const galaxy = new THREE.Points(galaxyGeometry, new THREE.PointsMaterial({
    size: lowPower ? 0.015 : 0.02,
    transparent: true,
    opacity: 0.78,
    vertexColors: true,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  galaxy.rotation.x = 0.32;
  galaxy.visible = false;
  world.add(galaxy);

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i++) {
    const r = 5.5 + Math.random() * 2.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0x9db9df, size: 0.012, transparent: true, opacity: 0.45 }));
  world.add(stars);

  const modes = MODES;
  let mode = 'ai';
  let targetX = 0, targetY = 0, pointerX = 0, pointerY = 0;
  let rotation = 0;
  let rafId = 0;
  let running = false;
  let visible = true;
  let motionAllowed = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let disposed = false;
  const clock = new THREE.Clock();

  function resize() {
    if (disposed) return;
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    camera.aspect = rect.width / rect.height;
    camera.position.z = rect.width < 520 ? 7.8 : 7.35;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  function setMode(nextMode) {
    if (!modes[nextMode]) return;
    mode = nextMode;
    const style = modes[mode];
    const color = new THREE.Color(style.color);
    const secondary = new THREE.Color(style.secondary);
    coreMaterial.color.copy(color);
    coreMaterial.emissive.copy(color).multiplyScalar(0.16);
    const shapeGeometry = {
      sphere: () => new THREE.SphereGeometry(1.0, lowPower ? 40 : 64, lowPower ? 28 : 44),
      icosa: () => new THREE.IcosahedronGeometry(1.02, lowPower ? 2 : 3),
      octa: () => new THREE.OctahedronGeometry(1.12, 2),
      box: () => new THREE.BoxGeometry(1.48, 1.48, 1.48, 4, 4, 4),
      torus: () => new THREE.TorusKnotGeometry(0.78, 0.28, lowPower ? 96 : 150, 10, 2, 3),
      dodeca: () => new THREE.DodecahedronGeometry(1.06, 1)
    };
    const nextGeometry = (shapeGeometry[style.shape] || shapeGeometry.icosa)();
    if (core.geometry) core.geometry.dispose();
    core.geometry = nextGeometry;
    const globe = style.shape === 'sphere';
    if (shell.geometry) shell.geometry.dispose();
    shell.geometry = globe ? new THREE.SphereGeometry(1.26, lowPower ? 18 : 26, lowPower ? 12 : 18) : new THREE.IcosahedronGeometry(1.22, 2);
    inner.visible = !globe;
    if (galaxy) galaxy.visible = Boolean(style.galaxy);
    rimLight.color.copy(color);
    violetLight.color.copy(secondary);
    ringMaterials[0].color.copy(color);
    ringMaterials[1].color.copy(secondary);
    satelliteMaterials.forEach((material, index) => material.color.copy(index % 2 ? secondary : color));
    coreGroup.scale.setScalar(style.scale);
    ringGroup.scale.setScalar(0.92 + style.scale * 0.08);
  }

  function onPointerMove(event) {
    const rect = host.getBoundingClientRect();
    targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.8;
    targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.65;
  }
  function onPointerLeave() { targetX = 0; targetY = 0; }
  host.addEventListener('pointermove', onPointerMove, { passive: true });
  host.addEventListener('pointerleave', onPointerLeave, { passive: true });

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMotionChange = event => { motionAllowed = !event.matches; if (motionAllowed) start(); };
  motionQuery.addEventListener?.('change', onMotionChange);

  const observer = new IntersectionObserver(entries => {
    visible = Boolean(entries[0]?.isIntersecting);
    if (visible) start();
    else stop();
  }, { threshold: 0.02 });
  observer.observe(host);

  function render() {
    if (disposed || !running) return;
    rafId = requestAnimationFrame(render);
    const elapsed = clock.getElapsedTime();
    const style = modes[mode];
    const auto = motionAllowed ? 1 : 0;
    pointerX += (targetX - pointerX) * 0.035;
    pointerY += (targetY - pointerY) * 0.035;
    rotation += 0.0024 * style.speed * auto;
    core.rotation.y = rotation * 0.78 + pointerX * 0.72;
    core.rotation.x = Math.sin(elapsed * 0.16) * 0.1 + pointerY * 0.55;
    inner.rotation.y = -rotation * 0.58;
    inner.rotation.x = -pointerY * 0.2;
    shell.rotation.set(pointerY * 0.2, -rotation * 0.36, elapsed * 0.035 * auto);
    ringGroup.rotation.y = rotation * 0.24 + pointerX * 0.1;
    ringGroup.rotation.x = pointerY * 0.11;
    particles.rotation.y = -rotation * 0.13;
    galaxy.rotation.y = rotation * 0.1;
    stars.rotation.y = rotation * 0.025;
    satelliteGroup.rotation.y = -rotation * 0.26;
    satellites.forEach((mesh, index) => {
      const data = mesh.userData;
      const angle = data.angle + elapsed * data.speed * style.speed * auto;
      mesh.position.set(Math.cos(angle) * data.radius, Math.sin(angle * 1.3) * 0.2 + data.vertical, Math.sin(angle) * data.radius * 0.72);
      mesh.rotation.x += 0.003 * auto;
      mesh.rotation.y += 0.005 * auto;
      mesh.scale.setScalar(0.86 + (Math.sin(elapsed * 0.8 + index) + 1) * 0.1);
    });
    const scroll = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));
    camera.position.x += (pointerX * 0.34 - camera.position.x) * 0.025;
    camera.position.y += (-pointerY * 0.28 - scroll * 0.2 - camera.position.y) * 0.025;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  function start() {
    if (disposed || running || !visible) return;
    running = true;
    rafId = requestAnimationFrame(render);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }
  // Reduced-motion mode keeps the scene visible and interactive but freezes autonomous movement.
  start();

  return {
    setMode,
    pause() { motionAllowed = false; },
    resume() { motionAllowed = true; start(); },
    dispose() {
      disposed = true;
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      motionQuery.removeEventListener?.('change', onMotionChange);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
          else object.material.dispose();
        }
      });
      renderer.dispose();
    }
  };
}
