import { CURRENCY } from "../constants";

export function formatCurrency(amount: number): string {
  return `${CURRENCY}${amount.toLocaleString("en-PK")}`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
