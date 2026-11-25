"use client";

import { useEffect } from "react";

export function SessionTimeout({ expiresAt }: { expiresAt: number }) {
  useEffect(() => {
    const check = () => {
      if (Date.now() >= expiresAt) window.location.replace("/login?expired=1");
    };
    const timer = window.setTimeout(check, Math.max(0, expiresAt - Date.now()));
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
    };
  }, [expiresAt]);

  return null;
}
