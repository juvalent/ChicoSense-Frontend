import { useEffect, useRef, useState } from "react";
import Input from "../UI/Input";
import Select from "../UI/Select";
import Button from "../UI/Button";
import { acquisitionPayload, synchronizeAcquisition } from "../../services/acquisitionService";
import { lifecycleError, uncertainMutation } from "../../services/monitoringLifecycleService";

export default function SynchronizationForm({ session, user, attempt, setAttempt, runs, busy, onBusy, onDone, onAccepted, onConsult, onClose }) {
  const [values, setValues] = useState(() => attempt?.values || { origem_dados: "", inicio: "", fim: "", max_requisicoes: "16", limite_atraso_s: "", complementar_encerrada: false, justificativa: "" });
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const pending = useRef(false), mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const locked = busy || saving || Boolean(attempt);
  const identified = attempt && runs.find((run) => run.chave_idempotencia === attempt.payload.chave_idempotencia && run.usuario_id === user.id);
  const change = (field, value) => setValues((old) => ({ ...old, [field]: value }));
  async function submit(event) {
    event.preventDefault();
    if (busy || pending.current) return;
    let request;
    try { request = attempt || { payload: acquisitionPayload(values, session, crypto.randomUUID()), values: { ...values } }; }
    catch (failure) { setError(failure.message); return; }
    pending.current = true; setSaving(true); onBusy(true); setError(""); setAttempt(request);
    let result;
    try {
      result = await synchronizeAcquisition(session.id, request.payload);
      setAttempt(result.estado === "EM_EXECUCAO" ? { ...request, running: result.id } : null);
    } catch (failure) {
      setAttempt(uncertainMutation(failure) ? { ...request, uncertain: true } : null);
      if (mounted.current) setError(lifecycleError(failure, true));
    } finally { pending.current = false; if (mounted.current) { setSaving(false); onBusy(false); } }
    if (result && mounted.current) (result.estado === "EM_EXECUCAO" ? onAccepted : onDone)(result);
  }
  return <form className="logistics-form" aria-label="Sincronizar histórico da sessão" onSubmit={submit}>
    <h3>Sincronização explícita</h3>
    <p>BANCO incorpora somente medições externas das fontes vinculadas à sessão; não gera dados de teste. THINGSPEAK usa a integração configurada no backend. Nenhuma chave de canal é informada no navegador.</p>
    <div className="logistics-controls">
      <Select label="Origem dos dados" required disabled={locked} value={values.origem_dados} options={[{ value: "", label: "Selecione a origem" }, { value: "BANCO", label: "BANCO" }, { value: "THINGSPEAK", label: "THINGSPEAK" }]} onChange={(event) => change("origem_dados", event.target.value)} />
      <Input label="Início da sincronização" type="datetime-local" required disabled={locked} value={values.inicio} onChange={(event) => change("inicio", event.target.value)} />
      <Input label="Fim da sincronização" type="datetime-local" required disabled={locked} value={values.fim} onChange={(event) => change("fim", event.target.value)} />
      <Input label="Limite de requisições" type="number" min={1} max={32} step={1} required disabled={locked} value={values.max_requisicoes} onChange={(event) => change("max_requisicoes", event.target.value)} />
      <Input label="Limite de atraso (s, opcional)" inputMode="decimal" disabled={locked} value={values.limite_atraso_s} onChange={(event) => change("limite_atraso_s", event.target.value)} />
    </div>
    {session.estado === "ENCERRADA" && <label><input type="checkbox" required disabled={locked} checked={values.complementar_encerrada} onChange={(event) => change("complementar_encerrada", event.target.checked)} /> Confirmo a complementação da sessão encerrada</label>}
    <label className="form-field">Justificativa da sincronização<textarea className="input" maxLength={2000} required={session.estado === "ENCERRADA"} disabled={locked} value={values.justificativa} onChange={(event) => change("justificativa", event.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    {attempt && <p>Solicitação preservada: uma tentativa manual usará o mesmo conteúdo e a mesma chave. Execução pendente não comprova coleta concluída.</p>}
    {identified && <Button variant="secondary" disabled={busy} onClick={() => {
      if (identified.estado === "EM_EXECUCAO") { setAttempt({ ...attempt, running: identified.id }); onAccepted(identified); }
      else { setAttempt(null); onDone(identified); }
    }}>Consultar solicitação identificada</Button>}
    <div className="logistics-actions">
      <Button type="submit" loading={saving} disabled={busy && !saving}>{attempt ? "Reconsultar mesma solicitação" : "Confirmar sincronização"}</Button>
      <Button variant="secondary" disabled={busy} onClick={onConsult}>Consultar tentativas</Button>
      <Button variant="secondary" disabled={busy} onClick={onClose}>Fechar sincronização</Button>
    </div>
  </form>;
}
