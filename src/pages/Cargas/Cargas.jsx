import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Select from "../../components/UI/Select";
import Card from "../../components/UI/Card";
import Button from "../../components/UI/Button";
import LogisticsRecords from "../../components/Logistics/LogisticsRecords";
import TripOperations from "../../components/Logistics/TripOperations";
import { logisticsError, readTrip } from "../../services/logisticsService";

export default function Cargas({ trips = [], loading, error, onRetry, user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [tripId, setTripId] = useState(location.state?.tripId ?? null);
  const [busy, setBusy] = useState(false);
  const selected = tripId === null ? trips[0] : trips.find((trip) => trip.id === tripId);
  return <div className="logistics-page">
    <h1 className="page-title">Cargas de Manga</h1>
    <p>Organize viagem, cargas e caixas. Os estados são atualizados separadamente e preservam o histórico.</p>
    <Card title="Viagem selecionada">
      <Select label="Viagem das cargas" value={selected?.id || ""} disabled={busy || loading || Boolean(error)}
        options={[{ value: "", label: "Selecione uma viagem" }, ...trips.map((trip) => ({ value: trip.id, label: `${trip.code || trip.id} · ${trip.origin || ""} → ${trip.destination || ""}` }))]}
        onChange={(event) => setTripId(event.target.value)} />
      {loading && <p role="status">Carregando viagens…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !trips.length && <p>Nenhuma viagem disponível para este usuário.</p>}
      <Button variant="secondary" disabled={busy || loading} onClick={onRetry}>Atualizar viagens</Button>
    </Card>
    {selected && !loading && !error && <CargoWorkspace key={selected.id} user={user} id={selected.id} busy={busy} onBusy={setBusy} onTripSaved={onRetry}
      initialCargoId={location.state?.tripId === selected.id ? location.state?.loadId : undefined}
      onMonitor={(cargoId) => navigate("/monitoramento", { state: { tripId: selected.id, loadId: cargoId } })} />}
  </div>;
}

function CargoWorkspace({ id, user, busy, onBusy, initialCargoId, onTripSaved, onMonitor }) {
  const [view, setView] = useState({ trip: null, loading: true, error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setView({ trip: null, loading: true, error: "" });
      try {
        const trip = await readTrip(id, controller.signal);
        if (!controller.signal.aborted) setView({ trip, loading: false, error: "" });
      } catch (error) { if (!controller.signal.aborted) setView({ trip: null, loading: false, error: logisticsError(error) }); }
    }
    load(); return () => controller.abort();
  }, [id, retry]);
  if (view.loading) return <p role="status">Consultando viagem…</p>;
  if (view.error) return <Card><p role="alert">{view.error}</p><Button onClick={() => setRetry((n) => n + 1)}>Tentar novamente</Button></Card>;
  return <>
    <TripOperations user={user} trip={view.trip} onBusy={onBusy} onSaved={(trip) => { setView({ trip, loading: false, error: "" }); onTripSaved?.(); }} />
    <LogisticsRecords kind="cargas" parentId={id} trip={view.trip} user={user} busy={busy} onBusy={onBusy} initialCargoId={initialCargoId} onMonitor={onMonitor} />
  </>;
}
