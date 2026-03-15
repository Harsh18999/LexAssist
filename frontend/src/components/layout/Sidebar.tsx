"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard, Users, Briefcase, Gavel, FileText,
    CalendarDays, Bot, IndianRupee, Settings, Scale, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    TooltipProvider, Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";

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

const bottomNav: NavItem[] = [
    { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card h-screen sticky top-0">
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

            {/* Main Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Main Menu
                </p>
                {mainNav.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    if (item.disabled) {
                        return (
                            <TooltipProvider key={item.href}>
                                <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild>
                                        <div
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                                                "text-muted-foreground/50 cursor-not-allowed"
                                            )}
                                        >
                                            <item.icon className="w-[18px] h-[18px]" />
                                            <span className="flex-1">{item.label}</span>
                                            <div className="flex items-center gap-1">
                                                <Lock className="w-3 h-3" />
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                    {item.badge}
                                                </Badge>
                                            </div>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p>Backend endpoint not available yet</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        );
                    }
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
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

            {/* Bottom Nav */}
            <div className="px-3 py-3 space-y-1">
                {bottomNav.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
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
            </div>
        </aside>
    );
}
