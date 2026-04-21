"use client";

import { useState, useEffect } from "react";
import type { Mapping } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: Mapping | null;
}

export default function MappingModal({ open, onClose, onSaved, editing }: Props) {
  const [form, setForm] = useState({
    slug: "",
    label: "",
    targetUrl: "",
    logRetain: "5",
    alwaysReturn200: false,   // ← add this
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
      slug: editing.slug,
      label: editing.label,
      targetUrl: editing.targetUrl,
      logRetain: String(editing.logRetain),
      alwaysReturn200: editing.alwaysReturn200,   // ← add this
    });
    } else {
      setForm({ slug: "", label: "", targetUrl: "", logRetain: "5", alwaysReturn200: false });   // ← add this
    }
    setError("");
  }, [editing, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = editing ? `/api/mappings/${editing.id}` : "/api/mappings";
      const method = editing ? "PUT" : "POST";
      const body = editing
      ? { label: form.label, targetUrl: form.targetUrl, logRetain: Number(form.logRetain), alwaysReturn200: form.alwaysReturn200 }
      : { ...form, logRetain: Number(form.logRetain) };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">
            {editing ? "Edit relay" : "New relay endpoint"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Label <span className="text-gray-500 font-normal">(friendly name)</span>
            </label>
            <input
              type="text"
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
              placeholder="e.g. Razorpay Webhook"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Slug <span className="text-gray-500 font-normal">(part of the production URL)</span>
            </label>
            <div className="flex rounded-lg overflow-hidden border border-gray-700 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 transition">
              <span className="bg-gray-800/80 text-gray-500 text-xs px-3 flex items-center border-r border-gray-700 whitespace-nowrap">
                /r/
              </span>
              <input
                type="text"
                required
                disabled={!!editing}
                value={form.slug}
                onChange={(e) =>
                  setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
                }
                className="flex-1 bg-gray-800 text-white px-3 py-2.5 text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="razorpay-webhook"
              />
            </div>
            {editing && (
              <p className="mt-1 text-xs text-gray-500">Slug cannot be changed after creation</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Target URL <span className="text-gray-500 font-normal">(your local URL)</span>
            </label>
            <input
              type="url"
              required
              value={form.targetUrl}
              onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition font-mono"
              placeholder="http://localhost:3000/api/webhook"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Logs to retain{" "}
              <span className="text-gray-500 font-normal">(max requests to keep per endpoint)</span>
            </label>
            <input
              type="number"
              min="1"
              max="100"
              required
              value={form.logRetain}
              onChange={(e) => setForm({ ...form, logRetain: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
            />
          </div>

          <div className="flex items-start justify-between gap-3 p-3 bg-gray-800/60 rounded-lg">
  <div>
    <p className="text-sm font-medium text-gray-300">Always return 200</p>
    <p className="text-xs text-gray-500 mt-0.5">
      Ignore target response — always reply 200 OK with empty body. Useful when the target is ngrok or has unreliable responses.
    </p>
  </div>
  <button
    type="button"
    onClick={() => setForm({ ...form, alwaysReturn200: !form.alwaysReturn200 })}
    className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${
      form.alwaysReturn200 ? "bg-violet-600" : "bg-gray-700"
    }`}
  >
    <span
      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
        form.alwaysReturn200 ? "translate-x-5" : "translate-x-1"
      }`}
    />
  </button>
</div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg py-2.5 text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition"
            >
              {loading ? "Saving..." : editing ? "Save changes" : "Create relay"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
