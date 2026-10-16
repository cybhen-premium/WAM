import { NextResponse } from "next/server";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const folder = (formData.get("folder") as string) || "churchy/uploads";

      if (!file) {
        return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const mime = file.type || "image/jpeg";
      const base64DataUri = `data:${mime};base64,${buffer.toString("base64")}`;

      const result = await uploadImageToCloudinary(base64DataUri, folder);
      return NextResponse.json({ ok: true, url: result.url, publicId: result.publicId });
    }

    const body = await req.json();
    const { image, folder = "churchy/uploads" } = body;

    if (!image) {
      return NextResponse.json({ ok: false, error: "No image provided" }, { status: 400 });
    }

    const result = await uploadImageToCloudinary(image, folder);
    return NextResponse.json({ ok: true, url: result.url, publicId: result.publicId });
  } catch (err: any) {
    console.error("[API Upload] Cloudinary upload error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Cloudinary upload failed" },
      { status: 500 }
    );
  }
}
