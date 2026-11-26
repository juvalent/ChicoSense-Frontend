import { useState } from "react";
import Input from "../UI/Input";
import Button from "../UI/Button";
import { cancelarSessao, encerrarSessao } from "../../services/monitoramentoService";
import { endSessionPayload } from "../../services/monitoringLifecycleService";
import useMutationAttempt from "./useMutationAttempt";

export default function EndSessionForm({ session, trip, action, attempt, setAttempt, busy, onBusy, onSaved, onCancel }) {
  const [values, setValues] = useState(() => attempt?.values || { fim: "", motivo: "" });
  const mutation = useMutationAttempt(attempt, setAttempt, onBusy, onSaved);
  const locked = busy || mutation.saving || mutation.frozen;
  async function send(payload) {
    const saved = await (action === "ENCERRADA" ? encerrarSessao : cancelarSessao)(session.id, payload);
    if (saved?.id !== session.id || saved?.carga_id !== session.carga_id || saved?.estado !== action) throw new Error("Resposta de finalização incompatível.");
    return saved;
  }
  return <form className="logistics-form" aria-label={action === "ENCERRADA" ? "Encerrar sessão de monitoramento" : "Cancelar sessão de monitoramento"}
    onSubmit={(event) => mutation.submit(event, { busy, values, build: () => endSessionPayload(values, session, trip, action), send })}>
    <h3>{action === "ENCERRADA" ? "Encerrar" : "Cancelar"} sessão</h3>
    <Input label="Fim efetivo da sessão" type="datetime-local" required value={values.fim} disabled={locked} onChange={(event) => setValues((old) => ({ ...old, fim: event.target.value }))} />
    <label className="form-field">Motivo da finalização<textarea className="input" required maxLength={2000} rows={3} disabled={locked} value={values.motivo} onChange={(event) => setValues((old) => ({ ...old, motivo: event.target.value }))} /></label>
    <p>A janela deve terminar depois do início, sem data futura ou posterior à chegada real. A finalização é imutável e não apaga leituras nem comanda hardware.</p>
    {mutation.error && <p role="alert">{mutation.error}</p>}
    {mutation.frozen && <p>Resposta incerta: a próxima tentativa usará o mesmo fim, motivo e operação. Confira o estado da sessão antes de reenviar.</p>}
    <div className="logistics-actions"><Button type="submit" loading={mutation.saving} disabled={busy && !mutation.saving}>{mutation.frozen ? "Reenviar mesma finalização" : "Confirmar finalização"}</Button><Button variant="secondary" disabled={busy || mutation.saving} onClick={onCancel}>Fechar finalização</Button></div>
  </form>;
}
