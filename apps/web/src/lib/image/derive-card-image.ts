import sharp from "sharp";
import { CardFormat, getFormatConfig } from "@/lib/types/card-format";

interface DeriveResult {
    buffer: Buffer;
    width: number;
    height: number;
    format: string;
}

/**
 * Derives an image to match the target card format.
 * 
 * Two strategies:
 * - "crop": Center-crops and resizes to exact target dimensions (SQUARE, LANDSCAPE)
 * - "fit": Fits ENTIRE image inside a square canvas with white background (PORTRAIT)
 *   → This ensures the image appears complete without any cropping in Messenger.
 *   → Since Messenger's "square" container is 1:1, a 4:5 image gets horizontal padding.
 */
export async function deriveCardImage(
    imageBuffer: Buffer,
    targetFormat: CardFormat
): Promise<DeriveResult> {
    const config = getFormatConfig(targetFormat);

    if (config.deriveStrategy === "fit") {
        return deriveFit(imageBuffer, config);
    }

    return deriveCrop(imageBuffer, config);
}

/**
 * Strategy: CENTER CROP
 * Crops the image to the exact target aspect ratio, then resizes.
 * Used for SQUARE (1:1) and LANDSCAPE (1.91:1).
 */
async function deriveCrop(
    imageBuffer: Buffer,
    config: ReturnType<typeof getFormatConfig>
): Promise<DeriveResult> {
    const targetWidth = config.idealWidth;
    const targetHeight = config.idealHeight;

    const metadata = await sharp(imageBuffer).metadata();
    const srcWidth = metadata.width || targetWidth;
    const srcHeight = metadata.height || targetHeight;

    const targetRatio = targetWidth / targetHeight;
    const srcRatio = srcWidth / srcHeight;

    let cropWidth: number;
    let cropHeight: number;

    if (srcRatio > targetRatio) {
        cropHeight = srcHeight;
        cropWidth = Math.round(srcHeight * targetRatio);
    } else {
        cropWidth = srcWidth;
        cropHeight = Math.round(srcWidth / targetRatio);
    }

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
 * Strategy: FIT (no crop)
 * Places the ENTIRE image inside a 1:1 square canvas.
 * The image is resized to fit within the canvas, and the
 * remaining space is filled with a white background.
 * 
 * This means:
 * - A 4:5 portrait image → appears centered with white bars on left/right
 * - A 16:9 landscape image → appears centered with white bars on top/bottom
 * - The image is NEVER cropped, always shown in full
 * 
 * Combined with Messenger's image_aspect_ratio: "square", the
 * image appears complete without any cropping.
 */
async function deriveFit(
    imageBuffer: Buffer,
    config: ReturnType<typeof getFormatConfig>
): Promise<DeriveResult> {
    // Canvas is always square for Messenger "square" container
    const canvasSize = 1080;

    // Resize the image to fit within the canvas while maintaining aspect ratio
    const resized = await sharp(imageBuffer)
        .resize(canvasSize, canvasSize, {
            fit: "inside",
            withoutEnlargement: false,
            kernel: sharp.kernel.lanczos3,
        })
        .toBuffer({ resolveWithObject: true });

    const resizedWidth = resized.info.width;
    const resizedHeight = resized.info.height;

    // Create a white canvas and composite the resized image centered
    const result = await sharp({
        create: {
            width: canvasSize,
            height: canvasSize,
            channels: 3,
            background: { r: 255, g: 255, b: 255 },
        },
    })
        .composite([
            {
                input: resized.data,
                left: Math.round((canvasSize - resizedWidth) / 2),
                top: Math.round((canvasSize - resizedHeight) / 2),
            },
        ])
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

    return {
        buffer: result.data,
        width: canvasSize,
        height: canvasSize,
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
