"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge } from "@/components/status-badge";
import { ApiClientError, api, fieldErrors } from "./api";
import { RequestFields, payloadFromDraft } from "./request-fields";
import {
  RESOLUTIONS,
  draftFromRequest,
  type RequestDraft,
  type RequestStatus,
  type Resolution,
  type ReturnRequest,
} from "./types";

function formatWhen(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function nextActions(status: RequestStatus) {
  if (status === "Open") return ["In Review"] as const;
  if (status === "In Review") return ["Approved", "Rejected"] as const;
  if (status === "Approved") return ["Completed"] as const;
  return [] as const;
}

const actionLabel: Record<string, string> = {
  "In Review": "Start review",
  Approved: "Approve",
  Rejected: "Reject",
  Completed: "Complete",
};

export function RequestDetail({ id }: { id: string }) {
  const router = useRouter();
  const [request, setRequest] = useState<ReturnRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<RequestDraft | null>(null);
  const [fieldErrorMap, setFieldErrorMap] = useState<Record<string, string | undefined>>({});
  const [showApproval, setShowApproval] = useState(false);
  const [resolution, setResolution] = useState<Resolution | "">("");
  const [refundAmount, setRefundAmount] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [authorLabel, setAuthorLabel] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function reload() {
    const body = await api<ReturnRequest>(`/api/requests/${id}`);
    setRequest(body);
    setDraft(draftFromRequest(body));
    return body;
  }

  useEffect(() => {
    const controller = new AbortController();
    api<ReturnRequest>(`/api/requests/${id}`, { signal: controller.signal })
      .then((body) => {
        if (controller.signal.aborted) return;
        setRequest(body);
        setDraft(draftFromRequest(body));
        setError(null);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Could not load this request.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id]);

  async function run(work: () => Promise<void>) {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setFieldErrorMap(fieldErrors(caught));
      setError(caught instanceof ApiClientError ? caught.message : "The desk could not save that change.");
    } finally {
      setPending(false);
    }
  }

  async function transition(status: RequestStatus, extra?: { resolution?: Resolution; refundAmount?: string }) {
    await run(async () => {
      const updated = await api<ReturnRequest>(`/api/requests/${id}/transition`, {
        method: "POST",
        body: JSON.stringify({ status, ...extra }),
      });
      setRequest(updated);
      setDraft(draftFromRequest(updated));
      setShowApproval(false);
      setResolution("");
      setRefundAmount("");
      setMessage(`Moved to ${updated.status}.`);
    });
  }

  if (loading) {
    return <main className="mx-auto max-w-3xl px-4 py-8">Loading request…</main>;
  }

  if (!request || !draft) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p role="alert" className="text-danger">
          {error ?? "Request not found."}
        </p>
        <Link href="/" className="mt-4 inline-block text-stamp">
          Back to the queue
        </Link>
      </main>
    );
  }

  const canEdit = request.status === "Open" || request.status === "In Review";
  const canRemove = request.status === "Open" || request.status === "Rejected";
  const actions = nextActions(request.status);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-stamp">
        Back to the queue
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Request</p>
          <h1 className="font-display text-4xl tracking-tight">{request.reference}</h1>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <dl className="mt-6 grid gap-4 border border-line bg-card p-4 text-sm md:grid-cols-2">
        <div>
          <dt className="text-muted">Customer</dt>
          <dd>{request.customerName}</dd>
          <dd>{request.customerEmail}</dd>
          <dd>{request.customerPhone}</dd>
        </div>
        <div>
          <dt className="text-muted">Order and item</dt>
          <dd>{request.orderReference}</dd>
          <dd>
            {request.itemName} · {request.itemSku}
          </dd>
          <dd>Quantity {request.quantity}</dd>
        </div>
        <div>
          <dt className="text-muted">Reason</dt>
          <dd>{request.reason}</dd>
        </div>
        <div>
          <dt className="text-muted">Resolution</dt>
          <dd>
            {request.resolution ?? "Not decided"}
            {request.refundAmount ? ` · ${request.refundAmount}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Opened</dt>
          <dd>{formatWhen(request.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-muted">Updated</dt>
          <dd>{formatWhen(request.updatedAt)}</dd>
        </div>
      </dl>

      <div className="mt-4" aria-live="polite">
        {message ? <p className="text-sm text-stamp">{message}</p> : null}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <section className="mt-6 border border-line bg-card p-4">
        <h2 className="text-lg">Decision</h2>
        {actions.length === 0 ? <p className="mt-2 text-sm text-muted">This request is closed.</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((status) =>
            status === "Approved" ? (
              <button
                key={status}
                type="button"
                className="bg-foreground px-3 py-2 text-card disabled:opacity-60"
                disabled={pending}
                onClick={() => setShowApproval(true)}
              >
                Approve
              </button>
            ) : (
              <button
                key={status}
                type="button"
                className="border border-foreground px-3 py-2 disabled:opacity-60"
                disabled={pending}
                onClick={() => void transition(status)}
              >
                {pending ? "Saving…" : actionLabel[status]}
              </button>
            ),
          )}
        </div>
        {showApproval ? (
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!resolution) return;
              void transition("Approved", {
                resolution,
                ...(resolution === "Refund" ? { refundAmount } : {}),
              });
            }}
          >
            <label className="text-sm" htmlFor="resolution">
              Resolution
              <select
                id="resolution"
                className="mt-1 w-full border border-line px-3 py-2"
                value={resolution}
                onChange={(event) => {
                  const next = event.target.value as Resolution | "";
                  setResolution(next);
                  if (next !== "Refund") setRefundAmount("");
                }}
                required
              >
                <option value="">Choose a resolution</option>
                {RESOLUTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            {resolution === "Refund" ? (
              <label className="text-sm" htmlFor="refund-amount">
                Refund amount
                <input
                  id="refund-amount"
                  className="mt-1 w-full border border-line px-3 py-2"
                  inputMode="decimal"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  required
                />
              </label>
            ) : null}
            <button type="submit" className="w-fit bg-stamp px-3 py-2 text-card disabled:opacity-60" disabled={pending}>
              {pending ? "Saving…" : "Save approval"}
            </button>
          </form>
        ) : null}
      </section>

      {canEdit ? (
        <section className="mt-6 border border-line bg-card p-4">
          <h2 className="text-lg">Edit details</h2>
          <form
            className="mt-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const updated = await api<ReturnRequest>(`/api/requests/${id}`, {
                  method: "PATCH",
                  body: JSON.stringify(payloadFromDraft(draft)),
                });
                setRequest(updated);
                setDraft(draftFromRequest(updated));
                setFieldErrorMap({});
                setMessage("Details saved.");
              });
            }}
          >
            <RequestFields draft={draft} errors={fieldErrorMap} onChange={setDraft} idPrefix="edit" />
            <button type="submit" className="mt-4 border border-foreground px-3 py-2 disabled:opacity-60" disabled={pending}>
              {pending ? "Saving…" : "Save details"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="mt-6 border border-line bg-card p-4">
        <h2 className="text-lg">Notes</h2>
        {request.notes && request.notes.length > 0 ? (
          <ol className="mt-3 grid gap-3">
            {request.notes.map((note) => (
              <li key={note.id} className="border-b border-line pb-3">
                <p>{note.body}</p>
                <p className="mt-1 text-sm text-muted">
                  {note.authorLabel ? `${note.authorLabel} · ` : ""}
                  {formatWhen(note.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted">No notes yet.</p>
        )}
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await api(`/api/requests/${id}/notes`, {
                method: "POST",
                body: JSON.stringify({
                  body: noteBody,
                  ...(authorLabel.trim() ? { authorLabel: authorLabel.trim() } : {}),
                }),
              });
              setNoteBody("");
              setAuthorLabel("");
              setMessage("Note added.");
              await reload();
            });
          }}
        >
          <label className="text-sm" htmlFor="note-body">
            Add a note
            <textarea
              id="note-body"
              className="mt-1 w-full border border-line px-3 py-2"
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              required
              rows={3}
            />
          </label>
          <label className="text-sm" htmlFor="note-author">
            Author label <span className="text-muted">(optional)</span>
            <input
              id="note-author"
              className="mt-1 w-full border border-line px-3 py-2"
              value={authorLabel}
              onChange={(event) => setAuthorLabel(event.target.value)}
            />
          </label>
          <button type="submit" className="w-fit border border-foreground px-3 py-2 disabled:opacity-60" disabled={pending}>
            {pending ? "Saving…" : "Add note"}
          </button>
        </form>
      </section>

      {canRemove ? (
        <section className="mt-6">
          <button type="button" className="border border-danger px-3 py-2 text-danger" onClick={() => setConfirmRemove(true)}>
            Remove request
          </button>
          <ConfirmDialog
            open={confirmRemove}
            title="Remove this request?"
            body="It leaves the queue. The record and its notes stay in the database."
            confirmLabel="Remove request"
            pending={pending}
            onClose={() => setConfirmRemove(false)}
            onConfirm={() => {
              void run(async () => {
                await api(`/api/requests/${id}/remove`, { method: "POST" });
                router.push("/");
              });
            }}
          />
        </section>
      ) : null}
    </main>
  );
}
