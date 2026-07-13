'use client';
import { useState, ReactNode } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Checkbox from '../components/ui/Checkbox';
import Tabs from '../components/ui/Tabs';
import StatCard from '../components/ui/StatCard';
import DataTable from '../components/ui/DataTable';
import SeverityBadge from '../components/SeverityBadge';

type Category = 'all' | 'display' | 'actions' | 'forms' | 'charts' | 'spatial';

interface Widget {
  id: string;
  title: string;
  description: string;
  category: Exclude<Category, 'all'>;
  preview: ReactNode;
}

const CATEGORY_LABELS: Record<Category, string> = {
  all: 'All',
  display: 'Data Display',
  actions: 'Actions',
  forms: 'Forms',
  charts: 'Charts',
  spatial: 'Spatial',
};

export default function DesignSystemPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');

  const widgets: Widget[] = [
    {
      id: 'stat-card',
      title: 'Stat Card',
      description: 'Highlight a single KPI — used across Fleet Console and Motor Inspector headers.',
      category: 'display',
      preview: <StatCard label="Risk Level" value="Critical" color="#EF4444" />,
    },
    {
      id: 'data-table',
      title: 'Data Table',
      description: 'Dense tabular data with sticky headers — powers Window Data and Fleet listings.',
      category: 'display',
      preview: (
        <div className="scale-90 origin-top-left w-[220%]">
          <DataTable
            maxHeight={90}
            columns={[
              { key: 'a', label: 'Window', render: (r: { a: number; b: string }) => r.a },
              { key: 'b', label: 'RMS', render: (r: { a: number; b: string }) => r.b, align: 'right' },
            ]}
            rows={[{ a: 0, b: '0.41' }, { a: 1, b: '0.92' }]}
          />
        </div>
      ),
    },
    {
      id: 'severity-badge',
      title: 'Severity Badge',
      description: 'The single source of severity color/label truth — dot + text, three states.',
      category: 'display',
      preview: (
        <div className="flex gap-3">
          <SeverityBadge level="healthy" />
          <SeverityBadge level="critical" />
        </div>
      ),
    },
    {
      id: 'button-group',
      title: 'Button Group',
      description: 'Primary / danger / ghost variants — drives Acknowledge / Schedule / Escalate actions.',
      category: 'actions',
      preview: (
        <div className="flex gap-1.5">
          <Button variant="primary" size="sm">Acknowledge</Button>
          <Button variant="danger" size="sm" active>Escalate</Button>
        </div>
      ),
    },
    {
      id: 'tabs',
      title: 'Tabs',
      description: 'Switches detail panels without navigation — used in Motor Inspector.',
      category: 'actions',
      preview: <Tabs tabs={[{ key: 'a', label: 'Traces' }, { key: 'b', label: 'Windows' }]} active="a" onChange={() => {}} />,
    },
    {
      id: 'form-controls',
      title: 'Form Controls',
      description: 'Number input + checkbox — powers threshold override editing everywhere it appears.',
      category: 'forms',
      preview: (
        <div className="flex gap-3 items-center">
          <div className="w-16"><Input value={70} onChange={() => {}} type="number" color="#EF4444" /></div>
          <Checkbox checked onChange={() => {}} label="OVERRIDE" />
        </div>
      ),
    },
    {
      id: 'trace-chart',
      title: 'Signal Trace',
      description: 'Draggable rehearsal chart with fault markers and brush-to-zoom — the core interaction.',
      category: 'charts',
      preview: (
        <svg viewBox="0 0 120 40" className="w-full">
          <polyline points="0,30 20,25 40,10 60,20 80,15 100,28 120,8" fill="none" stroke="#22D3EE" strokeWidth={2} />
          <circle cx={120} cy={8} r={3} fill="#0A0B0D" stroke="#EF4444" strokeWidth={1.5} />
        </svg>
      ),
    },
    {
      id: 'network-graph',
      title: 'Inheritance Graph',
      description: 'Draggable node-link graph showing threshold inheritance and propagation.',
      category: 'spatial',
      preview: (
        <svg viewBox="0 0 120 60" className="w-full">
          <line x1={20} y1={30} x2={70} y2={15} stroke="#2A2E3A" strokeWidth={1} />
          <line x1={20} y1={30} x2={70} y2={45} stroke="#2A2E3A" strokeWidth={1} />
          <circle cx={20} cy={30} r={6} fill="#3B82F6" />
          <circle cx={70} cy={15} r={5} fill="#A78BFA" />
          <circle cx={70} cy={45} r={5} fill="#FB923C" />
        </svg>
      ),
    },
    {
      id: 'sensor-diagram',
      title: 'Sensor Diagram',
      description: 'Technical line-art of motor sensor mounts, colored by live severity.',
      category: 'spatial',
      preview: (
        <svg viewBox="0 0 120 50" className="w-full">
          <rect x={20} y={15} width={70} height={22} fill="none" stroke="#3D4552" strokeWidth={1.5} />
          <circle cx={20} cy={26} r={4} fill="#EF4444" />
          <circle cx={90} cy={26} r={4} fill="#2A2E3A" />
        </svg>
      ),
    },
  ];

  const filtered = widgets.filter((w) => {
    const matchesCategory = category === 'all' || w.category === category;
    const matchesQuery =
      query.trim() === '' ||
      w.title.toLowerCase().includes(query.toLowerCase()) ||
      w.description.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const categories: Category[] = ['all', 'display', 'actions', 'forms', 'charts', 'spatial'];

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#D7D9E0] font-sans">
      <div className="border-b border-[#1E212A] p-5 sticky top-0 bg-[#0A0B0D] z-10">
        <div className="flex items-center gap-2 border border-[#1E212A] bg-[#111318] px-3 py-2 max-w-md mb-4">
          <span className="text-[#4A4E5C] text-sm">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components…"
            className="bg-transparent flex-1 text-sm font-mono text-[#D7D9E0] focus:outline-none placeholder:text-[#4A4E5C]"
          />
        </div>
        <div className="flex gap-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-[11px] font-mono uppercase tracking-wide px-3 py-1.5 border-b-2 transition-colors ${
                category === c ? 'border-[#3B82F6] text-[#3B82F6]' : 'border-transparent text-[#7C8090] hover:text-[#D7D9E0]'
              }`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 grid grid-cols-3 gap-4">
        {filtered.map((w) => (
          <Card key={w.id} padded={false} className="overflow-hidden">
            <div className="h-24 bg-[#0D0F13] flex items-center justify-center px-4 border-b border-[#1E212A]">
              {w.preview}
            </div>
            <div className="p-3">
              <div className="text-sm font-mono font-semibold text-[#D7D9E0] mb-1">{w.title}</div>
              <div className="text-[11px] font-mono text-[#7C8090] leading-relaxed">{w.description}</div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center text-[#4A4E5C] text-xs font-mono py-10">No components match.</div>
        )}
      </div>
    </div>
  );
}