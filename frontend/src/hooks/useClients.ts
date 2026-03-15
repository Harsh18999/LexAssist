"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientApi } from "@/services/clientApi";

export const clientKeys = {
    all: ["clients"] as const,
    lists: () => [...clientKeys.all, "list"] as const,
    list: (params: Record<string, string>) => [...clientKeys.lists(), params] as const,
    details: () => [...clientKeys.all, "detail"] as const,
    detail: (id: string) => [...clientKeys.details(), id] as const,
};

export function useClients(params: Record<string, string> = {}) {
    return useQuery({
        queryKey: clientKeys.list(params),
        queryFn: () => clientApi.list(params).then((r) => r.data),
        staleTime: 30_000,
    });
}

export function useClient(id: string) {
    return useQuery({
        queryKey: clientKeys.detail(id),
        queryFn: () => clientApi.getById(id).then((r) => r.data),
        enabled: !!id,
    });
}

export function useCreateClient() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: clientApi.create,
        onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.lists() }),
    });
}

export function useUpdateClient() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof clientApi.update>[1] }) =>
            clientApi.update(id, data),
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: clientKeys.lists() });
            qc.invalidateQueries({ queryKey: clientKeys.detail(id) });
        },
    });
}

export function useDeleteClient() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: clientApi.delete,
        onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.lists() }),
    });
}
