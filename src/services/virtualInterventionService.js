import { decimal, decimalUnits, justification, operationalWriter } from "./preventiveService";

export const virtualActions = ["AUTORIZAR", "RECUSAR", "INICIAR", "ENCERRAR", "CANCELAR", "REGISTRAR_FALHA"];
export const virtualStates = ["SOLICITADA", "AUTORIZADA", "RECUSADA", "EM_EXECUCAO", "CONCLUIDA", "CANCELADA", "FALHA_SIMULACAO"];
export function canRequestVirtual(user, trip, session) {
  return operationalWriter(user, trip, session) && session.estado === "ATIVA" && (trip.statusApi ?? trip.status) === "EM_ANDAMENTO";
}
export function validateVirtual(row, session) {
  if (row.sessao_id !== session.id || row.viagem_id !== session.viagem_id || row.carga_id !== session.carga_id || row.modalidade !== "SIMULADA" || !virtualStates.includes(row.estado) || !Array.isArray(row.acoes_permitidas) || row.acoes_permitidas.some((action) => !virtualActions.includes(action))) throw new Error("Resposta de intervenção virtual incompatível.");
  return row;
}
export function allowedVirtualActions(row, user, trip, session) {
  if (!operationalWriter(user, trip, session)) return [];
  return (row.acoes_permitidas || []).filter((action) => virtualActions.includes(action) &&
    (["ADMIN", "GESTOR"].includes(user.perfil) || (row.solicitante_id === user.id && (action === "ENCERRAR" || (action === "CANCELAR" && row.estado === "SOLICITADA")))));
}
export function virtualRequestPayload(values, key, reference = null) {
  const duration = decimal(values.duracao_planejada_s, { positive: true });
  if (decimalUnits(duration) > 86400000n) throw new Error("Duração planejada deve ser de até 86400 segundos (24 horas).");
  const result = { chave_idempotencia: key, justificativa: justification(values.justificativa), duracao_planejada_s: duration, alerta_id: null, avaliacao_id: null, analise_etileno_id: null };
  if (reference) {
    if (!["alerta_id", "avaliacao_id", "analise_etileno_id"].includes(reference.field) || !reference.id) throw new Error("Referência inválida.");
    result[reference.field] = reference.id;
  }
  return result;
}
