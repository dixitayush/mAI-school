"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTenantPaths } from "@/lib/useTenantPaths";
import { getInstitutionFromStorage, tenantLoginPath } from "@/lib/tenant";

/**
 * Clears the session and sends the user to their institute's login page
 * (platform admins go to the apex /login). Shared by the sidebar and the
 * header profile menu.
 */
export function useLogout(userRole) {
  const router = useRouter();
  const { slug: pathTenantSlug } = useTenantPaths();

  return useCallback(() => {
    const inst = getInstitutionFromStorage();
    const effectiveSlug =
      userRole === "mai_admin" ? "" : pathTenantSlug || inst?.slug || "";
    const dest =
      userRole === "mai_admin"
        ? "/login"
        : tenantLoginPath(effectiveSlug) || "/login";
    // The theme is a device preference, not session data — keep it.
    const theme = localStorage.getItem("theme");
    localStorage.clear();
    if (theme) localStorage.setItem("theme", theme);
    router.push(dest);
  }, [userRole, pathTenantSlug, router]);
}
