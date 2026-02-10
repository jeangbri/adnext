import sharp from "sharp";
import { CardFormat, getFormatConfig } from "@/lib/types/card-format";

interface DeriveResult {
    buffer: Buffer;
    width: number;
    height: number;
    format: string;
}

/**
 * Derives (center-crops) an image to match the target card format.
 * Uses sharp for server-side image processing.
 */
export async function deriveCardImage(
    imageBuffer: Buffer,
    targetFormat: CardFormat
): Promise<DeriveResult> {
    const config = getFormatConfig(targetFormat);
    const targetWidth = config.idealWidth;
    const targetHeight = config.idealHeight;

    const metadata = await sharp(imageBuffer).metadata();
    const srcWidth = metadata.width || targetWidth;
    const srcHeight = metadata.height || targetHeight;

    // Calculate crop dimensions maintaining target aspect ratio
    const targetRatio = targetWidth / targetHeight;
    const srcRatio = srcWidth / srcHeight;

    let cropWidth: number;
    let cropHeight: number;

    if (srcRatio > targetRatio) {
        // Source is wider → crop sides
        cropHeight = srcHeight;
        cropWidth = Math.round(srcHeight * targetRatio);
    } else {
        // Source is taller → crop top/bottom
        cropWidth = srcWidth;
        cropHeight = Math.round(srcWidth / targetRatio);
    }

    // Center crop offsets
    const left = Math.round((srcWidth - cropWidth) / 2);
    const top = Math.round((srcHeight - cropHeight) / 2);

    const result = await sharp(imageBuffer)
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .resize(targetWidth, targetHeight, {
            fit: "fill",
            kernel: sharp.kernel.lanczos3,
        })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

    return {
        buffer: result.data,
        width: targetWidth,
        height: targetHeight,
        format: "jpeg",
    };
}

/**
 * Get image dimensions from buffer without processing.
 */
export async function getImageDimensions(
    imageBuffer: Buffer
): Promise<{ width: number; height: number }> {
    const metadata = await sharp(imageBuffer).metadata();
    return {
        width: metadata.width || 0,
        height: metadata.height || 0,
    };
}
