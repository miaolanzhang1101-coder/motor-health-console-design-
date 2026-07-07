# Motor Fleet Health Console

AI-powered industrial motor health monitoring dashboard built with Next.js + Claude API.

## What it covers (job description match)
- **Control system consoles** → Fleet Console tab with multi-motor monitoring
- **Simplifying complex hardware setup flows** → 4-step Setup Wizard
- **AI-assisted configuration and automation interfaces** → Real Claude API fault diagnosis
- **Robotics / industrial experience** → CWRU bearing dataset, bearing fault signatures

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add your API key
```bash
cp .env.local.example .env.local
```
Edit `.env.local` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-...
```
Get your key at: https://console.anthropic.com/

### 3. Run locally
```bash
npm run dev
```
Open http://localhost:3000

---

## How to use

1. Click **Upload CSV** in the top bar → upload your `motor_health_dataset.csv`
2. **Fleet Console** — see all motors with normal/warning/fault status
3. Click any motor card → jumps to **Motor Inspector** with kurtosis, RMS, and distribution charts
4. **Setup Wizard** — simulate onboarding a new robot motor (sensor config + calibration)
5. **AI Analysis** — select a motor → click Run AI diagnosis → Claude analyzes the fault

---

## Deploy to Vercel (one command)

```bash
npx vercel
```

Then add your environment variable in the Vercel dashboard:
- Key: `ANTHROPIC_API_KEY`
- Value: your key from console.anthropic.com

The `/api/analyze` route is a serverless function that proxies the Claude API securely —
your API key never touches the browser.

---

## Project structure

```
app/
  page.jsx              # Main app, state management
  layout.jsx            # Root layout
  globals.css           # Industrial dark theme
  api/
    analyze/
      route.js          # Claude API proxy (Node.js serverless)
components/
  FleetConsole.jsx      # Multi-motor status grid
  MotorInspector.jsx    # Charts: kurtosis, RMS, fault distribution
  SetupWizard.jsx       # 4-step hardware onboarding
  AIAnalysis.jsx        # Claude-powered fault diagnosis
lib/
  processData.js        # CSV parsing and motor aggregation
```

---

## Data format

The dashboard expects a CSV with these columns (from your ML pipeline):
`mean, std, rms, peak, crest_factor, kurtosis, peak_freq, spectral_energy, label, file`

Where `label` is `normal` or `fault` and `file` is the source `.mat` filename (used to group by motor).
