
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TemplatePreview({ contentJson, variables }: any) {
    const [rendered, setRendered] = useState("");

    useEffect(() => {
        // Local Simulation of `renderTemplate`
        // This replicates the server logic for immediate feedback
        let text = contentJson?.text || "";

        // 1. Sim System Vars
        // text = text.replace("{{first_name}}", "John");
        // text = text.replace("{{last_name}}", "Doe");

        // 2. Custom Vars
        Object.keys(variables).forEach(key => {
            text = text.replace(`{{${key}}}`, variables[key] || `[${key}]`);
        });

        setRendered(text);
    }, [contentJson, variables]);

    return (
        <Card className="bg-gray-50 border-dashed">
            <CardContent className="pt-6">
                <h4 className="text-sm font-semibold text-gray-500 mb-2">LIVE PREVIEW</h4>

                <div className="bg-white p-4 rounded shadow-sm border border-gray-100 max-w-sm">
                    <div className="flex items-center space-x-2 mb-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold">
                            B
                        </div>
                        <div className="text-xs font-bold text-gray-700">Business Page</div>
                    </div>

                    <div className="bg-gray-100 p-3 rounded-lg rounded-tl-none text-sm text-gray-800 whitespace-pre-wrap">
                        {rendered || "Start tying..."}
                    </div>

                    <div className="text-[10px] text-gray-400 mt-1 text-right">Just now</div>
                </div>

                {/* Variable Inputs for Testing */}
                <div className="mt-4 space-y-2">
                    <h5 className="text-xs font-semibold">Test Variables:</h5>
                    {Object.keys(variables).map(opt => (
                        <div key={opt} className="grid grid-cols-3 gap-2 items-center">
                            <Label className="text-xs col-span-1 text-right">{opt}</Label>
                            <Input className="col-span-2 h-7 text-xs" placeholder="Value..."
                                onChange={(e) => {
                                    // Up to parent needed ideally, but local state for pure preview component
                                }}
                            />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
