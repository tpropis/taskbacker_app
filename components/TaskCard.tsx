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
  high:   { dot: 'bg-red-500',    label: 'text-red-600 bg-red-50 border border-red-200' },
  medium: { dot: 'bg-orange-400', label: 'text-orange-600 bg-orange-50 border border-orange-200' },
  low:    { dot: 'bg-green-500',  label: 'text-green-700 bg-green-50 border border-green-200' },
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
        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
          selected
            ? 'bg-blue-50 border-blue-300'
            : 'bg-white border-gray-200 hover:border-gray-300'
        } ${task.completed ? 'opacity-50' : ''}`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            task.completed ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-400'
          }`}
        >
          {task.completed && <Check size={10} className="text-white" strokeWidth={3} />}
        </button>
        <p className={`text-sm font-medium flex-1 truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {task.title}
        </p>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ps.dot}`} />
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-xl border transition-all cursor-pointer ${
        selected ? 'border-blue-400 shadow-sm' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      } ${task.completed ? 'opacity-60' : ''}`}
      onClick={() => onSelect?.(task)}
    >
      {/* Priority accent bar */}
      <div className={`h-1 rounded-t-xl ${ps.dot}`} />

      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          {/* Complete toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
              task.completed ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-500'
            }`}
          >
            {task.completed && <Check size={10} className="text-white" strokeWidth={3} />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-sm leading-snug ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {task.title}
            </h3>
            {task.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ps.label}`}>
                {task.priority}
              </span>
              <span className="text-xs text-gray-400">
                {getCategoryIcon(task.category)} {task.category}
              </span>
              {task.dueDate && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock size={10} />
                  {formatDueDate(task.dueDate)}
                </span>
              )}
              {/* Scan status */}
              {scanStatus === 'both' && (
                <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
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

          {/* Score badge if scanned */}
          {task.afterScore !== undefined && (
            <div className="flex-shrink-0 text-center">
              <div className="text-lg font-black text-gray-900">{task.afterScore}</div>
              <div className="text-[10px] text-gray-400 -mt-0.5">score</div>
            </div>
          )}
          {task.beforeScore !== undefined && task.afterScore === undefined && (
            <div className="flex-shrink-0 text-center">
              <div className="text-lg font-black text-orange-500">{task.beforeScore}</div>
              <div className="text-[10px] text-gray-400 -mt-0.5">before</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
