import { useEffect, useRef, useState } from "react";
import Card from "../UI/Card";
import Input from "../UI/Input";
import Select from "../UI/Select";
import Button from "../UI/Button";
import { canOperateTrip, logisticsError, readTrip, saveTrip, tripPayload } from "../../services/logisticsService";
import "./Logistics.css";

const transitions = { PLANEJADA: ["EM_ANDAMENTO", "CANCELADA"], EM_ANDAMENTO: ["CONCLUIDA"], CONCLUIDA: [], CANCELADA: [] };
export default function TripOperations({ user, trip, busy = false, onSaved, onBusy = () => {} }) {
  return canOperateTrip(user, trip) ? <TripForm key={trip.id} id={trip.id} user={user} busy={busy} onSaved={onSaved} onBusy={onBusy} /> : null;
}
function TripForm({ id, user, busy, onSaved, onBusy }) {
  const [view, setView] = useState({ data: null, loading: true, error: "" });
  const [values, setValues] = useState({ status: "", inicio_real: "", chegada_em: "", observacoes: "" });
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setView({ data: null, loading: true, error: "" });
      try {
        const data = await readTrip(id, controller.signal);
        if (!controller.signal.aborted) { setView({ data, loading: false, error: "" }); setValues({ status: data.status, inicio_real: "", chegada_em: "", observacoes: data.observacoes ?? "" }); }
      } catch (error) { if (!controller.signal.aborted) setView({ data: null, loading: false, error: logisticsError(error) }); }
    }
    load(); return () => controller.abort();
  }, [id, refresh]);
  const change = (field, value) => setValues((old) => ({ ...old, [field]: value }));
  async function submit(event) {
    event.preventDefault();
    if (pending.current || busy || !view.data || !canOperateTrip(user, view.data)) return;
    let payload;
    try { payload = tripPayload(view.data, values); } catch (error) { setView((old) => ({ ...old, error: error.message })); return; }
    pending.current = true; setSaving(true); onBusy(true); setNotice("");
    let saved;
    try { saved = await saveTrip(id, payload); }
    catch (error) { if (mounted.current) setView((old) => ({ ...old, error: logisticsError(error, true) })); }
    finally { pending.current = false; if (mounted.current) { setSaving(false); onBusy(false); } }
    if (saved && mounted.current) { setView({ data: saved, loading: false, error: "" }); setValues({ status: saved.status, inicio_real: "", chegada_em: "", observacoes: saved.observacoes ?? "" }); setNotice("Viagem atualizada."); onSaved?.(saved); }
  }
  return <Card title="Operação da viagem">
    {view.loading && <p role="status">Consultando estado da viagem…</p>}
    {notice && <p role="status">{notice}</p>}
    {view.error && <p role="alert">{view.error}</p>}
    <Button variant="secondary" disabled={busy || saving || view.loading} onClick={() => setRefresh((n) => n + 1)}>Atualizar estado da viagem</Button>
    {view.data && canOperateTrip(user, view.data) && <form onSubmit={submit} aria-label="Atualizar viagem" className="logistics-form">
      <Select label="Estado da viagem" value={values.status} disabled={saving} onChange={(event) => change("status", event.target.value)} options={[view.data.status, ...(transitions[view.data.status] || [])].map((value) => ({ value, label: value }))} />
      {values.status !== view.data.status && ["EM_ANDAMENTO", "CONCLUIDA"].includes(values.status) && !view.data.inicio_real && <Input label="Início real da viagem" type="datetime-local" required disabled={saving} value={values.inicio_real} onChange={(event) => change("inicio_real", event.target.value)} />}
      {values.status !== view.data.status && values.status === "CONCLUIDA" && <Input label="Chegada real da viagem" type="datetime-local" required disabled={saving} value={values.chegada_em} onChange={(event) => change("chegada_em", event.target.value)} />}
      {view.data.inicio_real && <p>Início real registrado: {new Date(view.data.inicio_real).toLocaleString("pt-BR")}</p>}
      <label className="form-field">Observações da viagem<textarea className="input" rows={3} value={values.observacoes} disabled={saving} onChange={(event) => change("observacoes", event.target.value)} /></label>
      <p>Datas e horas usam o horário local do navegador. Alterar a viagem não muda automaticamente cargas, caixas ou sessões.</p>
      <Button type="submit" loading={saving} disabled={busy && !saving}>Salvar viagem</Button>
    </form>}
  </Card>;
}
