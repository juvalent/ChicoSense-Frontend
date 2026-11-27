import api from "./api";
import { isoDate } from "./logisticsService";

export const SESSION_PAGE_SIZE = 20;
export const maturations = ["VERDE_MADURA", "EM_AMADURECIMENTO", "MADURA", "MISTA", "DESCONHECIDA"];
export const sessionEnvironments = ["LABORATORIO", "TRANSPORTE_REFRIGERADO"];
export const normalizedTrip = (trip) => ({ ...trip, status: trip?.statusApi ?? trip?.status });
export const normalizedCargo = (cargo) => ({ ...cargo, status: cargo?.statusApi ?? cargo?.status });

function required(value, label, max) {
  const result = String(value ?? "").trim();
  if (!result || result.length > max) throw new Error(`Preencha ${label} com até ${max} caracteres.`);
  return result;
}

export function declarationPayload(values) {
  const mass = String(values.massa_kg ?? "").trim().replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,4})?$/.test(mass) || !/[1-9]/.test(mass)) throw new Error("Informe massa em kg positiva, com até oito dígitos inteiros e quatro casas decimais.");
  if (values.produto_identificado !== "MANGA_TOMMY_ATKINS") throw new Error("Confirme a identificação do produto como manga Tommy Atkins.");
  if (!maturations.includes(values.maturacao)) throw new Error("Selecione o estágio de maturação ou DESCONHECIDA.");
  if (!["true", "false"].includes(values.lote_hipotetico)) throw new Error("Informe se o lote é hipotético.");
  return {
    produto_identificado: values.produto_identificado, massa_kg: mass, maturacao: values.maturacao,
    lote_codigo: required(values.lote_codigo, "o lote", 120), lote_hipotetico: values.lote_hipotetico === "true",
    rastreabilidade: required(values.rastreabilidade, "a rastreabilidade", 2000),
  };
}

export async function saveDeclaration(cargoId, payload) {
  const { data } = await api.put(`/api/v1/cargas/${encodeURIComponent(cargoId)}/monitoramento`, payload);
  if (data?.carga_id !== cargoId) throw new Error("Resposta de declaração incompatível.");
  return data;
}

function validateSessions(data, cargoId, tripId) {
  if (!Array.isArray(data) || data.some((session) => !session?.id || session.carga_id !== cargoId || session.viagem_id !== tripId) || new Set(data.map((session) => session.id)).size !== data.length) throw new Error("Sessões incompatíveis com a carga/viagem selecionada.");
  return data;
}

export async function readSessionPage(cargoId, tripId, { offset = 0, signal } = {}) {
  const { data } = await api.get(`/api/v1/cargas/${encodeURIComponent(cargoId)}/monitoramentos`, { params: { limit: SESSION_PAGE_SIZE + 1, offset }, signal });
  const records = validateSessions(data, cargoId, tripId);
  return { records: records.slice(0, SESSION_PAGE_SIZE), hasNext: records.length > SESSION_PAGE_SIZE };
}

export async function readSession(sessionId, cargoId, tripId, signal) {
  const { data } = await api.get(`/api/v1/monitoramentos/${encodeURIComponent(sessionId)}`, { signal });
  validateSessions([data], cargoId, tripId);
  if (data.id !== sessionId) throw new Error("Sessão incompatível com a seleção.");
  return data;
}

// Existing source: immutable snapshots from sessions of this cargo only.
// This does not discover/provision devices or prove their current availability.
export async function inspectSessionHistory(cargoId, tripId, signal) {
  const sessions = [];
  const seen = new Set();
  for (let offset = 0; ; offset += 100) {
    const { data } = await api.get(`/api/v1/cargas/${encodeURIComponent(cargoId)}/monitoramentos`, { params: { limit: 100, offset }, signal });
    validateSessions(data, cargoId, tripId);
    if (data.some((session) => seen.has(session.id))) throw new Error("Paginação de histórico inconsistente. Atualize a consulta.");
    data.forEach((session) => seen.add(session.id));
    sessions.push(...data);
    if (data.length < 100) break;
  }
  const temperature = new Map(), humidity = new Map();
  for (const session of sessions) {
    for (const [role, type, field, catalog] of [["temperatura", "TEMPERATURA", "sensor_temperatura_id", temperature], ["umidade", "UMIDADE", "sensor_umidade_id", humidity]]) {
      const snapshot = session.origem_sensor?.[role];
      if (snapshot && typeof snapshot.sensor_id === "string" && snapshot.sensor_id && snapshot.sensor_id === session[field] && snapshot.tipo === type && typeof snapshot.unidade === "string") {
        catalog.set(snapshot.sensor_id, { id: snapshot.sensor_id, label: snapshot.identificador || `Sensor ${snapshot.sensor_id.slice(0, 8)}`, unidade: snapshot.unidade, contexto: snapshot.contexto });
      }
    }
  }
  return { sessions, temperature: [...temperature.values()], humidity: [...humidity.values()] };
}

export function startSessionPayload(values, trip, cargo, key, now = Date.now()) {
  if (trip.status !== "EM_ANDAMENTO" || cargo.status !== "EM_TRANSITO") throw new Error("Iniciar exige viagem em andamento e carga em trânsito.");
  const inicio = isoDate(values.inicio);
  if (!inicio || new Date(inicio).getTime() > now) throw new Error("Informe um início efetivo válido, sem estar no futuro.");
  if (!trip.inicio_real || new Date(inicio) < new Date(trip.inicio_real)) throw new Error("O início da sessão deve respeitar o início real da viagem.");
  if (!sessionEnvironments.includes(values.ambiente_aquisicao)) throw new Error("Selecione o ambiente de aquisição.");
  const sensor_temperatura_id = required(values.sensor_temperatura_id, "o sensor de temperatura", 100);
  const sensor_umidade_id = String(values.sensor_umidade_id ?? "").trim() || null;
  if (sensor_temperatura_id === sensor_umidade_id) throw new Error("Temperatura e umidade exigem sensores distintos.");
  const observacoes = String(values.observacoes ?? "").trim() || null;
  if (observacoes?.length > 2000) throw new Error("Observações devem ter até 2000 caracteres.");
  return { inicio, sensor_temperatura_id, sensor_umidade_id, ambiente_aquisicao: values.ambiente_aquisicao, observacoes, chave_idempotencia: key };
}

export function endSessionPayload(values, session, trip, action, now = Date.now()) {
  if (session.estado !== "ATIVA") throw new Error("Sessões finalizadas são imutáveis.");
  if (!["ENCERRADA", "CANCELADA"].includes(action)) throw new Error("Escolha uma finalização válida.");
  if (trip.status === "CANCELADA" && action !== "CANCELADA") throw new Error("Viagem cancelada exige cancelamento da sessão.");
  const fim = isoDate(values.fim);
  if (!fim || new Date(fim) <= new Date(session.inicio) || new Date(fim).getTime() > now) throw new Error("O fim deve ser posterior ao início da sessão e não estar no futuro.");
  if (trip.chegada_em && new Date(fim) > new Date(trip.chegada_em)) throw new Error("O fim da sessão não pode ser posterior à chegada real.");
  return { fim, motivo: required(values.motivo, "o motivo da finalização", 2000) };
}

export const uncertainMutation = (error) => !error?.response || error.response.status >= 500;
export function lifecycleError(error, writing = false) {
  const status = error?.response?.status;
  if (status === 401) return "Sua sessão expirou. Faça login novamente.";
  if (status === 403) return "Sem permissão para esta operação de monitoramento.";
  if (status === 404) return "Registro não encontrado. Atualize a consulta.";
  if (status === 409) return "Conflito de estado, declaração ou janela. Confira a carga, a viagem, o produto, as sessões e os sensores antes de tentar novamente.";
  if (status === 422) return "Confira massa, maturação, horários, sensores e os campos obrigatórios.";
  return writing ? "A gravação não pôde ser confirmada. Consulte as sessões antes de reenviar; a operação pode ter sido concluída." : "Não foi possível consultar o monitoramento. Tente novamente.";
}
