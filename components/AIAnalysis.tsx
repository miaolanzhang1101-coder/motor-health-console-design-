'use client';
import { useState } from 'react';

export default function AIAnalysis({ motors }) {
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const m = selected;
    const prompt = `You are an industrial robotics fault diagnosis AI. Analyze this motor bearing health data and return ONLY valid JSON — no other text, no markdown, no code fences.

Motor: ${m.name}
Status: ${m.status}
Fault window rate: ${m.faultPct.toFixed(1)}%
Average kurtosis: ${m.avgKurt.toFixed(3)} (healthy baseline ~3.0, fault threshold >6.0)
Average RMS: ${m.avgRms.toFixed(4)}
Average crest factor: ${m.avgCrest.toFixed(2)}
Total windows analyzed: ${m.total}

Return this exact JSON structure:
{
  "fault_type": "specific bearing fault type, or Normal operation if healthy",
  "confidence": "e.g. 94%",
  "root_cause": "one concise sentence explaining the cause",
  "urgency": "immediate or this_week or monitor",
  "recommended_action": "specific maintenance action in one sentence",
  "estimated_remaining_life": "time estimate, or N/A if healthy",
  "key_indicator": "which metric most strongly indicates this diagnosis"
}`;

    try {
      // Calls our Node.js API route — not Anthropic directly
      // This is how CORS and API key are handled securely
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const text = data.content?.[0]?.text?.trim().replace(/```json|```/g, '');
      if (!text) throw new Error('Empty response from API');

      setResult(JSON.parse(text));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view">
      <div className="ai-layout">
        {/* Motor selector */}
        <div className="ai-card">
          <h3>Select motor</h3>
          <p className="sub">
            Choose a motor to run AI-powered fault diagnosis using Claude.
          </p>

          {!motors.length ? (
            <div style={{ fontSize: 12, color: 'var(--muted)', padding: '20px 0' }}>
              Upload CSV to see motors
            </div>
          ) : (
            <div className="mlist">
              {motors.map((m) => (
                <div
                  key={m.file}
                  className={`mitem ${selected?.file === m.file ? 'sel' : ''}`}
                  onClick={() => setSelected(m)}
                >
                  <div className={`mdot ${m.status}`} />
                  <div className="mitem-name">{m.name}</div>
                  <div className="mitem-pct">{m.faultPct.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={run}
            disabled={!selected || loading}
          >
            {loading ? 'Analyzing...' : 'Run AI diagnosis ↗'}
          </button>
        </div>

        {/* Result panel */}
        <div className="ai-card">
          <h3>Diagnostic report</h3>
          <p className="sub">
            AI-powered fault classification and recommended action.
          </p>

          {loading && (
            <div className="ai-loading">
              <div className="spin" />
              <br />
              Analyzing {selected?.name}...
            </div>
          )}

          {error && (
            <div className="ai-error">
              ✗ {error}
              <br />
              <small style={{ opacity: 0.7 }}>
                Make sure ANTHROPIC_API_KEY is set in .env.local
              </small>
            </div>
          )}

          {!loading && !error && !result && (
            <div className="result-empty">
              Select a motor and click Run AI diagnosis
            </div>
          )}

          {result && (
            <>
              <div className="result-grid">
                <div className="rfield">
                  <div className="rfield-label">Fault type</div>
                  <div className="rfield-val">{result.fault_type || '—'}</div>
                </div>
                <div className="rfield">
                  <div className="rfield-label">Confidence</div>
                  <div className="rfield-val">{result.confidence || '—'}</div>
                </div>
                <div className="rfield">
                  <div className="rfield-label">Urgency</div>
                  <div className={`rfield-val ${result.urgency}`}>
                    {(result.urgency || '—').replace('_', ' ')}
                  </div>
                </div>
                <div className="rfield">
                  <div className="rfield-label">Key indicator</div>
                  <div className="rfield-val">{result.key_indicator || '—'}</div>
                </div>
                <div className="rfield">
                  <div className="rfield-label">Est. remaining life</div>
                  <div className="rfield-val">{result.estimated_remaining_life || '—'}</div>
                </div>
                <div className="rfield">
                  <div className="rfield-label">Motor</div>
                  <div className="rfield-val">{selected?.name}</div>
                </div>
              </div>

              <div className="raction">
                <div className="raction-label">Root cause</div>
                {result.root_cause || '—'}
              </div>

              <div className="raction neutral">
                <div className="raction-label">Recommended action</div>
                {result.recommended_action || '—'}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
