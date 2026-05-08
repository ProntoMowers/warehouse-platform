import { useState } from 'react';
import { getDatabasesStatus, getHealth, getSecurePing } from './api/endpoints';

export default function AppApiTest() {
  const [output, setOutput] = useState<string>('Listo para probar API.');
  const [loading, setLoading] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setLoading(true);
    try {
      const data = await action();
      setOutput(JSON.stringify(data, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setOutput(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: 'Inter, Arial, sans-serif', padding: '24px', maxWidth: 960, margin: '0 auto' }}>
      <h1>Picking App — API Smoke Test</h1>
      <p>
        Base URL: <strong>{import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}</strong>
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => run(getHealth)} disabled={loading}>
          Probar /api/health
        </button>
        <button onClick={() => run(getSecurePing)} disabled={loading}>
          Probar /api/ping
        </button>
        <button onClick={() => run(getDatabasesStatus)} disabled={loading}>
          Probar /api/databases/status
        </button>
      </div>

      <pre
        style={{
          background: '#0f172a',
          color: '#e2e8f0',
          borderRadius: 8,
          padding: 16,
          overflowX: 'auto',
          minHeight: 220
        }}
      >
{output}
      </pre>
    </main>
  );
}
