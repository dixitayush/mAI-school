"use client";

import TimetableManager from "@/components/TimetableManager";
import { useRequireRole } from "@/lib/useSession";

export default function TeacherTimetablePage() {
  const { ready } = useRequireRole("teacher");
  if (!ready) return null;
  return <TimetableManager />;
}
