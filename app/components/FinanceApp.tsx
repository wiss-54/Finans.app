"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadTransactions,
  saveTransactions,
  type Transaction,
  type TransactionKind,
} from "@/lib/transactions";

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 2,
});

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now());
}

export function FinanceApp() {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Transaction[]>([]);
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setItems(loadTransactions());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveTransactions(items);
  }, [items, ready]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of items) {
      if (t.kind === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, balance: income - expense };
  }, [items]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    const trimmed = note.trim();
    if (!trimmed) return;

    const row: Transaction = {
      id: newId(),
      kind,
      amount: value,
      note: trimmed,
      createdAt: new Date().toISOString(),
    };
    setItems((prev) => [row, ...prev]);
    setAmount("");
    setNote("");
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Kişisel finans</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Gelir ve gider ekle; liste tarayıcıda saklanır (sayfayı kapatınca da
          kalır).
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Gelir" value={totals.income} tone="income" />
        <SummaryCard label="Gider" value={totals.expense} tone="expense" />
        <SummaryCard label="Bakiye" value={totals.balance} tone="balance" />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Yeni işlem
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="kind"
                checked={kind === "income"}
                onChange={() => setKind("income")}
              />
              Gelir
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="kind"
                checked={kind === "expense"}
                onChange={() => setKind("expense")}
              />
              Gider
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Tutar</span>
              <input
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                inputMode="decimal"
                placeholder="Örn. 250 veya 99,50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Açıklama</span>
              <input
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Örn. Market, maaş"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Listeye ekle
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Son işlemler
        </h2>
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Henüz kayıt yok. Yukarıdan ilk işlemini ekleyebilirsin.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                    {t.note}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(t.createdAt).toLocaleString("tr-TR")} ·{" "}
                    {t.kind === "income" ? "Gelir" : "Gider"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      t.kind === "income"
                        ? "font-semibold text-emerald-600 dark:text-emerald-400"
                        : "font-semibold text-rose-600 dark:text-rose-400"
                    }
                  >
                    {t.kind === "income" ? "+" : "−"}
                    {money.format(t.amount)}
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    onClick={() => remove(t.id)}
                  >
                    Sil
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "income" | "expense" | "balance";
}) {
  const color =
    tone === "income"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "expense"
        ? "text-rose-700 dark:text-rose-400"
        : value >= 0
          ? "text-zinc-900 dark:text-zinc-100"
          : "text-rose-700 dark:text-rose-400";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>
        {money.format(value)}
      </p>
    </div>
  );
}
