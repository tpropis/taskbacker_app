'use client';

import { Check, Clock, Camera } from 'lucide-react';
import {
  Task,
  getCategoryIcon,
  formatDueDate,
} from '@/lib/tasks';

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onSelect?: (task: Task) => void;
  selected?: boolean;
  compact?: boolean;
}

const priorityStyles = {
  high:   { border: 'border-l-red-500',     dot: 'bg-red-500',     label: 'text-red-600 bg-red-50 border border-red-200' },
  medium: { border: 'border-l-amber-400',   dot: 'bg-amber-400',   label: 'text-orange-600 bg-orange-50 border border-orange-200' },
  low:    { border: 'border-l-emerald-500', dot: 'bg-emerald-500', label: 'text-emerald-700 bg-emerald-50 border border-emerald-200' },
};

export default function TaskCard({ task, onToggle, onSelect, selected, compact }: Props) {
  const ps = priorityStyles[task.priority];
  const scanStatus = task.beforePhoto && task.afterPhoto
    ? 'both'
    : task.beforePhoto
    ? 'before'
    : 'none';

  if (compact) {
    return (
      <div
        onClick={() => onSelect?.(task)}
        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border border-l-[3px] ${ps.border} ${
          selected
            ? 'bg-indigo-50 border-indigo-300'
            : 'bg-white border-slate-200 hover:border-slate-300'
        } ${task.completed ? 'opacity-50' : ''}`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            task.completed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 hover:border-indigo-400'
          }`}
        >
          {task.completed && <Check size={10} className="text-white" strokeWidth={3} />}
        </button>
        <p className={`text-sm font-medium flex-1 truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
          {task.title}
        </p>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ps.dot}`} />
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-xl border border-l-[3px] ${ps.border} transition-all cursor-pointer shadow-sm ${
        selected ? 'border-indigo-400 shadow-md' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
      } ${task.completed ? 'opacity-60' : ''}`}
      onClick={() => onSelect?.(task)}
    >
      <div className="px-4 py-4">
        <div className="flex items-start gap-3">
          {/* Complete toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
              task.completed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 hover:border-indigo-500'
            }`}
          >
            {task.completed && <Check size={10} className="text-white" strokeWidth={3} />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-sm leading-snug ${task.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
              {task.title}
            </h3>
            {task.description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ps.label}`}>
                {task.priority}
              </span>
              <span className="text-xs text-slate-400">
                {getCategoryIcon(task.category)} {task.category}
              </span>
              {task.dueDate && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock size={10} />
                  {formatDueDate(task.dueDate)}
                </span>
              )}
              {scanStatus === 'both' && (
                <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <Camera size={9} />
                  Scanned
                </span>
              )}
              {scanStatus === 'before' && (
                <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                  <Camera size={9} />
                  Before only
                </span>
              )}
            </div>
          </div>

          {/* Score badge */}
          {task.afterScore !== undefined && (
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
              <div className="text-sm font-black text-emerald-700 leading-none">{task.afterScore}</div>
            </div>
          )}
          {task.beforeScore !== undefined && task.afterScore === undefined && (
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
              <div className="text-sm font-black text-amber-600 leading-none">{task.beforeScore}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
