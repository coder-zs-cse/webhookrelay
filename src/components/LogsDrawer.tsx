"use client";

import { useEffect, useRef, useState } from "react";
import type { Mapping, RequestLog } from "@/types";
import { config } from "@/lib/config";

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

function StatusBadge({ code }: { code: number | null }) {
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

type SSEStatus = "connecting" | "open" | "reconnecting" | "dead";

function StatusDot({ status }: { status: SSEStatus }) {
  const config: Record<SSEStatus, { label: string; dotClass: string; pulse: boolean }> = {
    connecting:   { label: "Connecting...",   dotClass: "bg-yellow-500", pulse: true },
    open:         { label: "Live",         dotClass: "bg-emerald-500", pulse: true },
    reconnecting: { label: "Reconnecting...", dotClass: "bg-yellow-500", pulse: true },
    dead:         { label: "Live trail failed", dotClass: "bg-red-500",    pulse: false },
  };
  const { label, dotClass, pulse } = config[status];

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${dotClass} opacity-75 animate-ping`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dotClass}`} />
      </span>
      {label}
    </span>
  );
}

export default function LogsDrawer({ mapping, onClose }: Props) {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [status, setStatus] = useState<SSEStatus>("connecting");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [newLogIds, setNewLogIds] = useState<Set<string>>(new Set());

  const retryCount = useRef(0);
  const retryTimeout = useRef<NodeJS.Timeout | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!mapping) return;
    setLogs([]);
    setExpanded(null);
    setHoveredId(null);
    setNewLogIds(new Set());
    fetchLogs();
    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (retryTimeout.current) clearTimeout(retryTimeout.current);
    };
  }, [mapping?.id]);

  function connect() {
    if (!mapping) return;

    const es = new EventSource(`/api/mappings/${mapping.id}/logs/stream`);
    esRef.current = es;
    setStatus("connecting");

    es.onopen = () => {
      retryCount.current = 0;
      setStatus("open");
    };

    es.addEventListener("request", (event) => {
      const log = JSON.parse(event.data);
      setLogs((prev) => [log, ...prev]);

      // mark as new for entrance animation
      setNewLogIds((prev) => new Set(prev).add(log.id));
      setTimeout(() => {
        setNewLogIds((prev) => {
          const next = new Set(prev);
          next.delete(log.id);
          return next;
        });
      }, 600);
    });

    es.onerror = () => {
      es.close();
      retryCount.current++;
      if (retryCount.current <= config.maxSSEClientRetries) {
        const delay = Math.min(1000 * 2 ** retryCount.current, 30000);
        setStatus("reconnecting");
        retryTimeout.current = setTimeout(connect, delay);
      } else {
        setStatus("dead");
      }
    };
  }

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
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

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
          <button onClick={onClose} className="ml-3 shrink-0 text-gray-500 hover:text-gray-300 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/50">
          <StatusDot status={status} />
          <div className="flex gap-2">
            {status === "dead" && (
              <button
                onClick={() => { retryCount.current = 0; connect(); }}
                className="text-xs text-blue-400 hover:text-blue-300 transition px-2.5 py-1 rounded-md hover:bg-blue-500/10"
              >
                Reconnect
              </button>
            )}
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
              <p className="text-gray-400 text-sm font-medium">No requests yet</p>
              <p className="text-gray-600 text-xs mt-1">
                Requests to <span className="font-mono text-gray-500">/r/{mapping.slug}</span> will appear here
              </p>
            </div>
          ) : (
            <ul className="log-list px-3 py-2 space-y-1">
              {logs.map((log) => {
                const isHovered = hoveredId === log.id;
                const isExpanded = expanded === log.id;
                const isNew = newLogIds.has(log.id);

                return (
                  <li
                    key={log.id}
                    className={`log-item ${isNew ? "log-enter" : ""}`}
                    onMouseEnter={() => setHoveredId(log.id)}
                    /* no onMouseLeave — hover sticks until cursor enters another item */
                  >
                    <button
                      className={`log-card w-full text-left rounded-lg border px-3 py-2.5 transition-all duration-200 ${
                        isExpanded
                          ? "border-blue-500/40 bg-blue-500/8 shadow-[0_0_20px_rgba(59,130,246,0.12)]"
                          : isHovered
                          ? "border-gray-600/60 bg-gray-800/50 -translate-y-[2px] shadow-[0_8px_24px_rgba(0,0,0,0.4),0_0_0_1px_rgba(148,163,184,0.08)]"
                          : "border-transparent bg-transparent"
                      }`}
                      onClick={() => setExpanded(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-center gap-2">
                        <MethodBadge method={log.method} />
                        <StatusBadge code={log.statusCode} />
                        <span className="text-sm text-gray-300 font-mono truncate flex-1">
                          {log.path || "/"}
                        </span>
                        <span className="text-xs text-gray-500 shrink-0">
                          {log.duration != null ? `${log.duration}ms` : ""}
                        </span>
                        <span className="text-xs text-gray-600 shrink-0">
                          {timeAgo(log.createdAt)}
                        </span>
                        <svg
                          className={`w-3.5 h-3.5 text-gray-600 transition-transform duration-200 shrink-0 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      {log.error && (
                        <p className="mt-1.5 text-xs text-red-400 font-mono truncate">✗ {log.error}</p>
                      )}
                    </button>

                    <div
                      className={`overflow-hidden transition-all duration-250 ease-in-out ${
                        isExpanded ? "max-h-[600px] opacity-100 mt-2" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="space-y-3 px-3 pb-2">
                        {log.queryParams && Object.keys(log.queryParams).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Query Params</p>
                            <pre className="text-xs bg-gray-800/80 rounded-lg p-3 text-gray-300 overflow-x-auto font-mono border border-gray-700/30">
                              {JSON.stringify(log.queryParams, null, 2)}
                            </pre>
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Headers</p>
                          <pre className="text-xs bg-gray-800/80 rounded-lg p-3 text-gray-300 overflow-x-auto font-mono max-h-40 border border-gray-700/30">
                            {JSON.stringify(log.headers, null, 2)}
                          </pre>
                        </div>
                        {log.body != null && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Body</p>
                            <pre className="text-xs bg-gray-800/80 rounded-lg p-3 text-gray-300 overflow-x-auto font-mono max-h-48 border border-gray-700/30">
                              {typeof log.body === "string" ? log.body : JSON.stringify(log.body, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <style jsx>{`
        /* new request slides in from top and pushes everything down */
        @keyframes logSlideIn {
          0% {
            opacity: 0;
            transform: translateY(-100%) scaleY(0.95);
            max-height: 0;
          }
          40% {
            opacity: 0;
            max-height: 80px;
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
            max-height: 80px;
          }
        }

        /* existing items slide down smoothly when a new one enters */
        .log-list {
          /* this makes existing items animate their position change */
        }

        .log-item {
          transform-origin: top center;
          /* smooth position transitions when items shift down */
          transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
        }

        .log-enter {
          animation: logSlideIn 450ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* the card glow on hover */
        .log-card {
          transition:
            border-color 0.2s ease,
            background-color 0.2s ease,
            transform 0.2s cubic-bezier(0.2, 0, 0, 1),
            box-shadow 0.3s ease;
        }
      `}</style>
    </>
  );
}