'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Camera, CheckSquare, ChevronRight,
  Plus, X, CheckCircle2, ArrowRight,
  Layers, Zap, CheckCheck, ImageIcon,
} from 'lucide-react';
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
          <div>
            <h2 className="text-lg font-bold text-slate-900">New Task</h2>
            <p className="text-xs text-slate-400 mt-0.5">Fill in the details below</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Task Title <span className="text-red-400 normal-case font-normal">*</span>
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
              placeholder="What's the problem? What needs to happen?"
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

  const stats = {
    total: tasks.length,
    active: tasks.filter((t) => !t.completed).length,
    completed: tasks.filter((t) => t.completed).length,
    documented: tasks.filter((t) => t.beforePhoto && t.afterPhoto).length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-3xl mx-auto px-6 pt-24 pb-28">

        {/* ── How it works (empty state) ── */}
        {tasks.length === 0 && (
          <div className="mb-8">
            <div className="mb-6">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Welcome to TaskBacker</h1>
              <p className="text-slate-500 text-sm mt-1.5">
                Document jobs with before &amp; after photos. AI inspects every scan and gives a score.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                {
                  icon: <Plus size={20} className="text-indigo-600" />,
                  bg: 'bg-indigo-50',
                  border: 'border-indigo-100',
                  step: '01',
                  stepColor: 'text-indigo-400',
                  title: 'Add a task',
                  desc: 'Describe the job that needs doing',
                },
                {
                  icon: <Camera size={20} className="text-amber-500" />,
                  bg: 'bg-amber-50',
                  border: 'border-amber-100',
                  step: '02',
                  stepColor: 'text-amber-400',
                  title: 'Scan the problem',
                  desc: 'Point your camera — AI rates the issue',
                },
                {
                  icon: <CheckCircle2 size={20} className="text-emerald-600" />,
                  bg: 'bg-emerald-50',
                  border: 'border-emerald-100',
                  step: '03',
                  stepColor: 'text-emerald-400',
                  title: 'Fix & scan again',
                  desc: 'Prove the work is done with a score',
                },
              ].map((item) => (
                <div key={item.step} className={`bg-white rounded-2xl p-5 border ${item.border} shadow-sm`}>
                  <p className={`text-[10px] font-black tracking-widest mb-3 ${item.stepColor}`}>STEP {item.step}</p>
                  <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center mb-3`}>
                    {item.icon}
                  </div>
                  <p className="text-sm font-bold text-slate-900 mb-1">{item.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stats strip ── */}
        {tasks.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Total',      value: stats.total,      icon: <Layers size={16} />,     iconBg: 'bg-slate-100',  iconColor: 'text-slate-500',   numColor: 'text-slate-900' },
              { label: 'Active',     value: stats.active,     icon: <Zap size={16} />,        iconBg: 'bg-amber-50',   iconColor: 'text-amber-500',   numColor: 'text-amber-600' },
              { label: 'Done',       value: stats.completed,  icon: <CheckCheck size={16} />, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', numColor: 'text-emerald-600' },
              { label: 'Documented', value: stats.documented, icon: <ImageIcon size={16} />,  iconBg: 'bg-indigo-50',  iconColor: 'text-indigo-500',  numColor: 'text-indigo-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <div className={`w-8 h-8 ${s.iconBg} rounded-lg flex items-center justify-center mb-3 ${s.iconColor}`}>
                  {s.icon}
                </div>
                <div className={`text-2xl font-black leading-none ${s.numColor}`}>{s.value}</div>
                <div className="text-xs text-slate-400 mt-1 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Task list header ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Your Tasks</h2>
            {tasks.length > 0 && (
              <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full text-xs font-bold">
                {filtered.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-sm"
          >
            <Plus size={15} />
            New Task
          </button>
        </div>

        {/* ── Filters ── */}
        <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5 w-fit mb-5">
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-[9px] text-sm transition-all ${
                filter === f
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-700 font-medium'
              }`}
            >
              {f === 'all'
                ? `All (${stats.total})`
                : f === 'active'
                ? `Active (${stats.active})`
                : `Done (${stats.completed})`}
            </button>
          ))}
        </div>

        {/* ── Task list ── */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckSquare size={24} className="text-slate-400" />
              </div>
              <p className="text-slate-800 font-bold mb-1.5">
                {filter === 'completed'
                  ? 'No completed tasks yet'
                  : filter === 'active'
                  ? 'No active tasks'
                  : 'No tasks yet'}
              </p>
              <p className="text-slate-400 text-sm">
                {filter === 'all' && 'Add your first task to get started'}
              </p>
              {filter === 'all' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-5 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-sm"
                >
                  Add your first task
                </button>
              )}
            </div>
          ) : (
            filtered.map((task) => (
              <div key={task.id} className="flex items-stretch gap-2">
                <div className="flex-1 min-w-0">
                  <TaskCard task={task} onToggle={handleToggle} />
                </div>
                <Link
                  href={`/tasks/${task.id}`}
                  className="flex items-center px-3 bg-white rounded-xl text-slate-400 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 transition-all flex-shrink-0 shadow-sm"
                  title="View details & photos"
                >
                  <ChevronRight size={18} />
                </Link>
              </div>
            ))
          )}
        </div>

        {/* ── Scan CTA ── */}
        {tasks.length > 0 && (
          <div className="mt-8 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <Camera size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white mb-0.5">Ready to scan?</h3>
                <p className="text-indigo-200 text-sm">
                  Point your camera — AI inspects and scores in seconds.
                </p>
              </div>
              <Link
                href="/ar"
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-white text-indigo-700 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-all active:scale-95"
              >
                Scan
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </main>

      {showCreateModal && (
        <CreateTaskModal onClose={() => setShowCreateModal(false)} onSave={handleCreateTask} />
      )}
    </div>
  );
}
