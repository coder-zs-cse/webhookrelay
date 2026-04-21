"use client";

import { useState } from "react";
import type { Mapping } from "@/types";
import Navbar from "@/components/Navbar";
import MappingCard from "@/components/MappingCard";
import MappingModal from "@/components/MappingModal";
import LogsDrawer from "@/components/LogsDrawer";

interface Props {
  user: { id: string; email: string; name: string | null };
  initialMappings: Mapping[];
  baseUrl: string;
}

export default function DashboardClient({ user, initialMappings, baseUrl }: Props) {
  const [mappings, setMappings] = useState<Mapping[]>(initialMappings);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Mapping | null>(null);
  const [logsTarget, setLogsTarget] = useState<Mapping | null>(null);

  async function refreshMappings() {
    const res = await fetch("/api/mappings");
    const data = await res.json();
    if (res.ok) setMappings(data.data);
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(m: Mapping) {
    setEditing(m);
    setModalOpen(true);
  }

  async function handleToggleActive(m: Mapping) {
    const res = await fetch(`/api/mappings/${m.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !m.isActive }),
    });
    if (res.ok) {
      setMappings((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, isActive: !m.isActive } : x))
      );
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/mappings/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMappings((prev) => prev.filter((m) => m.id !== id));
    }
  }

  const activeCount = mappings.filter((m) => m.isActive).length;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Navbar user={user} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white">Relay Endpoints</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {mappings.length === 0
                ? "No relay endpoints yet"
                : `${activeCount} of ${mappings.length} active`}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New relay
          </button>
        </div>

        {/* Info banner */}
        {mappings.length === 0 && (
          <div className="border border-dashed border-gray-800 rounded-2xl p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Create your first relay</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
              Generate a stable production URL that forwards all requests to your local machine — no ngrok warnings, no trust issues.
            </p>
            <button
              onClick={openCreate}
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition"
            >
              Create relay endpoint
            </button>
          </div>
        )}

        {/* How it works */}
        {mappings.length === 0 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: "🔗",
                title: "Create an endpoint",
                desc: "Pick a slug — your production URL will be /r/your-slug",
              },
              {
                icon: "🎯",
                title: "Set a target",
                desc: "Point it at your local URL like http://localhost:3000/api/webhook",
              },
              {
                icon: "📬",
                title: "Receive requests",
                desc: "Paste the production URL in Razorpay, Stripe, or any external service",
              },
            ].map((step) => (
              <div key={step.title} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-2xl mb-3">{step.icon}</div>
                <h3 className="font-medium text-white text-sm mb-1">{step.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* Mapping grid */}
        {mappings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mappings.map((m) => (
              <MappingCard
                key={m.id}
                mapping={m}
                baseUrl={baseUrl}
                onEdit={openEdit}
                onViewLogs={(m) => setLogsTarget(m)}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <MappingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refreshMappings}
        editing={editing}
      />

      <LogsDrawer
        mapping={logsTarget}
        onClose={() => setLogsTarget(null)}
      />
    </div>
  );
}
