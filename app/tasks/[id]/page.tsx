'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera, Clock, RotateCcw } from 'lucide-react';
import Header from '@/components/Header';
import {
  getTasks, saveTasks,
  getPriorityColor, formatDueDate, getCategoryIcon,
  type Task,
} from '@/lib/tasks';

// ── Resize an image File to a max dimension, returns base64 data URL ─────────
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
        // Reset input so same file can be re-selected
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

  return (
    <div className="min-h-screen bg-black">
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

      <main className="max-w-xl mx-auto px-4 pt-24 pb-32">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          All Tasks
        </Link>

        {/* Task header card */}
        <div
          className="glass rounded-2xl p-5 mb-4"
          style={{ borderLeft: `3px solid ${priorityColor}` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: priorityColor + '22', color: priorityColor }}
            >
              {task.priority.toUpperCase()}
            </span>
            <span className="text-xs text-white/40">
              {getCategoryIcon(task.category)} {task.category}
            </span>
            {task.completed && (
              <span className="ml-auto text-xs font-bold text-emerald-400">✓ Complete</span>
            )}
          </div>

          <h1 className="text-xl font-bold text-white mb-2 leading-snug">{task.title}</h1>

          {task.description && (
            <p className="text-sm text-white/55 leading-relaxed mb-3">{task.description}</p>
          )}

          {task.dueDate && (
            <div className="flex items-center gap-1.5 text-xs text-white/35">
              <Clock size={11} />
              {formatDueDate(task.dueDate)}
            </div>
          )}
        </div>

        {/* ── Documentation section ── */}
        <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 mt-6">
          Documentation
        </h2>

        {/* Before photo */}
        <div className="glass rounded-2xl overflow-hidden mb-3">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm font-semibold text-white">Before</span>
            <div className="flex items-center gap-2">
              {task.beforePhoto && (
                <button
                  onClick={() => beforeInputRef.current?.click()}
                  className="text-white/35 hover:text-white/70 transition-colors"
                  title="Retake"
                >
                  <RotateCcw size={13} />
                </button>
              )}
              <span className={`text-xs font-medium ${task.beforePhoto ? 'text-emerald-400' : 'text-white/30'}`}>
                {task.beforePhoto ? '✓ Captured' : 'Not captured'}
              </span>
            </div>
          </div>

          {task.beforePhoto ? (
            <img
              src={task.beforePhoto}
              alt="Before"
              className="w-full aspect-video object-cover"
            />
          ) : (
            <button
              onClick={() => beforeInputRef.current?.click()}
              disabled={saving}
              className="w-full py-10 flex flex-col items-center gap-3 text-white/30 hover:text-white/60 transition-colors active:bg-white/5"
            >
              <Camera size={32} />
              <span className="text-sm font-medium">Capture the problem</span>
              <span className="text-xs text-white/20">Tap to open camera</span>
            </button>
          )}
        </div>

        {/* After photo — only shown if before exists */}
        {task.beforePhoto && (
          <div className="glass rounded-2xl overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <span className="text-sm font-semibold text-white">After</span>
              <div className="flex items-center gap-2">
                {task.afterPhoto && (
                  <button
                    onClick={() => afterInputRef.current?.click()}
                    className="text-white/35 hover:text-white/70 transition-colors"
                    title="Retake"
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
                <span className={`text-xs font-medium ${task.afterPhoto ? 'text-emerald-400' : 'text-white/30'}`}>
                  {task.afterPhoto ? '✓ Captured' : 'Not captured'}
                </span>
              </div>
            </div>

            {task.afterPhoto ? (
              <img
                src={task.afterPhoto}
                alt="After"
                className="w-full aspect-video object-cover"
              />
            ) : (
              <button
                onClick={() => afterInputRef.current?.click()}
                disabled={saving}
                className="w-full py-10 flex flex-col items-center gap-3 text-white/30 hover:text-white/60 transition-colors active:bg-white/5"
              >
                <Camera size={32} />
                <span className="text-sm font-medium">Capture the solution</span>
                <span className="text-xs text-white/20">Tap to open camera</span>
              </button>
            )}
          </div>
        )}

        {/* Side-by-side review (when both photos exist) */}
        {bothPhotos && (
          <div className="mb-4">
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
              Review
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-white/35 text-center mb-1.5">Before</p>
                <img
                  src={task.beforePhoto!}
                  alt="Before"
                  className="w-full aspect-video object-cover rounded-xl"
                />
              </div>
              <div>
                <p className="text-xs text-white/35 text-center mb-1.5">After</p>
                <img
                  src={task.afterPhoto!}
                  alt="After"
                  className="w-full aspect-video object-cover rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="glass rounded-2xl p-4 mb-6">
          <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-3">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add notes about this task..."
            rows={4}
            className="w-full bg-transparent text-white/80 text-sm placeholder-white/20 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={toggleComplete}
            className="w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-95"
            style={
              task.completed
                ? {
                    background: 'rgba(255,255,255,0.07)',
                    color: 'rgba(255,255,255,0.55)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }
                : {
                    background: 'linear-gradient(135deg, #2ed573, #00d4ff)',
                    color: '#000',
                    boxShadow: '0 0 30px rgba(46,213,115,0.3)',
                  }
            }
          >
            {task.completed ? '↩ Mark as Active' : '✓ Mark as Complete'}
          </button>

          <button
            onClick={deleteTask}
            className="w-full py-3 rounded-2xl text-sm text-red-500/50 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20"
          >
            Delete task
          </button>
        </div>
      </main>
    </div>
  );
}
