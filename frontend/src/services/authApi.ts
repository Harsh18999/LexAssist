import apiClient from "./apiClient";
import type { TokenPair, RegisterPayload, LoginPayload, UserProfile } from "@/types";

export const authApi = {
    login: (data: LoginPayload) =>
        apiClient.post<TokenPair>("/login/", data),

    register: (data: RegisterPayload) =>
        apiClient.post("/register/", data),

    logout: (refresh: string) =>
        apiClient.post("/logout/", { refresh }),

    profile: () =>
        apiClient.get<UserProfile>("/profile/"),
};
