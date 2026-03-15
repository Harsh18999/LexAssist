"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { caseApi, courtDetailApi, partyApi, statusHistoryApi, stageApi, financialApi } from "@/services/caseApi";

export const caseKeys = {
    all: ["cases"] as const,
    lists: () => [...caseKeys.all, "list"] as const,
    list: (params: Record<string, string>) => [...caseKeys.lists(), params] as const,
    details: () => [...caseKeys.all, "detail"] as const,
    detail: (id: string) => [...caseKeys.details(), id] as const,
    dashboard: () => [...caseKeys.all, "dashboard"] as const,
};

export function useCases(params: Record<string, string> = {}) {
    return useQuery({
        queryKey: caseKeys.list(params),
        queryFn: () => caseApi.list(params).then((r) => r.data),
        staleTime: 30_000,
    });
}

export function useCase(id: string) {
    return useQuery({
        queryKey: caseKeys.detail(id),
        queryFn: () => caseApi.getById(id).then((r) => r.data),
        enabled: !!id,
    });
}

export function useCreateCase() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: caseApi.create,
        onSuccess: () => qc.invalidateQueries({ queryKey: caseKeys.lists() }),
    });
}

export function useUpdateCase() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof caseApi.update>[1] }) =>
            caseApi.update(id, data),
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: caseKeys.lists() });
            qc.invalidateQueries({ queryKey: caseKeys.detail(id) });
        },
    });
}

export function useDeleteCase() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: caseApi.delete,
        onSuccess: () => qc.invalidateQueries({ queryKey: caseKeys.lists() }),
    });
}

export function useDashboardStats() {
    return useQuery({
        queryKey: caseKeys.dashboard(),
        queryFn: () => caseApi.dashboard().then((r) => r.data),
        staleTime: 60_000,
    });
}

// --- Court Details ---
export function useCourtDetails(params: Record<string, string> = {}) {
    return useQuery({
        queryKey: ["courtDetails", params],
        queryFn: () => courtDetailApi.list(params).then((r) => r.data),
        enabled: !!params.case,
    });
}

// --- Parties ---
export function useParties(params: Record<string, string> = {}) {
    return useQuery({
        queryKey: ["parties", params],
        queryFn: () => partyApi.list(params).then((r) => r.data),
        enabled: !!params.case,
    });
}

export function useCreateParty() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: partyApi.create,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["parties"] }),
    });
}

export function useDeleteParty() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: partyApi.delete,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["parties"] }),
    });
}

// --- Stages ---
export function useStages(params: Record<string, string> = {}) {
    return useQuery({
        queryKey: ["stages", params],
        queryFn: () => stageApi.list(params).then((r) => r.data),
        enabled: !!params.case,
    });
}

export function useCreateStage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: stageApi.create,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["stages"] }),
    });
}

// --- Status History ---
export function useStatusHistory(params: Record<string, string> = {}) {
    return useQuery({
        queryKey: ["statusHistory", params],
        queryFn: () => statusHistoryApi.list(params).then((r) => r.data),
        enabled: !!params.case,
    });
}

// --- Financial ---
export function useFinancials(params: Record<string, string> = {}) {
    return useQuery({
        queryKey: ["financials", params],
        queryFn: () => financialApi.list(params).then((r) => r.data),
    });
}
