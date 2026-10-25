import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getOne, PATCH } from "@/app/api/requests/[id]/route";
import { POST as addNote } from "@/app/api/requests/[id]/notes/route";
import { POST as remove } from "@/app/api/requests/[id]/remove/route";
import { POST as transition } from "@/app/api/requests/[id]/transition/route";
import { GET, POST } from "@/app/api/requests/route";
import { closeDb } from "@/lib/db/client";

config({ path: ".env" });

function testDatabaseUrl() {
  const url = new URL(process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "");
  if (!process.env.DATABASE_URL_TEST) {
    url.pathname = "/returndesk_test";
  }
  if (!url.pathname.endsWith("/returndesk_test")) {
    throw new Error("Refusing to run editing tests outside returndesk_test");
  }
  return url.toString();
}

beforeAll(async () => {
  process.env.DATABASE_URL = testDatabaseUrl();
  await closeDb();
});

afterAll(async () => {
  await closeDb();
});

async function createOpen(orderReference: string, itemSku: string) {
  const response = await POST(
    new Request("http://localhost/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Edit Tester",
        customerEmail: "edit.tester@example.com",
        customerPhone: "555-0170",
        orderReference,
        itemName: "Wool cap",
        itemSku,
        quantity: 1,
        reason: "Wrong Item",
      }),
    }),
  );
  expect(response.status).toBe(201);
  return response.json() as Promise<{ id: string; reference: string }>;
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("editing, notes, and soft removal", () => {
  it("edits open requests, appends notes, and hides a removed request", async () => {
    const order = `ord-edit-${crypto.randomUUID()}`;
    const sku = `sku-edit-${crypto.randomUUID()}`;
    const created = await createOpen(order, sku);

    const patched = await PATCH(
      new Request("http://localhost/api/requests/" + created.id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerName: "Edited Name", quantity: 3 }),
      }),
      context(created.id),
    );
    expect(patched.status).toBe(200);
    await expect(patched.json()).resolves.toMatchObject({ customerName: "Edited Name", quantity: 3, status: "Open" });

    const statusPatch = await PATCH(
      new Request("http://localhost/api/requests/" + created.id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      }),
      context(created.id),
    );
    expect(statusPatch.status).toBe(422);

    const firstNote = await addNote(
      new Request("http://localhost/api/requests/" + created.id + "/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "First note", authorLabel: "Desk" }),
      }),
      context(created.id),
    );
    expect(firstNote.status).toBe(201);
    const secondNote = await addNote(
      new Request("http://localhost/api/requests/" + created.id + "/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "Second note" }),
      }),
      context(created.id),
    );
    expect(secondNote.status).toBe(201);

    const detail = await getOne(new Request("http://localhost/api/requests/" + created.id), context(created.id));
    const detailBody = await detail.json();
    expect(detailBody.notes.map((note: { body: string }) => note.body)).toEqual(["First note", "Second note"]);

    const removed = await remove(new Request("http://localhost/api/requests/" + created.id + "/remove", { method: "POST" }), context(created.id));
    expect(removed.status).toBe(204);
    expect(await removed.text()).toBe("");

    expect((await getOne(new Request("http://localhost/api/requests/" + created.id), context(created.id))).status).toBe(404);
    const listed = await GET(new Request(`http://localhost/api/requests?q=${created.reference}`));
    await expect(listed.json()).resolves.toMatchObject({ total: 0, requests: [] });

    const noteAfterRemove = await addNote(
      new Request("http://localhost/api/requests/" + created.id + "/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "Too late" }),
      }),
      context(created.id),
    );
    expect(noteAfterRemove.status).toBe(404);

    const replacement = await createOpen(order, sku);
    expect(replacement.id).not.toBe(created.id);
  });

  it("locks details after approval, still accepts notes, and allows a new request after completion", async () => {
    const order = `ord-lock-${crypto.randomUUID()}`;
    const sku = `sku-lock-${crypto.randomUUID()}`;
    const created = await createOpen(order, sku);

    const review = await transition(
      new Request("http://localhost/api/requests/" + created.id + "/transition", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "In Review" }),
      }),
      context(created.id),
    );
    expect(review.status).toBe(200);

    const approved = await transition(
      new Request("http://localhost/api/requests/" + created.id + "/transition", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "Approved", resolution: "Store Credit" }),
      }),
      context(created.id),
    );
    expect(approved.status).toBe(200);

    const locked = await PATCH(
      new Request("http://localhost/api/requests/" + created.id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerName: "Should Fail" }),
      }),
      context(created.id),
    );
    expect(locked.status).toBe(409);
    await expect(locked.json()).resolves.toMatchObject({ error: { code: "LOCKED_DETAILS" } });

    const note = await addNote(
      new Request("http://localhost/api/requests/" + created.id + "/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "Approved note" }),
      }),
      context(created.id),
    );
    expect(note.status).toBe(201);

    const cannotRemove = await remove(
      new Request("http://localhost/api/requests/" + created.id + "/remove", { method: "POST" }),
      context(created.id),
    );
    expect(cannotRemove.status).toBe(409);

    const completed = await transition(
      new Request("http://localhost/api/requests/" + created.id + "/transition", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      }),
      context(created.id),
    );
    expect(completed.status).toBe(200);

    const again = await createOpen(order, sku);
    expect(again.id).not.toBe(created.id);
  });

  it("removes a rejected request and lets a replacement be created", async () => {
    const order = `ord-rej-${crypto.randomUUID()}`;
    const sku = `sku-rej-${crypto.randomUUID()}`;
    const created = await createOpen(order, sku);
    expect((await transition(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "In Review" }) }), context(created.id))).status).toBe(200);
    expect((await transition(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "Rejected" }) }), context(created.id))).status).toBe(200);

    const beforeRemoval = await createOpen(order, sku);
    expect(beforeRemoval.id).not.toBe(created.id);

    const removed = await remove(new Request("http://localhost", { method: "POST" }), context(created.id));
    expect(removed.status).toBe(204);
  });
});
