"use client";

import { useState } from "react";
import type { Mapping } from "@/types";

interface Props {
  mapping: Mapping;
  onEdit: (m: Mapping) => void;
  onViewLogs: (m: Mapping) => void;
  onToggleActive: (m: Mapping) => void;
  onDelete: (id: string) => void;
  baseUrl: string;
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

export default function MappingCard({ mapping, onEdit, onViewLogs, onToggleActive, onDelete, baseUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const productionUrl = `${baseUrl}/r/${mapping.slug}`;

  async function copyUrl() {
    await navigator.clipboard.writeText(productionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    onDelete(mapping.id);
  }

  const lastLog = mapping.logs?.[0];

  return (
    <div className={`bg-gray-900 border rounded-xl p-5 transition ${
      mapping.isActive ? "border-gray-800" : "border-gray-800/50 opacity-70"
    }`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white text-sm">{mapping.label}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${
                mapping.isActive
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-gray-700/30 text-gray-500 border-gray-700/50"
              }`}
            >
              {mapping.isActive ? "active" : "paused"}
            </span>
          </div>

          {mapping.alwaysReturn200 && (
            <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
              200 always
            </span>
          )}

          {/* Target URL */}
          <p className="text-xs text-gray-500 mt-0.5 font-mono truncate" title={mapping.targetUrl}>
            → {mapping.targetUrl}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onViewLogs(mapping)}
            title="View logs"
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </button>
          <button
            onClick={() => onEdit(mapping)}
            title="Edit"
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onToggleActive(mapping)}
            title={mapping.isActive ? "Pause" : "Activate"}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition"
          >
            {mapping.isActive ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            title={confirmDelete ? "Click again to confirm" : "Delete"}
            className={`p-1.5 rounded-lg transition ${
              confirmDelete
                ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
                : "text-gray-500 hover:text-red-400 hover:bg-gray-800"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Production URL row */}
      <div className="mt-3 flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2">
        <span className="text-xs text-gray-500 shrink-0">URL</span>
        <code className="flex-1 text-xs text-violet-300 font-mono truncate" title={productionUrl}>
          {productionUrl}
        </code>
        <button
          onClick={copyUrl}
          className="shrink-0 text-xs text-gray-400 hover:text-gray-200 transition flex items-center gap-1"
        >
          {copied ? (
            <span className="text-green-400">✓ Copied</span>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
        <span>
          {mapping._count?.logs ?? 0} log{(mapping._count?.logs ?? 0) !== 1 ? "s" : ""} · retains {mapping.logRetain}
        </span>
        {lastLog ? (
          <span className={`flex items-center gap-1 ${lastLog.success ? "text-green-500/60" : "text-red-500/60"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${lastLog.success ? "bg-green-500" : "bg-red-500"}`} />
            Last hit {timeAgo(lastLog.createdAt)}
          </span>
        ) : (
          <span>No requests yet</span>
        )}
      </div>
    </div>
  );
}
