export const SEED_CUSTOMERS = [
  { name: "Amina Shah", email: "amina.shah@example.com", phone: "555-0101" },
  { name: "Leo Park", email: "leo.park@example.com", phone: "555-0102" },
  { name: "Nora Bennett", email: "nora.bennett@example.com", phone: "555-0103" },
  { name: "Samir Iqbal", email: "samir.iqbal@example.com", phone: "555-0104" },
  { name: "Hana Okonkwo", email: "hana.okonkwo@example.com", phone: "555-0105" },
  { name: "Jules Moreau", email: "jules.moreau@example.com", phone: "555-0106" },
  { name: "Priya Raman", email: "priya.raman@example.com", phone: "555-0107" },
  { name: "Owen Blake", email: "owen.blake@example.com", phone: "555-0108" },
] as const;

export const SEED_ITEMS = [
  { sku: "SKU-TEE-BLU", name: "Indigo cotton tee" },
  { sku: "SKU-MUG-12", name: "Stoneware mug" },
  { sku: "SKU-HAT-WOL", name: "Wool cap" },
  { sku: "SKU-BAG-TOTE", name: "Canvas tote" },
  { sku: "SKU-LAMP-01", name: "Desk lamp" },
] as const;

export const SEED_REASONS = [
  "Damaged",
  "Wrong Item",
  "Size Issue",
  "Not As Described",
  "Changed Mind",
] as const;

type SeedStatus = "Open" | "In Review" | "Approved" | "Rejected" | "Completed";
type SeedResolution = "Refund" | "Replacement" | "Store Credit";

type SeedSpec = {
  n: number;
  status: SeedStatus;
  order: string;
  item: number;
  reason: number;
  resolution?: SeedResolution;
  refundAmount?: string;
  removed?: boolean;
  notes?: number;
};

const specs: SeedSpec[] = [
  { n: 1, status: "Open", order: "ORD-100", item: 0, reason: 0, notes: 2 },
  { n: 2, status: "Open", order: "ORD-101", item: 1, reason: 1 },
  { n: 3, status: "Open", order: "ORD-102", item: 2, reason: 2, notes: 1 },
  { n: 4, status: "Open", order: "ORD-103", item: 3, reason: 3 },
  { n: 5, status: "Open", order: "ORD-104", item: 4, reason: 4, notes: 1 },
  { n: 6, status: "Open", order: "ORD-105", item: 0, reason: 0 },
  { n: 7, status: "Open", order: "ORD-106", item: 1, reason: 1 },
  { n: 8, status: "Open", order: "ORD-102", item: 2, reason: 2, removed: true },
  { n: 9, status: "In Review", order: "ORD-107", item: 2, reason: 3, notes: 1 },
  { n: 10, status: "In Review", order: "ORD-108", item: 3, reason: 4 },
  { n: 11, status: "In Review", order: "ORD-109", item: 4, reason: 0 },
  { n: 12, status: "In Review", order: "ORD-110", item: 0, reason: 1, notes: 1 },
  { n: 13, status: "In Review", order: "ORD-111", item: 1, reason: 2 },
  { n: 14, status: "In Review", order: "ORD-112", item: 2, reason: 3 },
  { n: 15, status: "Approved", order: "ORD-113", item: 3, reason: 4, resolution: "Refund", refundAmount: "19.99", notes: 2 },
  { n: 16, status: "Approved", order: "ORD-114", item: 4, reason: 0, resolution: "Replacement" },
  { n: 17, status: "Approved", order: "ORD-115", item: 0, reason: 1, resolution: "Store Credit", notes: 1 },
  { n: 18, status: "Approved", order: "ORD-116", item: 1, reason: 2, resolution: "Refund", refundAmount: "42.00" },
  { n: 19, status: "Approved", order: "ORD-117", item: 2, reason: 3, resolution: "Replacement" },
  { n: 20, status: "Approved", order: "ORD-118", item: 3, reason: 4, resolution: "Store Credit", notes: 1 },
  { n: 21, status: "Rejected", order: "ORD-100", item: 0, reason: 0, notes: 1 },
  { n: 22, status: "Rejected", order: "ORD-119", item: 4, reason: 1 },
  { n: 23, status: "Rejected", order: "ORD-120", item: 0, reason: 2, notes: 1 },
  { n: 24, status: "Rejected", order: "ORD-121", item: 1, reason: 3 },
  { n: 25, status: "Rejected", order: "ORD-122", item: 2, reason: 4 },
  { n: 26, status: "Rejected", order: "ORD-123", item: 3, reason: 0 },
  { n: 27, status: "Completed", order: "ORD-101", item: 1, reason: 1, resolution: "Refund", refundAmount: "10.00", notes: 1 },
  { n: 28, status: "Completed", order: "ORD-124", item: 4, reason: 2, resolution: "Replacement", notes: 2 },
  { n: 29, status: "Completed", order: "ORD-125", item: 0, reason: 3, resolution: "Store Credit" },
  { n: 30, status: "Completed", order: "ORD-126", item: 1, reason: 4, resolution: "Refund", refundAmount: "8.50", notes: 1 },
  { n: 31, status: "Completed", order: "ORD-127", item: 2, reason: 0, resolution: "Replacement" },
  { n: 32, status: "Completed", order: "ORD-128", item: 3, reason: 1, resolution: "Store Credit", notes: 1 },
];

export type SeedRequestRow = {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderReference: string;
  itemName: string;
  itemSku: string;
  quantity: number;
  reason: (typeof SEED_REASONS)[number];
  status: SeedStatus;
  resolution: SeedResolution | null;
  refundAmount: string | null;
  createdAt: Date;
  updatedAt: Date;
  removedAt: Date | null;
};

export type SeedNoteRow = {
  id: string;
  requestId: string;
  body: string;
  authorLabel: string | null;
  createdAt: Date;
};

function uuid(kind: "0" | "1", n: number) {
  return `00000000-0000-4000-800${kind}-${n.toString().padStart(12, "0")}`;
}

export function buildSeedDataset() {
  const requests: SeedRequestRow[] = [];
  const notes: SeedNoteRow[] = [];
  let noteNumber = 1;

  for (const spec of specs) {
    const customer = SEED_CUSTOMERS[(spec.n - 1) % SEED_CUSTOMERS.length];
    const item = SEED_ITEMS[spec.item];
    const createdAt = new Date(Date.UTC(2026, 0, spec.n, 15, 0, 0));
    const updatedAt = new Date(createdAt.getTime() + (spec.status === "Open" ? 0 : 60 * 60 * 1000));
    const requestId = uuid("0", spec.n);

    requests.push({
      id: requestId,
      reference: `RD-2026-${spec.n.toString().padStart(6, "0")}`,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      orderReference: spec.order,
      itemName: item.name,
      itemSku: item.sku,
      quantity: (spec.n % 3) + 1,
      reason: SEED_REASONS[spec.reason],
      status: spec.status,
      resolution: spec.resolution ?? null,
      refundAmount: spec.refundAmount ?? null,
      createdAt,
      updatedAt,
      removedAt: spec.removed ? new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
    });

    for (let noteIndex = 0; noteIndex < (spec.notes ?? 0); noteIndex += 1) {
      notes.push({
        id: uuid("1", noteNumber),
        requestId,
        body: `Note ${noteIndex + 1} on ${`RD-2026-${spec.n.toString().padStart(6, "0")}`}.`,
        authorLabel: noteIndex === 0 ? "Desk" : null,
        createdAt: new Date(createdAt.getTime() + (noteIndex + 1) * 60 * 1000),
      });
      noteNumber += 1;
    }
  }

  return { requests, notes };
}
