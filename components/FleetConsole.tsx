'use client';
import { fleetMetrics } from '../lib/processData';

export default function FleetConsole({ motors, selectedMotor, onSelectMotor }) {
  if (!motors.length) {
    return (
      <div className="view">
        <div className="empty-state">
          Upload motor_health_dataset.csv using the button in the top bar
        </div>
      </div>
    );
  }

  const m = fleetMetrics(motors);

  return (
    <div className="view">
      <div className="metrics">
        <div className="metric">
          <div className="metric-label">Total motors</div>
          <div className="metric-val b">{m.total}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Fault</div>
          <div className="metric-val r">{m.faultN}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Warning</div>
          <div className="metric-val a">{m.warnN}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Healthy</div>
          <div className="metric-val g">{m.okN}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Avg kurtosis</div>
          <div className="metric-val">{m.avgKurt}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Fault rate</div>
          <div className="metric-val r">{m.faultRate}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total windows</div>
          <div className="metric-val">{m.totalW.toLocaleString()}</div>
        </div>
      </div>

      <div className="section-title">
        Fleet overview — click motor to inspect
      </div>

      <div className="fleet">
        {motors.map((motor) => (
          <div
            key={motor.file}
            className={`mcard s-${motor.status} ${
              selectedMotor?.file === motor.file ? 'sel' : ''
            }`}
            onClick={() => onSelectMotor(motor)}
          >
            <div className="mcard-top">
              <div className="mcard-name">{motor.name}</div>
              <div className={`badge ${motor.status}`}>{motor.status}</div>
            </div>
            <div className="mcard-stats">
              <div className="mstat">
                Fault rate<span>{motor.faultPct.toFixed(1)}%</span>
              </div>
              <div className="mstat">
                Windows<span>{motor.total.toLocaleString()}</span>
              </div>
              <div className="mstat">
                Kurtosis<span>{motor.avgKurt.toFixed(2)}</span>
              </div>
              <div className="mstat">
                RMS<span>{motor.avgRms.toFixed(4)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
