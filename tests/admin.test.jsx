import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import Administracao from "../src/pages/Administracao/Administracao";
import Sidebar from "../src/components/Sidebar/Sidebar";
import App from "../src/App";
import { setSessionToken } from "../src/services/session";
import { adminPayload, readAdminPage } from "../src/services/adminService";
import api from "../src/services/api";
import { reply, user } from "./helpers";

const company = { id: "company-1", nome: "Empresa de teste", tipo: "TRANSPORTADORA", documento: "FICTICIO", ativo: true };
const profiles = [{ id: "profile-admin", nome: "ADMIN" }, { id: "profile-gestor", nome: "GESTOR" }, { id: "profile-consulta", nome: "CONSULTA" }];
const person = { id: "person-1", nome: "Pessoa de teste", email: "pessoa@example.invalid", perfil_id: "profile-gestor", ativo: true };
const product = { id: "product-1", nome: "Manga de teste", descricao: "Produto fictício", ativo: true };
const parameter = { id: "parameter-1", produto_id: product.id, nome_parametro: "Parâmetro didático", unidade: "C", valor_minimo: "0.0000", valor_maximo: "13.0000", observacao: "Não validado" };
const actor = () => user("ADMIN", { perfil_id: "profile-admin", empresas: [company] });
const payload = (config) => typeof config.data === "string" ? JSON.parse(config.data) : config.data;

function adapter({ companies = [company], users = [person], products = [product], parameters = [parameter], linked = [person], writeStatus = 200, readStatus = 200, timeout = false } = {}) {
  const calls = [];
  api.defaults.adapter = async (config) => {
    const data = payload(config);
    calls.push({ url: config.url, method: config.method, params: config.params, data });
    if (config.url === "/health") return reply(config, { status: "ok" });
    if (config.url === "/api/v1/auth/me") return reply(config, actor());
    if (config.url === "/api/v1/viagens") return reply(config, []);
    if (config.method === "post" || config.method === "patch") {
      if (timeout) throw new AxiosError("Fixture timeout", "ECONNABORTED", config);
      return reply(config, { id: config.method === "patch" ? config.url.split("/").at(-1) : "created", ...data }, writeStatus);
    }
    if (config.url === "/api/v1/empresas") return reply(config, companies, readStatus);
    if (config.url === "/api/v1/usuarios") return reply(config, users, readStatus);
    if (config.url === "/api/v1/perfis") return reply(config, profiles, readStatus);
    if (config.url === "/api/v1/produtos") return reply(config, products, readStatus);
    if (/\/empresas\/[^/]+\/usuarios$/.test(config.url)) return reply(config, linked, readStatus);
    if (/\/produtos\/[^/]+\/parametros$/.test(config.url)) return reply(config, parameters, readStatus);
    return reply(config, { detail: "Unhandled local mock" }, 404);
  };
  return calls;
}

function mount() { render(<Administracao user={actor()} />); }
async function tab(name) { fireEvent.click(screen.getByRole("button", { name, exact: true })); await waitFor(() => expect(screen.getByRole("button", { name: name === "Usuários" ? "Novo usuário" : "Novo produto" }).disabled).toBe(false)); }
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const writeCalls = (calls) => calls.filter((call) => ["post", "patch"].includes(call.method));
async function newCompany() { await screen.findByText(company.nome); fireEvent.click(screen.getByRole("button", { name: "Nova empresa" })); }
async function newUser() {
  await tab("Usuários"); fireEvent.click(screen.getByRole("button", { name: "Novo usuário" }));
  fill("Nome do usuário", "Nova pessoa"); fill("E-mail do usuário", "nova@example.invalid"); fill("Perfil de acesso", "profile-gestor"); fill("Senha inicial", "SomenteFixture#123");
}

describe("administração exclusiva de ADMIN", () => {
  it.each(["GESTOR", "OPERADOR", "CONSULTA", "DESCONHECIDO"])("%s não recebe menu, formulário nem consultas administrativas", (perfil) => {
    const calls = adapter(); const current = user(perfil, { empresas: [company] });
    render(<><Administracao user={current} /><MemoryRouter><Sidebar user={current} /></MemoryRouter></>);
    expect(screen.getByRole("alert").textContent).toMatch(/exclusivo/);
    expect(screen.queryByRole("link", { name: "Administração" })).toBeNull();
    expect(screen.queryByRole("form")).toBeNull(); expect(calls).toHaveLength(0);
  });
  it("ADMIN inativo não consulta o catálogo", () => {
    const calls = adapter(); render(<Administracao user={user("ADMIN", { ativo: false })} />);
    expect(screen.getByRole("alert")).toBeTruthy(); expect(calls).toHaveLength(0);
  });
  it("/administracao restaura a identidade e carrega menu e cadastros", async () => {
    adapter(); setSessionToken("fixture-admin-session"); render(<MemoryRouter initialEntries={["/administracao"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Administração", level: 1 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Administração" })).toBeTruthy();
    expect(await screen.findByText(company.nome)).toBeTruthy();
  });
});

describe("empresas e integridade", () => {
  it.each(["TRANSPORTADORA", "PRODUTOR", "CLIENTE"])("cadastra %s pelo contrato real", async (tipo) => {
    const calls = adapter({ writeStatus: 201 }); mount(); await newCompany();
    fill("Nome da empresa", " Nova empresa "); fill("Tipo de empresa", tipo);
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
    await screen.findByText("Cadastro salvo com sucesso.");
    expect(writeCalls(calls)[0]).toMatchObject({ url: "/api/v1/empresas", data: { nome: "Nova empresa", tipo, documento: null, ativo: true } });
  });
  it("edita e inativa empresa sem excluir ou reenviar metadados", async () => {
    const calls = adapter(); mount(); fireEvent.click(await screen.findByRole("button", { name: `Editar ${company.nome}` }));
    fill("Nome da empresa", "Nome atualizado"); fireEvent.click(screen.getByLabelText("Ativo"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" })); await screen.findByText("Cadastro salvo com sucesso.");
    expect(writeCalls(calls)[0]).toEqual({ url: "/api/v1/empresas/company-1", method: "patch", params: undefined, data: { nome: "Nome atualizado", tipo: company.tipo, documento: "FICTICIO", ativo: false } });
    expect(calls.some((call) => call.method === "delete")).toBe(false);
  });
  it.each([401, 403, 409, 422])("HTTP %s não vira sucesso e preserva os campos editáveis", async (writeStatus) => {
    adapter({ writeStatus }); mount(); await newCompany(); fill("Nome da empresa", "Manter dados"); fill("Tipo de empresa", "CLIENTE");
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
    expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.getByLabelText("Nome da empresa").value).toBe("Manter dados");
    expect(screen.queryByText("Cadastro salvo com sucesso.")).toBeNull();
  });
  it("403 de leitura não vira cadastro vazio", async () => {
    adapter({ readStatus: 403 }); mount(); expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Nenhum registro nesta página.")).toBeNull();
    expect(screen.getByRole("button", { name: "Nova empresa" }).disabled).toBe(true);
  });
});

describe("usuários, perfil e senha", () => {
  it("cadastra usuário com perfil da API, sem persistir senha no storage", async () => {
    const calls = adapter({ writeStatus: 201 }); mount(); await newUser();
    fill("E-mail do usuário", "NOVA@EXAMPLE.INVALID");
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" })); await screen.findByText("Cadastro salvo com sucesso.");
    expect(writeCalls(calls)[0]).toMatchObject({ url: "/api/v1/usuarios", data: { nome: "Nova pessoa", email: "nova@example.invalid", perfil_id: "profile-gestor", senha: "SomenteFixture#123", ativo: true } });
    expect(sessionStorage.length).toBe(0); expect(localStorage.length).toBe(0);
    expect(screen.queryByLabelText("Senha inicial")).toBeNull();
  });
  it("edição sem nova senha mantém a credencial atual e permite inativar", async () => {
    const calls = adapter(); mount(); await tab("Usuários"); fireEvent.click(await screen.findByRole("button", { name: `Editar ${person.nome}` }));
    expect(screen.getByLabelText("Nova senha (opcional)").value).toBe("");
    fireEvent.click(screen.getByLabelText("Ativo")); fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
    await screen.findByText("Cadastro salvo com sucesso.");
    expect(writeCalls(calls)[0].data).toEqual({ nome: person.nome, email: person.email, perfil_id: person.perfil_id, ativo: false });
    expect(writeCalls(calls)[0].data).not.toHaveProperty("senha");
  });
  it("falha no cadastro limpa somente a senha, sem exibi-la como mensagem", async () => {
    adapter({ writeStatus: 409 }); mount(); await newUser();
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" })); await screen.findByRole("alert");
    expect(screen.getByLabelText("Senha inicial").value).toBe("");
    expect(screen.getByLabelText("Nome do usuário").value).toBe("Nova pessoa");
    expect(screen.getByRole("alert").textContent).not.toContain("SomenteFixture#123");
  });
  it("recusa senha curta antes de chamar o backend", async () => {
    const calls = adapter(); mount(); await newUser(); fill("Senha inicial", "curta");
    fireEvent.submit(screen.getByRole("form", { name: "Cadastrar usuário" }));
    expect(screen.getByRole("alert").textContent).toMatch(/12 e 128/); expect(writeCalls(calls)).toHaveLength(0);
  });
  it("senha não é aparada e campos extras não entram no payload", () => {
    const data = adminPayload("usuarios", { ...person, senha: " senha fixture 123 ", perfil: "ADMIN", senha_hash: "nao-transferir" });
    expect(data.senha).toBe(" senha fixture 123 "); expect(data).not.toHaveProperty("senha_hash"); expect(data).not.toHaveProperty("perfil");
  });
  it("edição da própria conta revalida /me e remove área ADMIN após mudança de papel", async () => {
    const current = actor(); const calls = adapter({ users: [current] }); const previous = api.defaults.adapter;
    let changed = false;
    api.defaults.adapter = async (config) => {
      if (config.url === "/api/v1/auth/me" && changed) return reply(config, { ...current, perfil: "CONSULTA", perfil_id: "profile-consulta" });
      if (config.method === "patch") { changed = true; return reply(config, { ...current, ...payload(config) }); }
      return previous(config);
    };
    setSessionToken("fixture-admin-self"); render(<MemoryRouter initialEntries={["/administracao"]}><App /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Administração", level: 1 }); await tab("Usuários");
    fireEvent.click(await screen.findByRole("button", { name: `Editar ${current.nome}` })); fill("Perfil de acesso", "profile-consulta");
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
    expect(await screen.findByText("Acesso exclusivo a administradores ativos.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Administração" })).toBeNull();
    expect(calls.some((call) => call.url === "/api/v1/auth/me")).toBe(true);
  });
});

describe("produtos e parâmetros decimais", () => {
  it("cadastra produto e preserva descrição multiline", async () => {
    const calls = adapter({ writeStatus: 201 }); mount(); await tab("Produtos");
    fireEvent.click(screen.getByRole("button", { name: "Novo produto" })); fill("Nome do produto", "Novo produto"); fill("Descrição do produto", "Linha um\nLinha dois");
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" })); await screen.findByText("Cadastro salvo com sucesso.");
    expect(writeCalls(calls)[0].data).toEqual({ nome: "Novo produto", descricao: "Linha um\nLinha dois", ativo: true });
  });
  it("edita e inativa produto", async () => {
    const calls = adapter(); mount(); await tab("Produtos"); fireEvent.click(await screen.findByRole("button", { name: `Editar ${product.nome}` }));
    fireEvent.click(screen.getByLabelText("Ativo")); fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
    await screen.findByText("Cadastro salvo com sucesso."); expect(writeCalls(calls)[0]).toMatchObject({ method: "patch", url: "/api/v1/produtos/product-1", data: { ativo: false } });
  });
  async function openParameters() {
    await tab("Produtos"); fireEvent.click(await screen.findByRole("button", { name: `Parâmetros de ${product.nome}` }));
    await screen.findByText(parameter.nome_parametro);
  }
  it("cria parâmetro no produto selecionado, preservando precisão e limites", async () => {
    const calls = adapter({ writeStatus: 201 }); mount(); await openParameters();
    fireEvent.click(screen.getByRole("button", { name: "Novo parâmetro" })); fill("Nome do parâmetro", "Faixa didática"); fill("Valor mínimo", "99999999,9998"); fill("Valor máximo", "99999999.9999");
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" })); await screen.findByText("Cadastro salvo com sucesso.");
    expect(writeCalls(calls)[0]).toMatchObject({ url: "/api/v1/produtos/product-1/parametros", data: { nome_parametro: "Faixa didática", unidade: null, valor_minimo: "99999999.9998", valor_maximo: "99999999.9999", observacao: null } });
    expect(writeCalls(calls)[0].data).not.toHaveProperty("ativo");
  });
  it("edita parâmetro sem converter vazio em zero", async () => {
    const calls = adapter(); mount(); await openParameters(); fireEvent.click(screen.getByRole("button", { name: `Editar ${parameter.nome_parametro}` }));
    fill("Valor mínimo", ""); fill("Valor máximo", "0"); fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" })); await screen.findByText("Cadastro salvo com sucesso.");
    expect(writeCalls(calls)[0]).toMatchObject({ url: "/api/v1/produtos/product-1/parametros/parameter-1", method: "patch", data: { valor_minimo: null, valor_maximo: "0" } });
  });
  it("mínimo maior que máximo não dispara gravação", async () => {
    const calls = adapter(); mount(); await openParameters(); fireEvent.click(screen.getByRole("button", { name: "Novo parâmetro" }));
    fill("Nome do parâmetro", "Inválido"); fill("Valor mínimo", "13.0001"); fill("Valor máximo", "13.0000");
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" })); expect(screen.getByRole("alert").textContent).toMatch(/menor ou igual/); expect(writeCalls(calls)).toHaveLength(0);
  });
  it.each(["100000000", "0.00001", "NaN", "Infinity"])("recusa valor não representável %s", (value) => {
    expect(() => adminPayload("parametros", { nome_parametro: "Teste", valor_minimo: value })).toThrow(/quatro casas/);
  });
});

describe("vínculos e paginação", () => {
  it("vincula o usuário selecionado à empresa pelo caminho, sem inventar remoção", async () => {
    const calls = adapter(); mount(); fireEvent.click(await screen.findByRole("button", { name: `Vínculos de ${company.nome}` }));
    await screen.findByRole("option", { name: `${person.nome} · ${person.email}` }); fill("Usuário para vincular", person.id);
    fireEvent.click(screen.getByRole("button", { name: "Vincular ou reativar usuário" })); await screen.findByText("Vínculo confirmado.");
    expect(writeCalls(calls)[0]).toMatchObject({ url: "/api/v1/empresas/company-1/usuarios/person-1", method: "post" });
    expect(screen.queryByRole("button", { name: /Remover vínculo/ })).toBeNull();
    expect(calls.some((call) => call.method === "delete")).toBe(false);
  });
  it("pagina empresas e usa a empresa atual no painel de vínculos", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({ ...company, id: `company-${i}`, nome: `Empresa ${i}` }));
    const calls = adapter({ companies: rows }); mount(); await screen.findByText("Empresa 0");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(21); expect(screen.queryByText("Empresa 20")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Vínculos de Empresa 1" })); await screen.findByLabelText("Usuário para vincular");
    expect(calls.some((call) => call.url === "/api/v1/empresas/company-1/usuarios")).toBe(true);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Paginação de empresas" })).getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(calls.at(-1).params).toEqual({ limit: 21, offset: 20 }));
    expect(screen.queryByLabelText("Usuário para vincular")).toBeNull();
  });
  it("paginação dos usuários para vincular não carrega toda a base", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({ ...person, id: `person-${i}`, nome: `Pessoa ${i}` }));
    const calls = adapter({ users: rows }); mount(); fireEvent.click(await screen.findByRole("button", { name: `Vínculos de ${company.nome}` }));
    await screen.findByLabelText("Usuário para vincular"); fireEvent.click(screen.getByRole("button", { name: "Próximas opções de usuários" }));
    await waitFor(() => expect(calls.some((call) => call.url === "/api/v1/usuarios" && call.params.offset === 20 && call.params.limit === 21)).toBe(true));
  });
  it("consulta de parâmetros exige produto e usa o pai correto", async () => {
    const calls = adapter(); expect(() => readAdminPage("parametros")).toThrow();
    expect(calls).toHaveLength(0);
  });
  it("timeout não repete POST e orienta conferir antes de reenviar", async () => {
    const calls = adapter({ timeout: true }); mount(); await newCompany(); fill("Nome da empresa", "Conferir gravação"); fill("Tipo de empresa", "CLIENTE");
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/antes de reenviar/); expect(writeCalls(calls)).toHaveLength(1);
  });
  it("envio duplo é bloqueado, junto com troca de seção durante gravação", async () => {
    const calls = adapter(); const previous = api.defaults.adapter; let confirm;
    api.defaults.adapter = async (config) => config.method === "post" ? new Promise((resolve) => { calls.push({ method: "post" }); confirm = () => resolve(reply(config, { id: "created", ...payload(config) }, 201)); }) : previous(config);
    mount(); await newCompany(); fill("Nome da empresa", "Uma gravação"); fill("Tipo de empresa", "CLIENTE");
    const form = screen.getByRole("form", { name: "Cadastrar empresa" }); fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(writeCalls(calls)).toHaveLength(1)); expect(screen.getByRole("button", { name: "Usuários", exact: true }).disabled).toBe(true);
    await act(async () => confirm()); await screen.findByText("Cadastro salvo com sucesso.");
  });
});
