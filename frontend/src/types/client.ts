export interface Client {
    id: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    created_at: string;
}

export type ClientCreatePayload = Omit<Client, "id" | "created_at">;
