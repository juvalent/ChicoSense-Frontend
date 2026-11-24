import api from "./api";

export const FLEET_PAGE_SIZE = 20;
const fields = {
  veiculos: ["identificador", "placa", "modelo", "descricao"],
  motoristas: ["nome", "documento", "telefone"],
};

function resourcePath(kind, id) {
  if (!Object.hasOwn(fields, kind)) throw new Error("Tipo de cadastro inválido.");
  return `/api/v1/${kind}${id ? `/${encodeURIComponent(id)}` : ""}`;
}

export async function listFleetCompanies(signal) {
  const result = [];
  for (let offset = 0; ; offset += 100) {
    const { data } = await api.get("/api/v1/empresas", { params: { limit: 100, offset }, signal });
    if (!Array.isArray(data)) throw new Error("Resposta de empresas incompatível.");
    result.push(...data.filter((company) => company.tipo === "TRANSPORTADORA"));
    if (data.length < 100) return result;
  }
}

export async function listFleet(kind, companyId, { offset = 0, signal } = {}) {
  if (!companyId) throw new Error("Selecione uma transportadora.");
  const { data } = await api.get(resourcePath(kind), {
    params: { empresa_id: companyId, offset, limit: FLEET_PAGE_SIZE + 1 }, signal,
  });
  if (!Array.isArray(data) || data.some((item) => item.empresa_id !== companyId)) {
    throw new Error("Resposta de frota incompatível com a transportadora selecionada.");
  }
  return { records: data.slice(0, FLEET_PAGE_SIZE), hasNext: data.length > FLEET_PAGE_SIZE };
}

export async function saveFleet(kind, companyId, recordId, values) {
  const path = resourcePath(kind, recordId);
  if (!companyId) throw new Error("Selecione uma transportadora.");
  // Company ownership is immutable on PATCH. Never forward arbitrary form fields.
  const payload = Object.fromEntries(fields[kind].map((field) => [field, String(values[field] ?? "").trim() || null]));
  payload.ativo = values.ativo === true;
  if (!recordId) payload.empresa_id = companyId;
  const { data } = recordId ? await api.patch(path, payload) : await api.post(path, payload);
  return data;
}

export function fleetError(error, writing = false) {
  const status = error?.response?.status;
  if (status === 401) return "Sua sessão expirou. Faça login novamente.";
  if (status === 403) return "Sem permissão para acessar ou alterar a frota desta transportadora.";
  if (status === 404) return "Registro não encontrado. Atualize a listagem.";
  if (status === 409) return "O cadastro não pôde ser salvo por conflito ou restrição da transportadora. Atualize a listagem e confira os dados.";
  if (status === 422) return "Verifique os campos informados e seus limites antes de salvar.";
  if (writing) return "Não foi possível confirmar a gravação. Atualize a listagem antes de reenviar para evitar duplicação.";
  return "Não foi possível consultar os cadastros. Tente novamente.";
}
