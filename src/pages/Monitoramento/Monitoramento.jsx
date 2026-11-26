import { Info, RefreshCw } from "lucide-react";
import "./MonitoramentoVisual.css";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../../services/api";
import { readLogistics, readTrip, LOGISTICS_PAGE_SIZE, logisticsError } from "../../services/logisticsService";
import Card from "../../components/UI/Card";
import Select from "../../components/UI/Select";
import Button from "../../components/UI/Button";
import CargoMonitoringPanel from "../../components/Monitoring/CargoMonitoringPanel";

export default function Monitoramento({ user, trips = [], tripsLoading, tripsError, onRetryTrips }) {
  const location = useLocation();
  const [tripId, setTripId] = useState(location.state?.tripId || "");
  const [busy, setBusy] = useState(false);
  const trip = trips.find((item) => item.id === tripId);
  return <div className="logistics-page monitoring-visual">
    <h1 className="page-title">Monitoramento</h1>
    <div className="visual-notice"><Info size={20} /><div><strong>Monitoramento ambiental</strong><p>Consulte declarações, sessões e qualidade das leituras de temperatura e umidade. A produção potencial de etileno é consultada separadamente em Análises de Etileno.</p></div></div>
    <Card title="Selecione a viagem" action={<Button variant="secondary" disabled={busy || tripsLoading} onClick={onRetryTrips}><RefreshCw size={16} /> Atualizar viagens</Button>}>
      <Select label="Viagem do monitoramento" value={trip?.id || ""} disabled={busy || tripsLoading || Boolean(tripsError)} options={[{ value: "", label: "Selecione uma viagem" }, ...trips.map((item) => ({ value: item.id, label: `${item.code && item.code !== item.id ? item.code : `#${String(item.id).slice(0, 8)}`} · ${item.origin || ""} → ${item.destination || ""}` }))]} onChange={(event) => setTripId(event.target.value)} />
      {tripsLoading && <p role="status">Carregando viagens…</p>}
      {tripsError && <p role="alert">{tripsError}</p>}
      {!tripsLoading && !tripsError && !trips.length && <p>Nenhuma viagem disponível para este usuário.</p>}
      
    </Card>
    {trip && !tripsLoading && !tripsError && <CargoSelection key={trip.id} id={trip.id} user={user} busy={busy} onBusy={setBusy} initialId={location.state?.tripId === trip.id ? location.state?.loadId : undefined} />}
  </div>;
}

function CargoSelection({ id, user, busy, onBusy, initialId }) {
  const [offset, setOffset] = useState(0), [refresh, setRefresh] = useState(0), [cargoId, setCargoId] = useState(initialId || "");
  const [view, setView] = useState({ trip: null, records: [], hasNext: false, loading: true, error: "" });
  const [selected, setSelected] = useState({ data: null, loading: false, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setView({ trip: null, records: [], hasNext: false, loading: true, error: "" });
      try {
        const [trip, page] = await Promise.all([readTrip(id, controller.signal), readLogistics("cargas", id, { offset, signal: controller.signal })]);
        if (!controller.signal.aborted) setView({ trip, ...page, loading: false, error: "" });
      } catch (error) { if (!controller.signal.aborted) setView({ trip: null, records: [], hasNext: false, loading: false, error: logisticsError(error) }); }
    }
    load(); return () => controller.abort();
  }, [id, offset, refresh]);
  useEffect(() => {
    if (!cargoId) return;
    const controller = new AbortController();
    async function load() {
      setSelected({ data: null, loading: true, error: "" });
      try {
        const { data } = await api.get(`/api/v1/cargas/${encodeURIComponent(cargoId)}`, { signal: controller.signal });
        if (data?.id !== cargoId || data.viagem_id !== id) throw new Error("Carga incompatível com a viagem selecionada.");
        if (!controller.signal.aborted) setSelected({ data, loading: false, error: "" });
      } catch (error) { if (!controller.signal.aborted) setSelected({ data: null, loading: false, error: logisticsError(error) }); }
    }
    load(); return () => controller.abort();
  }, [cargoId, id, refresh]);
  const options = [...view.records];
  if (selected.data && !options.some((cargo) => cargo.id === selected.data.id)) options.push(selected.data);
  return <>
    <Card title="Carga do monitoramento" action={<Button variant="secondary" disabled={busy || view.loading} onClick={() => setRefresh((n) => n + 1)}><RefreshCw size={16} /> Atualizar cargas do monitoramento</Button>}>
      <Select label="Carga do monitoramento" value={cargoId} disabled={busy || view.loading || Boolean(view.error)} options={[{ value: "", label: "Selecione uma carga" }, ...options.map((cargo) => ({ value: cargo.id, label: cargo.identificacao }))]} onChange={(event) => { setSelected({ data: null, loading: false, error: "" }); setCargoId(event.target.value); }} />
      {view.loading && <p role="status">Consultando cargas autorizadas…</p>}
      {view.error && <p role="alert">{view.error}</p>}
      {!view.loading && !view.error && !view.records.length && <p>Nenhuma carga nesta página.</p>}
      <nav className="logistics-actions" aria-label="Paginação de cargas no monitoramento">
        <Button variant="secondary" disabled={busy || view.loading || offset === 0} onClick={() => { setCargoId(""); setSelected({ data: null, loading: false, error: "" }); setOffset((n) => Math.max(0, n - LOGISTICS_PAGE_SIZE)); }}>Cargas anteriores</Button>
        <span>Página {offset / LOGISTICS_PAGE_SIZE + 1}</span>
        <Button variant="secondary" disabled={busy || view.loading || !view.hasNext} onClick={() => { setCargoId(""); setSelected({ data: null, loading: false, error: "" }); setOffset((n) => n + LOGISTICS_PAGE_SIZE); }}>Próximas cargas</Button>
        
      </nav>
    </Card>
    {cargoId && selected.loading && <p role="status">Consultando a carga…</p>}
    {cargoId && selected.error && <p role="alert">{selected.error}</p>}
    {cargoId && selected.data && view.trip && !view.loading && !view.error && !selected.loading && <CargoMonitoringPanel key={selected.data.id} user={user} trip={view.trip} cargo={selected.data} busy={busy} onBusy={onBusy} />}
  </>;
}
