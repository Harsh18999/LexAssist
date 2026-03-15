"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2, Calendar, MapPin, User2, Scale, DollarSign } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useCase } from "@/hooks/useCases";
import { useParties, useCreateParty, useDeleteParty, useStages, useCreateStage, useStatusHistory, useCourtDetails, useFinancials } from "@/hooks/useCases";
import {
    STATUS_LABELS, STATUS_COLORS,
    PRIORITY_LABELS, PRIORITY_COLORS,
    COURT_LEVEL_LABELS, CASE_TYPE_LABELS, PARTY_TYPE_LABELS,
    type PartyType,
} from "@/types";

// --- Party Form ---
const partySchema = z.object({
    party_name: z.string().min(1, "Name required"),
    party_type: z.string().min(1, "Type required"),
    contact_number: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
});

// --- Stage Form ---
const stageSchema = z.object({
    stage_name: z.string().min(1, "Stage name required"),
    started_at: z.string().optional(),
    ended_at: z.string().optional(),
    notes: z.string().optional(),
});

export default function CaseDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
    const { caseId } = use(params);
    const { data: caseData, isLoading } = useCase(caseId);

    const { data: partiesData } = useParties({ case: caseId });
    const { data: stagesData } = useStages({ case: caseId });
    const { data: historyData } = useStatusHistory({ case: caseId });
    const { data: courtData } = useCourtDetails({ case: caseId });
    const { data: financialData } = useFinancials({ case: caseId });

    const createParty = useCreateParty();
    const deleteParty = useDeleteParty();
    const createStage = useCreateStage();

    const [partyDialog, setPartyDialog] = useState(false);
    const [stageDialog, setStageDialog] = useState(false);

    const partyForm = useForm({ resolver: zodResolver(partySchema) });
    const stageForm = useForm({ resolver: zodResolver(stageSchema) });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-[400px] rounded-xl" />
            </div>
        );
    }

    if (!caseData) {
        return <div className="text-center py-12 text-muted-foreground">Case not found</div>;
    }

    const handleAddParty = async (data: z.infer<typeof partySchema>) => {
        await createParty.mutateAsync({
            case: caseId,
            party_name: data.party_name,
            party_type: data.party_type as PartyType,
            contact_number: data.contact_number || "",
            email: data.email || "",
            address: data.address || "",
        });
        setPartyDialog(false);
        partyForm.reset();
    };

    const handleAddStage = async (data: z.infer<typeof stageSchema>) => {
        await createStage.mutateAsync({
            case: caseId,
            stage_name: data.stage_name,
            started_at: data.started_at || null,
            ended_at: data.ended_at || null,
            notes: data.notes || "",
        });
        setStageDialog(false);
        stageForm.reset();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
                <Button variant="ghost" size="icon" asChild className="mt-1">
                    <Link href="/cases"><ArrowLeft className="w-4 h-4" /></Link>
                </Button>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{caseData.case_title}</h1>
                        <Badge className={STATUS_COLORS[caseData.status]} variant="secondary">
                            {STATUS_LABELS[caseData.status]}
                        </Badge>
                        <Badge className={PRIORITY_COLORS[caseData.priority_level]} variant="secondary">
                            {PRIORITY_LABELS[caseData.priority_level]}
                        </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        {caseData.case_number && <span>#{caseData.case_number}</span>}
                        <span>Client: {caseData.client_name}</span>
                        <span>{CASE_TYPE_LABELS[caseData.case_type]}</span>
                        {caseData.court_level && <span>{COURT_LEVEL_LABELS[caseData.court_level]}</span>}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="parties">Parties{partiesData?.count ? ` (${partiesData.count})` : ""}</TabsTrigger>
                    <TabsTrigger value="stages">Stages{stagesData?.count ? ` (${stagesData.count})` : ""}</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="financials">Financials</TabsTrigger>
                    <TabsTrigger value="hearings" disabled className="opacity-50">Hearings 🔒</TabsTrigger>
                    <TabsTrigger value="documents" disabled className="opacity-50">Documents 🔒</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader><CardTitle className="text-base">Case Information</CardTitle></CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <InfoRow label="Case Title" value={caseData.case_title} />
                                <InfoRow label="Case Number" value={caseData.case_number || "—"} />
                                <InfoRow label="CNR Number" value={caseData.cnr_number || "—"} />
                                <InfoRow label="Type" value={CASE_TYPE_LABELS[caseData.case_type]} />
                                <InfoRow label="Act" value={caseData.act_name || "—"} />
                                <InfoRow label="Primary Section" value={caseData.primary_section || "—"} />
                                <InfoRow label="Current Stage" value={caseData.current_stage || "—"} />
                                {caseData.filing_date && (
                                    <InfoRow label="Filing Date" value={format(new Date(caseData.filing_date), "dd MMM yyyy")} />
                                )}
                                {caseData.limitation_end_date && (
                                    <InfoRow label="Limitation Date" value={format(new Date(caseData.limitation_end_date), "dd MMM yyyy")} />
                                )}
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            {/* Court Details */}
                            <Card>
                                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Scale className="w-4 h-4" />Court Details</CardTitle></CardHeader>
                                <CardContent>
                                    {courtData?.results && courtData.results.length > 0 ? (
                                        <div className="space-y-3 text-sm">
                                            {courtData.results.map((cd) => (
                                                <div key={cd.id} className="space-y-1">
                                                    <InfoRow label="Court" value={cd.court_name} />
                                                    {cd.judge_name && <InfoRow label="Judge" value={cd.judge_name} />}
                                                    {cd.bench_type && <InfoRow label="Bench" value={cd.bench_type} />}
                                                    {cd.courtroom_number && <InfoRow label="Courtroom" value={cd.courtroom_number} />}
                                                    {cd.state && <InfoRow label="Location" value={`${cd.district}, ${cd.state}`} />}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No court details added</p>
                                    )}
                                </CardContent>
                            </Card>

                            {caseData.description && (
                                <Card>
                                    <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{caseData.description}</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* Parties Tab */}
                <TabsContent value="parties" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Case Parties</h3>
                        <Dialog open={partyDialog} onOpenChange={setPartyDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm"><Plus className="w-4 h-4 mr-1" />Add Party</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Add Party</DialogTitle></DialogHeader>
                                <form onSubmit={partyForm.handleSubmit(handleAddParty)} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Name *</Label>
                                        <Input {...partyForm.register("party_name")} placeholder="Party name" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Type *</Label>
                                        <Select onValueChange={(v) => partyForm.setValue("party_type", v)}>
                                            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(PARTY_TYPE_LABELS).map(([v, l]) => (
                                                    <SelectItem key={v} value={v}>{l}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Contact</Label>
                                            <Input {...partyForm.register("contact_number")} placeholder="+91..." />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email</Label>
                                            <Input {...partyForm.register("email")} placeholder="email@..." />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={createParty.isPending}>
                                        {createParty.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Add Party
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {partiesData?.results && partiesData.results.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {partiesData.results.map((p) => (
                                <Card key={p.id} className="group">
                                    <CardContent className="p-4 flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <User2 className="w-4 h-4 text-muted-foreground" />
                                                <span className="font-medium text-sm">{p.party_name}</span>
                                            </div>
                                            <Badge variant="outline" className="mt-1.5 text-xs">
                                                {PARTY_TYPE_LABELS[p.party_type]}
                                            </Badge>
                                            {p.contact_number && <p className="text-xs text-muted-foreground mt-1">{p.contact_number}</p>}
                                            {p.email && <p className="text-xs text-muted-foreground">{p.email}</p>}
                                        </div>
                                        <Button
                                            variant="ghost" size="icon"
                                            className="opacity-0 group-hover:opacity-100 text-destructive"
                                            onClick={() => deleteParty.mutate(p.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">No parties added yet</p>
                    )}
                </TabsContent>

                {/* Stages Tab */}
                <TabsContent value="stages" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Case Stages</h3>
                        <Dialog open={stageDialog} onOpenChange={setStageDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm"><Plus className="w-4 h-4 mr-1" />Add Stage</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Add Stage</DialogTitle></DialogHeader>
                                <form onSubmit={stageForm.handleSubmit(handleAddStage)} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Stage Name *</Label>
                                        <Input {...stageForm.register("stage_name")} placeholder="e.g. Filing, Arguments, Evidence" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Start Date</Label>
                                            <Input {...stageForm.register("started_at")} type="date" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>End Date</Label>
                                            <Input {...stageForm.register("ended_at")} type="date" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Notes</Label>
                                        <Textarea {...stageForm.register("notes")} rows={2} />
                                    </div>
                                    <Button type="submit" className="w-full" disabled={createStage.isPending}>
                                        {createStage.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Add Stage
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {stagesData?.results && stagesData.results.length > 0 ? (
                        <div className="relative pl-6 border-l-2 border-border space-y-6">
                            {stagesData.results.map((s) => (
                                <div key={s.id} className="relative">
                                    <div className="absolute -left-[calc(1.5rem+5px)] w-3 h-3 rounded-full bg-primary border-2 border-background" />
                                    <Card>
                                        <CardContent className="p-4">
                                            <h4 className="font-medium text-sm">{s.stage_name}</h4>
                                            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                                {s.started_at && (
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {format(new Date(s.started_at), "dd MMM yyyy")}
                                                    </span>
                                                )}
                                                {s.ended_at && <span>→ {format(new Date(s.ended_at), "dd MMM yyyy")}</span>}
                                            </div>
                                            {s.notes && <p className="text-xs text-muted-foreground mt-2">{s.notes}</p>}
                                        </CardContent>
                                    </Card>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">No stages recorded yet</p>
                    )}
                </TabsContent>

                {/* Timeline Tab */}
                <TabsContent value="timeline" className="space-y-4">
                    <h3 className="text-lg font-semibold">Status History</h3>
                    {historyData?.results && historyData.results.length > 0 ? (
                        <div className="relative pl-6 border-l-2 border-border space-y-4">
                            {historyData.results.map((h) => (
                                <div key={h.id} className="relative">
                                    <div className="absolute -left-[calc(1.5rem+5px)] w-3 h-3 rounded-full bg-muted-foreground/50 border-2 border-background" />
                                    <div className="p-3">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">{h.status}</Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(h.updated_at), "dd MMM yyyy, HH:mm")}
                                            </span>
                                        </div>
                                        {h.remarks && <p className="text-sm text-muted-foreground mt-1">{h.remarks}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">No status changes recorded</p>
                    )}
                </TabsContent>

                {/* Financials Tab */}
                <TabsContent value="financials" className="space-y-4">
                    <h3 className="text-lg font-semibold">Financial Summary</h3>
                    {financialData?.results && financialData.results.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {financialData.results
                                .filter((f) => f.case === caseId)
                                .map((f, i) => (
                                    <div key={i} className="contents">
                                        <FinCard label="Total Fee" value={f.total_fee} icon={DollarSign} color="text-blue-600" />
                                        <FinCard label="Received" value={f.total_received} icon={DollarSign} color="text-emerald-600" />
                                        <FinCard label="Expenses" value={f.total_expenses} icon={DollarSign} color="text-amber-600" />
                                        <FinCard label="Outstanding" value={f.outstanding_amount} icon={DollarSign} color="text-red-600" />
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">No financial data recorded</p>
                    )}
                </TabsContent>

                {/* Disabled tabs */}
                <TabsContent value="hearings">
                    <ComingSoon label="Hearings" />
                </TabsContent>
                <TabsContent value="documents">
                    <ComingSoon label="Documents" />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right">{value}</span>
        </div>
    );
}

function FinCard({ label, value, icon: Icon, color }: {
    label: string; value: string; icon: React.ElementType; color: string;
}) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-sm text-muted-foreground">{label}</span>
                </div>
                <p className="text-2xl font-bold mt-1">₹{Number(value).toLocaleString("en-IN")}</p>
            </CardContent>
        </Card>
    );
}

function ComingSoon({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Scale className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">{label} — Coming Soon</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                This feature requires backend endpoints that are not yet available. It will be enabled once the backend is updated.
            </p>
        </div>
    );
}
