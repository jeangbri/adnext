
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export default function TemplateEditor({ pageId, projectId, onSave }: any) {
    const [name, setName] = useState("");
    const [category, setCategory] = useState("UTILITY");
    const [policy, setPolicy] = useState("UTILITY");
    const [content, setContent] = useState("");

    const handleSave = async () => {
        try {
            const response = await fetch("/api/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId,
                    pageId,
                    name,
                    category,
                    policy,
                    contentJson: { text: content }, // Simplified: just text for now
                    variablesJson: extractVariables(content)
                }),
            });

            if (!response.ok) throw new Error("Failed");

            toast.success("Template Created");
            onSave();
        } catch (e) {
            toast.error("Error creating template");
        }
    };

    const extractVariables = (text: string) => {
        // Extract {{var}}
        const regex = /{{(.*?)}}/g;
        const vars: any = {};
        let match;
        while ((match = regex.exec(text)) !== null) {
            vars[match[1]] = "string";
        }
        return vars;
    };

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                <h3 className="font-bold">Create New Template</h3>
                <div className="grid grid-cols-2 gap-4">
                    <Input placeholder="Template Name" value={name} onChange={e => setName(e.target.value)} />
                    <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="UTILITY">Utility</SelectItem>
                            <SelectItem value="BUSINESS">Business</SelectItem>
                            <SelectItem value="PROMOTIONAL">Promotional</SelectItem>
                            <SelectItem value="BROADCAST">Broadcast</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Select value={policy} onValueChange={setPolicy}>
                    <SelectTrigger><SelectValue placeholder="Policy" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="24H">Standard (24h Window)</SelectItem>
                        <SelectItem value="UTILITY">Utility (Outside 24h)</SelectItem>
                        <SelectItem value="TAGGED">Tagged (Specific Cases)</SelectItem>
                    </SelectContent>
                </Select>

                <Textarea
                    placeholder="Hello {{first_name}}, your order {{order_id}} is ready!"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    rows={5}
                />

                <div className="text-sm text-gray-500">
                    Detected Variables: {Object.keys(extractVariables(content)).join(", ")}
                </div>

                <Button onClick={handleSave}>Save Template</Button>
            </CardContent>
        </Card>
    );
}
