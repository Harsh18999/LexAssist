"use client";

import { Briefcase, Users, TrendingUp, AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats, useCases } from "@/hooks/useCases";
import { useClients } from "@/hooks/useClients";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, CASE_TYPE_LABELS } from "@/types";
import Link from "next/link";

function StatCard({
    title, value, icon: Icon, description, color,
}: {
    title: string; value: number | string; icon: React.ElementType; description?: string; color?: string;
}) {
    return (
        <Card className="relative overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <p className="text-3xl font-bold mt-1">{value}</p>
                        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
                    </div>
                    <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${color || "bg-primary/10 text-primary"}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function DashboardPage() {
    const { data: stats, isLoading: statsLoading } = useDashboardStats();
    const { data: clientsData, isLoading: clientsLoading } = useClients({ page: "1" });
    const { data: recentCases, isLoading: casesLoading } = useCases({ ordering: "-created_at", page_size: "5" });

    if (statsLoading || clientsLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">Overview of your legal practice</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-[120px] rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    const urgentCount = stats?.by_priority?.urgent || 0;
    const pendingCount = stats?.by_status?.pending || 0;

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">Overview of your legal practice</p>
                </div>
                <div className="flex gap-2">
                    <Button asChild>
                        <Link href="/cases">
                            <Briefcase className="w-4 h-4 mr-2" />
                            View All Cases
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Cases"
                    value={stats?.total_cases || 0}
                    icon={Briefcase}
                    description={`${pendingCount} pending`}
                    color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                />
                <StatCard
                    title="Total Clients"
                    value={clientsData?.count || 0}
                    icon={Users}
                    color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                />
                <StatCard
                    title="Active Cases"
                    value={pendingCount}
                    icon={TrendingUp}
                    description="Currently pending"
                    color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                />
                <StatCard
                    title="Urgent"
                    value={urgentCount}
                    icon={AlertTriangle}
                    description="High priority"
                    color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Cases by Status */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">Cases by Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats?.by_status && Object.entries(stats.by_status).map(([status, count]) => (
                                <div key={status} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge className={STATUS_COLORS[status as keyof typeof STATUS_COLORS] || ""} variant="secondary">
                                            {STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}
                                        </Badge>
                                    </div>
                                    <span className="text-sm font-semibold">{count}</span>
                                </div>
                            ))}
                            {(!stats?.by_status || Object.keys(stats.by_status).length === 0) && (
                                <p className="text-sm text-muted-foreground text-center py-4">No cases yet</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Cases by Type */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">Cases by Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {stats?.by_type && Object.entries(stats.by_type).map(([type, count]) => (
                                <div key={type} className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">
                                        {CASE_TYPE_LABELS[type as keyof typeof CASE_TYPE_LABELS] || type}
                                    </span>
                                    <span className="text-sm font-semibold">{count}</span>
                                </div>
                            ))}
                            {(!stats?.by_type || Object.keys(stats.by_type).length === 0) && (
                                <p className="text-sm text-muted-foreground text-center py-4">No cases yet</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Cases */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base font-semibold">Recent Cases</CardTitle>
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/cases">
                            View all <ArrowRight className="w-4 h-4 ml-1" />
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    {casesLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
                        </div>
                    ) : recentCases?.results && recentCases.results.length > 0 ? (
                        <div className="space-y-2">
                            {recentCases.results.map((c) => (
                                <Link
                                    key={c.id}
                                    href={`/cases/${c.id}`}
                                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{c.case_title}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-muted-foreground">{c.case_number || "No number"}</span>
                                            <span className="text-xs text-muted-foreground">•</span>
                                            <span className="text-xs text-muted-foreground">{c.client_name}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <Badge className={STATUS_COLORS[c.status]} variant="secondary" >
                                            {STATUS_LABELS[c.status]}
                                        </Badge>
                                        <Badge className={`${PRIORITY_LABELS[c.priority_level] === "Urgent" ? "bg-red-100 text-red-700" : ""}`} variant="outline">
                                            {PRIORITY_LABELS[c.priority_level]}
                                        </Badge>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-6">
                            No cases yet. <Link href="/cases" className="text-primary hover:underline">Create your first case</Link>
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
