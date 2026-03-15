"use client";

import { IndianRupee, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinancials } from "@/hooks/useCases";
import { useCases } from "@/hooks/useCases";

export default function PaymentsPage() {
    const { data: financials, isLoading: fLoading } = useFinancials({});
    const { data: casesData, isLoading: cLoading } = useCases({});

    const isLoading = fLoading || cLoading;

    // Build case lookup map
    const caseMap = new Map(casesData?.results?.map((c) => [c.id, c]) || []);

    // Calculate totals
    const totals = financials?.results?.reduce(
        (acc, f) => ({
            fee: acc.fee + Number(f.total_fee),
            received: acc.received + Number(f.total_received),
            expenses: acc.expenses + Number(f.total_expenses),
            outstanding: acc.outstanding + Number(f.outstanding_amount),
        }),
        { fee: 0, received: 0, expenses: 0, outstanding: 0 }
    ) || { fee: 0, received: 0, expenses: 0, outstanding: 0 };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Payments & Financials</h1>
                <p className="text-muted-foreground">Financial overview across all cases</p>
            </div>

            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[100px] rounded-xl" />)}
                </div>
            ) : (
                <>
                    {/* Summary cards */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <SummaryCard label="Total Fees" value={totals.fee} color="text-blue-600 bg-blue-100 dark:bg-blue-900/30" />
                        <SummaryCard label="Total Received" value={totals.received} color="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30" />
                        <SummaryCard label="Total Expenses" value={totals.expenses} color="text-amber-600 bg-amber-100 dark:bg-amber-900/30" />
                        <SummaryCard label="Outstanding" value={totals.outstanding} color="text-red-600 bg-red-100 dark:bg-red-900/30" />
                    </div>

                    {/* Per-case breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Per-Case Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {financials?.results && financials.results.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-left">
                                                <th className="pb-3 font-medium text-muted-foreground">Case</th>
                                                <th className="pb-3 font-medium text-muted-foreground text-right">Fee</th>
                                                <th className="pb-3 font-medium text-muted-foreground text-right">Received</th>
                                                <th className="pb-3 font-medium text-muted-foreground text-right">Expenses</th>
                                                <th className="pb-3 font-medium text-muted-foreground text-right">Outstanding</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {financials.results.map((f) => {
                                                const c = caseMap.get(f.case);
                                                return (
                                                    <tr key={f.case} className="border-b last:border-0">
                                                        <td className="py-3 font-medium">{c?.case_title || f.case}</td>
                                                        <td className="py-3 text-right">₹{Number(f.total_fee).toLocaleString("en-IN")}</td>
                                                        <td className="py-3 text-right text-emerald-600">₹{Number(f.total_received).toLocaleString("en-IN")}</td>
                                                        <td className="py-3 text-right text-amber-600">₹{Number(f.total_expenses).toLocaleString("en-IN")}</td>
                                                        <td className="py-3 text-right text-red-600 font-medium">₹{Number(f.outstanding_amount).toLocaleString("en-IN")}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No financial records yet. Add financial summaries from individual case pages.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                        <IndianRupee className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-xl font-bold">₹{value.toLocaleString("en-IN")}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
