import { useState } from "react";
import Card from "../../components/UI/Card";
import Button from "../../components/UI/Button";
import Select from "../../components/UI/Select";
import ReferenceSelect from "../../components/Logistics/ReferenceSelect";
import { OperationalForm } from "../../components/Monitoring/OperationalWidgets";
import ListProgress from "../../components/UI/ListProgress";
import useIncrementalList from "../../hooks/useIncrementalList";
import api from "../../services/api";
import { justification } from "../../services/preventiveService";

async function partners(id, { signal, ...params }) {
  const { data } = await api.get(`/api/v1/transportadoras/${encodeURIComponent(id)}/parceiros`, { signal, params });
  if (!Array.isArray(data)) throw new Error("Catálogo inválido.");
  return data;
}
export default function BusinessPartners({ company, busy, onBusy }) {
  const [open, setOpen] = useState(false);
  return <Card title={`Parceiros comerciais de ${company.nome}`}>
    <p>A aprovação não cria vínculo de usuário, nem permite acesso às cargas de outra empresa.</p>
    {!open ? <Button disabled={busy} onClick={() => setOpen(true)}>Gerenciar parceiros comerciais</Button> : <PartnerEditor company={company} busy={busy} onBusy={onBusy} />}
  </Card>;
}
function PartnerEditor({ company, busy, onBusy }) {
  const list = useIncrementalList(company.id, partners);
  const [type, setType] = useState("PRODUTOR"), [selected, setSelected] = useState(""), [attempts, setAttempts] = useState({});
  return <><ListProgress list={list} label="parceiros comerciais" disabled={busy} />
    <ul>{list.records.map((row) => <li key={row.id}>{row.nome} · {row.tipo} · {row.aprovado ? "Aprovado para a transportadora" : "Sem aprovação"}</li>)}</ul>
    <Select label="Tipo do parceiro" value={type} disabled={busy} options={["PRODUTOR", "CLIENTE"].map((value) => ({ value, label: value }))} onChange={(e) => { setType(e.target.value); setSelected(""); }} />
    <ReferenceSelect key={type} label="Empresa parceira" kind="empresas" companyType={type} value={selected} disabled={busy} onChange={setSelected} required />
    {selected && <OperationalForm key={selected} title="aprovação comercial" fields={[{ name: "active", label: "Permissão para novas cargas", options: [{ value: "true", label: "Aprovar / reativar" }, { value: "false", label: "Revogar" }] }, { name: "justificativa", label: "Justificativa da aprovação ou revogação", multiline: true }]}
      attempt={attempts[selected]} setAttempt={(value) => setAttempts((old) => ({ ...old, [selected]: value }))} busy={busy} onBusy={onBusy}
      build={(values) => { if (!["true", "false"].includes(values.active)) throw new Error("Selecione aprovar ou revogar."); return { ativo: values.active === "true", justificativa: justification(values.justificativa) }; }}
      send={async (payload) => { const { data } = await api.put(`/api/v1/transportadoras/${encodeURIComponent(company.id)}/parceiros/${encodeURIComponent(selected)}`, payload); if (data?.transportadora_id !== company.id || data.empresa_id !== selected || data.ativo !== payload.ativo) throw new Error("Aprovação não confirmada."); return data; }}
      onSaved={() => { setSelected(""); list.retry(); }} onCancel={() => setSelected("")} />}
  </>;
}
