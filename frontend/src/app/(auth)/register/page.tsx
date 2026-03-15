"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Scale, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi } from "@/services/authApi";

const registerSchema = z.object({
    username: z.string().min(3, "Min 3 characters"),
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "Min 8 characters"),
    confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
        resolver: zodResolver(registerSchema),
    });

    const onSubmit = async (data: RegisterForm) => {
        setError("");
        try {
            await authApi.register({
                username: data.username,
                email: data.email,
                password: data.password,
            });
            setSuccess(true);
            setTimeout(() => router.push("/login"), 2000);
        } catch (err: unknown) {
            const resp = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
            if (resp) {
                const msgs = Object.values(resp).flat().join(". ");
                setError(msgs || "Registration failed.");
            } else {
                setError("Registration failed. Please try again.");
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg">
                        <Scale className="w-7 h-7" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold tracking-tight">LexAssist</h1>
                        <p className="text-sm text-muted-foreground">Create your account</p>
                    </div>
                </div>

                <Card className="shadow-xl border-border/50">
                    <CardHeader className="text-center pb-4">
                        <CardTitle className="text-xl">Get Started</CardTitle>
                        <CardDescription>Fill in your details to create an account</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {success ? (
                            <div className="p-4 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800 text-center">
                                Account created successfully! Redirecting to login...
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                {error && (
                                    <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="username">Username</Label>
                                    <Input id="username" placeholder="Choose a username" {...register("username")} className="h-11" />
                                    {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" placeholder="you@example.com" {...register("email")} className="h-11" />
                                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input id="password" type="password" placeholder="Min 8 characters" {...register("password")} className="h-11" />
                                    {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                                    <Input id="confirmPassword" type="password" placeholder="Repeat password" {...register("confirmPassword")} className="h-11" />
                                    {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
                                </div>

                                <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Create Account
                                </Button>
                            </form>
                        )}

                        <div className="mt-6 text-center text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link href="/login" className="font-medium text-primary hover:underline">
                                Sign in
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
