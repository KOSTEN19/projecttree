import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Av } from "./TreeAvatars";
import { fmtFullName } from "./buildGraph";
import { Button } from "@/components/ui/button";
import { parseVirtualTreeNodeId } from "@/lib/parseVirtualTreeNodeId.js";

function fmtNameShort(p) {
  return [p?.lastName, p?.firstName].filter(Boolean).join(" ").trim() || "Без имени";
}

/**
 * Всплывающее меню по клику на человека в древе: карточка, подсветка ветки, добавить родственника.
 */
export function TreePersonPopup({
  anchor,
  onClose,
  onOpenDetails,
  onStartAddRelative,
  onBranchFocus,
  onBeginRelationPicker,
}) {
  const rootRef = useRef(null);
  const [box, setBox] = useState({ top: 0, left: 0 });

  const person = anchor?.person;
  const pid = String(person?.id || "");
  const isVirtual = Boolean(person?.isVirtual || person?.isPlaceholder || pid.startsWith("v:"));
  const virtualPreset = isVirtual ? parseVirtualTreeNodeId(pid) : null;

  useLayoutEffect(() => {
    if (!anchor) return;
    const pad = 8;
    const w = 280;
    const h = 340;
    let left = anchor.clientX;
    let top = anchor.clientY;
    if (typeof window !== "undefined") {
      left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
      top = Math.max(pad, Math.min(top, window.innerHeight - h - pad));
    }
    setBox({ top, left });
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    function onPointerDown(e) {
      if (rootRef.current?.contains(e.target)) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [anchor, onClose]);

  if (!anchor || !person) return null;

  return createPortal(
    <div
      ref={rootRef}
      className="tree-person-popup"
      style={{ position: "fixed", top: box.top, left: box.left, zIndex: 80 }}
      role="menu"
      aria-label="Действия с человеком в древе"
    >
      <div className="tree-person-popup__head">
        <Av p={person} size={40} />
        <div className="tree-person-popup__title">
          <div className="tree-person-popup__name">{isVirtual ? fmtNameShort(person) : fmtFullName(person)}</div>
          {person.isSelf ? <span className="tree-person-popup__badge">Вы</span> : null}
          {isVirtual ? <span className="tree-person-popup__badge tree-person-popup__badge--muted">Заглушка</span> : null}
        </div>
      </div>

      <div className="tree-person-popup__actions">
        <Button type="button" variant="default" size="sm" className="w-full" onClick={() => onOpenDetails(person)}>
          Подробная карточка
        </Button>
      </div>

      {!isVirtual && onBranchFocus && pid ? (
        <>
          <div className="tree-person-popup__section-label">Показать на древе</div>
          <div className="tree-person-popup__focus-row">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="tree-person-popup__focus-btn"
              onClick={() => {
                onBranchFocus({ type: "maternal", anchorId: pid });
                onClose();
              }}
            >
              Линия матери
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="tree-person-popup__focus-btn"
              onClick={() => {
                onBranchFocus({ type: "paternal", anchorId: pid });
                onClose();
              }}
            >
              Линия отца
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="tree-person-popup__focus-btn"
              onClick={() => {
                onBranchFocus({ type: "lineage", anchorId: pid });
                onClose();
              }}
            >
              Ветка к предку
            </Button>
          </div>
        </>
      ) : null}

      {onStartAddRelative ? (
        <>
          <div className="tree-person-popup__section-label">Добавить родственника</div>
          {isVirtual ? (
            virtualPreset ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => {
                  onStartAddRelative(virtualPreset);
                  onClose();
                }}
              >
                Заполнить заглушку
              </Button>
            ) : (
              <p className="tree-person-popup__hint">Связь не распознана — используйте «Родственники».</p>
            )
          ) : onBeginRelationPicker ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => {
                onBeginRelationPicker(pid);
              }}
            >
              Кого добавляем…
            </Button>
          ) : (
            <p className="tree-person-popup__hint">Добавление недоступно.</p>
          )}
        </>
      ) : null}
    </div>,
    document.body,
  );
}
