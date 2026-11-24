import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import CargoMonitoringPanel from "../src/components/Monitoring/CargoMonitoringPanel";
import Monitoramento from "../src/pages/Monitoramento/Monitoramento";
import { declarationPayload, endSessionPayload, inspectSessionHistory, readSessionPage, startSessionPayload } from "../src/services/monitoringLifecycleService";
import api from "../src/services/api";
import { reply, user } from "./helpers";

const minute = Math.floor(Date.now() / 60000) * 60000;
const iso = (minutesAgo) => new Date(minute - minutesAgo * 60000).toISOString();
const localInput = (minutesAgo) => { const d = new Date(minute - minutesAgo * 60000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const company = { id: "carrier-1", ativo: true, tipo: "TRANSPORTADORA" };
const trip = { id: "trip-1", transportadora_id: company.id, status: "EM_ANDAMENTO", inicio_real: iso(240), chegada_em: null };
const cargo = { id: "cargo-1", viagem_id: trip.id, identificacao: "Carga DEMO", status: "EM_TRANSITO", quantidade: "9999", unidade: "kg" };
const declaration = { id: "declaration-1", carga_id: cargo.id, produto_identificado: "MANGA_TOMMY_ATKINS", massa_kg: "1000.1234", maturacao: "DESCONHECIDA", lote_codigo: "DEMO-01", lote_hipotetico: true, rastreabilidade: "Origem sintética declarada", versao: 2 };
const actor = (role = "GESTOR", empresas = [company]) => user(role, { empresas });
const sensorOrigin = {
  temperatura: { sensor_id: "sensor-temperature", identificador: "Temperatura DEMO", tipo: "TEMPERATURA", contexto: "AMBIENTE", unidade: "C" },
  umidade: { sensor_id: "sensor-humidity", identificador: "Umidade DEMO", tipo: "UMIDADE", contexto: "AMBIENTE", unidade: "%" },
};
const session = { ...declaration, id: "old-1", carga_id: cargo.id, viagem_id: trip.id, inicio: iso(180), fim: iso(120), estado: "ENCERRADA", configuracao_versao: 1, massa_kg: "900.0000", lote_codigo: "LOTE-SNAPSHOT", ambiente_aquisicao: "LABORATORIO", sensor_temperatura_id: "sensor-temperature", sensor_umidade_id: "sensor-humidity", origem_sensor: sensorOrigin, chave_idempotencia: "old-key", criada_por_id: actor().id, motivo_fim: "Fim da coleta anterior" };
const active = { ...session, id: "active-1", estado: "ATIVA", fim: null, motivo_fim: null };
const values = { ...declaration, lote_hipotetico: "true" };
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const body = (config) => typeof config.data === "string" ? JSON.parse(config.data) : config.data;
const writes = (calls) => calls.filter((call) => ["post", "put"].includes(call.method));

function adapter({ configured = declaration, sessions = [session], writeStatus = 200, readStatus = 200, failFirst = false, commitOnTimeout = false } = {}) {
  const calls = [];
  let currentDeclaration = configured;
  const history = sessions.map((s) => ({ ...s }));
  let failed = false;
  api.defaults.adapter = async (config) => {
    const payload = body(config);
    calls.push({ method: config.method, url: config.url, params: config.params, data: payload });
    if (["post", "put"].includes(config.method)) {
      if (writeStatus >= 400) return reply(config, { detail: "Controlled rejection" }, writeStatus);
      const timeout = failFirst && !failed;
      if (timeout) failed = true;
      let result;
      if (!timeout || commitOnTimeout) {
        if (config.method === "put") result = currentDeclaration = { ...declaration, ...payload, versao: 3 };
        else if (config.url.endsWith("/monitoramentos")) {
          result = history.find((s) => s.chave_idempotencia === payload.chave_idempotencia);
          if (!result) { result = { ...session, ...currentDeclaration, ...payload, id: "new-1", estado: "ATIVA", fim: null, motivo_fim: null, configuracao_versao: currentDeclaration.versao, origem_sensor: sensorOrigin }; history.push(result); }
        } else {
          const id = config.url.split("/").at(-2);
          const index = history.findIndex((s) => s.id === id);
          result = { ...history[index], ...payload, motivo_fim: payload.motivo, estado: config.url.endsWith("/encerrar") ? "ENCERRADA" : "CANCELADA" };
          history[index] = result;
        }
      }
      if (timeout) throw new AxiosError("Fixture timeout", "ECONNABORTED", config);
      return reply(config, result, writeStatus);
    }
    if (config.url === `/api/v1/cargas/${cargo.id}/monitoramento`) return reply(config, currentDeclaration || {}, currentDeclaration ? readStatus : 404);
    if (config.url === `/api/v1/cargas/${cargo.id}/monitoramentos`) return reply(config, history.slice(config.params.offset, config.params.offset + config.params.limit), readStatus);
    if (config.url.startsWith("/api/v1/monitoramentos/")) {
      const found = history.find((s) => s.id === config.url.split("/").at(-1));
      return reply(config, found || {}, found ? readStatus : 404);
    }
    if (config.url === `/api/v1/viagens/${trip.id}/cargas`) return reply(config, [cargo]);
    if (config.url === `/api/v1/viagens/${trip.id}`) return reply(config, trip);
    if (config.url === `/api/v1/cargas/${cargo.id}`) return reply(config, cargo);
    return reply(config, { detail: "Unhandled local mock" }, 404);
  };
  return { calls, history };
}

function Harness({ currentUser = actor(), currentCargo = cargo, currentTrip = trip }) {
  const [busy, setBusy] = useState(false);
  return <CargoMonitoringPanel user={currentUser} cargo={currentCargo} trip={currentTrip} busy={busy} onBusy={setBusy} />;
}
async function startForm() {
  fireEvent.click(await screen.findByRole("button", { name: "Iniciar sessão" }));
  await screen.findByRole("option", { name: "Temperatura DEMO · C" });
  fill("Início efetivo da sessão", localInput(60)); fill("Ambiente de aquisição", "LABORATORIO");
  fill("Sensor de temperatura da sessão", "sensor-temperature"); fill("Sensor de umidade da sessão", "sensor-humidity");
}
async function endForm(action = "Encerrar sessão") {
  fireEvent.click(await screen.findByRole("button", { name: "Consultar sessão active-1" }));
  fireEvent.click(await screen.findByRole("button", { name: action }));
  fill("Fim efetivo da sessão", localInput(30)); fill("Motivo da finalização", "Finalização explícita de teste");
}

describe("declaração científica explícita", () => {
  it("declara massa Decimal e maturação desconhecida sem inferir quantidade logística", async () => {
    const { calls } = adapter({ configured: null, sessions: [] }); render(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: "Declarar monitoramento" }));
    expect(screen.getByLabelText("Massa líquida para monitoramento (kg)").value).toBe("");
    fill("Produto declarado", "MANGA_TOMMY_ATKINS"); fill("Massa líquida para monitoramento (kg)", "1000,1234"); fill("Código do lote", "NOVO-LOTE"); fill("O lote é hipotético?", "false"); fill("Rastreabilidade da carga", "Rastreio informado manualmente");
    fireEvent.click(screen.getByRole("button", { name: "Salvar declaração" }));
    await screen.findByText("Declaração confirmada.");
    expect(writes(calls)[0]).toMatchObject({ method: "put", url: "/api/v1/cargas/cargo-1/monitoramento", data: { produto_identificado: "MANGA_TOMMY_ATKINS", massa_kg: "1000.1234", maturacao: "DESCONHECIDA", lote_codigo: "NOVO-LOTE", lote_hipotetico: false, rastreabilidade: "Rastreio informado manualmente" } });
    expect(writes(calls)[0].data).not.toHaveProperty("quantidade");
  });
  it.each(["", "0", "-1", "NaN", "Infinity", "100000000", "1.00001"])("recusa massa inválida %s", (mass) => {
    expect(() => declarationPayload({ ...values, massa_kg: mass })).toThrow(/massa/);
  });
  it("natureza hipotética e identidade da cultivar exigem confirmação", () => {
    expect(() => declarationPayload({ ...values, lote_hipotetico: "" })).toThrow(/hipotético/);
    expect(() => declarationPayload({ ...values, produto_identificado: "OUTRA_MANGA" })).toThrow(/Tommy/);
  });
  it.each([403, 409, 422])("HTTP %s preserva rascunho sem sucesso fictício", async (writeStatus) => {
    adapter({ writeStatus }); render(<Harness />); fireEvent.click(await screen.findByRole("button", { name: "Editar declaração" }));
    fill("Código do lote", "REVISAR"); fireEvent.click(screen.getByRole("button", { name: "Salvar declaração" }));
    expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.getByLabelText("Código do lote").value).toBe("REVISAR"); expect(screen.queryByText("Declaração confirmada.")).toBeNull();
  });
  it("sessão ativa conhecida bloqueia edição e novo início", async () => {
    adapter({ sessions: [active] }); render(<Harness />); await screen.findByText(/Há sessão ativa nesta página/);
    expect(screen.queryByRole("button", { name: "Editar declaração" })).toBeNull(); expect(screen.queryByRole("button", { name: "Iniciar sessão" })).toBeNull();
  });
  it("timeout de PUT só permite repetição manual do mesmo conteúdo", async () => {
    const { calls } = adapter({ failFirst: true }); render(<Harness />); fireEvent.click(await screen.findByRole("button", { name: "Editar declaração" }));
    fill("Código do lote", "PUT-REPLAY"); fireEvent.click(screen.getByRole("button", { name: "Salvar declaração" })); await screen.findByRole("alert");
    expect(screen.getByLabelText("Código do lote").disabled).toBe(true); expect(writes(calls)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Reenviar mesma declaração" })); await screen.findByText("Declaração confirmada.");
    expect(writes(calls)[1].data).toEqual(writes(calls)[0].data);
  });
});

describe("perfis, escopo e snapshots", () => {
  it.each(["CONSULTA", "GESTOR"])("%s sem transportadora da viagem só consulta", async (role) => {
    adapter(); render(<Harness currentUser={actor(role, [{ ...company, id: "other-carrier" }, { id: "producer-1", tipo: "PRODUTOR", ativo: true }])} />);
    await screen.findByRole("button", { name: "Consultar sessão old-1" });
    expect(screen.queryByRole("button", { name: "Editar declaração" })).toBeNull(); expect(screen.queryByRole("button", { name: "Iniciar sessão" })).toBeNull();
  });
  it("CONSULTA da própria transportadora também não escreve", async () => {
    adapter(); render(<Harness currentUser={actor("CONSULTA")} />); await screen.findByText("1000.1234");
    expect(screen.queryByRole("button", { name: "Editar declaração" })).toBeNull();
  });
  it("snapshot da sessão preserva massa anterior e sua versão", async () => {
    adapter(); render(<Harness />); fireEvent.click(await screen.findByRole("button", { name: "Consultar sessão old-1" }));
    expect(await screen.findByText("900.0000")).toBeTruthy(); expect(screen.getByText("1000.1234")).toBeTruthy();
    expect(screen.getAllByText("LOTE-SNAPSHOT").length).toBeGreaterThan(0); expect(screen.queryByRole("button", { name: "Encerrar sessão" })).toBeNull();
  });
  it("sessão de outra carga não é usada como referência de sensores", async () => {
    adapter({ sessions: [{ ...session, carga_id: "foreign-cargo" }] });
    await expect(inspectSessionHistory(cargo.id, trip.id)).rejects.toThrow(/incompatíveis/);
  });
  it("403 de consulta não vira ausência de declaração ou zero", async () => {
    adapter({ readStatus: 403 }); render(<Harness />); expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Declarar monitoramento" })).toBeNull();
  });
  it("Monitoramento respeita a navegação vinda de Cargas", async () => {
    adapter(); render(<MemoryRouter initialEntries={[{ pathname: "/monitoramento", state: { tripId: trip.id, loadId: cargo.id } }]}><Monitoramento user={actor()} trips={[{ ...trip, statusApi: trip.status, status: "in_transit" }]} /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "Editar declaração" })).toBeTruthy();
  });
});

describe("início de sessão com sensores do histórico autorizado", () => {
  it("inicia com chave idempotente, início explícito e sensores selecionados", async () => {
    const { calls } = adapter({ writeStatus: 201 }); render(<Harness />); await startForm();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar início da sessão" })); await screen.findByText("Sessão confirmada.");
    expect(writes(calls)).toHaveLength(1); expect(writes(calls)[0]).toMatchObject({ url: "/api/v1/cargas/cargo-1/monitoramentos", data: { inicio: new Date(localInput(60)).toISOString(), ambiente_aquisicao: "LABORATORIO", sensor_temperatura_id: "sensor-temperature", sensor_umidade_id: "sensor-humidity" } });
    expect(writes(calls)[0].data.chave_idempotencia).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls.some((call) => call.url.includes("sincronizacoes") || call.url.includes("thingspeak"))).toBe(false);
  });
  it("primeira sessão fica explicitamente bloqueada sem catálogo de sensores", async () => {
    const { calls } = adapter({ sessions: [] }); render(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: "Iniciar sessão" })); await screen.findByText(/Não há sensores selecionáveis/);
    expect(screen.getByRole("button", { name: "Confirmar início da sessão" }).disabled).toBe(true); expect(writes(calls)).toHaveLength(0);
    expect(screen.getByLabelText("Sensor de temperatura da sessão").tagName).toBe("SELECT");
  });
  it("histórico não presume que um sensor está ativo ou cria sensores novos", async () => {
    const { calls } = adapter(); render(<Harness />); await startForm();
    expect(calls.every((call) => !call.url.includes("/sensores") && !call.url.includes("/dispositivos"))).toBe(true);
    expect(screen.getByText(/O servidor validará vínculo, tipo, unidade, estado atual/)).toBeTruthy();
  });
  it("protótipo do histórico não é oferecido para transporte refrigerado", async () => {
    adapter({ sessions: [{ ...session, origem_sensor: { ...sensorOrigin, temperatura: { ...sensorOrigin.temperatura, contexto: "PROTOTIPO" } } }] }); render(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: "Iniciar sessão" })); await screen.findByRole("option", { name: "Temperatura DEMO · C" });
    fill("Ambiente de aquisição", "TRANSPORTE_REFRIGERADO"); expect(screen.queryByRole("option", { name: "Temperatura DEMO · C" })).toBeNull(); expect(screen.getByRole("button", { name: "Confirmar início da sessão" }).disabled).toBe(true);
  });
  it("não inventa início, não aceita futuro ou início anterior à viagem", () => {
    const v = { inicio: localInput(60), ambiente_aquisicao: "LABORATORIO", sensor_temperatura_id: "sensor-temperature" };
    expect(() => startSessionPayload({ ...v, inicio: "" }, trip, cargo, "key")).toThrow(/início efetivo/);
    expect(() => startSessionPayload({ ...v, inicio: localInput(-60) }, trip, cargo, "key")).toThrow(/futuro/);
    expect(() => startSessionPayload({ ...v, inicio: localInput(300) }, trip, cargo, "key")).toThrow(/início real/);
    expect(() => startSessionPayload(v, { ...trip, status: "PLANEJADA" }, cargo, "key")).toThrow(/andamento/);
  });
  it("timeout preserva chave e conteúdo mesmo fechando e reabrindo formulário", async () => {
    const { calls } = adapter({ failFirst: true }); render(<Harness />); await startForm();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar início da sessão" })); await screen.findByRole("alert");
    expect(writes(calls)).toHaveLength(1); expect(screen.getByLabelText("Início efetivo da sessão").disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Fechar início" })); fireEvent.click(screen.getByRole("button", { name: "Iniciar sessão" }));
    await screen.findByRole("option", { name: "Temperatura DEMO · C" });
    fireEvent.click(screen.getByRole("button", { name: "Reenviar mesma solicitação" })); await screen.findByText("Sessão confirmada.");
    expect(writes(calls)).toHaveLength(2); expect(writes(calls)[1].data).toEqual(writes(calls)[0].data);
  });
  it("consulta identifica início já confirmado após timeout, sem novo POST", async () => {
    const { calls } = adapter({ failFirst: true, commitOnTimeout: true }); render(<Harness />); await startForm();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar início da sessão" })); await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Conferir sessões existentes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Consultar sessão confirmada" }));
    await screen.findByText("Sessão confirmada."); expect(writes(calls)).toHaveLength(1);
  });
  it("sessão ativa em outra página do histórico bloqueia novo POST", async () => {
    const history = [...Array.from({ length: 21 }, (_, i) => ({ ...session, id: `old-${i}` })), active];
    const { calls } = adapter({ sessions: history }); render(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: "Iniciar sessão" })); await screen.findByText(/Há uma sessão ativa nesta carga/);
    expect(screen.getByRole("button", { name: "Confirmar início da sessão" }).disabled).toBe(true); expect(writes(calls)).toHaveLength(0);
  });
});

describe("finalização explícita e imutável", () => {
  it.each([["Encerrar sessão", "encerrar", "ENCERRADA"], ["Cancelar sessão", "cancelar", "CANCELADA"]])("%s envia fim e motivo e preserva registros", async (label, suffix, state) => {
    const { calls } = adapter({ sessions: [active] }); render(<Harness />); await endForm(label);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar finalização" })); await screen.findByText("Finalização confirmada.");
    expect(writes(calls)[0]).toMatchObject({ url: `/api/v1/monitoramentos/active-1/${suffix}`, data: { fim: new Date(localInput(30)).toISOString(), motivo: "Finalização explícita de teste" } });
    await screen.findByText(`Estado: ${state} · Ambiente: LABORATORIO`); expect(calls.some((call) => call.method === "delete")).toBe(false);
  });
  it("viagem concluída ainda permite finalizar sessão ativa dentro da janela", async () => {
    adapter({ sessions: [active] }); render(<Harness currentTrip={{ ...trip, status: "CONCLUIDA", chegada_em: iso(10) }} />); await endForm();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar finalização" })); await screen.findByText("Finalização confirmada.");
  });
  it("viagem cancelada oferece somente cancelamento da sessão", async () => {
    adapter({ sessions: [active] }); render(<Harness currentTrip={{ ...trip, status: "CANCELADA" }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Consultar sessão active-1" }));
    expect((await screen.findByRole("button", { name: "Encerrar sessão" })).disabled).toBe(true); expect(screen.getByRole("button", { name: "Cancelar sessão" }).disabled).toBe(false);
  });
  it("fim inválido, futuro, sem motivo ou posterior à chegada não são enviados", () => {
    const v = { fim: localInput(30), motivo: "Motivo" };
    expect(() => endSessionPayload({ ...v, fim: localInput(200) }, active, trip, "ENCERRADA")).toThrow(/posterior/);
    expect(() => endSessionPayload({ ...v, fim: localInput(-10) }, active, trip, "ENCERRADA")).toThrow(/futuro/);
    expect(() => endSessionPayload({ ...v, motivo: " " }, active, trip, "ENCERRADA")).toThrow(/motivo/);
    expect(() => endSessionPayload(v, active, { ...trip, chegada_em: iso(60) }, "ENCERRADA")).toThrow(/chegada/);
    expect(() => endSessionPayload(v, session, trip, "ENCERRADA")).toThrow(/imutáveis/);
  });
  it("timeout mantém fim e motivo na mesma operação, sem gerar novo horário", async () => {
    const { calls } = adapter({ sessions: [active], failFirst: true }); render(<Harness />); await endForm();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar finalização" })); await screen.findByRole("alert");
    expect(screen.getByLabelText("Fim efetivo da sessão").disabled).toBe(true); expect(writes(calls)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Fechar finalização" }));
    expect(screen.getByRole("button", { name: "Cancelar sessão" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Encerrar sessão" }));
    expect(screen.getByLabelText("Fim efetivo da sessão").disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reenviar mesma finalização" })); await screen.findByText("Finalização confirmada.");
    expect(writes(calls)[1]).toEqual(writes(calls)[0]);
  });
});

describe("paginação e proteção contra duplicidade", () => {
  it("pagina sessões sem tratar a primeira página como histórico completo", async () => {
    const history = Array.from({ length: 21 }, (_, i) => ({ ...session, id: `old-${i}` }));
    const { calls } = adapter({ sessions: history }); render(<Harness />); await screen.findByRole("button", { name: "Próximas sessões" });
    fireEvent.click(screen.getByRole("button", { name: "Próximas sessões" }));
    await waitFor(() => expect(calls.some((call) => call.params?.limit === 21 && call.params?.offset === 20)).toBe(true));
    expect(await screen.findByRole("button", { name: "Consultar sessão old-20" })).toBeTruthy();
  });
  it("paginação inconsistente do histórico não produz loop ou catálogo inventado", async () => {
    const batch = Array.from({ length: 100 }, (_, i) => ({ ...session, id: `s-${i}` }));
    api.defaults.adapter = async (config) => reply(config, batch);
    await expect(inspectSessionHistory(cargo.id, trip.id)).rejects.toThrow(/inconsistente/);
  });
  it("lista de sessões rejeita pai incompatível", async () => {
    adapter({ sessions: [{ ...session, viagem_id: "other-trip" }] }); await expect(readSessionPage(cargo.id, trip.id)).rejects.toThrow(/incompatíveis/);
  });
  it("envio duplo não cria duas sessões", async () => {
    const { calls } = adapter(); const previous = api.defaults.adapter; let release;
    api.defaults.adapter = async (config) => config.method === "post" ? new Promise((resolve) => { calls.push({ method: "post" }); release = () => resolve(reply(config, { ...active, id: "new-1" }, 201)); }) : previous(config);
    render(<Harness />); await startForm();
    const form = screen.getByRole("form", { name: "Iniciar sessão de monitoramento" }); fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(writes(calls)).toHaveLength(1)); await act(async () => release()); await screen.findByText("Sessão confirmada.");
  });
});
