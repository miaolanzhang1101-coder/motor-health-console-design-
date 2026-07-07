'use client';
import { useState, useRef, useEffect } from 'react';

const STEPS = ['Identify', 'Configure', 'Calibrate', 'Activate'];

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  const [calState, setCalState] = useState('idle'); // idle | running | done
  const [calPct, setCalPct] = useState(0);
  const [activated, setActivated] = useState(false);
  const timerRef = useRef(null);

  const [form, setForm] = useState({
    id: '', location: '', type: 'Servo motor — robot joint',
    model: '', sr: '12,000 Hz (standard)',
    channel: 'Drive-end accelerometer',
    window: '2048 samples (~170ms)',
    sensitivity: 'Standard (contamination=0.10)',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const next = (n) => { setStep(n); if (n === 3) setActivated(false); };

  const startCalibration = () => {
    setCalState('running');
    setCalPct(0);
    let pct = 0;
    timerRef.current = setInterval(() => {
      pct += 2;
      setCalPct(pct);
      if (pct >= 100) {
        clearInterval(timerRef.current);
        setCalState('done');
      }
    }, 60);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  return (
    <div className="view">
      <div className="wizard">
        <div className="wiz-steps">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`wstep ${step === i ? 'active' : ''} ${step > i ? 'done' : ''}`}
            >
              <div className="wstep-n">{step > i ? '✓' : i + 1}</div>
              <div className="wstep-label">{label}</div>
            </div>
          ))}
        </div>

        {/* Step 1: Identify */}
        {step === 0 && (
          <div className="wpanel">
            <h3>Motor identification</h3>
            <p className="sub">Register a new motor in the fleet monitoring system.</p>
            <div className="fgrid">
              <div className="frow">
                <label className="flabel">Motor ID</label>
                <input className="finput" placeholder="e.g. ARM-L3-J2" value={form.id} onChange={set('id')} />
              </div>
              <div className="frow">
                <label className="flabel">Location</label>
                <input className="finput" placeholder="e.g. Assembly Line 3" value={form.location} onChange={set('location')} />
              </div>
            </div>
            <div className="frow">
              <label className="flabel">Motor type</label>
              <select className="fselect" value={form.type} onChange={set('type')}>
                <option>Servo motor — robot joint</option>
                <option>BLDC — wheel drive</option>
                <option>Stepper — precision axis</option>
                <option>Induction — conveyor</option>
              </select>
            </div>
            <div className="frow">
              <label className="flabel">Manufacturer model</label>
              <input className="finput" placeholder="e.g. Maxon EC-i 40" value={form.model} onChange={set('model')} />
            </div>
            <div className="wfooter">
              <div />
              <button className="btn btn-primary" onClick={() => next(1)}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 1 && (
          <div className="wpanel">
            <h3>Sensor configuration</h3>
            <p className="sub">Set vibration sensor parameters for accurate fault detection.</p>
            <div className="fgrid">
              <div className="frow">
                <label className="flabel">Sampling rate</label>
                <select className="fselect" value={form.sr} onChange={set('sr')}>
                  <option>12,000 Hz (standard)</option>
                  <option>48,000 Hz (high precision)</option>
                  <option>6,000 Hz (low power)</option>
                </select>
              </div>
              <div className="frow">
                <label className="flabel">Sensor channel</label>
                <select className="fselect" value={form.channel} onChange={set('channel')}>
                  <option>Drive-end accelerometer</option>
                  <option>Fan-end accelerometer</option>
                  <option>Both channels</option>
                </select>
              </div>
            </div>
            <div className="fgrid">
              <div className="frow">
                <label className="flabel">Window size</label>
                <select className="fselect" value={form.window} onChange={set('window')}>
                  <option>2048 samples (~170ms)</option>
                  <option>1024 samples (~85ms)</option>
                  <option>4096 samples (~340ms)</option>
                </select>
              </div>
              <div className="frow">
                <label className="flabel">Anomaly sensitivity</label>
                <select className="fselect" value={form.sensitivity} onChange={set('sensitivity')}>
                  <option>Standard (contamination=0.10)</option>
                  <option>High (contamination=0.15)</option>
                  <option>Low (contamination=0.05)</option>
                </select>
              </div>
            </div>
            <div className="wfooter">
              <button className="btn btn-ghost" onClick={() => next(0)}>← Back</button>
              <button className="btn btn-primary" onClick={() => next(2)}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3: Calibrate */}
        {step === 2 && (
          <div className="wpanel">
            <h3>Baseline calibration</h3>
            <p className="sub">
              Capture normal operating sounds to train the anomaly detector on healthy motor behavior.
            </p>

            {calState === 'idle' && (
              <>
                <div className="sensor-row">
                  <div className="sensor-icon" />
                  <div className="sensor-name">Drive-end accelerometer</div>
                  <div className="sensor-val">READY</div>
                </div>
                <div className="sensor-row">
                  <div className="sensor-icon" style={{ background: 'var(--amber)' }} />
                  <div className="sensor-name">Motor power supply</div>
                  <div className="sensor-val">STANDBY</div>
                </div>
                <div className="sensor-row">
                  <div className="sensor-icon" style={{ background: 'var(--dim)' }} />
                  <div className="sensor-name">Baseline model</div>
                  <div className="sensor-val">NOT TRAINED</div>
                </div>
                <button
                  className="btn btn-primary btn-full"
                  style={{ marginTop: 16 }}
                  onClick={startCalibration}
                >
                  Start 30-second baseline capture
                </button>
              </>
            )}

            {calState === 'running' && (
              <>
                <p className="sub" style={{ marginBottom: 10 }}>
                  Recording normal motor operation... keep motor running at steady load.
                </p>
                <div className="progress-bg">
                  <div className="progress-fill" style={{ width: `${calPct}%` }} />
                </div>
                <div className="progress-label">{calPct}% · capturing...</div>
              </>
            )}

            {calState === 'done' && (
              <div className="sensor-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                {[
                  ['Drive-end accelerometer', '✓ 3,840 windows'],
                  ['Motor power supply', '✓ ACTIVE'],
                  ['Baseline model', '✓ TRAINED'],
                ].map(([name, val]) => (
                  <div key={name} className="sensor-row" style={{ width: '100%' }}>
                    <div className="sensor-icon" />
                    <div className="sensor-name">{name}</div>
                    <div className="sensor-val">{val}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="wfooter">
              <button className="btn btn-ghost" onClick={() => next(1)}>← Back</button>
              {calState === 'done' && (
                <button className="btn btn-primary" onClick={() => next(3)}>Continue →</button>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Activate */}
        {step === 3 && (
          <div className="wpanel">
            <h3>Review & activate</h3>
            <p className="sub">Confirm configuration and add motor to the live fleet console.</p>
            <div className="activate-summary">
              {[
                ['Motor ID', form.id || '—'],
                ['Location', form.location || '—'],
                ['Type', form.type.split('—')[0].trim()],
                ['Sampling rate', form.sr],
                ['Sensor channel', form.channel],
                ['Baseline windows', '3,840 captured'],
                ['Model status', 'TRAINED'],
              ].map(([label, val]) => (
                <div key={label} className="activate-row">
                  <span>{label}</span>
                  <span style={
                    val === 'TRAINED' || val === '3,840 captured'
                      ? { color: 'var(--green)' }
                      : {}
                  }>{val}</span>
                </div>
              ))}
            </div>

            {!activated ? (
              <button
                className="btn btn-success btn-full"
                onClick={() => setActivated(true)}
              >
                Activate motor monitoring
              </button>
            ) : (
              <div className="activate-confirm">
                ✓ Motor activated and added to fleet console. Live monitoring started.
              </div>
            )}

            <div className="wfooter">
              <button className="btn btn-ghost" onClick={() => next(2)}>← Back</button>
              <div />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
