import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

type ScanResponse = {
  vendor: string;
  amount: number | null;
  currency: "TRY" | "USD" | "EUR" | "GBP";
  invoiceUrl: string;
};

export const runtime = "nodejs";

function extractJson(text: string): Partial<ScanResponse> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as Partial<ScanResponse>;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
    }

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    let invoiceUrl = "";
    if (blobToken) {
      const filename = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const uploaded = await put(`invoices/${filename}`, file, {
        access: "public",
        addRandomSuffix: true,
      });
      invoiceUrl = uploaded.url;
    }

    const fallback: ScanResponse = {
      vendor: file.name.replace(/\.[^.]+$/, ""),
      amount: null,
      currency: "TRY",
      invoiceUrl,
    };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(fallback, { status: 200 });
    }

    const aiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Bu görsel bir fiş/fatura olabilir. Sadece JSON dön: {\"vendor\": string, \"amount\": number|null, \"currency\": \"TRY\"|\"USD\"|\"EUR\"|\"GBP\"}. amount toplam ödenecek tutar olsun.",
              },
              { type: "input_image", image_url: invoiceUrl },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      return NextResponse.json(fallback, { status: 200 });
    }

    const aiJson: unknown = await aiRes.json();
    const text =
      typeof aiJson === "object" && aiJson !== null
        ? (aiJson as { output_text?: string }).output_text ?? ""
        : "";
    const parsed = extractJson(text);

    if (!parsed) {
      return NextResponse.json(fallback, { status: 200 });
    }

    const vendor =
      typeof parsed.vendor === "string" && parsed.vendor.trim()
        ? parsed.vendor.trim()
        : fallback.vendor;
    const amount =
      typeof parsed.amount === "number" && Number.isFinite(parsed.amount)
        ? parsed.amount
        : null;
    const currency =
      parsed.currency === "TRY" ||
      parsed.currency === "USD" ||
      parsed.currency === "EUR" ||
      parsed.currency === "GBP"
        ? parsed.currency
        : "TRY";

    return NextResponse.json(
      { vendor, amount, currency, invoiceUrl } satisfies ScanResponse,
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Fatura yüklenirken bir hata oluştu." },
      { status: 500 },
    );
  }
}
