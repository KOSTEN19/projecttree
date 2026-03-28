import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  QUICK_ADD_RELATIONS,
  getMoreRelationTypes,
  inferLineForRelation,
  relationNeedsLine,
} from "./treeAddRelativePresets.js";

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .trim();
}

/**
 * Модальное окно выбора типа связи для добавления родственника с древа.
 */
export function TreeAddRelativeRelationPicker({
  open,
  onOpenChange,
  basePersonId,
  onSelect,
}) {
  const [query, setQuery] = useState("");

  const moreTypes = useMemo(() => getMoreRelationTypes(), []);

  const filteredQuick = useMemo(() => {
    const q = norm(query);
    if (!q) return QUICK_ADD_RELATIONS;
    return QUICK_ADD_RELATIONS.filter((x) => norm(x.label).includes(q) || norm(x.relationType).includes(q));
  }, [query]);

  const filteredMore = useMemo(() => {
    const q = norm(query);
    if (!q) return moreTypes;
    return moreTypes.filter((t) => norm(t).includes(q));
  }, [moreTypes, query]);

  function pick(relationType, line) {
    setQuery("");
    onSelect({
      basePersonId: String(basePersonId || ""),
      relationType,
      line: line ?? "",
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setQuery("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="tree-add-relative-picker-dialog flex max-h-[min(85vh,560px)] w-[calc(100%-2rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 space-y-1.5 border-b border-border/60 px-4 py-3 pr-10">
          <DialogTitle className="text-base">Кого добавляем?</DialogTitle>
          <DialogDescription className="text-left text-xs sm:text-sm">
            Выберите тип связи с выбранным человеком. Дальше откроется форма анкеты.
          </DialogDescription>
        </DialogHeader>
        <div className="shrink-0 px-4 pt-2 pb-2">
          <Input
            type="search"
            placeholder="Поиск по названию связи…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9"
            autoComplete="off"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          <div className="text-muted-foreground mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wide">
            Часто используемые
          </div>
          <div className="mb-4 flex flex-col gap-1.5">
            {filteredQuick.length === 0 ? (
              <p className="text-muted-foreground text-xs">Ничего не найдено.</p>
            ) : (
              filteredQuick.map((q) => (
                <Button
                  key={q.relationType}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 w-full justify-start font-normal"
                  onClick={() => pick(q.relationType, q.line)}
                >
                  {q.label}
                </Button>
              ))
            )}
          </div>
          {filteredMore.length > 0 ? (
            <>
              <div className="text-muted-foreground mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wide">
                Другие типы
              </div>
              <div className="flex flex-col gap-1">
                {filteredMore.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full justify-start text-xs font-normal"
                    onClick={() =>
                      pick(t, relationNeedsLine(t) ? inferLineForRelation(t) : "")
                    }
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
