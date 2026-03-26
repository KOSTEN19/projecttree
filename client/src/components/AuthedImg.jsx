import React, { useEffect, useRef, useState } from "react";
import { assetUrl } from "../api.js";

/**
 * Картинка с Authorization для путей /api/files/...; внешние URL — как обычно.
 */
export default function AuthedImg({ src, className, alt, style }) {
  const [resolved, setResolved] = useState(null);
  const blobRef = useRef(null);

  useEffect(() => {
    if (!src) {
      setResolved(null);
      return;
    }
    if (typeof src === "string" && (src.startsWith("http://") || src.startsWith("https://"))) {
      setResolved(src);
      return;
    }

    if (typeof src === "string" && src.startsWith("/api/")) {
      let cancelled = false;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
      (async () => {
        try {
          const full = assetUrl(src);
          const token = localStorage.getItem("token");
          const res = await fetch(full, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok || cancelled) return;
          const blob = await res.blob();
          if (cancelled) return;
          const u = URL.createObjectURL(blob);
          blobRef.current = u;
          setResolved(u);
        } catch {
          if (!cancelled) setResolved(null);
        }
      })();
      return () => {
        cancelled = true;
        if (blobRef.current) {
          URL.revokeObjectURL(blobRef.current);
          blobRef.current = null;
        }
      };
    }

    setResolved(assetUrl(src));
    return undefined;
  }, [src]);

  if (!src) return null;
  if (!resolved) {
    return <div className={className} style={style || { background: "hsl(var(--muted))" }} aria-hidden />;
  }
  return <img src={resolved} className={className} alt={alt || ""} style={style} />;
}
