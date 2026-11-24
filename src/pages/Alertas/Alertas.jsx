import { useState } from "react";
import Card from "../../components/UI/Card";
import Select from "../../components/UI/Select";
import ListProgress from "../../components/UI/ListProgress";
import PreventivePanel from "../../components/Monitoring/PreventivePanel";
import useIncrementalList from "../../hooks/useIncrementalList";
import useViagemCargas from "../../hooks/useViagemCargas";
import { sessionList } from "../../services/pagedLists";

export default function Alertas({ user, trips = [], tripsLoading, tripsError, onRetryTrips }) {
  const [tripId, setTripId] = useState("");
  const trip = trips.find((row) => row.id === tripId);
  return <div className="logistics-page"><h1 className="page-title">Central de Alertas</h1>
    <p>Alertas operacionais registrados pelo backend. Ausência de alertas não comprova ausência de gás nem normalidade ambiental.</p>
    <Card title="Contexto dos alertas"><Select label="Viagem dos alertas" value={trip?.id || ""} disabled={tripsLoading} onChange={(e) => setTripId(e.target.value)} options={[{ value: "", label: "Selecione uma viagem" }, ...trips.map((row) => ({ value: row.id, label: row.code || row.id }))]} />
      {tripsError && <><p role="alert">{tripsError}</p><button type="button" onClick={onRetryTrips}>Atualizar viagens</button></>}
    </Card>
    {trip && <CargoContext key={trip.id} trip={trip} user={user} />}
  </div>;
}
function CargoContext({ trip, user }) {
  const list = useViagemCargas(trip.id);
  const [cargoId, setCargoId] = useState("");
  const cargo = list.records.find((row) => row.id === cargoId);
  const [busy, setBusy] = useState(false);
  return <><Card title="Carga dos alertas"><Select label="Carga dos alertas" value={cargo?.id || ""} disabled={busy || list.loading} onChange={(e) => setCargoId(e.target.value)} options={[{ value: "", label: "Selecione uma carga" }, ...list.records.map((row) => ({ value: row.id, label: row.code || row.id }))]} />
    <ListProgress list={list} label="cargas dos alertas" disabled={busy} /></Card>
    {cargo && <SessionContext key={cargo.id} cargo={cargo} trip={trip} user={user} busy={busy} onBusy={setBusy} />}
  </>;
}
function SessionContext({ cargo, trip, user, busy, onBusy }) {
  const list = useIncrementalList(cargo.id, sessionList);
  const [sessionId, setSessionId] = useState("");
  const session = list.records.find((row) => row.id === sessionId && row.viagem_id === trip.id);
  return <><Card title="Sessão dos alertas"><Select label="Sessão dos alertas" value={session?.id || ""} disabled={busy || list.loading} onChange={(e) => setSessionId(e.target.value)} options={[{ value: "", label: "Selecione uma sessão" }, ...list.records.filter((row) => row.viagem_id === trip.id).map((row) => ({ value: row.id, label: `${row.lote_codigo || row.id} · ${row.estado}` }))]} /><ListProgress list={list} label="sessões dos alertas" disabled={busy} /></Card>
    {session && <PreventivePanel key={session.id} session={session} trip={trip} user={user} busy={busy} onBusy={onBusy} />}
  </>;
}
