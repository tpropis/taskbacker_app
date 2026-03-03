'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera, Clock, RotateCcw, TrendingUp } from 'lucide-react';
import Header from '@/components/Header';
import {
  getTasks, saveTasks,
  getPriorityColor, formatDueDate, getCategoryIcon,
  type Task,
} from '@/lib/tasks';

function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#ea580c';
  return '#dc2626';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50 border-green-200 text-green-700';
  if (score >= 60) return 'bg-orange-50 border-orange-200 text-orange-700';
  return 'bg-red-50 border-red-200 text-red-700';
}

function resizeImage(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
      if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = url;
  });
}

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

  const saveNotes = useCallback(() => {
    persist({ notes });
  }, [notes, persist]);

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

  const toggleComplete = useCallback(() => {
    persist({ completed: !task?.completed });
  }, [task, persist]);

  const deleteTask = useCallback(() => {
    if (!task) return;
    const allTasks = getTasks().filter((t) => t.id !== task.id);
    saveTasks(allTasks);
    router.replace('/');
  }, [task, router]);

  if (!task) return null;

  const priorityColor = getPriorityColor(task.priority);
  const bothPhotos = !!task.beforePhoto && !!task.afterPhoto;
  const improvement =
    task.beforeScore !== undefined && task.afterScore !== undefined
      ? task.afterScore - task.beforeScore
      : null;

  const priorityBadgeStyle: Record<string, string> = {
    high: 'bg-red-50 border border-red-200 text-red-700',
    medium: 'bg-orange-50 border border-orange-200 text-orange-700',
    low: 'bg-green-50 border border-green-200 text-green-700',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      {/* Hidden file inputs */}
      <input
        ref={beforeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handlePhotoCapture(e, 'before')}
      />
      <input
        ref={afterInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handlePhotoCapture(e, 'after')}
      />

      <main className="max-w-xl mx-auto px-4 pt-16 pb-32">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 text-sm mb-5 transition-colors"
        >
          <ArrowLeft size={15} />
          All Tasks
        </Link>

        {/* Task header card */}
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden mb-4 shadow-sm">
          <div className="h-1" style={{ backgroundColor: priorityColor }} />
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${priorityBadgeStyle[task.priority]}`}>
                {task.priority}
              </span>
              <span className="text-xs text-slate-400">
                {getCategoryIcon(task.category)} {task.category}
              </span>
              {task.completed && (
                <span className="ml-auto text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
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

        {/* Score comparison (if both scanned) */}
        {improvement !== null && (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={15} className="text-slate-400" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Scan Results</p>
            </div>
            <div className="flex items-center justify-around">
              <div className="text-center">
                <div className="text-3xl font-black" style={{ color: scoreColor(task.beforeScore!) }}>
                  {task.beforeScore}
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
                <div className="text-3xl font-black" style={{ color: scoreColor(task.afterScore!) }}>
                  {task.afterScore}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">After</div>
              </div>
            </div>
          </div>
        )}

        {/* Before scan summary */}
        {task.beforeAnalysis && (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Before Scan — AI Findings</p>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${scoreBg(task.beforeScore ?? 0)}`}>
                Score: {task.beforeScore}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900 mb-1">{task.beforeAnalysis.headline}</p>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">{task.beforeAnalysis.summary}</p>
            {task.beforeAnalysis.findings.length > 0 && (
              <div className="space-y-1.5">
                {task.beforeAnalysis.findings.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">•</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* After scan summary */}
        {task.afterAnalysis && (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">After Scan — AI Findings</p>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${scoreBg(task.afterScore ?? 0)}`}>
                Score: {task.afterScore}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900 mb-1">{task.afterAnalysis.headline}</p>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">{task.afterAnalysis.summary}</p>
            {task.afterAnalysis.findings.length > 0 && (
              <div className="space-y-1.5">
                {task.afterAnalysis.findings.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Documentation ── */}
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 mt-2">Photos</p>

        {/* Before photo */}
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden mb-3 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-900">Before Photo</span>
            <div className="flex items-center gap-2">
              {task.beforePhoto && (
                <button
                  onClick={() => beforeInputRef.current?.click()}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  title="Retake"
                >
                  <RotateCcw size={13} />
                </button>
              )}
              <span className={`text-xs font-medium ${task.beforePhoto ? 'text-green-600' : 'text-slate-400'}`}>
                {task.beforePhoto ? '✓ Captured' : 'Not captured'}
              </span>
            </div>
          </div>
          {task.beforePhoto ? (
            <img src={task.beforePhoto} alt="Before" className="w-full aspect-video object-cover" />
          ) : (
            <button
              onClick={() => beforeInputRef.current?.click()}
              disabled={saving}
              className="w-full py-10 flex flex-col items-center gap-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
            >
              <Camera size={28} />
              <span className="text-sm font-medium">Capture before photo</span>
              <span className="text-xs text-slate-400">Tap to open camera</span>
            </button>
          )}
        </div>

        {/* After photo — only shown if before exists */}
        {task.beforePhoto && (
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden mb-4 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-900">After Photo</span>
              <div className="flex items-center gap-2">
                {task.afterPhoto && (
                  <button
                    onClick={() => afterInputRef.current?.click()}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    title="Retake"
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
                <span className={`text-xs font-medium ${task.afterPhoto ? 'text-green-600' : 'text-slate-400'}`}>
                  {task.afterPhoto ? '✓ Captured' : 'Not captured'}
                </span>
              </div>
            </div>
            {task.afterPhoto ? (
              <img src={task.afterPhoto} alt="After" className="w-full aspect-video object-cover" />
            ) : (
              <button
                onClick={() => afterInputRef.current?.click()}
                disabled={saving}
                className="w-full py-10 flex flex-col items-center gap-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
              >
                <Camera size={28} />
                <span className="text-sm font-medium">Capture after photo</span>
                <span className="text-xs text-slate-400">Take this after completing the fix</span>
              </button>
            )}
          </div>
        )}

        {/* Side-by-side review */}
        {bothPhotos && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Side-by-Side</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-slate-500 text-center mb-1.5 font-medium">Before</p>
                <img src={task.beforePhoto!} alt="Before" className="w-full aspect-video object-cover rounded-xl border border-slate-100" />
              </div>
              <div>
                <p className="text-xs text-slate-500 text-center mb-1.5 font-medium">After</p>
                <img src={task.afterPhoto!} alt="After" className="w-full aspect-video object-cover rounded-xl border border-slate-100" />
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 mb-5 shadow-sm">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add notes about this task..."
            rows={4}
            className="w-full text-slate-700 text-sm placeholder-slate-400 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={toggleComplete}
            className={`w-full py-4 rounded-xl font-bold text-sm transition-all active:scale-95 ${
              task.completed
                ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {task.completed ? '↩ Mark as Active' : '✓ Mark as Complete'}
          </button>

          <button
            onClick={deleteTask}
            className="w-full py-3 rounded-xl text-sm text-red-500 hover:text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
          >
            Delete task
          </button>
        </div>
      </main>
    </div>
  );
}
