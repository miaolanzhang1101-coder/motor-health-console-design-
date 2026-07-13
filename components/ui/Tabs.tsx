'use client';

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-4 border-b border-[#1E212A]">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`text-xs font-mono uppercase tracking-wide pb-2 border-b-2 transition-colors ${
            active === tab.key
              ? 'border-[#3B82F6] text-[#3B82F6]'
              : 'border-transparent text-[#7C8090] hover:text-[#D7D9E0]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}