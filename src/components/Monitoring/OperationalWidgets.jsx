import { useEffect, useState } from "react";
import Card from "../UI/Card";
import Button from "../UI/Button";
import Input from "../UI/Input";
import Select from "../UI/Select";
import useMutationAttempt from "./useMutationAttempt";
import { readOperationalPage } from "../../services/preventiveService";
import { lifecycleError } from "../../services/monitoringLifecycleService";

// Structured evidence may contain nested measurements. React escapes all values;
// no HTML rendering, interpolation, or scientific interpretation is performed.
export function Evidence({ value }) {
  if (value === null || value === undefined) return <span>Não informado</span>;
  if (typeof value !== "object") return <span>{String(value)}</span>;
  return <dl className="operational-evidence">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{key}</dt><dd><Evidence value={item} /></dd></div>)}</dl>;
}

export function OperationalPage({ sessionId, path, collection, title, refresh = 0, busy, renderRecord }) {
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState({ loading: true });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    readOperationalPage(sessionId, path, collection, offset, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setView({ ...data, loading: false }); })
      .catch((error) => { if (!controller.signal.aborted) setView({ error: lifecycleError(error), loading: false }); });
    return () => controller.abort();
  }, [sessionId, path, collection, offset, refresh, retry]);
  return <Card title={title}>
    {view.loading && <p role="status">Consultando {title}…</p>}
    {view.error && <p role="alert">{view.error}</p>}
    {!view.loading && !view.error && <><p>Total: {view.total} · Página {offset / 20 + 1}</p>
      {view.records.length ? view.records.map((record) => <div className="logistics-detail" key={record.id}>{renderRecord(record)}</div>) : <p>Nenhum registro nesta página.</p>}</>}
    <div className="logistics-actions">
      <Button variant="secondary" disabled={busy} onClick={() => { setView({ loading: true }); setRetry((n) => n + 1); }}>Atualizar {title}</Button>
      <Button variant="secondary" disabled={busy || offset === 0} onClick={() => { setView({ loading: true }); setOffset(offset - 20); }}>Anteriores: {title}</Button>
      <Button variant="secondary" disabled={busy || view.loading || view.error || offset + 20 >= view.total} onClick={() => { setView({ loading: true }); setOffset(offset + 20); }}>Próximos: {title}</Button>
    </div>
  </Card>;
}

export function OperationalForm({ title, fields, build, send, attempt, setAttempt, busy, onBusy, onSaved, onCancel }) {
  const [values, setValues] = useState(() => attempt?.values || Object.fromEntries(fields.map((field) => [field.name, field.value ?? ""])));
  const mutation = useMutationAttempt(attempt, setAttempt, onBusy, onSaved);
  const change = (name) => (event) => setValues((old) => ({ ...old, [name]: event.target.value }));
  return <Card title={title}><form aria-label={title} onSubmit={(event) => mutation.submit(event, { build: () => build(values, crypto.randomUUID()), send, values, busy })}>
    {mutation.error && <p role="alert">{mutation.error}</p>}
    {mutation.frozen && <p>Resposta incerta. Consulte o histórico antes de repetir. A repetição manual preserva os mesmos dados e a mesma chave.</p>}
    <fieldset disabled={busy || mutation.frozen} className="logistics-form">
      {fields.map((field) => field.options ? <Select key={field.name} label={field.label} value={values[field.name]} onChange={change(field.name)} options={[{ value: "", label: "Selecione / não informar" }, ...field.options.map((option) => typeof option === "string" ? { value: option, label: option } : option)]} />
        : field.multiline ? <label key={field.name}>{field.label}<textarea value={values[field.name]} onChange={change(field.name)} maxLength={field.maxLength || 4000} /></label>
          : <Input key={field.name} label={field.label} type={field.type || "text"} value={values[field.name]} onChange={change(field.name)} hint={field.hint} />)}
    </fieldset>
    <div className="logistics-actions"><Button type="submit" loading={mutation.saving} disabled={busy}>Confirmar {title}</Button><Button variant="secondary" disabled={busy} onClick={onCancel}>Fechar formulário</Button></div>
  </form></Card>;
}
