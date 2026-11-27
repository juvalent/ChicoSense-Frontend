import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import AcquisitionPanel from "../src/components/Monitoring/AcquisitionPanel";
import Monitoramento from "../src/pages/Monitoramento/Monitoramento";
import { acquisitionPayload, readAcquisitionPage, readAcquisitionQuality } from "../src/services/acquisitionService";
import api from "../src/services/api";
import { reply, user } from "./helpers";

const minute = Math.floor(Date.now() / 60000) * 60000;
const iso = (ago) => new Date(minute - ago * 60000).toISOString();
const local = (ago) => { const d = new Date(minute - ago * 60000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const company = { id: "carrier-1", ativo: true, tipo: "TRANSPORTADORA" };
const trip = { id: "trip-1", transportadora_id: company.id, status: "EM_ANDAMENTO" };
const session = { id: "session-1", carga_id: "cargo-1", viagem_id: trip.id, estado: "ATIVA", inicio: iso(180), fim: null };
const actor = (role = "GESTOR", companies = [company]) => user(role, { empresas: companies });
const frame = { inicio: iso(180), fim: iso(10), revisao: 3 };
const run = { id: "run-1", sessao_id: session.id, usuario_id: actor().id, revisao: 3, estado: "CONCLUIDA", origem_dados: "BANCO", chave_idempotencia: "previous-key", inicio_janela: frame.inicio, fim_janela: frame.fim, finalizada_em: iso(5), resumo: { novas: 1000, duplicadas: 0, invalidas: 0, erros: 0 } };
const reading = { id: "reading-1", tipo: "TEMPERATURA", medida_em: iso(15), valor: "13.1234", unidade: "C", estado: "VALIDA", recebida_em: null, tardia: null, fora_de_ordem: false, apos_encerramento: false, conflito_observado: false };
const quality = { sessao_id: session.id, ...frame, intervalo_maximo_s: "120.000", natureza: "COBERTURA_TEMPORAL_DE_AQUISICAO_NAO_E_ESTIMATIVA_DE_ETILENO", indicadores: [{ sensor_id: "sensor-1", tipo: "TEMPERATURA", registros: 1000, invalidos: 1, percentual_cobertura: "90.5", duracao_coberta_s: "900", duracao_nao_coberta_s: "100", atraso_nao_classificado: 5, instantes_conflitantes: 1, intervalos: [{ inicio: iso(60), fim: iso(50), duracao_s: "600", motivo: "LACUNA_EXCESSIVA" }] }], codigos_ocorrencias: ["TIMESTAMP_INVALIDO"], limites: "Sem interpolação ou preenchimento." };
const body = (config) => typeof config.data === "string" ? JSON.parse(config.data) : config.data;
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const writes = (calls) => calls.filter((call) => call.method === "post");

function adapter({ runs = [run], total = 1000, readings = [reading], runState = "CONCLUIDA", postStatus = 200, readStatus = 200, timeoutFirst = false, commitOnTimeout = false, qualityData = quality, receivedFrame = frame } = {}) {
  const calls = [];
  const history = runs.map((item) => ({ ...item }));
  let failed = false;
  api.defaults.adapter = async (config) => {
    const payload = body(config);
    calls.push({ method: config.method, url: config.url, params: config.params, data: payload });
    if (config.method === "post") {
      if (postStatus >= 400) return reply(config, {}, postStatus);
      const timeout = timeoutFirst && !failed; if (timeout) failed = true;
      let created;
      if (!timeout || commitOnTimeout) {
        created = history.find((item) => item.chave_idempotencia === payload.chave_idempotencia);
        if (!created) { created = { ...run, id: "run-new", revisao: 4, ...payload, estado: runState, sessao_id: session.id }; history.unshift(created); }
      }
      if (timeout) throw new AxiosError("Fixture timeout", "ECONNABORTED", config);
      return reply(config, created, postStatus);
    }
    if (config.url.endsWith("/sincronizacoes")) return reply(config, { sessao_id: session.id, revisao_disponivel: 3, em_execucao: history.find((item) => item.estado === "EM_EXECUCAO")?.id || null, tentativas: history.slice(config.params.offset, config.params.offset + config.params.limit) }, readStatus);
    if (config.url.endsWith("/leituras")) return reply(config, { sessao_id: session.id, ...receivedFrame, total, limit: config.params.limit, offset: config.params.offset, leituras: total ? readings : [], ocorrencias: [], estado_sessao: session.estado }, readStatus);
    if (config.url.endsWith("/qualidade")) return reply(config, qualityData, readStatus);
    return reply(config, { detail: "Unhandled local mock" }, 404);
  };
  return { calls, history };
}

function Harness({ currentUser = actor(), currentSession = session, currentTrip = trip }) {
  const [busy, setBusy] = useState(false);
  return <AcquisitionPanel session={currentSession} trip={currentTrip} user={currentUser} busy={busy} onBusy={setBusy} />;
}
async function open() { fireEvent.click(screen.getByRole("button", { name: "Abrir aquisição e qualidade" })); await screen.findByText(/Registros 901–901 de 1000/); }
async function synchronization() {
  await open(); fireEvent.click(screen.getByRole("button", { name: "Sincronizar dados da sessão" }));
  fill("Origem dos dados", "BANCO"); fill("Início da sincronização", local(120)); fill("Fim da sincronização", local(10));
}

describe("consulta por sessão, revisão e janela", () => {
  it("abre sob demanda e inicia na última página com janela/revisão fixadas", async () => {
    const { calls } = adapter(); render(<Harness />); expect(calls).toHaveLength(0); await open();
    const reads = calls.filter((call) => call.url.endsWith("/leituras"));
    expect(reads[0].params).toEqual({ limit: 1, offset: 0 });
    expect(reads[1].params).toEqual({ limit: 100, offset: 900, ...frame });
    fireEvent.click(screen.getByRole("button", { name: "Leituras anteriores" }));
    await waitFor(() => expect(calls.at(-1).params).toEqual({ limit: 100, offset: 800, ...frame }));
  });
  it("mostra leituras conflitantes e chegada desconhecida sem convertê-las em zero", async () => {
    adapter({ readings: [{ ...reading, valor: null, estado: "CONFLITANTE", conflito_observado: true, fora_de_ordem: true }] }); render(<Harness />); await open();
    expect(screen.getByText(/Valor indisponível/)).toBeTruthy(); expect(screen.getByText(/CONFLITANTE/)).toBeTruthy(); expect(screen.getByText(/Tardia: Não classificado/)).toBeTruthy();
  });
  it("nenhuma leitura não significa produção zero", async () => {
    adapter({ total: 0, receivedFrame: { ...frame, revisao: 0 }, runs: [] }); render(<Harness />); fireEvent.click(screen.getByRole("button", { name: "Abrir aquisição e qualidade" }));
    expect(await screen.findByText(/Isso não significa produção zero/)).toBeTruthy();
  });
  it("filtro pede uma revisão consolidada e mantém o tipo na API", async () => {
    const { calls } = adapter(); render(<Harness />); await open(); fill("Revisão das leituras", "3"); fill("Tipo de leitura", "UMIDADE");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar janela e revisão" }));
    await waitFor(() => expect(calls.some((call) => call.params?.tipo === "UMIDADE" && call.params?.revisao === 3)).toBe(true));
  });
  it("janela fora da sessão é rejeitada sem nova consulta", async () => {
    const { calls } = adapter(); render(<Harness />); await open(); const count = calls.length;
    fill("Início da consulta (opcional)", local(300)); fireEvent.click(screen.getByRole("button", { name: "Aplicar janela e revisão" }));
    expect(screen.getByRole("alert").textContent).toMatch(/dentro da sessão/); expect(calls).toHaveLength(count);
  });
  it("histórico de outra sessão não é exibido", async () => {
    api.defaults.adapter = async (config) => reply(config, { sessao_id: "other-session", ...frame, total: 1, leituras: [reading] });
    await expect(readAcquisitionPage(session.id, {})).rejects.toThrow(/Histórico/);
  });
  it("alteração de janela entre páginas é recusada", async () => {
    adapter({ receivedFrame: { ...frame, fim: iso(1) } });
    await expect(readAcquisitionPage(session.id, {}, { offset: 100, frame })).rejects.toThrow(/janela ou revisão/);
  });
  it("403 não aparece como lista vazia nem como sucesso", async () => {
    adapter({ readStatus: 403 }); render(<Harness />); fireEvent.click(screen.getByRole("button", { name: "Abrir aquisição e qualidade" }));
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0); expect(screen.queryByText(/Nenhuma leitura nessa janela/)).toBeNull();
  });
});

describe("sincronização por estado e papel", () => {
  it.each(["ADMIN", "GESTOR", "OPERADOR"])("%s pode sincronizar sessão ativa autorizada", async (role) => {
    const { calls } = adapter(); render(<Harness currentUser={actor(role)} />); await synchronization();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar sincronização" }));
    expect(await screen.findByText(/Tentativa registrada: Concluída/)).toBeTruthy();
    expect(writes(calls)[0]).toMatchObject({ url: "/api/v1/monitoramentos/session-1/sincronizacoes", data: { origem_dados: "BANCO", inicio: new Date(local(120)).toISOString(), fim: new Date(local(10)).toISOString(), limite_atraso_s: null, max_requisicoes: 16, complementar_encerrada: false } });
    expect(writes(calls)[0].data.chave_idempotencia).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls.every((call) => !call.url.includes("/integracoes/thingspeak"))).toBe(true);
  });
  it.each(["CONSULTA", "GESTOR"])("%s sem escopo de escrita mantém apenas consulta", async (role) => {
    adapter(); render(<Harness currentUser={actor(role, role === "GESTOR" ? [{ ...company, id: "other" }] : [company])} />); await open();
    expect(screen.queryByRole("button", { name: "Sincronizar dados da sessão" })).toBeNull();
  });
  it("OPERADOR não complementa sessão encerrada", async () => {
    adapter(); render(<Harness currentUser={actor("OPERADOR")} currentSession={{ ...session, estado: "ENCERRADA", fim: iso(5) }} />); await open();
    expect(screen.queryByRole("button", { name: "Sincronizar dados da sessão" })).toBeNull();
  });
  it("GESTOR complementa encerrada somente com confirmação e justificativa", async () => {
    const { calls } = adapter(); render(<Harness currentSession={{ ...session, estado: "ENCERRADA", fim: iso(5) }} />); await synchronization();
    fireEvent.submit(screen.getByRole("form", { name: "Sincronizar histórico da sessão" }));
    expect(screen.getByRole("alert").textContent).toMatch(/confirmação e justificativa/); expect(writes(calls)).toHaveLength(0);
    fireEvent.click(screen.getByLabelText("Confirmo a complementação da sessão encerrada")); fill("Justificativa da sincronização", "Complementação de dados tardios documentada");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar sincronização" })); await screen.findByText(/Tentativa registrada: Concluída/);
    expect(writes(calls)[0].data).toMatchObject({ complementar_encerrada: true, justificativa: "Complementação de dados tardios documentada" });
  });
  it("cancelada não permite incorporar dados", async () => {
    adapter(); render(<Harness currentUser={actor("ADMIN")} currentSession={{ ...session, estado: "CANCELADA", fim: iso(5) }} />); await open();
    expect(screen.queryByRole("button", { name: "Sincronizar dados da sessão" })).toBeNull();
  });
  it("THINGSPEAK não pede nem envia chaves no navegador", async () => {
    const { calls } = adapter(); render(<Harness />); await synchronization(); fill("Origem dos dados", "THINGSPEAK");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar sincronização" })); await screen.findByText(/Tentativa registrada: Concluída/);
    expect(writes(calls)[0].data.origem_dados).toBe("THINGSPEAK"); expect(Object.keys(writes(calls)[0].data).some((key) => /api.key|channel|token/i.test(key))).toBe(false);
  });
  it.each(["FALHA", "PARCIAL", "INTERROMPIDA"])("resultado %s é exibido como tentativa auditada", async (runState) => {
    adapter({ runState }); render(<Harness />); await synchronization(); fireEvent.click(screen.getByRole("button", { name: "Confirmar sincronização" }));
    expect(await screen.findByText(new RegExp(`Tentativa registrada: ${{ FALHA: "Falha", PARCIAL: "Parcial", INTERROMPIDA: "Interrompida" }[runState]}`))).toBeTruthy();
  });
  it("HTTP 202 mantém a solicitação em execução, sem confirmação de coleta", async () => {
    const { calls } = adapter({ runState: "EM_EXECUCAO", postStatus: 202 }); render(<Harness />); await synchronization();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar sincronização" })); expect(await screen.findByText(/Solicitação ainda em execução/)).toBeTruthy();
    expect(screen.getByRole("form", { name: "Sincronizar histórico da sessão" })).toBeTruthy(); expect(writes(calls)).toHaveLength(1);
    expect(screen.getByLabelText("Origem dos dados").disabled).toBe(true);
  });
  it.each([403, 409, 422])("HTTP %s não vira coleta concluída", async (postStatus) => {
    adapter({ postStatus }); render(<Harness />); await synchronization(); fireEvent.click(screen.getByRole("button", { name: "Confirmar sincronização" }));
    expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.getByRole("form", { name: "Sincronizar histórico da sessão" })).toBeTruthy();
    expect(screen.queryByText(/Tentativa registrada: Concluída/)).toBeNull();
  });
  it("valida janela, atraso e limite sem inventar valores", () => {
    const values = { origem_dados: "BANCO", inicio: local(120), fim: local(10), max_requisicoes: "16", limite_atraso_s: "" };
    expect(() => acquisitionPayload({ ...values, inicio: local(240) }, session, "key")).toThrow(/janela/);
    expect(() => acquisitionPayload({ ...values, limite_atraso_s: "0" }, session, "key")).toThrow(/operacional/);
    expect(() => acquisitionPayload({ ...values, max_requisicoes: "33" }, session, "key")).toThrow(/1 e 32/);
    expect(acquisitionPayload(values, session, "key").limite_atraso_s).toBeNull();
  });
});

describe("idempotência e auditoria de tentativas", () => {
  it("timeout conserva chave e payload mesmo fechando o formulário", async () => {
    const { calls } = adapter({ timeoutFirst: true }); render(<Harness />); await synchronization();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar sincronização" })); await screen.findByRole("alert"); expect(writes(calls)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Fechar sincronização" })); fireEvent.click(screen.getByRole("button", { name: "Revisar solicitação de sincronização" }));
    expect(screen.getByLabelText("Origem dos dados").disabled).toBe(true); fireEvent.click(screen.getByRole("button", { name: "Reconsultar mesma solicitação" })); await screen.findByText(/Tentativa registrada: Concluída/);
    expect(writes(calls)[1].data).toEqual(writes(calls)[0].data);
  });
  it("consulta reconcilia POST já concluído após timeout sem outra gravação", async () => {
    const { calls } = adapter({ timeoutFirst: true, commitOnTimeout: true }); render(<Harness />); await synchronization();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar sincronização" })); await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Consultar tentativas" })); fireEvent.click(await screen.findByRole("button", { name: "Consultar solicitação identificada" }));
    await screen.findByText(/Tentativa registrada: Concluída/); expect(writes(calls)).toHaveLength(1);
  });
  it("envio duplo não duplica POST", async () => {
    const { calls } = adapter(); const previous = api.defaults.adapter; let release;
    api.defaults.adapter = async (config) => config.method === "post" ? new Promise((resolve) => { calls.push({ method: "post", data: body(config) }); release = () => resolve(reply(config, { ...run, chave_idempotencia: body(config).chave_idempotencia })); }) : previous(config);
    render(<Harness />); await synchronization(); const form = screen.getByRole("form", { name: "Sincronizar histórico da sessão" });
    fireEvent.submit(form); fireEvent.submit(form); await waitFor(() => expect(writes(calls)).toHaveLength(1)); await act(async () => release()); await screen.findByText(/Tentativa registrada: Concluída/);
  });
  it("tentativas são paginadas sem carregar toda a lista", async () => {
    const { calls } = adapter({ runs: Array.from({ length: 21 }, (_, index) => ({ ...run, id: `run-${index}`, revisao: 21 - index })) }); render(<Harness />); await open();
    fireEvent.click(screen.getByRole("button", { name: "Próximas tentativas" }));
    await waitFor(() => expect(calls.some((call) => call.url.endsWith("/sincronizacoes") && call.params.offset === 20)).toBe(true));
  });
});

describe("qualidade de aquisição", () => {
  it("G é obrigatório e positivo, sem valor científico pré-preenchido", async () => {
    const { calls } = adapter(); render(<Harness />); await open(); expect(screen.getByLabelText("Intervalo máximo operacional G (s)").value).toBe("");
    fireEvent.submit(screen.getByRole("form", { name: "Consultar qualidade da aquisição" })); expect(screen.getByRole("alert").textContent).toMatch(/operacional positivo/);
    expect(calls.some((call) => call.url.endsWith("/qualidade"))).toBe(false);
  });
  it("consulta qualidade na mesma revisão/janela e mostra lacunas", async () => {
    const { calls } = adapter(); render(<Harness />); await open(); fill("Intervalo máximo operacional G (s)", "120");
    fireEvent.click(screen.getByRole("button", { name: "Consultar qualidade" })); expect(await screen.findByRole("region", { name: "Resultado de qualidade" })).toBeTruthy();
    expect(calls.find((call) => call.url.endsWith("/qualidade")).params).toEqual({ ...frame, intervalo_maximo_s: "120", incluir_intervalos: false });
    expect(screen.getByText(/Cobertura: 90.5%/)).toBeTruthy(); expect(screen.getByText(/Lacuna excessiva/)).toBeTruthy();
  });
  it("cobertura desconhecida permanece indeterminada", async () => {
    adapter({ qualityData: { ...quality, metadados_temporais_invalidos: true, indicadores: [{ ...quality.indicadores[0], percentual_cobertura: null }] } }); render(<Harness />); await open();
    fill("Intervalo máximo operacional G (s)", "120"); fireEvent.click(screen.getByRole("button", { name: "Consultar qualidade" })); expect(await screen.findByText(/Cobertura: Indeterminada/)).toBeTruthy();
  });
  it("qualidade de outra revisão não é apresentada como compatível", async () => {
    adapter({ qualityData: { ...quality, revisao: 4 } }); await expect(readAcquisitionQuality(session.id, frame, "120")).rejects.toThrow(/incompatível/);
  });
  it("lacunas extensas são paginadas na apresentação", async () => {
    const gaps = Array.from({ length: 21 }, (_, index) => ({ inicio: iso(150 - index), fim: iso(149 - index), duracao_s: "60", motivo: "LACUNA_EXCESSIVA" }));
    adapter({ qualityData: { ...quality, indicadores: [{ ...quality.indicadores[0], intervalos: gaps }] } }); render(<Harness />); await open(); fill("Intervalo máximo operacional G (s)", "120");
    fireEvent.click(screen.getByRole("button", { name: "Consultar qualidade" })); const pagination = await screen.findByRole("navigation", { name: "Paginação de lacunas" });
    expect(within(pagination).getByText("1–20 de 21 lacunas")).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Próximas lacunas" })); expect(within(pagination).getByText("21–21 de 21 lacunas")).toBeTruthy();
  });
});

describe("seleção de contexto em Monitoramento", () => {
  it("resposta de carga de outra viagem não habilita o painel", async () => {
    api.defaults.adapter = async (config) => {
      if (config.url === "/api/v1/viagens/trip-1") return reply(config, trip);
      if (config.url === "/api/v1/viagens/trip-1/cargas") return reply(config, []);
      if (config.url === "/api/v1/cargas/cargo-1") return reply(config, { id: "cargo-1", viagem_id: "other-trip" });
      return reply(config, {}, 404);
    };
    render(<MemoryRouter initialEntries={[{ pathname: "/monitoramento", state: { tripId: trip.id, loadId: "cargo-1" } }]}><Monitoramento user={actor()} trips={[trip]} /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.queryByText("Declaração e sessões de monitoramento")).toBeNull();
  });
});
