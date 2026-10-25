import type { Metadata } from "next";
import { CreateRequestForm } from "@/features/requests/create-request-form";

export const metadata: Metadata = {
  title: "New request · ReturnDesk",
};

export default function NewRequestPage() {
  return <CreateRequestForm />;
}
