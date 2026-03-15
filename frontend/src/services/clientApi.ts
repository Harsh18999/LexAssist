import apiClient from "./apiClient";
import type { Client, ClientCreatePayload, PaginatedResponse } from "@/types";

export const clientApi = {
    list: (params?: Record<string, string>) =>
        apiClient.get<PaginatedResponse<Client>>("/clients/", { params }),

    getById: (id: string) =>
        apiClient.get<Client>(`/clients/${id}/`),

    create: (data: ClientCreatePayload) =>
        apiClient.post<Client>("/clients/", data),

    update: (id: string, data: Partial<ClientCreatePayload>) =>
        apiClient.patch<Client>(`/clients/${id}/`, data),

    delete: (id: string) =>
        apiClient.delete(`/clients/${id}/`),
};
