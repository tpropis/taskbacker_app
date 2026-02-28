'use client';

import { useState } from 'react';
import { Check, ChevronRight, Clock, Tag } from 'lucide-react';
import {
  Task,
  Priority,
  getPriorityColor,
  getPriorityGlow,
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

export default function TaskCard({ task, onToggle, onSelect, selected, compact }: Props) {
  const [hovered, setHovered] = useState(false);
  const priorityColor = getPriorityColor(task.priority);
  const priorityGlow = getPriorityGlow(task.priority);

  if (compact) {
    return (
      <div
        onClick={() => onSelect?.(task)}
        className={`
          flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200
          ${selected
            ? 'bg-cyan-500/20 border border-cyan-500/50'
            : 'glass border border-white/5 hover:border-white/15'}
          ${task.completed ? 'opacity-50' : ''}
        `}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
          className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all"
          style={{
            borderColor: task.completed ? priorityColor : 'rgba(255,255,255,0.3)',
            backgroundColor: task.completed ? priorityColor : 'transparent',
          }}
        >
          {task.completed && <Check size={10} className="text-black" strokeWidth={3} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${task.completed ? 'line-through text-white/40' : 'text-white'}`}>
            {task.title}
          </p>
        </div>
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: priorityColor, boxShadow: `0 0 6px ${priorityColor}` }}
        />
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        relative overflow-hidden rounded-2xl transition-all duration-300 cursor-pointer group
        ${selected ? 'scale-[1.02]' : 'hover:scale-[1.01]'}
        ${task.completed ? 'opacity-60' : ''}
      `}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: selected
          ? `1px solid rgba(0,212,255,0.6)`
          : `1px solid rgba(255,255,255,0.07)`,
        boxShadow: hovered || selected
          ? `0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px ${priorityGlow.replace('0.6', '0.2')}`
          : '0 2px 12px rgba(0,0,0,0.2)',
      }}
      onClick={() => onSelect?.(task)}
    >
      {/* Priority accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: priorityColor, boxShadow: `0 0 16px ${priorityGlow}` }}
      />

      {/* Hover glow overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          background: `radial-gradient(circle at 30% 50%, ${priorityGlow.replace('0.6', '0.05')}, transparent 70%)`,
        }}
      />

      <div className="pl-5 pr-4 py-4">
        <div className="flex items-start gap-3">
          {/* Complete toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
            className="mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200 hover:scale-110"
            style={{
              borderColor: task.completed ? priorityColor : 'rgba(255,255,255,0.25)',
              backgroundColor: task.completed ? priorityColor : 'transparent',
              boxShadow: task.completed ? `0 0 10px ${priorityGlow}` : 'none',
            }}
          >
            {task.completed && <Check size={12} className="text-black" strokeWidth={3} />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`font-semibold text-base leading-tight ${task.completed ? 'line-through text-white/40' : 'text-white'}`}>
                {task.title}
              </h3>
            </div>
            <p className="text-sm text-white/50 leading-snug mb-3 line-clamp-2">
              {task.description}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Priority badge */}
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full priority-${task.priority}`}
              >
                {task.priority.toUpperCase()}
              </span>

              {/* Category */}
              <span className="flex items-center gap-1 text-xs text-white/40">
                <Tag size={10} />
                {getCategoryIcon(task.category)} {task.category}
              </span>

              {/* Due date */}
              {task.dueDate && (
                <span className="flex items-center gap-1 text-xs text-white/40">
                  <Clock size={10} />
                  {formatDueDate(task.dueDate)}
                </span>
              )}

              {/* AR placed indicator */}
              {task.arPlaced && (
                <span className="flex items-center gap-1 text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  ◉ In AR Space
                </span>
              )}
            </div>
          </div>

          <ChevronRight
            size={16}
            className="text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0 mt-1"
          />
        </div>
      </div>
    </div>
  );
}
