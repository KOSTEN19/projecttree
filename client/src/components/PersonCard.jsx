import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function PersonCard({ p }) {
  const name = [p.lastName, p.firstName].filter(Boolean).join(" ").trim() || "Без имени";
  const birth = p.birthDate ? `р. ${p.birthDate}` : "дата рождения не указана";
  const maiden = p?.sex === "F" && p?.maidenName ? `д. ${p.maidenName}` : null;

  return (
    <Card className="transition-colors hover:bg-muted/40">
      <CardContent className="p-3">
        <div className="text-sm font-medium leading-tight">{name}</div>
        {maiden && <p className="text-muted-foreground mt-0.5 text-xs">{maiden}</p>}
        <p className="text-muted-foreground mt-1 text-xs">{birth}</p>
      </CardContent>
    </Card>
  );
}
