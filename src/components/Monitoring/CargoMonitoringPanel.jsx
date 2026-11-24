import { useEffect, useState } from "react";
import Card from "../UI/Card";
import Button from "../UI/Button";
import CargoDeclaration from "../Cards/CargoDeclaration";
import DeclarationEditor from "./DeclarationEditor";
import StartSessionForm from "./StartSessionForm";
import EndSessionForm from "./EndSessionForm";
import { obterMonitoramentoCarga } from "../../services/cargaService";
import { canOperateTrip } from "../../services/logisticsService";
import { lifecycleError, normalizedCargo, normalizedTrip, readSession, readSessionPage, SESSION_PAGE_SIZE } from "../../services/monitoringLifecycleService";
import "../Logistics/Logistics.css";

export default function CargoMonitoringPanel(props) {
  return <MonitoringWorkspace key={`${props.trip.id}:${props.cargo.id}:${props.user?.id || "reader"}`} {...props} />;
}

function MonitoringWorkspace({ user, cargo: sourceCargo, trip: sourceTrip, busy = false, onBusy = () => {}, onChanged = () => {}, onMonitor }) {
  const cargo = normalizedCargo(sourceCargo), trip = normalizedTrip(sourceTrip);
  const canWrite = canOperateTrip(user, trip);
  const [view, setView] = useState({ declaration: null, sessions: [], hasNext: false, loading: true, error: "" });
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState({ data: null, loading: false, error: "" });
  const [declarationAttempt, setDeclarationAttempt] = useState(null);
  const [startAttempt, setStartAttempt] = useState(null);
  const [endAttempts, setEndAttempts] = useState({});
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setView({ declaration: null, sessions: [], hasNext: false, loading: true, error: "" });
      try {
        const [declaration, page] = await Promise.all([
          obterMonitoramentoCarga(cargo.id, { signal: controller.signal }),
          readSessionPage(cargo.id, trip.id, { offset, signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) setView({ declaration, sessions: page.records, hasNext: page.hasNext, loading: false, error: "" });
      } catch (error) { if (!controller.signal.aborted) setView({ declaration: null, sessions: [], hasNext: false, loading: false, error: lifecycleError(error) }); }
    }
    load(); return () => controller.abort();
  }, [cargo.id, trip.id, offset, refresh]);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    async function load() {
      setDetail({ data: null, loading: true, error: "" });
      try {
        const data = await readSession(selectedId, cargo.id, trip.id, controller.signal);
        if (!controller.signal.aborted) setDetail({ data, loading: false, error: "" });
      } catch (error) { if (!controller.signal.aborted) setDetail({ data: null, loading: false, error: lifecycleError(error) }); }
    }
    load(); return () => controller.abort();
  }, [selectedId, cargo.id, trip.id, refresh]);
  const closed = ["ENTREGUE", "CANCELADA"].includes(cargo.status) || ["CONCLUIDA", "CANCELADA"].includes(trip.status);
  const knownActive = view.sessions.some((session) => session.estado === "ATIVA");
  const canDeclare = canWrite && !closed && !knownActive;
  const canStart = canWrite && Boolean(view.declaration) && trip.status === "EM_ANDAMENTO" && cargo.status === "EM_TRANSITO" && !knownActive;
  function open(kind) { if (busy) return; setNotice(""); setForm({ kind }); }
  function changed(message, session) {
    setForm(null); setNotice(message); setRefresh((value) => value + 1);
    if (session) setSelectedId(session.id);
    onChanged();
  }
  function end(action) {
    if (busy || !detail.data || detail.data.estado !== "ATIVA") return;
    setForm({ kind: "end", action, session: detail.data });
  }
  const pendingEnd = detail.data && ["ENCERRADA", "CANCELADA"].find((action) => endAttempts[`${detail.data.id}:${action}`]?.uncertain);
  return <Card title="Declaração e sessões de monitoramento" description={`Carga ${cargo.identificacao || cargo.code || cargo.id}`}>
    {notice && <p role="status">{notice}</p>}
    {view.loading && <p role="status">Consultando declaração e sessões…</p>}
    {view.error && <p role="alert">{view.error}</p>}
    <div className="logistics-actions">
      <Button variant="secondary" disabled={busy || view.loading} onClick={() => { setForm(null); setRefresh((value) => value + 1); }}>Atualizar declaração e sessões</Button>
      {!view.loading && !view.error && canDeclare && <Button disabled={busy} onClick={() => open("declaration")}>{view.declaration ? "Editar declaração" : "Declarar monitoramento"}</Button>}
      {!view.loading && !view.error && canStart && <Button disabled={busy} onClick={() => open("start")}>Iniciar sessão</Button>}
      {onMonitor && <Button variant="secondary" disabled={busy} onClick={() => onMonitor(cargo.id)}>Ir ao monitoramento</Button>}
    </div>
    {!view.loading && !view.error && (view.declaration ? <CargoDeclaration declaration={view.declaration} /> : <p>Dados de monitoramento ainda não declarados. Ausência de declaração não significa produção zero.</p>)}
    {!canWrite && <p>Consulta somente. Operações exigem vínculo com a transportadora desta viagem e perfil autorizado.</p>}
    {knownActive && <p>Há sessão ativa nesta página. Encerre ou cancele a sessão antes de alterar a declaração ou iniciar outra.</p>}
    {canWrite && closed && <p>Carga ou viagem encerrada: a declaração permanece histórica. Uma sessão ainda ativa pode ser finalizada conforme suas regras de janela.</p>}
    {form?.kind === "declaration" && canDeclare && <DeclarationEditor cargo={cargo} declaration={view.declaration} attempt={declarationAttempt} setAttempt={setDeclarationAttempt} busy={busy} onBusy={onBusy} onSaved={() => changed("Declaração confirmada.")} onCancel={() => setForm(null)} />}
    {form?.kind === "start" && canStart && <StartSessionForm cargo={cargo} trip={trip} user={user} attempt={startAttempt} setAttempt={setStartAttempt} busy={busy} onBusy={onBusy} onSaved={(session) => changed("Sessão confirmada.", session)} onCancel={() => setForm(null)} />}
    {!view.loading && !view.error && <>
      <h3>Sessões da carga</h3>
      {!view.sessions.length && <p>Nenhuma sessão nesta página.</p>}
      {!!view.sessions.length && <div className="logistics-table"><table>
        <caption>Sessões autorizadas desta carga</caption>
        <thead><tr><th scope="col">Início</th><th scope="col">Estado</th><th scope="col">Lote / versão</th><th scope="col">Ação</th></tr></thead>
        <tbody>{view.sessions.map((session) => <tr key={session.id}><td>{new Date(session.inicio).toLocaleString("pt-BR")}</td><td>{session.estado}</td><td>{session.lote_codigo} · {session.configuracao_versao}</td><td><Button variant="secondary" disabled={busy} onClick={() => { setForm(null); setDetail({ data: null, loading: true, error: "" }); setSelectedId(session.id); }}>Consultar sessão {session.id.slice(0, 8)}</Button></td></tr>)}</tbody>
      </table></div>}
      <nav className="logistics-actions" aria-label="Paginação de sessões da carga">
        <Button variant="secondary" disabled={busy || offset === 0} onClick={() => { setForm(null); setSelectedId(""); setOffset((value) => Math.max(0, value - SESSION_PAGE_SIZE)); }}>Sessões anteriores</Button>
        <span>Página {offset / SESSION_PAGE_SIZE + 1}</span>
        <Button variant="secondary" disabled={busy || !view.hasNext} onClick={() => { setForm(null); setSelectedId(""); setOffset((value) => value + SESSION_PAGE_SIZE); }}>Próximas sessões</Button>
      </nav>
    </>}
    {selectedId && <Card title="Snapshot da sessão">
      {detail.loading && <p role="status">Consultando sessão…</p>}
      {detail.error && <p role="alert">{detail.error}</p>}
      {detail.data && <>
        <p>Estado: {detail.data.estado} · Ambiente: {detail.data.ambiente_aquisicao}</p>
        <p>Início: {new Date(detail.data.inicio).toLocaleString("pt-BR")} · Fim: {detail.data.fim ? new Date(detail.data.fim).toLocaleString("pt-BR") : "Em aberto"}</p>
        <CargoDeclaration declaration={{ ...detail.data, versao: detail.data.configuracao_versao }} />
        <p>Sensor de temperatura: {detail.data.origem_sensor?.temperatura?.identificador || "Identificação indisponível"}. Sensor de umidade: {detail.data.origem_sensor?.umidade?.identificador || "Não informado"}.</p>
        {detail.data.motivo_fim && <p>Motivo: {detail.data.motivo_fim}</p>}
        {detail.data.observacoes && <p>{detail.data.observacoes}</p>}
        <p>A sessão preserva a declaração de sua abertura. Sessão ativa não comprova ingestão contínua, medição de etileno ou funcionamento de hardware.</p>
        {detail.data.estado !== "ATIVA" && <p>Sessão finalizada: não pode ser reaberta nem ter a janela alterada.</p>}
        {canWrite && detail.data.estado === "ATIVA" && <div className="logistics-actions">
          <Button disabled={busy || trip.status === "CANCELADA" || (pendingEnd && pendingEnd !== "ENCERRADA")} onClick={() => end("ENCERRADA")}>Encerrar sessão</Button>
          <Button variant="secondary" disabled={busy || (pendingEnd && pendingEnd !== "CANCELADA")} onClick={() => end("CANCELADA")}>Cancelar sessão</Button>
        </div>}
      </>}
    </Card>}
    {form?.kind === "end" && canWrite && <EndSessionForm key={`${form.session.id}:${form.action}`} session={form.session} trip={trip} action={form.action}
      attempt={endAttempts[`${form.session.id}:${form.action}`] || null} setAttempt={(value) => setEndAttempts((old) => ({ ...old, [`${form.session.id}:${form.action}`]: value }))}
      busy={busy} onBusy={onBusy} onSaved={(session) => changed("Finalização confirmada.", session)} onCancel={() => setForm(null)} />}
  </Card>;
}
