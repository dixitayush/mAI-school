"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveSignInPath } from "@/lib/tenant";
import OnlineClassManager from "@/components/OnlineClassManager";

export default function TeacherOnlineClassesPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const role = localStorage.getItem("role");
    if (!storedUser || role !== "teacher") {
      router.push(resolveSignInPath());
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [router]);

  if (!user) return null;
  return <OnlineClassManager teacherId={user.id} />;
}
