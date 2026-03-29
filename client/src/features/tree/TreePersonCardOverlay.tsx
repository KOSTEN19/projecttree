import { Link } from "react-router-dom";
import type { TreeChipPerson } from "./TreeAvatars";
import { Av } from "./TreeAvatars";
import { fmtFullName } from "./buildGraph";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export type TreeAddRelativePayload = { basePersonId: string; relationType: string; line: string };

export type TreePersonBranchFocus =
  | { type: "maternal"; anchorId: string }
  | { type: "paternal"; anchorId: string }
  | { type: "lineage"; anchorId: string };

export type TreeCardPerson = TreeChipPerson & {
  isVirtual?: boolean;
  isPlaceholder?: boolean;
  middleName?: string;
  birthDate?: string;
  birthCity?: string;
  birthCityCustom?: string;
  phone?: string;
  alive?: boolean;
  deathDate?: string;
  burialPlace?: string;
  maidenName?: string;
  biography?: string;
  education?: string;
  workPath?: string;
  militaryPath?: string;
  externalLinks?: Array<{ title?: string; url: string }>;
  notes?: string;
};

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div
      className={`grid gap-1 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 sm:grid-cols-[minmax(7rem,9rem)_1fr] sm:items-start sm:gap-3 ${highlight ? "border-destructive/30 bg-destructive/5" : ""}`}
    >
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</div>
      <div className="text-sm leading-snug">{value}</div>
    </div>
  );
}

function ProseBlock({ title, body }: { title: string; body: string }) {
  if (!body?.trim()) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</h4>
      <p className="text-foreground/95 whitespace-pre-wrap text-sm leading-relaxed">{body.trim()}</p>
    </div>
  );
}

export function TreePersonCardOverlay({
  card,
  onClose,
  onStartAddRelative,
  onBeginRelationPicker,
  virtualAddPreset,
}: {
  card: TreeCardPerson;
  onClose: () => void;
  /** Добавление родственника с полотна древа (открывает степпер на странице дерева). */
  onStartAddRelative?: (p: TreeAddRelativePayload) => void;
  /** Открыть диалог выбора типа связи (родитель закрывает карточку и показывает picker). */
  onBeginRelationPicker?: (basePersonId: string) => void;
  /** Для заглушки v:… — готовые basePersonId / тип связи (из parseVirtualTreeNodeId). */
  virtualAddPreset?: TreeAddRelativePayload | null;
}) {
  const pid = String(card.id || "");
  const isVirtual = Boolean(card.isVirtual || card.isPlaceholder || pid.startsWith("v:"));
  const city = (card.birthCityCustom || card.birthCity || "").trim();
  const sexLabel = card.sex === "M" ? "Мужской" : card.sex === "F" ? "Женский" : "Не указан";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton
        overlayClassName="z-[1990]"
        className="z-[2000] flex max-h-[min(92vh,880px)] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 space-y-3 border-b border-border/60 bg-card px-5 pb-4 pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0">
              <Av p={card} size={96} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-xl leading-tight sm:text-2xl">{fmtFullName(card)}</DialogTitle>
                {card.isSelf ? (
                  <Badge>Вы</Badge>
                ) : isVirtual ? (
                  <Badge variant="secondary">Заглушка</Badge>
                ) : (
                  <Badge variant="outline">Родственник</Badge>
                )}
                {!card.alive ? <Badge variant="destructive">Память</Badge> : null}
              </div>
              <DialogDescription asChild>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {card.middleName ? `Отчество: ${card.middleName}. ` : null}
                  {card.birthDate ? `Родился(ась): ${card.birthDate}` : "Дата рождения не указана"}
                  {city ? ` · ${city}` : ""}
                </p>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <DetailRow label="Пол" value={sexLabel} />
              <DetailRow label="Телефон" value={(card.phone || "").trim()} />
              <DetailRow label="Статус" value={card.alive ? "Жив(а)" : "Умер(ла)"} highlight={!card.alive} />
              {card.deathDate ? <DetailRow label="Дата смерти" value={card.deathDate} highlight /> : null}
              {card.burialPlace ? <DetailRow label="Захоронение" value={card.burialPlace} /> : null}
              {card.sex === "F" && card.maidenName ? (
                <DetailRow label="Девичья фамилия" value={card.maidenName} />
              ) : null}
            </div>

            <Separator />

            {onStartAddRelative && pid ? (
              <div
                className={`space-y-3 rounded-lg border p-3 ${
                  card.isSelf ? "border-border bg-muted/30" : "border-primary/25 bg-primary/5"
                }`}
              >
                <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {isVirtual ? "Заполнить место в древе" : card.isSelf ? "Добавить от вашей карточки" : "Добавить родственника"}
                </h4>
                {isVirtual ? (
                  virtualAddPreset ? (
                    <Button
                      type="button"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        onStartAddRelative(virtualAddPreset);
                        onClose();
                      }}
                    >
                      Добавить этого человека
                    </Button>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Не удалось определить связь для этой заглушки. Добавьте родственника через вкладку «Родственники».
                    </p>
                  )
                ) : onBeginRelationPicker ? (
                  <>
                    <p className="text-muted-foreground text-sm">
                      {card.isSelf
                        ? "Откроется список типов связи: родитель, ребёнок, супруг и другие."
                        : "Новая карточка будет привязана к этому человеку. Линии на древе (материнская, отцовская) включаются из меню по клику на человека на полотне."}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => onBeginRelationPicker(pid)}
                    >
                      Выбрать тип связи…
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">Добавление с древа недоступно.</p>
                )}
              </div>
            ) : null}

            <Separator />

            <ProseBlock title="Краткая справка" body={card.notes || ""} />
            <ProseBlock title="Биография" body={card.biography || ""} />
            <ProseBlock title="Образование" body={card.education || ""} />
            <ProseBlock title="Трудовой путь" body={card.workPath || ""} />
            <ProseBlock title="Военная служба и эвакуации" body={card.militaryPath || ""} />

            {Array.isArray(card.externalLinks) && card.externalLinks.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Ссылки</h4>
                <ul className="flex flex-col gap-2">
                  {card.externalLinks.map((L, i) => (
                    <li key={i}>
                      <a
                        href={L.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {L.title?.trim() || L.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col gap-3 border-t border-border/60 bg-muted/40 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
            <Link
              to="/app/relatives"
              onClick={onClose}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              К списку родственников
            </Link>
            <Button type="button" variant="default" size="sm" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
