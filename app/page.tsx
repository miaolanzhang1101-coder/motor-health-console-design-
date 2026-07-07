'use client';
import { useState, useRef, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { processMotorData } from '../lib/processData';
import { Motor, ViewKey } from '../lib/types';
import FleetConsole from '../components/FleetConsole';
import MotorInspector from '../components/MotorInspector';
import SetupWizard from '../components/SetupWizard';
import AIAnalysis from '../components/AIAnalysis';

const VIEWS: ViewKey[] = ['fleet', 'inspector', 'setup', 'ai'];
const VIEW_LABELS: Record<ViewKey, string> = {
  fleet: 'Fleet Console',
  inspector: 'Motor Inspector',
  setup: 'Setup Wizard',
  ai: 'AI Analysis',
};

export default function Home() {
  const [view, setView] = useState<ViewKey>('fleet');
  const [motors, setMotors] = useState<Motor[]>([]);
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);
  const [uploadLabel, setUploadLabel] = useState('↑ Upload CSV');
  const [isLive, setIsLive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCSV = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLabel('⏳ Parsing...');

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (r) => {
        const processed = processMotorData(r.data) as Motor[];
        setMotors(processed);
        setIsLive(true);
        setUploadLabel('✓ ' + file.name.slice(0, 20));
      },
      error: () => setUploadLabel('✗ Parse error'),
    });
  };

  const handleMotorSelect = (motor: Motor) => {
    setSelectedMotor(motor);
    setView('inspector');
  };

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <div className="brand">
          <div className="pulse" />
          Rehearsal
        </div>

        <nav className="nav">
          {VIEWS.map((v) => (
            <button
              key={v}
              className={`nav-btn ${view === v ? 'active' : ''}`}
              onClick={() => setView(v)}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <div className="upload-wrap">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleCSV}
            />
            <label className="upload-label">{uploadLabel}</label>
          </div>
          <div className={`status-dot ${isLive ? 'live' : ''}`} />
        </div>
      </div>

      {/* Views */}
      {view === 'fleet' && (
        <FleetConsole
          motors={motors}
          selectedMotor={selectedMotor}
          onSelectMotor={handleMotorSelect}
        />
      )}
      {view === 'inspector' && <MotorInspector motor={selectedMotor} />}
      {view === 'setup' && <SetupWizard />}
      {view === 'ai' && <AIAnalysis motors={motors} />}
    </>
  );
}