import api from "./api";
import { listarViagens, listarCargas } from "./viagemService";
export const tripList = (_key, { signal, ...params }) => listarViagens({ signal, params });
export async function cargoList(id, { signal, ...params }) {
  const rows = await listarCargas(id, { signal, params });
  if (rows.some((row) => row.viagem_id !== id)) throw new Error("Carga fora da viagem selecionada.");
  return rows;
}
export async function sessionList(id, { signal, ...params }) {
  const { data } = await api.get(`/api/v1/cargas/${encodeURIComponent(id)}/monitoramentos`, { signal, params });
  if (!Array.isArray(data) || data.some((row) => row.carga_id !== id)) throw new Error("Sessão fora da carga selecionada.");
  return data;
}
export async function tripSessionList(id, { signal, ...params }) {
  const { data } = await api.get(`/api/v1/viagens/${encodeURIComponent(id)}/monitoramentos`, { signal, params });
  if (!Array.isArray(data) || data.some((row) => row.viagem_id !== id)) throw new Error("Sessão fora da viagem selecionada.");
  return data;
}
