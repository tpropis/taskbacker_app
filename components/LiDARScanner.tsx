'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, CheckCircle, CheckCircle2, Loader2, TrendingUp } from 'lucide-react';
import { Task, getTasks, saveTasks, getCategoryIcon } from '@/lib/tasks';

// ── WebXR depth sensing type extensions ──────────────────────────────────────
// These extend the standard WebXR types with the depth-sensing feature,
// which isn't yet in TypeScript's DOM lib.
interface XRCPUDepthInformation {
  readonly width: number;
  readonly height: number;
  readonly rawValueToMeters: number;
  readonly data: ArrayBuffer;
  getDepthInMeters(x: number, y: number): number;
}

// XRFrame with depth sensing (optional — only present when feature is granted)
type XRFrameWithDepth = XRFrame & {
  getDepthInformation?: (view: XRView) => XRCPUDepthInformation | null;
};

// XRSession options used when requesting depth sensing
type XRDepthSessionInit = XRSessionInit & {
  depthSensing?: {
    usagePreference: string[];
    dataFormatPreference: string[];
  };
};

// ── Depth metadata sent to the AI ────────────────────────────────────────────
type DepthMeta = {
  minDepth: number;
  maxDepth: number;
  avgDepth: number;
  source: 'lidar-webxr' | 'simulated';
};

// ── LiDAR canvas overlay ──────────────────────────────────────────────────────
function LiDARDepthOverlay({
  active,
  lidarActive,
  depthInfoRef,
}: {
  active: boolean;
  lidarActive: boolean;
  depthInfoRef: React.MutableRefObject<XRCPUDepthInformation | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const syncSize = () => {
      canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    };
    syncSize();
    window.addEventListener('resize', syncSize);

    const ctx = canvas.getContext('2d')!;
    let animId: number;
    let scanY = 0;
    let tick = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const di = depthInfoRef.current;
      const color = di ? '0, 212, 255' : '124, 58, 237';

      // Grid
      const gridPx = Math.round(w / 10);
      ctx.save();
      ctx.strokeStyle = di ? 'rgba(0,212,255,0.18)' : 'rgba(124,58,237,0.15)';
      ctx.lineWidth = 0.5 * (window.devicePixelRatio || 1);
      for (let x = 0; x <= w; x += gridPx) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += gridPx) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.restore();

      // Depth points
      for (let i = 0; i < 80; i++) {
        const nx = Math.sin(i * 137.508) * 0.5 + 0.5;
        const ny = Math.cos(i * 137.508) * 0.5 + 0.5;
        const px = nx * w;
        const py = ny * h;

        let depth01: number;
        if (di) {
          const rawDepth = di.getDepthInMeters(nx, ny);
          depth01 = Math.min(rawDepth / 5, 1);
        } else {
          depth01 = Math.sin(i * 0.41 + tick * 0.012) * 0.5 + 0.5;
        }

        const hue = ((depth01 * 200 + 180) % 360 + 360) % 360;
        ctx.beginPath();
        ctx.arc(px, py, 3 * (window.devicePixelRatio || 1), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},100%,60%,0.55)`;
        ctx.fill();
      }

      // Sweep line
      const grad = ctx.createLinearGradient(0, scanY - 50, 0, scanY + 50);
      grad.addColorStop(0,    `rgba(${color},0)`);
      grad.addColorStop(0.45, `rgba(${color},0.12)`);
      grad.addColorStop(0.5,  `rgba(${color},0.5)`);
      grad.addColorStop(0.55, `rgba(${color},0.12)`);
      grad.addColorStop(1,    `rgba(${color},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 50, w, 100);

      ctx.strokeStyle = `rgba(${color},0.85)`;
      ctx.lineWidth = 1.5 * (window.devicePixelRatio || 1);
      ctx.beginPath(); ctx.moveTo(0, scanY); ctx.lineTo(w, scanY); ctx.stroke();

      scanY = (scanY + 1.8) % h;
      tick++;
      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', syncSize);
    };
  }, [active, depthInfoRef]);

  if (!active) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ mixBlendMode: 'screen' }}
      />
      {/* LiDAR status badge */}
      <div className="absolute top-36 left-0 right-0 flex justify-center pointer-events-none" style={{ zIndex: 30 }}>
        <span className={`lidar-badge ${lidarActive ? 'active' : 'simulated'}`}>
          <span className="lidar-badge-dot" />
          {lidarActive ? 'LiDAR Active' : 'LiDAR Simulated'}
        </span>
      </div>
    </>
  );
}

type ScanPhase = 'selecting' | 'scanning' | 'analyzing' | 'scored';

type Analysis = {
  score: number;
  grade: string;
  headline: string;
  summary: string;
  findings: string[];
};

function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#ea580c';
  if (score >= 40) return '#dc2626';
  return '#dc2626';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50 border-green-200';
  if (score >= 60) return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Acceptable';
  if (score >= 60) return 'Needs Work';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

function gradeLabel(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const color = scoreColor(score);
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={7} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-slate-900 leading-none">{score}</span>
        <span className="text-xs font-semibold text-slate-400">/100</span>
      </div>
    </div>
  );
}

// ── Capture JPEG ──────────────────────────────────────────────────────────────
function captureFrame(video: HTMLVideoElement): string {
  const maxDim = 1200;
  let w = video.videoWidth || 1280;
  let h = video.videoHeight || 720;
  if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
  if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.82);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ScanMode() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedPhotoRef = useRef<string>('');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [phase, setPhase] = useState<ScanPhase>('selecting');
  const [captureTarget, setCaptureTarget] = useState<'before' | 'after'>('before');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [flash, setFlash] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState('');

  // LiDAR / WebXR depth sensing state
  const xrSessionRef = useRef<XRSession | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xrRefSpaceRef = useRef<any>(null);
  const depthInfoRef = useRef<XRCPUDepthInformation | null>(null);
  const [lidarActive, setLidarActive] = useState(false);

  const loadTasks = useCallback(() => {
    setTasks(getTasks().filter((t) => !t.completed));
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const stopXR = useCallback(() => {
    if (xrSessionRef.current) {
      xrSessionRef.current.end().catch(() => {});
      xrSessionRef.current = null;
    }
    xrRefSpaceRef.current = null;
    depthInfoRef.current = null;
    setLidarActive(false);
  }, []);

  const stopCamera = useCallback(() => {
    stopXR();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, [stopXR]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (phase !== 'scanning' || !streamRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = streamRef.current;
    video.play().then(() => setCameraReady(true)).catch(() => setCameraReady(true));
  }, [phase]);

  const startCamera = useCallback(async (task: Task) => {
    setCameraError('');
    setCameraReady(false);
    setSelectedTask(task);
    setCaptureTarget(task.beforePhoto ? 'after' : 'before');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase('scanning');

      // Attempt WebXR depth sensing in background (LiDAR on iPhone 12 Pro+ / Android)
      void (async () => {
        try {
          const xr = navigator.xr;
          if (!xr) return;
          const supported = await xr.isSessionSupported('immersive-ar').catch(() => false);
          if (!supported) return;

          const sessionInit: XRDepthSessionInit = {
            optionalFeatures: ['depth-sensing'],
            depthSensing: {
              usagePreference: ['cpu-optimized'],
              dataFormatPreference: ['luminance-alpha'],
            },
          };
          const session = await xr.requestSession('immersive-ar', sessionInit);
          xrSessionRef.current = session;

          const refSpace = await session.requestReferenceSpace('local');
          xrRefSpaceRef.current = refSpace;
          setLidarActive(true);

          // XR frame loop — keeps depthInfoRef current
          const onFrame = (_time: number, frame: XRFrame) => {
            if (!xrSessionRef.current) return;
            const pose = frame.getViewerPose(refSpace as XRReferenceSpace);
            const depthFrame = frame as XRFrameWithDepth;
            if (pose && depthFrame.getDepthInformation) {
              const view = pose.views[0];
              if (view) {
                const di = depthFrame.getDepthInformation(view);
                if (di) depthInfoRef.current = di;
              }
            }
            session.requestAnimationFrame(onFrame);
          };
          session.requestAnimationFrame(onFrame);
        } catch {
          // WebXR depth not supported on this device/browser — simulated overlay still shows
        }
      })();
    } catch (err) {
      stopCamera();
      const name = (err instanceof Error) ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('Camera access denied. Go to Settings → Safari → Camera → Allow.');
      } else {
        setCameraError('Could not start camera. Make sure you\'re using HTTPS.');
      }
    }
  }, [stopCamera]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !selectedTask) return;

    const dataURL = captureFrame(video);
    capturedPhotoRef.current = dataURL;

    // Snapshot depth data before stopping the XR session
    const depthMeta: DepthMeta | null = (() => {
      const di = depthInfoRef.current;
      if (!di) {
        // Simulated depth metadata based on typical indoor distances
        return {
          minDepth: 0.3 + Math.random() * 0.5,
          maxDepth: 2.5 + Math.random() * 2.5,
          avgDepth: 1.2 + Math.random() * 0.8,
          source: 'simulated' as const,
        };
      }
      // Real WebXR depth — sample a 5×5 grid
      const samples: number[] = [];
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const d = di.getDepthInMeters((i + 0.5) / 5, (j + 0.5) / 5);
          if (d > 0 && d < 20) samples.push(d);
        }
      }
      if (samples.length === 0) return null;
      return {
        minDepth: Math.min(...samples),
        maxDepth: Math.max(...samples),
        avgDepth: samples.reduce((a, b) => a + b, 0) / samples.length,
        source: 'lidar-webxr' as const,
      };
    })();

    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    stopCamera();
    setPhase('analyzing');
    setAnalysis(null);
    setAnalyzeError('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataURL,
          context: selectedTask.title + (selectedTask.description ? ': ' + selectedTask.description : ''),
          depthMeta,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        // Surface the friendly message from the API (rate limit, quota, auth, etc.)
        throw new Error(errBody.error || errBody.detail || `HTTP ${res.status}`);
      }
      const data: Analysis = await res.json();
      data.grade = gradeLabel(data.score);
      setAnalysis(data);

      const field = captureTarget === 'before' ? 'beforePhoto' : 'afterPhoto';
      const scoreField = captureTarget === 'before' ? 'beforeScore' : 'afterScore';
      const analysisField = captureTarget === 'before' ? 'beforeAnalysis' : 'afterAnalysis';
      const allTasks = getTasks();
      const updated = allTasks.map((t) =>
        t.id === selectedTask.id
          ? { ...t, [field]: dataURL, [scoreField]: data.score, [analysisField]: data }
          : t,
      );
      saveTasks(updated);
      setSelectedTask(updated.find((t) => t.id === selectedTask.id) ?? selectedTask);
      setTasks(updated.filter((t) => !t.completed));
      setPhase('scored');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      // If the message is already descriptive (from API), show it directly
      const isFriendly = msg.includes('Rate limit') || msg.includes('quota') || msg.includes('API key') || msg.includes('overloaded');
      setAnalyzeError(isFriendly ? msg : `Analysis failed: ${msg}`);
      // Re-open camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, audio: false,
        });
        streamRef.current = stream;
        setPhase('scanning');
      } catch { /* ignore */ }
    }
  }, [selectedTask, captureTarget, stopCamera]);

  const goBack = useCallback(() => {
    stopCamera();
    setPhase('selecting');
    setSelectedTask(null);
    setAnalysis(null);
    setCaptureTarget('before');
    loadTasks();
  }, [stopCamera, loadTasks]);

  // ── Task selection ──────────────────────────────────────────────────────────
  if (phase === 'selecting') {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Scan a Task</h1>
              <p className="text-xs text-slate-500">Choose which task to inspect</p>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 pt-20 pb-12">
          {/* How scanning works */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
            <p className="text-sm font-semibold text-indigo-900 mb-2">How scanning works</p>
            <div className="space-y-1.5">
              {[
                'Pick a task from the list below',
                'Point your camera at the area — tap to capture',
                'AI inspects the photo and gives a score (0–100)',
                'After fixing it, scan again to show the improvement',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-indigo-600 text-white rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-indigo-800">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {cameraError && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {cameraError}
            </div>
          )}

          {tasks.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Camera size={22} className="text-slate-400" />
              </div>
              <p className="text-slate-900 font-semibold mb-1">No active tasks</p>
              <p className="text-slate-500 text-sm mb-4">Add a task first, then come back to scan it.</p>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all"
              >
                Go to Tasks
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Select a task to scan
              </p>
              {tasks.map((task) => {
                const hasBeforeScan = task.beforeScore !== undefined;
                const hasAfterScan = task.afterScore !== undefined;
                return (
                  <button
                    key={task.id}
                    onClick={() => startCamera(task)}
                    className="w-full text-left bg-white border border-slate-100 rounded-xl p-4 hover:border-indigo-200 hover:shadow-sm transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize priority-${task.priority}`}>
                            {task.priority}
                          </span>
                          <span className="text-xs text-slate-400">
                            {getCategoryIcon(task.category)} {task.category}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 truncate">{task.title}</p>
                      </div>

                      {/* Scan status */}
                      <div className="flex-shrink-0 text-right">
                        {hasBeforeScan && hasAfterScan ? (
                          <div className="flex items-center gap-1.5">
                            <div className="text-center">
                              <div className="text-sm font-black" style={{ color: scoreColor(task.beforeScore!) }}>{task.beforeScore}</div>
                              <div className="text-[10px] text-slate-400">before</div>
                            </div>
                            <TrendingUp size={14} className="text-slate-300" />
                            <div className="text-center">
                              <div className="text-sm font-black" style={{ color: scoreColor(task.afterScore!) }}>{task.afterScore}</div>
                              <div className="text-[10px] text-slate-400">after</div>
                            </div>
                          </div>
                        ) : hasBeforeScan ? (
                          <div className="text-center">
                            <div className="text-sm font-black" style={{ color: scoreColor(task.beforeScore!) }}>{task.beforeScore}</div>
                            <div className="text-[10px] text-orange-500 font-semibold">needs after</div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Tap to scan →</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Camera ──────────────────────────────────────────────────────────────────
  if (phase === 'scanning' && selectedTask) {
    const isBefore = captureTarget === 'before';

    return (
      <div className="fixed inset-0 bg-black overflow-hidden">
        <video
          ref={videoRef}
          autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: cameraReady ? 1 : 0, transition: 'opacity 0.3s ease' }}
        />
        {/* LiDAR depth overlay — canvas with scan animation + depth points */}
        <LiDARDepthOverlay
          active={cameraReady}
          lidarActive={lidarActive}
          depthInfoRef={depthInfoRef}
        />
        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={32} className="text-white animate-spin" />
          </div>
        )}
        {flash && <div className="absolute inset-0 bg-white pointer-events-none" style={{ opacity: 0.8 }} />}

        {analyzeError && (
          <div className="absolute top-24 left-4 right-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-white text-xs z-20">
            {analyzeError}
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none">
          {/* Top bar */}
          <div
            className="pointer-events-auto absolute top-0 left-0 right-0 px-4 pb-4 bg-gradient-to-b from-black/70 to-transparent"
            style={{ paddingTop: 'max(48px, env(safe-area-inset-top, 48px))' }}
          >
            <div className="flex items-center justify-between">
              <button
                onClick={goBack}
                className="w-9 h-9 rounded-full glass flex items-center justify-center"
              >
                <ArrowLeft size={17} className="text-white" />
              </button>
              <div className="glass rounded-full px-3 py-1.5 max-w-[60%]">
                <span className="text-white text-xs font-semibold truncate block">{selectedTask.title}</span>
              </div>
              <div className="w-9" />
            </div>
          </div>

          {/* Step indicator */}
          <div className="absolute top-24 left-0 right-0 flex justify-center">
            <div className="flex items-center gap-2 glass rounded-full px-4 py-2">
              <div className={`flex items-center gap-1.5 text-xs font-bold ${isBefore ? 'text-white' : 'text-white/40'}`}>
                {selectedTask.beforeScore !== undefined && !isBefore
                  ? <CheckCircle size={11} className="text-green-400" />
                  : <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isBefore ? 'bg-white text-black' : 'bg-white/20 text-white/40'}`}>1</span>
                }
                Before
              </div>
              <div className="w-8 h-px bg-white/20" />
              <div className={`flex items-center gap-1.5 text-xs font-bold ${!isBefore ? 'text-white' : 'text-white/40'}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${!isBefore ? 'bg-white text-black' : 'bg-white/20 text-white/40'}`}>2</span>
                After
              </div>
            </div>
          </div>

          {/* Viewfinder */}
          <div className="absolute left-10 right-10 top-40 bottom-44">
            <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-white/70 rounded-tl" />
            <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-white/70 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-white/70 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-white/70 rounded-br" />
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
              <span className="text-xs text-white/80 glass px-3 py-1.5 rounded-full font-medium">
                {isBefore ? '📸 Scan the problem area' : '📸 Scan after the fix'}
              </span>
            </div>
          </div>

          {/* Bottom controls */}
          <div
            className="pointer-events-auto absolute bottom-0 left-0 right-0 px-4"
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}
          >
            <div className="bg-black/75 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
              <button
                onClick={capture}
                disabled={!cameraReady}
                className="w-full py-4 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 text-white"
                style={{
                  background: isBefore ? '#4f46e5' : '#16a34a',
                }}
              >
                <Camera size={18} />
                {isBefore ? 'Capture & Analyze' : 'Capture After Fix'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── AI analyzing ─────────────────────────────────────────────────────────────
  if (phase === 'analyzing') {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-6 px-8">
        {capturedPhotoRef.current && (
          <div className="relative w-full max-w-sm">
            <img
              src={capturedPhotoRef.current}
              alt="Analyzing"
              className="w-full aspect-video object-cover rounded-2xl"
            />
            <div className="absolute inset-0 rounded-2xl overflow-hidden">
              <div className="lidar-scan-line" />
            </div>
            <div className="absolute inset-0 bg-white/10 rounded-2xl" />
          </div>
        )}
        <div className="flex flex-col items-center gap-2 text-center">
          <Loader2 size={28} className="text-indigo-600 animate-spin" />
          <p className="text-slate-900 font-bold text-lg">AI is inspecting...</p>
          <p className="text-slate-500 text-sm">Analyzing the photo and scoring the issue</p>
        </div>
      </div>
    );
  }

  // ── Score result ─────────────────────────────────────────────────────────────
  if (phase === 'scored' && analysis && selectedTask) {
    const color = scoreColor(analysis.score);
    const isBefore = captureTarget === 'before';
    const beforeScore = selectedTask.beforeScore;
    const afterScore = selectedTask.afterScore;
    const improvement = beforeScore !== undefined && afterScore !== undefined
      ? afterScore - beforeScore
      : null;

    return (
      <div className="min-h-screen bg-slate-50">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <button
              onClick={goBack}
              className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Scan Result</h1>
              <p className="text-xs text-slate-500 truncate max-w-[200px]">{selectedTask.title}</p>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 pt-20 pb-16 space-y-4">

          {/* Photo + score card */}
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            {capturedPhotoRef.current && (
              <img
                src={capturedPhotoRef.current}
                alt="Scanned"
                className="w-full aspect-video object-cover"
              />
            )}
            <div className="p-5">
              <div className="flex items-center gap-4">
                <ScoreRing score={analysis.score} size={100} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-2xl font-black"
                      style={{ color }}
                    >
                      {analysis.grade}
                    </span>
                    <span
                      className={`text-sm font-bold px-2.5 py-0.5 rounded-full border ${scoreBg(analysis.score)}`}
                      style={{ color }}
                    >
                      {scoreLabel(analysis.score)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 mb-1">{analysis.headline}</p>
                  <p className="text-xs text-slate-400 capitalize">{isBefore ? 'Before scan' : 'After scan'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Summary</p>
            <p className="text-sm text-slate-700 leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Findings */}
          {analysis.findings.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                What the AI found
              </p>
              <div className="space-y-2">
                {analysis.findings.map((f, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: color + '20' }}
                    >
                      <span className="text-[10px] font-bold" style={{ color }}>{i + 1}</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-snug">{f}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Before → After comparison */}
          {improvement !== null && (
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Before vs After
              </p>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="text-3xl font-black" style={{ color: scoreColor(beforeScore!) }}>
                    {beforeScore}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Before</div>
                </div>
                <div className="text-center">
                  <div
                    className="text-2xl font-black"
                    style={{ color: improvement >= 0 ? '#16a34a' : '#dc2626' }}
                  >
                    {improvement >= 0 ? '+' : ''}{improvement}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Change</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black" style={{ color: scoreColor(afterScore!) }}>
                    {afterScore}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">After</div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-1">
            {isBefore && (
              <button
                onClick={() => { setCaptureTarget('after'); startCamera(selectedTask); }}
                className="w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Camera size={16} />
                Scan After the Fix
              </button>
            )}

            {!isBefore && (
              <button
                onClick={() => {
                  const allTasks = getTasks();
                  saveTasks(allTasks.map((t) =>
                    t.id === selectedTask.id ? { ...t, completed: true } : t,
                  ));
                  router.push('/');
                }}
                className="w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 size={16} />
                Mark Task Complete
              </button>
            )}

            <button
              onClick={() => router.push(`/tasks/${selectedTask.id}`)}
              className="w-full py-3 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all border border-slate-200"
            >
              View full task details
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
