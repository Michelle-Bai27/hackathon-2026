"use client";

import { useCallback, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { useApp } from "@/context/AppContext";

export function UploadModal() {
  const { uploadOpen, setUploadOpen, uploadFile, data } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [classId, setClassId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      setBusy(true);
      try {
        await uploadFile(file, classId || null, null);
      } catch {
        setError("This file type isn't supported yet. Please upload a PDF or PowerPoint.");
      } finally {
        setBusy(false);
      }
    },
    [classId, uploadFile],
  );

  if (!uploadOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1c1917]/35 p-6">
      <div
        className="w-full max-w-lg rounded-3xl border border-line bg-paper p-6 shadow-2xl"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void onFile(e.dataTransfer.files[0]);
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">New study session</p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl">Upload a lecture</h2>
            <p className="mt-2 text-sm text-muted">PDF or PowerPoint from your computer.</p>
          </div>
          <button type="button" onClick={() => setUploadOpen(false)} className="icon-btn" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {data.classes.length > 0 ? (
          <>
            <label className="mt-5 block text-xs uppercase tracking-wider text-muted">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-sidebar px-3 py-2 text-sm"
            >
              <option value="">None — add it unfiled</option>
              {data.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <p className="mt-5 text-sm text-muted">
            You can create a class later and move this lecture into it.
          </p>
        )}
        <label
          className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center ${
            dragging ? "border-accent bg-accent/5" : "border-line bg-sidebar/50"
          }`}
        >
          <UploadCloud className="mb-3 text-muted" />
          <p className="text-sm">Drop a PDF or PowerPoint here</p>
          <p className="mt-1 text-xs text-muted">or click to choose a file</p>
          <input
            name="file"
            type="file"
            accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
        {error ? <p className="mt-3 text-sm text-terracotta">{error}</p> : null}
        {busy ? <p className="mt-3 text-sm text-muted">Uploading…</p> : null}
      </div>
    </div>
  );
}
