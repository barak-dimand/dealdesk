"use client";

import { useRouter } from "next/navigation";
import { NewDealModal } from "@/components/deals/NewDealModal";

export default function NewDealPage() {
  const router = useRouter();
  return <NewDealModal onClose={() => router.push("/deals")} />;
}
