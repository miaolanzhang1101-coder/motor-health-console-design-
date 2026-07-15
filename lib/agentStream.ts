export type AgentKind = 'Drone' | 'AMR';
export type AgentStatus = 'patrolling' | 'en-route' | 'returning' | 'charging';

export interface Agent {
  id: string;
  name: string;
  kind: AgentKind;
  lat: number;
  lng: number;
  heading: number;
  battery: number;
  status: AgentStatus;
  target: [number, number] | null;
  trail: [number, number][];
  patrolSpeed: number; // m/s-equivalent, tunable
  returnSpeed: number;
  useReturnSpeed: boolean; // if false, returning uses patrolSpeed too
  waypointTolerance: number; // how close counts as "arrived"
}

// A generic industrial-site coordinate — not a real facility, just a
// plausible anchor point for the demo.
const CENTER: [number, number] = [29.749, -95.358];

const PATROL_WAYPOINTS: [number, number][] = [
  [29.752, -95.362],
  [29.754, -95.355],
  [29.747, -95.352],
  [29.745, -95.363],
];

function randomNear(base: number, spread: number) {
  return base + (Math.random() - 0.5) * spread;
}

export function generateInitialAgents(): Agent[] {
  const roster: { name: string; kind: AgentKind }[] = [
    { name: 'Drone-01', kind: 'Drone' },
    { name: 'Drone-02', kind: 'Drone' },
    { name: 'AMR-01', kind: 'AMR' },
    { name: 'AMR-02', kind: 'AMR' },
  ];
  return roster.map((r, i) => {
    const lat = randomNear(CENTER[0], 0.01);
    const lng = randomNear(CENTER[1], 0.01);
    return {
      id: `agent-${i}`,
      name: r.name,
      kind: r.kind,
      lat,
      lng,
      heading: Math.random() * 360,
      battery: 60 + Math.random() * 40,
      status: 'patrolling' as AgentStatus,
      target: PATROL_WAYPOINTS[i % PATROL_WAYPOINTS.length],
      trail: [[lat, lng]] as [number, number][],
      patrolSpeed: 6,
      returnSpeed: 3,
      useReturnSpeed: false,
      waypointTolerance: 5,
    };
  });
}

const MAX_TRAIL = 20;
const SPEED_SCALE = 0.0001; // converts the UI's abstract speed units into a per-tick degree step
const TOLERANCE_SCALE = 0.0001;

/**
 * Advances one agent by one simulated tick. This is the function a real
 * WebSocket onmessage handler would eventually replace — the calling
 * component doesn't need to change either way, only where the update
 * comes from.
 */
export function tickAgent(agent: Agent): Agent {
  let target = agent.target ?? PATROL_WAYPOINTS[Math.floor(Math.random() * PATROL_WAYPOINTS.length)];
  let status = agent.status;

  const dLat = target[0] - agent.lat;
  const dLng = target[1] - agent.lng;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);

  const activeSpeed = status === 'returning' && agent.useReturnSpeed ? agent.returnSpeed : agent.patrolSpeed;
  const step = Math.max(activeSpeed, 0.1) * SPEED_SCALE;
  const tolerance = Math.max(agent.waypointTolerance, 0.1) * TOLERANCE_SCALE;

  let newLat = agent.lat;
  let newLng = agent.lng;
  let heading = agent.heading;

  if (dist < tolerance) {
    newLat = target[0];
    newLng = target[1];
    if (status === 'returning') {
      status = 'charging';
    } else {
      target = PATROL_WAYPOINTS[Math.floor(Math.random() * PATROL_WAYPOINTS.length)];
      if (status === 'en-route') status = 'patrolling';
    }
  } else {
    const ratio = Math.min(step, dist) / dist;
    newLat = agent.lat + dLat * ratio;
    newLng = agent.lng + dLng * ratio;
    heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  }

  let battery = agent.battery + (status === 'charging' ? 1.5 : -0.15);
  battery = Math.max(0, Math.min(100, battery));
  if (status === 'charging' && battery >= 95) status = 'patrolling';
  if (status !== 'charging' && status !== 'returning' && battery < 20) {
    status = 'returning';
    target = CENTER;
  }

  const trail = [...agent.trail, [newLat, newLng] as [number, number]].slice(-MAX_TRAIL);

  return { ...agent, lat: newLat, lng: newLng, heading, status, battery, target, trail };
}