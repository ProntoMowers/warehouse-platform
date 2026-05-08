import { useCallback, useEffect, useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { getHealth, getSecurePing, getDatabasesStatus } from "../../api/endpoints";
import type { DatabaseCheckResult, DatabasesStatusResponse, HealthResponse, SecurePingResponse } from "../../types/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestStatus = "idle" | "loading" | "ok" | "error";

interface DbState {
  status: RequestStatus;
  data: DatabasesStatusResponse | null;
  error: string | null;
  lastChecked: string | null;
}

interface EndpointState {
  status: RequestStatus;
  data: HealthResponse | SecurePingResponse | null;
  error: string | null;
  lastChecked: string | null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RequestStatus | DatabaseCheckResult["status"] }) {
  const map: Record<string, { label: string; classes: string }> = {
    idle:    { label: "—",        classes: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
    loading: { label: "Checking", classes: "bg-blue-light-50 text-blue-light-600 dark:bg-blue-light-500/10 dark:text-blue-light-400" },
    ok:      { label: "OK",       classes: "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400" },
    error:   { label: "Error",    classes: "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400" },
    skipped: { label: "Skipped",  classes: "bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400" },
  };
  const { label, classes } = map[status] ?? map["idle"];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>
      {status === "loading" && (
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {label}
    </span>
  );
}

function DbRow({ name, result }: { name: string; result: DatabaseCheckResult }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <td className="py-3 pr-4 text-sm font-medium text-gray-800 dark:text-white/90 capitalize">{name}</td>
      <td className="py-3 pr-4">
        <StatusBadge status={result.status} />
      </td>
      <td className="py-3 text-sm text-gray-500 dark:text-gray-400">{result.message ?? ""}</td>
    </tr>
  );
}

function EndpointCard({
  title,
  path,
  state,
  onTest,
}: {
  title: string;
  path: string;
  state: EndpointState;
  onTest: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">{title}</p>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{path}</p>
        </div>
        <StatusBadge status={state.status} />
      </div>

      {state.data && (
        <pre className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto mb-4">
          {JSON.stringify(state.data, null, 2)}
        </pre>
      )}
      {state.error && (
        <p className="text-xs text-error-500 mb-4">{state.error}</p>
      )}
      {state.lastChecked && (
        <p className="text-xs text-gray-400 mb-4">Last checked: {state.lastChecked}</p>
      )}

      <button
        onClick={onTest}
        disabled={state.status === "loading"}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {state.status === "loading" ? "Checking…" : "Run test"}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_ENDPOINT: EndpointState = { status: "idle", data: null, error: null, lastChecked: null };
const DEFAULT_DB: DbState = { status: "idle", data: null, error: null, lastChecked: null };

function now() {
  return new Date().toLocaleTimeString();
}

export default function ApiStatus() {
  const [health, setHealth] = useState<EndpointState>(DEFAULT_ENDPOINT);
  const [ping, setPing] = useState<EndpointState>(DEFAULT_ENDPOINT);
  const [db, setDb] = useState<DbState>(DEFAULT_DB);

  const testHealth = useCallback(async () => {
    setHealth((s) => ({ ...s, status: "loading", error: null }));
    try {
      const data = await getHealth();
      setHealth({ status: "ok", data, error: null, lastChecked: now() });
    } catch (e) {
      setHealth({ status: "error", data: null, error: (e as Error).message, lastChecked: now() });
    }
  }, []);

  const testPing = useCallback(async () => {
    setPing((s) => ({ ...s, status: "loading", error: null }));
    try {
      const data = await getSecurePing();
      setPing({ status: "ok", data, error: null, lastChecked: now() });
    } catch (e) {
      setPing({ status: "error", data: null, error: (e as Error).message, lastChecked: now() });
    }
  }, []);

  const testDatabases = useCallback(async () => {
    setDb((s) => ({ ...s, status: "loading", error: null }));
    try {
      const data = await getDatabasesStatus();
      setDb({ status: data.ok ? "ok" : "error", data, error: null, lastChecked: now() });
    } catch (e) {
      setDb({ status: "error", data: null, error: (e as Error).message, lastChecked: now() });
    }
  }, []);

  // Auto-run health on mount
  useEffect(() => { testHealth(); }, [testHealth]);

  return (
    <>
      <PageMeta
        title="API Status | Picking App"
        description="Smoke test for picking-app backend endpoints and database connectivity."
      />
      <PageBreadcrumb pageTitle="API Status" />

      {/* Endpoint cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
        <EndpointCard title="Health check" path="GET /api/health" state={health} onTest={testHealth} />
        <EndpointCard title="Secure ping" path="GET /api/ping" state={ping} onTest={testPing} />
      </div>

      {/* Databases card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">Database connectivity</h4>
            <p className="text-xs text-gray-400 font-mono mt-0.5">GET /api/databases/status</p>
          </div>
          <div className="flex items-center gap-3">
            {db.lastChecked && (
              <span className="text-xs text-gray-400">Last: {db.lastChecked}</span>
            )}
            <StatusBadge status={db.status} />
          </div>
        </div>

        {db.error && (
          <p className="text-xs text-error-500 mb-4">{db.error}</p>
        )}

        {db.data?.databases && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="pb-2 pr-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Engine</th>
                  <th className="pb-2 pr-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Detail</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(db.data.databases).map(([name, result]) => (
                  <DbRow key={name} name={name} result={result} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          onClick={testDatabases}
          disabled={db.status === "loading"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {db.status === "loading" ? "Checking…" : "Run test"}
        </button>
      </div>
    </>
  );
}
