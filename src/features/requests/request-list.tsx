"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { api } from "./api";
import { REASONS, STATUSES, type RequestList } from "./types";

const sorts = [
  ["createdAt", "Updated time"],
  ["updatedAt", "Last change"],
  ["reference", "Reference"],
  ["customerName", "Customer"],
  ["status", "Status"],
  ["reason", "Reason"],
  ["orderReference", "Order"],
] as const;

function formatWhen(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function RequestList() {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [direction, setDirection] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<RequestList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(queryInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      sort,
      direction,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    if (reason) params.set("reason", reason);

    api<RequestList>(`/api/requests?${params}`, { signal: controller.signal })
      .then((body) => {
        if (!controller.signal.aborted) {
          setData(body);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Could not load requests.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [query, status, reason, sort, direction, page, pageSize]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const filtersActive = Boolean(query || status || reason);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-tight">Request queue</h1>
          <p className="mt-1 text-muted">
            {loading && !data ? "Loading requests" : `${total} matching request${total === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      <form className="mt-6 grid gap-3 border border-line bg-card p-4 md:grid-cols-4" onSubmit={(event) => event.preventDefault()}>
        <label className="md:col-span-2 text-sm">
          Search
          <input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            className="mt-1 w-full border border-line bg-card px-3 py-2"
            placeholder="Name, email, order, or RD reference"
            type="search"
          />
        </label>
        <label className="text-sm">
          Status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="mt-1 w-full border border-line bg-card px-3 py-2"
          >
            <option value="">All statuses</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Reason
          <select
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setPage(1);
            }}
            className="mt-1 w-full border border-line bg-card px-3 py-2"
          >
            <option value="">All reasons</option>
            {REASONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Sort
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            className="mt-1 w-full border border-line bg-card px-3 py-2"
          >
            {sorts.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Direction
          <select
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value);
              setPage(1);
            }}
            className="mt-1 w-full border border-line bg-card px-3 py-2"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
        <label className="text-sm">
          Page size
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="mt-1 w-full border border-line bg-card px-3 py-2"
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </form>

      <div className="mt-4" aria-live="polite">
        {error ? (
          <p className="border border-danger bg-card px-4 py-3 text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <p className="mt-3 text-sm text-muted">Loading requests…</p> : null}
        {!loading && !error && total === 0 ? (
          <p className="mt-3 border border-line bg-card px-4 py-6">
            {filtersActive ? "No requests match these filters." : "No requests yet."}{" "}
            <Link href="/requests/new" className="text-stamp">
              Create a request
            </Link>
          </p>
        ) : null}
      </div>

      {data && data.requests.length > 0 ? (
        <>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full border-collapse bg-card text-left text-sm">
              <caption className="sr-only">Return requests</caption>
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Reference</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.requests.map((request) => (
                  <tr key={request.id} className="border-b border-line">
                    <td className="px-3 py-3">
                      <Link href={`/requests/${request.id}`} className="font-medium text-stamp">
                        {request.reference}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <div>{request.customerName}</div>
                      <div className="text-muted">{request.customerEmail}</div>
                    </td>
                    <td className="px-3 py-3">{request.orderReference}</td>
                    <td className="px-3 py-3">
                      {request.itemName}
                      <div className="text-muted">{request.itemSku}</div>
                    </td>
                    <td className="px-3 py-3">{request.reason}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={request.status} />
                    </td>
                    <td className="px-3 py-3">{formatWhen(request.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-4 grid gap-3 md:hidden">
            {data.requests.map((request) => (
              <li key={request.id} className="border border-line bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/requests/${request.id}`} className="font-medium text-stamp">
                    {request.reference}
                  </Link>
                  <StatusBadge status={request.status} />
                </div>
                <p className="mt-2">{request.customerName}</p>
                <p className="text-sm text-muted">{request.customerEmail}</p>
                <p className="mt-2 text-sm">
                  {request.orderReference} · {request.itemSku}
                </p>
                <p className="text-sm text-muted">
                  {request.reason} · {formatWhen(request.updatedAt)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <p>
              Page {page} of {pageCount}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="border border-line bg-card px-3 py-2 disabled:opacity-50"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
              >
                Previous
              </button>
              <button
                type="button"
                className="border border-line bg-card px-3 py-2 disabled:opacity-50"
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= pageCount || loading}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
