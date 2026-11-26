import { useEffect, useRef, useState } from "react";
import Input from "../../components/UI/Input";
import Select from "../../components/UI/Select";
import Button from "../../components/UI/Button";
import { adminDefinitions, adminError, adminPayload, saveAdmin } from "../../services/adminService";

export default function AdminEditor({ kind, record, profiles = [], parentId, onBusy, onSaved, onCancel }) {
  const definition = adminDefinitions[kind];
  const [values, setValues] = useState(() => ({
    ...Object.fromEntries(definition.fields.map((field) => [field.name, record?.[field.name] ?? ""])),
    ativo: record?.ativo ?? true, senha: "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const change = (field, value) => setValues((current) => ({ ...current, [field]: value }));

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    let payload;
    try { payload = adminPayload(kind, values, Boolean(record?.id)); }
    catch (failure) { setError(failure.message); if (kind === "usuarios") change("senha", ""); return; }
    pending.current = true; setSaving(true); setError(""); onBusy(true);
    let saved;
    try { saved = await saveAdmin(kind, payload, { parentId, recordId: record?.id }); }
    catch (failure) {
      if (mounted.current) { setError(adminError(failure, true)); if (kind === "usuarios") change("senha", ""); }
    } finally {
      pending.current = false;
      if (mounted.current) { setSaving(false); onBusy(false); }
    }
    if (saved && mounted.current) onSaved(saved);
  }

  return <form onSubmit={submit} className="admin-form" aria-label={`${record?.id ? "Editar" : "Cadastrar"} ${definition.singular}`}>
    <h3>{record?.id ? "Editar" : "Cadastrar"} {definition.singular}</h3>
    <div className="admin-controls">
      {definition.fields.map((field) => {
        if (field.options || field.profiles) return <Select key={field.name} label={field.label} value={values[field.name]} required={field.required} disabled={saving}
          options={[{ value: "", label: "Selecione" }, ...(field.options ? field.options.map((value) => ({ value, label: value })) : profiles.map((profile) => ({ value: profile.id, label: profile.nome })))]}
          onChange={(event) => change(field.name, event.target.value)} />;
        if (field.multiline) return <label className="form-field" key={field.name}>{field.label}<textarea className="input" rows={3} value={values[field.name]} disabled={saving} onChange={(event) => change(field.name, event.target.value)} /></label>;
        return <Input key={field.name} label={field.label} value={values[field.name]} type={field.type || "text"} inputMode={field.decimal ? "decimal" : undefined}
          hint={field.decimal ? "Até quatro casas decimais. Deixe vazio se não informado." : undefined}
          maxLength={field.maxLength} required={field.required} disabled={saving} onChange={(event) => change(field.name, event.target.value)} />;
      })}
      {kind === "usuarios" && <Input label={record?.id ? "Nova senha (opcional)" : "Senha inicial"} name="senha" type="password" autoComplete="new-password" value={values.senha}
        required={!record?.id} minLength={12} maxLength={128} disabled={saving} hint={record?.id ? "Deixe vazio para manter a senha atual." : "Entre 12 e 128 caracteres."} onChange={(event) => change("senha", event.target.value)} />}
    </div>
    {definition.active && <label><input type="checkbox" checked={values.ativo} disabled={saving} onChange={(event) => change("ativo", event.target.checked)} /> Ativo</label>}
    {kind === "empresas" && record?.id && <p>A mudança de tipo depende das relações existentes e pode ser recusada pelo servidor.</p>}
    {kind === "parametros" && <p>Parâmetros de catálogo não alteram o motor científico nem configuram automaticamente os limites de uma sessão.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="admin-actions"><Button type="submit" loading={saving}>Salvar cadastro</Button><Button variant="secondary" disabled={saving} onClick={onCancel}>Cancelar edição</Button></div>
  </form>;
}
