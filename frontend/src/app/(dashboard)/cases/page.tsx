"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useCases, useCreateCase } from "@/hooks/useCases";
import { useClients } from "@/hooks/useClients";
import { useDebounce } from "@/hooks/useDebounce";
import {
    STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS,
    CASE_TYPE_LABELS, COURT_LEVEL_LABELS,
    type CaseStatus, type CasePriority, type CaseType, type CourtLevel,
} from "@/types";
import { format } from "date-fns";

const caseSchema = z.object({
    case_title: z.string().min(1, "Title is required"),
    client: z.string().min(1, "Client is required"),
    case_number: z.string().optional(),
    cnr_number: z.string().optional(),
    case_type: z.string().optional(),
    status: z.string().optional(),
    priority_level: z.string().optional(),
    court_level: z.string().optional(),
    act_name: z.string().optional(),
    primary_section: z.string().optional(),
    description: z.string().optional(),
});
type CaseFormData = z.infer<typeof caseSchema>;

export default function CasesPage() {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [dialogOpen, setDialogOpen] = useState(false);
    const debouncedSearch = useDebounce(search);

    const params: Record<string, string> = { page: String(page) };
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter !== "all") params.status = statusFilter;
    if (typeFilter !== "all") params.case_type = typeFilter;

    const { data, isLoading } = useCases(params);
    const { data: clientsData } = useClients({});
    const createMutation = useCreateCase();

    const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<CaseFormData>({
        resolver: zodResolver(caseSchema),
        defaultValues: { case_type: "other", status: "pending", priority_level: "normal" },
    });

    const onSubmit = async (formData: CaseFormData) => {
        await createMutation.mutateAsync({
            case_title: formData.case_title,
            client: formData.client,
            case_number: formData.case_number || "",
            cnr_number: formData.cnr_number || "",
            case_type: (formData.case_type as CaseType) || "other",
            status: (formData.status as CaseStatus) || "pending",
            priority_level: (formData.priority_level as CasePriority) || "normal",
            court_level: (formData.court_level as CourtLevel) || "",
            act_name: formData.act_name || "",
            primary_section: formData.primary_section || "",
            description: formData.description || "",
            filing_date: null,
            registration_date: null,
            current_stage: "",
            limitation_end_date: null,
        });
        setDialogOpen(false);
        reset();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Cases</h1>
                    <p className="text-muted-foreground">{data?.count || 0} total cases</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="w-4 h-4 mr-2" />New Case</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create New Case</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Case Title *</Label>
                                <Input {...register("case_title")} placeholder="e.g. State vs. John Doe" />
                                {errors.case_title && <p className="text-xs text-destructive">{errors.case_title.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label>Client *</Label>
                                <Select onValueChange={(v) => setValue("client", v)}>
                                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                                    <SelectContent>
                                        {clientsData?.results?.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.client && <p className="text-xs text-destructive">{errors.client.message}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Case Number</Label>
                                    <Input {...register("case_number")} placeholder="CIV/2024/1234" />
                                </div>
                                <div className="space-y-2">
                                    <Label>CNR Number</Label>
                                    <Input {...register("cnr_number")} placeholder="XXXX00000002024" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Case Type</Label>
                                    <Select defaultValue="other" onValueChange={(v) => setValue("case_type", v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(CASE_TYPE_LABELS).map(([v, l]) => (
                                                <SelectItem key={v} value={v}>{l}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Priority</Label>
                                    <Select defaultValue="normal" onValueChange={(v) => setValue("priority_level", v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                                                <SelectItem key={v} value={v}>{l}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Court Level</Label>
                                <Select onValueChange={(v) => setValue("court_level", v)}>
                                    <SelectTrigger><SelectValue placeholder="Select court" /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(COURT_LEVEL_LABELS).map(([v, l]) => (
                                            <SelectItem key={v} value={v}>{l}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea {...register("description")} placeholder="Case description..." rows={3} />
                            </div>

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Create Case
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search cases..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
                <div className="flex gap-2">
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                        <SelectTrigger className="w-[140px]">
                            <Filter className="w-3.5 h-3.5 mr-2" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            {Object.entries(STATUS_LABELS).map(([v, l]) => (
                                <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {Object.entries(CASE_TYPE_LABELS).map(([v, l]) => (
                                <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Case list */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[80px] rounded-xl" />)}
                </div>
            ) : data?.results && data.results.length > 0 ? (
                <>
                    <div className="space-y-2">
                        {data.results.map((c) => (
                            <Link
                                key={c.id}
                                href={`/cases/${c.id}`}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border hover:bg-accent/50 hover:shadow-sm transition-all gap-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-semibold truncate">{c.case_title}</h3>
                                        <Badge className={PRIORITY_COLORS[c.priority_level]} variant="secondary">
                                            {PRIORITY_LABELS[c.priority_level]}
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                        <span className="text-xs text-muted-foreground">{c.case_number || "—"}</span>
                                        <span className="text-xs text-muted-foreground">Client: {c.client_name}</span>
                                        {c.court_level && (
                                            <span className="text-xs text-muted-foreground">
                                                {COURT_LEVEL_LABELS[c.court_level] || c.court_level}
                                            </span>
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(c.created_at), "dd MMM yyyy")}
                                        </span>
                                    </div>
                                </div>
                                <Badge className={STATUS_COLORS[c.status]} variant="secondary">
                                    {STATUS_LABELS[c.status]}
                                </Badge>
                            </Link>
                        ))}
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Page {page} of {Math.ceil((data.count || 1) / 20)}
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={!data.previous} onClick={() => setPage((p) => p - 1)}>
                                Previous
                            </Button>
                            <Button variant="outline" size="sm" disabled={!data.next} onClick={() => setPage((p) => p + 1)}>
                                Next
                            </Button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">No cases found.</p>
                    <Button variant="link" onClick={() => setDialogOpen(true)}>Create your first case</Button>
                </div>
            )}
        </div>
    );
}
