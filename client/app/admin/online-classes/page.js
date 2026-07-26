"use client";

import OnlineClassManager from "@/components/OnlineClassManager";
import { useRequireRole } from "@/lib/useSession";

export default function AdminOnlineClassesPage() {
  const { ready } = useRequireRole(["admin", "principal"]);
  if (!ready) return null;
  return <OnlineClassManager />;
}
