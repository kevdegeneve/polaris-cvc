import type { UserPreferredLanguage } from "../domain/types";
import { hasConfiguredLanguage } from "./languageService";

type FirestoreWritable =
  | string
  | number
  | boolean
  | null
  | Date
  | FirestoreWritable[]
  | { [key: string]: FirestoreWritable | unknown };

export function removeUndefinedFields<T extends object>(value: T): Record<string, FirestoreWritable | unknown> {
  return sanitizeFirestoreValue(value) as Record<string, FirestoreWritable | unknown>;
}

export function assertValidPreferredLanguage(language: unknown): asserts language is UserPreferredLanguage {
  if (!hasConfiguredLanguage(typeof language === "string" ? language : undefined)) {
    throw new Error("Langue de travail invalide.");
  }
}

function sanitizeFirestoreValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(sanitizeFirestoreValue).filter((item) => item !== undefined);

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, sanitizeFirestoreValue(item)] as const)
      .filter(([, item]) => item !== undefined)
  );
}
