import { ROMAN } from "./constants";
import type { PersonClient } from "@/types/api";

export function yearOf(person: PersonClient | null | undefined): number | null {
  const y = parseInt((person?.birthDate || "").slice(0, 4), 10);
  return Number.isFinite(y) && y > 1000 && y < 2100 ? y : null;
}

export function centuryOf(year: number): number {
  return Math.ceil(year / 100);
}

export function centuryLabel(c: number): string {
  const from = (c - 1) * 100 + 1;
  const to = c * 100;
  return `${ROMAN[c] || c} век (${from}-${to})`;
}
