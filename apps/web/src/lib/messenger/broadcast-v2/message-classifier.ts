export const MARKETING_KEYWORDS = [
    'promoção',
    'novidade',
    'oferta',
    'desconto',
    'imperdível',
    'última chance',
    'vagas abertas'
];

export function detectMarketingContent(text: string): boolean {
    if (!text) return false;

    const normalizedText = text.toLowerCase();

    return MARKETING_KEYWORDS.some(keyword => normalizedText.includes(keyword.toLowerCase()));
}
