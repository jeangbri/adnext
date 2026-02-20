import { NextRequest, NextResponse } from "next/server";

// Marketing/promotional keywords that violate Meta's utility policy
const MARKETING_KEYWORDS = [
    'promoção', 'promoções', 'promover', 'promocional',
    'desconto', 'descontos',
    'oferta', 'ofertas', 'oferta especial', 'oferta exclusiva',
    'imperdível', 'imperdíveis',
    'última chance', 'últimas vagas',
    'vagas abertas', 'vagas limitadas',
    'grátis', 'gratuito', 'free',
    'compre', 'comprar', 'adquira',
    'aproveite', 'aproveitar',
    'exclusivo', 'exclusiva',
    'liquidação', 'saldão',
    'black friday', 'cyber monday',
    'cupom', 'cupons', 'código promocional',
    'frete grátis',
    'só hoje', 'somente hoje',
    'por tempo limitado',
    'não perca', 'não percam',
    'lançamento', 'novidade',
    'preço especial', 'menor preço',
    'cashback',
    'bônus', 'bonus',
    'ganhe', 'ganha',
    'sorteio', 'concurso',
    'inscreva-se', 'cadastre-se',
    'link na bio',
];

// Urgency/pressure words that indicate marketing
const URGENCY_KEYWORDS = [
    'urgente', 'corra', 'agora',
    'hoje', 'já',
    'limite', 'limitado', 'limitada',
    'últimas unidades', 'estoque limitado',
    'enquanto durar', 'enquanto dura',
    'esgotando', 'acabando',
];

// Words that indicate transactional/utility content (positive signals)
const UTILITY_KEYWORDS = [
    'pedido', 'encomenda', 'rastreamento', 'rastreio',
    'entrega', 'envio', 'despacho',
    'agendamento', 'consulta', 'horário',
    'pagamento', 'fatura', 'boleto', 'pix',
    'senha', 'verificação', 'código',
    'conta', 'cadastro', 'perfil',
    'atualização', 'atualizar', 'status',
    'confirmação', 'confirmar', 'confirmado',
    'reagendar', 'cancelar', 'cancelamento',
    'suporte', 'atendimento', 'ajuda',
    'problema', 'resolvido', 'solução',
    'lembrete', 'aviso',
];

interface AnalysisResult {
    status: 'APPROVED' | 'WARNING' | 'BLOCKED';
    score: number; // 0-100, 100 = compliant
    issues: Issue[];
    suggestion: string | null;
    category: 'UTILITY' | 'MARKETING' | 'MIXED';
}

interface Issue {
    type: 'marketing_keyword' | 'urgency' | 'too_promotional' | 'missing_context' | 'length';
    keyword?: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
}

function analyzeMessage(text: string, policyMode: string): AnalysisResult {
    if (!text || !text.trim()) {
        return {
            status: 'BLOCKED',
            score: 0,
            issues: [{ type: 'missing_context', message: 'Mensagem vazia.', severity: 'error' }],
            suggestion: null,
            category: 'UTILITY'
        };
    }

    const normalizedText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const originalLower = text.toLowerCase();
    const issues: Issue[] = [];
    let score = 100;

    // Check marketing keywords
    const foundMarketing: string[] = [];
    for (const kw of MARKETING_KEYWORDS) {
        const normalizedKw = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalizedText.includes(normalizedKw) || originalLower.includes(kw)) {
            foundMarketing.push(kw);
            issues.push({
                type: 'marketing_keyword',
                keyword: kw,
                message: `Palavra de marketing detectada: "${kw}"`,
                severity: policyMode === 'UTILITY' ? 'error' : 'warning'
            });
            score -= 15;
        }
    }

    // Check urgency keywords
    const foundUrgency: string[] = [];
    for (const kw of URGENCY_KEYWORDS) {
        const normalizedKw = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalizedText.includes(normalizedKw) || originalLower.includes(kw)) {
            foundUrgency.push(kw);
            issues.push({
                type: 'urgency',
                keyword: kw,
                message: `Palavra de urgência/pressão: "${kw}"`,
                severity: policyMode === 'UTILITY' ? 'error' : 'warning'
            });
            score -= 10;
        }
    }

    // Check for utility signals
    let utilitySignals = 0;
    for (const kw of UTILITY_KEYWORDS) {
        const normalizedKw = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalizedText.includes(normalizedKw) || originalLower.includes(kw)) {
            utilitySignals++;
        }
    }

    // Length check
    if (text.length > 640) {
        issues.push({
            type: 'length',
            message: 'Mensagem muito longa (máx 640 caracteres para Messenger).',
            severity: 'warning'
        });
        score -= 5;
    }

    // Determine category
    let category: 'UTILITY' | 'MARKETING' | 'MIXED' = 'UTILITY';
    if (foundMarketing.length > 2 || (foundMarketing.length > 0 && foundUrgency.length > 0)) {
        category = 'MARKETING';
    } else if (foundMarketing.length > 0 && utilitySignals > 0) {
        category = 'MIXED';
    } else if (foundMarketing.length > 0) {
        category = 'MARKETING';
    }

    // Boost for utility signals
    score += utilitySignals * 5;
    score = Math.max(0, Math.min(100, score));

    // Determine status
    let status: 'APPROVED' | 'WARNING' | 'BLOCKED';
    if (policyMode === 'UTILITY') {
        if (category === 'MARKETING') {
            status = 'BLOCKED';
        } else if (category === 'MIXED' || score < 70) {
            status = 'WARNING';
        } else {
            status = 'APPROVED';
        }
    } else {
        // 24h mode - always allowed but inform
        status = score >= 50 ? 'APPROVED' : 'WARNING';
    }

    // Generate suggestion if blocked or warning
    let suggestion: string | null = null;
    if (status === 'BLOCKED' || status === 'WARNING') {
        suggestion = generateRewrite(text, foundMarketing, foundUrgency, policyMode);
    }

    return { status, score, issues, suggestion, category };
}

function generateRewrite(
    original: string,
    marketingWords: string[],
    urgencyWords: string[],
    policyMode: string
): string {
    let rewritten = original;

    // Replace marketing words with utility alternatives
    const replacements: Record<string, string> = {
        'promoção': 'atualização',
        'promoções': 'atualizações',
        'desconto': 'condição especial de pagamento',
        'descontos': 'condições de pagamento',
        'oferta': 'informação disponível',
        'ofertas': 'informações disponíveis',
        'oferta especial': 'informação importante',
        'oferta exclusiva': 'informação personalizada',
        'imperdível': 'importante',
        'última chance': 'prazo se aproximando',
        'últimas vagas': 'vagas disponíveis',
        'vagas abertas': 'vagas disponíveis',
        'grátis': 'incluso',
        'gratuito': 'incluso',
        'compre': 'confira',
        'comprar': 'verificar',
        'adquira': 'confira',
        'aproveite': 'confira',
        'exclusivo': 'personalizado',
        'exclusiva': 'personalizada',
        'liquidação': 'atualização de preços',
        'cupom': 'código de referência',
        'cupons': 'códigos de referência',
        'não perca': 'confira',
        'não percam': 'confiram',
        'lançamento': 'atualização',
        'novidade': 'atualização',
        'preço especial': 'condição atualizada',
        'menor preço': 'valor atualizado',
        'só hoje': 'até o prazo',
        'somente hoje': 'dentro do prazo',
        'por tempo limitado': 'com prazo definido',
        'ganhe': 'receba',
        'ganha': 'recebe',
        'sorteio': 'seleção',
        'inscreva-se': 'confirme sua participação',
        'cadastre-se': 'complete seu cadastro',
        'frete grátis': 'envio incluso',
        'cashback': 'benefício no pagamento',
        'bônus': 'benefício adicional',
        'bonus': 'benefício adicional',
    };

    const urgencyReplacements: Record<string, string> = {
        'urgente': '',
        'corra': '',
        'agora': 'quando possível',
        'já': '',
        'esgotando': 'com disponibilidade limitada',
        'acabando': 'com prazo próximo',
        'últimas unidades': 'unidades disponíveis',
        'estoque limitado': 'disponibilidade atualizada',
    };

    // Apply replacements (case insensitive)
    for (const mw of marketingWords) {
        const replacement = replacements[mw.toLowerCase()];
        if (replacement) {
            const regex = new RegExp(mw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            rewritten = rewritten.replace(regex, replacement);
        }
    }

    for (const uw of urgencyWords) {
        const replacement = urgencyReplacements[uw.toLowerCase()];
        if (replacement !== undefined) {
            const regex = new RegExp(uw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            rewritten = rewritten.replace(regex, replacement);
        }
    }

    // Clean up double spaces
    rewritten = rewritten.replace(/  +/g, ' ').trim();

    return rewritten;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { text, policyMode } = body;

        if (!text) {
            return NextResponse.json({ error: "text is required" }, { status: 400 });
        }

        const result = analyzeMessage(text, policyMode || 'UTILITY');
        return NextResponse.json(result);
    } catch (error) {
        console.error("Analyze message error", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
