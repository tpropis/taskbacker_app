'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, CheckCircle, Loader2 } from 'lucide-react';
import { Task, getTasks, saveTasks, getPriorityColor, getCategoryIcon } from '@/lib/tasks';

type ScanPhase = 'selecting' | 'scanning' | 'analyzing' | 'scored' | 'review';

type Analysis = {
  score: number;
  grade: string;
  headline: string;
  summary: string;
  findings: string[];
};

// ── Score ring color ──────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 80) return '#2ed573';
  if (score >= 60) return '#ffa502';
  if (score >= 40) return '#ff6b35';
  return '#ff4757';
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

// ── Animated score ring ───────────────────────────────────────────────────────
function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const color = scoreColor(score);
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-white leading-none">{score}</span>
        <span className="text-xs font-bold" style={{ color }}>/ 100</span>
      </div>
    </div>
  );
}

// ── Capture JPEG from video ───────────────────────────────────────────────────
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

  const loadTasks = useCallback(() => {
    setTasks(getTasks().filter(t => !t.completed));
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Attach stream after React renders the <video>
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
    } catch (err) {
      stopCamera();
      const name = (err instanceof Error) ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('Camera denied. Go to Settings → Safari → Camera → Allow.');
      } else {
        setCameraError('Could not start camera. Ensure HTTPS.');
      }
    }
  }, [stopCamera]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !selectedTask) return;

    const dataURL = captureFrame(video);
    capturedPhotoRef.current = dataURL;

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
        }),
      });

      if (!res.ok) throw new Error('API error');
      const data: Analysis = await res.json();
      // Ensure grade matches score
      data.grade = gradeLabel(data.score);
      setAnalysis(data);

      // Persist photo + score to task
      const field = captureTarget === 'before' ? 'beforePhoto' : 'afterPhoto';
      const scoreField = captureTarget === 'before' ? 'beforeScore' : 'afterScore';
      const analysisField = captureTarget === 'before' ? 'beforeAnalysis' : 'afterAnalysis';
      const allTasks = getTasks();
      const updated = allTasks.map(t =>
        t.id === selectedTask.id
          ? { ...t, [field]: dataURL, [scoreField]: data.score, [analysisField]: data }
          : t
      );
      saveTasks(updated);
      setSelectedTask(updated.find(t => t.id === selectedTask.id) ?? selectedTask);
      setTasks(updated.filter(t => !t.completed));

      setPhase('scored');
    } catch {
      setAnalyzeError('AI analysis failed. Check your API key in Vercel environment variables.');
      setPhase('scanning');
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
      <div className="min-h-screen bg-black pt-16">
        <div className="relative max-w-lg mx-auto px-4 py-8">
          <div className="absolute inset-0 depth-grid opacity-20 pointer-events-none" />
          <div className="relative">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass border border-cyan-500/30 text-cyan-400 text-xs font-bold mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                AI-Powered Inspection
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Select a task to scan</h2>
              <p className="text-white/45 text-sm">Point your camera, get an AI score out of 100.</p>
            </div>

            {cameraError && (
              <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {cameraError}
              </div>
            )}

            {tasks.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                <Camera size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No active tasks.</p>
                <button onClick={() => router.push('/')} className="mt-4 text-cyan-400/70 text-sm hover:text-cyan-400">
                  Go to dashboard →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => {
                  const color = getPriorityColor(task.priority);
                  const beforeScore = task.beforeScore;
                  const afterScore = task.afterScore;
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
                            <span className="text-xs font-bold" style={{ color }}>{task.priority.toUpperCase()}</span>
                            <span className="text-xs text-white/30">{getCategoryIcon(task.category)} {task.category}</span>
                          </div>
                          <p className="text-white font-semibold text-sm truncate">{task.title}</p>
                        </div>
                        {/* Score badges */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {beforeScore !== undefined && (
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-black" style={{ color: scoreColor(beforeScore) }}>{beforeScore}</span>
                              <span className="text-[9px] text-white/25">before</span>
                            </div>
                          )}
                          {beforeScore !== undefined && afterScore !== undefined && (
                            <span className="text-white/20 text-xs">→</span>
                          )}
                          {afterScore !== undefined && (
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-black" style={{ color: scoreColor(afterScore) }}>{afterScore}</span>
                              <span className="text-[9px] text-white/25">after</span>
                            </div>
                          )}
                          {beforeScore === undefined && (
                            <span className="text-[10px] text-white/20">Not scanned</span>
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
      </div>
    );
  }

  // ── Camera ──────────────────────────────────────────────────────────────────
  if (phase === 'scanning' && selectedTask) {
    const color = getPriorityColor(selectedTask.priority);
    const isBefore = captureTarget === 'before';

    return (
      <div className="fixed inset-0 bg-black overflow-hidden">
        <video
          ref={videoRef}
          autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: cameraReady ? 1 : 0, transition: 'opacity 0.3s ease' }}
        />
        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        )}
        {flash && <div className="absolute inset-0 bg-white pointer-events-none" style={{ opacity: 0.7 }} />}

        {analyzeError && (
          <div className="absolute top-24 left-4 right-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs z-20">
            {analyzeError}
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none">
          {/* Top bar */}
          <div
            className="pointer-events-auto absolute top-0 left-0 right-0 px-4 pb-4 bg-gradient-to-b from-black/80 to-transparent"
            style={{ paddingTop: 'max(48px, env(safe-area-inset-top, 48px))' }}
          >
            <div className="flex items-center justify-between">
              <button onClick={goBack} className="w-9 h-9 rounded-full glass flex items-center justify-center">
                <ArrowLeft size={17} className="text-white" />
              </button>
              <div className="flex items-center gap-2 glass rounded-full px-3 py-1.5 max-w-[60%]">
                <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: color }} />
                <span className="text-white text-xs font-semibold truncate">{selectedTask.title}</span>
              </div>
              <div className="w-9" />
            </div>
          </div>

          {/* Viewfinder */}
          <div className="absolute left-8 right-8 top-28 bottom-44">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400/70 rounded-tl-sm" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400/70 rounded-tr-sm" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400/70 rounded-bl-sm" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400/70 rounded-br-sm" />
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
              <span className="text-xs text-cyan-400/60 glass px-3 py-1 rounded-full border border-cyan-400/20">
                {isBefore ? 'Scan the problem' : 'Scan after the fix'}
              </span>
            </div>
          </div>

          {/* Bottom controls */}
          <div
            className="pointer-events-auto absolute bottom-0 left-0 right-0 px-5"
            style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))' }}
          >
            <div className="bg-black/70 backdrop-blur-xl rounded-3xl p-5 border border-white/10">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isBefore ? 'bg-cyan-500/20 text-cyan-400' : selectedTask.beforeScore !== undefined ? 'bg-emerald-500/15 text-emerald-400' : 'text-white/30'}`}>
                  {selectedTask.beforeScore !== undefined && !isBefore ? <CheckCircle size={11} /> : <span>1</span>}
                  <span>Before Scan</span>
                  {selectedTask.beforeScore !== undefined && <span className="font-black">{selectedTask.beforeScore}/100</span>}
                </div>
                <div className="w-5 h-px bg-white/20" />
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${!isBefore ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/30'}`}>
                  <span>2</span>
                  <span>After Scan</span>
                </div>
              </div>

              <button
                onClick={capture}
                disabled={!cameraReady}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{
                  background: isBefore ? 'linear-gradient(135deg, #00d4ff, #8b5cf6)' : 'linear-gradient(135deg, #2ed573, #00d4ff)',
                  color: '#000',
                  boxShadow: cameraReady ? '0 0 40px rgba(0,212,255,0.3)' : 'none',
                }}
              >
                <Camera size={18} />
                {isBefore ? 'Scan & Score' : 'Scan After Fix'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── AI analyzing ────────────────────────────────────────────────────────────
  if (phase === 'analyzing') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 px-8">
        {capturedPhotoRef.current && (
          <div className="relative w-full max-w-sm">
            <img src={capturedPhotoRef.current} alt="Scanning" className="w-full aspect-video object-cover rounded-2xl opacity-40" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="lidar-scan-line" style={{ position: 'absolute', zIndex: 10 }} />
            </div>
          </div>
        )}
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="text-cyan-400 animate-spin" />
          <p className="text-white font-bold text-lg">AI Analyzing...</p>
          <p className="text-white/40 text-sm text-center">TaskBacker is scoring your scan</p>
        </div>
      </div>
    );
  }

  // ── Score result ────────────────────────────────────────────────────────────
  if (phase === 'scored' && analysis && selectedTask) {
    const color = scoreColor(analysis.score);
    const isBefore = captureTarget === 'before';
    const beforeScore = selectedTask.beforeScore;
    const afterScore = selectedTask.afterScore;
    const improvement = beforeScore !== undefined && afterScore !== undefined
      ? afterScore - beforeScore : null;

    return (
      <div className="min-h-screen bg-black pt-16">
        <div className="max-w-lg mx-auto px-4 py-8">
          <button onClick={goBack} className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> All Tasks
          </button>

          {/* Score card */}
          <div
            className="glass rounded-3xl p-8 mb-4 text-center relative overflow-hidden"
            style={{ border: `1px solid ${color}33`, boxShadow: `0 0 60px ${color}15` }}
          >
            <div className="lidar-scan-line opacity-20" />
            <div className="relative">
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">
                {selectedTask.title}
              </p>
              <p className="text-xs text-white/30 mb-6">{isBefore ? 'Before scan' : 'After scan'}</p>

              <div className="flex justify-center mb-4">
                <ScoreRing score={analysis.score} size={160} />
              </div>

              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4"
                style={{ backgroundColor: color + '20', border: `1px solid ${color}50` }}
              >
                <span className="font-black text-2xl" style={{ color }}>{analysis.grade}</span>
                <span className="text-white/60 text-sm font-medium">{analysis.headline}</span>
              </div>

              <p className="text-white/65 text-sm leading-relaxed mb-4">{analysis.summary}</p>

              {analysis.findings.length > 0 && (
                <div className="text-left space-y-2 mb-2">
                  {analysis.findings.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-white/50">
                      <span className="mt-0.5" style={{ color }}>•</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Before → After comparison */}
          {improvement !== null && (
            <div className="glass rounded-2xl p-4 mb-4 flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-black" style={{ color: scoreColor(beforeScore!) }}>{beforeScore}</div>
                <div className="text-xs text-white/35">Before</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-black" style={{ color: improvement >= 0 ? '#2ed573' : '#ff4757' }}>
                  {improvement >= 0 ? '+' : ''}{improvement}
                </div>
                <div className="text-xs text-white/35">Change</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black" style={{ color: scoreColor(afterScore!) }}>{afterScore}</div>
                <div className="text-xs text-white/35">After</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {isBefore && (
              <button
                onClick={() => { setCaptureTarget('after'); setPhase('scanning'); startCamera(selectedTask); }}
                className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #2ed573, #00d4ff)',
                  color: '#000',
                  boxShadow: '0 0 30px rgba(46,213,115,0.3)',
                }}
              >
                <Camera size={16} />
                Scan After Fix
              </button>
            )}

            {!isBefore && (
              <button
                onClick={() => {
                  const allTasks = getTasks();
                  saveTasks(allTasks.map(t => t.id === selectedTask.id ? { ...t, completed: true } : t));
                  router.push('/');
                }}
                className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #2ed573, #00d4ff)',
                  color: '#000',
                  boxShadow: '0 0 30px rgba(46,213,115,0.3)',
                }}
              >
                <CheckCircle size={16} />
                Mark Complete
              </button>
            )}

            <button
              onClick={() => router.push(`/tasks/${selectedTask.id}`)}
              className="w-full py-3 rounded-2xl text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              View full task →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
