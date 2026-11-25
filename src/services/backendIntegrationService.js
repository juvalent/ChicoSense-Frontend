import api from "./api";
import { isoDate } from "./logisticsService";

export async function availableSensors(key, { signal, ...params }) {
  const { cargoId, tripId, ambiente, inicio } = JSON.parse(key);
  const { data } = await api.get(`/api/v1/cargas/${encodeURIComponent(cargoId)}/sensores-disponiveis`, { signal, params: { ...params, ambiente, inicio } });
  if (data?.carga_id !== cargoId || data.viagem_id !== tripId || data.ambiente !== ambiente || !Array.isArray(data.sensores) || data.sensores.some((row) => !row.id || !["TEMPERATURA", "UMIDADE"].includes(row.tipo))) throw new Error("Catálogo incompatível com a carga/viagem.");
  return data.sensores;
}
export function sensorQuery(cargoId, tripId, values) {
  let inicio;
  try { inicio = isoDate(values.inicio); } catch { return null; }
  return inicio && ["LABORATORIO", "TRANSPORTE_REFRIGERADO"].includes(values.ambiente_aquisicao) ? JSON.stringify({ cargoId, tripId, ambiente: values.ambiente_aquisicao, inicio }) : null;
}
export async function partnerPage(carrierId, type, offset, signal) {
  const { data } = await api.get(`/api/v1/transportadoras/${encodeURIComponent(carrierId)}/parceiros`, { signal, params: { tipo: type, limit: 21, offset } });
  if (!Array.isArray(data) || data.some((row) => !row.id || row.tipo !== type || row.autorizado_para_novas_cargas !== true)) throw new Error("Parceiros não autorizados para novas cargas.");
  return { records: data.slice(0,20), hasNext: data.length > 20 };
}
export async function dashboardSummary(signal) {
  const { data } = await api.get("/api/v1/monitoramento/resumo", { signal });
  const fields = ["viagens_total", "viagens_em_transito", "cargas_total", "cargas_monitoradas", "sessoes_ativas", "alertas_abertos"];
  if (!data?.consultado_em || fields.some((field) => !Number.isSafeInteger(data[field]) || data[field] < 0)) throw new Error("Resumo autorizado inválido.");
  return { transitTrips: data.viagens_em_transito, monitoredLoads: data.cargas_monitoradas, activeSessions: data.sessoes_ativas, openAlerts: data.alertas_abertos, consultedAt: data.consultado_em };
}
