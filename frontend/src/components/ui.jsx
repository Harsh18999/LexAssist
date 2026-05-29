/**
 * Shared UI primitives used across all pages.
 */
import { useEffect, useRef } from "react";

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function Skeleton({ width = "100%", height = "1rem", radius = 6, style = {} }) {
  return (
    <div style={{
      width, height,
      borderRadius: radius,
      background: "linear-gradient(90deg, var(--bg-elevated) 25%, var(--border) 50%, var(--bg-elevated) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
      flexShrink: 0,
      ...style,
    }} />
  );
}

export function RowSkeleton({ cols = 2, rows = 5, height = "1rem" }) {
  return (
    <>
      {Array(rows).fill(null).map((_, i) => (
        <div key={i} className="list-row" style={{ gap: "1rem" }}>
          {Array(cols).fill(null).map((_, j) => (
            <Skeleton
              key={j}
              width={j === 0 ? "55%" : "25%"}
              height={height}
            />
          ))}
        </div>
      ))}
    </>
  );
}

export function CardSkeleton({ count = 4 }) {
  return (
    <div className="metrics" style={{ marginBottom: 0 }}>
      {Array(count).fill(null).map((_, i) => (
        <div key={i} className="metric">
          <Skeleton width="55%" height="0.65rem" style={{ marginBottom: "0.6rem" }} />
          <Skeleton width="40%" height="1.6rem" />
        </div>
      ))}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

export function Pagination({ page, totalPages, onPage }) {
  if (!totalPages || totalPages <= 1) return null;

  const pages = [];
  const delta = 1; // pages shown around current
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= page - delta && i <= page + delta)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.3rem",
      justifyContent: "center", padding: "0.85rem 0 0.25rem",
    }}>
      <button
        className="btn btn-ghost btn-sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        style={{ minWidth: 32, padding: "0.3rem 0.5rem" }}
      >‹</button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} style={{ color: "var(--muted)", padding: "0 0.15rem", fontSize: "0.85rem" }}>…</span>
        ) : (
          <button
            key={p}
            className="btn btn-sm"
            onClick={() => onPage(p)}
            style={{
              minWidth: 32, padding: "0.3rem 0.5rem",
              background: p === page ? "var(--accent)" : "transparent",
              color: p === page ? "#fff" : "var(--text)",
              border: p === page ? "none" : "1px solid var(--border)",
              fontWeight: p === page ? 700 : 500,
            }}
          >{p}</button>
        )
      )}

      <button
        className="btn btn-ghost btn-sm"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        style={{ minWidth: 32, padding: "0.3rem 0.5rem" }}
      >›</button>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState({ icon = "📭", title, subtitle, action }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "3rem 1rem", color: "var(--muted)", textAlign: "center",
    }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.5 }}>{icon}</div>
      {title && <div style={{ fontWeight: 600, marginBottom: "0.3rem", color: "var(--text)" }}>{title}</div>}
      {subtitle && <div style={{ fontSize: "0.82rem" }}>{subtitle}</div>}
      {action && <div style={{ marginTop: "1rem" }}>{action}</div>}
    </div>
  );
}

// ── useDebounce hook ──────────────────────────────────────────────────────────

export function useDebounce(fn, delay = 300) {
  const timer = useRef(null);
  return (...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  };
}
