'use client';

import { Check, Clock, Camera } from 'lucide-react';
import { Task, formatDueDate } from '@/lib/tasks';

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onSelect?: (task: Task) => void;
  selected?: boolean;
  compact?: boolean;
}

const stripe = {
  high:   'bg-rose-500',
  medium: 'bg-amber-400',
  low:    'bg-emerald-500',
};

const dot = {
  high:   'bg-rose-400',
  medium: 'bg-amber-400',
  low:    'bg-emerald-400',
};

function scorePill(score: number) {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (score >= 60) return 'bg-amber-50 text-amber-700 border border-amber-200';
  return 'bg-red-50 text-red-700 border border-red-200';
}

export default function TaskCard({ task, onToggle, onSelect, selected, compact }: Props) {
  if (compact) {
    return (
      <div
        onClick={() => onSelect?.(task)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
          selected ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'
        } ${task.completed ? 'opacity-50' : ''}`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            task.completed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
          }`}
        >
          {task.completed && <Check size={10} className="text-white" strokeWidth={3} />}
        </button>
        <p className={`text-sm font-medium flex-1 truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
          {task.title}
        </p>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot[task.priority]}`} />
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all active:scale-[0.99] ${
        selected ? 'ring-2 ring-indigo-300' : ''
      } ${task.completed ? 'opacity-60' : ''}`}
      onClick={() => onSelect?.(task)}
    >
      <div className="flex items-stretch">
        {/* Left priority stripe */}
        <div className={`w-[3px] flex-shrink-0 ${stripe[task.priority]}`} />

        {/* Content */}
        <div className="flex items-center gap-3 px-4 py-3.5 flex-1 min-w-0">
          {/* Toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
            className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
              task.completed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 hover:border-indigo-400'
            }`}
          >
            {task.completed && <Check size={10} className="text-white" strokeWidth={3} />}
          </button>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className={`text-[15px] font-semibold leading-snug ${
              task.completed ? 'line-through text-slate-400' : 'text-slate-900'
            }`}>
              {task.title}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[12px] text-slate-400">{task.category}</span>
              {task.dueDate && (
                <>
                  <span className="text-slate-300 text-[10px]">•</span>
                  <span className="text-[12px] text-slate-400 flex items-center gap-1">
                    <Clock size={10} />
                    {formatDueDate(task.dueDate)}
                  </span>
                </>
              )}
              {task.beforePhoto && (
                <>
                  <span className="text-slate-300 text-[10px]">•</span>
                  <Camera size={10} className={task.afterPhoto ? 'text-emerald-500' : 'text-amber-400'} />
                </>
              )}
            </div>
          </div>

          {/* Right: score pill OR priority dot */}
          <div className="flex-shrink-0">
            {task.afterScore !== undefined ? (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scorePill(task.afterScore)}`}>
                {task.afterScore}
              </span>
            ) : task.beforeScore !== undefined ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {task.beforeScore}
              </span>
            ) : (
              <div className={`w-2 h-2 rounded-full ${dot[task.priority]}`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
