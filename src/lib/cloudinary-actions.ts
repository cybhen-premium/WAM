"use server";

import { uploadImageToCloudinary } from "./cloudinary";

/**
 * Server action to upload an image data URL or base64 string to Cloudinary.
 * Returns the secure HTTPS Cloudinary URL.
 */
export async function uploadImageAction(
  dataUrlOrBase64: string,
  folder = "churchy/uploads"
): Promise<{ ok: boolean; url?: string; publicId?: string; error?: string }> {
  try {
    if (!dataUrlOrBase64) {
      return { ok: false, error: "No image provided." };
    }
    const result = await uploadImageToCloudinary(dataUrlOrBase64, folder);
    return { ok: true, url: result.url, publicId: result.publicId };
  } catch (err: any) {
    console.error("[uploadImageAction] Cloudinary upload error:", err);
    return { ok: false, error: err?.message || "Failed to upload image to Cloudinary." };
  }
}
