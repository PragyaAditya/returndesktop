"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiClientError, api, fieldErrors } from "./api";
import { RequestFields, payloadFromDraft } from "./request-fields";
import { emptyDraft, type RequestDraft, type ReturnRequest } from "./types";

export function CreateRequestForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<RequestDraft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setErrors({});

    try {
      const created = await api<ReturnRequest>("/api/requests", {
        method: "POST",
        body: JSON.stringify(payloadFromDraft(draft)),
      });
      router.push(`/requests/${created.id}`);
    } catch (error) {
      setDraft(draft);
      setErrors(fieldErrors(error));
      setFormError(error instanceof ApiClientError ? error.message : "Could not create the request.");
      setPending(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-display text-4xl tracking-tight">New request</h1>
      <p className="mt-2 text-muted">The desk opens every new request. You do not choose the reference or status.</p>
      <form className="mt-6 border border-line bg-card p-4" onSubmit={onSubmit}>
        <RequestFields draft={draft} errors={errors} onChange={setDraft} idPrefix="create" />
        {formError ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            {formError}
          </p>
        ) : null}
        <button type="submit" className="mt-5 bg-stamp px-4 py-2 text-card disabled:opacity-60" disabled={pending}>
          {pending ? "Creating…" : "Create request"}
        </button>
      </form>
    </main>
  );
}
