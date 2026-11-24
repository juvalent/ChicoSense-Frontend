import { useEffect, useState } from "react";
import Card from "../UI/Card";
import ClimateChart from "../Charts/ClimateChart";
import { normalizarLeituras } from "../../services/monitoramentoService";
import useIncrementalList from "../../hooks/useIncrementalList";
import { tripSessionList } from "../../services/pagedLists";
import ListProgress from "../UI/ListProgress";
import { loadSessionPage, READING_PAGE_SIZE } from "../../services/sessionReadings";

function errorMessage(error) {
  if (error?.response?.status === 403) return "Sem permissão para consultar esta sessão.";
  if (error?.response?.status === 401) return "Sua sessão expirou. Faça login novamente.";
  return "Não foi possível consultar os dados. Tente novamente.";
}

export default function SessionReadingsPanel({ trips = [] }) {
  const [tripId, setTripId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [page, setPage] = useState({ data: null, error: "", loading: false });
  const [request, setRequest] = useState({});
  const [refresh, setRefresh] = useState(0);
  const validTrip = trips.some((trip) => String(trip.id) === tripId);
  const sessionList = useIncrementalList(validTrip ? tripId : "", tripSessionList);
  const sessions = sessionList.records, sessionLoading = sessionList.loading, sessionError = sessionList.error;
  const selected = validTrip && sessions.find((session) => session.id === sessionId);
  const selectedId = selected?.id || "";

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    async function load() {
      setPage({ data: null, error: "", loading: true });
      return loadSessionPage(selectedId, request);
    }
    load()
      .then((data) => { if (!cancelled) setPage({ data, error: "", loading: false }); })
      .catch((error) => { if (!cancelled) setPage({ data: null, error: errorMessage(error), loading: false }); });
    return () => { cancelled = true; };
  }, [selectedId, request, refresh]);

  const data = selected ? page.data : null;
  const groups = new Map();
  normalizarLeituras(data?.leituras ?? []).forEach((reading) => {
    const item = groups.get(reading.timestamp) ?? { timestamp: reading.timestamp, temperature: null, humidity: null };
    if (reading.tipo === "TEMPERATURA") item.temperature = reading.valor;
    if (reading.tipo === "UMIDADE") item.humidity = reading.valor;
    groups.set(reading.timestamp, item);
  });

  return <Card className="session-readings" title="Leituras por sessão" description="Selecione uma viagem e uma sessão. A consulta inicial mostra a última página da revisão disponível.">
    <div className="monitoramento-filtros">
      <label>Viagem das leituras
        <select value={validTrip ? tripId : ""} onChange={(event) => {
          setTripId(event.target.value); setSessionId(""); setPage({ data: null, error: "", loading: false }); setRequest({});
        }}>
          <option value="">Selecione uma viagem</option>
          {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.code || trip.id} · {trip.origin} → {trip.destination}</option>)}
        </select>
      </label>
      <label>Sessão das leituras
        <select value={selected ? sessionId : ""} disabled={!validTrip || sessionLoading} onChange={(event) => {
          setSessionId(event.target.value); setPage({ data: null, error: "", loading: false }); setRequest({});
        }}>
          <option value="">Selecione uma sessão</option>
          {sessions.map((session) => <option key={session.id} value={session.id}>{session.lote_codigo || session.id} · {session.estado}</option>)}
        </select>
      </label>
      <button type="button" className="button button--secondary" disabled={!validTrip || sessionLoading || page.loading} onClick={() => { setRequest({}); setRefresh((n) => n + 1); }}>Atualizar leituras</button>
    </div>
    {validTrip && <ListProgress list={sessionList} label="sessões das leituras" />}
    {sessionLoading && <p role="status">Consultando sessões…</p>}
    {validTrip && !sessionLoading && !sessionError && sessions.length === 0 && <p>Nenhuma sessão disponível nesta viagem.</p>}
    {!selected && <p>Selecione uma sessão para consultar as leituras. Conexão com a API não comprova recebimento de dados IoT.</p>}
    {selected && <>
      <p>{selected.lote_hipotetico ? "Lote hipotético · " : ""}{selected.ambiente_aquisicao} · Sessão {selected.estado}. Sessão ativa não comprova aquisição contínua.</p>
      <ClimateChart title="Temperatura e umidade da sessão" description="Leituras registradas nesta página; não representa medição de etileno." readings={[...groups.values()]} loading={page.loading} error={page.error} onRetry={() => setRefresh((n) => n + 1)} />
      {data && <nav aria-label="Paginação das leituras">
        <p role="status">Registros {data.total ? data.offset + 1 : 0}–{data.offset + data.leituras.length} de {data.total} · Revisão {data.revisao}</p>
        <button type="button" className="button button--secondary" disabled={page.loading || data.offset === 0} onClick={() => setRequest({ offset: Math.max(0, data.offset - READING_PAGE_SIZE), revision: data.revisao })}>Leituras anteriores</button>
        <button type="button" className="button button--secondary" disabled={page.loading || data.offset + data.limit >= data.total} onClick={() => setRequest({ offset: data.offset + READING_PAGE_SIZE, revision: data.revisao })}>Leituras seguintes</button>
      </nav>}
    </>}
  </Card>;
}
