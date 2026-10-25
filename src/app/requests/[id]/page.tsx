import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestDetail } from "@/features/requests/request-detail";

export const metadata: Metadata = {
  title: "Request · ReturnDesk",
};

async function RequestRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestDetail key={id} id={id} />;
}

export default function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl px-4 py-8">Loading request…</main>}>
      <RequestRoute params={params} />
    </Suspense>
  );
}
