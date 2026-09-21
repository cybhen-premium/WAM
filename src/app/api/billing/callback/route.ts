import { NextResponse, type NextRequest } from "next/server";
import { settlePayment } from "@/lib/billing";

/** The payment provider redirects here after checkout (Paystack: ?reference=, Flutterwave: ?tx_ref=). */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const reference = q.get("reference") ?? q.get("trxref") ?? q.get("tx_ref");
  const url = new URL("/billing", request.url);
  if (!reference) {
    url.searchParams.set("payment", "Missing payment reference.");
    return NextResponse.redirect(url);
  }
  const result = await settlePayment(reference);
  url.searchParams.set("payment", result.message);
  url.searchParams.set("ok", result.ok ? "1" : "0");
  return NextResponse.redirect(url);
}
