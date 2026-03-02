export type Priority = 'high' | 'medium' | 'low';
export type Category = 'Work' | 'Design' | 'Engineering' | 'Personal' | 'Team';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  completed: boolean;
  category: Category;
  dueDate?: string;
  arPlaced?: boolean;
  createdAt: string;
  beforePhoto?: string;
  afterPhoto?: string;
  notes?: string;
}

const STORAGE_KEY = 'taskbacker_tasks';

const defaultTasks: Task[] = [
  {
    id: '1',
    title: 'Review project proposal',
    description: 'Check the latest project proposal and provide feedback',
    priority: 'high',
    completed: false,
    category: 'Work',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Update design system',
    description: 'Update components to match new brand guidelines',
    priority: 'medium',
    completed: false,
    category: 'Design',
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Fix auth bug on iOS',
    description: 'Users experiencing login issues on iOS devices',
    priority: 'high',
    completed: false,
    category: 'Engineering',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Quarterly report',
    description: 'Q4 performance metrics and future projections',
    priority: 'medium',
    completed: true,
    category: 'Work',
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    title: 'Standup prep',
    description: "Prepare talking points for tomorrow's team standup",
    priority: 'low',
    completed: false,
    category: 'Team',
    createdAt: new Date().toISOString(),
  },
  {
    id: '6',
    title: 'Document server room wiring',
    description: 'Photograph before/after the cable management cleanup',
    priority: 'high',
    completed: false,
    category: 'Engineering',
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

export function getTasks(): Task[] {
  if (typeof window === 'undefined') return defaultTasks;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultTasks));
      return defaultTasks;
    }
    return JSON.parse(stored) as Task[];
  } catch {
    return defaultTasks;
  }
}

export function saveTasks(tasks: Task[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }
}

export function createTask(data: Omit<Task, 'id' | 'createdAt' | 'completed'>): Task {
  return {
    ...data,
    id: crypto.randomUUID(),
    completed: false,
    createdAt: new Date().toISOString(),
  };
}

export function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'high': return '#ff4757';
    case 'medium': return '#ffa502';
    case 'low': return '#2ed573';
  }
}

export function getPriorityGlow(priority: Priority): string {
  switch (priority) {
    case 'high': return 'rgba(255,71,87,0.6)';
    case 'medium': return 'rgba(255,165,2,0.6)';
    case 'low': return 'rgba(46,213,115,0.6)';
  }
}

export function getCategoryIcon(category: Category): string {
  switch (category) {
    case 'Work': return '💼';
    case 'Design': return '🎨';
    case 'Engineering': return '⚙️';
    case 'Personal': return '🌟';
    case 'Team': return '👥';
  }
}

export function formatDueDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}
