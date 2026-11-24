import api from "./api";
import { isoDate, canOperateTrip } from "./logisticsService";

export const sessionPath = (id) => `/api/v1/monitoramentos/${encodeURIComponent(id)}`;
export const scoped = (row, sessionId) => {
  if (!row?.id || row.sessao_id !== sessionId) throw new Error("Resposta incompatível com a sessão.");
  return row;
};
export async function readOperationalPage(sessionId, path, collection, offset, signal) {
  const { data } = await api.get(`${sessionPath(sessionId)}/${path}`, { params: { limit: 20, offset }, signal });
  if (!Number.isInteger(data?.total) || data.total < 0 || !Array.isArray(data[collection])) throw new Error("Página operacional inválida.");
  data[collection].forEach((row) => { if (row.sessao_id !== undefined) scoped(row, sessionId); });
  return { records: data[collection], total: data.total };
}
export async function readOperationalDetail(sessionId, path, expectedId, signal) {
  const { data } = await api.get(`${sessionPath(sessionId)}/${path}`, { signal });
  scoped(data, sessionId);
  if (data.id !== expectedId) throw new Error("Identificador incompatível.");
  return data;
}
export async function postOperational(sessionId, path, payload, target) {
  const { data } = await api.post(`${sessionPath(sessionId)}/${path}`, payload);
  scoped(data, sessionId);
  // Decision responses do not echo the idempotency key in the current contract.
  if ((data.chave_idempotencia && data.chave_idempotencia !== payload.chave_idempotencia) ||
      (target && data[target.field] !== target.id) || (payload.acao && data.acao !== payload.acao)) throw new Error("Confirmação incompatível com a solicitação.");
  return data;
}
export function operationalWriter(user, trip, session) {
  return session.viagem_id === trip.id && canOperateTrip(user, trip);
}
export function justification(value, minimum = 1) {
  const text = String(value ?? "").trim();
  if (text.length < minimum || text.length > 4000) throw new Error(`Justificativa deve ter entre ${minimum} e 4000 caracteres.`);
  return text;
}
export function decimal(value, { positive = false, percentage = false, integerDigits = 9 } = {}) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!new RegExp(`^-?\\d{1,${integerDigits}}(?:\\.\\d{1,3})?$`).test(text)) throw new Error("Informe valores decimais com até três casas e dentro dos limites do contrato.");
  const scaled = decimalUnits(text);
  if ((positive && scaled <= 0n) || (percentage && (scaled < 0n || scaled > 100000n))) throw new Error("Valor fora do intervalo permitido.");
  return text;
}
export function decimalUnits(text) {
  const negative = text.startsWith("-");
  const [whole, part = ""] = text.replace(/^-/, "").split(".");
  return BigInt(whole + part.padEnd(3, "0")) * (negative ? -1n : 1n);
}
export function configurationPayload(v, session, key) {
  if (session.estado === "CANCELADA") throw new Error("Sessão cancelada permite somente consulta.");
  const result = { chave_idempotencia: key, maturacoes_aplicaveis: [session.maturacao], ambiente: session.ambiente_aquisicao,
    fundamento: v.fundamento, prioridade: v.prioridade, justificativa: justification(v.justificativa, 10),
    referencias: String(v.referencias || "").split("\n").map((s) => s.trim()).filter(Boolean) };
  if (!["OPERACIONAL", "EXPERIMENTAL"].includes(v.fundamento) || !["INFORMATIVO", "ATENCAO"].includes(v.prioridade) || result.referencias.length > 10) throw new Error("Selecione fundamento/prioridade e informe até dez referências.");
  for (const name of ["temperatura_min_c", "temperatura_max_c"]) result[name] = decimal(v[name], { integerDigits: 4 });
  for (const name of ["umidade_min_percentual", "umidade_max_percentual", "cobertura_min_percentual"]) result[name] = decimal(v[name], { percentage: true, positive: name === "cobertura_min_percentual", integerDigits: 3 });
  result.intervalo_maximo_s = decimal(v.intervalo_maximo_s, { positive: true });
  result.exposicao_continua_s = v.exposicao_continua_s?.trim() ? decimal(v.exposicao_continua_s, { positive: true }) : null;
  if (decimalUnits(result.temperatura_min_c) >= decimalUnits(result.temperatura_max_c) || decimalUnits(result.umidade_min_percentual) >= decimalUnits(result.umidade_max_percentual)) throw new Error("Mínimo deve ser menor que máximo.");
  return result;
}
export function evaluationPayload(v, session, key) {
  if (session.estado === "CANCELADA") throw new Error("Sessão cancelada permite somente consulta.");
  const inicio = isoDate(v.inicio), fim = isoDate(v.fim), corte = isoDate(v.corte_aquisicao);
  if (!inicio || !fim || !corte || new Date(inicio) < new Date(session.inicio) || new Date(fim) <= new Date(inicio) || new Date(fim) > new Date(corte) || new Date(corte).getTime() > Date.now() || (session.fim && new Date(fim) > new Date(session.fim))) throw new Error("Informe janela positiva dentro da sessão e corte não futuro, posterior ou igual ao fim.");
  if (v.revisao !== "" && (!/^\d+$/.test(v.revisao) || !Number.isSafeInteger(Number(v.revisao)))) throw new Error("Revisão deve ser um inteiro não negativo.");
  return { chave_idempotencia: key, inicio, fim, corte_aquisicao: corte, revisao: v.revisao === "" ? null : Number(v.revisao), configuracao_id: v.configuracao_id || null, analise_etileno_id: null };
}
export function alertActions(status) {
  return [...(status === "ABERTO" ? ["RECONHECER"] : []), ...(["ABERTO", "EM_ANALISE"].includes(status) ? ["RESOLVER", "DESCARTAR"] : []), "OBSERVAR"];
}
