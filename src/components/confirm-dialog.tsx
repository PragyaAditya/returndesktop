"use client";

import { useEffect, useRef } from "react";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog ref={dialogRef} onClose={onClose} aria-labelledby="confirm-title">
      <h2 id="confirm-title" className="font-display text-2xl">
        {title}
      </h2>
      <p className="mt-2 text-muted">{body}</p>
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" className="border border-line px-3 py-2" onClick={onClose} disabled={pending}>
          Keep request
        </button>
        <button type="button" className="bg-danger px-3 py-2 text-card" onClick={onConfirm} disabled={pending}>
          {pending ? "Removing…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
