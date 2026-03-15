"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { accessToken } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        if (!accessToken) {
            router.push("/login");
        }
    }, [accessToken, router]);

    if (!accessToken) return null;

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
                <TopNav />
                <main className="flex-1 overflow-y-auto">
                    <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-6">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
