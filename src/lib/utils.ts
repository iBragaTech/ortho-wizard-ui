import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Oculta a origem técnica do procedimento apenas no texto apresentado. */
export function hideProcedureOrigin(value: string): string {
  return value.replace(/[^\S\r\n]*\(origem(?:\s+[^)]*)?\)/gi, "");
}
