import { listarLeiturasSessao } from "./monitoramentoService";

export const READING_PAGE_SIZE = 100;

// Pin the acquisition revision across pages; do not call a global sensor endpoint.
export async function loadSessionPage(sessionId, { offset, revision } = {}) {
  if (!sessionId) throw new Error("Selecione uma sessão de monitoramento.");
  if (offset === undefined) {
    const metadata = await listarLeiturasSessao(sessionId, { limit: 1, offset: 0 });
    if (!Number.isInteger(metadata.total) || metadata.total < 0 || !Number.isInteger(metadata.revisao) || metadata.revisao < 0) {
      throw new Error("Resposta do histórico sem total ou revisão válidos.");
    }
    if (metadata.total === 0) return { ...metadata, offset: 0, limit: READING_PAGE_SIZE };
    revision = metadata.revisao;
    offset = Math.floor((metadata.total - 1) / READING_PAGE_SIZE) * READING_PAGE_SIZE;
  }
  return listarLeiturasSessao(sessionId, { limit: READING_PAGE_SIZE, offset, revisao: revision });
}
