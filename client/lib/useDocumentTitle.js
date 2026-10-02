"use client";

import { useEffect } from "react";

/**
 * Keep the tab title set from a client component. Next streams its metadata
 * <title> into <head> after hydration, which would overwrite a one-off
 * `document.title = …`, so re-apply whenever <head> changes.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return undefined;
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
}
