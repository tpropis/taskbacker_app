'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2, MessageSquare } from 'lucide-react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

function loadTaskContext(): string {
  try {
    const stored = localStorage.getItem('taskbacker_tasks');
    if (!stored) return '';
    const tasks = JSON.parse(stored) as Array<{
      title: string;
      priority: string;
      category: string;
      completed: boolean;
      beforeScore?: number;
      afterScore?: number;
      description?: string;
    }>;
    if (!tasks.length) return '';
    return tasks
      .map((t) => {
        const scores =
          t.beforeScore !== undefined && t.afterScore !== undefined
            ? ` | before: ${t.beforeScore}, after: ${t.afterScore}`
            : t.beforeScore !== undefined
            ? ` | before score: ${t.beforeScore}`
            : '';
        return `- ${t.title} [${t.priority}, ${t.category}${t.completed ? ', done' : ''}${scores}]${t.description ? `: ${t.description}` : ''}`;
      })
      .join('\n');
  } catch {
    return '';
  }
}

export default function GhstAIChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [taskContext, setTaskContext] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Refresh task context each time the panel opens
      setTaskContext(loadTaskContext());
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, taskContext }),
      });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      const reply = typeof data.message === 'string' && data.message ? data.message : 'No response received.';
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, taskContext]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open GhstAI chat"
        className="fixed bottom-6 right-5 z-50 w-14 h-14 rounded-full bg-gray-900 text-white shadow-xl flex items-center justify-center hover:bg-gray-800 transition-all active:scale-95"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
      >
        {open ? <X size={22} /> : <MessageSquare size={22} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-5 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ maxHeight: '70vh', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <MessageSquare size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm leading-none">GhstAI</p>
              <p className="text-gray-400 text-[11px] mt-0.5">Powered by Claude</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MessageSquare size={20} className="text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Ask GhstAI anything</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Get help with tasks, understand your scan scores, or ask for productivity tips.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
                  <Loader2 size={14} className="text-gray-400 animate-spin" />
                  <span className="text-xs text-gray-400">Thinking…</span>
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Message GhstAI…"
                disabled={loading}
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white disabled:opacity-40 hover:bg-blue-700 transition-all active:scale-95 flex-shrink-0"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
