import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import useIncrementalList from "../src/hooks/useIncrementalList";
import ListProgress from "../src/components/UI/ListProgress";
import Alertas from "../src/pages/Alertas/Alertas";
import AppRoutes from "../src/routes/AppRoutes";
import Etileno from "../src/pages/Etileno/Etileno";
import api from "../src/services/api";
import { tripList, cargoList, tripSessionList } from "../src/services/pagedLists";
import { reply, user } from "./helpers";

const rows = Array.from({ length: 47 }, (_, n) => ({ id: `trip-${n}`, status: "PLANEJADA", codigo: `Viagem ${n}`, origem: "Origem", destino: "Destino" }));
function Harness({ scope = "user", loader = tripList }) {
  const list = useIncrementalList(scope, loader);
  return <><ListProgress list={list} label="registros" /><ul>{list.records.map((r) => <li key={r.id}>{r.id}</li>)}</ul></>;
}
function adapter() {
  const calls = [];
  api.defaults.adapter = async (c) => { calls.push(c); return reply(c, rows.slice(c.params.offset, c.params.offset + c.params.limit)); };
  return calls;
}
describe("paginação incremental limitada", () => {
  it("não consulta sem escopo", () => { const calls = adapter(); render(<Harness scope="" />); expect(calls).toHaveLength(0); });
  it("carrega 20 e só busca as próximas páginas sob comando", async () => {
    const calls = adapter(); render(<Harness />); await screen.findByText("trip-19"); expect(screen.queryByText("trip-20")).toBeNull(); expect(calls).toHaveLength(1); expect(calls[0].params).toEqual({ limit: 21, offset: 0 });
    fireEvent.click(screen.getByText("Carregar mais registros")); await screen.findByText("trip-39"); expect(calls[1].params.offset).toBe(20);
    fireEvent.click(screen.getByText("Carregar mais registros")); await screen.findByText("trip-46"); expect(calls[2].params.offset).toBe(40); expect(screen.queryByText("Carregar mais registros")).toBeNull(); expect(screen.getAllByRole("listitem")).toHaveLength(47);
  });
  it("atualizar reinicia a lista sem duplicar registros", async () => {
    const calls = adapter(); render(<Harness />); await screen.findByText("trip-19"); fireEvent.click(screen.getByText("Carregar mais registros")); await screen.findByText("trip-39"); fireEvent.click(screen.getByText("Atualizar lista de registros")); await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(20)); expect(calls.at(-1).params.offset).toBe(0);
  });
  it("ignora retorno tardio do escopo anterior", async () => {
    let finish;
    const loader = (key) => key === "old" ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve([{ id: "new-row" }]);
    const view = render(<Harness scope="old" loader={loader} />); view.rerender(<Harness scope="new" loader={loader} />); await screen.findByText("new-row"); await act(async () => finish([{ id: "old-row" }])); expect(screen.queryByText("old-row")).toBeNull();
  });
  it("detecta repetição de página sem varrer indefinidamente", async () => {
    api.defaults.adapter = async (c) => reply(c, rows.slice(0,21)); render(<Harness />); await screen.findByText("trip-19"); fireEvent.click(screen.getByText("Carregar mais registros")); await screen.findByText(/lista mudou durante a paginação/); expect(screen.getAllByRole("listitem")).toHaveLength(20); expect(screen.queryByText("Carregar mais registros")).toBeNull();
  });
  it.each([401,403,503])("erro %s não vira lista vazia bem sucedida", async (status) => { api.defaults.adapter = async (c) => reply(c, {}, status); render(<Harness />); expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.queryByRole("listitem")).toBeNull(); });
  it("erro em página seguinte preserva registros anteriores e permite atualização", async () => { api.defaults.adapter = async (c) => c.params.offset ? reply(c, {}, 503) : reply(c, rows.slice(0,21)); render(<Harness />); await screen.findByText("trip-19"); fireEvent.click(screen.getByText("Carregar mais registros")); await screen.findByRole("alert"); expect(screen.getAllByRole("listitem")).toHaveLength(20); });
});
describe("integração das telas", () => {
  it("rejeita cargas ou sessões de outro contexto", async () => {
    api.defaults.adapter = async (c) => reply(c, [{ id: "foreign", viagem_id: "another-trip" }]);
    await expect(cargoList("trip", {})).rejects.toThrow(); await expect(tripSessionList("trip", {})).rejects.toThrow();
  });
  it("resposta malformada de viagens não vira zero registros", async () => {
    api.defaults.adapter = async (c) => reply(c, { message: "Resposta incompleta" });
    render(<Harness />); expect(await screen.findByRole("alert")).toBeTruthy();
  });
  it("histórico científico acessa análises após os primeiros 20 registros", async () => {
    const calls = [];
    api.defaults.adapter = async (c) => {
      calls.push(c);
      if (c.url.endsWith("/cargas")) return reply(c, [{ id: "cargo", viagem_id: "trip", identificacao: "Carga teste" }]);
      if (c.url.endsWith("/monitoramentos")) return reply(c, [{ id: "session", carga_id: "cargo", viagem_id: "trip", produto_identificado: "Manga", estado: "ENCERRADA" }]);
      return reply(c, { sessao_id: "session", total: 21, analises: [{ id: `analysis-${c.params.offset}`, sessao_id: "session", executada_em: "2026-11-24T10:00:00Z", status_calculo: "SEM_DADOS", resultado: {} }] });
    };
    render(<Etileno user={user("CONSULTA")} trips={[{ id: "trip", code: "Viagem teste" }]} />);
    fireEvent.change(screen.getByLabelText("Viagem", {exact:true}), { target: { value: "trip" } }); await screen.findByRole("option", { name: "Carga teste" }); fireEvent.change(screen.getByLabelText("Carga", {exact:true}), { target: { value: "cargo" } }); await screen.findByRole("option", { name: "Manga · ENCERRADA" }); fireEvent.change(screen.getByLabelText("Sessão", {exact:true}), { target: { value: "session" } });
    await screen.findByText("SEM_DADOS"); fireEvent.click(screen.getByText("Próximas análises")); await waitFor(() => expect(calls.at(-1).params).toEqual({ limit: 20, offset: 20 })); expect(calls.every((c) => c.method === "get")).toBe(true);
  });
  it("oferece viagens além da primeira página sem carregar todas automaticamente", async () => {
    const calls = adapter(); render(<MemoryRouter initialEntries={["/monitoramento"]}><AppRoutes user={user()} /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Monitoramento", exact: true }, { timeout: 5000 }); await screen.findByRole("option", { name: /Viagem 19/ });
    fireEvent.click(screen.getByText("Carregar mais viagens")); await screen.findByRole("option", { name: /Viagem 39/ }); expect(calls).toHaveLength(2);
  });
  it("Central de Alertas não varre sessões e respeita filtro paginado do servidor", async () => {
    const calls = [];
    api.defaults.adapter = async (c) => {
      calls.push(c);
      if (c.url.endsWith("/cargas")) return reply(c, [{ id: "cargo", viagem_id: "trip", identificacao: "Carga teste" }]);
      if (c.url.endsWith("/monitoramentos")) return reply(c, [{ id: "session", carga_id: "cargo", viagem_id: "trip", lote_codigo: "Lote teste", estado: "ENCERRADA" }]);
      const collection = c.url.includes("configuracoes-ambientais") ? "configuracoes" : c.url.includes("avaliacoes-preventivas") ? "avaliacoes" : "alertas";
      return reply(c, { total: 0, [collection]: [] });
    };
    render(<MemoryRouter><Alertas user={user("CONSULTA")} trips={[{ id: "trip", code: "Viagem teste" }]} /></MemoryRouter>); expect(calls).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Viagem dos alertas"), { target: { value: "trip" } }); await screen.findByRole("option", { name: "Carga teste" }); expect(calls).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Carga dos alertas"), { target: { value: "cargo" } }); await screen.findByRole("option", { name: "Lote teste · ENCERRADA" }); expect(calls).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Sessão dos alertas"), { target: { value: "session" } }); fireEvent.click(screen.getByText("Abrir avaliação preventiva e alertas")); await waitFor(() => expect(calls).toHaveLength(5));
    fireEvent.change(screen.getByLabelText("Situação dos alertas"), { target: { value: "RESOLVIDO" } }); await waitFor(() => expect(calls.at(-1).url).toContain("alertas?status=RESOLVIDO")); expect(calls.at(-1).params.offset).toBe(0); expect(calls.every((c) => c.method === "get")).toBe(true);
    expect(within(screen.getByRole("navigation", { name: "Paginação: sessões dos alertas" })).getByText(/Registros carregados/)).toBeTruthy();
  });
});
