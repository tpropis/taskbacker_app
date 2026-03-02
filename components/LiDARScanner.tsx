'use client';

// ─────────────────────────────────────────────────────────────────────────────
//  ScanMode — Live camera documentation tool
//
//  Flow:
//   1. Task selection: pick an active task to document
//   2. Camera view: live feed + capture button (Before or After)
//   3. Review: side-by-side before/after with complete action
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, CheckCircle, RotateCcw } from 'lucide-react';
import { Task, getTasks, saveTasks, getPriorityColor, getCategoryIcon } from '@/lib/tasks';

type ScanPhase = 'selecting' | 'scanning' | 'review';

// ── Capture a JPEG from a video element ──────────────────────────────────────
function captureFrame(video: HTMLVideoElement): string {
  const maxDim = 1200;
  let w = video.videoWidth || 1280;
  let h = video.videoHeight || 720;
  if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
  if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export default function ScanMode() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [phase, setPhase] = useState<ScanPhase>('selecting');
  const [captureTarget, setCaptureTarget] = useState<'before' | 'after'>('before');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [flash, setFlash] = useState(false);
  const [reviewTask, setReviewTask] = useState<Task | null>(null);

  const loadTasks = useCallback(() => {
    setTasks(getTasks().filter((t) => !t.completed));
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(async (task: Task) => {
    setCameraError('');
    setCameraReady(false);
    setSelectedTask(task);
    setCaptureTarget(task.beforePhoto ? 'after' : 'before');
    setPhase('scanning');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;

      // Attach stream once DOM has rendered the <video>
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play()
            .then(() => setCameraReady(true))
            .catch(() => setCameraReady(true));
        }
      });
    } catch (err) {
      stopCamera();
      setPhase('selecting');
      const name = (err instanceof Error) ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('Camera access denied. Go to Settings → Safari → Camera → Allow, then refresh.');
      } else if (name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Could not start camera. Open this page over HTTPS.');
      }
    }
  }, [stopCamera]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !selectedTask) return;

    const dataURL = captureFrame(video);
    const field = captureTarget === 'before' ? 'beforePhoto' : 'afterPhoto';

    const allTasks = getTasks();
    const updated = allTasks.map((t) =>
      t.id === selectedTask.id ? { ...t, [field]: dataURL } : t,
    );
    saveTasks(updated);

    const updatedTask = updated.find((t) => t.id === selectedTask.id)!;
    setSelectedTask(updatedTask);
    setTasks(updated.filter((t) => !t.completed));

    // Brief white flash
    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    if (captureTarget === 'before') {
      setCaptureTarget('after');
    } else {
      stopCamera();
      setReviewTask(updatedTask);
      setPhase('review');
    }
  }, [selectedTask, captureTarget, stopCamera]);

  const goBack = useCallback(() => {
    stopCamera();
    setPhase('selecting');
    setSelectedTask(null);
    setReviewTask(null);
    setCaptureTarget('before');
    loadTasks();
  }, [stopCamera, loadTasks]);

  // ─── Phase 1: Task selection ──────────────────────────────────────────────
  if (phase === 'selecting') {
    return (
      <div className="min-h-screen bg-black pt-16">
        <div className="relative max-w-lg mx-auto px-4 py-8">
          <div className="absolute inset-0 depth-grid opacity-25 pointer-events-none" />
          <div className="relative">
            <div className="mb-8">
              <h2 className="text-2xl font-black gradient-text-blue-purple mb-1">Scan Mode</h2>
              <p className="text-white/50 text-sm">
                Select a task, open the camera, capture before & after.
              </p>
            </div>

            {cameraError && (
              <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm leading-relaxed">
                {cameraError}
              </div>
            )}

            {tasks.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                <Camera size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No active tasks.</p>
                <button
                  onClick={() => router.push('/')}
                  className="mt-4 text-cyan-400/70 text-sm hover:text-cyan-400 transition-colors"
                >
                  Go to dashboard →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => {
                  const color = getPriorityColor(task.priority);
                  const hasBefore = !!task.beforePhoto;
                  const hasAfter = !!task.afterPhoto;
                  return (
                    <button
                      key={task.id}
                      onClick={() => startCamera(task)}
                      className="w-full text-left glass rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
                      style={{ borderLeft: `3px solid ${color}` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold" style={{ color }}>
                              {task.priority.toUpperCase()}
                            </span>
                            <span className="text-xs text-white/30">
                              {getCategoryIcon(task.category)} {task.category}
                            </span>
                          </div>
                          <p className="text-white font-medium text-sm truncate">{task.title}</p>
                          {task.description && (
                            <p className="text-white/35 text-xs mt-0.5 truncate">{task.description}</p>
                          )}
                        </div>

                        {/* Photo status dots */}
                        <div className="flex flex-col items-center gap-1 flex-shrink-0 pr-1">
                          <div className="flex items-center gap-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: hasBefore ? '#00d4ff' : 'rgba(255,255,255,0.15)' }}
                              title="Before photo"
                            />
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: hasAfter ? '#2ed573' : 'rgba(255,255,255,0.15)' }}
                              title="After photo"
                            />
                          </div>
                          <span className="text-[10px] text-white/25">
                            {!hasBefore ? 'No photos' : !hasAfter ? 'Before only' : 'Documented'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Phase 2: Live camera ─────────────────────────────────────────────────
  if (phase === 'scanning' && selectedTask) {
    const color = getPriorityColor(selectedTask.priority);
    const isBefore = captureTarget === 'before';

    return (
      <div className="fixed inset-0 bg-black overflow-hidden">
        {/* Camera feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: cameraReady ? 1 : 0, transition: 'opacity 0.3s ease' }}
        />

        {/* Spinner while camera loads */}
        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        )}

        {/* Capture flash */}
        {flash && (
          <div className="absolute inset-0 bg-white pointer-events-none" style={{ opacity: 0.6 }} />
        )}

        {/* Overlay */}
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

              <div className="flex items-center gap-2 glass rounded-full px-3 py-1.5 max-w-[60%]">
                <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: color }} />
                <span className="text-white text-xs font-semibold truncate">{selectedTask.title}</span>
              </div>

              <div className="w-9" />
            </div>
          </div>

          {/* Viewfinder corners */}
          <div className="absolute left-8 right-8 top-28 bottom-40">
            <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-cyan-400/60 rounded-tl-sm" />
            <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-cyan-400/60 rounded-tr-sm" />
            <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-cyan-400/60 rounded-bl-sm" />
            <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-cyan-400/60 rounded-br-sm" />
          </div>

          {/* Instruction pill */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
            <div className="px-4 py-1.5 glass rounded-full text-xs text-white/55 border border-white/10">
              {isBefore ? 'Frame the problem' : 'Frame the fix'}
            </div>
          </div>

          {/* Bottom controls */}
          <div
            className="pointer-events-auto absolute bottom-0 left-0 right-0 px-5"
            style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))' }}
          >
            <div className="bg-black/65 backdrop-blur-xl rounded-3xl p-5 border border-white/10">
              {/* Before / After steps */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    isBefore
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : selectedTask.beforePhoto
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-white/8 text-white/35'
                  }`}
                >
                  {selectedTask.beforePhoto && !isBefore ? <CheckCircle size={11} /> : <span>1</span>}
                  <span>Before</span>
                </div>
                <div className="w-5 h-px bg-white/20" />
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    !isBefore
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-white/8 text-white/35'
                  }`}
                >
                  <span>2</span>
                  <span>After</span>
                </div>
              </div>

              {/* Capture button */}
              <button
                onClick={capture}
                disabled={!cameraReady}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{
                  background: isBefore
                    ? 'linear-gradient(135deg, #00d4ff, #8b5cf6)'
                    : 'linear-gradient(135deg, #2ed573, #00d4ff)',
                  color: '#000',
                  boxShadow: cameraReady
                    ? `0 0 40px ${isBefore ? 'rgba(0,212,255,0.35)' : 'rgba(46,213,115,0.35)'}`
                    : 'none',
                }}
              >
                <Camera size={18} />
                {isBefore ? 'Capture Before' : 'Capture After'}
              </button>

              {/* Skip after */}
              {!isBefore && (
                <button
                  onClick={() => { stopCamera(); setReviewTask(selectedTask); setPhase('review'); }}
                  className="w-full mt-2 py-2 text-sm text-white/35 hover:text-white/60 transition-colors"
                >
                  Skip → Review
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Phase 3: Review ──────────────────────────────────────────────────────
  if (phase === 'review') {
    const task = reviewTask ?? selectedTask;
    if (!task) return null;

    const latest = getTasks().find((t) => t.id === task.id) ?? task;
    const color = getPriorityColor(latest.priority);

    return (
      <div className="min-h-screen bg-black pt-16">
        <div className="max-w-lg mx-auto px-4 py-8">
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors"
          >
            <ArrowLeft size={16} /> All Tasks
          </button>

          <div className="flex items-center gap-2 mb-5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <h2 className="text-xl font-black text-white">{latest.title}</h2>
          </div>

          {/* Side-by-side photos */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest text-center mb-2">
                Before
              </p>
              {latest.beforePhoto ? (
                <img
                  src={latest.beforePhoto}
                  alt="Before"
                  className="w-full aspect-video object-cover rounded-xl"
                />
              ) : (
                <div className="w-full aspect-video rounded-xl glass flex items-center justify-center text-white/20 text-xs">
                  No photo
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest text-center mb-2">
                After
              </p>
              {latest.afterPhoto ? (
                <img
                  src={latest.afterPhoto}
                  alt="After"
                  className="w-full aspect-video object-cover rounded-xl"
                />
              ) : (
                <div className="w-full aspect-video rounded-xl glass flex items-center justify-center text-white/20 text-xs">
                  No photo
                </div>
              )}
            </div>
          </div>

          {/* Notes if any */}
          {latest.notes && (
            <div className="glass rounded-2xl p-4 mb-5 text-sm text-white/60 leading-relaxed">
              {latest.notes}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {!latest.afterPhoto && (
              <button
                onClick={() => { setSelectedTask(latest); startCamera(latest); }}
                className="w-full py-4 rounded-2xl font-bold text-sm glass border border-white/10 text-white/70 hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <Camera size={16} />
                Capture After Photo
              </button>
            )}

            <button
              onClick={() => {
                const allTasks = getTasks();
                const updated = allTasks.map((t) =>
                  t.id === latest.id ? { ...t, completed: true } : t,
                );
                saveTasks(updated);
                router.push('/');
              }}
              className="w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #2ed573, #00d4ff)',
                color: '#000',
                boxShadow: '0 0 30px rgba(46,213,115,0.3)',
              }}
            >
              <CheckCircle size={16} />
              Mark as Complete
            </button>

            <button
              onClick={() => router.push(`/tasks/${latest.id}`)}
              className="w-full py-3 rounded-2xl text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              View full details →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
