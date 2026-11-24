// Local visual fixture, excluded from the production build entry points.
// Every HTTP operation is intercepted. No real login, token, or API connection.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { AxiosError } from "axios";
import App from "../src/App";
import api from "../src/services/api";
import { setSessionToken } from "../src/services/session";
import "../src/styles/global.css";

if (!["127.0.0.1", "localhost"].includes(location.hostname)) throw new Error("Fixture exclusivamente local.");
const params = new URLSearchParams(location.search);
const profile = params.get("role") || "GESTOR";
const me = { id: "qa-user", nome: "Teste visual local", email: "qa@example.invalid", ativo: true, perfil: profile, perfil_id: "qa-role", empresas: [{ id: "qa-carrier", tipo: "TRANSPORTADORA", ativo: true }] };
const trips = Array.from({ length: 45 }, (_, n) => ({ id: `qa-trip-${n}`, codigo: `QA-${n + 1}`, origem: "Petrolina", destino: "Recife", transportadora_id: "qa-carrier", status: "EM_ANDAMENTO", inicio_real: new Date(Date.now() - 7200000).toISOString() }));
const cargos = (tripId) => Array.from({ length: 25 }, (_, n) => ({ id: `${tripId}-cargo-${n}`, viagem_id: tripId, identificacao: `Lote hipotético ${n + 1}`, status: "EM_TRANSITO" }));
const sessions = (cargo) => Array.from({ length: 25 }, (_, n) => ({ id: `${cargo.id}-session-${n}`, viagem_id: cargo.viagem_id, carga_id: cargo.id, estado: "ATIVA", ambiente_aquisicao: "TRANSPORTE_REFRIGERADO", inicio: new Date(Date.now() - 3600000).toISOString(), fim: null, lote_codigo: "QA hipotético", lote_hipotetico: true, configuracao_versao: 1, maturacao: "DESCONHECIDA", massa_kg: "1000", produto_identificado: "MANGA_TOMMY_ATKINS", rastreabilidade: "Fixture local sem dados reais" }));
const allCargos = trips.flatMap((trip) => cargos(trip.id));
const allSessions = allCargos.flatMap(sessions);
const page = (rows, c) => rows.slice(c.params?.offset || 0, (c.params?.offset || 0) + (c.params?.limit || 20));
api.defaults.adapter = async (c) => {
  const response = (data, status = 200) => {
    const r = { data, status, statusText: String(status), headers: {}, config: c };
    if (status >= 400) throw new AxiosError("Fixture local", "ERR_BAD_REQUEST", c, {}, r);
    return r;
  };
  if (c.method !== "get") return response({ detail: "Gravações bloqueadas na inspeção visual" }, 405);
  const path = c.url.split("?")[0];
  if (path === "/health") return response({ status: "ok" });
  if (path.endsWith("/auth/me")) return response(me);
  if (path === "/api/v1/viagens") return response(page(trips, c));
  const trip = trips.find((row) => path === `/api/v1/viagens/${row.id}`);
  if (trip) return response(trip);
  const parentTrip = trips.find((row) => path === `/api/v1/viagens/${row.id}/cargas`);
  if (parentTrip) return response(page(cargos(parentTrip.id), c));
  const cargo = allCargos.find((row) => path === `/api/v1/cargas/${row.id}` || path.startsWith(`/api/v1/cargas/${row.id}/`));
  if (cargo) {
    if (path.endsWith("/monitoramentos")) return response(page(sessions(cargo), c));
    if (path.endsWith("/monitoramento")) return response({ carga_id: cargo.id, ...sessions(cargo)[0], versao: 1 });
    return response(cargo);
  }
  const session = allSessions.find((row) => path === `/api/v1/monitoramentos/${row.id}` || path.startsWith(`/api/v1/monitoramentos/${row.id}/`));
  if (session) {
    if (path === `/api/v1/monitoramentos/${session.id}`) return response(session);
    const key = path.endsWith("configuracoes-ambientais") ? "configuracoes" : path.endsWith("avaliacoes-preventivas") ? "avaliacoes" : path.endsWith("intervencoes-simuladas") ? "intervencoes" : "alertas";
    return response({ total: 0, limit: 20, offset: c.params?.offset || 0, [key]: [] });
  }
  return response({ detail: "Rota sem fixture local" }, 404);
};
export function Frame() {
  const [width, setWidth] = useState(1280), [role, setRole] = useState("GESTOR");
  return <><header style={{ padding: 12 }}><strong>QA local · dados fictícios · HTTP bloqueado</strong><label> Largura <select aria-label="Largura de teste" value={width} onChange={(e) => setWidth(Number(e.target.value))}><option value="1280">Desktop 1280 px</option><option value="390">Mobile 390 px</option></select></label><label> Perfil <select aria-label="Perfil de teste" value={role} onChange={(e) => setRole(e.target.value)}>{["ADMIN", "GESTOR", "OPERADOR", "CONSULTA"].map((r) => <option key={r}>{r}</option>)}</select></label></header><iframe title="Aplicação em teste" src={`/tests/browser-qa.html?frame=1&role=${role}`} style={{ display: "block", width, maxWidth: "100%", height: "90vh", border: "1px solid #ccc" }} /></>;
}
const fixtureRoot = import.meta.hot?.data.root || createRoot(document.getElementById("root"));
if (import.meta.hot) import.meta.hot.data.root = fixtureRoot;
if (params.has("frame")) {
  setSessionToken("fixture-local-sem-validade");
  fixtureRoot.render(<MemoryRouter initialEntries={["/alertas"]}><App /></MemoryRouter>);
} else fixtureRoot.render(<Frame />);
