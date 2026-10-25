import type { RequestStatus } from "@/features/requests/types";

const tones: Record<RequestStatus, string> = {
  Open: "border-stamp text-stamp",
  "In Review": "border-foreground text-foreground",
  Approved: "border-foreground bg-foreground text-card",
  Rejected: "border-danger text-danger",
  Completed: "border-line bg-line text-foreground",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-sm ${tones[status]}`}>
      {status}
    </span>
  );
}
