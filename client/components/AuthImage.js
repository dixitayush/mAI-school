"use client";

import { useEffect, useState } from "react";
import { fetchFileObjectUrl } from "@/lib/api";

/**
 * Renders an image stored in Postgres (served by /api/files/:id behind auth).
 * Falls back to `fallback` content when the file id is missing or load fails.
 */
export default function AuthImage({ fileId, alt = "", className = "", fallback = null }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url;
    let active = true;
    setFailed(false);
    setSrc(null);
    if (!fileId) return;
    fetchFileObjectUrl(fileId).then((objUrl) => {
      if (!active) return;
      if (objUrl) {
        url = objUrl;
        setSrc(objUrl);
      } else {
        setFailed(true);
      }
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);

  if (!fileId || failed) return fallback;
  if (!src) return <div className={`animate-pulse bg-zinc-100 ${className}`} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}
