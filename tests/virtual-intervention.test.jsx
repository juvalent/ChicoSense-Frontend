import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import VirtualInterventionPanel from "../src/components/Monitoring/VirtualInterventionPanel";
import { allowedVirtualActions, canRequestVirtual, validateVirtual, virtualRequestPayload } from "../src/services/virtualInterventionService";
import api from "../src/services/api";
import { reply, user } from "./helpers";

const company = { id: "carrier", tipo: "TRANSPORTADORA", ativo: true };
const trip = { id: "trip", transportadora_id: company.id, status: "EM_ANDAMENTO" };
const session = { id: "session", viagem_id: trip.id, carga_id: "cargo", estado: "ATIVA" };
const actor = (perfil = "GESTOR") => user(perfil, { empresas: [company] });
const intervention = { id: "virtual-1", sessao_id: session.id, viagem_id: trip.id, carga_id: session.carga_id, modalidade: "SIMULADA", estado: "SOLICITADA", solicitante_id: actor().id, acoes_permitidas: ["AUTORIZAR", "RECUSAR", "CANCELAR"], virtual_ligado: false, duracao_planejada_s: "60.125", solicitada_em: "2026-11-24T10:00:00Z", consultado_em: "2026-11-24T10:01:00Z", justificativa_solicitacao: "Simulação local", limitacoes: ["Não controla hardware"] };
function Harness({ currentUser = actor(), currentSession = session }) { const [busy, setBusy] = useState(false); return <VirtualInterventionPanel session={currentSession} trip={trip} user={currentUser} busy={busy} onBusy={setBusy} />; }
function mock({ row = intervention, timeout = false, status = 200 } = {}) {
  const calls = []; let failed = false;
  api.defaults.adapter = async (c) => {
    calls.push(c);
    if (c.method === "post") {
      if (timeout && !failed) { failed = true; throw new AxiosError("Fixture timeout", "ECONNABORTED", c); }
      const payload = JSON.parse(c.data);
      return reply(c, c.url.endsWith("/acoes") ? { id: "action", sessao_id: session.id, intervencao_id: row.id, ...payload } : { ...row, ...payload }, status);
    }
    if (c.url.endsWith("/acoes")) return reply(c, { total: 1, acoes: [{ id: "audit", sessao_id: session.id, intervencao_id: row.id, numero: 1, acao: "SOLICITAR", justificativa: "Solicitação humana", usuario_id: actor().id }] });
    if (c.url.endsWith(`/${row.id}`)) return reply(c, row);
    if (c.url.endsWith("intervencoes-simuladas")) return reply(c, { total: 21, intervencoes: [row] });
    const collection = c.url.endsWith("/alertas") ? "alertas" : c.url.endsWith("/avaliacoes-preventivas") ? "avaliacoes" : "analises";
    return reply(c, { total: 1, [collection]: [{ id: `ref-${collection}`, sessao_id: session.id, status: "ABERTO" }] });
  }; return calls;
}
async function open() { fireEvent.click(screen.getByText("Abrir intervenções virtuais")); await screen.findByText("Consultar intervenção virtual-1"); }
async function inspect() { await open(); fireEvent.click(screen.getByText("Consultar intervenção virtual-1")); await screen.findByText("Estado e ações da intervenção virtual"); }
const posts = (calls) => calls.filter((c) => c.method === "post");
describe("contrato exclusivamente virtual", () => {
  it("envia somente parâmetros virtuais e preserva decimal", () => {
    expect(virtualRequestPayload({ duracao_planejada_s: "60,125", justificativa: "Teste" }, "key")).toEqual({ chave_idempotencia: "key", duracao_planejada_s: "60.125", justificativa: "Teste", alerta_id: null, avaliacao_id: null, analise_etileno_id: null });
  });
  it.each(["0", "-1", "86400.001", "Infinity", "1.0001", ""])("rejeita duração %s", (duration) => expect(() => virtualRequestPayload({ duracao_planejada_s: duration, justificativa: "Teste" }, "key")).toThrow());
  it("aceita 24 horas sem inferir encerramento automático", () => expect(virtualRequestPayload({ duracao_planejada_s: "86400", justificativa: "Teste" }, "key").duracao_planejada_s).toBe("86400"));
  it.each(["CONSULTA", "CLIENTE", "PRODUTOR"])("leitor %s não solicita", (role) => expect(canRequestVirtual(actor(role), trip, session)).toBe(false));
  it("nega escrita de outra transportadora", () => expect(canRequestVirtual(actor(), { ...trip, transportadora_id: "other" }, session)).toBe(false));
  it("sessão encerrada não recebe pedido mas permite encerramento autorizado", () => {
    const ended = { ...session, estado: "ENCERRADA" };
    expect(canRequestVirtual(actor(), trip, ended)).toBe(false);
    expect(allowedVirtualActions({ ...intervention, estado: "EM_EXECUCAO", acoes_permitidas: ["ENCERRAR"] }, actor(), trip, ended)).toEqual(["ENCERRAR"]);
  });
  it("operador não autoriza e só retira/encerra sua própria solicitação", () => {
    expect(allowedVirtualActions(intervention, actor("OPERADOR"), trip, session)).toEqual(["CANCELAR"]);
    expect(allowedVirtualActions({ ...intervention, solicitante_id: "other" }, actor("OPERADOR"), trip, session)).toEqual([]);
  });
  it.each([{ modalidade: "FISICA" }, { viagem_id: "other" }, { carga_id: "other" }, { sessao_id: "other" }, { acoes_permitidas: ["COMANDO_FISICO"] }])("rejeita resposta incompatível %j", (change) => expect(() => validateVirtual({ ...intervention, ...change }, session)).toThrow());
});
describe("fluxo humano de simulação", () => {
  it("abrir, consultar e atualizar não fazem POST", async () => { const calls = mock(); render(<Harness />); expect(calls).toHaveLength(0); await inspect(); fireEvent.click(screen.getByText("Atualizar estado e permissões")); await screen.findByText("Estado e ações da intervenção virtual"); expect(posts(calls)).toHaveLength(0); });
  it("pedido não autoriza nem inicia e exige justificativa", async () => {
    const calls = mock(); render(<Harness />); await open(); fireEvent.click(screen.getByText("Solicitar intervenção sem referência"));
    fireEvent.change(screen.getByLabelText("Duração planejada da simulação (s)"), { target: { value: "60" } });
    fireEvent.submit(screen.getByRole("form", { name: "solicitação virtual" })); await screen.findByRole("alert"); expect(posts(calls)).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Justificativa humana"), { target: { value: "Teste humano" } });
    fireEvent.submit(screen.getByRole("form", { name: "solicitação virtual" })); await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(JSON.parse(posts(calls)[0].data)).not.toHaveProperty("acao"); expect(posts(calls)[0].url).toMatch(/intervencoes-simuladas$/);
  });
  it("lista ações somente a partir das permissões atuais", async () => {
    mock({ row: { ...intervention, acoes_permitidas: ["RECUSAR"] } }); render(<Harness />); await inspect();
    expect(screen.queryByText("AUTORIZAR intervenção virtual")).toBeNull(); expect(screen.getByText("RECUSAR intervenção virtual")).toBeTruthy();
  });
  it.each(["AUTORIZAR", "RECUSAR", "INICIAR", "ENCERRAR", "CANCELAR", "REGISTRAR_FALHA"])("registra %s com justificativa e UUID", async (action) => {
    const calls = mock({ row: { ...intervention, acoes_permitidas: [action] } }); render(<Harness />); await inspect(); fireEvent.click(screen.getByText(`${action} intervenção virtual`));
    fireEvent.change(screen.getByLabelText("Justificativa humana"), { target: { value: "Decisão explícita" } });
    fireEvent.submit(screen.getByRole("form", { name: `${action} intervenção virtual` }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1)); const sent = JSON.parse(posts(calls)[0].data);
    expect(sent).toMatchObject({ acao: action, justificativa: "Decisão explícita" }); expect(sent.chave_idempotencia).toMatch(/^[a-f0-9-]{36}$/);
  });
  it("prazo excedido e sessão terminal não encerram automaticamente", async () => {
    const calls = mock({ row: { ...intervention, estado: "EM_EXECUCAO", virtual_ligado: true, prazo_excedido: true, sessao_terminal_com_execucao: true, acoes_permitidas: ["ENCERRAR"] } });
    render(<Harness currentSession={{ ...session, estado: "ENCERRADA" }} />); await inspect();
    expect(screen.getByText(/Prazo excedido no instante/)).toBeTruthy(); expect(screen.getByText("ENCERRAR intervenção virtual")).toBeTruthy(); expect(screen.queryByText("Solicitar intervenção sem referência")).toBeNull(); expect(posts(calls)).toHaveLength(0);
  });
  it("consulta somente sem ações para CONSULTA", async () => { mock(); render(<Harness currentUser={actor("CONSULTA")} />); await inspect(); expect(screen.queryByText("AUTORIZAR intervenção virtual")).toBeNull(); expect(screen.getByText("Histórico da intervenção")).toBeTruthy(); });
  it("repetição após timeout usa mesmo corpo e chave", async () => {
    const calls = mock({ timeout: true }); render(<Harness />); await inspect(); fireEvent.click(screen.getByText("RECUSAR intervenção virtual"));
    fireEvent.change(screen.getByLabelText("Justificativa humana"), { target: { value: "Decisão humana" } }); fireEvent.submit(screen.getByRole("form", { name: "RECUSAR intervenção virtual" }));
    await screen.findByText(/Resposta incerta/); expect(posts(calls)).toHaveLength(1);
    fireEvent.click(screen.getByText("Fechar formulário")); fireEvent.click(screen.getByText("RECUSAR intervenção virtual"));
    expect(screen.getByLabelText("Justificativa humana").value).toBe("Decisão humana"); fireEvent.click(screen.getByText("Confirmar RECUSAR intervenção virtual"));
    await waitFor(() => expect(posts(calls)).toHaveLength(2)); expect(posts(calls)[0].data).toBe(posts(calls)[1].data);
  });
  it("seleciona referência de alerta autorizado sem UUID digitado", async () => {
    const calls = mock(); render(<Harness />); await open(); fireEvent.click(screen.getByText("Selecionar referência contextual")); await screen.findByText("Solicitar com alerta ref-alertas");
    fireEvent.click(screen.getByText("Solicitar com alerta ref-alertas")); fireEvent.change(screen.getByLabelText("Duração planejada da simulação (s)"), { target: { value: "30" } }); fireEvent.change(screen.getByLabelText("Justificativa humana"), { target: { value: "Avaliação humana" } }); fireEvent.submit(screen.getByRole("form", { name: "solicitação virtual" }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1)); expect(JSON.parse(posts(calls)[0].data).alerta_id).toBe("ref-alertas");
  });
  it("pagina histórico de intervenções", async () => { const calls = mock(); render(<Harness />); await open(); fireEvent.click(screen.getByText("Próximos: Intervenções virtuais")); await waitFor(() => expect(calls.at(-1).params.offset).toBe(20)); });
  it.each([403, 409, 422, 503])("exibe falha %s sem iniciar outra ação", async (status) => {
    const calls = mock({ status }); render(<Harness />); await inspect(); fireEvent.click(screen.getByText("RECUSAR intervenção virtual")); fireEvent.change(screen.getByLabelText("Justificativa humana"), { target: { value: "Teste" } }); fireEvent.submit(screen.getByRole("form", { name: "RECUSAR intervenção virtual" })); await screen.findByRole("alert"); expect(posts(calls)).toHaveLength(1);
  });
});
