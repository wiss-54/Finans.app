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

type CurrencyCode = "TRY" | "USD" | "EUR" | "GBP";

/** API gelene kadar veya hata olunca kullanılan sabit kurlar (1 birim = kaç TRY). */
const DEFAULT_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  TRY: 1,
  USD: 46.0,
  EUR: 53.0,
  GBP: 60.0,
};

type ExchangeRates = Record<CurrencyCode, number> & {
  updatedAt: string;
};

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
  const [currency, setCurrency] = useState<CurrencyCode>("TRY");
  const [note, setNote] = useState("");
  const [vendor, setVendor] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [rates, setRates] = useState<ExchangeRates>(() => ({
    ...DEFAULT_EXCHANGE_RATES,
    updatedAt: new Date().toISOString(),
  }));

  useEffect(() => {
    setItems(loadTransactions());
    setReady(true);
  }, []);

  /** Sayfa açılınca ve her 30 dakikada bir canlı kurları `/api/exchange-rates` üzerinden çeker. */
  useEffect(() => {
    let active = true;

    async function loadRates() {
      try {
        const res = await fetch("/api/exchange-rates", { cache: "no-store" });
        if (!res.ok) return;
        const data: unknown = await res.json();
        const r = data as Partial<ExchangeRates>;
        if (
          typeof r.TRY === "number" &&
          typeof r.USD === "number" &&
          typeof r.EUR === "number" &&
          typeof r.GBP === "number" &&
          typeof r.updatedAt === "string" &&
          active
        ) {
          setRates({
            TRY: r.TRY,
            USD: r.USD,
            EUR: r.EUR,
            GBP: r.GBP,
            updatedAt: r.updatedAt,
          });
        }
      } catch {
        // API yanıt vermezse mevcut rates (varsayılan veya son başarılı) kalır.
      }
    }

    loadRates();
    const timer = setInterval(loadRates, 1000 * 60 * 30);
    return () => {
      active = false;
      clearInterval(timer);
    };
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
    const rate = rates[currency];
    const amountInTry = value * rate;
    const trimmed = note.trim();
    if (!trimmed) return;

    const row: Transaction = {
      id: newId(),
      kind,
      amount: amountInTry,
      note: trimmed,
      vendor: vendor.trim() || undefined,
      invoiceUrl: invoiceUrl || undefined,
      createdAt: new Date().toISOString(),
    };
    setItems((prev) => [row, ...prev]);
    setAmount("");
    setNote("");
    setVendor("");
    setInvoiceUrl("");
    setScanError("");
  }

  async function handleInvoiceSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);
    setScanning(true);
    setScanError("");

    try {
      const res = await fetch("/api/invoice-scan", {
        method: "POST",
        body: form,
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        setScanError("Fatura taranamadı. Lütfen tekrar dene.");
        return;
      }

      const parsed = data as {
        vendor?: string;
        amount?: number | null;
        currency?: CurrencyCode;
        invoiceUrl?: string;
      };

      if (typeof parsed.vendor === "string" && parsed.vendor.trim()) {
        setVendor(parsed.vendor.trim());
        setNote((prev) => (prev.trim() ? prev : parsed.vendor!.trim()));
      }
      if (typeof parsed.amount === "number" && Number.isFinite(parsed.amount)) {
        setAmount(String(parsed.amount));
      }
      if (
        parsed.currency === "TRY" ||
        parsed.currency === "USD" ||
        parsed.currency === "EUR" ||
        parsed.currency === "GBP"
      ) {
        setCurrency(parsed.currency);
      }
      if (typeof parsed.invoiceUrl === "string") {
        setInvoiceUrl(parsed.invoiceUrl);
      }
    } catch {
      setScanError("Fatura taranamadı. Lütfen tekrar dene.");
    } finally {
      setScanning(false);
      e.target.value = "";
    }
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
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Yeni işlem
        </h2>
        <p className="mt-1 mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Kur güncelleme:{" "}
          {new Date(rates.updatedAt).toLocaleString("tr-TR")}
        </p>
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
          <div className="grid gap-3 sm:grid-cols-3">
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
              <span className="text-zinc-600 dark:text-zinc-400">Para birimi</span>
              <select
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                >
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Açıklama
              </span>
              <input
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Örn. Market, maaş"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Şirket (otomatik dolabilir)
              </span>
              <input
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Örn. A101, Migros, Starbucks"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </label>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Fatura fotoğrafı
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleInvoiceSelect}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {scanning
                  ? "Fatura okunuyor..."
                  : invoiceUrl
                    ? "Fatura yüklendi ve kayıtla saklanacak."
                    : "Fotoğraf çek veya galeriden seç."}
              </p>
              {scanError ? (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {scanError}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            disabled={scanning}
          >
            {scanning ? "Fatura okunuyor..." : "Listeye ekle"}
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
                  {t.vendor ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Şirket: {t.vendor}
                    </p>
                  ) : null}
                  {t.invoiceUrl ? (
                    <a
                      href={t.invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Faturayı aç
                    </a>
                  ) : null}
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
