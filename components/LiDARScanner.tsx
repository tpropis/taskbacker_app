'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, CheckCircle, CheckCircle2, Loader2, TrendingUp } from 'lucide-react';
import { Task, getTasks, saveTasks, getCategoryIcon } from '@/lib/tasks';

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
        <span className="text-3xl font-black text-gray-900 leading-none">{score}</span>
        <span className="text-xs font-semibold text-gray-400">/100</span>
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
    } catch {
      setAnalyzeError('Analysis failed. Check that ANTHROPIC_API_KEY is set in Vercel.');
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
      <div className="min-h-screen bg-gray-50">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Scan a Task</h1>
              <p className="text-xs text-gray-500">Choose which task to inspect</p>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 pt-20 pb-12">
          {/* How scanning works */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-semibold text-blue-900 mb-2">How scanning works</p>
            <div className="space-y-1.5">
              {[
                'Pick a task from the list below',
                'Point your camera at the area — tap to capture',
                'AI inspects the photo and gives a score (0–100)',
                'After fixing it, scan again to show the improvement',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-blue-800">{step}</p>
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
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Camera size={22} className="text-gray-400" />
              </div>
              <p className="text-gray-900 font-semibold mb-1">No active tasks</p>
              <p className="text-gray-500 text-sm mb-4">Add a task first, then come back to scan it.</p>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Select a task to scan
              </p>
              {tasks.map((task) => {
                const hasBeforeScan = task.beforeScore !== undefined;
                const hasAfterScan = task.afterScore !== undefined;
                return (
                  <button
                    key={task.id}
                    onClick={() => startCamera(task)}
                    className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize priority-${task.priority}`}>
                            {task.priority}
                          </span>
                          <span className="text-xs text-gray-400">
                            {getCategoryIcon(task.category)} {task.category}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">{task.title}</p>
                      </div>

                      {/* Scan status */}
                      <div className="flex-shrink-0 text-right">
                        {hasBeforeScan && hasAfterScan ? (
                          <div className="flex items-center gap-1.5">
                            <div className="text-center">
                              <div className="text-sm font-black" style={{ color: scoreColor(task.beforeScore!) }}>{task.beforeScore}</div>
                              <div className="text-[10px] text-gray-400">before</div>
                            </div>
                            <TrendingUp size={14} className="text-gray-300" />
                            <div className="text-center">
                              <div className="text-sm font-black" style={{ color: scoreColor(task.afterScore!) }}>{task.afterScore}</div>
                              <div className="text-[10px] text-gray-400">after</div>
                            </div>
                          </div>
                        ) : hasBeforeScan ? (
                          <div className="text-center">
                            <div className="text-sm font-black" style={{ color: scoreColor(task.beforeScore!) }}>{task.beforeScore}</div>
                            <div className="text-[10px] text-orange-500 font-semibold">needs after</div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">Tap to scan →</span>
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
                  background: isBefore ? '#2563eb' : '#16a34a',
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
          <Loader2 size={28} className="text-blue-600 animate-spin" />
          <p className="text-gray-900 font-bold text-lg">AI is inspecting...</p>
          <p className="text-gray-500 text-sm">Analyzing the photo and scoring the issue</p>
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
      <div className="min-h-screen bg-gray-50">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <button
              onClick={goBack}
              className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Scan Result</h1>
              <p className="text-xs text-gray-500 truncate max-w-[200px]">{selectedTask.title}</p>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 pt-20 pb-16 space-y-4">

          {/* Photo + score card */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
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
                  <p className="text-sm font-semibold text-gray-900 mb-1">{analysis.headline}</p>
                  <p className="text-xs text-gray-400 capitalize">{isBefore ? 'Before scan' : 'After scan'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Summary</p>
            <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Findings */}
          {analysis.findings.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
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
                    <p className="text-sm text-gray-700 leading-snug">{f}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Before → After comparison */}
          {improvement !== null && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Before vs After
              </p>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="text-3xl font-black" style={{ color: scoreColor(beforeScore!) }}>
                    {beforeScore}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Before</div>
                </div>
                <div className="text-center">
                  <div
                    className="text-2xl font-black"
                    style={{ color: improvement >= 0 ? '#16a34a' : '#dc2626' }}
                  >
                    {improvement >= 0 ? '+' : ''}{improvement}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Change</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black" style={{ color: scoreColor(afterScore!) }}>
                    {afterScore}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">After</div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-1">
            {isBefore && (
              <button
                onClick={() => { setCaptureTarget('after'); startCamera(selectedTask); }}
                className="w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 text-white"
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
              className="w-full py-3 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all border border-gray-200"
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
