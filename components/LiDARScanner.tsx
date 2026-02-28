'use client';

// ─────────────────────────────────────────────────────────────────────────────
//  LiDARScanner — WebXR depth-sensing AR component
//  Requires: Safari 16+ on a LiDAR-equipped iPhone (12 Pro+) or iPad Pro
//  Features:
//    • Real-time depth map rendered with turbo colormap overlay
//    • Hit-test surface detection with animated reticle
//    • Task card placement anchored to real-world surfaces
//    • Floating 3D task billboards rendered with Three.js
//    • DOM-overlay UI for task selection and controls
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react';
import { Scan, X, ChevronUp, ChevronDown, Crosshair, Info } from 'lucide-react';
import { Task, getTasks, saveTasks, getPriorityColor } from '@/lib/tasks';

// ── Turbo colormap ────────────────────────────────────────────────────────────
// Key anchors for Google's Turbo colormap (near=warm, far=cool)
const TURBO_ANCHORS: [number, number, number, number][] = [
  [0.0,  48,  18,  59],
  [0.1,  72,  84, 185],
  [0.2,  46, 147, 229],
  [0.3,  29, 197, 177],
  [0.4,  71, 227, 105],
  [0.5, 163, 239,  40],
  [0.6, 233, 225,  40],
  [0.7, 253, 167,  14],
  [0.8, 237,  89,  12],
  [0.9, 195,  27,   0],
  [1.0, 122,   4,   3],
];

function turboColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < TURBO_ANCHORS.length - 1; i++) {
    const [t0, r0, g0, b0] = TURBO_ANCHORS[i];
    const [t1, r1, g1, b1] = TURBO_ANCHORS[i + 1];
    if (clamped >= t0 && clamped <= t1) {
      const s = (clamped - t0) / (t1 - t0);
      return [
        Math.round(r0 + s * (r1 - r0)),
        Math.round(g0 + s * (g1 - g0)),
        Math.round(b0 + s * (b1 - b0)),
      ];
    }
  }
  return [122, 4, 3];
}

// ── Draw a task card onto a canvas (used for Three.js CanvasTexture) ─────────
function drawTaskCard(
  canvas: HTMLCanvasElement,
  task: Task,
  maxDepth: number,
): void {
  const W = 512;
  const H = 256;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const priorityColor = getPriorityColor(task.priority);

  // Background
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, 'rgba(12, 12, 32, 0.92)');
  bg.addColorStop(1, 'rgba(4, 20, 40, 0.92)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 24);
  ctx.fill();

  // Priority accent bar
  ctx.fillStyle = priorityColor;
  ctx.shadowColor = priorityColor;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.roundRect(0, 0, 8, H, [24, 0, 0, 24]);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Outer glow border
  ctx.strokeStyle = priorityColor + '66';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1, 1, W - 2, H - 2, 23);
  ctx.stroke();

  // Priority badge
  ctx.fillStyle = priorityColor + '33';
  ctx.beginPath();
  ctx.roundRect(24, 20, 90, 28, 14);
  ctx.fill();
  ctx.fillStyle = priorityColor;
  ctx.font = 'bold 14px -apple-system, system-ui, sans-serif';
  ctx.fillText(task.priority.toUpperCase(), 36, 39);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px -apple-system, system-ui, sans-serif';
  const maxTitleWidth = W - 60;
  let title = task.title;
  while (ctx.measureText(title).width > maxTitleWidth && title.length > 0) {
    title = title.slice(0, -1);
  }
  if (title !== task.title) title += '…';
  ctx.fillText(title, 24, 90);

  // Description
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '16px -apple-system, system-ui, sans-serif';
  let desc = task.description;
  while (ctx.measureText(desc).width > maxTitleWidth && desc.length > 0) {
    desc = desc.slice(0, -1);
  }
  if (desc !== task.description) desc += '…';
  ctx.fillText(desc, 24, 118);

  // Separator
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 140);
  ctx.lineTo(W - 24, 140);
  ctx.stroke();

  // Category
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '14px -apple-system, system-ui, sans-serif';
  ctx.fillText(`📁 ${task.category}`, 24, 170);

  // Depth indicator
  ctx.fillStyle = 'rgba(0,212,255,0.6)';
  ctx.fillText(`◎ ${maxDepth.toFixed(1)}m away`, W - 150, 170);

  // Corner decoration
  ctx.strokeStyle = 'rgba(0,212,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W - 30, H - 30);
  ctx.lineTo(W - 10, H - 30);
  ctx.lineTo(W - 10, H - 10);
  ctx.stroke();
}

// ── Types ────────────────────────────────────────────────────────────────────
interface PlacedTask {
  taskId: string;
  position: [number, number, number];
  meshId: string;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LiDARScanner() {
  // Refs for Three.js objects (don't trigger re-renders)
  const containerRef = useRef<HTMLDivElement>(null);
  const depthCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<import('three').WebGLRenderer | null>(null);
  const sceneRef = useRef<import('three').Scene | null>(null);
  const cameraRef = useRef<import('three').Camera | null>(null);
  const reticleRef = useRef<import('three').Mesh | null>(null);
  const hitTestSourceRef = useRef<XRHitTestSource | null>(null);
  const hitTestSourceRequestedRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);
  const taskMeshesRef = useRef<Map<string, import('three').Mesh>>(new Map());
  const clockRef = useRef<import('three').Clock | null>(null);
  const depthWorkerRef = useRef<Worker | null>(null);

  // React state (drives UI)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isARSupported, setIsARSupported] = useState<boolean | null>(null);
  const [isARActive, setIsARActive] = useState(false);
  const [depthEnabled, setDepthEnabled] = useState(false);
  const [depthOpacity, setDepthOpacity] = useState(50);
  const [placedTasks, setPlacedTasks] = useState<PlacedTask[]>([]);
  const [reticleVisible, setReticleVisible] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Point camera at a flat surface');
  const [taskPanelOpen, setTaskPanelOpen] = useState(true);

  // ── Load tasks on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    setTasks(getTasks().filter((t) => !t.completed));
  }, []);

  // ── Check WebXR AR support ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.xr) {
      navigator.xr
        .isSessionSupported('immersive-ar')
        .then((supported) => setIsARSupported(supported))
        .catch(() => setIsARSupported(false));
    } else {
      setIsARSupported(false);
    }
  }, []);

  // ── Render depth data as turbo colormap onto the overlay canvas ─────────────
  const renderDepthMap = useCallback(
    (depthInfo: XRCPUDepthInformation) => {
      const canvas = depthCanvasRef.current;
      if (!canvas) return;

      const { width, height, rawValueToMeters } = depthInfo;
      const NEAR = 0.1;
      const FAR = 5.0; // depth range in meters

      // Resize canvas to match depth buffer
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const imageData = ctx.createImageData(width, height);
      const buf = new Uint8ClampedArray(imageData.data.buffer);

      // The raw data buffer (luminance-alpha or float32)
      const rawData = new DataView((depthInfo as unknown as { data: ArrayBuffer }).data);
      const isFloat = rawValueToMeters < 0.01; // float32 uses small scale

      for (let i = 0; i < width * height; i++) {
        let depthMeters: number;
        if (isFloat) {
          depthMeters = rawData.getFloat32(i * 4, true);
        } else {
          depthMeters = (rawData.getUint8(i * 2) + rawData.getUint8(i * 2 + 1) * 256)
            * rawValueToMeters;
        }
        const normalized = Math.max(0, Math.min(1, (depthMeters - NEAR) / (FAR - NEAR)));
        const [r, g, b] = turboColor(normalized);
        buf[i * 4 + 0] = r;
        buf[i * 4 + 1] = g;
        buf[i * 4 + 2] = b;
        buf[i * 4 + 3] = 160; // semi-transparent
      }

      ctx.putImageData(imageData, 0, 0);
    },
    [],
  );

  // ── Draw a floating task billboard in the AR scene ──────────────────────────
  const createTaskMesh = useCallback(
    async (
      THREE: typeof import('three'),
      task: Task,
      position: import('three').Vector3,
    ): Promise<import('three').Mesh> => {
      const canvas = document.createElement('canvas');
      drawTaskCard(canvas, task, position.length());

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;

      const geometry = new THREE.PlaneGeometry(0.5, 0.25);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.position.y += 0.3; // float above surface

      // Add a subtle glow ring beneath it
      const ringGeo = new THREE.RingGeometry(0.26, 0.28, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(getPriorityColor(task.priority)),
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      ringGeo.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(position);
      ring.position.y += 0.01;

      sceneRef.current?.add(ring);
      sceneRef.current?.add(mesh);

      return mesh;
    },
    [],
  );

  // ── Place selected task at the current reticle position ────────────────────
  const placeTask = useCallback(async () => {
    if (!selectedTask || !reticleRef.current || !reticleRef.current.visible) {
      setStatusMsg('Aim at a surface first!');
      return;
    }

    const THREE = await import('three');
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    reticleRef.current.matrix.decompose(pos, quat, scale);

    const mesh = await createTaskMesh(THREE, selectedTask, pos);
    const meshId = `mesh_${selectedTask.id}_${Date.now()}`;
    taskMeshesRef.current.set(meshId, mesh);

    // Mark task as AR placed
    const updatedTasks = tasks.map((t) =>
      t.id === selectedTask.id ? { ...t, arPlaced: true } : t,
    );
    saveTasks(updatedTasks);
    setTasks(updatedTasks.filter((t) => !t.completed));

    setPlacedTasks((prev) => [
      ...prev,
      { taskId: selectedTask.id, position: [pos.x, pos.y, pos.z], meshId },
    ]);

    setStatusMsg(`"${selectedTask.title}" placed in AR!`);
    setSelectedTask(null);

    setTimeout(() => setStatusMsg('Point camera at a flat surface'), 3000);
  }, [selectedTask, tasks, createTaskMesh]);

  // ── Initialize Three.js renderer ────────────────────────────────────────────
  const initThreeJS = useCallback(async () => {
    if (!containerRef.current) return null;

    const THREE = await import('three');

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    rendererRef.current = renderer;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.01,
      30,
    );
    cameraRef.current = camera;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Clock for animations
    clockRef.current = new THREE.Clock();

    // Lighting
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(0.5, 1, 0.25);
    scene.add(dir);

    // Reticle — animated ring showing surface hit point
    const reticleGroup = new THREE.Group();

    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.135, 48),
      new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      }),
    );
    outerRing.geometry.rotateX(-Math.PI / 2);
    reticleGroup.add(outerRing);

    const innerDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.03, 24),
      new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      }),
    );
    innerDot.geometry.rotateX(-Math.PI / 2);
    reticleGroup.add(innerDot);

    // Crosshair spokes
    const spokeGeo = new THREE.PlaneGeometry(0.22, 0.003);
    spokeGeo.rotateX(-Math.PI / 2);
    const spokeMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const spoke1 = new THREE.Mesh(spokeGeo, spokeMat);
    const spoke2 = new THREE.Mesh(spokeGeo.clone(), spokeMat.clone());
    spoke2.rotation.y = Math.PI / 2;
    reticleGroup.add(spoke1, spoke2);

    reticleGroup.matrixAutoUpdate = false;
    reticleGroup.visible = false;
    scene.add(reticleGroup);
    reticleRef.current = reticleGroup as unknown as import('three').Mesh;

    return { renderer, scene, camera, THREE };
  }, []);

  // ── Start the WebXR AR session ───────────────────────────────────────────────
  const startAR = useCallback(async () => {
    if (!navigator.xr) return;

    const init = await initThreeJS();
    if (!init) return;
    const { renderer, scene, camera, THREE } = init;

    try {
      const overlayEl = document.getElementById('ar-dom-overlay');
      const sessionInit: XRSessionInit = {
        requiredFeatures: ['hit-test'],
        optionalFeatures: [
          'depth-sensing',
          'dom-overlay',
          'light-estimation',
          'anchors',
        ],
        depthSensing: {
          usagePreference: ['cpu-optimized', 'gpu-optimized'],
          dataFormatPreference: ['float32', 'luminance-alpha'],
        },
        ...(overlayEl ? { domOverlay: { root: overlayEl } } : {}),
      };

      const session = await navigator.xr.requestSession('immersive-ar', sessionInit);

      const depthSupported =
        (session as unknown as Record<string, unknown>).depthUsage !== undefined;
      setDepthEnabled(depthSupported);

      await renderer.xr.setSession(session);
      setIsARActive(true);
      hitTestSourceRequestedRef.current = false;

      // ── Render / animation loop ─────────────────────────────────────────────
      renderer.setAnimationLoop((_, frame) => {
        if (!frame) return;

        const refSpace = renderer.xr.getReferenceSpace();
        const xrSession = renderer.xr.getSession();
        if (!refSpace || !xrSession) return;

        const elapsed = clockRef.current?.getElapsedTime() ?? 0;

        // 1. Request hit-test source once
        if (!hitTestSourceRequestedRef.current) {
          xrSession
            .requestReferenceSpace('viewer')
            .then((viewerSpace) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (xrSession as any).requestHitTestSource({ space: viewerSpace }),
            )
            .then((source) => {
              hitTestSourceRef.current = source;
            })
            .catch(() => {});
          hitTestSourceRequestedRef.current = true;

          xrSession.addEventListener('end', () => {
            hitTestSourceRef.current = null;
            hitTestSourceRequestedRef.current = false;
          });
        }

        // 2. Update reticle from hit-test
        if (hitTestSourceRef.current && reticleRef.current) {
          const hits = frame.getHitTestResults(hitTestSourceRef.current);
          if (hits.length > 0) {
            const pose = hits[0].getPose(refSpace);
            if (pose) {
              reticleRef.current.visible = true;
              reticleRef.current.matrix.fromArray(pose.transform.matrix);
              // Pulse animation
              const scale = 0.9 + 0.1 * Math.sin(elapsed * 3);
              reticleRef.current.matrix.scale(new THREE.Vector3(scale, 1, scale));
              setReticleVisible(true);
            }
          } else {
            reticleRef.current.visible = false;
            setReticleVisible(false);
          }
        }

        // 3. Depth sensing — render colormap overlay
        const pose = frame.getViewerPose(refSpace);
        if (pose) {
          for (const view of pose.views) {
            const depthInfo = frame.getDepthInformation(view);
            if (depthInfo) {
              setDepthEnabled(true);
              renderDepthMap(depthInfo);
            }
          }
        }

        // 4. Animate placed task cards (float + billboard)
        taskMeshesRef.current.forEach((mesh) => {
          mesh.position.y += Math.sin(elapsed * 1.2 + mesh.position.x * 5) * 0.0003;
          // Billboard toward camera
          if (cameraRef.current) {
            mesh.quaternion.copy(cameraRef.current.quaternion);
          }
        });

        renderer.render(scene, camera);
      });

      session.addEventListener('end', () => {
        setIsARActive(false);
        setDepthEnabled(false);
        setReticleVisible(false);
        renderer.setAnimationLoop(null);
        // Clean up Three.js canvas
        const canvas = renderer.domElement;
        canvas.parentNode?.removeChild(canvas);
        renderer.dispose();
        rendererRef.current = null;
        sceneRef.current = null;
      });
    } catch (err) {
      console.error('WebXR session failed:', err);
      setIsARActive(false);
      // Clean up on failure
      const canvas = renderer.domElement;
      canvas.parentNode?.removeChild(canvas);
      renderer.dispose();
      rendererRef.current = null;
    }
  }, [initThreeJS, renderDepthMap]);

  // ── End AR session ──────────────────────────────────────────────────────────
  const endAR = useCallback(() => {
    const session = rendererRef.current?.xr?.getSession?.();
    if (session) {
      session.end().catch(() => {});
    } else {
      setIsARActive(false);
    }
  }, []);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      endAR();
    };
  }, [endAR]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Not-in-AR landing ────────────────────────────────────────────────────────
  if (!isARActive) {
    return (
      <div className="relative min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 depth-grid" />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/40 via-black to-cyan-950/30" />
        <div className="lidar-scan-line" />

        {/* Glow orbs */}
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 text-center px-6 max-w-lg">
          {/* AR icon */}
          <div className="mx-auto w-24 h-24 mb-8 relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20 border border-cyan-500/30 animate-pulse-glow" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Scan size={44} className="text-cyan-400" />
            </div>
          </div>

          <h1 className="text-4xl font-black mb-3 gradient-text">AR Mode</h1>
          <p className="text-white/60 mb-2 text-base leading-relaxed">
            Place tasks in your physical space with LiDAR depth sensing.
          </p>

          {isARSupported === false && (
            <div className="my-6 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm">
              <strong>WebXR not supported</strong>
              <br />
              Open this page in <strong>Safari on iOS 16+</strong> with an
              <strong> iPhone 12 Pro</strong> or <strong>iPad Pro</strong> for LiDAR support.
            </div>
          )}

          {isARSupported === true && (
            <>
              <div className="my-6 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400/80 text-sm leading-relaxed">
                ✓ WebXR AR is supported on this device
                <br />
                Point at a flat surface and tap to place tasks
              </div>

              {/* Depth preview — simulated colormap when not in AR */}
              <div className="my-4 rounded-2xl overflow-hidden border border-white/10" style={{ height: 80 }}>
                <canvas
                  id="depth-preview"
                  className="w-full h-full"
                  ref={(el) => {
                    if (!el) return;
                    const ctx = el.getContext('2d');
                    if (!ctx) return;
                    el.width = 300;
                    el.height = 80;
                    // Draw simulated depth gradient as preview
                    for (let x = 0; x < 300; x++) {
                      const [r, g, b] = turboColor(x / 300);
                      ctx.fillStyle = `rgb(${r},${g},${b})`;
                      ctx.fillRect(x, 0, 1, 80);
                    }
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.fillRect(0, 0, 300, 80);
                    ctx.fillStyle = 'rgba(255,255,255,0.5)';
                    ctx.font = '11px system-ui';
                    ctx.fillText('NEAR', 8, 50);
                    ctx.fillText('FAR', 268, 50);
                    ctx.fillStyle = 'rgba(255,255,255,0.7)';
                    ctx.font = 'bold 13px system-ui';
                    ctx.fillText('LiDAR Depth Preview (Turbo colormap)', 60, 44);
                  }}
                />
              </div>
            </>
          )}

          <button
            onClick={startAR}
            disabled={isARSupported === false || isARSupported === null}
            className="w-full py-4 rounded-2xl font-bold text-lg text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #00d4ff 0%, #8b5cf6 100%)',
              boxShadow: isARSupported ? '0 0 60px rgba(0,212,255,0.4)' : 'none',
            }}
          >
            {isARSupported === null
              ? 'Checking device…'
              : isARSupported
              ? '⬡  Enter AR Space'
              : 'Not Supported'}
          </button>

          {isARSupported === null && (
            <p className="text-white/30 text-xs mt-3">Querying WebXR capability…</p>
          )}
        </div>
      </div>
    );
  }

  // ── Active AR view ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-transparent" ref={containerRef}>
      {/* Three.js canvas rendered here by initThreeJS */}

      {/* Depth overlay canvas */}
      <canvas
        ref={depthCanvasRef}
        className="depth-canvas absolute inset-0 w-full h-full pointer-events-none transition-opacity"
        style={{
          opacity: depthEnabled ? depthOpacity / 100 : 0,
          imageRendering: 'pixelated',
        }}
      />

      {/* DOM Overlay — lives above the AR canvas */}
      <div id="ar-dom-overlay" className="absolute inset-0 pointer-events-none">
        {/* ── Top bar ── */}
        <div className="pointer-events-auto absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12 pb-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-400 text-sm font-bold">AR MODE</span>
            {depthEnabled && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-500/40 text-purple-400 ml-1">
                LiDAR
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInfo((v) => !v)}
              className="p-2 rounded-full glass border border-white/10"
            >
              <Info size={16} className="text-white/60" />
            </button>
            <button
              onClick={endAR}
              className="p-2 rounded-full bg-red-500/20 border border-red-500/30 text-red-400"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Info panel ── */}
        {showInfo && (
          <div className="pointer-events-auto absolute top-24 right-4 w-64 glass-strong rounded-2xl p-4 border border-white/10 text-xs text-white/70 space-y-2">
            <p className="font-bold text-white mb-1">LiDAR Controls</p>
            <p>• Point at flat surface → reticle appears</p>
            <p>• Select task below → tap ⊕ Place</p>
            <p>• Depth overlay: turbo colormap (warm=near, cool=far)</p>
            {depthEnabled ? (
              <p className="text-cyan-400">✓ Depth sensing active</p>
            ) : (
              <p className="text-orange-400">⚠ Depth sensor not available (demo mode)</p>
            )}
          </div>
        )}

        {/* ── Centre crosshair ── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="relative"
            style={{
              opacity: reticleVisible ? 0 : 1,
              transition: 'opacity 0.3s',
            }}
          >
            <Crosshair size={40} className="text-cyan-400/60" />
          </div>
        </div>

        {/* ── Status message ── */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 mt-12 pointer-events-none">
          <div className="px-4 py-2 glass rounded-full text-xs text-white/70 border border-white/10 whitespace-nowrap">
            {statusMsg}
          </div>
        </div>

        {/* ── Depth opacity slider (only when depth active) ── */}
        {depthEnabled && (
          <div className="pointer-events-auto absolute top-24 left-4 flex flex-col items-center gap-2">
            <span className="text-xs text-white/50">Depth</span>
            <input
              type="range"
              min={0}
              max={100}
              value={depthOpacity}
              onChange={(e) => setDepthOpacity(Number(e.target.value))}
              className="appearance-none h-20 w-1.5 rounded-full cursor-pointer"
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
                background: `linear-gradient(to top, #00d4ff ${depthOpacity}%, rgba(255,255,255,0.1) ${depthOpacity}%)`,
              }}
            />
            <span className="text-xs text-cyan-400">{depthOpacity}%</span>
          </div>
        )}

        {/* ── Placed count badge ── */}
        {placedTasks.length > 0 && (
          <div className="absolute top-24 right-4 px-3 py-1.5 glass rounded-full border border-white/10 text-xs text-white/60">
            {placedTasks.length} placed
          </div>
        )}

        {/* ── Task selector panel ── */}
        <div className="pointer-events-auto absolute bottom-0 left-0 right-0">
          {/* Collapse handle */}
          <div className="flex justify-center mb-1">
            <button
              onClick={() => setTaskPanelOpen((v) => !v)}
              className="px-6 py-1.5 glass rounded-full border border-white/10 text-white/50 flex items-center gap-1 text-xs"
            >
              {taskPanelOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              Tasks
            </button>
          </div>

          {taskPanelOpen && (
            <div className="glass-strong border-t border-white/10 px-4 pt-4 pb-8">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">
                Select a task to place
              </p>

              {/* Horizontal scroll task list */}
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {tasks.length === 0 ? (
                  <p className="text-white/30 text-sm">No tasks. Add some on the dashboard.</p>
                ) : (
                  tasks.map((task) => {
                    const color = getPriorityColor(task.priority);
                    const isSelected = selectedTask?.id === task.id;
                    const isPlaced = placedTasks.some((p) => p.taskId === task.id);
                    return (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTask(isSelected ? null : task)}
                        className="flex-shrink-0 flex flex-col gap-1 p-3 rounded-xl min-w-[140px] text-left transition-all"
                        style={{
                          background: isSelected ? color + '22' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${isSelected ? color + 'aa' : 'rgba(255,255,255,0.1)'}`,
                          boxShadow: isSelected ? `0 0 20px ${color}44` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs font-bold" style={{ color }}>
                            {task.priority.toUpperCase()}
                          </span>
                          {isPlaced && (
                            <span className="text-cyan-400 text-xs ml-auto">◉</span>
                          )}
                        </div>
                        <p className="text-white text-xs font-medium line-clamp-2 leading-snug">
                          {task.title}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Place button */}
              <div className="mt-4">
                <button
                  onClick={placeTask}
                  disabled={!selectedTask || !reticleVisible}
                  className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: selectedTask && reticleVisible
                      ? 'linear-gradient(135deg, #00d4ff, #8b5cf6)'
                      : 'rgba(255,255,255,0.08)',
                    color: selectedTask && reticleVisible ? '#000' : 'rgba(255,255,255,0.4)',
                    boxShadow: selectedTask && reticleVisible
                      ? '0 0 40px rgba(0,212,255,0.4)'
                      : 'none',
                  }}
                >
                  {!selectedTask
                    ? 'Select a task above'
                    : !reticleVisible
                    ? 'Aim at a flat surface'
                    : `⊕  Place "${selectedTask.title}"`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
