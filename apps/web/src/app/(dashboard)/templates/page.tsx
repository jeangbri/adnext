
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";

// Subcomponents
import TemplateList from "@/components/templates/TemplateList";
import TemplateEditor from "@/components/templates/TemplateEditor";
import TemplatePreview from "@/components/templates/TemplatePreview";

export default function TemplateLibraryPage({ params }: { params: { pageId: string } }) {
    const [activeTab, setActiveTab] = useState("list");
    // Page and Project IDs could be fetched or passed via Layout/Params
    // For now we stub or get from context if available in dashboard layout
    const pageId = "default-pid"; // In production, grab from context
    const projectId = "default-proj";

    return (
        <div className="container mx-auto py-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Template Library PRO</h1>
                    <p className="text-gray-500">Manage your compliant Messenger templates.</p>
                </div>
                <div className="space-x-2">
                    <Button variant={activeTab === 'list' ? 'secondary' : 'ghost'} onClick={() => setActiveTab("list")}>
                        List
                    </Button>
                    <Button variant={activeTab === 'create' ? 'default' : 'outline'} onClick={() => setActiveTab("create")}>
                        + New Template
                    </Button>
                </div>
            </div>

            {activeTab === 'list' && (
                <TemplateList pageId={pageId} />
            )}

            {activeTab === 'create' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <TemplateEditor
                            pageId={pageId}
                            projectId={projectId}
                            onSave={() => setActiveTab('list')}
                        />
                    </div>
                    <div className="space-y-4">
                        <Card>
                            <CardContent className="pt-6">
                                <h3 className="font-bold mb-4 text-gray-700">Preview & Testing</h3>
                                <div className="p-4 bg-gray-50 border rounded text-center text-sm text-gray-500">
                                    Type in the editor to see live preview
                                </div>
                                {/* We can lift state up to share content between Editor and Preview if needed */}
                                {/* For now, Editor handles its own state, so Preview here is static/placeholder unless we wire it up */}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
