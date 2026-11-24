import { useEffect, useRef, useState } from "react";
import Card from "../../components/UI/Card";
import Input from "../../components/UI/Input";
import Button from "../../components/UI/Button";
import Select from "../../components/UI/Select";
import { capabilities } from "../../services/capabilities";
import { fleetError, FLEET_PAGE_SIZE, listFleet, listFleetCompanies, saveFleet } from "../../services/fleetService";
import "./Frota.css";

const definitions = {
  veiculos: {
    title: "Veículos", singular: "veículo", required: "identificador",
    fields: [
      { name: "identificador", label: "Identificador", maxLength: 80 },
      { name: "placa", label: "Placa", maxLength: 20 },
      { name: "modelo", label: "Modelo", maxLength: 120 },
      { name: "descricao", label: "Descrição" },
    ],
  },
  motoristas: {
    title: "Motoristas", singular: "motorista", required: "nome",
    fields: [
      { name: "nome", label: "Nome do motorista", maxLength: 150 },
      { name: "documento", label: "Documento", maxLength: 40 },
      { name: "telefone", label: "Telefone", maxLength: 40 },
    ],
  },
};

export default function Frota({ user }) {
  const permission = capabilities(user);
  return permission.readFleet ? <AuthorizedFleet key={user.id} user={user} /> :
    <main><h1 className="page-title">Frota</h1><p role="alert">Seu perfil ou vínculo empresarial não permite acessar a frota.</p></main>;
}

function AuthorizedFleet({ user }) {
  const [catalog, setCatalog] = useState({ companies: [], loading: true, error: "" });
  const [companyId, setCompanyId] = useState("");
  const [kind, setKind] = useState("veiculos");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const company = catalog.companies.find((item) => item.id === companyId);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setCatalog({ companies: [], loading: true, error: "" });
      try {
        const companies = await listFleetCompanies(controller.signal);
        if (!controller.signal.aborted) setCatalog({ companies, loading: false, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setCatalog({ companies: [], loading: false, error: fleetError(error) });
      }
    }
    load();
    return () => controller.abort();
  }, [retry]);

  return <div className="fleet-page">
    <h1 className="page-title">Frota</h1>
    <p>Cadastre e consulte os veículos e motoristas das transportadoras autorizadas.</p>
    <Card title="Transportadora e cadastro">
      <div className="fleet-controls">
        <Select label="Transportadora da frota" value={company?.id || ""} onChange={(event) => setCompanyId(event.target.value)} disabled={catalog.loading || busy}
          options={[{ value: "", label: "Selecione uma transportadora" }, ...catalog.companies.map((item) => ({ value: item.id, label: `${item.nome}${item.ativo ? "" : " (inativa)"}` }))]} />
        <Select label="Tipo de cadastro" value={kind} onChange={(event) => setKind(event.target.value)} disabled={busy}
          options={[{ value: "veiculos", label: "Veículos" }, { value: "motoristas", label: "Motoristas" }]} />
      </div>
      {catalog.loading && <p role="status">Consultando transportadoras…</p>}
      {catalog.error && <><p role="alert">{catalog.error}</p><Button onClick={() => setRetry((n) => n + 1)}>Tentar novamente</Button></>}
      {!catalog.loading && !catalog.error && !catalog.companies.length && <p>Nenhuma transportadora disponível para este usuário. O vínculo deve ser preparado por um administrador.</p>}
    </Card>
    {company && <FleetRecords key={`${company.id}:${kind}`} kind={kind} company={company} canWrite={capabilities(user).manageFleet && company.ativo === true} onBusy={setBusy} />}
  </div>;
}

function FleetRecords({ kind, company, canWrite, onBusy }) {
  const definition = definitions[kind];
  const [page, setPage] = useState({ records: [], hasNext: false, loading: true, error: "" });
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setPage({ records: [], hasNext: false, loading: true, error: "" });
      try {
        const data = await listFleet(kind, company.id, { offset, signal: controller.signal });
        if (!controller.signal.aborted) setPage({ ...data, loading: false, error: "" });
      } catch (failure) {
        if (!controller.signal.aborted) setPage({ records: [], hasNext: false, loading: false, error: fleetError(failure) });
      }
    }
    load();
    return () => controller.abort();
  }, [kind, company.id, offset, refresh]);

  function edit(record = {}) {
    if (!canWrite || pending.current) return;
    setError(""); setNotice("");
    setForm({ id: record.id || null, values: { ...Object.fromEntries(definition.fields.map((field) => [field.name, record[field.name] ?? ""])), ativo: record.ativo ?? true } });
  }

  async function submit(event) {
    event.preventDefault();
    if (!canWrite || !form || pending.current) return;
    if (!String(form.values[definition.required] || "").trim()) {
      setError("Preencha o campo obrigatório sem usar apenas espaços."); return;
    }
    pending.current = true; setSaving(true); onBusy(true); setError(""); setNotice("");
    try {
      await saveFleet(kind, company.id, form.id, form.values);
      if (!mounted.current) return;
      setForm(null); setOffset(0); setRefresh((n) => n + 1);
      setNotice("Cadastro salvo com sucesso.");
    } catch (failure) {
      if (mounted.current) setError(fleetError(failure, true));
    } finally {
      pending.current = false;
      if (mounted.current) { setSaving(false); onBusy(false); }
    }
  }

  return <Card title={definition.title} description={`Transportadora: ${company.nome}`} action={canWrite && <Button disabled={saving} onClick={() => edit()}>Novo {definition.singular}</Button>}>
    {!canWrite && <p>Consulta somente. Alterações exigem ADMIN ou GESTOR de uma transportadora ativa.</p>}
    {notice && <p role="status">{notice}</p>}
    {form && canWrite && <form onSubmit={submit} className="fleet-form" aria-label={`${form.id ? "Editar" : "Cadastrar"} ${definition.singular}`}>
      <h3>{form.id ? "Editar" : "Cadastrar"} {definition.singular}</h3>
      <p>A transportadora deste cadastro é {company.nome}.</p>
      <div className="fleet-controls">
        {definition.fields.map((field) => <Input key={field.name} label={field.label} value={form.values[field.name]} required={field.name === definition.required} maxLength={field.maxLength} disabled={saving}
          onChange={(event) => setForm((current) => ({ ...current, values: { ...current.values, [field.name]: event.target.value } }))} />)}
      </div>
      <label><input type="checkbox" checked={form.values.ativo} disabled={saving} onChange={(event) => setForm((current) => ({ ...current, values: { ...current.values, ativo: event.target.checked } }))} /> Ativo</label>
      <p>Inativar preserva o histórico. Registros inativos não aparecem nas opções de novas viagens.</p>
      {error && <p role="alert">{error}</p>}
      <div className="fleet-actions"><Button type="submit" loading={saving}>Salvar cadastro</Button><Button variant="secondary" disabled={saving} onClick={() => { setForm(null); setError(""); }}>Cancelar edição</Button></div>
    </form>}
    <div className="fleet-actions"><Button variant="secondary" disabled={saving || page.loading} onClick={() => setRefresh((n) => n + 1)}>Atualizar listagem</Button></div>
    {page.loading && <p role="status">Carregando cadastros…</p>}
    {page.error && <p role="alert">{page.error}</p>}
    {!page.loading && !page.error && !page.records.length && <p>Nenhum registro nesta página.</p>}
    {!!page.records.length && <div className="fleet-table"><table>
      <caption>{definition.title} da transportadora selecionada</caption>
      <thead><tr><th scope="col">{kind === "veiculos" ? "Identificador" : "Nome"}</th><th scope="col">{kind === "veiculos" ? "Placa / Modelo" : "Telefone"}</th><th scope="col">Situação</th>{canWrite && <th scope="col">Ações</th>}</tr></thead>
      <tbody>{page.records.map((record) => <tr key={record.id}>
        <td>{record[definition.required]}</td><td>{kind === "veiculos" ? [record.placa, record.modelo].filter(Boolean).join(" / ") || "Não informado" : record.telefone || "Não informado"}</td>
        <td>{record.ativo ? "Ativo" : "Inativo"}</td>{canWrite && <td><Button variant="secondary" disabled={saving} onClick={() => edit(record)} aria-label={`Editar ${record[definition.required]}`}>Editar</Button></td>}
      </tr>)}</tbody>
    </table></div>}
    <nav className="fleet-actions" aria-label="Paginação da frota">
      <Button variant="secondary" disabled={saving || page.loading || offset === 0} onClick={() => setOffset((n) => Math.max(0, n - FLEET_PAGE_SIZE))}>Página anterior</Button>
      <span>Página {offset / FLEET_PAGE_SIZE + 1}</span>
      <Button variant="secondary" disabled={saving || page.loading || !page.hasNext} onClick={() => setOffset((n) => n + FLEET_PAGE_SIZE)}>Próxima página</Button>
    </nav>
  </Card>;
}
