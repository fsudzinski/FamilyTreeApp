import { api } from "./api";

export type RegisterRequest = {
  email: string;
  password: string;
};

export async function register(data: RegisterRequest) {
  const res = await api.post("/auth/register", data);
  return res.data;
}