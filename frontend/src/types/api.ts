export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export interface ApiError {
    detail?: string;
    error?: string;
    [key: string]: unknown;
}

export interface TokenPair {
    access: string;
    refresh: string;
}

export interface LoginPayload {
    username: string;
    password: string;
}

export interface RegisterPayload {
    username: string;
    email: string;
    password: string;
}

export interface UserProfile {
    username: string;
    email: string;
}

export interface DashboardStats {
    total_cases: number;
    by_status: Record<string, number>;
    by_type: Record<string, number>;
    by_priority: Record<string, number>;
}
