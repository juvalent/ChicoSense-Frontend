import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import api from "../src/services/api";
import { reply, user } from "./helpers";
import { capabilities } from "../src/services/capabilities";
import { obterMonitoramentoCarga } from "../src/services/cargaService";
import { listarAlertasSessao } from "../src/services/alertaService";
import { loadSessionPage } from "../src/services/sessionReadings";
import CargoDeclaration from "../src/components/Cards/CargoDeclaration";
import SessionReadingsPanel from "../src/components/Cards/SessionReadingsPanel";
import Viagens from "../src/pages/Viagens/Viagens";
import Etileno from "../src/pages/Etileno/Etileno";

const carrier = { id: "carrier-1", ativo: true, tipo: "TRANSPORTADORA" };
const trip = { id: "trip-1", code: "DEMO trip", origin: "Origem", destination: "Destino" };
const session = { id: "session-1", viagem_id: trip.id, carga_id: "cargo-1", lote_codigo: "DEMO", estado: "ATIVA", ambiente_aquisicao: "LABORATORIO", lote_hipotetico: true };
function readings(offset, limit) {
  return { sessao_id: session.id, revisao: 3, total: 1000, offset, limit,
    leituras: [{ id: "reading", tipo: "TEMPERATURA", valor: "13.0000", estado: "VALIDA", medida_em: "2026-11-24T12:00:00Z" }] };
}

describe("permissões por papel e vínculo", () => {
  it.each([
    ["ADMIN", [], true, true],
    ["GESTOR", [carrier], true, true],
    ["OPERADOR", [carrier], true, false],
    ["CONSULTA", [carrier], false, false],
    ["GESTOR", [], false, false],
    ["GESTOR", [{ ...carrier, ativo: false }], false, false],
    ["GESTOR", [{ ...carrier, tipo: "PRODUTOR" }], false, false],
    ["CONSULTA", [{ ...carrier, tipo: "CLIENTE" }], false, false],
  ])("%s com vínculos %j", (role, empresas, operate, fleet) => {
    const actor = user(role, { empresas });
    expect(capabilities(actor).operate).toBe(operate);
    expect(capabilities(actor).manageFleet).toBe(fleet);
    render(<MemoryRouter><Viagens user={actor} /></MemoryRouter>);
    expect(Boolean(screen.queryByRole("button", { name: /Nova viagem/ }))).toBe(operate);
  });
  it("usuário inativo não recebe ações nem quando é ADMIN", () => {
    expect(capabilities(user("ADMIN", { ativo: false })).operate).toBe(false);
  });
  it("CONSULTA não recebe botão de nova análise", () => {
    render(<Etileno user={user("CONSULTA", { empresas: [carrier] })} />);
    expect(screen.queryByRole("button", { name: /Nova análise/ })).toBeNull();
  });
});

describe("contratos oficiais da carga e dos alertas", () => {
  it("preserva os dados científicos e rastreabilidade da declaração", async () => {
    const declaration = { massa_kg: "1000.1234", maturacao: "DESCONHECIDA", produto_identificado: "MANGA_TOMMY_ATKINS", lote_codigo: "DEMO-01", lote_hipotetico: true, rastreabilidade: "Dados sintéticos de teste", versao: 2 };
    api.defaults.adapter = async (config) => reply(config, declaration);
    const result = await obterMonitoramentoCarga("cargo-1");
    expect(result).toEqual(declaration);
    render(<CargoDeclaration declaration={result} />);
    expect(screen.getByText("1000.1234")).toBeTruthy();
    expect(screen.getByText("DESCONHECIDA")).toBeTruthy();
    expect(screen.getByText("Dados sintéticos de teste")).toBeTruthy();
    expect(screen.getByText("Sim")).toBeTruthy();
  });
  it("404 significa declaração ausente; 403 permanece erro de autorização", async () => {
    api.defaults.adapter = async (config) => reply(config, {}, 404);
    expect(await obterMonitoramentoCarga("cargo-1")).toBeNull();
    api.defaults.adapter = async (config) => reply(config, {}, 403);
    await expect(obterMonitoramentoCarga("cargo-1")).rejects.toMatchObject({ response: { status: 403 } });
  });
  it("mapeia nível, instante e os quatro estados sem confundir resolução com normalização", async () => {
    api.defaults.adapter = async (config) => reply(config, { alertas: ["ABERTO", "EM_ANALISE", "RESOLVIDO", "DESCARTADO"].map((status, i) => ({ id: String(i), status, nivel: "ATENCAO", iniciado_em: "2026-11-24T12:00:00Z", tipo: "TEMPERATURA_FORA_DA_FAIXA" })) });
    const alerts = await listarAlertasSessao("session-1");
    expect(alerts.map((a) => a.status)).toEqual(["new", "monitoring", "resolved", "discarded"]);
    expect(alerts[2].statusApi).toBe("RESOLVIDO");
    expect(alerts[0].severity).toBe("warning");
    expect(alerts[0].timestamp).toBe("2026-11-24T12:00:00Z");
  });
});

describe("leituras por sessão, revisão e página", () => {
  it("consulta a última página das 1000 leituras e fixa a revisão", async () => {
    const calls = [];
    api.defaults.adapter = async (config) => { calls.push(config.params); return reply(config, readings(config.params.offset, config.params.limit)); };
    await loadSessionPage(session.id);
    expect(calls).toEqual([{ limit: 1, offset: 0 }, { limit: 100, offset: 900, revisao: 3 }]);
  });
  it("sem sessão não transforma ausência de contexto em consulta bem-sucedida", async () => {
    const adapter = vi.fn(); api.defaults.adapter = adapter;
    await expect(loadSessionPage()).rejects.toThrow(/Selecione/);
    expect(adapter).not.toHaveBeenCalled();
  });
  it("não pagina sem uma revisão de aquisição válida", async () => {
    const adapter = vi.fn(async (config) => reply(config, { total: 1000, leituras: [] }));
    api.defaults.adapter = adapter;
    await expect(loadSessionPage(session.id)).rejects.toThrow(/revisão válidos/);
    expect(adapter).toHaveBeenCalledTimes(1);
  });
  it("exige seleção e navega entre páginas na mesma revisão", async () => {
    const calls = [];
    api.defaults.adapter = async (config) => {
      calls.push({ url: config.url, params: config.params });
      if (config.url.endsWith("/monitoramentos")) return reply(config, [session]);
      return reply(config, readings(config.params.offset, config.params.limit));
    };
    render(<SessionReadingsPanel trips={[trip]} />);
    expect(calls).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Viagem das leituras"), { target: { value: trip.id } });
    await screen.findByRole("option", { name: "DEMO · ATIVA" });
    fireEvent.change(screen.getByLabelText("Sessão das leituras"), { target: { value: session.id } });
    expect(await screen.findByText(/Registros 901–901 de 1000/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Leituras anteriores" }));
    await waitFor(() => expect(calls.at(-1).params).toMatchObject({ offset: 800, revisao: 3 }));
    fireEvent.change(screen.getByLabelText("Viagem das leituras"), { target: { value: "" } });
    expect(screen.queryByText(/Registros/)).toBeNull();
  });
  it("falha de autorização é exibida e não vira lista vazia ou sucesso", async () => {
    api.defaults.adapter = async (config) => config.url.endsWith("/monitoramentos") ? reply(config, [session]) : reply(config, {}, 403);
    render(<SessionReadingsPanel trips={[trip]} />);
    fireEvent.change(screen.getByLabelText("Viagem das leituras"), { target: { value: trip.id } });
    await screen.findByRole("option", { name: "DEMO · ATIVA" });
    fireEvent.change(screen.getByLabelText("Sessão das leituras"), { target: { value: session.id } });
    expect((await screen.findByRole("alert")).textContent).toMatch(/Sem permissão/);
  });
});
