import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import PreventivePanel from "../src/components/Monitoring/PreventivePanel";
import { alertActions, configurationPayload, evaluationPayload, operationalWriter, readOperationalPage } from "../src/services/preventiveService";
import api from "../src/services/api";
import { reply, user } from "./helpers";

const company = { id: "carrier", tipo: "TRANSPORTADORA", ativo: true };
const trip = { id: "trip", transportadora_id: company.id };
const session = { id: "session", viagem_id: trip.id, estado: "ATIVA", maturacao: "DESCONHECIDA", ambiente_aquisicao: "TRANSPORTE_REFRIGERADO", inicio: new Date(Date.now() - 3600000).toISOString() };
const actor = (perfil = "GESTOR") => user(perfil, { empresas: [company] });
const values = { temperatura_min_c: "10,001", temperatura_max_c: "15.125", umidade_min_percentual: "80", umidade_max_percentual: "95", intervalo_maximo_s: "120", cobertura_min_percentual: "90", exposicao_continua_s: "", fundamento: "OPERACIONAL", prioridade: "ATENCAO", justificativa: "Parâmetros apenas operacionais", referencias: "Fonte de demonstração" };
function Harness({ currentUser = actor() }) { const [busy, setBusy] = useState(false); return <PreventivePanel session={session} trip={trip} user={currentUser} busy={busy} onBusy={setBusy} />; }
function mock({ timeout = false, status = 200 } = {}) {
  const calls = []; let failed = false;
  api.defaults.adapter = async (config) => {
    calls.push(config);
    if (config.method === "post") {
      if (timeout && !failed) { failed = true; throw new AxiosError("Fixture timeout", "ECONNABORTED", config); }
      return reply(config, { id: "created", sessao_id: session.id, ...JSON.parse(config.data) }, status);
    }
    const key = config.url.endsWith("configuracoes-ambientais") ? "configuracoes" : config.url.endsWith("avaliacoes-preventivas") ? "avaliacoes" : "alertas";
    return reply(config, { total: 0, [key]: [] });
  }; return calls;
}
async function open() { fireEvent.click(screen.getByText("Abrir avaliação preventiva e alertas")); await screen.findByText("Configurações ambientais"); }
describe("contrato preventivo", () => {
  it("preserva decimal, maturação desconhecida e ambiente sem inventar parâmetros", () => {
    expect(configurationPayload(values, session, "key")).toMatchObject({ temperatura_min_c: "10.001", maturacoes_aplicaveis: ["DESCONHECIDA"], ambiente: session.ambiente_aquisicao, exposicao_continua_s: null });
  });
  it.each([ { temperatura_max_c: "9" }, { umidade_min_percentual: "101" }, { cobertura_min_percentual: "0" }, { intervalo_maximo_s: "0" }, { temperatura_min_c: "NaN" }, { temperatura_min_c: "10.0001" }, { fundamento: "CIENTIFICO" }, { justificativa: "curta" } ])("rejeita parâmetros inválidos %j", (change) => expect(() => configurationPayload({ ...values, ...change }, session, "key")).toThrow());
  it("não avalia janela vazia ou futura", () => {
    expect(() => evaluationPayload({ inicio: session.inicio, fim: session.inicio, corte_aquisicao: session.inicio, revisao: "" }, session, "key")).toThrow();
    expect(() => evaluationPayload({ inicio: session.inicio, fim: new Date(Date.now() + 60000).toISOString(), corte_aquisicao: new Date(Date.now() + 60000).toISOString(), revisao: "" }, session, "key")).toThrow();
  });
  it("conserva revisão zero e deixa análise contextual ausente", () => {
    const end = new Date(Date.now() - 60000).toISOString();
    expect(evaluationPayload({ inicio: session.inicio, fim: end, corte_aquisicao: end, revisao: "0" }, session, "key")).toMatchObject({ revisao: 0, analise_etileno_id: null, configuracao_id: null });
  });
  it("terminal permite apenas observação sem reabrir", () => { expect(alertActions("RESOLVIDO")).toEqual(["OBSERVAR"]); expect(alertActions("ABERTO")).toContain("RECONHECER"); });
  it.each(["CONSULTA", "PRODUTOR", "CLIENTE"])("não permite escrita %s", (role) => expect(operationalWriter(actor(role), trip, session)).toBe(false));
  it("nega outra transportadora e sessão de outra viagem", () => { expect(operationalWriter(actor(), { ...trip, transportadora_id: "other" }, session)).toBe(false); expect(operationalWriter(actor(), trip, { ...session, viagem_id: "other" })).toBe(false); });
  it("rejeita resposta de outra sessão", async () => { api.defaults.adapter = async (c) => reply(c, { total: 1, alertas: [{ id: "a", sessao_id: "other" }] }); await expect(readOperationalPage(session.id, "alertas", "alertas", 0)).rejects.toThrow(); });
});
describe("interface preventiva", () => {
  it.each(["RECONHECER", "OBSERVAR", "RESOLVER", "DESCARTAR"])("registra decisão %s e consulta evidências", async (action) => {
    const calls = [];
    const alert = { id: "alert", sessao_id: session.id, tipo: "COBERTURA_INSUFICIENTE", nivel: "INFORMATIVO", status: "ABERTO" };
    api.defaults.adapter = async (c) => {
      calls.push(c);
      if (c.method === "post") return reply(c, { id: "decision", sessao_id: session.id, alerta_id: alert.id, ...JSON.parse(c.data) });
      if (c.url.endsWith("/alertas/alert")) return reply(c, alert);
      if (c.url.endsWith("/evidencias")) return reply(c, { total: 1, evidencias: [{ id: "evidence", alerta_id: alert.id, avaliacao_id: "evaluation", evidencia: { percentual: null, mensagem: "Cobertura desconhecida" } }] });
      const key = c.url.endsWith("configuracoes-ambientais") ? "configuracoes" : c.url.endsWith("avaliacoes-preventivas") ? "avaliacoes" : c.url.endsWith("decisoes") ? "decisoes" : "alertas";
      return reply(c, { total: key === "alertas" ? 1 : 0, [key]: key === "alertas" ? [alert] : [] });
    };
    render(<Harness />); await open(); fireEvent.click(await screen.findByText("Consultar alerta alert"));
    await screen.findByText("Cobertura desconhecida"); fireEvent.click(screen.getByRole("button", { name: action, exact: true }));
    fireEvent.change(screen.getByLabelText("Justificativa"), { target: { value: "Verificação humana documentada" } });
    fireEvent.submit(screen.getByRole("form", { name: `${action} alerta` }));
    await waitFor(() => expect(calls.filter((c) => c.method === "post")).toHaveLength(1));
    expect(JSON.parse(calls.find((c) => c.method === "post").data)).toMatchObject({ acao: action, justificativa: "Verificação humana documentada" });
  });
  it("rejeita evidência vinculada a outro alerta", async () => {
    api.defaults.adapter = async (c) => reply(c, { total: 1, evidencias: [{ id: "evidence", alerta_id: "other" }] });
    await expect(readOperationalPage(session.id, "alertas/alert/evidencias", "evidencias", 0)).rejects.toThrow();
  });
  it("consulta somente sob demanda, sem POST automático", async () => { const calls = mock(); render(<Harness />); expect(calls).toHaveLength(0); await open(); await waitFor(() => expect(calls).toHaveLength(3)); expect(calls.every((c) => c.method === "get")).toBe(true); });
  it.each(["CONSULTA", "OPERADOR"])("oculta configuração para %s", async (role) => { mock(); render(<Harness currentUser={actor(role)} />); await open(); expect(screen.queryByText("Registrar configuração ambiental")).toBeNull(); expect(Boolean(screen.queryByText("Avaliar sem configuração"))).toBe(role === "OPERADOR"); });
  it("não oferece valores científicos por padrão", async () => { mock(); render(<Harness />); await open(); fireEvent.click(screen.getByText("Registrar configuração ambiental")); expect(screen.getByLabelText("Temperatura mínima (°C)").value).toBe(""); expect(screen.getByLabelText("Cobertura mínima (%)").value).toBe(""); });
  it("mantém chave e corpo após timeout sem repetição automática", async () => {
    const calls = mock({ timeout: true }); render(<Harness />); await open(); fireEvent.click(screen.getByText("Registrar configuração ambiental"));
    const labels = ["Temperatura mínima (°C)", "Temperatura máxima (°C)", "Umidade mínima (%)", "Umidade máxima (%)", "Intervalo máximo operacional (s)", "Cobertura mínima (%)", "Fundamento", "Prioridade operacional", "Justificativa"];
    const fields = ["temperatura_min_c", "temperatura_max_c", "umidade_min_percentual", "umidade_max_percentual", "intervalo_maximo_s", "cobertura_min_percentual", "fundamento", "prioridade", "justificativa"];
    labels.forEach((label, i) => fireEvent.change(screen.getByLabelText(label), { target: { value: values[fields[i]] } }));
    fireEvent.submit(screen.getByRole("form", { name: "configuração ambiental" }));
    await screen.findByText(/Resposta incerta/); expect(calls.filter((c) => c.method === "post")).toHaveLength(1);
    expect(screen.getByLabelText("Temperatura mínima (°C)").closest("fieldset").disabled).toBe(true);
    fireEvent.click(screen.getByText("Confirmar configuração ambiental"));
    await waitFor(() => expect(calls.filter((c) => c.method === "post")).toHaveLength(2));
    const posts = calls.filter((c) => c.method === "post"); expect(posts[0].data).toBe(posts[1].data);
  });
});
