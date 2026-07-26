"use client";

import OnlineClassManager from "@/components/OnlineClassManager";
import { useRequireRole } from "@/lib/useSession";

export default function TeacherOnlineClassesPage() {
  const { ready } = useRequireRole("teacher");
  if (!ready) return null;
  return <OnlineClassManager />;
}
