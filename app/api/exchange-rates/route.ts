import { NextResponse } from "next/server";

type CurrencyCode = "TRY" | "USD" | "EUR" | "GBP";

type RatesResponse = {
  TRY: number;
  USD: number;
  EUR: number;
  GBP: number;
  updatedAt: string;
};

async function fetchTryPer(base: "USD" | "EUR" | "GBP"): Promise<number> {
  const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Rate fetch failed for ${base}`);
  }

  const data: unknown = await res.json();
  const rates = (data as { rates?: Record<string, number> }).rates;
  const tryValue = rates?.TRY;

  if (typeof tryValue !== "number" || !Number.isFinite(tryValue)) {
    throw new Error(`Invalid TRY rate for ${base}`);
  }

  return tryValue;
}

export async function GET() {
  try {
    const [usdTry, eurTry, gbpTry] = await Promise.all([
      fetchTryPer("USD"),
      fetchTryPer("EUR"),
      fetchTryPer("GBP"),
    ]);

    const body: RatesResponse = {
      TRY: 1,
      USD: usdTry,
      EUR: eurTry,
      GBP: gbpTry,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(body, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        TRY: 1,
        USD: 46,
        EUR: 53,
        GBP: 60,
        updatedAt: new Date().toISOString(),
      } satisfies RatesResponse,
      { status: 200 }
    );
  }
}
