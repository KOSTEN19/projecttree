import React, { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { registerApiErrorHandler } from "@/lib/apiErrorSink";

/**
 * Глобальное окно ошибок в стиле shadcn (Dialog): текст с бэкенда (`message`) или код ошибки.
 */
export default function ApiErrorDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const show = useCallback((msg) => {
    setText(msg);
    setOpen(true);
  }, []);

  useEffect(() => {
    registerApiErrorHandler(show);
    return () => registerApiErrorHandler(null);
  }, [show]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-destructive/25 sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="text-destructive">Ошибка</DialogTitle>
          <DialogDescription className="text-foreground/90 whitespace-pre-wrap text-base">
            {text}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="default" onClick={() => setOpen(false)}>
            Понятно
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
