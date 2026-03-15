"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Phone, Mail, Loader2, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useClients, useCreateClient, useDeleteClient } from "@/hooks/useClients";
import { useDebounce } from "@/hooks/useDebounce";
import { format } from "date-fns";

const clientSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email().or(z.literal("")).optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
});
type ClientForm = z.infer<typeof clientSchema>;

export default function ClientsPage() {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const debouncedSearch = useDebounce(search);

    const params: Record<string, string> = { page: String(page) };
    if (debouncedSearch) params.search = debouncedSearch;

    const { data, isLoading } = useClients(params);
    const createMutation = useCreateClient();
    const deleteMutation = useDeleteClient();

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClientForm>({
        resolver: zodResolver(clientSchema),
    });

    const onSubmit = async (formData: ClientForm) => {
        await createMutation.mutateAsync({
            name: formData.name,
            email: formData.email || "",
            phone: formData.phone || "",
            address: formData.address || "",
        });
        setDialogOpen(false);
        reset();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
                    <p className="text-muted-foreground">{data?.count || 0} total clients</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="w-4 h-4 mr-2" />Add Client</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Client</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Name *</Label>
                                <Input {...register("name")} placeholder="Client name" />
                                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input {...register("email")} placeholder="email@example.com" type="email" />
                                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone</Label>
                                    <Input {...register("phone")} placeholder="+91..." />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Address</Label>
                                <Input {...register("address")} placeholder="Full address" />
                            </div>
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Create Client
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search clients by name, email, phone..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
            </div>

            {/* Client grid */}
            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[140px] rounded-xl" />)}
                </div>
            ) : data?.results && data.results.length > 0 ? (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {data.results.map((client) => (
                            <Card key={client.id} className="group hover:shadow-md transition-shadow">
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between">
                                        <Link href={`/clients/${client.id}`} className="flex-1 min-w-0">
                                            <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                                                {client.name}
                                            </h3>
                                            <div className="mt-2 space-y-1">
                                                {client.email && (
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <Mail className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="truncate">{client.email}</span>
                                                    </div>
                                                )}
                                                {client.phone && (
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <Phone className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{client.phone}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-3">
                                                Added {format(new Date(client.created_at), "dd MMM yyyy")}
                                            </p>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                            onClick={() => {
                                                if (confirm("Delete this client? This will also delete all associated cases.")) {
                                                    deleteMutation.mutate(client.id);
                                                }
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
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
                    <p className="text-muted-foreground">No clients found.</p>
                    <Button variant="link" onClick={() => setDialogOpen(true)}>Add your first client</Button>
                </div>
            )}
        </div>
    );
}
