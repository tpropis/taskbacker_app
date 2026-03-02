'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Camera, Zap, Image, CheckSquare, ChevronRight,
  Plus, X, ChevronDown, ArrowRight,
} from 'lucide-react';
import Header from '@/components/Header';
import TaskCard from '@/components/TaskCard';
import { getTasks, saveTasks, createTask, Task, Priority, Category } from '@/lib/tasks';

// ── Animated stat counter ────────────────────────────────────────────────────
function StatCounter({ value, label, color }: { value: number; label: string; color: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame = 0;
    const total = 40;
    const timer = setInterval(() => {
      frame++;
      setDisplay(Math.round((value * frame) / total));
      if (frame >= total) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [value]);
  return (
    <div className="text-center">
      <div className="text-4xl font-black" style={{ color, textShadow: `0 0 20px ${color}` }}>
        {display}
      </div>
      <div className="text-xs text-white/50 mt-1 uppercase tracking-widest">{label}</div>
    </div>
  );
}

// ── Floating preview card ────────────────────────────────────────────────────
function HeroPreviewCard({
  title,
  priority,
  delay,
  x,
  y,
  hasPhoto,
}: {
  title: string;
  priority: Priority;
  delay: number;
  x: number;
  y: number;
  hasPhoto?: boolean;
}) {
  const color = priority === 'high' ? '#ff4757' : priority === 'medium' ? '#ffa502' : '#2ed573';
  return (
    <div
      className="absolute glass rounded-xl px-3 py-2 text-xs font-medium pointer-events-none select-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        borderLeft: `3px solid ${color}`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 20px ${color}22`,
        animation: `float 6s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        minWidth: 150,
      }}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-white/90">{title}</span>
        {hasPhoto && <span className="ml-auto text-emerald-400 text-xs">✓</span>}
      </div>
    </div>
  );
}

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-strong rounded-2xl p-6 w-full max-w-md neon-border-blue">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold gradient-text-blue-purple">New Task</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">
              Task Title *
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="What needs to be done?"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 transition-all text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 transition-all text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">
                Priority
              </label>
              <div className="flex gap-2">
                {(['high', 'medium', 'low'] as Priority[]).map((p) => {
                  const colors = { high: '#ff4757', medium: '#ffa502', low: '#2ed573' };
                  return (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className="flex-1 py-2 rounded-lg text-xs font-bold transition-all capitalize"
                      style={{
                        backgroundColor: priority === p ? colors[p] + '33' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${priority === p ? colors[p] : 'rgba(255,255,255,0.1)'}`,
                        color: priority === p ? colors[p] : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all appearance-none"
              >
                {(['Work', 'Design', 'Engineering', 'Personal', 'Team'] as Category[]).map((c) => (
                  <option key={c} value={c} className="bg-gray-900">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-black transition-all disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
              boxShadow: title.trim() ? '0 0 30px rgba(0,212,255,0.4)' : 'none',
            }}
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
    <div className="min-h-screen bg-black">
      <Header />

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 depth-grid opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/40 via-black to-cyan-950/30" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="lidar-scan-line" />

        {/* Floating preview cards */}
        <div className="absolute inset-0 pointer-events-none hidden md:block">
          <HeroPreviewCard title="Fix server room wiring" priority="high" delay={0} x={6} y={22} hasPhoto />
          <HeroPreviewCard title="Paint office wall" priority="medium" delay={1.5} x={70} y={18} />
          <HeroPreviewCard title="Replace broken fixture" priority="high" delay={0.8} x={76} y={52} hasPhoto />
          <HeroPreviewCard title="Update signage" priority="low" delay={2.2} x={4} y={58} />
          <HeroPreviewCard title="Clean HVAC filters" priority="medium" delay={3} x={58} y={72} />
        </div>

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass neon-border-blue mb-8 text-sm text-cyan-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Document → Review → Complete
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black leading-none mb-6 tracking-tight">
            <span className="text-white">Your tasks,</span>
            <br />
            <span className="gradient-text">backed by proof</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Capture before & after photos for every task. Scan the problem, fix it,
            scan the result. Visual proof your work is done — no spreadsheets required.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/ar"
              className="group relative flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg text-black overflow-hidden transition-transform hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #00d4ff 0%, #8b5cf6 100%)',
                boxShadow: '0 0 60px rgba(0,212,255,0.4), 0 0 120px rgba(139,92,246,0.2)',
              }}
            >
              <Camera size={22} />
              Start Scanning
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            <button
              onClick={() => {
                document.getElementById('tasks-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-lg text-white/70 hover:text-white glass neon-border-blue transition-all hover:scale-105"
            >
              View Tasks
              <ChevronDown size={18} className="animate-bounce" />
            </button>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <ChevronDown size={16} className="text-white/30 animate-bounce" />
        </div>
      </section>

      {/* ── Feature highlights ── */}
      <section className="relative py-24 px-4">
        <div className="absolute inset-0 depth-grid opacity-20" />
        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              <span className="gradient-text">Built for field work</span>
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Every feature designed for teams who need proof, not just promises.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Camera size={28} />,
                color: '#00d4ff',
                title: 'Before & After Photos',
                desc: 'Capture the problem, fix it, capture the proof. Visual documentation that speaks for itself.',
              },
              {
                icon: <Image size={28} />,
                color: '#8b5cf6',
                title: 'Visual Review',
                desc: 'Side-by-side comparison of before and after photos. See the progress, share the evidence.',
              },
              {
                icon: <CheckSquare size={28} />,
                color: '#2ed573',
                title: 'Completion Tracking',
                desc: 'Tasks marked complete only when documented. No more "I think it's done" ambiguity.',
              },
              {
                icon: <Zap size={28} />,
                color: '#ffa502',
                title: 'Works Offline',
                desc: 'All data stored locally on your device. Photos, tasks, notes — always available.',
              },
              {
                icon: <Camera size={28} />,
                color: '#ff007a',
                title: 'Native Camera',
                desc: 'Opens your iPhone camera directly. No permissions hassle. Tap, shoot, done.',
              },
              {
                icon: <ArrowRight size={28} />,
                color: '#00d4ff',
                title: 'No App Needed',
                desc: 'Open taskbacker.com in Safari. Works instantly — no download, no sign-up required.',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group glass rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02]"
                style={{
                  border: `1px solid rgba(255,255,255,0.06)`,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = feature.color + '44';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 40px rgba(0,0,0,0.3), 0 0 40px ${feature.color}22`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.2)';
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: feature.color + '1a', color: feature.color }}
                >
                  {feature.icon}
                </div>
                <h3 className="font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto glass-strong rounded-3xl p-8 neon-border-blue">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 divide-x divide-white/10">
            <StatCounter value={stats.total} label="Total Tasks" color="#00d4ff" />
            <div className="pl-8">
              <StatCounter value={stats.active} label="In Progress" color="#8b5cf6" />
            </div>
            <div className="pl-8">
              <StatCounter value={stats.completed} label="Completed" color="#2ed573" />
            </div>
            <div className="pl-8">
              <StatCounter value={stats.documented} label="Documented" color="#ffa502" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Task list ── */}
      <section id="tasks-section" className="pb-32 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black gradient-text-blue-purple">Your Tasks</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
                boxShadow: '0 0 20px rgba(0,212,255,0.3)',
              }}
            >
              <Plus size={16} />
              New Task
            </button>
          </div>

          <div className="flex gap-2 mb-6">
            {(['all', 'active', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                  filter === f
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                    : 'text-white/50 hover:text-white glass border border-white/5'
                }`}
              >
                {f}{' '}
                {f === 'all'
                  ? `(${stats.total})`
                  : f === 'active'
                  ? `(${stats.active})`
                  : `(${stats.completed})`}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                <Zap size={40} className="mx-auto mb-3 opacity-40" />
                <p>No tasks yet. Create one!</p>
              </div>
            ) : (
              filtered.map((task) => (
                <div key={task.id} className="flex items-stretch gap-2">
                  <div className="flex-1 min-w-0">
                    <TaskCard task={task} onToggle={handleToggle} />
                  </div>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="flex items-center px-3 glass rounded-2xl text-white/30 hover:text-cyan-400 border border-white/5 hover:border-cyan-500/30 transition-all flex-shrink-0"
                    title="View details & photos"
                  >
                    <ChevronRight size={18} />
                  </Link>
                </div>
              ))
            )}
          </div>

          {/* Scan CTA */}
          <div className="mt-12 glass-strong rounded-3xl p-8 text-center neon-border-blue relative overflow-hidden">
            <div className="lidar-scan-line opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5" />
            <div className="relative">
              <Camera size={40} className="mx-auto mb-4 text-cyan-400" />
              <h3 className="text-xl font-black mb-2 gradient-text-blue-purple">Ready to document?</h3>
              <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">
                Open Scan Mode to capture before & after photos for your tasks. Works right in Safari.
              </p>
              <Link
                href="/ar"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-black text-sm transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
                  boxShadow: '0 0 30px rgba(0,212,255,0.4)',
                }}
              >
                <Camera size={18} />
                Open Scan Mode
              </Link>
            </div>
          </div>
        </div>
      </section>

      {showCreateModal && (
        <CreateTaskModal onClose={() => setShowCreateModal(false)} onSave={handleCreateTask} />
      )}
    </div>
  );
}
