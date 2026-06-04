"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveSignInPath } from "@/lib/tenant";
import TimetableManager from "@/components/TimetableManager";

export default function AdminTimetablePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const role = localStorage.getItem("role");
    if (!storedUser || (role !== "admin" && role !== "principal")) {
      router.push(resolveSignInPath());
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;
  return <TimetableManager />;
}
