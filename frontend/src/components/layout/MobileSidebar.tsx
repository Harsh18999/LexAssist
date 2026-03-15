"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard, Users, Briefcase, Gavel, FileText,
    CalendarDays, Bot, IndianRupee, Settings, Scale, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface NavItem {
    label: string;
    href: string;
    icon: React.ElementType;
    disabled?: boolean;
    badge?: string;
}

const mainNav: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Clients", href: "/clients", icon: Users },
    { label: "Cases", href: "/cases", icon: Briefcase },
    { label: "Hearings", href: "/hearings", icon: Gavel, disabled: true, badge: "Soon" },
    { label: "Documents", href: "/documents", icon: FileText, disabled: true, badge: "Soon" },
    { label: "Calendar", href: "/calendar", icon: CalendarDays, disabled: true, badge: "Soon" },
    { label: "AI Assistant", href: "/ai-assistant", icon: Bot, disabled: true, badge: "Soon" },
    { label: "Payments", href: "/payments", icon: IndianRupee },
];

export function MobileSidebar({ onNavigate }: { onNavigate: () => void }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col h-full bg-card">
            {/* Brand */}
            <div className="flex items-center gap-2.5 px-6 py-5 border-b border-border">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground">
                    <Scale className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-lg font-bold tracking-tight">LexAssist</h1>
                    <p className="text-[11px] text-muted-foreground -mt-0.5">Legal Practice Manager</p>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {mainNav.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    if (item.disabled) {
                        return (
                            <div
                                key={item.href}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
                            >
                                <item.icon className="w-[18px] h-[18px]" />
                                <span className="flex-1">{item.label}</span>
                                <Lock className="w-3 h-3" />
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.badge}</Badge>
                            </div>
                        );
                    }
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onNavigate}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                        >
                            <item.icon className="w-[18px] h-[18px]" />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <Separator />

            <div className="px-3 py-3">
                <Link
                    href="/settings"
                    onClick={onNavigate}
                    className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                        pathname === "/settings"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                >
                    <Settings className="w-[18px] h-[18px]" />
                    <span>Settings</span>
                </Link>
            </div>
        </div>
    );
}
