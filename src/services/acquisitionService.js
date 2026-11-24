import api from "./api";
import { isoDate, canOperateTrip } from "./logisticsService";
import { obterQualidadeSessao } from "./monitoramentoService";

export const RUN_PAGE_SIZE = 20;
export const READING_SIZE = 100;
export const acquisitionStates = ["EM_EXECUCAO", "CONCLUIDA", "PARCIAL", "FALHA", "INTERROMPIDA"];

export function canSynchronize(user, trip, session) {
  return session.viagem_id === trip.id && canOperateTrip(user, trip) && (session.estado === "ATIVA" || (session.estado === "ENCERRADA" && ["ADMIN", "GESTOR"].includes(user.perfil)));
}
export function operationalSeconds(value, required = false) {
  const result = String(value ?? "").trim().replace(",", ".");
  if (!result && !required) return null;
  if (!/^\d{1,9}(?:\.\d{1,3})?$/.test(result) || !/[1-9]/.test(result)) throw new Error("Informe um intervalo operacional positivo, com até três casas decimais.");
  return result;
}
export function acquisitionPayload(values, session, key, now = Date.now()) {
  if (!["ATIVA", "ENCERRADA"].includes(session.estado)) throw new Error("O estado desta sessão permite somente consulta.");
  if (!["BANCO", "THINGSPEAK"].includes(values.origem_dados)) throw new Error("Selecione a origem da sincronização.");
  const inicio = isoDate(values.inicio), fim = isoDate(values.fim);
  if (!inicio || !fim || new Date(inicio) < new Date(session.inicio) || new Date(fim) < new Date(inicio) || new Date(fim).getTime() > now || (session.fim && new Date(fim) > new Date(session.fim))) throw new Error("Informe uma janela válida dentro da sessão, sem fim futuro.");
  const maximum = Number(values.max_requisicoes);
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 32) throw new Error("O limite de requisições deve estar entre 1 e 32.");
  const justification = String(values.justificativa ?? "").trim() || null;
  const complement = session.estado === "ENCERRADA";
  if (complement && (values.complementar_encerrada !== true || !justification)) throw new Error("Complementar sessão encerrada exige confirmação e justificativa.");
  if (justification?.length > 2000) throw new Error("Justificativa deve ter até 2000 caracteres.");
  return { chave_idempotencia: key, origem_dados: values.origem_dados, inicio, fim, max_requisicoes: maximum,
    complementar_encerrada: complement, justificativa: justification, limite_atraso_s: operationalSeconds(values.limite_atraso_s) };
}
const base = (id) => `/api/v1/monitoramentos/${encodeURIComponent(id)}`;
export async function readAcquisitionRuns(id, offset = 0, signal) {
  const { data } = await api.get(`${base(id)}/sincronizacoes`, { params: { limit: RUN_PAGE_SIZE + 1, offset }, signal });
  if (data?.sessao_id !== id || !Array.isArray(data.tentativas) || data.tentativas.some((run) => run.sessao_id !== id || !acquisitionStates.includes(run.estado))) throw new Error("Resposta de tentativas incompatível.");
  return { ...data, tentativas: data.tentativas.slice(0, RUN_PAGE_SIZE), hasNext: data.tentativas.length > RUN_PAGE_SIZE };
}
export async function synchronizeAcquisition(id, payload) {
  const { data, status } = await api.post(`${base(id)}/sincronizacoes`, payload);
  if (data?.sessao_id !== id || data.chave_idempotencia !== payload.chave_idempotencia || !acquisitionStates.includes(data.estado) || (status === 202 && data.estado !== "EM_EXECUCAO")) throw new Error("Resposta de sincronização incompatível.");
  return { ...data, httpStatus: status };
}

export function readingQuery(values, session) {
  const inicio = isoDate(values.inicio), fim = isoDate(values.fim);
  if ((inicio && new Date(inicio) < new Date(session.inicio)) || (fim && new Date(fim).getTime() > Date.now()) || (fim && session.fim && new Date(fim) > new Date(session.fim)) || (inicio && fim && new Date(fim) < new Date(inicio))) throw new Error("A janela de consulta deve estar dentro da sessão.");
  const revision = values.revisao === "" ? undefined : Number(values.revisao);
  if (revision !== undefined && (!Number.isInteger(revision) || revision < 1)) throw new Error("Selecione uma revisão consolidada válida.");
  if (!["", "TEMPERATURA", "UMIDADE"].includes(values.tipo)) throw new Error("Tipo de leitura inválido.");
  return { ...(inicio ? { inicio } : {}), ...(fim ? { fim } : {}), ...(revision ? { revisao: revision } : {}), ...(values.tipo ? { tipo: values.tipo } : {}) };
}

async function rawReadings(id, params, signal) {
  const { data } = await api.get(`${base(id)}/leituras`, { params, signal });
  if (data?.sessao_id !== id || !Number.isInteger(data.revisao) || data.revisao < 0 || !Number.isInteger(data.total) || data.total < 0 || !Array.isArray(data.leituras) || !data.inicio || !data.fim) throw new Error("Histórico sem identidade, janela ou revisão válidas.");
  return data;
}
export async function readAcquisitionPage(id, query, { offset, frame, signal } = {}) {
  if (offset === undefined) {
    const metadata = await rawReadings(id, { ...query, limit: 1, offset: 0 }, signal);
    if (query.revisao && metadata.revisao !== query.revisao) throw new Error("Revisão incompatível com a consulta.");
    frame = { revisao: metadata.revisao, inicio: metadata.inicio, fim: metadata.fim };
    if (!metadata.total) return { ...metadata, offset: 0, limit: READING_SIZE };
    offset = Math.floor((metadata.total - 1) / READING_SIZE) * READING_SIZE;
  }
  const data = await rawReadings(id, { ...query, inicio: frame.inicio, fim: frame.fim, ...(frame.revisao > 0 ? { revisao: frame.revisao } : {}), limit: READING_SIZE, offset }, signal);
  if (data.revisao !== frame.revisao || data.inicio !== frame.inicio || data.fim !== frame.fim) throw new Error("A janela ou revisão mudou. Atualize a consulta.");
  return data;
}
export async function readAcquisitionQuality(id, frame, gap, signal) {
  const data = await obterQualidadeSessao(id, { inicio: frame.inicio, fim: frame.fim, ...(frame.revisao > 0 ? { revisao: frame.revisao } : {}), intervalo_maximo_s: gap }, { signal });
  if (data?.sessao_id !== id || data.revisao !== frame.revisao || data.inicio !== frame.inicio || data.fim !== frame.fim || !Array.isArray(data.indicadores) || data.natureza !== "COBERTURA_TEMPORAL_DE_AQUISICAO_NAO_E_ESTIMATIVA_DE_ETILENO") throw new Error("Qualidade incompatível com a janela/revisão de leituras. Atualize os dados.");
  return data;
}
