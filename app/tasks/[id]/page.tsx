'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera, Clock, RotateCcw, TrendingUp, Sparkles } from 'lucide-react';
import Header from '@/components/Header';
import {
  getTasks, saveTasks,
  getPriorityColor, formatDueDate, getCategoryIcon,
  type Task,
} from '@/lib/tasks';

function scoreColor(s: number) {
  if (s >= 80) return '#16a34a';
  if (s >= 60) return '#ea580c';
  return '#dc2626';
}

function scoreBg(s: number) {
  if (s >= 80) return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (s >= 60) return 'bg-orange-50 border-orange-200 text-orange-700';
  return 'bg-red-50 border-red-200 text-red-700';
}

function resizeImage(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
      if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = url;
  });
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score / 100;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Photo slot ────────────────────────────────────────────────────────────────
function PhotoSlot({
  label,
  photo,
  score,
  analysis,
  saving,
  onCapture,
  onRetake,
}: {
  label: string;
  photo?: string;
  score?: number;
  analysis?: { headline: string; summary: string; findings: string[] };
  saving: boolean;
  onCapture: () => void;
  onRetake: () => void;
}) {
  const hasPhoto = !!photo;

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
      {/* Photo area */}
      {hasPhoto ? (
        <div className="relative">
          <img src={photo} alt={label} className="w-full aspect-[4/3] object-cover" />
          {/* Score badge overlay */}
          {score !== undefined && (
            <div className="absolute top-3 right-3 flex items-center justify-center" style={{ width: 56, height: 56 }}>
              <ScoreRing score={score} size={56} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-black" style={{ color: scoreColor(score) }}>{score}</span>
              </div>
            </div>
          )}
          {/* Retake button */}
          <button
            onClick={onRetake}
            className="absolute bottom-3 right-3 w-9 h-9 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
          >
            <RotateCcw size={15} />
          </button>
          {/* Label chip */}
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-full">
            <span className="text-white text-xs font-semibold">{label}</span>
          </div>
        </div>
      ) : (
        <button
          onClick={onCapture}
          disabled={saving}
          className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-3 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <Camera size={28} className="text-white" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">Tap to open camera</p>
          </div>
        </button>
      )}

      {/* Analysis */}
      {analysis && (
        <div className="px-5 py-4 border-t border-slate-50">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={13} className="text-indigo-400" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Analysis</p>
          </div>
          <p className="text-sm font-semibold text-slate-900 mb-1">{analysis.headline}</p>
          <p className="text-sm text-slate-500 leading-relaxed mb-3">{analysis.summary}</p>
          {analysis.findings.length > 0 && (
            <div className="space-y-1.5">
              {analysis.findings.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${label === 'Before' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                  <span className="leading-snug">{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [task, setTask] = useState<Task | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tasks = getTasks();
    const found = tasks.find((t) => t.id === id);
    if (!found) { router.replace('/'); return; }
    setTask(found);
    setNotes(found.notes ?? '');
  }, [id, router]);

  const persist = useCallback((patch: Partial<Task>) => {
    setTask((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      const allTasks = getTasks().map((t) => (t.id === prev.id ? updated : t));
      saveTasks(allTasks);
      return updated;
    });
  }, []);

  const saveNotes = useCallback(() => persist({ notes }), [notes, persist]);

  const handlePhotoCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, target: 'before' | 'after') => {
      const file = e.target.files?.[0];
      if (!file) return;
      setSaving(true);
      try {
        const dataURL = await resizeImage(file, 1200, 0.82);
        persist(target === 'before' ? { beforePhoto: dataURL } : { afterPhoto: dataURL });
      } finally {
        setSaving(false);
        e.target.value = '';
      }
    },
    [persist],
  );

  if (!task) return null;

  const priorityColor = getPriorityColor(task.priority);
  const bothPhotos = !!task.beforePhoto && !!task.afterPhoto;
  const improvement =
    task.beforeScore !== undefined && task.afterScore !== undefined
      ? task.afterScore - task.beforeScore
      : null;

  const priorityBadge: Record<string, string> = {
    high:   'bg-rose-50 border border-rose-200 text-rose-700',
    medium: 'bg-amber-50 border border-amber-200 text-amber-700',
    low:    'bg-emerald-50 border border-emerald-200 text-emerald-700',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      {/* Hidden file inputs */}
      <input ref={beforeInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => handlePhotoCapture(e, 'before')} />
      <input ref={afterInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => handlePhotoCapture(e, 'after')} />

      <main className="max-w-xl mx-auto px-4 pt-16 pb-32">

        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm mb-5 transition-colors font-medium">
          <ArrowLeft size={14} />
          Tasks
        </Link>

        {/* ── Task header ── */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm mb-4">
          <div className="h-1" style={{ backgroundColor: priorityColor }} />
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${priorityBadge[task.priority]}`}>
                {task.priority}
              </span>
              <span className="text-xs text-slate-400">
                {getCategoryIcon(task.category)} {task.category}
              </span>
              {task.completed && (
                <span className="ml-auto text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  ✓ Complete
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2 leading-snug">{task.title}</h1>
            {task.description && (
              <p className="text-sm text-slate-500 leading-relaxed mb-3">{task.description}</p>
            )}
            {task.dueDate && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock size={11} />
                {formatDueDate(task.dueDate)}
              </div>
            )}
          </div>
        </div>

        {/* ── Score comparison ── */}
        {improvement !== null && (
          <div className="bg-white rounded-3xl p-5 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={14} className="text-indigo-400" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Result</p>
            </div>
            <div className="flex items-center justify-around">
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center mb-1">
                  <ScoreRing score={task.beforeScore!} size={72} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-black" style={{ color: scoreColor(task.beforeScore!) }}>{task.beforeScore}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 font-medium">Before</p>
              </div>
              <div className="text-center px-4">
                <div className={`text-2xl font-black mb-1 ${improvement >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {improvement >= 0 ? '+' : ''}{improvement}
                </div>
                <p className="text-xs text-slate-400 font-medium">Change</p>
              </div>
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center mb-1">
                  <ScoreRing score={task.afterScore!} size={72} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-black" style={{ color: scoreColor(task.afterScore!) }}>{task.afterScore}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 font-medium">After</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Before photo slot ── */}
        <div className="mb-3">
          <PhotoSlot
            label="Before"
            photo={task.beforePhoto}
            score={task.beforeScore}
            analysis={task.beforeAnalysis}
            saving={saving}
            onCapture={() => beforeInputRef.current?.click()}
            onRetake={() => beforeInputRef.current?.click()}
          />
        </div>

        {/* ── After photo slot (only after before is taken) ── */}
        {task.beforePhoto && (
          <div className="mb-4">
            <PhotoSlot
              label="After"
              photo={task.afterPhoto}
              score={task.afterScore}
              analysis={task.afterAnalysis}
              saving={saving}
              onCapture={() => afterInputRef.current?.click()}
              onRetake={() => afterInputRef.current?.click()}
            />
          </div>
        )}

        {/* ── Side-by-side ── */}
        {bothPhotos && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Side by Side</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { src: task.beforePhoto!, label: 'Before', score: task.beforeScore },
                { src: task.afterPhoto!,  label: 'After',  score: task.afterScore },
              ].map((item) => (
                <div key={item.label} className="relative rounded-2xl overflow-hidden">
                  <img src={item.src} alt={item.label} className="w-full aspect-[4/3] object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-between">
                    <span className="text-white text-xs font-semibold">{item.label}</span>
                    {item.score !== undefined && (
                      <span className="text-white text-xs font-black">{item.score}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Notes ── */}
        <div className="bg-white rounded-3xl p-5 shadow-sm mb-5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add notes about this task…"
            rows={4}
            className="w-full text-slate-700 text-sm placeholder-slate-400 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        {/* ── Actions ── */}
        <div className="space-y-2.5">
          <button
            onClick={() => persist({ completed: !task.completed })}
            className={`w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] ${
              task.completed
                ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200'
            }`}
          >
            {task.completed ? '↩ Mark as Active' : '✓ Mark as Complete'}
          </button>

          <button
            onClick={() => {
              const allTasks = getTasks().filter((t) => t.id !== task.id);
              saveTasks(allTasks);
              router.replace('/');
            }}
            className="w-full py-3 rounded-2xl text-sm text-red-500 hover:text-red-600 hover:bg-red-50 transition-all"
          >
            Delete task
          </button>
        </div>

      </main>
    </div>
  );
}
