import { useState } from "react";
import Input from "../UI/Input";
import Select from "../UI/Select";
import Button from "../UI/Button";
import { declarationPayload, maturations, saveDeclaration } from "../../services/monitoringLifecycleService";
import useMutationAttempt from "./useMutationAttempt";

export default function DeclarationEditor({ cargo, declaration, attempt, setAttempt, busy, onBusy, onSaved, onCancel }) {
  const [values, setValues] = useState(() => attempt?.values || {
    produto_identificado: declaration?.produto_identificado ?? "", massa_kg: declaration?.massa_kg ?? "",
    maturacao: declaration?.maturacao ?? "DESCONHECIDA", lote_codigo: declaration?.lote_codigo ?? "",
    lote_hipotetico: typeof declaration?.lote_hipotetico === "boolean" ? String(declaration.lote_hipotetico) : "",
    rastreabilidade: declaration?.rastreabilidade ?? "",
  });
  const mutation = useMutationAttempt(attempt, setAttempt, onBusy, onSaved);
  const locked = busy || mutation.saving || mutation.frozen;
  const change = (field, value) => setValues((old) => ({ ...old, [field]: value }));
  return <form className="logistics-form" aria-label="Declarar carga para monitoramento" onSubmit={(event) => mutation.submit(event, {
    build: () => declarationPayload(values), send: (payload) => saveDeclaration(cargo.id, payload), values, busy,
  })}>
    <h3>Declaração científica da carga</h3>
    <p>A massa em kg é declarada explicitamente. Não é inferida da quantidade logística nem do peso das caixas.</p>
    <div className="logistics-controls">
      <Select label="Produto declarado" value={values.produto_identificado} required disabled={locked} options={[{ value: "", label: "Confirme o produto" }, { value: "MANGA_TOMMY_ATKINS", label: "Manga Tommy Atkins" }]} onChange={(event) => change("produto_identificado", event.target.value)} />
      <Input label="Massa líquida para monitoramento (kg)" value={values.massa_kg} inputMode="decimal" required disabled={locked} onChange={(event) => change("massa_kg", event.target.value)} />
      <Select label="Maturação declarada" value={values.maturacao} disabled={locked} options={maturations.map((value) => ({ value, label: value }))} onChange={(event) => change("maturacao", event.target.value)} />
      <Input label="Código do lote" value={values.lote_codigo} maxLength={120} required disabled={locked} onChange={(event) => change("lote_codigo", event.target.value)} />
      <Select label="O lote é hipotético?" value={values.lote_hipotetico} required disabled={locked} options={[{ value: "", label: "Informe a natureza do lote" }, { value: "true", label: "Sim" }, { value: "false", label: "Não" }]} onChange={(event) => change("lote_hipotetico", event.target.value)} />
    </div>
    <label className="form-field">Rastreabilidade da carga<textarea className="input" required maxLength={2000} rows={3} value={values.rastreabilidade} disabled={locked} onChange={(event) => change("rastreabilidade", event.target.value)} /></label>
    <p>Maturação desconhecida é preservada. A declaração não comprova medição de gás nem valida taxas experimentais específicas da cultivar.</p>
    {mutation.error && <p role="alert">{mutation.error}</p>}
    {mutation.frozen && <p>Resposta incerta: os campos estão preservados. Uma nova tentativa enviará exatamente a mesma declaração.</p>}
    <div className="logistics-actions"><Button type="submit" loading={mutation.saving} disabled={busy && !mutation.saving}>{mutation.frozen ? "Reenviar mesma declaração" : "Salvar declaração"}</Button><Button variant="secondary" disabled={busy || mutation.saving} onClick={onCancel}>Fechar declaração</Button></div>
  </form>;
}
