import api from "./api";

export const LOGISTICS_PAGE_SIZE = 20;
const cargoEnd = ["ENTREGUE", "CANCELADA"];
const boxEnd = ["ENTREGUE", "AVARIADA"];
export const isTerminal = (kind, status) => (kind === "cargas" ? cargoEnd : boxEnd).includes(status);

export function canOperateTrip(user, trip) {
  if (user?.ativo !== true) return false;
  if (user.perfil === "ADMIN") return true;
  return ["GESTOR", "OPERADOR"].includes(user.perfil) && Array.isArray(user.empresas) && user.empresas.some((company) =>
    company.ativo === true && company.tipo === "TRANSPORTADORA" && company.id === (trip?.transportadora_id ?? trip?.transportadoraId));
}

export function canCreateLogistics(kind, trip, cargo) {
  return kind === "cargas" ? ["PLANEJADA", "EM_ANDAMENTO"].includes(trip.status) : !cargoEnd.includes(cargo.status) && trip.status !== "CANCELADA";
}

export function nextStates(kind, record, trip, cargo) {
  if (kind === "cargas") {
    if (record.status === "PLANEJADA") return [...(trip.status === "EM_ANDAMENTO" ? ["EM_TRANSITO"] : []), "CANCELADA"];
    if (record.status === "EM_TRANSITO" && ["EM_ANDAMENTO", "CONCLUIDA"].includes(trip.status)) return ["ENTREGUE"];
  } else {
    if (record.status === "REGISTRADA") return [...(cargo.status === "EM_TRANSITO" ? ["EM_TRANSITO"] : []), "AVARIADA"];
    if (record.status === "EM_TRANSITO") return [...(["EM_TRANSITO", "ENTREGUE"].includes(cargo.status) ? ["ENTREGUE"] : []), "AVARIADA"];
  }
  return [];
}

function text(value) { return String(value ?? "").trim() || null; }
function required(value, label, maxLength) {
  const result = text(value);
  if (!result || result.length > maxLength) throw new Error(`Preencha ${label} com até ${maxLength} caracteres.`);
  return result;
}
function positiveDecimal(value, label) {
  const result = text(value)?.replace(",", ".") ?? null;
  if (result === null) return null;
  if (!/^\d{1,8}(?:\.\d{1,4})?$/.test(result) || !/[1-9]/.test(result)) throw new Error(`${label} deve ser positivo, com até oito dígitos inteiros e quatro casas decimais.`);
  return result;
}

export function logisticsPayload(kind, values, record, trip, cargo) {
  if (!["cargas", "caixas"].includes(kind)) throw new Error("Cadastro logístico inválido.");
  if (!record && !canCreateLogistics(kind, trip, cargo)) throw new Error("O estado atual não permite criar este cadastro.");
  const payload = { observacoes: text(values.observacoes) };
  if (!record || !isTerminal(kind, record.status)) {
    payload.identificacao = required(values.identificacao, "a identificação", 120);
    if (kind === "cargas") {
      const count = text(values.quantidade_caixas);
      if (count !== null && (!/^\d+$/.test(count) || Number(count) > 2147483647)) throw new Error("A quantidade declarada de caixas deve ser um inteiro entre 0 e 2147483647.");
      payload.quantidade_caixas = count === null ? null : Number(count);
      payload.quantidade = positiveDecimal(values.quantidade, "A quantidade");
      payload.unidade = text(values.unidade);
      if ((payload.quantidade === null) !== (payload.unidade === null)) throw new Error("Informe quantidade e unidade juntas, ou deixe ambas vazias.");
      payload.origem_produto = text(values.origem_produto);
      if (!record) {
        payload.produto_id = required(values.produto_id, "o produto", 100);
        payload.produtor_id = required(values.produtor_id, "o produtor", 100);
        payload.cliente_id = text(values.cliente_id);
      }
    } else {
      payload.codigo_externo = text(values.codigo_externo);
      payload.peso = positiveDecimal(values.peso, "O peso");
    }
  }
  if (record && values.status !== record.status) {
    if (!nextStates(kind, record, trip, cargo).includes(values.status)) throw new Error("Transição de estado não permitida neste contexto.");
    payload.status = values.status;
  }
  return payload;
}

export function isoDate(value) {
  if (!value) return null;
  const result = new Date(value);
  if (!Number.isFinite(result.getTime())) throw new Error("Informe uma data e hora válidas.");
  return result.toISOString();
}

export function tripPayload(trip, values) {
  const transitions = { PLANEJADA: ["EM_ANDAMENTO", "CANCELADA"], EM_ANDAMENTO: ["CONCLUIDA"], CONCLUIDA: [], CANCELADA: [] };
  if (!Object.hasOwn(transitions, trip.status)) throw new Error("Estado da viagem não reconhecido.");
  if (values.status !== trip.status && !transitions[trip.status].includes(values.status)) throw new Error("Transição de viagem não permitida.");
  const payload = { observacoes: text(values.observacoes) };
  if (values.status !== trip.status) {
    payload.status = values.status;
    if (values.status === "EM_ANDAMENTO") {
      payload.inicio_real = isoDate(values.inicio_real);
      if (!payload.inicio_real) throw new Error("Informe o início real da viagem.");
    }
    if (values.status === "CONCLUIDA") {
      const start = trip.inicio_real || isoDate(values.inicio_real);
      payload.chegada_em = isoDate(values.chegada_em);
      if (!start || !payload.chegada_em) throw new Error("A conclusão exige início e chegada reais.");
      if (new Date(payload.chegada_em) < new Date(start)) throw new Error("A chegada real não pode ser anterior ao início real.");
      if (!trip.inicio_real) payload.inicio_real = start;
    }
  }
  return payload;
}

function collection(kind, parentId) {
  if (!parentId) throw new Error("Selecione o registro pai.");
  if (kind === "cargas") return `/api/v1/viagens/${encodeURIComponent(parentId)}/cargas`;
  if (kind === "caixas") return `/api/v1/cargas/${encodeURIComponent(parentId)}/caixas`;
  throw new Error("Cadastro logístico inválido.");
}

export async function readLogistics(kind, parentId, { offset = 0, signal } = {}) {
  const { data } = await api.get(collection(kind, parentId), { params: { limit: LOGISTICS_PAGE_SIZE + 1, offset }, signal });
  const parentField = kind === "cargas" ? "viagem_id" : "carga_id";
  if (!Array.isArray(data) || data.some((record) => record[parentField] !== parentId)) throw new Error("Resposta incompatível com o contexto selecionado.");
  return { records: data.slice(0, LOGISTICS_PAGE_SIZE), hasNext: data.length > LOGISTICS_PAGE_SIZE };
}

export async function saveLogistics(kind, parentId, payload, recordId) {
  const root = collection(kind, parentId);
  const { data } = recordId ? await api.patch(`/api/v1/${kind}/${encodeURIComponent(recordId)}`, payload) : await api.post(root, payload);
  return data;
}

export async function readTrip(id, signal) {
  if (!id) throw new Error("Selecione uma viagem.");
  const { data } = await api.get(`/api/v1/viagens/${encodeURIComponent(id)}`, { signal });
  if (data?.id !== id) throw new Error("Resposta de viagem incompatível.");
  return data;
}

export async function saveTrip(id, payload) {
  const { data } = await api.patch(`/api/v1/viagens/${encodeURIComponent(id)}`, payload);
  return data;
}

export async function readReferencePage(kind, offset, signal) {
  if (!["empresas", "produtos"].includes(kind)) throw new Error("Catálogo inválido.");
  const { data } = await api.get(`/api/v1/${kind}`, { params: { limit: LOGISTICS_PAGE_SIZE + 1, offset, ...(kind === "produtos" ? { ativo: true } : {}) }, signal });
  if (!Array.isArray(data)) throw new Error("Resposta de catálogo incompatível.");
  return { records: data.slice(0, LOGISTICS_PAGE_SIZE), hasNext: data.length > LOGISTICS_PAGE_SIZE };
}

export function logisticsError(error, writing = false) {
  const status = error?.response?.status;
  if (status === 401) return "Sua sessão expirou. Faça login novamente.";
  if (status === 403) return "Sem permissão para consultar ou alterar este recurso logístico.";
  if (status === 404) return "Registro não encontrado. Atualize a listagem.";
  if (status === 409) return "Conflito de estado ou integridade. Atualize os dados e confira a transportadora e os vínculos.";
  if (status === 422) return "Confira os campos, as datas e a transição de estado solicitada.";
  return writing ? "Não foi possível confirmar a gravação. Consulte os dados antes de reenviar; a operação pode ter sido concluída." : "Não foi possível consultar os dados logísticos. Tente novamente.";
}
