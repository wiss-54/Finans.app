/** Tek bir hareket satırı (gelir veya gider). */
export type TransactionKind = "income" | "expense";

export type Transaction = {
  id: string;
  kind: TransactionKind;
  amount: number;
  note: string;
  vendor?: string;
  invoiceUrl?: string;
  createdAt: string;
};

export const STORAGE_KEY = "finans-app-transactions";

export function loadTransactions(): Transaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTransaction);
  } catch {
    return [];
  }
}

export function saveTransactions(items: Transaction[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function isTransaction(x: unknown): x is Transaction {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.kind === "income" || o.kind === "expense") &&
    typeof o.amount === "number" &&
    Number.isFinite(o.amount) &&
    typeof o.note === "string" &&
    (o.vendor === undefined || typeof o.vendor === "string") &&
    (o.invoiceUrl === undefined || typeof o.invoiceUrl === "string") &&
    typeof o.createdAt === "string"
  );
}
