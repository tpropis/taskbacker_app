'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Camera, Plus, X, CheckCircle2 } from 'lucide-react';
import Header from '@/components/Header';
import TaskCard from '@/components/TaskCard';
import { getTasks, saveTasks, createTask, Task, Priority, Category } from '@/lib/tasks';

// ── Create task modal ─────────────────────────────────────────────────────────
function CreateTaskModal({ onClose, onSave }: { onClose: () => void; onSave: (task: Task) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState<Category>('Work');

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(createTask({ title, description, priority, category }));
    onClose();
  };

  const priorities: { value: Priority; label: string; activeClass: string; idleClass: string }[] = [
    { value: 'high',   label: 'High',   activeClass: 'bg-rose-500 text-white',     idleClass: 'text-rose-600 bg-rose-50 border border-rose-200' },
    { value: 'medium', label: 'Medium', activeClass: 'bg-amber-500 text-white',    idleClass: 'text-amber-600 bg-amber-50 border border-amber-200' },
    { value: 'low',    label: 'Low',    activeClass: 'bg-emerald-600 text-white',  idleClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl">
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">New Task</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Task title…"
            className="w-full bg-slate-50 rounded-2xl px-4 py-3.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[15px] font-medium transition-all"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none transition-all"
          />

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Priority</p>
            <div className="flex gap-2">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    priority === p.value ? p.activeClass : p.idleClass
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Category</p>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              {(['Work', 'Design', 'Engineering', 'Personal', 'Team'] as Category[]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => { setTasks(getTasks()); }, []);

  const handleToggle = useCallback((id: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    setTasks(updated);
    saveTasks(updated);
  }, [tasks]);

  const handleCreateTask = useCallback((task: Task) => {
    const updated = [task, ...tasks];
    setTasks(updated);
    saveTasks(updated);
  }, [tasks]);

  const filtered = tasks.filter((t) => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const active = tasks.filter((t) => !t.completed).length;
  const done = tasks.filter((t) => t.completed).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-3xl mx-auto px-4 pt-20 pb-32">

        {/* ── Empty state ── */}
        {tasks.length === 0 && (
          <div className="flex flex-col items-center text-center mt-16">
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-5 shadow-lg shadow-indigo-200">
              <CheckCircle2 size={36} className="text-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">No tasks yet</h2>
            <p className="text-slate-400 text-sm mb-8 max-w-xs leading-relaxed">
              Add a task, scan before &amp; after with AI, and document your work.
            </p>
            <div className="w-full max-w-xs space-y-2.5 mb-8">
              {[
                { icon: <Plus size={16} className="text-indigo-600" />, bg: 'bg-indigo-50', title: 'Create a task', desc: 'Tap + below to get started' },
                { icon: <Camera size={16} className="text-amber-500" />, bg: 'bg-amber-50', title: 'Scan before', desc: 'AI rates the issue 0–100' },
                { icon: <CheckCircle2 size={16} className="text-emerald-600" />, bg: 'bg-emerald-50', title: 'Fix & scan after', desc: 'Prove the work is done' },
              ].map((item) => (
                <div key={item.title} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3.5 shadow-sm">
                  <div className={`w-8 h-8 ${item.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    {item.icon}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Heading + filter pills ── */}
        {tasks.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tasks</h1>
              <p className="text-xs text-slate-400 mt-0.5">{active} active · {done} done</p>
            </div>
            <div className="flex gap-1.5">
              {([
                { value: 'all',       label: 'All' },
                { value: 'active',    label: 'Active' },
                { value: 'completed', label: 'Done' },
              ] as const).map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    filter === f.value
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Task list ── */}
        {tasks.length > 0 && (
          <div className="space-y-2.5">
            {filtered.length === 0 ? (
              <div className="text-center py-14">
                <p className="text-slate-400 text-sm">
                  {filter === 'completed' ? 'No completed tasks yet' : 'No active tasks'}
                </p>
              </div>
            ) : (
              filtered.map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`} className="block">
                  <TaskCard task={task} onToggle={handleToggle} />
                </Link>
              ))
            )}
          </div>
        )}

      </main>

      {/* ── FAB ── */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed z-40 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl shadow-indigo-300/50 flex items-center justify-center transition-transform active:scale-90"
        style={{ bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))', right: '20px' }}
        aria-label="New task"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {showCreateModal && (
        <CreateTaskModal onClose={() => setShowCreateModal(false)} onSave={handleCreateTask} />
      )}
    </div>
  );
}
