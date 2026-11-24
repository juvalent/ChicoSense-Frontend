import { useEffect, useState } from "react";
import Input from "../UI/Input";
import Select from "../UI/Select";
import Button from "../UI/Button";
import { iniciarSessao } from "../../services/monitoramentoService";
import { inspectSessionHistory, lifecycleError, sessionEnvironments, startSessionPayload } from "../../services/monitoringLifecycleService";
import useMutationAttempt from "./useMutationAttempt";

export default function StartSessionForm({ cargo, trip, user, attempt, setAttempt, busy, onBusy, onSaved, onCancel }) {
  const [values, setValues] = useState(() => attempt?.values || { inicio: "", ambiente_aquisicao: "", sensor_temperatura_id: "", sensor_umidade_id: "", observacoes: "" });
  const [history, setHistory] = useState({ loading: true, error: "", sessions: [], temperature: [], humidity: [] });
  const [refresh, setRefresh] = useState(0);
  const mutation = useMutationAttempt(attempt, setAttempt, onBusy, onSaved);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setHistory({ loading: true, error: "", sessions: [], temperature: [], humidity: [] });
      try {
        const data = await inspectSessionHistory(cargo.id, trip.id, controller.signal);
        if (!controller.signal.aborted) setHistory({ ...data, loading: false, error: "" });
      } catch (error) { if (!controller.signal.aborted) setHistory({ loading: false, error: lifecycleError(error), sessions: [], temperature: [], humidity: [] }); }
    }
    load(); return () => controller.abort();
  }, [cargo.id, trip.id, refresh]);
  const previousKey = attempt?.payload?.chave_idempotencia;
  const previous = previousKey && history.sessions.find((session) => session.chave_idempotencia === previousKey && session.criada_por_id === user.id);
  const active = history.sessions.some((session) => session.estado === "ATIVA");
  const eligible = (sensors) => sensors.filter((sensor) => values.ambiente_aquisicao !== "TRANSPORTE_REFRIGERADO" || sensor.contexto !== "PROTOTIPO");
  const temperature = eligible(history.temperature), humidity = eligible(history.humidity);
  const available = !history.loading && !history.error && !active && !previous && temperature.length > 0;
  const locked = busy || mutation.saving || mutation.frozen;
  const change = (field, value) => setValues((old) => ({ ...old, [field]: value }));
  async function send(payload) {
    const result = await iniciarSessao(cargo.id, payload);
    if (result?.carga_id !== cargo.id || result?.viagem_id !== trip.id) throw new Error("Resposta de sessão incompatível.");
    return result;
  }
  return <form className="logistics-form" aria-label="Iniciar sessão de monitoramento" onSubmit={(event) => {
    if (!available && !mutation.frozen) { event.preventDefault(); return; }
    mutation.submit(event, { values, busy, send, build: () => {
      if (!temperature.some((sensor) => sensor.id === values.sensor_temperatura_id) || (values.sensor_umidade_id && !humidity.some((sensor) => sensor.id === values.sensor_umidade_id))) throw new Error("Selecione sensores do histórico autorizado desta carga.");
      return startSessionPayload(values, trip, cargo, crypto.randomUUID());
    } });
  }}>
    <h3>Iniciar sessão</h3>
    <p>Os sensores listados vêm de sessões anteriores desta carga. O servidor validará vínculo, tipo, unidade, estado atual e conflitos de janela. Iniciar a sessão não sincroniza leituras automaticamente.</p>
    {history.loading && <p role="status">Consultando o histórico autorizado de sensores…</p>}
    {history.error && <p role="alert">{history.error}</p>}
    {previous && <><p>Solicitação anterior localizada no histórico. Consulte a sessão antes de iniciar outra.</p><Button variant="secondary" disabled={busy} onClick={() => { setAttempt(null); onSaved(previous); }}>Consultar sessão confirmada</Button></>}
    {!history.loading && !history.error && active && !previous && <p>Há uma sessão ativa nesta carga. Consulte e finalize essa sessão antes de iniciar outra.</p>}
    {!history.loading && !history.error && !history.temperature.length && <p>Não há sensores selecionáveis no histórico desta carga. A primeira sessão depende do provisionamento e de um catálogo de sensores no backend, ainda indisponível nesta interface.</p>}
    <div className="logistics-controls">
      <Input label="Início efetivo da sessão" type="datetime-local" value={values.inicio} required disabled={locked} onChange={(event) => change("inicio", event.target.value)} />
      <Select label="Ambiente de aquisição" value={values.ambiente_aquisicao} required disabled={locked} options={[{ value: "", label: "Selecione o ambiente" }, ...sessionEnvironments.map((value) => ({ value, label: value }))]} onChange={(event) => setValues((old) => ({ ...old, ambiente_aquisicao: event.target.value, sensor_temperatura_id: "", sensor_umidade_id: "" }))} />
      <Select label="Sensor de temperatura da sessão" value={values.sensor_temperatura_id} required disabled={locked || history.loading} options={[{ value: "", label: "Selecione um sensor já registrado" }, ...temperature.map((sensor) => ({ value: sensor.id, label: `${sensor.label} · ${sensor.unidade}` }))]} onChange={(event) => change("sensor_temperatura_id", event.target.value)} />
      <Select label="Sensor de umidade da sessão" value={values.sensor_umidade_id} disabled={locked || history.loading} options={[{ value: "", label: "Sem sensor de umidade" }, ...humidity.map((sensor) => ({ value: sensor.id, label: `${sensor.label} · ${sensor.unidade}` }))]} onChange={(event) => change("sensor_umidade_id", event.target.value)} />
    </div>
    <label className="form-field">Observações da sessão<textarea className="input" rows={3} maxLength={2000} disabled={locked} value={values.observacoes} onChange={(event) => change("observacoes", event.target.value)} /></label>
    {mutation.error && <p role="alert">{mutation.error}</p>}
    {mutation.frozen && <p>Resposta incerta: a próxima tentativa preservará o conteúdo e a mesma chave idempotente. Nenhum novo início será gerado automaticamente.</p>}
    <div className="logistics-actions"><Button type="submit" loading={mutation.saving} disabled={(busy && !mutation.saving) || history.loading || Boolean(previous) || (!available && !mutation.frozen)}>{mutation.frozen ? "Reenviar mesma solicitação" : "Confirmar início da sessão"}</Button><Button variant="secondary" disabled={busy || mutation.saving} onClick={() => setRefresh((n) => n + 1)}>Conferir sessões existentes</Button><Button variant="secondary" disabled={busy || mutation.saving} onClick={onCancel}>Fechar início</Button></div>
  </form>;
}
