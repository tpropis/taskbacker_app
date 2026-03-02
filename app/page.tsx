'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Camera, CheckSquare, ChevronRight,
  Plus, X, CheckCircle2, ArrowRight,
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
    high:   { label: 'High',   active: 'bg-red-600 text-white border-red-600',     inactive: 'bg-red-50 text-red-600 border-red-200' },
    medium: { label: 'Medium', active: 'bg-orange-500 text-white border-orange-500', inactive: 'bg-orange-50 text-orange-600 border-orange-200' },
    low:    { label: 'Low',    active: 'bg-green-600 text-white border-green-600',   inactive: 'bg-green-50 text-green-700 border-green-200' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Task Title *
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="e.g. Fix leaking pipe in bathroom"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's the problem? What needs to happen?"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Priority
            </label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as Priority[]).map((p) => {
                const cfg = priorityConfig[p];
                return (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
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
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
            >
              {(['Work', 'Design', 'Engineering', 'Personal', 'Team'] as Category[]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-24">

        {/* ── How it works (empty state) ── */}
        {tasks.length === 0 && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome to TaskBacker</h1>
            <p className="text-gray-500 text-sm mb-6">
              Document jobs with before &amp; after photos. AI inspects every scan and gives a score.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                {
                  icon: <Plus size={18} className="text-blue-600" />,
                  bg: 'bg-blue-50',
                  step: '1',
                  title: 'Add a task',
                  desc: 'Describe the job that needs doing',
                },
                {
                  icon: <Camera size={18} className="text-orange-500" />,
                  bg: 'bg-orange-50',
                  step: '2',
                  title: 'Scan the problem',
                  desc: 'Point your camera — AI rates the issue',
                },
                {
                  icon: <CheckCircle2 size={18} className="text-green-600" />,
                  bg: 'bg-green-50',
                  step: '3',
                  title: 'Fix & scan again',
                  desc: 'Prove the work is complete with a score',
                },
              ].map((item) => (
                <div key={item.step} className="bg-white rounded-xl p-4 border border-gray-200 text-center">
                  <div className={`w-9 h-9 ${item.bg} rounded-full flex items-center justify-center mx-auto mb-2`}>
                    {item.icon}
                  </div>
                  <p className="text-xs font-bold text-gray-400 mb-0.5">Step {item.step}</p>
                  <p className="text-sm font-bold text-gray-900 mb-1">{item.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stats strip ── */}
        {tasks.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total',      value: stats.total,      color: 'text-gray-900' },
              { label: 'Active',     value: stats.active,     color: 'text-orange-600' },
              { label: 'Done',       value: stats.completed,  color: 'text-green-600' },
              { label: 'Documented', value: stats.documented, color: 'text-blue-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-3 border border-gray-200 text-center">
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Task list header ── */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Your Tasks</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all active:scale-95"
          >
            <Plus size={15} />
            New Task
          </button>
        </div>

        {/* ── Filters ── */}
        <div className="flex gap-2 mb-4">
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900 bg-white border border-gray-200'
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
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckSquare size={22} className="text-gray-400" />
              </div>
              <p className="text-gray-900 font-semibold mb-1">
                {filter === 'completed'
                  ? 'No completed tasks yet'
                  : filter === 'active'
                  ? 'No active tasks'
                  : 'No tasks yet'}
              </p>
              <p className="text-gray-500 text-sm">
                {filter === 'all' && 'Add your first task to get started'}
              </p>
              {filter === 'all' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all"
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
                  className="flex items-center px-3 bg-white rounded-xl text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-300 transition-all flex-shrink-0"
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
          <div className="mt-8 bg-gray-900 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Camera size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white mb-0.5">Ready to scan?</h3>
                <p className="text-gray-400 text-sm">
                  Point your camera at a task area — AI inspects and scores it in seconds.
                </p>
              </div>
              <Link
                href="/ar"
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-white text-gray-900 rounded-xl font-bold text-sm hover:bg-gray-100 transition-all active:scale-95"
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
