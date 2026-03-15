import axios from "axios";

const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
    headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const stored = localStorage.getItem("lexassist-auth");
        if (stored) {
            try {
                const { state } = JSON.parse(stored);
                if (state?.accessToken) {
                    config.headers.Authorization = `Bearer ${state.accessToken}`;
                }
            } catch { /* ignore */ }
        }
    }
    return config;
});

apiClient.interceptors.response.use(
    (res) => res,
    async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;
            try {
                const stored = localStorage.getItem("lexassist-auth");
                if (stored) {
                    const { state } = JSON.parse(stored);
                    const { data } = await axios.post(
                        `${apiClient.defaults.baseURL}/login/`,
                        {},
                        { headers: { Authorization: `Bearer ${state.refreshToken}` } }
                    );
                    // Update the stored token
                    const parsed = JSON.parse(stored);
                    parsed.state.accessToken = data.access;
                    localStorage.setItem("lexassist-auth", JSON.stringify(parsed));
                    original.headers.Authorization = `Bearer ${data.access}`;
                    return apiClient(original);
                }
            } catch {
                localStorage.removeItem("lexassist-auth");
                if (typeof window !== "undefined") {
                    window.location.href = "/login";
                }
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
