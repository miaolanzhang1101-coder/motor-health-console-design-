'use client';
import { ReactNode } from 'react';

interface Column<T> {
  key: string;
  label: string;
  render: (row: T, index: number) => ReactNode;
  align?: 'left' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  maxHeight?: number;
}

export default function DataTable<T>({ columns, rows, maxHeight = 260 }: DataTableProps<T>) {
  const gridCols = columns.map(() => '1fr').join(' ');

  return (
    <div className="border border-[#1E212A]" style={{ maxHeight, overflowY: 'auto' }}>
      <div
        className="grid gap-3 px-3 py-2 border-b border-[#1E212A] text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] sticky top-0 bg-[#111318]"
        style={{ gridTemplateColumns: gridCols }}
      >
        {columns.map((c) => (
          <span key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
            {c.label}
          </span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid gap-3 px-3 py-1.5 border-b border-[#15171D] last:border-b-0 text-xs font-mono text-[#D7D9E0]"
          style={{ gridTemplateColumns: gridCols }}
        >
          {columns.map((c) => (
            <span key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
              {c.render(row, i)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}