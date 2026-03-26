import type { ReactNode } from "react";

export default function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgb(12, 14, 24)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
      onMouseDown={onClose}
    >
      <div className="card" style={{ maxWidth: 920, width: "100%" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <div className="h1" style={{ fontSize: 18 }}>
            {title || "Окно"}
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <div className="hr" />
        {children}
      </div>
    </div>
  );
}
