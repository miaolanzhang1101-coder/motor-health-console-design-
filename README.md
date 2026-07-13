# Motor Health Console

A predictive-maintenance interface for a fleet of industrial motors, built around two interaction workflows: **rehearsing** a sensor reading forward before it becomes real, and safely **comparing and deploying** an alert threshold policy across a fleet.


## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS v4**
- **Framer Motion** 
- **PapaParse**


## Project structure

```
app/
  page.tsx             
  design-system/       
components/
  ui/                   
  FleetConsole.tsx        
  MotorInspector.tsx      
  SetupWizard.tsx         
  DraggableSignalTrace.tsx 
  ScenarioChart.tsx        
  RobotBodyMap.tsx        
lib/
  types.ts, severity.ts, thresholdTree.ts, processData.ts, sampleData.ts, multiRobot.ts, analysis.ts, normalize.ts
```

## Design system

Every screen is built from the same shared components (`components/ui/`), sourced from a single severity/token file — a color means the same thing everywhere it appears. See the `/design-system` route for a searchable catalog of every component and variant used across the app.


