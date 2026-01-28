import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function parseTimeToMs(timeStr: string): number {
    if (!timeStr) return 0;
    const [value, unit] = timeStr.trim().split(' ');
    const num = parseInt(value);
    if (isNaN(num)) return 0;

    if (unit.startsWith('segundo')) return num * 1000;
    if (unit.startsWith('minuto')) return num * 60 * 1000;
    if (unit.startsWith('hora')) return num * 60 * 60 * 1000;
    if (unit.startsWith('dia')) return num * 24 * 60 * 60 * 1000;

    return num * 1000; // default seconds
}

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
