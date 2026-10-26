import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AlignLeft,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Hand,
  Layers,
  Move3d,
  Palette,
  Rotate3d,
  Ruler,
  Scan,
} from 'lucide-react';
import {
  ArrangementConfig,
  BackgroundStyle,
  ContainerSpec,
  ItemSpec,
  PackingMode,
  PackingSummary,
  PlacedItem,
  resolvePalletHexColor,
  ViewerConfig,
} from '../types/packing';

interface PackingCanvas3DProps {
  mode: PackingMode;
  item: ItemSpec;
  container: ContainerSpec;
  arrangement: ArrangementConfig;
  summary: PackingSummary;
  viewer: ViewerConfig;
  onUpdateViewer: (patch: Partial<ViewerConfig>) => void;
  onUpdateArrangement: (patch: Partial<ArrangementConfig>) => void;
  captureTrigger: number;
}

const BG_PRESETS: { id: BackgroundStyle; label: string; color: string }[] = [
  { id: 'cad-gray', label: 'CAD 그레이', color: '#b5b7bb' },
  { id: 'clean-white', label: '클린 화이트', color: '#f8fafc' },
  { id: 'warm-sand', label: '웜 샌드', color: '#e7e5e4' },
  { id: 'dark-studio', label: '스튜디오 다크', color: '#0f172a' },
  { id: 'blueprint-navy', label: '블루프린트', color: '#172554' },
];

function resolveBackgroundHex(viewer: ViewerConfig): string {
  switch (viewer.backgroundStyle) {
    case 'cad-gray':
      return '#b5b7bb';
    case 'clean-white':
      return '#f8fafc';
    case 'warm-sand':
      return '#e7e5e4';
    case 'dark-studio':
      return '#0f172a';
    case 'blueprint-navy':
      return '#172554';
    case 'custom':
      return viewer.customBgColor || '#d8dee9';
    default:
      return '#b5b7bb';
  }
}

function isColorLight(hex: string): boolean {
  try {
    const c = new THREE.Color(hex);
    const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    return lum > 0.45;
  } catch {
    return true;
  }
}

const isSoftwareGl = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

type BadgeVariant =
  | 'neutral-dark'
  | 'neutral-light'
  | 'clearance'
  | 'overhang'
  | 'custom-size'
  | 'calculated-size';

interface BadgeRowItem {
  text: string;
  variant: BadgeVariant;
}

/**
 * Creates an ultra-crisp 4x super-sampled 3D sprite stacking 1..N badge pills for a single axis (가로 / 세로 / 높이).
 * Because all active pills for an axis (설정, 계산, 여유/초과) are rendered into a single stacked texture,
 * they stay grouped in the same location and are guaranteed never to overlap from any 3D camera angle.
 */
function createAxisBadgeStackSprite(
  rows: BadgeRowItem[],
  maxAnisotropy: number,
  baseWidthWorld: number
): THREE.Sprite {
  const dpr = 4;
  const logicalW = 430;
  const rowH = 68;
  const rowGap = 10;
  const padY = 8;
  const logicalH = padY * 2 + rows.length * rowH + Math.max(0, rows.length - 1) * rowGap;

  const canvas = document.createElement('canvas');
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, logicalW, logicalH);

  rows.forEach((row, idx) => {
    const { text, variant } = row;
    const rx = 10;
    const ry = padY + idx * (rowH + rowGap);
    const rw = logicalW - 20;
    const rh = rowH;
    const radius = 15;

    if (variant === 'clearance') {
      ctx.fillStyle = 'rgba(6, 78, 59, 0.95)';
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.95)';
    } else if (variant === 'overhang') {
      ctx.fillStyle = 'rgba(127, 29, 29, 0.95)';
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.95)';
    } else if (variant === 'custom-size') {
      ctx.fillStyle = 'rgba(120, 53, 15, 0.95)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
    } else if (variant === 'calculated-size') {
      ctx.fillStyle = 'rgba(12, 74, 110, 0.95)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
    } else if (variant === 'neutral-dark') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
    }

    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, radius);
    ctx.fill();
    ctx.stroke();

    ctx.font = '800 27px "JetBrains Mono", "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (variant === 'clearance') {
      ctx.fillStyle = '#6ee7b7';
    } else if (variant === 'overhang') {
      ctx.fillStyle = '#fecaca';
    } else if (variant === 'custom-size') {
      ctx.fillStyle = '#fde68a';
    } else if (variant === 'calculated-size') {
      ctx.fillStyle = '#7dd3fc';
    } else if (variant === 'neutral-dark') {
      ctx.fillStyle = '#f8fafc';
    } else {
      ctx.fillStyle = '#0f172a';
    }

    ctx.fillText(text, logicalW / 2, ry + rh / 2 + 1);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 30;
  const worldH = baseWidthWorld * (logicalH / logicalW);
  sprite.scale.set(baseWidthWorld, worldH, 1);
  return sprite;
}

export const PackingCanvas3D: React.FC<PackingCanvas3DProps> = ({
  mode,
  item,
  container,
  arrangement,
  summary,
  viewer,
  onUpdateViewer,
  onUpdateArrangement,
  captureTrigger,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PlacedItem | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rootGroupRef = useRef<THREE.Group | null>(null);
  const itemGroupsRef = useRef<
    {
      group: THREE.Group;
      data: PlacedItem;
      basePos: THREE.Vector3;
    }[]
  >([]);
  const requestRenderRef = useRef<() => void>(() => {});
  const targetExplodedRef = useRef<number>(viewer.explodedFactor);
  const currentExplodedRef = useRef<number>(viewer.explodedFactor);
  const cameraTargetPosRef = useRef<THREE.Vector3 | null>(null);
  const cameraTargetLookRef = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    targetExplodedRef.current = viewer.explodedFactor;
    requestRenderRef.current();
  }, [viewer.explodedFactor]);

  // Initialize Three.js WebGL scene once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 900;
    const height = mount.clientHeight || 650;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#b8b8b8');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 350);
    camera.position.set(18, 16, 18);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x64748b, 0.85);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
    keyLight.position.set(18, 28, 20);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 90;
    const d = 18;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.65);
    fillLight.position.set(-18, 16, -14);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.45);
    rimLight.position.set(0, 12, -22);
    scene.add(rimLight);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);
    rootGroupRef.current = rootGroup;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 1.25;
    controls.maxPolarAngle = Math.PI / 2 + 0.08;
    controls.minDistance = 2.5;
    controls.maxDistance = 120;
    controls.target.set(0, 5, 0);
    controlsRef.current = controls;

    controls.addEventListener('start', () => {
      cameraTargetPosRef.current = null;
      cameraTargetLookRef.current = null;
    });

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (!sync) {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        renderDirty = false;
        const dt = Math.min(0.1, (now - lastTime) / 1000 || 0.016);
        lastTime = now;

        let needsMoreFrames = false;

        const diffExplode = Math.abs(targetExplodedRef.current - currentExplodedRef.current);
        if (diffExplode > 0.001) {
          currentExplodedRef.current = THREE.MathUtils.damp(
            currentExplodedRef.current,
            targetExplodedRef.current,
            10,
            dt
          );
          needsMoreFrames = true;

          const factor = currentExplodedRef.current;
          for (const entry of itemGroupsRef.current) {
            const { group, data, basePos } = entry;
            const radialX = basePos.x * (1 + factor * 0.45);
            const radialZ = basePos.z * (1 + factor * 0.45);
            const layerLift = data.layer * factor * 1.45;
            group.position.set(radialX, basePos.y + layerLift, radialZ);
          }
        }

        if (cameraTargetPosRef.current && cameraTargetLookRef.current) {
          camera.position.lerp(cameraTargetPosRef.current, 1 - Math.exp(-8 * dt));
          controls.target.lerp(cameraTargetLookRef.current, 1 - Math.exp(-8 * dt));
          if (
            camera.position.distanceTo(cameraTargetPosRef.current) < 0.05 &&
            controls.target.distanceTo(cameraTargetLookRef.current) < 0.05
          ) {
            camera.position.copy(cameraTargetPosRef.current);
            controls.target.copy(cameraTargetLookRef.current);
            cameraTargetPosRef.current = null;
            cameraTargetLookRef.current = null;
          } else {
            needsMoreFrames = true;
          }
        }

        controls.update();
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsMoreFrames) {
            requestRender();
          }
        };

        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    requestRenderRef.current = requestRender;
    controls.addEventListener('change', requestRender);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 5) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const selectableMeshes: THREE.Object3D[] = [];
      for (const entry of itemGroupsRef.current) {
        if (entry.group.visible) {
          selectableMeshes.push(entry.group);
        }
      }

      const hits = raycaster.intersectObjects(selectableMeshes, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData?.placedItem) {
          obj = obj.parent;
        }
        if (obj?.userData?.placedItem) {
          setSelectedItem(obj.userData.placedItem as PlacedItem);
          return;
        }
      }
      setSelectedItem(null);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
          renderer.setSize(w, h);
          requestRender();
        }
      }
    });
    resizeObserver.observe(mount);

    requestRender();

    return () => {
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Sync OrbitControls mouse/touch bindings with viewer.interactionMode ('orbit' vs 'pan') + Spacebar/Arrow keys
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const applyMode = (isPan: boolean) => {
      if (isPan) {
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        };
        controls.touches = {
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        };
      } else {
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.PAN,
        };
        controls.touches = {
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        };
      }
    };

    applyMode(viewer.interactionMode === 'pan');

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        applyMode(true);
        return;
      }

      const camera = cameraRef.current;
      if (!camera) return;

      const step = 0.85;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = step;
      else if (e.key === 'ArrowDown') dy = -step;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        cameraTargetPosRef.current = null;
        cameraTargetLookRef.current = null;

        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
        const offset = new THREE.Vector3()
          .addScaledVector(right, -dx)
          .addScaledVector(up, -dy);

        camera.position.add(offset);
        controls.target.add(offset);
        requestRenderRef.current();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        applyMode(viewer.interactionMode === 'pan');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [viewer.interactionMode]);

  // Rebuild 3D geometry whenever packing configuration or visual theme updates
  useEffect(() => {
    const scene = sceneRef.current;
    const rootGroup = rootGroupRef.current;
    const renderer = rendererRef.current;
    if (!scene || !rootGroup || !renderer) return;

    const activeBgHex = resolveBackgroundHex(viewer);
    const isDarkBg = !isColorLight(activeBgHex);
    scene.background = new THREE.Color(activeBgHex);
    scene.fog = new THREE.FogExp2(activeBgHex, 0.006);

    rootGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.LineSegments).isLineSegments) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });
    rootGroup.clear();
    itemGroupsRef.current = [];

    const SCALE = 0.01;
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const contW = summary.effectiveContainerWidth * SCALE;
    const contD = summary.effectiveContainerDepth * SCALE;
    const contH = summary.effectiveContainerHeight * SCALE;
    const palletH = (mode === 'pallet' ? container.palletHeight : 0) * SCALE;
    const stackW = summary.stackWidth * SCALE;
    const stackD = summary.stackDepth * SCALE;
    const stackH = summary.stackHeight * SCALE;
    const totalH = summary.totalHeight * SCALE;

    // 1. Contact Shadow Plane
    const maxFootprint = Math.max(contW, contD, stackW, stackD);
    const shadowPlaneGeo = new THREE.PlaneGeometry(maxFootprint * 2.4, maxFootprint * 2.4);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(128, 128, 20, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0,0,0,0.32)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 256, 256);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: isDarkBg ? 0.48 : 0.28,
    });
    const shadowMesh = new THREE.Mesh(shadowPlaneGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.01;
    rootGroup.add(shadowMesh);

    const stackCenterX = arrangement.centerItems ? 0 : -contW / 2 + stackW / 2;
    const stackCenterZ = arrangement.centerItems ? 0 : -contD / 2 + stackD / 2;

    const showCustomSize =
      viewer.sizeDisplayMode === 'custom' || viewer.sizeDisplayMode === 'both';
    const showCalculatedSize =
      viewer.sizeDisplayMode === 'calculated' || viewer.sizeDisplayMode === 'both';

    // 2. PALLET BASE (Always render physical pallet in pallet mode, even when sizeDisplayMode === 'off')
    if (mode === 'pallet' && palletH > 0) {
      const palletGroup = new THREE.Group();
      const isPlasticPallet = (viewer.palletShape ?? 'plastic') === 'plastic';
      const palletColor = resolvePalletHexColor(
        viewer.palletColor,
        viewer.customPalletColor
      );

      // Use user-configured pallet size by default (including when sizeDisplayMode === 'off'),
      // or calculated stack footprint when sizeDisplayMode === 'calculated'
      const useCalculatedFootprint = viewer.sizeDisplayMode === 'calculated';
      const baseW = useCalculatedFootprint ? stackW : contW;
      const baseD = useCalculatedFootprint ? stackD : contD;
      const baseCenterX = useCalculatedFootprint ? stackCenterX : 0;
      const baseCenterZ = useCalculatedFootprint ? stackCenterZ : 0;

      const palletMat = new THREE.MeshStandardMaterial({
        color: palletColor,
        roughness: isPlasticPallet ? 0.42 : 0.78,
        metalness: isPlasticPallet ? 0.08 : 0.02,
      });
      const edgeMat = new THREE.LineBasicMaterial({
        color: useCalculatedFootprint
          ? 0x0284c7
          : viewer.palletColor === 'black'
          ? 0x475569
          : 0x111111,
      });

      const addPartWithEdges = (
        geo: THREE.BufferGeometry,
        posX: number,
        posY: number,
        posZ: number
      ) => {
        const mesh = new THREE.Mesh(geo, palletMat);
        mesh.position.set(posX, posY, posZ);
        mesh.castShadow = !isSoftwareGl;
        mesh.receiveShadow = true;
        palletGroup.add(mesh);
        if (viewer.showEdges) {
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
          edges.position.copy(mesh.position);
          palletGroup.add(edges);
        }
      };

      if (isPlasticPallet) {
        // Industrial molded plastic pallet: Solid upper deck + 9-block forklift posts + lower perimeter/skid deck
        const topDeckH = palletH * 0.28;
        const botDeckH = palletH * 0.18;
        const postH = Math.max(0.01, palletH - topDeckH - botDeckH);

        // 1. Solid Molded Top Deck
        const topGeo = new THREE.BoxGeometry(baseW, topDeckH, baseD);
        addPartWithEdges(topGeo, baseCenterX, palletH - topDeckH / 2, baseCenterZ);

        // 2. 9 Molded Support Posts (3x3 grid creating 4-way forklift entry tunnels)
        const postW = baseW * 0.16;
        const postD = baseD * 0.16;
        const postXCoords = [
          baseCenterX - baseW / 2 + postW / 2,
          baseCenterX,
          baseCenterX + baseW / 2 - postW / 2,
        ];
        const postZCoords = [
          baseCenterZ - baseD / 2 + postD / 2,
          baseCenterZ,
          baseCenterZ + baseD / 2 - postD / 2,
        ];
        const postGeo = new THREE.BoxGeometry(postW, postH, postD);
        for (const px of postXCoords) {
          for (const pz of postZCoords) {
            addPartWithEdges(postGeo, px, botDeckH + postH / 2, pz);
          }
        }

        // 3. Bottom Skid Runners (3 longitudinal runners along Z)
        const botRunnerGeo = new THREE.BoxGeometry(postW, botDeckH, baseD);
        for (const px of postXCoords) {
          addPartWithEdges(botRunnerGeo, px, botDeckH / 2, baseCenterZ);
        }
      } else {
        // Slatted Wooden Pallet: 7 top deck boards + 3 longitudinal stringer runners + 3 bottom boards
        const boardThickness = palletH * 0.2;
        const botBoardThickness = palletH * 0.18;
        const runnerHeight = Math.max(0.01, palletH - boardThickness - botBoardThickness);
        const numBoards = 7;
        const boardW = baseW;
        const boardD = (baseD * 0.78) / numBoards;
        const boardStep = (baseD - boardD) / (numBoards - 1);

        // 1. Top Slatted Deck Boards
        const topBoardGeo = new THREE.BoxGeometry(boardW, boardThickness, boardD);
        for (let i = 0; i < numBoards; i++) {
          addPartWithEdges(
            topBoardGeo,
            baseCenterX,
            palletH - boardThickness / 2,
            baseCenterZ - baseD / 2 + boardD / 2 + i * boardStep
          );
        }

        // 2. 3 Longitudinal Stringer Runners
        const runnerW = baseW * 0.08;
        const xOffsets = [
          baseCenterX - baseW / 2 + runnerW / 2,
          baseCenterX,
          baseCenterX + baseW / 2 - runnerW / 2,
        ];
        const runnerGeo = new THREE.BoxGeometry(runnerW, runnerHeight, baseD);
        for (const rx of xOffsets) {
          addPartWithEdges(
            runnerGeo,
            rx,
            botBoardThickness + runnerHeight / 2,
            baseCenterZ
          );
        }

        // 3. 3 Bottom Deck Boards
        const botBoardD = baseD * 0.12;
        const zOffsets = [
          baseCenterZ - baseD / 2 + botBoardD / 2,
          baseCenterZ,
          baseCenterZ + baseD / 2 - botBoardD / 2,
        ];
        const botBoardGeo = new THREE.BoxGeometry(boardW, botBoardThickness, botBoardD);
        for (const bz of zOffsets) {
          addPartWithEdges(botBoardGeo, baseCenterX, botBoardThickness / 2, bz);
        }
      }

      // If 'both' is selected in pallet mode, also draw a Cyan wireframe deck showing the Calculated Stack Footprint on the pallet
      if (viewer.sizeDisplayMode === 'both') {
        const calcPalletGeo = new THREE.BoxGeometry(stackW, palletH + 0.02, stackD);
        const calcPalletEdges = new THREE.LineSegments(
          new THREE.EdgesGeometry(calcPalletGeo),
          new THREE.LineBasicMaterial({ color: 0x06b6d4 })
        );
        calcPalletEdges.position.set(stackCenterX, palletH / 2, stackCenterZ);
        palletGroup.add(calcPalletEdges);
      }

      rootGroup.add(palletGroup);
    }

    // 3. PLACED ITEMS + exact protruding slice highlight
    const maxVisibleLayer = Math.max(1, viewer.visibleLayers);
    const factor = currentExplodedRef.current;

    const blackEdgeMat = new THREE.LineBasicMaterial({ color: 0x0f172a });
    const canEdgeMat = new THREE.LineBasicMaterial({ color: 0x334e68 });
    const warningEdgeMat = new THREE.LineBasicMaterial({ color: 0xef4444 });
    const protrudeFillMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });

    for (const placed of summary.placedItems) {
      const itemGroup = new THREE.Group();
      itemGroup.userData = { placedItem: placed };
      itemGroup.visible = placed.layer < maxVisibleLayer;

      const basePos = new THREE.Vector3(
        placed.x * SCALE,
        placed.y * SCALE,
        placed.z * SCALE
      );

      const radialX = basePos.x * (1 + factor * 0.45);
      const radialZ = basePos.z * (1 + factor * 0.45);
      const layerLift = placed.layer * factor * 1.45;
      itemGroup.position.set(radialX, basePos.y + layerLift, radialZ);

      if (placed.shape === 'box') {
        const localW = Math.max(0.02, (item.width - 1.5) * SCALE);
        const localH = Math.max(0.02, (item.height - 1.0) * SCALE);
        const localD = Math.max(0.02, (item.depth - 1.5) * SCALE);

        const boxGeo = new THREE.BoxGeometry(localW, localH, localD);

        const colPrimary = item.customColor || '#ef0000';
        const colSecondary = item.secondaryColor || '#0018f9';

        const primaryMat = new THREE.MeshStandardMaterial({
          color: colPrimary,
          roughness: 0.45,
          metalness: 0.06,
        });
        const secondaryMat = new THREE.MeshStandardMaterial({
          color: colSecondary,
          roughness: 0.45,
          metalness: 0.06,
        });
        const topMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(colPrimary).lerp(new THREE.Color('#ffffff'), 0.65),
          roughness: 0.38,
          metalness: 0.03,
        });

        const isWidthLonger = item.width >= item.depth;
        const xFaceMat = isWidthLonger ? secondaryMat : primaryMat;
        const zFaceMat = isWidthLonger ? primaryMat : secondaryMat;

        const materials: THREE.Material[] = [
          xFaceMat,
          xFaceMat,
          topMat,
          topMat,
          zFaceMat,
          zFaceMat,
        ];

        const boxMesh = new THREE.Mesh(boxGeo, materials);
        boxMesh.rotation.y = placed.rotationY;
        boxMesh.castShadow = !isSoftwareGl;
        boxMesh.receiveShadow = true;
        itemGroup.add(boxMesh);

        // If out of bounds and overhang visualization is enabled, overlay a semi-transparent red warning shell on the item
        const showOverhang = viewer.showSpaceAnalysis && viewer.showOverhang;
        if (placed.isOutOfBounds && showOverhang) {
          const warnGeo = new THREE.BoxGeometry(localW + 0.02, localH + 0.02, localD + 0.02);
          const warnMesh = new THREE.Mesh(warnGeo, protrudeFillMat);
          warnMesh.rotation.y = placed.rotationY;
          warnMesh.renderOrder = 15;
          itemGroup.add(warnMesh);
        }

        if (viewer.showEdges || (placed.isOutOfBounds && showOverhang)) {
          const edgesGeo = new THREE.EdgesGeometry(boxGeo);
          const edgesLine = new THREE.LineSegments(
            edgesGeo,
            placed.isOutOfBounds && showOverhang ? warningEdgeMat : blackEdgeMat
          );
          edgesLine.rotation.y = placed.rotationY;
          itemGroup.add(edgesLine);
        }
      } else {
        // CYLINDER ITEM
        const radius = Math.max(0.02, ((item.diameter - 1.0) / 2) * SCALE);
        const cylH = Math.max(0.02, (item.height - 1.0) * SCALE);

        const bodyHex = item.customColor || '#5b84b1';
        const capHex = item.secondaryColor || '#9ab8d9';

        const bodyMat = new THREE.MeshStandardMaterial({
          color: bodyHex,
          roughness: 0.35,
          metalness: 0.25,
        });
        const capMat = new THREE.MeshStandardMaterial({
          color: capHex,
          roughness: 0.28,
          metalness: 0.3,
        });

        const cylGeo = new THREE.CylinderGeometry(radius, radius, cylH, 36, 1);
        const cylMesh = new THREE.Mesh(cylGeo, [bodyMat, capMat, capMat]);
        cylMesh.castShadow = !isSoftwareGl;
        cylMesh.receiveShadow = true;
        itemGroup.add(cylMesh);

        const showOverhang = viewer.showSpaceAnalysis && viewer.showOverhang;
        if (placed.isOutOfBounds && showOverhang) {
          const warnCylGeo = new THREE.CylinderGeometry(radius + 0.015, radius + 0.015, cylH + 0.015, 28, 1);
          const warnCylMesh = new THREE.Mesh(warnCylGeo, protrudeFillMat);
          warnCylMesh.renderOrder = 15;
          itemGroup.add(warnCylMesh);
        }

        if (viewer.showEdges || (placed.isOutOfBounds && showOverhang)) {
          const ringPts: THREE.Vector3[] = [];
          const segments = 48;
          for (let s = 0; s <= segments; s++) {
            const theta = (s / segments) * Math.PI * 2;
            ringPts.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
          }
          const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);

          const topRing = new THREE.Line(
            ringGeo,
            placed.isOutOfBounds && showOverhang ? warningEdgeMat : canEdgeMat
          );
          topRing.position.y = cylH / 2 + 0.002;
          itemGroup.add(topRing);

          const botRing = new THREE.Line(
            ringGeo.clone(),
            placed.isOutOfBounds && showOverhang ? warningEdgeMat : canEdgeMat
          );
          botRing.position.y = -cylH / 2 - 0.002;
          itemGroup.add(botRing);
        }
      }

      rootGroup.add(itemGroup);
      itemGroupsRef.current.push({
        group: itemGroup,
        data: placed,
        basePos,
      });
    }

    const activeClearance = viewer.showSpaceAnalysis && viewer.showClearance;
    const activeOverhang = viewer.showSpaceAnalysis && viewer.showOverhang;

    // 4. OUTER BOX / PALLET BOUNDARY CAGE (respects sizeDisplayMode: custom, calculated, both, off)
    const boxEnvelopeH = mode === 'carton' ? contH : Math.max(0.1, contH - palletH);
    const boxCenterY = mode === 'carton' ? boxEnvelopeH / 2 : palletH + boxEnvelopeH / 2;

    if (viewer.sizeDisplayMode !== 'off') {
      // (4A) User-Configured Size (사용자 설정 크기) Outer Frame / Box
      if (
        showCustomSize &&
        (mode === 'carton' ||
          viewer.showOuterBox ||
          viewer.sizeDisplayMode === 'both' ||
          activeClearance ||
          activeOverhang)
      ) {
        const outerGeo = new THREE.BoxGeometry(contW, boxEnvelopeH, contD);

        if (viewer.showOuterBox) {
          const outerMat = new THREE.MeshPhysicalMaterial({
            color: '#fef9c3',
            transparent: true,
            opacity: viewer.outerBoxOpacity,
            roughness: 0.2,
            metalness: 0.05,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const outerMesh = new THREE.Mesh(outerGeo, outerMat);
          outerMesh.position.y = boxCenterY;
          outerMesh.renderOrder = 10;
          rootGroup.add(outerMesh);
        }

        const frameColor =
          summary.hasOverhang && activeOverhang
            ? 0xef4444
            : viewer.sizeDisplayMode === 'both'
            ? 0xf59e0b
            : mode === 'carton'
            ? 0xf59e0b
            : 0x38bdf8;
        const frameEdgesGeo = new THREE.EdgesGeometry(outerGeo);
        const frameLineMat = new THREE.LineBasicMaterial({
          color: frameColor,
          linewidth: 2,
        });
        const frameLines = new THREE.LineSegments(frameEdgesGeo, frameLineMat);
        frameLines.position.y = boxCenterY;
        frameLines.renderOrder = 12;
        rootGroup.add(frameLines);
      }

      // (4B) Calculated Stack Size (계산된 적재 크기) Bounding Frame / Box
      if (showCalculatedSize) {
        const calcBoxGeo = new THREE.BoxGeometry(stackW, Math.max(0.05, stackH), stackD);
        const calcBoxCenterY = palletH + stackH / 2;

        if (viewer.sizeDisplayMode === 'calculated' && viewer.showOuterBox) {
          const outerMat = new THREE.MeshPhysicalMaterial({
            color: '#e0f2fe',
            transparent: true,
            opacity: viewer.outerBoxOpacity,
            roughness: 0.2,
            metalness: 0.05,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const calcOuterMesh = new THREE.Mesh(calcBoxGeo, outerMat);
          calcOuterMesh.position.set(stackCenterX, calcBoxCenterY, stackCenterZ);
          calcOuterMesh.renderOrder = 10;
          rootGroup.add(calcOuterMesh);
        }

        const calcEdgesGeo = new THREE.EdgesGeometry(calcBoxGeo);
        const calcLineMat = new THREE.LineBasicMaterial({
          color: 0x06b6d4, // Cyan for calculated size frame
          linewidth: 2,
        });
        const calcLines = new THREE.LineSegments(calcEdgesGeo, calcLineMat);
        calcLines.position.set(stackCenterX, calcBoxCenterY, stackCenterZ);
        calcLines.renderOrder = 13;
        rootGroup.add(calcLines);
      }
    }

    // 5. 3D INTERNAL CLEARANCE VOIDS (여유 공간 볼륨) & OVERHANG ZONES (벗어난 초과 볼륨)
    if (activeClearance || activeOverhang) {
      const spaceGroup = new THREE.Group();

      const clearanceMat = new THREE.MeshBasicMaterial({
        color: 0x10b981, // Emerald green for remaining usable internal space
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const clearanceEdgeMat = new THREE.LineBasicMaterial({
        color: 0x10b981,
      });

      const overhangMat = new THREE.MeshBasicMaterial({
        color: 0xef4444, // Crimson red for protruding overhang volume
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const overhangEdgeMat = new THREE.LineBasicMaterial({
        color: 0xef4444,
      });

      const activeStackH = Math.min(stackH, boxEnvelopeH);
      const activeStackCenterY = palletH + activeStackH / 2;

      // Stack min/max X and Z depending on alignment (centerItems vs corner flush)
      const stackMinX = arrangement.centerItems ? -stackW / 2 : -contW / 2;
      const stackMaxX = arrangement.centerItems ? stackW / 2 : -contW / 2 + stackW;
      const stackMinZ = arrangement.centerItems ? -stackD / 2 : -contD / 2;
      const stackMaxZ = arrangement.centerItems ? stackD / 2 : -contD / 2 + stackD;

      // (A) X-Axis Volumetric Box (가로 여유 또는 가로 초과 볼륨)
      if (summary.marginX > 2 && activeClearance) {
        const gapW = summary.marginX * SCALE;
        if (!arrangement.centerItems) {
          const voidGeo = new THREE.BoxGeometry(gapW, activeStackH, Math.min(contD, stackD));
          const voidMesh = new THREE.Mesh(voidGeo, clearanceMat);
          voidMesh.position.set(contW / 2 - gapW / 2, activeStackCenterY, (stackMinZ + Math.min(contD / 2, stackMaxZ)) / 2);
          voidMesh.renderOrder = 14;
          spaceGroup.add(voidMesh);

          const voidEdges = new THREE.LineSegments(new THREE.EdgesGeometry(voidGeo), clearanceEdgeMat);
          voidEdges.position.copy(voidMesh.position);
          spaceGroup.add(voidEdges);
        } else {
          const halfGapW = gapW / 2;
          for (const dir of [-1, 1]) {
            const voidGeo = new THREE.BoxGeometry(halfGapW, activeStackH, Math.min(contD, stackD));
            const voidMesh = new THREE.Mesh(voidGeo, clearanceMat);
            voidMesh.position.set(dir * (contW / 2 - halfGapW / 2), activeStackCenterY, 0);
            voidMesh.renderOrder = 14;
            spaceGroup.add(voidMesh);

            const voidEdges = new THREE.LineSegments(new THREE.EdgesGeometry(voidGeo), clearanceEdgeMat);
            voidEdges.position.copy(voidMesh.position);
            spaceGroup.add(voidEdges);
          }
        }
      } else if (summary.overhangX > 1 && activeOverhang) {
        const overW = summary.overhangX * SCALE;
        if (!arrangement.centerItems) {
          const overGeo = new THREE.BoxGeometry(overW, stackH, stackD);
          const overMesh = new THREE.Mesh(overGeo, overhangMat);
          overMesh.position.set(contW / 2 + overW / 2, palletH + stackH / 2, (stackMinZ + stackMaxZ) / 2);
          overMesh.renderOrder = 16;
          spaceGroup.add(overMesh);

          const overEdges = new THREE.LineSegments(new THREE.EdgesGeometry(overGeo), overhangEdgeMat);
          overEdges.position.copy(overMesh.position);
          spaceGroup.add(overEdges);
        } else {
          const halfOverW = overW / 2;
          for (const dir of [-1, 1]) {
            const overGeo = new THREE.BoxGeometry(halfOverW, stackH, stackD);
            const overMesh = new THREE.Mesh(overGeo, overhangMat);
            overMesh.position.set(dir * (contW / 2 + halfOverW / 2), palletH + stackH / 2, 0);
            overMesh.renderOrder = 16;
            spaceGroup.add(overMesh);

            const overEdges = new THREE.LineSegments(new THREE.EdgesGeometry(overGeo), overhangEdgeMat);
            overEdges.position.copy(overMesh.position);
            spaceGroup.add(overEdges);
          }
        }
      }

      // (B) Z-Axis Volumetric Box (세로 여유 또는 세로 초과 볼륨)
      if (summary.marginZ > 2 && activeClearance) {
        const gapD = summary.marginZ * SCALE;
        if (!arrangement.centerItems) {
          const voidGeo = new THREE.BoxGeometry(contW, activeStackH, gapD);
          const voidMesh = new THREE.Mesh(voidGeo, clearanceMat);
          voidMesh.position.set(0, activeStackCenterY, contD / 2 - gapD / 2);
          voidMesh.renderOrder = 14;
          spaceGroup.add(voidMesh);

          const voidEdges = new THREE.LineSegments(new THREE.EdgesGeometry(voidGeo), clearanceEdgeMat);
          voidEdges.position.copy(voidMesh.position);
          spaceGroup.add(voidEdges);
        } else {
          const halfGapD = gapD / 2;
          for (const dir of [-1, 1]) {
            const voidGeo = new THREE.BoxGeometry(contW, activeStackH, halfGapD);
            const voidMesh = new THREE.Mesh(voidGeo, clearanceMat);
            voidMesh.position.set(0, activeStackCenterY, dir * (contD / 2 - halfGapD / 2));
            voidMesh.renderOrder = 14;
            spaceGroup.add(voidMesh);

            const voidEdges = new THREE.LineSegments(new THREE.EdgesGeometry(voidGeo), clearanceEdgeMat);
            voidEdges.position.copy(voidMesh.position);
            spaceGroup.add(voidEdges);
          }
        }
      } else if (summary.overhangZ > 1 && activeOverhang) {
        const overD = summary.overhangZ * SCALE;
        if (!arrangement.centerItems) {
          const overGeo = new THREE.BoxGeometry(stackW, stackH, overD);
          const overMesh = new THREE.Mesh(overGeo, overhangMat);
          overMesh.position.set((stackMinX + stackMaxX) / 2, palletH + stackH / 2, contD / 2 + overD / 2);
          overMesh.renderOrder = 16;
          spaceGroup.add(overMesh);

          const overEdges = new THREE.LineSegments(new THREE.EdgesGeometry(overGeo), overhangEdgeMat);
          overEdges.position.copy(overMesh.position);
          spaceGroup.add(overEdges);
        } else {
          const halfOverD = overD / 2;
          for (const dir of [-1, 1]) {
            const overGeo = new THREE.BoxGeometry(stackW, stackH, halfOverD);
            const overMesh = new THREE.Mesh(overGeo, overhangMat);
            overMesh.position.set(0, palletH + stackH / 2, dir * (contD / 2 + halfOverD / 2));
            overMesh.renderOrder = 16;
            spaceGroup.add(overMesh);

            const overEdges = new THREE.LineSegments(new THREE.EdgesGeometry(overGeo), overhangEdgeMat);
            overEdges.position.copy(overMesh.position);
            spaceGroup.add(overEdges);
          }
        }
      }

      // (C) Y-Axis Volumetric Box (상단 높이 여유 또는 높이 초과 볼륨)
      if (summary.marginY > 2 && activeClearance) {
        const gapH = summary.marginY * SCALE;
        const topVoidGeo = new THREE.BoxGeometry(contW, gapH, contD);
        const topVoidMesh = new THREE.Mesh(topVoidGeo, clearanceMat);
        topVoidMesh.position.set(0, totalH + gapH / 2, 0);
        topVoidMesh.renderOrder = 14;
        spaceGroup.add(topVoidMesh);

        const topVoidEdges = new THREE.LineSegments(new THREE.EdgesGeometry(topVoidGeo), clearanceEdgeMat);
        topVoidEdges.position.copy(topVoidMesh.position);
        spaceGroup.add(topVoidEdges);
      } else if (summary.overhangY > 1 && activeOverhang) {
        const overH = summary.overhangY * SCALE;
        const topOverGeo = new THREE.BoxGeometry(stackW, overH, stackD);
        const topOverMesh = new THREE.Mesh(topOverGeo, overhangMat);
        topOverMesh.position.set(
          (stackMinX + stackMaxX) / 2,
          contH + overH / 2,
          (stackMinZ + stackMaxZ) / 2
        );
        topOverMesh.renderOrder = 16;
        spaceGroup.add(topOverMesh);

        const topOverEdges = new THREE.LineSegments(new THREE.EdgesGeometry(topOverGeo), overhangEdgeMat);
        topOverEdges.position.copy(topOverMesh.position);
        spaceGroup.add(topOverEdges);
      }

      rootGroup.add(spaceGroup);
    }

    // 6. UNIFIED 3-AXIS DIMENSION & MARGIN ANNOTATIONS
    // Groupsの設定/계산/여유·초과 together at 3 dedicated non-overlapping axis zones:
    // - 가로 (Width / X): Front (+Z) edge
    // - 세로 (Depth / Z): Right (+X) edge
    // - 높이 (Height / Y): Back-Right (+X, -Z) vertical edge
    const showDimLines = viewer.showDimensions && viewer.sizeDisplayMode !== 'off';
    if (showDimLines || activeClearance || activeOverhang) {
      const dimGroup = new THREE.Group();
      const maxSpan = Math.max(contW, contD, stackW, stackD, totalH, contH);
      const offsetDist = Math.max(0.75, Math.min(contW, contD) * 0.16);
      const baseBadgeW = Math.max(1.35, maxSpan * 0.175) * 1.65;
      const isBoth = viewer.sizeDisplayMode === 'both';

      const sMinX = stackCenterX - stackW / 2;
      const sMaxX = stackCenterX + stackW / 2;
      const sMinZ = stackCenterZ - stackD / 2;
      const sMaxZ = stackCenterZ + stackD / 2;

      const frontEdgeZ = showCustomSize && showCalculatedSize
        ? Math.max(contD / 2, sMaxZ)
        : showCalculatedSize
        ? sMaxZ
        : contD / 2;
      const rightEdgeX = showCustomSize && showCalculatedSize
        ? Math.max(contW / 2, sMaxX)
        : showCalculatedSize
        ? sMaxX
        : contW / 2;
      const backEdgeZ = showCustomSize && showCalculatedSize
        ? Math.min(-contD / 2, sMinZ)
        : showCalculatedSize
        ? sMinZ
        : -contD / 2;

      const customLineMat = new THREE.LineBasicMaterial({
        color: isBoth ? 0xf59e0b : isDarkBg ? 0x94a3b8 : 0x334155,
      });
      const calcLineMat = new THREE.LineBasicMaterial({
        color: 0x06b6d4,
      });

      const customBadgeVariant: BadgeVariant = isBoth
        ? 'custom-size'
        : isDarkBg
        ? 'neutral-dark'
        : 'neutral-light';

      // Helper to draw a dimension line with small perpendicular end ticks
      const addDimensionSegment = (
        p1: THREE.Vector3,
        p2: THREE.Vector3,
        tickDir: THREE.Vector3,
        mat: THREE.LineBasicMaterial
      ) => {
        const tickHalf = offsetDist * 0.12;
        const pts = [
          p1.clone().addScaledVector(tickDir, -tickHalf),
          p1.clone().addScaledVector(tickDir, tickHalf),
          p1,
          p2,
          p2.clone().addScaledVector(tickDir, -tickHalf),
          p2.clone().addScaledVector(tickDir, tickHalf),
        ];
        const segGeo = new THREE.BufferGeometry().setFromPoints([
          pts[0],
          pts[1],
          pts[2],
          pts[3],
          pts[4],
          pts[5],
        ]);
        dimGroup.add(new THREE.LineSegments(segGeo, mat));
      };

      // =========================================================
      // ZONE 1: 가로 (Width / X-Axis) — Grouped at Front (+Z)
      // =========================================================
      const widthRows: BadgeRowItem[] = [];
      if (showDimLines && showCustomSize) {
        widthRows.push({
          text: `가로 설정 ${summary.effectiveContainerWidth}mm`,
          variant: customBadgeVariant,
        });
        const lineZ = frontEdgeZ + offsetDist * (isBoth ? 0.58 : 0.48);
        addDimensionSegment(
          new THREE.Vector3(-contW / 2, 0.05, lineZ),
          new THREE.Vector3(contW / 2, 0.05, lineZ),
          new THREE.Vector3(0, 0, 1),
          customLineMat
        );
      }
      if (showDimLines && showCalculatedSize) {
        widthRows.push({
          text: `가로 계산 ${summary.stackWidth}mm`,
          variant: 'calculated-size',
        });
        const lineZ = frontEdgeZ + offsetDist * (isBoth ? 0.34 : 0.48);
        addDimensionSegment(
          new THREE.Vector3(sMinX, 0.05, lineZ),
          new THREE.Vector3(sMaxX, 0.05, lineZ),
          new THREE.Vector3(0, 0, 1),
          calcLineMat
        );
      }
      if (summary.marginX > 0 && activeClearance) {
        widthRows.push({
          text: `가로 여유 +${summary.marginX}mm`,
          variant: 'clearance',
        });
      } else if (summary.overhangX > 0 && activeOverhang) {
        widthRows.push({
          text: `가로 초과 -${summary.overhangX}mm`,
          variant: 'overhang',
        });
      }

      if (widthRows.length > 0) {
        const widthSprite = createAxisBadgeStackSprite(widthRows, maxAnisotropy, baseBadgeW);
        widthSprite.position.set(
          showCalculatedSize && !showCustomSize ? stackCenterX : 0,
          0.18,
          frontEdgeZ + offsetDist * 1.15
        );
        dimGroup.add(widthSprite);
      }

      // =========================================================
      // ZONE 2: 세로 (Depth / Z-Axis) — Grouped at Right (+X)
      // =========================================================
      const depthRows: BadgeRowItem[] = [];
      if (showDimLines && showCustomSize) {
        depthRows.push({
          text: `세로 설정 ${summary.effectiveContainerDepth}mm`,
          variant: customBadgeVariant,
        });
        const lineX = rightEdgeX + offsetDist * (isBoth ? 0.58 : 0.48);
        addDimensionSegment(
          new THREE.Vector3(lineX, 0.05, -contD / 2),
          new THREE.Vector3(lineX, 0.05, contD / 2),
          new THREE.Vector3(1, 0, 0),
          customLineMat
        );
      }
      if (showDimLines && showCalculatedSize) {
        depthRows.push({
          text: `세로 계산 ${summary.stackDepth}mm`,
          variant: 'calculated-size',
        });
        const lineX = rightEdgeX + offsetDist * (isBoth ? 0.34 : 0.48);
        addDimensionSegment(
          new THREE.Vector3(lineX, 0.05, sMinZ),
          new THREE.Vector3(lineX, 0.05, sMaxZ),
          new THREE.Vector3(1, 0, 0),
          calcLineMat
        );
      }
      if (summary.marginZ > 0 && activeClearance) {
        depthRows.push({
          text: `세로 여유 +${summary.marginZ}mm`,
          variant: 'clearance',
        });
      } else if (summary.overhangZ > 0 && activeOverhang) {
        depthRows.push({
          text: `세로 초과 -${summary.overhangZ}mm`,
          variant: 'overhang',
        });
      }

      if (depthRows.length > 0) {
        const depthSprite = createAxisBadgeStackSprite(depthRows, maxAnisotropy, baseBadgeW);
        depthSprite.position.set(
          rightEdgeX + offsetDist * 1.15,
          0.18,
          showCalculatedSize && !showCustomSize ? stackCenterZ : 0
        );
        dimGroup.add(depthSprite);
      }

      // =========================================================
      // ZONE 3: 높이 (Height / Y-Axis) — Grouped at Back-Right (+X, -Z)
      // =========================================================
      const heightRows: BadgeRowItem[] = [];
      if (showDimLines && showCustomSize) {
        heightRows.push({
          text: `높이 설정 ${summary.effectiveContainerHeight}mm`,
          variant: customBadgeVariant,
        });
        const lineX = rightEdgeX + offsetDist * (isBoth ? 0.58 : 0.48);
        addDimensionSegment(
          new THREE.Vector3(lineX, 0, backEdgeZ),
          new THREE.Vector3(lineX, contH, backEdgeZ),
          new THREE.Vector3(1, 0, 0),
          customLineMat
        );
      }
      if (showDimLines && showCalculatedSize) {
        heightRows.push({
          text: `높이 계산 ${summary.totalHeight}mm`,
          variant: 'calculated-size',
        });
        const lineX = rightEdgeX + offsetDist * (isBoth ? 0.34 : 0.48);
        addDimensionSegment(
          new THREE.Vector3(lineX, 0, backEdgeZ),
          new THREE.Vector3(lineX, totalH, backEdgeZ),
          new THREE.Vector3(1, 0, 0),
          calcLineMat
        );
      }
      if (summary.marginY > 0 && activeClearance) {
        heightRows.push({
          text: `높이 여유 +${summary.marginY}mm`,
          variant: 'clearance',
        });
      } else if (summary.overhangY > 0 && activeOverhang) {
        heightRows.push({
          text: `높이 초과 -${summary.overhangY}mm`,
          variant: 'overhang',
        });
      }

      if (heightRows.length > 0) {
        const heightSprite = createAxisBadgeStackSprite(heightRows, maxAnisotropy, baseBadgeW);
        const refHeight = showCustomSize && showCalculatedSize
          ? Math.max(contH, totalH)
          : showCalculatedSize
          ? totalH
          : contH;
        heightSprite.position.set(
          rightEdgeX + offsetDist * 1.25,
          Math.max(0.6, refHeight * 0.55),
          backEdgeZ
        );
        dimGroup.add(heightSprite);
      }

      rootGroup.add(dimGroup);
    }

    requestRenderRef.current();
  }, [mode, item, container, arrangement, summary, viewer]);

  // Camera Preset Handler
  const handleCameraPreset = (preset: 'iso' | 'front' | 'top' | 'side') => {
    onUpdateViewer({ cameraPreset: preset });
    const SCALE = 0.01;
    const maxSpan =
      Math.max(
        summary.effectiveContainerWidth,
        summary.effectiveContainerDepth,
        summary.stackWidth,
        summary.stackDepth,
        summary.totalHeight,
        summary.effectiveContainerHeight
      ) * SCALE;
    const centerH = Math.max(summary.totalHeight, summary.effectiveContainerHeight) * SCALE * 0.48;
    const dist = Math.max(8, maxSpan * 1.75);

    const lookTarget = new THREE.Vector3(0, centerH, 0);
    let camPos = new THREE.Vector3(dist * 0.95, centerH + dist * 0.72, dist * 0.95);

    if (preset === 'front') {
      camPos = new THREE.Vector3(0, centerH + dist * 0.15, dist * 1.45);
    } else if (preset === 'top') {
      camPos = new THREE.Vector3(0, dist * 1.65, 0.01);
    } else if (preset === 'side') {
      camPos = new THREE.Vector3(dist * 1.45, centerH + dist * 0.15, 0);
    }

    cameraTargetLookRef.current = lookTarget;
    cameraTargetPosRef.current = camPos;
    requestRenderRef.current();
  };

  // Directional Screen-Space Pan Helper
  const handlePanBy = (dx: number, dy: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    cameraTargetPosRef.current = null;
    cameraTargetLookRef.current = null;

    const dist = camera.position.distanceTo(controls.target);
    const step = Math.max(0.6, dist * 0.075);

    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());

    const offset = new THREE.Vector3()
      .addScaledVector(right, -dx * step)
      .addScaledVector(up, -dy * step);

    camera.position.add(offset);
    controls.target.add(offset);
    requestRenderRef.current();
  };

  // Reset Pan Target back to Container Center
  const handleResetPanCenter = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const SCALE = 0.01;
    const centerH =
      Math.max(summary.totalHeight, summary.effectiveContainerHeight) * SCALE * 0.48;
    const newTarget = new THREE.Vector3(0, centerH, 0);
    const delta = newTarget.clone().sub(controls.target);

    cameraTargetLookRef.current = newTarget;
    cameraTargetPosRef.current = camera.position.clone().add(delta);
    requestRenderRef.current();
  };

  useEffect(() => {
    handleCameraPreset(viewer.cameraPreset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const lastCaptureTriggerRef = useRef(0);

  useEffect(() => {
    if (captureTrigger === 0 || captureTrigger === lastCaptureTriggerRef.current) return;
    lastCaptureTriggerRef.current = captureTrigger;

    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;

    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `JS_Stack_Simulator_${mode}_${summary.effectiveContainerWidth}x${summary.effectiveContainerDepth}x${summary.totalHeight}.png`;
    link.href = dataUrl;
    link.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureTrigger]);

  const activeBgHex = resolveBackgroundHex(viewer);
  const isLightViewport = isColorLight(activeBgHex);

  const activeClearance = viewer.showSpaceAnalysis && viewer.showClearance;
  const activeOverhang = viewer.showSpaceAnalysis && viewer.showOverhang;

  const formatDiff = (diff: number) => {
    if (Math.abs(diff) <= 1) return { text: '정합 (0mm)', tone: 'text-blue-500' };
    if (diff > 0) {
      return activeClearance
        ? { text: `여유 +${diff}mm`, tone: 'text-emerald-500' }
        : { text: `여유 +${diff}mm (꺼짐)`, tone: 'text-slate-400' };
    }
    return activeOverhang
      ? { text: `초과 ${diff}mm`, tone: 'text-red-500' }
      : { text: `초과 ${diff}mm (꺼짐)`, tone: 'text-slate-400' };
  };

  const diffX = formatDiff(summary.marginX);
  const diffZ = formatDiff(summary.marginZ);
  const diffY = formatDiff(summary.marginY);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden select-none">
      {/* Isolated WebGL Canvas Mount */}
      <div
        ref={mountRef}
        className={`w-full h-full ${
          viewer.interactionMode === 'pan'
            ? 'cursor-move'
            : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      {/* Top-Left Spec & Real-Time Space / Overhang Inspector HUD with Instant On/Off Toggles */}
      <div
        className={`absolute top-4 left-4 z-10 pointer-events-auto rounded-xl px-4 py-3 border transition-colors max-w-lg ${
          isLightViewport
            ? 'bg-white/95 border-slate-300 text-slate-900 shadow-sm'
            : 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-lg'
        }`}
      >
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
          <span>
            {mode === 'pallet' ? '팔레트 규격 대비 적재 분석' : '외박스 내경 대비 포장 분석'}
          </span>
          <button
            onClick={() =>
              onUpdateArrangement({ centerItems: !arrangement.centerItems })
            }
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            {arrangement.centerItems ? '정렬: 중앙 대칭' : '정렬: 모서리 밀착'}
          </button>
        </div>

        <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
          <span className="text-lg font-bold tracking-tight font-mono">
            총 {summary.totalCount.toLocaleString()}개 적재
          </span>
          {viewer.sizeDisplayMode !== 'off' && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              {(viewer.sizeDisplayMode === 'custom' || viewer.sizeDisplayMode === 'both') && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                  설정: {summary.effectiveContainerWidth}×{summary.effectiveContainerDepth}×
                  {summary.effectiveContainerHeight}mm
                </span>
              )}
              {(viewer.sizeDisplayMode === 'calculated' || viewer.sizeDisplayMode === 'both') && (
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                  계산: {summary.stackWidth}×{summary.stackDepth}×{summary.totalHeight}mm
                </span>
              )}
            </div>
          )}
        </div>

        {/* 4-Way Selector: 팔레트 / 외박스 크기 표시 (사용자 설정 크기 | 계산된 크기 | 둘다 | 모두 OFF) */}
        <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">
              {mode === 'pallet' ? '팔레트 크기 표시 기준:' : '외박스 크기 표시 기준:'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-lg">
            {(
              [
                { id: 'custom', label: '사용자 설정 크기' },
                { id: 'calculated', label: '계산된 크기' },
                { id: 'both', label: '둘다 표시' },
                { id: 'off', label: '모두 OFF' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() =>
                  onUpdateViewer({
                    sizeDisplayMode: opt.id,
                    showDimensions: opt.id !== 'off',
                  })
                }
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  viewer.sizeDisplayMode === opt.id
                    ? opt.id === 'custom'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : opt.id === 'calculated'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : opt.id === 'both'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Direct On/Off Toggles for Clearance (여유) and Overhang (초과) */}
        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500">
            여유·초과 표시:
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() =>
                onUpdateViewer({
                  showSpaceAnalysis: true,
                  showClearance: !activeClearance,
                })
              }
              className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                activeClearance
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
              }`}
            >
              여유 표시 {activeClearance ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() =>
                onUpdateViewer({
                  showSpaceAnalysis: true,
                  showOverhang: !activeOverhang,
                })
              }
              className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                activeOverhang
                  ? 'bg-red-600 text-white border-red-500'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
              }`}
            >
              초과 표시 {activeOverhang ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => {
                const nextAll = !(activeClearance || activeOverhang);
                onUpdateViewer({
                  showSpaceAnalysis: nextAll,
                  showClearance: nextAll,
                  showOverhang: nextAll,
                });
              }}
              className="px-2 py-1 rounded-md text-[11px] font-medium border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {activeClearance || activeOverhang ? '모두 끄기' : '모두 켜기'}
            </button>
          </div>
        </div>

        {/* 3-Axis Space Margin / Overhang Breakdown */}
        {(activeClearance || activeOverhang) && (
          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <div className="text-[10px] text-slate-400 font-sans">가로(X) 공간</div>
              <div className={`font-bold ${diffX.tone}`}>{diffX.text}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-sans">세로(Z) 공간</div>
              <div className={`font-bold ${diffZ.tone}`}>{diffZ.text}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-sans">높이(Y) 공간</div>
              <div className={`font-bold ${diffY.tone}`}>{diffY.text}</div>
            </div>
          </div>
        )}
      </div>

      {/* Top-Right 3D Pan, Camera & Background Color Control Widget */}
      <div
        className={`absolute top-4 right-4 z-10 pointer-events-auto rounded-xl p-2.5 border transition-colors flex flex-col gap-2.5 ${
          isLightViewport
            ? 'bg-white/95 border-slate-300 text-slate-900 shadow-sm'
            : 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-lg'
        }`}
      >
        {/* Left-Click Mode Switch: Orbit vs Pan */}
        <div className="grid grid-cols-2 gap-1 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => onUpdateViewer({ interactionMode: 'orbit' })}
            className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              viewer.interactionMode === 'orbit'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="마우스 좌클릭 드래그로 3D 회전"
          >
            <Rotate3d className="w-3.5 h-3.5" />
            <span>회전</span>
          </button>
          <button
            onClick={() => onUpdateViewer({ interactionMode: 'pan' })}
            className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              viewer.interactionMode === 'pan'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="마우스 좌클릭 드래그로 3D 화면 이동 (Pan)"
          >
            <Hand className="w-3.5 h-3.5" />
            <span>이동(Pan)</span>
          </button>
        </div>

        {/* Directional Pan D-Pad + Center Reset */}
        <div className="flex items-center justify-between gap-2">
          <div className="grid grid-cols-3 gap-1 w-24">
            <div />
            <button
              onClick={() => handlePanBy(0, 1)}
              className="h-7 flex items-center justify-center rounded bg-slate-200/80 dark:bg-slate-800 hover:bg-blue-600 hover:text-white transition-colors"
              title="위로 화면 이동 (Pan Up)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <div />
            <button
              onClick={() => handlePanBy(-1, 0)}
              className="h-7 flex items-center justify-center rounded bg-slate-200/80 dark:bg-slate-800 hover:bg-blue-600 hover:text-white transition-colors"
              title="왼쪽으로 화면 이동 (Pan Left)"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetPanCenter}
              className="h-7 flex items-center justify-center rounded bg-blue-600/15 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-colors"
              title="화면 중앙 원점으로 시점 복귀"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handlePanBy(1, 0)}
              className="h-7 flex items-center justify-center rounded bg-slate-200/80 dark:bg-slate-800 hover:bg-blue-600 hover:text-white transition-colors"
              title="오른쪽으로 화면 이동 (Pan Right)"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <div />
            <button
              onClick={() => handlePanBy(0, -1)}
              className="h-7 flex items-center justify-center rounded bg-slate-200/80 dark:bg-slate-800 hover:bg-blue-600 hover:text-white transition-colors"
              title="아래로 화면 이동 (Pan Down)"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <div />
          </div>

          <div className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 max-w-[115px]">
            <div className="font-semibold text-slate-700 dark:text-slate-200">
              {viewer.interactionMode === 'pan' ? '좌클릭: Pan 이동' : '좌클릭: 3D 회전'}
            </div>
            <div>우클릭·Space+드래그·방향키로도 Pan 이동</div>
          </div>
        </div>

        {/* 3D Viewport Background Color Selector (프리셋 + 사용자 지정 컬러 피커) */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 font-semibold text-slate-500">
              <Palette className="w-3.5 h-3.5" />
              <span>3D 뷰 바탕색</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400 uppercase">
              {activeBgHex}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1.5">
            {BG_PRESETS.map((preset) => {
              const active = viewer.backgroundStyle === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => onUpdateViewer({ backgroundStyle: preset.id })}
                  title={preset.label}
                  className={`w-6 h-6 rounded-md border transition-transform ${
                    active
                      ? 'ring-2 ring-blue-500 scale-110 border-white'
                      : 'border-slate-400/60 hover:scale-105'
                  }`}
                  style={{ backgroundColor: preset.color }}
                />
              );
            })}
            <label
              title="바탕색 직접 선택"
              className={`relative flex items-center justify-center w-7 h-6 rounded-md border cursor-pointer overflow-hidden ${
                viewer.backgroundStyle === 'custom'
                  ? 'ring-2 ring-blue-500 border-white'
                  : 'border-slate-400/60 hover:border-blue-400'
              }`}
              style={{ backgroundColor: viewer.customBgColor || '#d8dee9' }}
            >
              <input
                type="color"
                value={viewer.customBgColor || '#d8dee9'}
                onChange={(e) =>
                  onUpdateViewer({
                    backgroundStyle: 'custom',
                    customBgColor: e.target.value,
                  })
                }
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              />
              <span className="text-[9px] font-bold px-1 rounded bg-black/55 text-white pointer-events-none">
                직접
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Selected Item Inspection Popover */}
      {selectedItem && (
        <div
          className={`absolute top-44 right-4 z-10 pointer-events-auto rounded-xl px-4 py-3 border max-w-xs ${
            isLightViewport
              ? 'bg-white/95 border-slate-300 text-slate-900 shadow-sm'
              : 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-lg'
          }`}
        >
          <div className="flex items-center justify-between gap-4 mb-1">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              선택된 물품 좌표 정보
            </span>
            <button
              onClick={() => setSelectedItem(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              닫기
            </button>
          </div>
          <div className="text-xs space-y-1 font-mono">
            <div>
              위치: {selectedItem.layer + 1}층 · {selectedItem.row + 1}행 · {selectedItem.col + 1}열
            </div>
            <div>
              중심좌표: X {Math.round(selectedItem.x)}, Y {Math.round(selectedItem.y)}, Z{' '}
              {Math.round(selectedItem.z)} mm
            </div>
            <div>
              상태:{' '}
              {selectedItem.isOutOfBounds ? (
                <span className="text-red-500 font-bold">용기/팔레트 경계 이탈</span>
              ) : (
                <span className="text-emerald-500 font-bold">정상 수납 범위 내</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto w-full max-w-[1160px] px-4 transition-transform duration-200"
        style={{
          transform: dockCollapsed ? 'translate(-50%, calc(100% - 34px))' : 'translate(-50%, 0)',
        }}
      >
        <div className="flex justify-center mb-1">
          <button
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-t-lg text-xs font-medium bg-slate-900 text-slate-200 border border-b-0 border-slate-700 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>3D 뷰어 컨트롤 펼치기</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>컨트롤 접기</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl px-4 py-3 text-slate-100 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* 1. Orbit vs Pan Mode + Camera View Presets */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => onUpdateViewer({ interactionMode: 'orbit' })}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewer.interactionMode === 'orbit'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Rotate3d className="w-3.5 h-3.5" />
                  <span>회전</span>
                </button>
                <button
                  onClick={() => onUpdateViewer({ interactionMode: 'pan' })}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewer.interactionMode === 'pan'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Hand className="w-3.5 h-3.5" />
                  <span>Pan 이동</span>
                </button>
              </div>

              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg">
                {(
                  [
                    { id: 'iso', label: '입체(3D)' },
                    { id: 'front', label: '정면' },
                    { id: 'side', label: '측면' },
                    { id: 'top', label: '평면(위)' },
                  ] as const
                ).map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => handleCameraPreset(cam.id)}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      viewer.cameraPreset === cam.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Exploded View Slider & Layer Scrubber */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Move3d className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs font-medium text-slate-300 whitespace-nowrap shrink-0">
                  분해
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={viewer.explodedFactor}
                  onChange={(e) => onUpdateViewer({ explodedFactor: parseFloat(e.target.value) })}
                  className="w-16 accent-blue-500 cursor-pointer"
                />
                <span className="text-xs font-mono text-slate-400 w-7 text-right">
                  {Math.round(viewer.explodedFactor * 100)}%
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-medium text-slate-300 whitespace-nowrap shrink-0">
                  단수
                </span>
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, summary.totalLayers)}
                  step={1}
                  value={Math.min(viewer.visibleLayers, summary.totalLayers)}
                  onChange={(e) => onUpdateViewer({ visibleLayers: parseInt(e.target.value, 10) })}
                  className="w-14 accent-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-mono text-slate-300 whitespace-nowrap">
                  {Math.min(viewer.visibleLayers, summary.totalLayers)}/{summary.totalLayers}
                </span>
              </div>
            </div>

            {/* 3. Size Display Mode Selector (사용자 설정 | 계산된 크기 | 둘다 | OFF) */}
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg">
              <Ruler className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5 shrink-0" />
              {(
                [
                  { id: 'custom', label: '설정 크기' },
                  { id: 'calculated', label: '계산 크기' },
                  { id: 'both', label: '둘다' },
                  { id: 'off', label: '크기 OFF' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() =>
                    onUpdateViewer({
                      sizeDisplayMode: opt.id,
                      showDimensions: opt.id !== 'off',
                    })
                  }
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewer.sizeDisplayMode === opt.id
                      ? opt.id === 'custom'
                        ? 'bg-amber-600 text-white'
                        : opt.id === 'calculated'
                        ? 'bg-cyan-600 text-white'
                        : opt.id === 'both'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 4. Quick Toggles (여유 표시, 초과 표시, 정렬, 외박스) */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  onUpdateViewer({
                    showSpaceAnalysis: true,
                    showClearance: !activeClearance,
                  })
                }
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  activeClearance
                    ? 'bg-emerald-600/25 border-emerald-500/60 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Scan className="w-3.5 h-3.5" />
                <span>여유 {activeClearance ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={() =>
                  onUpdateViewer({
                    showSpaceAnalysis: true,
                    showOverhang: !activeOverhang,
                  })
                }
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  activeOverhang
                    ? 'bg-red-600/25 border-red-500/60 text-red-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>초과 {activeOverhang ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={() =>
                  onUpdateArrangement({ centerItems: !arrangement.centerItems })
                }
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  !arrangement.centerItems
                    ? 'bg-indigo-600/25 border-indigo-500/60 text-indigo-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>{arrangement.centerItems ? '중앙 정렬' : '모서리 밀착'}</span>
              </button>

              <button
                onClick={() => onUpdateViewer({ showOuterBox: !viewer.showOuterBox })}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  viewer.showOuterBox
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>외박스</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
