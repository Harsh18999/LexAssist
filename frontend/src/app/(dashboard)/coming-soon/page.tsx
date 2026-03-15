"use client";

import { Lock, Gavel, FileText, CalendarDays, Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const disabledFeatures = [
    {
        icon: Gavel, title: "Hearings", href: "/hearings",
        description: "Track court hearings, schedule next dates, and record hearing outcomes.",
        requirement: "Requires Hearing model and API endpoints on the backend.",
    },
    {
        icon: FileText, title: "Documents", href: "/documents",
        description: "Upload, organize, and preview legal documents linked to cases.",
        requirement: "Requires Document model with file upload support on the backend.",
    },
    {
        icon: CalendarDays, title: "Calendar", href: "/calendar",
        description: "Calendar view of all upcoming hearings and important dates.",
        requirement: "Depends on Hearing endpoints — will be enabled after Hearings.",
    },
    {
        icon: Bot, title: "AI Legal Research Assistant", href: "/ai-assistant",
        description: "Chat with AI to research case law, analyze documents, and get legal summaries.",
        requirement: "Requires RAG pipeline, streaming chat endpoint, and conversation model.",
    },
];

export default function ComingSoonPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Coming Soon</h1>
                <p className="text-muted-foreground">
                    These features are designed and ready for frontend implementation, but require backend API endpoints that are not yet available.
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                {disabledFeatures.map((f) => (
                    <Card key={f.href} className="relative overflow-hidden opacity-75">
                        <div className="absolute top-3 right-3">
                            <Badge variant="secondary" className="text-xs">
                                <Lock className="w-3 h-3 mr-1" /> Locked
                            </Badge>
                        </div>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                    <f.icon className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <h3 className="font-semibold">{f.title}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">{f.description}</p>
                            <p className="text-xs text-muted-foreground/70 mt-3 italic">{f.requirement}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
