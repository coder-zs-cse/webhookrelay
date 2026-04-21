"use client";

import { useEffect, useState } from "react";
import type { Mapping, RequestLog } from "@/types";

interface Props {
  mapping: Mapping | null;
  onClose: () => void;
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    POST: "bg-green-500/15 text-green-400 border-green-500/20",
    PUT: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    PATCH: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    DELETE: "bg-red-500/15 text-red-400 border-red-500/20",
  };
  return (
    <span
      className={`text-xs font-mono font-medium px-2 py-0.5 rounded border ${
        colors[method] || "bg-gray-500/15 text-gray-400 border-gray-500/20"
      }`}
    >
      {method}
    </span>
  );
}

function StatusBadge({ code, success }: { code: number | null; success: boolean }) {
  if (code === null) {
    return (
      <span className="text-xs px-2 py-0.5 rounded border bg-red-500/15 text-red-400 border-red-500/20">
        ERR
      </span>
    );
  }
  const color =
    code < 300
      ? "bg-green-500/15 text-green-400 border-green-500/20"
      : code < 400
      ? "bg-blue-500/15 text-blue-400 border-blue-500/20"
      : code < 500
      ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
      : "bg-red-500/15 text-red-400 border-red-500/20";
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${color}`}>
      {code}
    </span>
  );
}

function timeAgo(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(date).toLocaleDateString();
}

export default function LogsDrawer({ mapping, onClose }: Props) {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!mapping) return;
    setLogs([]);
    setExpanded(null);
    fetchLogs();
  }, [mapping?.id]);

  async function fetchLogs() {
    if (!mapping) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/mappings/${mapping.id}/logs`);
      const data = await res.json();
      if (res.ok) setLogs(data.data || []);
    } finally {
      setLoading(false);
    }
  }

  async function clearLogs() {
    if (!mapping) return;
    setClearing(true);
    try {
      await fetch(`/api/mappings/${mapping.id}/logs`, { method: "DELETE" });
      setLogs([]);
    } finally {
      setClearing(false);
    }
  }

  if (!mapping) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-gray-900 border-l border-gray-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white truncate">{mapping.label}</h2>
              <span
                className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${
                  mapping.isActive
                    ? "bg-green-500/15 text-green-400 border-green-500/20"
                    : "bg-gray-500/15 text-gray-400 border-gray-500/20"
                }`}
              >
                {mapping.isActive ? "active" : "inactive"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-mono truncate">{mapping.targetUrl}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 text-gray-500 hover:text-gray-300 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/50">
          <p className="text-xs text-gray-500">
            Last {mapping.logRetain} requests retained
          </p>
          <div className="flex gap-2">
            <button
              onClick={fetchLogs}
              className="text-xs text-gray-400 hover:text-gray-200 transition px-2.5 py-1 rounded-md hover:bg-gray-800"
            >
              ↻ Refresh
            </button>
            {logs.length > 0 && (
              <button
                onClick={clearLogs}
                disabled={clearing}
                className="text-xs text-red-400 hover:text-red-300 transition px-2.5 py-1 rounded-md hover:bg-red-500/10 disabled:opacity-50"
              >
                {clearing ? "Clearing..." : "Clear all"}
              </button>
            )}
          </div>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
              Loading logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-8">
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm font-medium">No requests yet</p>
              <p className="text-gray-600 text-xs mt-1">
                Requests to <span className="font-mono text-gray-500">/r/{mapping.slug}</span> will appear here
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-800/50">
              {logs.map((log) => (
                <li key={log.id} className="px-5 py-3">
                  <button
                    className="w-full text-left"
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  >
                    <div className="flex items-center gap-2">
                      <MethodBadge method={log.method} />
                      <StatusBadge code={log.statusCode} success={log.success} />
                      <span className="text-sm text-gray-300 font-mono truncate flex-1">
                        {log.path || "/"}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0">
                        {log.duration != null ? `${log.duration}ms` : ""}
                      </span>
                      <span className="text-xs text-gray-600 shrink-0">
                        {timeAgo(log.createdAt)}
                      </span>
                    </div>
                    {log.error && (
                      <p className="mt-1.5 text-xs text-red-400 font-mono truncate">
                        ✗ {log.error}
                      </p>
                    )}
                  </button>

                  {expanded === log.id && (
                    <div className="mt-3 space-y-3">
                      {/* Query Params */}
                      {log.queryParams && Object.keys(log.queryParams).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Query Params</p>
                          <pre className="text-xs bg-gray-800 rounded-lg p-3 text-gray-300 overflow-x-auto font-mono">
                            {JSON.stringify(log.queryParams, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Headers */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Headers</p>
                        <pre className="text-xs bg-gray-800 rounded-lg p-3 text-gray-300 overflow-x-auto font-mono max-h-40">
                          {JSON.stringify(log.headers, null, 2)}
                        </pre>
                      </div>

                      {/* Body */}
                      {log.body != null && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Body</p>
                          <pre className="text-xs bg-gray-800 rounded-lg p-3 text-gray-300 overflow-x-auto font-mono max-h-48">
                            {typeof log.body === "string"
                              ? log.body
                              : JSON.stringify(log.body, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
