import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="max-h-[min(90vh,900px)] overflow-y-auto sm:max-w-3xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>{title || "Окно"}</DialogTitle>
        </DialogHeader>
        <div className="pt-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
