import React from "react";
import PixelCard from "../vendor/react-bits/PixelCard/PixelCard.jsx";
import "../vendor/react-bits/PixelCard/PixelCard.css";

export default function AddRelativePixelCard({ onAdd }) {
  return (
    <div
      className="rel-pixel-add-wrap"
      role="button"
      tabIndex={0}
      onClick={() => onAdd?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAdd?.();
        }
      }}
    >
      <PixelCard
        variant="blue"
        className="rel-pixel-add-card"
        noFocus
        colors="#dbeafe,#7dd3fc,#0369a1"
        gap={6}
        speed={40}
      >
        <span className="rel-pixel-add-label">Добавить родственника</span>
      </PixelCard>
    </div>
  );
}
