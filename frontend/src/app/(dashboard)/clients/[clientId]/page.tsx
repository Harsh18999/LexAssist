"use client";

import { use } from "react";
import { ArrowLeft, Mail, Phone, MapPin, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useClient } from "@/hooks/useClients";
import { useCases } from "@/hooks/useCases";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import Link from "next/link";
import { format } from "date-fns";

export default function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
    const { clientId } = use(params);
    const { data: client, isLoading } = useClient(clientId);
    const { data: cases } = useCases({ client: clientId });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-[200px] rounded-xl" />
            </div>
        );
    }

    if (!client) {
        return <div className="text-center py-12 text-muted-foreground">Client not found</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/clients"><ArrowLeft className="w-4 h-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
                    <p className="text-sm text-muted-foreground">
                        Client since {format(new Date(client.created_at), "dd MMM yyyy")}
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Contact Info */}
                <Card>
                    <CardHeader><CardTitle className="text-base">Contact Information</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {client.email && (
                            <div className="flex items-center gap-3 text-sm">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <span>{client.email}</span>
                            </div>
                        )}
                        {client.phone && (
                            <div className="flex items-center gap-3 text-sm">
                                <Phone className="w-4 h-4 text-muted-foreground" />
                                <span>{client.phone}</span>
                            </div>
                        )}
                        {client.address && (
                            <div className="flex items-start gap-3 text-sm">
                                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                                <span>{client.address}</span>
                            </div>
                        )}
                        {!client.email && !client.phone && !client.address && (
                            <p className="text-sm text-muted-foreground">No contact info provided</p>
                        )}
                    </CardContent>
                </Card>

                {/* Cases */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base">
                            <Briefcase className="w-4 h-4 inline mr-2" />
                            Cases ({cases?.count || 0})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {cases?.results && cases.results.length > 0 ? (
                            <div className="space-y-2">
                                {cases.results.map((c) => (
                                    <Link
                                        key={c.id}
                                        href={`/cases/${c.id}`}
                                        className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{c.case_title}</p>
                                            <p className="text-xs text-muted-foreground">{c.case_number || "No case number"}</p>
                                        </div>
                                        <Badge className={STATUS_COLORS[c.status]} variant="secondary">
                                            {STATUS_LABELS[c.status]}
                                        </Badge>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-6">No cases for this client</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
