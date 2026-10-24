import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const churchId = searchParams.get("churchId");

    let logoUrl: string | null = null;

    if (churchId) {
      const [ch] = await db
        .select({ logoUrl: schema.church.logoUrl })
        .from(schema.church)
        .where(eq(schema.church.id, churchId))
        .limit(1);
      if (ch?.logoUrl) logoUrl = ch.logoUrl;
    }

    if (!logoUrl) {
      const [ch] = await db
        .select({ logoUrl: schema.church.logoUrl })
        .from(schema.church)
        .limit(1);
      if (ch?.logoUrl) logoUrl = ch.logoUrl;
    }

    // 1. If base64 data URI, decode and return directly
    if (logoUrl && logoUrl.startsWith("data:image/")) {
      const match = logoUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const buffer = Buffer.from(match[2], "base64");
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": mime,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          },
        });
      }
    }

    // 2. If remote HTTP / HTTPS URL, redirect to it
    if (logoUrl && /^https?:\/\//.test(logoUrl)) {
      return NextResponse.redirect(logoUrl, 307);
    }

    // 3. Fallback: serve local logo.png
    const fallbackPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(fallbackPath)) {
      const fileBuffer = fs.readFileSync(fallbackPath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }
  } catch (err) {
    console.error("[api/church/logo] Error serving church logo:", err);
  }

  // Final fallback to 404 or redirect
  return NextResponse.redirect(new URL("/logo.png", req.url), 307);
}
