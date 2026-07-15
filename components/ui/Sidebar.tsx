'use client';
import { ViewKey } from '../../lib/types';

interface SidebarProps {
  view: ViewKey;
  onNavigate: (v: ViewKey) => void;
}

const NAV_ITEMS: { key: ViewKey; label: string; icon: string }[] = [
  { key: 'fleet', label: 'Fleet', icon: '▤' },
  { key: 'inspector', label: 'Inspector', icon: '◎' },
  { key: 'setup', label: 'Setup', icon: '⚙' },
  { key: 'map', label: 'Fleet Map', icon: '⬡' },
  { key: 'builder', label: 'Builder', icon: '⊞' },
];

export default function Sidebar({ view, onNavigate }: SidebarProps) {
  return (
    <aside className="w-12 shrink-0 bg-[#0D0F13] border-r border-[#1E212A] flex flex-col items-center py-3 gap-1">
      <div className="w-6 h-6 flex items-center justify-center mb-3 border border-[#2A2E3A] text-[10px] font-mono text-[#3B82F6]">
        R
      </div>

      {NAV_ITEMS.map((item) => {
        const active = view === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            title={item.label}
            className={`w-9 h-9 flex items-center justify-center text-sm transition-colors ${
              active
                ? 'bg-[#15171D] text-[#3B82F6] border-l-2 border-[#3B82F6]'
                : 'text-[#4A4E5C] hover:text-[#7C8090] border-l-2 border-transparent'
            }`}
          >
            {item.icon}
          </button>
        );
      })}
    </aside>
  );
}