import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import Frota from "../src/pages/Frota/Frota";
import Sidebar from "../src/components/Sidebar/Sidebar";
import App from "../src/App";
import { setSessionToken } from "../src/services/session";
import { listFleet, listFleetCompanies, saveFleet } from "../src/services/fleetService";
import api from "../src/services/api";
import { reply, user } from "./helpers";

const company = { id: "carrier-1", nome: "Transportadora de teste", tipo: "TRANSPORTADORA", ativo: true };
const other = { ...company, id: "carrier-2", nome: "Outra transportadora" };
const vehicle = { id: "vehicle-1", empresa_id: company.id, identificador: "DEMO-01", placa: "TESTE", modelo: "Modelo", descricao: "Fictício", ativo: true };
const driver = { id: "driver-1", empresa_id: company.id, nome: "Motorista de teste", documento: "FICTICIO", telefone: "000", ativo: true };
const actor = (perfil = "GESTOR") => user(perfil, { empresas: [company] });
const payload = (config) => typeof config.data === "string" ? JSON.parse(config.data) : config.data;

function adapter({ companies = [company], vehicles = [vehicle], drivers = [driver], writeStatus = 200, readStatus = 200, timeout = false } = {}) {
  const calls = [];
  api.defaults.adapter = async (config) => {
    calls.push({ url: config.url, method: config.method, params: config.params, data: payload(config) });
    if (config.url === "/health") return reply(config, { status: "ok" });
    if (config.url === "/api/v1/auth/me") return reply(config, actor());
    if (config.url === "/api/v1/viagens") return reply(config, []);
    if (config.url === "/api/v1/empresas") return reply(config, companies);
    if (config.method === "post" || config.method === "patch") {
      if (timeout) throw new AxiosError("Simulated timeout", "ECONNABORTED", config);
      return reply(config, { id: "created", ...payload(config) }, writeStatus);
    }
    if (config.url === "/api/v1/veiculos") return reply(config, vehicles, readStatus);
    if (config.url === "/api/v1/motoristas") return reply(config, drivers, readStatus);
    return reply(config, { detail: "Unhandled local mock" }, 404);
  };
  return calls;
}

async function selectCompany(id = company.id) {
  await screen.findByRole("option", { name: company.nome });
  fireEvent.change(screen.getByLabelText("Transportadora da frota"), { target: { value: id } });
  await waitFor(() => expect(screen.queryByText("Carregando cadastros…")).toBeNull());
}

describe("controle de acesso à Frota", () => {
  it.each(["GESTOR", "ADMIN"])("%s pode cadastrar frota", async (role) => {
    adapter(); render(<Frota user={actor(role)} />); await selectCompany();
    expect(screen.getByRole("button", { name: "Novo veículo" })).toBeTruthy();
  });
  it.each(["OPERADOR", "CONSULTA"])("%s da transportadora consulta sem escrever", async (role) => {
    adapter(); render(<Frota user={actor(role)} />); await selectCompany();
    expect(await screen.findByText(vehicle.identificador)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Novo veículo" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Editar/ })).toBeNull();
  });
  it.each(["PRODUTOR", "CLIENTE"])("vínculo somente com %s não abre frota nem consulta API", (tipo) => {
    const calls = adapter();
    const external = user("CONSULTA", { empresas: [{ ...company, tipo }] });
    render(<Frota user={external} />);
    expect(screen.getByRole("alert").textContent).toMatch(/não permite/);
    expect(calls).toHaveLength(0);
  });
  it("rota /frota restaura sessão e carrega página autorizada", async () => {
    adapter(); setSessionToken("fixture-fleet-session");
    render(<MemoryRouter initialEntries={["/frota"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Frota", level: 1 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Frota" })).toBeTruthy();
  });
  it("menu não oferece frota ao cliente externo", () => {
    render(<MemoryRouter><Sidebar user={user("CONSULTA", { empresas: [{ ...company, tipo: "CLIENTE" }] })} /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: "Frota" })).toBeNull();
  });
  it("ADMIN consulta transportadora inativa sem ações de escrita", async () => {
    adapter({ companies: [{ ...company, ativo: false }] });
    render(<Frota user={user("ADMIN")} />);
    await screen.findByRole("option", { name: `${company.nome} (inativa)` });
    fireEvent.change(screen.getByLabelText("Transportadora da frota"), { target: { value: company.id } });
    expect(await screen.findByText(vehicle.identificador)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Novo veículo" })).toBeNull();
  });
});

describe("cadastro e edição pelo contrato logístico", () => {
  it("cadastra veículo na transportadora selecionada e confirma resposta antes do sucesso", async () => {
    const calls = adapter({ writeStatus: 201 });
    render(<Frota user={actor()} />); await selectCompany();
    fireEvent.click(screen.getByRole("button", { name: "Novo veículo" }));
    fireEvent.change(screen.getByLabelText("Identificador"), { target: { value: " NOVO-DEMO " } });
    fireEvent.change(screen.getByLabelText("Placa"), { target: { value: " ABC " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
    expect(await screen.findByText("Cadastro salvo com sucesso.")).toBeTruthy();
    expect(calls.find((c) => c.method === "post")).toMatchObject({ url: "/api/v1/veiculos", data: { identificador: "NOVO-DEMO", placa: "ABC", modelo: null, descricao: null, ativo: true, empresa_id: company.id } });
    expect(screen.queryByRole("form")).toBeNull();
  });
  it("cadastra motorista, sem criar campos adicionais ou documento obrigatório", async () => {
    const calls = adapter({ writeStatus: 201 });
    render(<Frota user={actor()} />); await selectCompany();
    fireEvent.change(screen.getByLabelText("Tipo de cadastro"), { target: { value: "motoristas" } });
    expect(await screen.findByText(driver.nome)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Novo motorista" }));
    fireEvent.change(screen.getByLabelText("Nome do motorista"), { target: { value: " Novo motorista " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
    await screen.findByText("Cadastro salvo com sucesso.");
    expect(calls.find((c) => c.method === "post").data).toEqual({ nome: "Novo motorista", documento: null, telefone: null, ativo: true, empresa_id: company.id });
  });
  it("edita e inativa veículo com PATCH sem transferir empresa ou excluir registro", async () => {
    const calls = adapter(); render(<Frota user={actor()} />); await selectCompany();
    fireEvent.click(await screen.findByRole("button", { name: "Editar DEMO-01" }));
    fireEvent.click(screen.getByLabelText("Ativo"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
    await screen.findByText("Cadastro salvo com sucesso.");
    const patch = calls.find((c) => c.method === "patch");
    expect(patch.url).toBe("/api/v1/veiculos/vehicle-1");
    expect(patch.data.ativo).toBe(false);
    expect(patch.data).not.toHaveProperty("empresa_id");
    expect(calls.some((c) => c.method === "delete")).toBe(false);
  });
  it("bloqueia campo obrigatório preenchido apenas com espaços", async () => {
    const calls = adapter(); render(<Frota user={actor()} />); await selectCompany();
    fireEvent.click(screen.getByRole("button", { name: "Novo veículo" }));
    fireEvent.change(screen.getByLabelText("Identificador"), { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("form", { name: "Cadastrar veículo" }));
    expect(screen.getByRole("alert").textContent).toMatch(/apenas espaços/);
    expect(calls.some((c) => c.method === "post")).toBe(false);
  });
  it.each([403, 409, 422])("HTTP %s mantém formulário sem anunciar sucesso", async (writeStatus) => {
    adapter({ writeStatus }); render(<Frota user={actor()} />); await selectCompany();
    fireEvent.click(screen.getByRole("button", { name: "Novo veículo" }));
    fireEvent.change(screen.getByLabelText("Identificador"), { target: { value: "Falha controlada" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByLabelText("Identificador").value).toBe("Falha controlada");
    expect(screen.queryByText("Cadastro salvo com sucesso.")).toBeNull();
  });
  it("timeout não repete POST automaticamente e pede conferência na listagem", async () => {
    const calls = adapter({ timeout: true }); render(<Frota user={actor()} />); await selectCompany();
    fireEvent.click(screen.getByRole("button", { name: "Novo veículo" }));
    fireEvent.change(screen.getByLabelText("Identificador"), { target: { value: "Conferir antes de reenviar" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/antes de reenviar/);
    expect(calls.filter((c) => c.method === "post")).toHaveLength(1);
  });
  it("envio duplo não duplica POST e bloqueia a troca de contexto durante gravação", async () => {
    const calls = adapter();
    const previous = api.defaults.adapter;
    let confirm;
    api.defaults.adapter = async (config) => config.method === "post" ? new Promise((resolve) => {
      calls.push({ method: "post", url: config.url });
      confirm = () => resolve(reply(config, { id: "new-vehicle", ...payload(config) }, 201));
    }) : previous(config);
    render(<Frota user={actor()} />); await selectCompany();
    fireEvent.click(screen.getByRole("button", { name: "Novo veículo" }));
    fireEvent.change(screen.getByLabelText("Identificador"), { target: { value: "ENVIO-UNICO" } });
    const form = screen.getByRole("form", { name: "Cadastrar veículo" });
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(calls.filter((c) => c.method === "post")).toHaveLength(1));
    expect(screen.getByLabelText("Transportadora da frota").disabled).toBe(true);
    expect(screen.getByLabelText("Tipo de cadastro").disabled).toBe(true);
    await act(async () => confirm());
    expect(await screen.findByText("Cadastro salvo com sucesso.")).toBeTruthy();
    expect(screen.getByLabelText("Transportadora da frota").disabled).toBe(false);
  });
});

describe("escopo, paginação e integridade da seleção", () => {
  it("pagina transportadoras e exclui produtores/clientes do seletor", async () => {
    const offsets = [];
    api.defaults.adapter = async (config) => {
      offsets.push(config.params.offset);
      return reply(config, config.params.offset === 0 ? Array.from({ length: 100 }, (_, i) => ({ ...company, id: `producer-${i}`, tipo: "PRODUTOR" })) : [company]);
    };
    expect(await listFleetCompanies()).toEqual([company]);
    expect(offsets).toEqual([0, 100]);
  });
  it("consulta frota com empresa explícita, inclui inativos e limita página a 20", async () => {
    const calls = adapter({ vehicles: Array.from({ length: 21 }, (_, i) => ({ ...vehicle, id: `v-${i}`, identificador: `V-${i}`, ativo: false })) });
    render(<Frota user={actor()} />); await selectCompany();
    await screen.findByText("V-0");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(21);
    expect(screen.queryByText("V-20")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(calls.at(-1).params).toEqual({ empresa_id: company.id, limit: 21, offset: 20 }));
    expect(calls.at(-1).params).not.toHaveProperty("ativo");
  });
  it("trocar transportadora elimina formulário e registros do contexto anterior", async () => {
    adapter({ companies: [company, other] }); render(<Frota user={actor()} />); await selectCompany();
    fireEvent.click(await screen.findByRole("button", { name: "Editar DEMO-01" }));
    fireEvent.change(screen.getByLabelText("Transportadora da frota"), { target: { value: other.id } });
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.queryByText(vehicle.identificador)).toBeNull();
    // Mock returns the old carrier's record: the service rejects the inconsistent response.
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
  it("403 na listagem não aparece como lista vazia", async () => {
    adapter({ readStatus: 403 }); render(<Frota user={actor()} />); await selectCompany();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Nenhum registro nesta página.")).toBeNull();
  });
  it("serviço não permite resposta de outra transportadora nem campos extras em PATCH", async () => {
    adapter({ vehicles: [{ ...vehicle, empresa_id: other.id }] });
    await expect(listFleet("veiculos", company.id)).rejects.toThrow(/incompatível/);
    const calls = adapter();
    await saveFleet("motoristas", company.id, driver.id, { ...driver, empresa_id: other.id, perfil: "ADMIN" });
    expect(calls[0].data).toEqual({ nome: driver.nome, documento: driver.documento, telefone: driver.telefone, ativo: true });
  });
});
