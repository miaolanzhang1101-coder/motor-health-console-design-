export function processMotorData(rows) {
  const map = {};

  rows.forEach((r) => {
    const key = r.file || 'unknown';
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });

  return Object.entries(map)
    .map(([file, windows]) => {
      const total = windows.length;
      const faults = windows.filter((w) => w.label === 'fault').length;
      const faultPct = (faults / total) * 100;

      const avg = (key) =>
        windows.reduce((s, w) => s + (Number(w[key]) || 0), 0) / total;

      const status =
        faultPct > 20 ? 'fault' : faultPct > 5 ? 'warning' : 'normal';

      return {
        name: file.replace('.mat', ''),
        file,
        total,
        faults,
        faultPct,
        avgKurt: avg('kurtosis'),
        avgRms: avg('rms'),
        avgCrest: avg('crest_factor'),
        avgPeak: avg('peak'),
        status,
        windows,
      };
    })
    .sort((a, b) => b.faultPct - a.faultPct);
}

export function fleetMetrics(motors) {
  const faultN = motors.filter((m) => m.status === 'fault').length;
  const warnN = motors.filter((m) => m.status === 'warning').length;
  const okN = motors.filter((m) => m.status === 'normal').length;
  const totalW = motors.reduce((s, m) => s + m.total, 0);
  const faultW = motors.reduce((s, m) => s + m.faults, 0);
  const avgK = motors.reduce((s, m) => s + m.avgKurt, 0) / motors.length;

  return {
    total: motors.length,
    faultN,
    warnN,
    okN,
    totalW,
    faultRate: totalW ? ((faultW / totalW) * 100).toFixed(1) + '%' : '—',
    avgKurt: avgK.toFixed(2),
  };
}
