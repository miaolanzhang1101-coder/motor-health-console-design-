'use client';
import { useState } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import {
  BLOCK_LIBRARY,
  BlockDefinition,
  BlockCategory,
  ProgramBlock,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
} from '../lib/inspectionBlocks';

type FilterCategory = BlockCategory | null;

let instanceCounter = 0;

export default function InspectionBuilder() {
  const [programName, setProgramName] = useState('New inspection routine');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [program, setProgram] = useState<ProgramBlock[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredBlocks = BLOCK_LIBRARY.filter((b) => {
    const catOk = !filterCategory || b.category === filterCategory;
    const queryOk =
      !searchQuery ||
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase());
    return catOk && queryOk;
  });

  const countByCategory = (cat: BlockCategory) => {
    const matching = BLOCK_LIBRARY.filter((b) => b.category === cat);
    const inFilter = filteredBlocks.filter((b) => b.category === cat);
    return filterCategory ? `${inFilter.length}/${matching.length}` : String(matching.length);
  };

  const addBlock = (def: BlockDefinition) => {
    const instance: ProgramBlock = {
      instanceId: `inst-${++instanceCounter}`,
      definitionId: def.id,
      values: Object.fromEntries(def.params.map((p) => [p.key, p.defaultValue])),
      configured: false,
    };
    setProgram((prev) => [...prev, instance]);
  };

  const removeBlock = (instanceId: string) => {
    setProgram((prev) => prev.filter((b) => b.instanceId !== instanceId));
    if (editingId === instanceId) setEditingId(null);
  };

  const updateBlockValue = (instanceId: string, key: string, value: string | number) => {
    setProgram((prev) =>
      prev.map((b) => (b.instanceId === instanceId ? { ...b, values: { ...b.values, [key]: value } } : b))
    );
  };

  const markConfigured = (instanceId: string) => {
    setProgram((prev) => prev.map((b) => (b.instanceId === instanceId ? { ...b, configured: true } : b)));
    setEditingId(null);
  };

  const editingBlock = program.find((b) => b.instanceId === editingId);
  const editingDef = editingBlock ? BLOCK_LIBRARY.find((d) => d.id === editingBlock.definitionId) : null;

  const allConfigured = program.length > 0 && program.every((b) => b.configured);
  const categories: BlockCategory[] = ['monitoring', 'actions', 'control'];

  return (
    <div className="flex" style={{ height: 'calc(100vh - 40px)' }}>
      {/* Left: Function Blocks library */}
      <div className="w-96 shrink-0 border-r border-[#1E212A] bg-[#0D0F13] overflow-y-auto flex flex-col">
        <div className="px-4 py-3 border-b border-[#1E212A]">
          <div className="text-xs font-mono font-semibold text-[#D7D9E0] uppercase tracking-wide">Function Blocks</div>
        </div>

        <div className="px-3 py-2 border-b border-[#1E212A] flex items-center gap-2">
          <span className="text-[#4A4E5C] text-xs">⌕</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter function blocks"
            className="flex-1 bg-transparent text-xs font-mono text-[#D7D9E0] focus:outline-none placeholder:text-[#4A4E5C]"
          />
          {filterCategory && (
            <button
              onClick={() => setFilterCategory(null)}
              className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 bg-[#3B82F6] text-white"
            >
              {CATEGORY_ICONS[filterCategory]} {CATEGORY_LABELS[filterCategory]} ✕
            </button>
          )}
        </div>

        <div className="px-3 py-2 flex gap-1.5 border-b border-[#1E212A]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
              className="text-[9px] font-mono uppercase px-2 py-1 border transition-colors"
              style={{
                borderColor: filterCategory === cat ? '#3B82F6' : '#1E212A',
                color: filterCategory === cat ? '#3B82F6' : '#7C8090',
                background: filterCategory === cat ? '#3B82F610' : 'transparent',
              }}
            >
              {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="px-3 py-2 flex gap-4 border-b border-[#1E212A]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
              className="text-[10px] font-mono"
              style={{ color: filterCategory === cat ? '#3B82F6' : '#7C8090' }}
            >
              {CATEGORY_LABELS[cat]} ({countByCategory(cat)})
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredBlocks.map((def) => (
            <div
              key={def.id}
              className="flex items-center justify-between px-3 py-2.5 border-b border-[#15171D] hover:bg-[#111318] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 flex items-center justify-center border border-[#2A2E3A] text-sm">{def.icon}</span>
                <div>
                  <span className="text-xs font-mono text-[#D7D9E0]">{def.name}</span>
                  <span className="text-[9px] font-mono text-[#4A4E5C] ml-2">{def.version}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-[#4A4E5C]">☆</span>
                <button
                  onClick={() => addBlock(def)}
                  className="w-6 h-6 flex items-center justify-center border border-[#2A2E3A] text-[#7C8090] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors text-xs"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Program canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#1E212A] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-[#D7D9E0] uppercase">Builder</span>
            <input
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              className="bg-[#111318] border border-[#1E212A] px-2 py-1 text-xs font-mono text-[#D7D9E0] focus:outline-none focus:border-[#3B82F6] w-56"
            />
            <span className="text-[9px] font-mono text-[#4A4E5C]">(draft)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={!allConfigured}>Save</Button>
            <Button variant="primary" size="sm" disabled={!allConfigured}>Save &amp; Run</Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="text-sm font-mono font-semibold text-[#D7D9E0] uppercase">Program</div>
          <div className="text-[10px] font-mono text-[#4A4E5C]">Add blocks from the left panel to build your inspection routine.</div>

          <div className="border border-[#1E212A] px-3 py-2 text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C]">
            ⊙ Input parameters
          </div>

          {program.map((block) => {
            const def = BLOCK_LIBRARY.find((d) => d.id === block.definitionId)!;
            return (
              <div key={block.instanceId} className="border border-[#1E212A] bg-[#111318] px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="cursor-grab text-[#4A4E5C]">⠿</span>
                  <span className="w-7 h-7 flex items-center justify-center border border-[#2A2E3A] text-sm">{def.icon}</span>
                  <span className="text-xs font-mono text-[#D7D9E0]">{def.name}</span>
                  <span className="text-[9px] font-mono text-[#4A4E5C]">{def.version}</span>
                  <span className="text-[9px] font-mono text-[#7C8090] italic">{def.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {block.configured && (
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 border border-[#3B82F6] text-[#3B82F6]">
                      Set parameters
                    </span>
                  )}
                  <button
                    onClick={() => setEditingId(block.instanceId)}
                    className="w-6 h-6 flex items-center justify-center border border-[#2A2E3A] text-[#7C8090] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors text-xs"
                    title="Edit parameters"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => removeBlock(block.instanceId)}
                    className="w-6 h-6 flex items-center justify-center border border-[#2A2E3A] text-[#7C8090] hover:border-[#22D3EE] hover:text-[#22D3EE] transition-colors text-xs"
                    title="Remove"
                  >
                    🗑
                  </button>
                  <span className="text-[#4A4E5C] text-xs">⋯</span>
                </div>
              </div>
            );
          })}

          {program.length === 0 && (
            <div className="border-2 border-dashed border-[#1E212A] py-12 flex flex-col items-center justify-center gap-2">
              <span className="text-[#4A4E5C] text-sm">+</span>
              <span className="text-[10px] font-mono text-[#4A4E5C] uppercase">Drop function block here</span>
            </div>
          )}
        </div>
      </div>

      {/* Edit parameters modal */}
      {editingBlock && editingDef && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-16">
          <div className="w-[600px] bg-[#0D0F13] border border-[#2A2E3A] shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E212A]">
              <span className="text-xs font-mono font-semibold text-[#D7D9E0] uppercase">
                Edit parameters: {editingDef.name}
              </span>
              <button onClick={() => setEditingId(null)} className="text-[#4A4E5C] hover:text-[#D7D9E0] text-sm">✕</button>
            </div>

            <div className="flex px-4 pt-3 gap-2 border-b border-[#1E212A]">
              <span className="text-[10px] font-mono uppercase px-3 py-1.5 bg-[#3B82F6] text-white">⊙ Input</span>
              <span className="text-[10px] font-mono uppercase px-3 py-1.5 text-[#4A4E5C]">⊕ Output</span>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {editingDef.params.length === 0 ? (
                <div className="text-[10px] font-mono text-[#4A4E5C]">This block has no configurable parameters.</div>
              ) : (
                editingDef.params.map((param) => (
                  <div key={param.key} className="flex items-center gap-3">
                    <span className="w-32 text-[10px] font-mono text-[#7C8090] shrink-0">{param.label}</span>
                    {param.type === 'select' ? (
                      <select
                        value={String(editingBlock.values[param.key] ?? param.defaultValue)}
                        onChange={(e) => updateBlockValue(editingBlock.instanceId, param.key, e.target.value)}
                        className="flex-1 bg-[#111318] border border-[#1E212A] px-2 py-1.5 text-xs font-mono text-[#D7D9E0] focus:outline-none focus:border-[#3B82F6]"
                      >
                        {param.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : param.type === 'number' ? (
                      <div className="flex-1">
                        <Input
                          type="number"
                          value={Number(editingBlock.values[param.key] ?? param.defaultValue)}
                          onChange={(v) => updateBlockValue(editingBlock.instanceId, param.key, Number(v))}
                        />
                      </div>
                    ) : (
                      <input
                        value={String(editingBlock.values[param.key] ?? '')}
                        onChange={(e) => updateBlockValue(editingBlock.instanceId, param.key, e.target.value)}
                        className="flex-1 bg-[#111318] border border-[#1E212A] px-2 py-1.5 text-xs font-mono text-[#D7D9E0] focus:outline-none focus:border-[#3B82F6]"
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-3 border-t border-[#1E212A] flex justify-end">
              <Button variant="primary" size="sm" onClick={() => markConfigured(editingBlock.instanceId)}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}