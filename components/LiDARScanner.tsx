'use client';

// ─────────────────────────────────────────────────────────────────────────────
//  LiDARScanner — Camera-based AR component
//  Works in iOS Safari using getUserMedia + DeviceOrientation tracking.
//  Features:
//    • Live camera feed as AR background
//    • Device orientation (compass) tracking for 3D scene rotation
//    • Task card placement anchored in orientation space
//    • Floating 3D task billboards rendered with Three.js
//    • DOM overlay UI for task selection and controls
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react';
import { Scan, X, ChevronUp, ChevronDown, Crosshair, Info } from 'lucide-react';
import { Task, getTasks, saveTasks, getPriorityColor } from '@/lib/tasks';

// ── Turbo colormap (kept for landing page depth preview) ─────────────────────
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
  distance: number,
): void {
  const W = 512;
  const H = 256;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const priorityColor = getPriorityColor(task.priority);

  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, 'rgba(12, 12, 32, 0.92)');
  bg.addColorStop(1, 'rgba(4, 20, 40, 0.92)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 24);
  ctx.fill();

  ctx.fillStyle = priorityColor;
  ctx.shadowColor = priorityColor;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.roundRect(0, 0, 8, H, [24, 0, 0, 24]);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = priorityColor + '66';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1, 1, W - 2, H - 2, 23);
  ctx.stroke();

  ctx.fillStyle = priorityColor + '33';
  ctx.beginPath();
  ctx.roundRect(24, 20, 90, 28, 14);
  ctx.fill();
  ctx.fillStyle = priorityColor;
  ctx.font = 'bold 14px -apple-system, system-ui, sans-serif';
  ctx.fillText(task.priority.toUpperCase(), 36, 39);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px -apple-system, system-ui, sans-serif';
  const maxW = W - 60;
  let title = task.title;
  while (ctx.measureText(title).width > maxW && title.length > 0) title = title.slice(0, -1);
  if (title !== task.title) title += '…';
  ctx.fillText(title, 24, 90);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '16px -apple-system, system-ui, sans-serif';
  let desc = task.description;
  while (ctx.measureText(desc).width > maxW && desc.length > 0) desc = desc.slice(0, -1);
  if (desc !== task.description) desc += '…';
  ctx.fillText(desc, 24, 118);

  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, 140);
  ctx.lineTo(W - 24, 140);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '14px -apple-system, system-ui, sans-serif';
  ctx.fillText(`📁 ${task.category}`, 24, 170);

  ctx.fillStyle = 'rgba(0,212,255,0.6)';
  ctx.fillText(`◎ ${distance.toFixed(1)}m away`, W - 150, 170);

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
  const containerRef   = useRef<HTMLDivElement>(null);
  const rendererRef    = useRef<import('three').WebGLRenderer | null>(null);
  const sceneRef       = useRef<import('three').Scene | null>(null);
  const cameraRef      = useRef<import('three').Camera | null>(null);
  const animFrameRef   = useRef<number | null>(null);
  const taskMeshesRef  = useRef<Map<string, import('three').Mesh>>(new Map());
  const clockRef       = useRef<import('three').Clock | null>(null);
  const videoRef       = useRef<HTMLVideoElement | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const orientRef      = useRef<{ alpha: number | null; beta: number | null; gamma: number | null } | null>(null);
  const orientHandlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);
  const threeRef       = useRef<typeof import('three') | null>(null);

  const [tasks, setTasks]             = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isARSupported, setIsARSupported] = useState<boolean | null>(null);
  const [arUnsupportedReason, setArUnsupportedReason] = useState<string>('');
  const [arStartError, setArStartError] = useState<string>('');
  const [isARActive, setIsARActive]   = useState(false);
  const [placedTasks, setPlacedTasks] = useState<PlacedTask[]>([]);
  const [showInfo, setShowInfo]       = useState(false);
  const [statusMsg, setStatusMsg]     = useState('Point your camera and tap to place tasks');
  const [taskPanelOpen, setTaskPanelOpen] = useState(true);

  // ── Load tasks on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    setTasks(getTasks().filter((t) => !t.completed));
  }, []);

  // ── Check camera support ────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === 'undefined') {
      setIsARSupported(false);
      setArUnsupportedReason('Not running in a browser.');
      return;
    }
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      setIsARSupported(false);
      setArUnsupportedReason('Page must be loaded over HTTPS. Check your URL starts with https://');
      return;
    }
    if (navigator.mediaDevices?.getUserMedia) {
      setIsARSupported(true);
    } else {
      setIsARSupported(false);
      setArUnsupportedReason('Camera API unavailable. Use Safari on iOS 14.3+ or Chrome on Android.');
    }
  }, []);

  // ── Create a floating task billboard ────────────────────────────────────────
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
      mesh.position.y += 0.3;

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

  // ── Place selected task 1.5 m in front of camera ────────────────────────────
  const placeTask = useCallback(async () => {
    if (!selectedTask) {
      setStatusMsg('Select a task first!');
      return;
    }

    const THREE = threeRef.current ?? await import('three');
    const camera = cameraRef.current;
    if (!camera) return;

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);

    const pos = new THREE.Vector3();
    pos.copy(camera.position).addScaledVector(forward, 1.5);

    const mesh = await createTaskMesh(THREE, selectedTask, pos);
    const meshId = `mesh_${selectedTask.id}_${Date.now()}`;
    taskMeshesRef.current.set(meshId, mesh);

    const updatedTasks = tasks.map((t) =>
      t.id === selectedTask.id ? { ...t, arPlaced: true } : t,
    );
    saveTasks(updatedTasks);
    setTasks(updatedTasks.filter((t) => !t.completed));

    setPlacedTasks((prev) => [
      ...prev,
      { taskId: selectedTask.id, position: [pos.x, pos.y, pos.z], meshId },
    ]);

    setStatusMsg(`"${selectedTask.title}" placed!`);
    setSelectedTask(null);
    setTimeout(() => setStatusMsg('Point and tap to place more tasks'), 3000);
  }, [selectedTask, tasks, createTaskMesh]);

  // ── Initialize Three.js renderer ─────────────────────────────────────────────
  const initThreeJS = useCallback(async () => {
    if (!containerRef.current) return null;

    const THREE = await import('three');
    threeRef.current = THREE;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);
    renderer.domElement.style.cssText =
      'position:absolute;inset:0;z-index:1;pointer-events:none;';
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.01,
      30,
    );
    cameraRef.current = camera;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    clockRef.current = new THREE.Clock();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(0.5, 1, 0.25);
    scene.add(dir);

    return { renderer, scene, camera, THREE };
  }, []);

  // ── Start AR: camera stream + orientation + render loop ──────────────────────
  const startAR = useCallback(async () => {
    try {
      // 1. Camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;

      // 2. Video element as background
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.setAttribute('playsinline', '');
      video.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;';
      containerRef.current?.prepend(video);
      videoRef.current = video;
      await video.play().catch(() => {});

      // 3. Three.js scene
      const init = await initThreeJS();
      if (!init) return;
      const { renderer, scene, camera, THREE } = init;

      // 4. Device orientation (iOS 13+ needs explicit permission from a user gesture)
      const handleOrientation = (e: DeviceOrientationEvent) => {
        orientRef.current = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
      };
      orientHandlerRef.current = handleOrientation;

      const DOE = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<PermissionState>;
      };
      if (typeof DOE.requestPermission === 'function') {
        try {
          const perm = await DOE.requestPermission();
          if (perm === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          }
        } catch {
          // Permission denied — orientation won't drive camera, camera feed still works
        }
      } else {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }

      setIsARActive(true);

      // 5. Render loop
      const animate = () => {
        animFrameRef.current = requestAnimationFrame(animate);
        const elapsed = clockRef.current?.getElapsedTime() ?? 0;

        // Update camera from device orientation
        const o = orientRef.current;
        if (o && o.alpha !== null && o.beta !== null && o.gamma !== null) {
          // Standard conversion: portrait mode, sensor → camera axes
          const euler = new THREE.Euler(
            THREE.MathUtils.degToRad(o.beta),
            THREE.MathUtils.degToRad(o.alpha),
            THREE.MathUtils.degToRad(-o.gamma),
            'YXZ',
          );
          camera.quaternion.setFromEuler(euler);
        }

        // Animate task cards: float + always face camera
        taskMeshesRef.current.forEach((mesh) => {
          mesh.position.y += Math.sin(elapsed * 1.2 + mesh.position.x * 5) * 0.0003;
          mesh.quaternion.copy(camera.quaternion);
        });

        renderer.render(scene, camera);
      };
      animate();
    } catch (err) {
      console.error('AR start failed:', err);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      videoRef.current?.parentNode?.removeChild(videoRef.current);
      videoRef.current = null;

      // Surface a human-readable error so the user knows what went wrong
      const name = (err instanceof Error) ? err.name : '';
      const msg = (err instanceof Error) ? err.message : String(err);
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setArStartError('Camera permission denied. Go to Settings → Safari → Camera and set it to Allow, then refresh.');
      } else if (name === 'NotFoundError') {
        setArStartError('No camera found on this device.');
      } else if (name === 'NotSupportedError' || name === 'SecurityError') {
        setArStartError('Camera blocked — page must be served over HTTPS.');
      } else {
        setArStartError(`Could not start camera: ${msg || name || 'unknown error'}`);
      }
    }
  }, [initThreeJS]);

  // ── End AR session ──────────────────────────────────────────────────────────
  const endAR = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (orientHandlerRef.current) {
      window.removeEventListener('deviceorientation', orientHandlerRef.current, true);
      orientHandlerRef.current = null;
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.parentNode?.removeChild(videoRef.current);
      videoRef.current = null;
    }

    const canvas = rendererRef.current?.domElement;
    canvas?.parentNode?.removeChild(canvas);
    rendererRef.current?.dispose();
    rendererRef.current = null;
    sceneRef.current = null;
    cameraRef.current = null;
    threeRef.current = null;
    orientRef.current = null;
    taskMeshesRef.current.clear();

    setIsARActive(false);
    setPlacedTasks([]);
  }, []);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => { endAR(); };
  }, [endAR]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Landing page ─────────────────────────────────────────────────────────────
  if (!isARActive) {
    return (
      <div className="relative min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 depth-grid" />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/40 via-black to-cyan-950/30" />
        <div className="lidar-scan-line" />

        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 text-center px-6 max-w-lg">
          <div className="mx-auto w-24 h-24 mb-8 relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20 border border-cyan-500/30 animate-pulse-glow" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Scan size={44} className="text-cyan-400" />
            </div>
          </div>

          <h1 className="text-4xl font-black mb-3 gradient-text">AR Mode</h1>
          <p className="text-white/60 mb-2 text-base leading-relaxed">
            Place tasks in your physical space using your iPhone camera.
          </p>

          {/* Runtime error (from actually trying to start AR) */}
          {arStartError && (
            <div className="my-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <strong>Could not start AR</strong>
              <span className="block mt-1 text-red-300">{arStartError}</span>
            </div>
          )}

          {/* Pre-flight warning (non-blocking) */}
          {!arStartError && isARSupported === false && (
            <div className="my-6 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm">
              <strong>Camera may not be available</strong>
              <br />
              {arUnsupportedReason && (
                <span className="block mt-1 text-orange-300">{arUnsupportedReason}</span>
              )}
              <span className="block mt-2 text-orange-400/70">
                You can still tap below to try — Safari will ask for permission if needed.
              </span>
            </div>
          )}

          {!arStartError && isARSupported === true && (
            <div className="my-6 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400/80 text-sm leading-relaxed">
              ✓ Ready on your iPhone
              <br />
              Point your camera and tap to place tasks in the real world
            </div>
          )}

          <button
            onClick={() => { setArStartError(''); startAR(); }}
            disabled={isARSupported === null}
            className="w-full py-4 rounded-2xl font-bold text-lg text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #00d4ff 0%, #8b5cf6 100%)',
              boxShadow: '0 0 60px rgba(0,212,255,0.4)',
            }}
          >
            {isARSupported === null ? 'Checking device…' : '⬡  Enter AR Space'}
          </button>

          {isARSupported === null && (
            <p className="text-white/30 text-xs mt-3">Querying camera capability…</p>
          )}
        </div>
      </div>
    );
  }

  // ── Active AR view ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-transparent" ref={containerRef}>
      {/* Camera video (z-index 0) and Three.js canvas (z-index 1) injected by startAR */}

      {/* DOM overlay — above the 3D canvas */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>

        {/* ── Top bar ── */}
        <div className="pointer-events-auto absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12 pb-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-400 text-sm font-bold">AR MODE</span>
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
            <p className="font-bold text-white mb-1">AR Controls</p>
            <p>• Select a task in the panel below</p>
            <p>• Point your camera where you want it</p>
            <p>• Tap ⊕ Place to drop the task card there</p>
            <p>• Rotate your phone to look around placed tasks</p>
          </div>
        )}

        {/* ── Centre crosshair ── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Crosshair size={40} className="text-cyan-400/60" />
        </div>

        {/* ── Status message ── */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 mt-12 pointer-events-none">
          <div className="px-4 py-2 glass rounded-full text-xs text-white/70 border border-white/10 whitespace-nowrap">
            {statusMsg}
          </div>
        </div>

        {/* ── Placed count badge ── */}
        {placedTasks.length > 0 && (
          <div className="absolute top-24 right-4 px-3 py-1.5 glass rounded-full border border-white/10 text-xs text-white/60">
            {placedTasks.length} placed
          </div>
        )}

        {/* ── Task selector panel ── */}
        <div className="pointer-events-auto absolute bottom-0 left-0 right-0">
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
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-xs font-bold" style={{ color }}>
                            {task.priority.toUpperCase()}
                          </span>
                          {isPlaced && <span className="text-cyan-400 text-xs ml-auto">◉</span>}
                        </div>
                        <p className="text-white text-xs font-medium line-clamp-2 leading-snug">
                          {task.title}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="mt-4">
                <button
                  onClick={placeTask}
                  disabled={!selectedTask}
                  className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: selectedTask
                      ? 'linear-gradient(135deg, #00d4ff, #8b5cf6)'
                      : 'rgba(255,255,255,0.08)',
                    color: selectedTask ? '#000' : 'rgba(255,255,255,0.4)',
                    boxShadow: selectedTask ? '0 0 40px rgba(0,212,255,0.4)' : 'none',
                  }}
                >
                  {!selectedTask ? 'Select a task above' : `⊕  Place "${selectedTask.title}"`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
