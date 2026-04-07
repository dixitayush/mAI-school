"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getInstitutionFromStorage,
  parseSlugFromInstitutePath,
  tenantAppPath,
} from "@/lib/tenant";

/**
 * Resolved institute slug from URL (`/i/slug/...`) or localStorage; path builder for navigation.
 */
export function useTenantPaths() {
  const pathname = usePathname();
  const [storedSlug, setStoredSlug] = useState("");

  useEffect(() => {
    setStoredSlug(getInstitutionFromStorage()?.slug || "");
  }, [pathname]);

  const slug = useMemo(() => {
    return parseSlugFromInstitutePath(pathname || "") || storedSlug || "";
  }, [pathname, storedSlug]);

  const to = (path) => tenantAppPath(slug, path);

  return { slug, to };
}
