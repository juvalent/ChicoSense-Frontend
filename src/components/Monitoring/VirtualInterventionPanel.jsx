import { useState } from "react";
import Card from "../UI/Card";
import Button from "../UI/Button";
import { OperationalForm, OperationalPage, Evidence } from "./OperationalWidgets";
import { justification, postOperational, readOperationalDetail } from "../../services/preventiveService";
import { allowedVirtualActions, canRequestVirtual, validateVirtual, virtualRequestPayload } from "../../services/virtualInterventionService";
import { lifecycleError } from "../../services/monitoringLifecycleService";

const root = "intervencoes-simuladas";
export default function VirtualInterventionPanel(props) {
  const [open, setOpen] = useState(false);
  return <Card title="Exaustão exclusivamente virtual">
    <p>Simulação sem comando físico, medição ou remoção comprovada de gás. Solicitar, autorizar e iniciar são ações humanas separadas. O prazo não encerra a simulação automaticamente.</p>
    {!open ? <Button disabled={props.busy} onClick={() => setOpen(true)}>Abrir intervenções virtuais</Button> : <VirtualWorkspace {...props} />}
  </Card>;
}
function VirtualWorkspace({ session, trip, user, busy, onBusy }) {
  const [refresh, setRefresh] = useState(0), [detail, setDetail] = useState(null), [error, setError] = useState("");
  const [form, setForm] = useState(null), [attempts, setAttempts] = useState({}), [references, setReferences] = useState(false);
  const requestAllowed = canRequestVirtual(user, trip, session);
  async function inspect(id) {
    setError(""); setDetail(null); onBusy(true);
    try { setDetail(validateVirtual(await readOperationalDetail(session.id, `${root}/${id}`, id), session)); }
    catch (failure) { setError(lifecycleError(failure)); }
    finally { onBusy(false); }
  }
  function saved() { setForm(null); setDetail(null); setRefresh((n) => n + 1); }
  const request = (reference = null) => setForm({ kind: "request", reference });
  const attemptKey = form?.kind === "request" ? `request:${form.reference?.field || "none"}:${form.reference?.id || "none"}` : `action:${form?.intervention.id}:${form?.action}`;
  const renderReference = (field, label) => (row) => <><p>{label} {row.id} · {row.status || row.resultado?.status || row.executada_em}</p><Button disabled={busy || (field === "alerta_id" && !["ABERTO", "EM_ANALISE"].includes(row.status))} onClick={() => request({ field, id: row.id })}>Solicitar com {label} {row.id}</Button></>;
  return <>
    {error && <p role="alert">{error}</p>}
    {requestAllowed && <div className="logistics-actions"><Button disabled={busy} onClick={() => request()}>Solicitar intervenção sem referência</Button><Button variant="secondary" disabled={busy} onClick={() => setReferences(!references)}>Selecionar referência contextual</Button></div>}
    {requestAllowed && references && <>
      <p>Referência opcional da mesma sessão. Nenhum resultado autoriza ou inicia intervenção automaticamente.</p>
      <OperationalPage sessionId={session.id} path="alertas" collection="alertas" title="Alertas para referência" busy={busy} renderRecord={renderReference("alerta_id", "alerta")} />
      <OperationalPage sessionId={session.id} path="avaliacoes-preventivas" collection="avaliacoes" title="Avaliações para referência" busy={busy} renderRecord={renderReference("avaliacao_id", "avaliação")} />
      <OperationalPage sessionId={session.id} path="analises-etileno" collection="analises" title="Análises para referência" busy={busy} renderRecord={renderReference("analise_etileno_id", "análise")} />
    </>}
    {form && <p>{form.kind === "request" ? `Referência da solicitação: ${form.reference ? `${form.reference.field} ${form.reference.id}` : "sem referência contextual"}` : `Intervenção selecionada: ${form.intervention.id} · Estado consultado: ${form.intervention.estado}`}</p>}
    {form && <OperationalForm key={attemptKey} title={form.kind === "request" ? "solicitação virtual" : `${form.action} intervenção virtual`}
      fields={[...(form.kind === "request" ? [{ name: "duracao_planejada_s", label: "Duração planejada da simulação (s)", hint: "Maior que zero e até 86400 s; sem encerramento automático." }] : []), { name: "justificativa", label: "Justificativa humana", multiline: true }]}
      build={(values, key) => form.kind === "request" ? virtualRequestPayload(values, key, form.reference) : { chave_idempotencia: key, acao: form.action, justificativa: justification(values.justificativa) }}
      send={async (payload) => {
        const result = await postOperational(session.id, form.kind === "request" ? root : `${root}/${form.intervention.id}/acoes`, payload, form.kind === "request" ? null : { field: "intervencao_id", id: form.intervention.id });
        return form.kind === "request" ? validateVirtual(result, session) : result;
      }}
      attempt={attempts[attemptKey]} setAttempt={(value) => setAttempts((old) => ({ ...old, [attemptKey]: value }))} busy={busy} onBusy={onBusy} onSaved={saved} onCancel={() => setForm(null)} />}
    <OperationalPage sessionId={session.id} path={root} collection="intervencoes" title="Intervenções virtuais" refresh={refresh} busy={busy} renderRecord={(row) => <><p>{row.estado} · Solicitada em {row.solicitada_em} · Duração planejada {row.duracao_planejada_s} s</p><Button disabled={busy} onClick={() => inspect(row.id)}>Consultar intervenção {row.id}</Button></>} />
    {detail && <Card title="Estado e ações da intervenção virtual">
      <p>{detail.estado} · Estado lógico ligado: {detail.virtual_ligado ? "Sim" : "Não"} · Consultado em {detail.consultado_em}</p>
      <p>Atuador virtual: {detail.atuador_virtual_id} · Ocupado: {detail.atuador_virtual_ocupado ? "Sim" : "Não"}</p>
      <p>Duração planejada: {detail.duracao_planejada_s} s · Registrada: {detail.duracao_registrada_s ?? "Não informada"} s · Prazo planejado: {detail.prazo_planejado_em || "Não iniciado"}</p>
      <p>{detail.justificativa_solicitacao}</p>{detail.motivo_fim && <p>Motivo de fim: {detail.motivo_fim}</p>}
      {detail.prazo_excedido && <p role="status">Prazo excedido no instante da consulta. Execução virtual aguarda ação humana.</p>}
      {detail.sessao_terminal_com_execucao && <p role="status">Sessão finalizada com execução virtual pendente. Consulte as ações administrativas permitidas.</p>}
      {detail.contexto_logistico_alterado && <p role="status">Contexto logístico alterado desde a solicitação.</p>}
      <p>Risco científico de etileno: NÃO AVALIADO</p><Evidence value={detail.limitacoes} />
      <Button variant="secondary" disabled={busy} onClick={() => inspect(detail.id)}>Atualizar estado e permissões</Button>
      {allowedVirtualActions(detail, user, trip, session).map((action) => <Button key={action} disabled={busy} onClick={() => setForm({ kind: "action", action, intervention: detail })}>{action} intervenção virtual</Button>)}
      <details><summary>Referências no pedido e na consulta</summary><Evidence value={detail.referencias_snapshot} /><Evidence value={detail.referencias_atuais} /></details>
      <OperationalPage key={detail.id} sessionId={session.id} path={`${root}/${detail.id}/acoes`} collection="acoes" title="Histórico da intervenção" busy={busy} renderRecord={(row) => <><p>#{row.numero} · {row.acao} · {row.estado_anterior} → {row.estado_posterior} · {row.registrada_em} · Autor {row.usuario_id}</p><p>{row.justificativa}</p></>} />
    </Card>}
  </>;
}
