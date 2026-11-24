import api from "./api";

export const ADMIN_PAGE_SIZE = 20;
export const adminDefinitions = {
  empresas: { title: "Empresas", singular: "empresa", active: true, fields: [
    { name: "nome", label: "Nome da empresa", required: true, maxLength: 180 },
    { name: "tipo", label: "Tipo de empresa", required: true, options: ["TRANSPORTADORA", "PRODUTOR", "CLIENTE"] },
    { name: "documento", label: "Documento da empresa", maxLength: 40 },
  ] },
  usuarios: { title: "Usuários", singular: "usuário", active: true, fields: [
    { name: "nome", label: "Nome do usuário", required: true, maxLength: 150 },
    { name: "email", label: "E-mail do usuário", type: "email", required: true, maxLength: 255 },
    { name: "perfil_id", label: "Perfil de acesso", required: true, profiles: true },
  ] },
  produtos: { title: "Produtos", singular: "produto", active: true, fields: [
    { name: "nome", label: "Nome do produto", required: true, maxLength: 120 },
    { name: "descricao", label: "Descrição do produto", multiline: true },
  ] },
  parametros: { title: "Parâmetros", singular: "parâmetro", fields: [
    { name: "nome_parametro", label: "Nome do parâmetro", required: true, maxLength: 120 },
    { name: "unidade", label: "Unidade", maxLength: 30 },
    { name: "valor_minimo", label: "Valor mínimo", decimal: true },
    { name: "valor_maximo", label: "Valor máximo", decimal: true },
    { name: "observacao", label: "Observação", multiline: true },
  ] },
};

function pathFor(kind, parentId, id) {
  if (!Object.hasOwn(adminDefinitions, kind)) throw new Error("Cadastro administrativo inválido.");
  if (kind === "parametros" && !parentId) throw new Error("Selecione um produto.");
  const root = kind === "parametros" ? `/api/v1/produtos/${encodeURIComponent(parentId)}/parametros` : `/api/v1/${kind}`;
  return id ? `${root}/${encodeURIComponent(id)}` : root;
}

async function readPage(path, offset, signal) {
  const { data } = await api.get(path, { params: { offset, limit: ADMIN_PAGE_SIZE + 1 }, signal });
  if (!Array.isArray(data)) throw new Error("Resposta de cadastro incompatível.");
  return { records: data.slice(0, ADMIN_PAGE_SIZE), hasNext: data.length > ADMIN_PAGE_SIZE };
}

export function readAdminPage(kind, { parentId, offset = 0, signal } = {}) {
  return readPage(pathFor(kind, parentId), offset, signal);
}

export async function readProfiles(signal) {
  const { data } = await api.get("/api/v1/perfis", { signal });
  if (!Array.isArray(data)) throw new Error("Resposta de perfis incompatível.");
  return data;
}

function decimal(value) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  if (!/^-?\d{1,8}(?:\.\d{1,4})?$/.test(raw)) throw new Error("Use até oito dígitos inteiros e quatro casas decimais nos valores do parâmetro.");
  return raw;
}

function scaled(value) {
  const negative = value.startsWith("-");
  const [integer, fraction = ""] = value.replace(/^-/, "").split(".");
  const result = BigInt(integer) * 10000n + BigInt(fraction.padEnd(4, "0"));
  return negative ? -result : result;
}

export function adminPayload(kind, values, editing = false) {
  const definition = adminDefinitions[kind];
  if (!definition) throw new Error("Cadastro administrativo inválido.");
  const payload = {};
  for (const field of definition.fields) {
    const value = field.decimal ? decimal(values[field.name]) : String(values[field.name] ?? "").trim();
    if (field.required && !value) throw new Error(`Preencha ${field.label.toLowerCase()}.`);
    if (field.maxLength && value?.length > field.maxLength) throw new Error(`${field.label}: limite de ${field.maxLength} caracteres.`);
    payload[field.name] = value === "" ? null : value;
  }
  if (definition.active) payload.ativo = values.ativo === true;
  if (kind === "empresas" && !["TRANSPORTADORA", "PRODUTOR", "CLIENTE"].includes(payload.tipo)) throw new Error("Selecione um tipo de empresa válido.");
  if (kind === "usuarios") {
    payload.email = payload.email.toLowerCase();
    const password = String(values.senha ?? "");
    if (!editing || password !== "") {
      if (password.length < 12 || password.length > 128) throw new Error("A senha deve conter entre 12 e 128 caracteres.");
      payload.senha = password; // Password whitespace is intentional; never trim or persist it.
    }
  }
  if (kind === "parametros" && payload.valor_minimo !== null && payload.valor_maximo !== null && scaled(payload.valor_minimo) > scaled(payload.valor_maximo)) throw new Error("O valor mínimo deve ser menor ou igual ao máximo.");
  return payload;
}

export async function saveAdmin(kind, payload, { parentId, recordId } = {}) {
  const path = pathFor(kind, parentId, recordId);
  const { data } = recordId ? await api.patch(path, payload) : await api.post(path, payload);
  return data;
}

export function readCompanyUsers(companyId, { offset = 0, signal } = {}) {
  if (!companyId) throw new Error("Selecione uma empresa.");
  return readPage(`/api/v1/empresas/${encodeURIComponent(companyId)}/usuarios`, offset, signal);
}

export async function linkCompanyUser(companyId, userId) {
  if (!companyId || !userId) throw new Error("Selecione a empresa e o usuário.");
  const { data } = await api.post(`/api/v1/empresas/${encodeURIComponent(companyId)}/usuarios/${encodeURIComponent(userId)}`);
  return data;
}

export function adminError(error, writing = false) {
  const status = error?.response?.status;
  if (status === 401) return "Sua sessão expirou. Faça login novamente.";
  if (status === 403) return "Sem permissão administrativa para esta operação.";
  if (status === 404) return "Cadastro não encontrado. Atualize a listagem.";
  if (status === 409) return "Conflito de cadastro ou integridade. Confira duplicidades, vínculos e o estado do registro antes de reenviar.";
  if (status === 422) return "Dados rejeitados. Confira os campos, formatos e limites informados.";
  if (writing) return "Não foi possível confirmar a gravação. Confira a listagem antes de reenviar; a operação pode ter sido concluída.";
  return "Não foi possível consultar os cadastros administrativos. Tente novamente.";
}
