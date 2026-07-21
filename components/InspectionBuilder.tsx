'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './ui/Button';
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
      <div className="w-96 shrink-0 border-r border-[#1A1A21] bg-[#08080B] overflow-y-auto flex flex-col">
        <div className="px-4 py-3 border-b border-[#1A1A21]">
          <div className="text-xs font-mono font-semibold text-[#FFFFFF] uppercase tracking-wide">Function Blocks</div>
        </div>

        <div className="px-3 py-2 border-b border-[#1A1A21] flex items-center gap-2">
          <span className="text-[#8B8B96] text-xs">⌕</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter function blocks"
            className="flex-1 bg-transparent text-xs font-mono text-[#FFFFFF] focus:outline-none placeholder:text-[#8B8B96]"
          />
          {filterCategory && (
            <button
              onClick={() => setFilterCategory(null)}
              aria-label={`Clear ${CATEGORY_LABELS[filterCategory]} filter`}
              className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 bg-[#4DB8FF] text-black"
            >
              {CATEGORY_ICONS[filterCategory]} {CATEGORY_LABELS[filterCategory]} ✕
            </button>
          )}
        </div>

        <div className="px-3 py-2 flex gap-1.5 border-b border-[#1A1A21]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
              aria-pressed={filterCategory === cat}
              className="text-[9px] font-mono uppercase px-2 py-1 border transition-colors"
              style={{
                borderColor: filterCategory === cat ? '#4DB8FF' : '#1A1A21',
                color: filterCategory === cat ? '#4DB8FF' : '#A0A0AB',
                background: filterCategory === cat ? '#4DB8FF10' : 'transparent',
              }}
            >
              {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="px-3 py-2 flex gap-4 border-b border-[#1A1A21]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
              aria-pressed={filterCategory === cat}
              className="text-[10px] font-mono"
              style={{ color: filterCategory === cat ? '#4DB8FF' : '#A0A0AB' }}
            >
              {CATEGORY_LABELS[cat]} ({countByCategory(cat)})
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredBlocks.map((def) => (
            <div
              key={def.id}
              className="flex items-center justify-between px-3 py-2.5 border-b border-[#131318] hover:bg-[#08080B] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 flex items-center justify-center border border-[#26262F] text-sm">{def.icon}</span>
                <div>
                  <span className="text-xs font-mono text-[#FFFFFF]">{def.name}</span>
                  <span className="text-[9px] font-mono text-[#8B8B96] ml-2">{def.version}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-[#8B8B96]">☆</span>
                <button
                  onClick={() => addBlock(def)}
                  aria-label={`Add ${def.label} to routine`}
                  className="w-6 h-6 flex items-center justify-center border border-[#26262F] text-[#A0A0AB] hover:border-[#4DB8FF] hover:text-[#4DB8FF] transition-colors text-xs"
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
        <div className="px-4 py-2.5 border-b border-[#1A1A21] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-[#FFFFFF] uppercase">Builder</span>
            <input
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              className="bg-[#08080B] border border-[#1A1A21] px-2 py-1 text-xs font-mono text-[#FFFFFF] focus:outline-none focus:border-[#4DB8FF] w-56"
            />
            <span className="text-[9px] font-mono text-[#8B8B96]">(draft)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={!allConfigured}>Save</Button>
            <Button variant="primary" size="sm" disabled={!allConfigured}>Save &amp; Run</Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="text-sm font-mono font-semibold text-[#FFFFFF] uppercase">Program</div>
          <div className="text-[10px] font-mono text-[#8B8B96]">Add blocks from the left panel to build your inspection routine.</div>

          <div className="border border-[#1A1A21] px-3 py-2 text-[9px] font-mono uppercase tracking-wide text-[#8B8B96]">
            ⊙ Input parameters
          </div>

          {program.map((block) => {
            const def = BLOCK_LIBRARY.find((d) => d.id === block.definitionId)!;
            return (
              <div key={block.instanceId} className="border border-[#1A1A21] bg-[#08080B] px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="cursor-grab text-[#8B8B96]">⠿</span>
                  <span className="w-7 h-7 flex items-center justify-center border border-[#26262F] text-sm">{def.icon}</span>
                  <span className="text-xs font-mono text-[#FFFFFF]">{def.name}</span>
                  <span className="text-[9px] font-mono text-[#8B8B96]">{def.version}</span>
                  <span className="text-[9px] font-mono text-[#A0A0AB] italic">{def.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {block.configured && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="text-[9px] font-mono uppercase px-1.5 py-0.5 border border-[#4DB8FF] text-[#4DB8FF]"
                      >
                        ✓ Set parameters
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => setEditingId(block.instanceId)}
                    aria-label={`Edit parameters for ${block.label}`}
                    className="w-6 h-6 flex items-center justify-center border border-[#26262F] text-[#A0A0AB] hover:border-[#4DB8FF] hover:text-[#4DB8FF] transition-colors text-xs"
                    title="Edit parameters"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => removeBlock(block.instanceId)}
                    aria-label={`Remove ${block.label} from routine`}
                    className="w-6 h-6 flex items-center justify-center border border-[#26262F] text-[#A0A0AB] hover:border-[#FF5A5A] hover:text-[#FF5A5A] transition-colors text-xs"
                    title="Remove"
                  >
                    🗑
                  </button>
                  <span className="text-[#8B8B96] text-xs">⋯</span>
                </div>
              </div>
            );
          })}

          {program.length === 0 && (
            <div className="border-2 border-dashed border-[#1A1A21] py-12 flex flex-col items-center justify-center gap-2">
              <span className="text-[#8B8B96] text-sm">+</span>
              <span className="text-[10px] font-mono text-[#8B8B96] uppercase">Drop function block here</span>
            </div>
          )}
        </div>
      </div>

      {/* Edit parameters modal — the interaction meat of this workflow */}
      {editingBlock && editingDef && (
        <EditParametersModal
          block={editingBlock}
          definition={editingDef}
          onValueChange={(key, value) => updateBlockValue(editingBlock.instanceId, key, value)}
          onApply={() => markConfigured(editingBlock.instanceId)}
          onClose={() => setEditingId(null)}
          onResetKey={(key) => {
            const def = editingDef.params.find((p) => p.key === key);
            if (def) updateBlockValue(editingBlock.instanceId, key, def.defaultValue);
          }}
        />
      )}
    </div>
  );
}

/**
 * Modal for editing a program block's parameters. Behaviors it adds on top
 * of the plain form: Escape to close, backdrop click to close, per-param
 * revert-to-default with a visible "modified" pip, and a live diff summary
 * so a user knows exactly what will change if they apply.
 */
function EditParametersModal({
  block,
  definition,
  onValueChange,
  onApply,
  onClose,
  onResetKey,
}: {
  block: ProgramBlock;
  definition: BlockDefinition;
  onValueChange: (key: string, value: string | number) => void;
  onApply: () => void;
  onClose: () => void;
  onResetKey: (key: string) => void;
}) {
  const [tab, setTab] = useState<'input' | 'output'>('input');
  const firstFieldRef = useRef<HTMLElement | null>(null);

  // Escape closes; also lock body scroll while the modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus first input on open so keyboard users don't get stuck outside
    setTimeout(() => firstFieldRef.current?.focus(), 20);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Which params differ from their default? Powers the "modified" indicator
  // and the diff summary shown next to Apply.
  const modifiedKeys = definition.params
    .filter((p) => String(block.values[p.key]) !== String(p.defaultValue))
    .map((p) => p.key);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16"
      onClick={onClose}
    >
      <div
        className="w-[640px] bg-[#08080B] border border-[#26262F] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-params-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1A21]">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 flex items-center justify-center border border-[#26262F] text-xs">
              {definition.icon}
            </span>
            <span id="edit-params-title" className="text-xs font-mono font-semibold text-[#FFFFFF] uppercase">
              Edit parameters: {definition.name}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close parameter editor"
            className="text-[#8B8B96] hover:text-[#FFFFFF] text-sm w-6 h-6 flex items-center justify-center"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="flex px-4 pt-3 gap-2 border-b border-[#1A1A21]">
          <button
            onClick={() => setTab('input')}
            role="tab"
            aria-selected={tab === 'input'}
            className="text-[10px] font-mono uppercase px-3 py-1.5 border-b-2"
            style={{
              borderColor: tab === 'input' ? '#4DB8FF' : 'transparent',
              color: tab === 'input' ? '#4DB8FF' : '#A0A0AB',
            }}
          >
            ⊙ Input
          </button>
          <button
            onClick={() => setTab('output')}
            role="tab"
            aria-selected={tab === 'output'}
            className="text-[10px] font-mono uppercase px-3 py-1.5 border-b-2"
            style={{
              borderColor: tab === 'output' ? '#4DB8FF' : 'transparent',
              color: tab === 'output' ? '#4DB8FF' : '#A0A0AB',
            }}
          >
            ⊕ Output
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 min-h-[220px]">
          {tab === 'output' ? (
            <div className="text-[10px] font-mono text-[#8B8B96]">
              This block produces no output value — it acts on system state directly.
            </div>
          ) : definition.params.length === 0 ? (
            <div className="text-[10px] font-mono text-[#8B8B96]">This block has no configurable parameters.</div>
          ) : (
            definition.params.map((param, idx) => {
              const modified = modifiedKeys.includes(param.key);
              const value = block.values[param.key] ?? param.defaultValue;
              return (
                <div key={param.key} className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    {/* animated modified pip */}
                    <motion.span
                      initial={false}
                      animate={{ opacity: modified ? 1 : 0, scale: modified ? 1 : 0.6 }}
                      transition={{ duration: 0.15 }}
                      className="w-1.5 h-1.5 rounded-full bg-[#4DB8FF]"
                    />
                    <span className="text-[10px] font-mono text-[#A0A0AB]">{param.label}</span>
                  </div>
                  {param.type === 'select' ? (
                    <select
                      ref={idx === 0 ? (el) => { firstFieldRef.current = el; } : undefined}
                      value={String(value)}
                      onChange={(e) => onValueChange(param.key, e.target.value)}
                      className="bg-[#08080B] border px-2 py-1.5 text-xs font-mono text-[#FFFFFF] focus:outline-none focus:border-[#4DB8FF] transition-colors"
                      style={{ borderColor: modified ? '#4DB8FF' : '#1A1A21' }}
                    >
                      {param.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : param.type === 'number' ? (
                    <input
                      ref={idx === 0 ? (el) => { firstFieldRef.current = el; } : undefined}
                      type="number"
                      value={Number(value)}
                      onChange={(e) => onValueChange(param.key, Number(e.target.value))}
                      className="bg-[#08080B] border px-2 py-1.5 text-xs font-mono text-[#FFFFFF] focus:outline-none focus:border-[#4DB8FF] transition-colors tabular-nums"
                      style={{ borderColor: modified ? '#4DB8FF' : '#1A1A21' }}
                    />
                  ) : (
                    <input
                      ref={idx === 0 ? (el) => { firstFieldRef.current = el; } : undefined}
                      value={String(value)}
                      onChange={(e) => onValueChange(param.key, e.target.value)}
                      className="bg-[#08080B] border px-2 py-1.5 text-xs font-mono text-[#FFFFFF] focus:outline-none focus:border-[#4DB8FF] transition-colors"
                      style={{ borderColor: modified ? '#4DB8FF' : '#1A1A21' }}
                    />
                  )}
                  <button
                    onClick={() => onResetKey(param.key)}
                    disabled={!modified}
                    className="text-[10px] font-mono text-[#8B8B96] hover:text-[#4DB8FF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2"
                    title="Reset to default"
                  >
                    Reset
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Diff summary — makes it explicit what Apply will do */}
        <div className="px-4 py-2.5 border-t border-[#1A1A21] text-[10px] font-mono text-[#8B8B96] min-h-[36px] flex items-center">
          <AnimatePresence mode="wait">
            {modifiedKeys.length === 0 ? (
              <motion.span
                key="no-changes"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                No changes from default.
              </motion.span>
            ) : (
              <motion.span
                key="changes"
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[#4DB8FF]"
              >
                {modifiedKeys.length} parameter{modifiedKeys.length === 1 ? '' : 's'} modified: {modifiedKeys.join(', ')}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="px-4 py-3 border-t border-[#1A1A21] flex justify-between items-center">
          <span className="text-[9px] font-mono text-[#8B8B96] uppercase">Enter to apply · Esc to close</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={onApply}>
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}