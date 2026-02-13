
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Policy</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {templates.map((t) => (
                            <TableRow key={t.id}>
                                <TableCell>{t.name}</TableCell>
                                <TableCell>{t.category}</TableCell>
                                <TableCell>
                                    <Badge variant={t.policy === '24H' ? 'default' : 'secondary'}>
                                        {t.policy}
                                    </Badge>
                                </TableCell>
                                <TableCell>{t.status}</TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="sm">Edit</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
