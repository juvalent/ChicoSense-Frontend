import api from "./api";

export async function listarViagens() {
  const response = await api.get("/api/v1/logistica/viagens");

  return response.data;
}