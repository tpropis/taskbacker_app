'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Camera, CheckSquare, Plus, X, CheckCircle2 } from 'lucide-react';
import Header from '@/components/Header';
import TaskCard from '@/components/TaskCard';
import { getTasks, saveTasks, createTask, Task, Priority, Category } from '@/lib/tasks';

// ── Create task modal ────────────────────────────────────────────────────────
function CreateTaskModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (task: Task) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState<Category>('Work');

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(createTask({ title, description, priority, category }));
    onClose();
  };

  const priorityConfig: Record<Priority, { label: string; active: string; inactive: string }> = {
    high:   { label: 'High',   active: 'bg-red-600 text-white border-red-600',         inactive: 'bg-red-50 text-red-600 border-red-200' },
    medium: { label: 'Medium', active: 'bg-orange-500 text-white border-orange-500',   inactive: 'bg-orange-50 text-orange-600 border-orange-200' },
    low:    { label: 'Low',    active: 'bg-emerald-600 text-white border-emerald-600', inactive: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">New Task</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Title <span className="text-red-400 normal-case font-normal">*</span>
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="e.g. Fix leaking pipe in bathroom"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to happen?"
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Priority
            </label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as Priority[]).map((p) => {
                const cfg = priorityConfig[p];
                return (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      priority === p ? cfg.active : cfg.inactive
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white"
            >
              {(['Work', 'Design', 'Engineering', 'Personal', 'Team'] as Category[]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    setTasks(getTasks());
  }, []);

  const handleToggle = useCallback(
    (id: string) => {
      const updated = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
      setTasks(updated);
      saveTasks(updated);
    },
    [tasks],
  );

  const handleCreateTask = useCallback(
    (task: Task) => {
      const updated = [task, ...tasks];
      setTasks(updated);
      saveTasks(updated);
    },
    [tasks],
  );

  const filtered = tasks.filter((t) => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const active = tasks.filter((t) => !t.completed).length;
  const done = tasks.filter((t) => t.completed).length;
  const scanned = tasks.filter((t) => t.beforePhoto && t.afterPhoto).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-3xl mx-auto px-5 pt-20 pb-28">

        {/* ── Empty state ── */}
        {tasks.length === 0 && (
          <div className="mt-4 mb-6">
            <h1 className="text-xl font-bold text-slate-900 mb-1">Get started</h1>
            <p className="text-slate-400 text-sm mb-5">Document jobs with before &amp; after photos.</p>
            <div className="space-y-2.5">
              {[
                { icon: <Plus size={17} className="text-indigo-600" />, bg: 'bg-indigo-50', title: 'Add a task', desc: 'Tap + to describe the job' },
                { icon: <Camera size={17} className="text-amber-500" />, bg: 'bg-amber-50', title: 'Scan the problem', desc: 'AI rates the issue 0–100' },
                { icon: <CheckCircle2 size={17} className="text-emerald-600" />, bg: 'bg-emerald-50', title: 'Fix & scan again', desc: 'Prove the work is done' },
              ].map((item) => (
                <div key={item.title} className="bg-white rounded-2xl px-4 py-3 border border-slate-100 flex items-center gap-3.5">
                  <div className={`w-8 h-8 ${item.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Section header + Filters ── */}
        {tasks.length > 0 && (
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-slate-900">Tasks</h1>
            <span className="text-xs text-slate-400 font-medium">
              {active} active · {done} done{scanned > 0 ? ` · ${scanned} scanned` : ''}
            </span>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5 mb-3">
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-[9px] text-sm transition-all ${
                filter === f
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-500 font-medium'
              }`}
            >
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Done'}
            </button>
          ))}
        </div>

        {/* ── Task list ── */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckSquare size={20} className="text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm">
                {filter === 'completed' ? 'No completed tasks yet' : filter === 'active' ? 'No active tasks' : 'No tasks yet'}
              </p>
              {filter === 'all' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all"
                >
                  Add your first task
                </button>
              )}
            </div>
          ) : (
            filtered.map((task) => (
              <Link key={task.id} href={`/tasks/${task.id}`} className="block active:scale-[0.99] transition-transform">
                <TaskCard task={task} onToggle={handleToggle} />
              </Link>
            ))
          )}
        </div>

      </main>

      {/* ── FAB ── */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed z-40 w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-200/60 flex items-center justify-center transition-transform active:scale-90"
        style={{
          bottom: 'calc(68px + env(safe-area-inset-bottom, 0px))',
          right: '20px',
        }}
        aria-label="New task"
      >
        <Plus size={26} />
      </button>

      {showCreateModal && (
        <CreateTaskModal onClose={() => setShowCreateModal(false)} onSave={handleCreateTask} />
      )}
    </div>
  );
}
