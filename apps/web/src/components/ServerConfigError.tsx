import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export function ServerConfigError({ details }: { details?: any }) {
    return (
        <div className="flex items-center justify-center min-h-[50vh] p-4">
            <Card className="w-full max-w-lg border-destructive/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        Configuração do servidor incompleta
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Não foi possível conectar ao banco de dados ou inicializar o sistema corretamente.
                    </p>
                    <div className="rounded bg-muted/50 p-3 text-xs font-mono">
                        <p className="font-semibold mb-2">Ação necessária na Vercel:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Verifique <strong>DATABASE_URL</strong> e <strong>DIRECT_URL</strong> (se usar pooled connection).</li>
                            <li>REMOVA a variável <strong>PRISMA_CLIENT_ENGINE_TYPE</strong> (para usar &apos;library&apos; default).</li>
                            <li>Certifique-se que o banco de dados está acessível.</li>
                        </ul>
                    </div>
                    {details && (
                        <div className="mt-4 pt-4 border-t">
                            <p className="text-xs font-semibold mb-1">Detalhes do erro:</p>
                            <pre className="text-[10px] bg-red-50 dark:bg-red-950/20 p-2 rounded overflow-auto max-h-32 text-red-600 dark:text-red-400">
                                {JSON.stringify(details, null, 2)}
                            </pre>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
