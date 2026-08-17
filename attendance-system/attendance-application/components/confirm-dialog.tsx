"use client";

import { TriangleAlert } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = "Delete",
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-border bg-surface-raised p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-danger/10 text-danger">
            <TriangleAlert size={16} />
          </span>
          <div>
            <h2 id="confirm-dialog-title" className="font-medium">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
