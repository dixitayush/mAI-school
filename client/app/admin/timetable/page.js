"use client";

import TimetableManager from "@/components/TimetableManager";
import { useRequireRole } from "@/lib/useSession";

export default function AdminTimetablePage() {
  const { ready } = useRequireRole(["admin", "principal"]);
  if (!ready) return null;
  return <TimetableManager />;
}
