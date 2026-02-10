export type CardFormat = "SQUARE" | "PORTRAIT" | "LANDSCAPE";
export type CropMode = "NONE" | "AUTO_CENTER_CROP";

export interface CardFormatConfig {
    label: string;
    ratio: number;        // width / height
    cssAspectRatio: string;
    idealWidth: number;
    idealHeight: number;
    idealLabel: string;
}

export const CARD_FORMAT_CONFIGS: Record<CardFormat, CardFormatConfig> = {
    SQUARE: {
        label: "Quadrado (1:1)",
        ratio: 1,
        cssAspectRatio: "1 / 1",
        idealWidth: 1080,
        idealHeight: 1080,
        idealLabel: "1080×1080 ou 1200×1200",
    },
    PORTRAIT: {
        label: "Retrato (4:5)",
        ratio: 4 / 5,
        cssAspectRatio: "4 / 5",
        idealWidth: 1080,
        idealHeight: 1350,
        idealLabel: "1080×1350",
    },
    LANDSCAPE: {
        label: "Paisagem (1.91:1)",
        ratio: 1.91,
        cssAspectRatio: "1.91 / 1",
        idealWidth: 1200,
        idealHeight: 628,
        idealLabel: "1200×628",
    },
};

export function getFormatConfig(format: CardFormat): CardFormatConfig {
    return CARD_FORMAT_CONFIGS[format] || CARD_FORMAT_CONFIGS.SQUARE;
}

export function detectImageRatio(width: number, height: number): number {
    if (height === 0) return 1;
    return width / height;
}

export function checkRatioMismatch(
    imgWidth: number,
    imgHeight: number,
    targetFormat: CardFormat,
    threshold = 0.15
): { isMismatch: boolean; currentRatio: string; recommendation: string } {
    const imgRatio = detectImageRatio(imgWidth, imgHeight);
    const config = getFormatConfig(targetFormat);
    const diff = Math.abs(imgRatio - config.ratio) / config.ratio;

    const currentRatioLabel =
        imgRatio > 1.5 ? "Paisagem" :
            imgRatio < 0.85 ? "Retrato" : "Quadrado";

    return {
        isMismatch: diff > threshold,
        currentRatio: `${currentRatioLabel} (~${imgRatio.toFixed(2)}:1)`,
        recommendation: `Para melhor resultado em ${config.label}, use ${config.idealLabel}.`,
    };
}
