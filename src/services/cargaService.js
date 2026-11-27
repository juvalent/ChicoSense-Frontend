import api from "./api";

export async function obterMonitoramentoCarga(cargaId, config) {
  if (!cargaId) throw new Error("Selecione uma carga.");
  try {
    const { data } = await api.get(`/api/v1/cargas/${cargaId}/monitoramento`, config);
    return data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
}
