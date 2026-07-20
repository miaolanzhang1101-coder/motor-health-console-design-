'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RobotCell, JobType, JobPriority, Job, JOB_TYPE_LABELS, JOB_PRIORITY_COLORS } from '../lib/cells';

interface JobComposerProps {
  cells: RobotCell[];
  onSend: (job: Omit<Job, 'id' | 'status' | 'createdAt'>) => void;
}

const JOB_TYPES: JobType[] = ['inspect', 'pick-place', 'return-home', 'calibrate'];
const PRIORITIES: JobPriority[] = ['low', 'normal', 'high', 'critical'];

export default function JobComposer({ cells, onSend }: JobComposerProps) {
  const [expanded, setExpanded] = useState(false);
  const [cellId, setCellId] = useState<string>(cells[0]?.id ?? '');
  const [jobType, setJobType] = useState<JobType>('inspect');
  const [priority, setPriority] = useState<JobPriority>('normal');
  const [note, setNote] = useState('');
  const noteRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K opens the composer, Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setExpanded(true);
        setTimeout(() => noteRef.current?.focus(), 30);
      }
      if (e.key === 'Escape' && expanded) {
        setExpanded(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded]);

  const send = () => {
    if (!cellId) return;
    onSend({ cellId, type: jobType, priority, note: note.trim() || undefined });
    setNote('');
    setExpanded(false);
  };

  return (
    <div className="border border-[#1E212A] bg-[#0D0F13]">
      <button
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded) setTimeout(() => noteRef.current?.focus(), 30);
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#111318] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[#4A4E5C] text-xs">⌘</span>
          <span className="text-xs font-mono text-[#7C8090]">Send a job to a cell</span>
        </div>
        <span className="text-[9px] font-mono text-[#4A4E5C]">⌘K</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#1E212A] p-3 flex flex-col gap-2.5">
              <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                <span className="text-[10px] font-mono text-[#4A4E5C]">Cell</span>
                <select
                  value={cellId}
                  onChange={(e) => setCellId(e.target.value)}
                  className="bg-[#111318] border border-[#1E212A] px-2 py-1.5 text-xs font-mono text-[#D7D9E0] focus:outline-none focus:border-[#3B82F6]"
                >
                  {cells.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.location}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                <span className="text-[10px] font-mono text-[#4A4E5C]">Type</span>
                <div className="flex gap-1">
                  {JOB_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setJobType(t)}
                      className="text-[10px] font-mono px-2 py-1 border transition-colors"
                      style={{
                        borderColor: jobType === t ? '#3B82F6' : '#1E212A',
                        color: jobType === t ? '#3B82F6' : '#7C8090',
                        background: jobType === t ? '#3B82F610' : 'transparent',
                      }}
                    >
                      {JOB_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                <span className="text-[10px] font-mono text-[#4A4E5C]">Priority</span>
                <div className="flex gap-1">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className="text-[10px] font-mono uppercase px-2 py-1 border transition-colors"
                      style={{
                        borderColor: priority === p ? JOB_PRIORITY_COLORS[p] : '#1E212A',
                        color: priority === p ? JOB_PRIORITY_COLORS[p] : '#7C8090',
                        background: priority === p ? `${JOB_PRIORITY_COLORS[p]}10` : 'transparent',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                <span className="text-[10px] font-mono text-[#4A4E5C]">Note</span>
                <input
                  ref={noteRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                  placeholder="Optional — press Enter to send"
                  className="bg-[#111318] border border-[#1E212A] px-2 py-1.5 text-xs font-mono text-[#D7D9E0] focus:outline-none focus:border-[#3B82F6] placeholder:text-[#4A4E5C]"
                />
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-[9px] font-mono text-[#4A4E5C]">Enter to send · Esc to close</span>
                <button
                  onClick={send}
                  className="text-[10px] font-mono uppercase px-3 py-1.5 border border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20 transition-colors"
                >
                  Send job
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}