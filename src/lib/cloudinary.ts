import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

// Initialize Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  format: string;
  width: number;
  height: number;
}

/**
 * Uploads an image (base64 data URL, remote URL, or buffer) to Cloudinary.
 */
export async function uploadImageToCloudinary(
  fileOrDataUrl: string,
  folder = "churchy/uploads",
  options?: {
    maxWidth?: number;
    maxHeight?: number;
  }
): Promise<CloudinaryUploadResult> {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error("Cloudinary credentials are not configured in environment variables.");
  }

  const transformation: Array<Record<string, any>> = [
    { quality: "auto" },
    { fetch_format: "auto" },
  ];

  if (options?.maxWidth || options?.maxHeight) {
    transformation.push({
      width: options.maxWidth,
      height: options.maxHeight,
      crop: "limit",
    });
  }

  const result: UploadApiResponse = await cloudinary.uploader.upload(fileOrDataUrl, {
    folder,
    resource_type: "image",
    transformation,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    format: result.format,
    width: result.width,
    height: result.height,
  };
}

/**
 * Deletes an image from Cloudinary by its public ID.
 */
export async function deleteImageFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn("[Cloudinary] Failed to delete image:", err);
  }
}
