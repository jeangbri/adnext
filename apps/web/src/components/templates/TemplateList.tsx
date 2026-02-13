"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TemplateList({ pageId }: { pageId: string }) {
    const [templates, setTemplates] = useState<any[]>([]);

    useEffect(() => {
        fetch(`/api/templates?pageId=${pageId}`)
            .then(res => res.json())
            .then(data => setTemplates(data))
            .catch(err => console.error(err));
    }, [pageId]);

    return (
        <Card>
            <CardContent className="pt-6">
                <h3 className="font-bold mb-4">Existing Templates</h3>
                <div className="rounded-md border">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Category</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Policy</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {templates.map((t) => (
                                <tr key={t.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <td className="p-4 align-middle">{t.name}</td>
                                    <td className="p-4 align-middle">{t.category}</td>
                                    <td className="p-4 align-middle">
                                        <Badge variant={t.policy === '24H' ? 'default' : 'secondary'}>
                                            {t.policy}
                                        </Badge>
                                    </td>
                                    <td className="p-4 align-middle">{t.status}</td>
                                    <td className="p-4 align-middle">
                                        <Button variant="ghost" size="sm">Edit</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
