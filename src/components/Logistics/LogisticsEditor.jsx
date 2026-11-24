import { useEffect, useRef, useState } from "react";
import Input from "../UI/Input";
import Select from "../UI/Select";
import Button from "../UI/Button";
import ReferenceSelect from "./ReferenceSelect";
import { isTerminal, logisticsError, logisticsPayload, nextStates, saveLogistics } from "../../services/logisticsService";

const fields = {
  cargas: [
    { name: "identificacao", label: "Identificação da carga", maxLength: 120, required: true },
    { name: "quantidade_caixas", label: "Quantidade declarada de caixas", inputMode: "numeric" },
    { name: "quantidade", label: "Quantidade", inputMode: "decimal" },
    { name: "unidade", label: "Unidade da quantidade", maxLength: 30 },
    { name: "origem_produto", label: "Origem do produto", maxLength: 255 },
  ],
  caixas: [
    { name: "identificacao", label: "Identificação da caixa", maxLength: 120, required: true },
    { name: "codigo_externo", label: "Código externo", maxLength: 120 },
    { name: "peso", label: "Peso", inputMode: "decimal" },
  ],
};

export default function LogisticsEditor({ kind, parentId, trip, cargo, record, busy = false, onBusy, onSaved, onCancel }) {
  const [values, setValues] = useState(() => ({ ...Object.fromEntries(fields[kind].map((field) => [field.name, record?.[field.name] ?? ""])),
    observacoes: record?.observacoes ?? "", status: record?.status, produto_id: "", produtor_id: "", cliente_id: "" }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const terminal = record && isTerminal(kind, record.status);
  const singular = kind === "cargas" ? "carga" : "caixa";
  const change = (field, value) => setValues((old) => ({ ...old, [field]: value }));
  async function submit(event) {
    event.preventDefault();
    if (pending.current || busy) return;
    let payload;
    try { payload = logisticsPayload(kind, values, record, trip, cargo); }
    catch (failure) { setError(failure.message); return; }
    pending.current = true; setSaving(true); onBusy(true); setError("");
    let saved;
    try { saved = await saveLogistics(kind, parentId, payload, record?.id); }
    catch (failure) { if (mounted.current) setError(logisticsError(failure, true)); }
    finally { pending.current = false; if (mounted.current) { setSaving(false); onBusy(false); } }
    if (saved && mounted.current) onSaved(saved);
  }
  return <form className="logistics-form" onSubmit={submit} aria-label={`${record ? "Editar" : "Cadastrar"} ${singular}`}>
    <h3>{record ? "Editar" : "Cadastrar"} {singular}</h3>
    {!record && kind === "cargas" && <>
      <p>Os seletores mostram somente cadastros que sua conta pode consultar. Se o produtor necessário não aparecer em nenhuma página, solicite a um administrador o cadastro da carga.</p>
      <ReferenceSelect label="Produto da carga" kind="produtos" required value={values.produto_id} onChange={(value) => change("produto_id", value)} disabled={saving} />
      <ReferenceSelect label="Produtor da carga" kind="empresas" companyType="PRODUTOR" required value={values.produtor_id} onChange={(value) => change("produtor_id", value)} disabled={saving} />
      <ReferenceSelect label="Cliente da carga" kind="empresas" companyType="CLIENTE" value={values.cliente_id} onChange={(value) => change("cliente_id", value)} disabled={saving} />
    </>}
    {record && kind === "cargas" && <p>Viagem, produto, produtor e cliente são preservados nesta edição.</p>}
    <div className="logistics-controls">{fields[kind].map((field) => <Input key={field.name} {...field} value={values[field.name]} disabled={saving || Boolean(terminal)} onChange={(event) => change(field.name, event.target.value)} />)}</div>
    {kind === "cargas" && <p>Quantidade e unidade são opcionais e devem ser informadas juntas. A quantidade declarada de caixas não é recalculada a partir dos registros. A massa científica da carga será declarada separadamente no monitoramento.</p>}
    {kind === "caixas" && <p>O contrato atual não informa unidade do campo peso. Esse valor não é usado automaticamente como massa em kg no modelo de etileno.</p>}
    {record && <Select label={`Estado da ${singular}`} value={values.status} disabled={saving || Boolean(terminal)} onChange={(event) => change("status", event.target.value)} options={[record.status, ...nextStates(kind, record, trip, cargo)].map((value) => ({ value, label: value }))} />}
    {terminal && <p>Registro encerrado: somente observações podem ser alteradas.</p>}
    <label className="form-field">Observações<textarea className="input" rows={3} disabled={saving} value={values.observacoes} onChange={(event) => change("observacoes", event.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <div className="logistics-actions"><Button type="submit" loading={saving} disabled={busy && !saving}>Salvar {singular}</Button><Button variant="secondary" disabled={saving || busy} onClick={onCancel}>Cancelar edição</Button></div>
  </form>;
}
