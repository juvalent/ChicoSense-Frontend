import { useState } from "react";
import Card from "../UI/Card";
import Button from "../UI/Button";
import Select from "../UI/Select";
import { OperationalForm, OperationalPage, Evidence } from "./OperationalWidgets";
import { alertActions, configurationPayload, evaluationPayload, justification, operationalWriter, postOperational, readOperationalDetail } from "../../services/preventiveService";
import { lifecycleError } from "../../services/monitoringLifecycleService";

const configurationFields = [
  ["temperatura_min_c", "Temperatura mínima (°C)"], ["temperatura_max_c", "Temperatura máxima (°C)"],
  ["umidade_min_percentual", "Umidade mínima (%)"], ["umidade_max_percentual", "Umidade máxima (%)"],
  ["intervalo_maximo_s", "Intervalo máximo operacional (s)"], ["cobertura_min_percentual", "Cobertura mínima (%)"],
  ["exposicao_continua_s", "Exposição contínua opcional (s)"],
].map(([name, label]) => ({ name, label }));

export default function PreventivePanel(props) {
  const [open, setOpen] = useState(false);
  return <Card title="Avaliação preventiva e alertas">
    <p>Avaliação ambiental operacional. Risco científico de etileno: NÃO AVALIADO. Decisões humanas não comprovam normalização do gás.</p>
    {!open ? <Button disabled={props.busy} onClick={() => setOpen(true)}>Abrir avaliação preventiva e alertas</Button> : <PreventiveWorkspace {...props} />}
  </Card>;
}
function PreventiveWorkspace({ session, trip, user, busy, onBusy }) {
  const [refresh, setRefresh] = useState(0), [form, setForm] = useState(null), [attempts, setAttempts] = useState({});
  const [selection, setSelection] = useState(null), [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const writer = operationalWriter(user, trip, session);
  const mutable = writer && session.estado !== "CANCELADA";
  const saved = () => { setForm(null); setSelection(null); setRefresh((n) => n + 1); };
  async function inspect(kind, record) {
    setError(""); setSelection(null); onBusy(true);
    try { const data = await readOperationalDetail(session.id, `${kind}/${record.id}`, record.id); setSelection({ kind, data }); }
    catch (failure) { setError(lifecycleError(failure)); }
    finally { onBusy(false); }
  }
  const config = (row) => <><p>Versão {row.versao} · {row.registrada_em}</p><Evidence value={row.parametros} />{mutable && <Button disabled={busy} onClick={() => setForm({ kind: "evaluation", config: row })}>Avaliar com versão {row.versao}</Button>}</>;
  let fields, build, path, target;
  if (form?.kind === "configuration") {
    fields = [...configurationFields, { name: "fundamento", label: "Fundamento", options: ["OPERACIONAL", "EXPERIMENTAL"] }, { name: "prioridade", label: "Prioridade operacional", options: ["INFORMATIVO", "ATENCAO"] }, { name: "justificativa", label: "Justificativa", multiline: true }, { name: "referencias", label: "Referências (uma por linha, até dez)", multiline: true }];
    path = "configuracoes-ambientais"; build = (v, key) => configurationPayload(v, session, key);
  } else if (form?.kind === "evaluation") {
    fields = ["inicio", "fim", "corte_aquisicao"].map((name) => ({ name, label: ({ inicio: "Início da avaliação", fim: "Fim da avaliação", corte_aquisicao: "Corte de aquisição" })[name], type: "datetime-local" }));
    fields.push({ name: "revisao", label: "Revisão (vazio: última consolidada no corte; zero: sem aquisição)" });
    path = "avaliacoes-preventivas"; build = (v, key) => evaluationPayload({ ...v, configuracao_id: form.config?.id || "" }, session, key);
  } else if (form?.kind === "decision") {
    fields = [{ name: "justificativa", label: "Justificativa", multiline: true }];
    path = `alertas/${form.alert.id}/decisoes`; target = { field: "alerta_id", id: form.alert.id };
    build = (v, key) => ({ chave_idempotencia: key, acao: form.action, justificativa: justification(v.justificativa) });
  }
  const attemptKey = form ? `${form.kind}:${form.config?.id || form.alert?.id || "none"}:${form.action || ""}` : "";
  return <>
    <p>Parâmetros explicitamente operacionais, sem calibração para Tommy Atkins. Ambiente: {session.ambiente_aquisicao}; maturação: {session.maturacao} (aplicação explícita na nova configuração).</p>
    {error && <p role="alert">{error}</p>}
    <div className="logistics-actions">
      {mutable && ["ADMIN", "GESTOR"].includes(user.perfil) && <Button disabled={busy} onClick={() => setForm({ kind: "configuration" })}>Registrar configuração ambiental</Button>}
      {mutable && <Button disabled={busy} onClick={() => setForm({ kind: "evaluation" })}>Avaliar sem configuração</Button>}
    </div>
    {form && <OperationalForm key={attemptKey} title={form.kind === "configuration" ? "configuração ambiental" : form.kind === "evaluation" ? "avaliação preventiva" : `${form.action} alerta`} fields={fields} build={build} send={(payload) => postOperational(session.id, path, payload, target)} attempt={attempts[attemptKey]} setAttempt={(value) => setAttempts((old) => ({ ...old, [attemptKey]: value }))} busy={busy} onBusy={onBusy} onSaved={saved} onCancel={() => setForm(null)} />}
    <OperationalPage sessionId={session.id} path="configuracoes-ambientais" collection="configuracoes" title="Configurações ambientais" refresh={refresh} busy={busy} renderRecord={config} />
    <OperationalPage sessionId={session.id} path="avaliacoes-preventivas" collection="avaliacoes" title="Avaliações preventivas" refresh={refresh} busy={busy} renderRecord={(row) => <><p>{row.executada_em} · Revisão {row.revisao} · {row.resultado?.status}</p><Button disabled={busy} onClick={() => inspect("avaliacoes-preventivas", row)}>Consultar avaliação {row.id}</Button></>} />
    <Select label="Situação dos alertas" value={statusFilter} disabled={busy} onChange={(event) => setStatusFilter(event.target.value)} options={[{ value: "", label: "Todas" }, ...["ABERTO", "EM_ANALISE", "RESOLVIDO", "DESCARTADO"].map((value) => ({ value, label: value }))]} />
    <OperationalPage key={statusFilter} sessionId={session.id} path={`alertas${statusFilter ? `?status=${statusFilter}` : ""}`} collection="alertas" title="Alertas da sessão" refresh={refresh} busy={busy} renderRecord={(row) => <><p>{row.tipo} · {row.nivel} · {row.status}</p><Button disabled={busy} onClick={() => inspect("alertas", row)}>Consultar alerta {row.id}</Button></>} />
    {selection?.kind === "avaliacoes-preventivas" && <Card title="Avaliação imutável"><p>Janela: {selection.data.inicio} a {selection.data.fim} · Corte: {selection.data.corte_aquisicao} · Revisão {selection.data.revisao}</p><Evidence value={selection.data.resultado} /><details><summary>Snapshot de entrada</summary><Evidence value={selection.data.entrada_snapshot} /></details></Card>}
    {selection?.kind === "alertas" && <Card title="Decisão e evidências do alerta">
      <p>{selection.data.tipo} · {selection.data.status} · Risco de etileno NÃO AVALIADO</p>
      {writer && alertActions(selection.data.status).map((action) => <Button key={action} disabled={busy} onClick={() => setForm({ kind: "decision", action, alert: selection.data })}>{action}</Button>)}
      <OperationalPage key={`${selection.data.id}:decisions`} sessionId={session.id} path={`alertas/${selection.data.id}/decisoes`} collection="decisoes" title="Decisões humanas" busy={busy} renderRecord={(row) => <><p>{row.acao} · {row.estado_anterior} → {row.estado_posterior} · {row.registrada_em} · Autor {row.usuario_id}</p><p>{row.justificativa}</p></>} />
      <OperationalPage key={`${selection.data.id}:evidence`} sessionId={session.id} path={`alertas/${selection.data.id}/evidencias`} collection="evidencias" title="Evidências do alerta" busy={busy} renderRecord={(row) => <><p>Avaliação {row.avaliacao_id}</p><Evidence value={row.evidencia} /></>} />
    </Card>}
  </>;
}
