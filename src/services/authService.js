import api from "./api";

export async function fazerLogin(email, senha) {
  const response = await api.post("/api/v1/auth/login", {
    email,
    senha,
  });

  return response.data;
}

export async function buscarUsuario(token) {
  const response = await api.get("/api/v1/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
}