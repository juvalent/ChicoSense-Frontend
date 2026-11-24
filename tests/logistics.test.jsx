import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import Cargas from "../src/pages/Cargas/Cargas";
import LogisticsRecords from "../src/components/Logistics/LogisticsRecords";
import TripOperations from "../src/components/Logistics/TripOperations";
import { canOperateTrip, logisticsPayload, nextStates, readLogistics, tripPayload } from "../src/services/logisticsService";
import { listarViagens } from "../src/services/viagemService";
import api from "../src/services/api";
import { reply, user } from "./helpers";

const carrier = { id: "carrier-1", nome: "Transportadora", tipo: "TRANSPORTADORA", ativo: true };
const producer = { id: "producer-1", nome: "Produtor DEMO", tipo: "PRODUTOR", ativo: true };
const client = { id: "client-1", nome: "Cliente DEMO", tipo: "CLIENTE", ativo: true };
const product = { id: "product-1", nome: "Manga DEMO", ativo: true };
const trip = { id: "trip-1", transportadora_id: carrier.id, status: "EM_ANDAMENTO", inicio_real: "2026-11-24T10:00:00Z", origem: "Origem", destino: "Destino", observacoes: null };
const cargo = { id: "cargo-1", viagem_id: trip.id, produto_id: product.id, produtor_id: producer.id, cliente_id: client.id, identificacao: "Carga DEMO", status: "PLANEJADA", quantidade_caixas: 0, quantidade: "1000.1234", unidade: "kg", observacoes: null };
const box = { id: "box-1", carga_id: cargo.id, identificacao: "Caixa DEMO", status: "REGISTRADA", peso: "12.1234", codigo_externo: null, observacoes: null };
const actor = (role = "GESTOR", empresas = [carrier]) => user(role, { empresas });
const dataOf = (config) => typeof config.data === "string" ? JSON.parse(config.data) : config.data;
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const writes = (calls) => calls.filter((call) => ["post", "patch"].includes(call.method));

function adapter({ tripData = trip, cargos = [cargo], boxes = [box], companies = [carrier, producer, client], writeStatus = 200, readStatus = 200, timeout = false } = {}) {
  const calls = [];
  let latestTrip = { ...tripData };
  api.defaults.adapter = async (config) => {
    const data = dataOf(config);
    calls.push({ method: config.method, url: config.url, params: config.params, data });
    if (config.method === "post" || config.method === "patch") {
      if (timeout) throw new AxiosError("Fixture timeout", "ECONNABORTED", config);
      let saved;
      if (config.url.includes("/viagens/") && !config.url.endsWith("/cargas")) { saved = { ...latestTrip, ...data }; if (writeStatus < 400) latestTrip = saved; }
      else if (config.url.endsWith("/caixas") || config.url.startsWith("/api/v1/caixas/")) saved = { ...box, ...data, id: config.method === "post" ? "box-new" : box.id };
      else saved = { ...cargo, ...data, id: config.method === "post" ? "cargo-new" : cargo.id };
      return reply(config, saved, writeStatus);
    }
    if (config.url === `/api/v1/viagens/${trip.id}`) return reply(config, latestTrip, readStatus);
    if (config.url === `/api/v1/viagens/${trip.id}/cargas`) return reply(config, cargos, readStatus);
    if (config.url === `/api/v1/cargas/${cargo.id}/caixas`) return reply(config, boxes, readStatus);
    if (config.url === `/api/v1/cargas/${cargo.id}/monitoramento`) return reply(config, {}, 404);
    if (config.url === "/api/v1/produtos") return reply(config, [product]);
    if (config.url === "/api/v1/empresas") return reply(config, companies);
    if (config.url === "/api/v1/viagens") return reply(config, [latestTrip]);
    return reply(config, { detail: "Unhandled local mock" }, 404);
  };
  return calls;
}

function cargoList(current = actor(), extra = {}) {
  render(<LogisticsRecords kind="cargas" parentId={trip.id} trip={trip} user={current} busy={false} onBusy={() => {}} {...extra} />);
}
async function openNewCargo() {
  await screen.findByText(cargo.identificacao); fireEvent.click(screen.getByRole("button", { name: "Nova carga" }));
  await screen.findByRole("option", { name: product.nome });
  await screen.findByRole("option", { name: producer.nome });
  fill("Produto da carga", product.id); fill("Produtor da carga", producer.id); fill("Cliente da carga", client.id); fill("Identificação da carga", "Nova carga DEMO");
}

describe("escopo de operação logística", () => {
  it.each(["ADMIN", "GESTOR", "OPERADOR"])("%s pode operar a viagem autorizada", async (role) => {
    adapter(); cargoList(actor(role)); await screen.findByText(cargo.identificacao);
    expect(screen.getByRole("button", { name: "Nova carga" })).toBeTruthy();
  });
  it.each(["CONSULTA", "GESTOR"])("%s não escreve em viagem de outra transportadora mesmo com empresa produtora vinculada", async (role) => {
    adapter(); cargoList(actor(role, [{ ...carrier, id: "other-carrier" }, producer]));
    await screen.findByText(cargo.identificacao);
    expect(screen.queryByRole("button", { name: "Nova carga" })).toBeNull();
    expect(screen.queryByRole("button", { name: `Editar ${cargo.identificacao}` })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `Caixas e monitoramento de ${cargo.identificacao}` }));
    expect(await screen.findByText(box.identificacao)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nova caixa" })).toBeNull();
  });
  it("conta inativa não recebe ações", () => {
    expect(canOperateTrip({ ...actor("ADMIN"), ativo: false }, trip)).toBe(false);
  });
  it("CONSULTA da própria transportadora continua somente leitura", async () => {
    adapter(); cargoList(actor("CONSULTA")); await screen.findByText(cargo.identificacao);
    expect(screen.queryByRole("button", { name: "Nova carga" })).toBeNull();
    expect(screen.queryByRole("button", { name: `Editar ${cargo.identificacao}` })).toBeNull();
  });
  it("página Cargas consulta a viagem e preserva a hierarquia", async () => {
    adapter(); render(<MemoryRouter><Cargas trips={[{ ...trip, code: "Viagem DEMO" }]} user={actor()} /></MemoryRouter>);
    expect(await screen.findByText(cargo.identificacao)).toBeTruthy();
    expect(screen.getByLabelText("Viagem das cargas").value).toBe(trip.id);
  });
});

describe("cadastro e edição de cargas", () => {
  it("cria carga com referências selecionadas e Decimal sem perda de precisão", async () => {
    const calls = adapter({ writeStatus: 201 }); cargoList(actor("ADMIN")); await openNewCargo();
    fill("Quantidade declarada de caixas", "0"); fill("Quantidade", "99999999,1234"); fill("Unidade da quantidade", "kg");
    fireEvent.click(screen.getByRole("button", { name: "Salvar carga" })); await screen.findByText("Carga salva com sucesso.");
    expect(writes(calls)[0]).toMatchObject({ method: "post", url: "/api/v1/viagens/trip-1/cargas", data: { identificacao: "Nova carga DEMO", produto_id: product.id, produtor_id: producer.id, cliente_id: client.id, quantidade: "99999999.1234", unidade: "kg", quantidade_caixas: 0 } });
    expect(writes(calls)[0].data).not.toHaveProperty("viagem_id"); expect(writes(calls)[0].data).not.toHaveProperty("status");
  });
  it("gestor sem produtor visível recebe orientação sem atalhos por IDs nem criação de vínculos", async () => {
    const calls = adapter({ companies: [carrier] }); cargoList();
    await screen.findByText(cargo.identificacao); fireEvent.click(screen.getByRole("button", { name: "Nova carga" }));
    await screen.findByRole("option", { name: product.nome });
    expect(await screen.findByText(/Nenhuma opção compatível nesta página de produtor/)).toBeTruthy();
    expect(screen.getByLabelText("Produtor da carga").tagName).toBe("SELECT");
    expect(screen.queryByRole("option", { name: producer.nome })).toBeNull();
    expect(writes(calls)).toHaveLength(0);
  });
  it("edita carga e inicia trânsito sem alterar produto, produtor, cliente ou viagem", async () => {
    const calls = adapter(); cargoList(); fireEvent.click(await screen.findByRole("button", { name: `Editar ${cargo.identificacao}` }));
    fill("Estado da carga", "EM_TRANSITO"); fireEvent.click(screen.getByRole("button", { name: "Salvar carga" })); await screen.findByText("Carga salva com sucesso.");
    const saved = writes(calls)[0]; expect(saved).toMatchObject({ url: "/api/v1/cargas/cargo-1", method: "patch", data: { status: "EM_TRANSITO", quantidade: "1000.1234" } });
    for (const field of ["viagem_id", "produto_id", "produtor_id", "cliente_id"]) expect(saved.data).not.toHaveProperty(field);
  });
  it("carga encerrada permite somente observações", async () => {
    const delivered = { ...cargo, status: "ENTREGUE" }; const calls = adapter({ cargos: [delivered] });
    cargoList(); fireEvent.click(await screen.findByRole("button", { name: `Editar ${cargo.identificacao}` }));
    expect(screen.getByLabelText("Identificação da carga").disabled).toBe(true);
    fill("Observações", "Conferência da entrega"); fireEvent.click(screen.getByRole("button", { name: "Salvar carga" })); await screen.findByText("Carga salva com sucesso.");
    expect(writes(calls)[0].data).toEqual({ observacoes: "Conferência da entrega" });
  });
  it.each([["PLANEJADA", "CANCELADA"], ["EM_TRANSITO", "ENTREGUE"]])("transição %s → %s não altera caixas nem sessões", async (previous, target) => {
    const calls = adapter({ cargos: [{ ...cargo, status: previous }] }); cargoList();
    fireEvent.click(await screen.findByRole("button", { name: `Editar ${cargo.identificacao}` }));
    fill("Estado da carga", target); fireEvent.click(screen.getByRole("button", { name: "Salvar carga" })); await screen.findByText("Carga salva com sucesso.");
    expect(writes(calls)).toHaveLength(1); expect(writes(calls)[0]).toMatchObject({ url: "/api/v1/cargas/cargo-1", data: { status: target } });
  });
  it("quantidade sem unidade não dispara gravação", async () => {
    const calls = adapter(); cargoList(); await openNewCargo(); fill("Quantidade", "10");
    fireEvent.click(screen.getByRole("button", { name: "Salvar carga" }));
    expect(screen.getByRole("alert").textContent).toMatch(/juntas/); expect(writes(calls)).toHaveLength(0);
  });
  it("campos vazios não viram produção, peso ou quantidade zero", () => {
    const result = logisticsPayload("cargas", { identificacao: "Teste", produto_id: product.id, produtor_id: producer.id }, null, trip);
    expect(result.quantidade).toBeNull(); expect(result.quantidade_caixas).toBeNull(); expect(result.cliente_id).toBeNull();
  });
  it("viagem concluída não oferece nova carga", async () => {
    adapter(); cargoList(actor(), { trip: { ...trip, status: "CONCLUIDA" } }); await screen.findByText(cargo.identificacao);
    expect(screen.queryByRole("button", { name: "Nova carga" })).toBeNull();
  });
  it.each([403, 409, 422])("HTTP %s não encerra formulário nem apresenta sucesso", async (writeStatus) => {
    adapter({ writeStatus }); cargoList(); await openNewCargo(); fireEvent.click(screen.getByRole("button", { name: "Salvar carga" }));
    expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.getByRole("form", { name: "Cadastrar carga" })).toBeTruthy();
    expect(screen.queryByText("Carga salva com sucesso.")).toBeNull();
  });
});

describe("caixas, estados e preservação de histórico", () => {
  async function openBoxes() {
    await screen.findByText(cargo.identificacao); fireEvent.click(screen.getByRole("button", { name: `Caixas e monitoramento de ${cargo.identificacao}` }));
    await screen.findByText(box.identificacao);
  }
  it("cria caixa no caminho da carga sem transferir o pai", async () => {
    const calls = adapter({ writeStatus: 201 }); cargoList(); await openBoxes(); fireEvent.click(screen.getByRole("button", { name: "Nova caixa" }));
    fill("Identificação da caixa", "Nova caixa DEMO"); fill("Peso", "12,3456");
    fireEvent.click(screen.getByRole("button", { name: "Salvar caixa" })); await screen.findByText("Caixa salva com sucesso.");
    expect(writes(calls)[0]).toMatchObject({ method: "post", url: "/api/v1/cargas/cargo-1/caixas", data: { identificacao: "Nova caixa DEMO", peso: "12.3456", codigo_externo: null } });
    expect(writes(calls)[0].data).not.toHaveProperty("carga_id"); expect(calls.some((call) => call.method === "delete")).toBe(false);
  });
  it("caixa só entra em trânsito quando a carga está em trânsito", async () => {
    const calls = adapter({ cargos: [{ ...cargo, status: "EM_TRANSITO" }] }); cargoList(); await openBoxes();
    fireEvent.click(screen.getByRole("button", { name: `Editar ${box.identificacao}` })); fill("Estado da caixa", "EM_TRANSITO");
    fireEvent.click(screen.getByRole("button", { name: "Salvar caixa" })); await screen.findByText("Caixa salva com sucesso.");
    expect(writes(calls)[0]).toMatchObject({ url: "/api/v1/caixas/box-1", data: { status: "EM_TRANSITO" } });
  });
  it("caixa entregue mantém identificação e peso, alterando somente observações", async () => {
    const calls = adapter({ boxes: [{ ...box, status: "ENTREGUE" }] }); cargoList(); await openBoxes();
    fireEvent.click(screen.getByRole("button", { name: `Editar ${box.identificacao}` }));
    expect(screen.getByLabelText("Peso").disabled).toBe(true); fill("Observações", "Histórico preservado");
    fireEvent.click(screen.getByRole("button", { name: "Salvar caixa" })); await screen.findByText("Caixa salva com sucesso.");
    expect(writes(calls)[0].data).toEqual({ observacoes: "Histórico preservado" });
  });
  it("não oferece caixa nova em carga entregue", async () => {
    adapter({ cargos: [{ ...cargo, status: "ENTREGUE" }] }); cargoList(); await openBoxes(); expect(screen.queryByRole("button", { name: "Nova caixa" })).toBeNull();
  });
  it("lista caixas e mostra ausência de declaração sem converter em zero", async () => {
    adapter(); cargoList(); await openBoxes(); expect(await screen.findByText(/Ausência de declaração não significa produção zero/)).toBeTruthy();
  });
  it("rejeita transições incompatíveis antes do envio", () => {
    expect(nextStates("cargas", cargo, { ...trip, status: "PLANEJADA" })).toEqual(["CANCELADA"]);
    expect(nextStates("caixas", box, trip, cargo)).toEqual(["AVARIADA"]);
    expect(() => logisticsPayload("caixas", { ...box, status: "EM_TRANSITO" }, box, trip, cargo)).toThrow(/Transição/);
  });
});

describe("operação da viagem", () => {
  it("inicia viagem com data explícita e sem atualizar cargas automaticamente", async () => {
    const planned = { ...trip, status: "PLANEJADA", inicio_real: null }; const calls = adapter({ tripData: planned });
    render(<TripOperations user={actor()} trip={planned} onSaved={() => {}} />);
    await screen.findByLabelText("Estado da viagem"); fill("Estado da viagem", "EM_ANDAMENTO"); fill("Início real da viagem", "2026-11-24T09:30");
    fireEvent.click(screen.getByRole("button", { name: "Salvar viagem" })); await screen.findByText("Viagem atualizada.");
    expect(writes(calls)).toHaveLength(1); expect(writes(calls)[0]).toMatchObject({ url: "/api/v1/viagens/trip-1", data: { status: "EM_ANDAMENTO", inicio_real: new Date("2026-11-24T09:30").toISOString() } });
  });
  it("conclui viagem com chegada real, preservando início existente", async () => {
    const calls = adapter(); render(<TripOperations user={actor()} trip={trip} onSaved={() => {}} />);
    await screen.findByLabelText("Estado da viagem"); fill("Estado da viagem", "CONCLUIDA"); fill("Chegada real da viagem", "2026-11-25T09:30");
    fireEvent.click(screen.getByRole("button", { name: "Salvar viagem" })); await screen.findByText("Viagem atualizada.");
    expect(writes(calls)[0].data).not.toHaveProperty("inicio_real"); expect(writes(calls)[0].data.status).toBe("CONCLUIDA");
  });
  it("cancela apenas viagem planejada", () => {
    expect(tripPayload({ ...trip, status: "PLANEJADA", inicio_real: null }, { status: "CANCELADA" })).toEqual({ status: "CANCELADA", observacoes: null });
    expect(() => tripPayload(trip, { status: "CANCELADA" })).toThrow(/Transição/);
  });
  it("início ausente ou chegada anterior não gera horário inventado", () => {
    expect(() => tripPayload({ ...trip, status: "PLANEJADA", inicio_real: null }, { status: "EM_ANDAMENTO" })).toThrow(/início real/);
    expect(() => tripPayload(trip, { status: "CONCLUIDA", chegada_em: "2026-01-01T01:00" })).toThrow(/anterior/);
  });
  it("usuário somente produtor não recebe operação de viagem", () => {
    const calls = adapter(); render(<TripOperations user={actor("GESTOR", [producer])} trip={trip} />); expect(calls).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Salvar viagem" })).toBeNull();
  });
  it("adaptador preserva estado canônico e referências da viagem", async () => {
    adapter(); const result = await listarViagens(); expect(result[0]).toMatchObject({ transportadora_id: carrier.id, statusApi: "EM_ANDAMENTO", status: "in_transit" });
  });
});

describe("paginação, falhas e contexto", () => {
  it("busca preservada filtra apenas a página atual", async () => {
    adapter(); cargoList(); await screen.findByText(cargo.identificacao);
    fill("Buscar cargas nesta página", "outra identificação");
    expect(screen.queryByText(cargo.identificacao)).toBeNull(); expect(screen.getByText(/Nenhum resultado nesta página/)).toBeTruthy();
    fill("Buscar cargas nesta página", "carga demo"); expect(screen.getByText(cargo.identificacao)).toBeTruthy();
  });
  it("troca de viagem descarta uma resposta tardia do contexto anterior", async () => {
    adapter(); const previous = api.defaults.adapter;
    const secondTrip = { ...trip, id: "trip-2", origem: "Outra origem" };
    let release;
    api.defaults.adapter = async (config) => {
      if (config.url === `/api/v1/viagens/${trip.id}/cargas`) return new Promise((resolve) => { release = () => resolve(reply(config, [cargo])); });
      if (config.url === "/api/v1/viagens/trip-2") return reply(config, secondTrip);
      if (config.url === "/api/v1/viagens/trip-2/cargas") return reply(config, [{ ...cargo, id: "cargo-2", viagem_id: secondTrip.id, identificacao: "Carga da segunda viagem" }]);
      return previous(config);
    };
    render(<MemoryRouter><Cargas trips={[trip, secondTrip]} user={actor()} /></MemoryRouter>);
    await waitFor(() => expect(release).toBeTypeOf("function")); fill("Viagem das cargas", secondTrip.id);
    expect(await screen.findByText("Carga da segunda viagem")).toBeTruthy();
    await act(async () => release());
    expect(screen.queryByText(cargo.identificacao)).toBeNull(); expect(screen.getByText("Carga da segunda viagem")).toBeTruthy();
  });
  it("pagina cargas sem tratar a primeira página como lista completa", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({ ...cargo, id: `cargo-${i}`, identificacao: `Carga ${i}` }));
    const calls = adapter({ cargos: rows }); cargoList(); await screen.findByText("Carga 0");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(21); expect(screen.queryByText("Carga 20")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(calls.at(-1).params).toEqual({ limit: 21, offset: 20 }));
  });
  it("resposta de outro pai é rejeitada", async () => {
    adapter({ cargos: [{ ...cargo, viagem_id: "other-trip" }] }); await expect(readLogistics("cargas", trip.id)).rejects.toThrow(/contexto/);
  });
  it("403 de consulta não vira lista vazia", async () => {
    adapter({ readStatus: 403 }); cargoList(); expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.queryByText("Nenhum registro nesta página.")).toBeNull();
  });
  it("timeout não repete automaticamente a criação", async () => {
    const calls = adapter({ timeout: true }); cargoList(); await openNewCargo(); fireEvent.click(screen.getByRole("button", { name: "Salvar carga" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/antes de reenviar/); expect(writes(calls)).toHaveLength(1);
  });
  it("envio duplo é bloqueado", async () => {
    const calls = adapter(); const previous = api.defaults.adapter; let confirm;
    api.defaults.adapter = async (config) => config.method === "post" ? new Promise((resolve) => { calls.push({ method: "post" }); confirm = () => resolve(reply(config, { ...cargo, id: "new" }, 201)); }) : previous(config);
    const onBusy = vi.fn(); cargoList(actor(), { onBusy }); await openNewCargo();
    const form = screen.getByRole("form", { name: "Cadastrar carga" }); fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(writes(calls)).toHaveLength(1)); expect(onBusy).toHaveBeenCalledWith(true);
    await act(async () => confirm()); await screen.findByText("Carga salva com sucesso."); expect(onBusy).toHaveBeenLastCalledWith(false);
  });
});
