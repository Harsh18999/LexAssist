import apiClient from "./apiClient";
import type {
    Case, CaseCreatePayload, CaseCourtDetail, CaseParty, CaseStatusHistory,
    CaseStage, CaseAppeal, CaseFinancialSummary, DashboardStats, PaginatedResponse,
} from "@/types";

export const caseApi = {
    list: (params?: Record<string, string>) =>
        apiClient.get<PaginatedResponse<Case>>("/cases/", { params }),

    getById: (id: string) =>
        apiClient.get<Case>(`/cases/${id}/`),

    create: (data: CaseCreatePayload) =>
        apiClient.post<Case>("/cases/", data),

    update: (id: string, data: Partial<CaseCreatePayload>) =>
        apiClient.patch<Case>(`/cases/${id}/`, data),

    delete: (id: string) =>
        apiClient.delete(`/cases/${id}/`),

    dashboard: () =>
        apiClient.get<DashboardStats>("/cases/dashboard/"),
};

export const courtDetailApi = {
    list: (params?: Record<string, string>) =>
        apiClient.get<PaginatedResponse<CaseCourtDetail>>("/case-court-details/", { params }),

    create: (data: Omit<CaseCourtDetail, "id">) =>
        apiClient.post<CaseCourtDetail>("/case-court-details/", data),

    update: (id: string, data: Partial<CaseCourtDetail>) =>
        apiClient.patch<CaseCourtDetail>(`/case-court-details/${id}/`, data),

    delete: (id: string) =>
        apiClient.delete(`/case-court-details/${id}/`),
};

export const partyApi = {
    list: (params?: Record<string, string>) =>
        apiClient.get<PaginatedResponse<CaseParty>>("/case-parties/", { params }),

    create: (data: Omit<CaseParty, "id">) =>
        apiClient.post<CaseParty>("/case-parties/", data),

    update: (id: string, data: Partial<CaseParty>) =>
        apiClient.patch<CaseParty>(`/case-parties/${id}/`, data),

    delete: (id: string) =>
        apiClient.delete(`/case-parties/${id}/`),
};

export const statusHistoryApi = {
    list: (params?: Record<string, string>) =>
        apiClient.get<PaginatedResponse<CaseStatusHistory>>("/case-status-history/", { params }),

    create: (data: Omit<CaseStatusHistory, "id" | "updated_at">) =>
        apiClient.post<CaseStatusHistory>("/case-status-history/", data),
};

export const stageApi = {
    list: (params?: Record<string, string>) =>
        apiClient.get<PaginatedResponse<CaseStage>>("/case-stages/", { params }),

    create: (data: Omit<CaseStage, "id">) =>
        apiClient.post<CaseStage>("/case-stages/", data),

    update: (id: string, data: Partial<CaseStage>) =>
        apiClient.patch<CaseStage>(`/case-stages/${id}/`, data),

    delete: (id: string) =>
        apiClient.delete(`/case-stages/${id}/`),
};

export const appealApi = {
    list: (params?: Record<string, string>) =>
        apiClient.get<PaginatedResponse<CaseAppeal>>("/case-appeals/", { params }),

    create: (data: Omit<CaseAppeal, "id">) =>
        apiClient.post<CaseAppeal>("/case-appeals/", data),
};

export const financialApi = {
    list: (params?: Record<string, string>) =>
        apiClient.get<PaginatedResponse<CaseFinancialSummary>>("/case-financial-summaries/", { params }),

    create: (data: Omit<CaseFinancialSummary, "id">) =>
        apiClient.post<CaseFinancialSummary>("/case-financial-summaries/", data),

    update: (id: string, data: Partial<CaseFinancialSummary>) =>
        apiClient.patch<CaseFinancialSummary>(`/case-financial-summaries/${id}/`, data),
};
