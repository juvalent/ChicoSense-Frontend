import { useEffect, useState } from "react";
import Card from "../UI/Card";
import Button from "../UI/Button";
import Input from "../UI/Input";
import Select from "../UI/Select";
import SynchronizationForm from "./SynchronizationForm";
import { canSynchronize, operationalSeconds, readAcquisitionPage, readAcquisitionQuality, readAcquisitionRuns, readingQuery, READING_SIZE, RUN_PAGE_SIZE } from "../../services/acquisitionService";
import { lifecycleError } from "../../services/monitoringLifecycleService";
import QualityIntervals from "./QualityIntervals";

const display = (value) => value === null || value === undefined ? "Não informado" : String(value);
const time = (value) => value ? new Date(value).toLocaleString("pt-BR") : "Não informado";
const flag = (value) => value === true ? "Sim" : value === false ? "Não" : "Não classificado";
const labels = { EM_EXECUCAO: "Em execução", CONCLUIDA: "Concluída", PARCIAL: "Parcial", FALHA: "Falha", INTERROMPIDA: "Interrompida" };

export default function AcquisitionPanel(props) {
  const [open, setOpen] = useState(false);
  return open ? <AcquisitionWorkspace key={props.session.id} {...props} /> : <Card title="Aquisição e qualidade IoT"><Button disabled={props.busy} onClick={() => setOpen(true)}>Abrir aquisição e qualidade</Button></Card>;
}

function AcquisitionWorkspace({ session, trip, user, busy, onBusy }) {
  const [refresh, setRefresh] = useState(0), [runOffset, setRunOffset] = useState(0);
  const [runs, setRuns] = useState({ data: null, loading: true, error: "" });
  const [formOpen, setFormOpen] = useState(false), [attempt, setAttempt] = useState(null), [notice, setNotice] = useState("");
  const [values, setValues] = useState({ revisao: "", inicio: "", fim: "", tipo: "" });
  const [query, setQuery] = useState({});
  const [request, setRequest] = useState({});
  const [readings, setReadings] = useState({ data: null, loading: true, error: "" });
  const [gap, setGap] = useState("");
  const [qualityRequest, setQualityRequest] = useState(null), [quality, setQuality] = useState({ data: null, loading: false, error: "", key: "" });
  const [queryError, setQueryError] = useState("");
  const canWrite = canSynchronize(user, trip, session);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setRuns({ data: null, loading: true, error: "" });
      try { const data = await readAcquisitionRuns(session.id, runOffset, controller.signal); if (!controller.signal.aborted) setRuns({ data, loading: false, error: "" }); }
      catch (error) { if (!controller.signal.aborted) setRuns({ data: null, loading: false, error: lifecycleError(error) }); }
    }
    load(); return () => controller.abort();
  }, [session.id, runOffset, refresh]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setReadings({ data: null, loading: true, error: "" });
      try { const data = await readAcquisitionPage(session.id, query, { ...request, signal: controller.signal }); if (!controller.signal.aborted) setReadings({ data, loading: false, error: "" }); }
      catch (error) { if (!controller.signal.aborted) setReadings({ data: null, loading: false, error: lifecycleError(error) }); }
    }
    load(); return () => controller.abort();
  }, [session.id, query, request, refresh]);
  const frame = readings.data && { revisao: readings.data.revisao, inicio: readings.data.inicio, fim: readings.data.fim };
  const frameKey = frame ? JSON.stringify([session.id, frame.revisao, frame.inicio, frame.fim]) : "";
  useEffect(() => {
    if (!qualityRequest || qualityRequest.key !== frameKey) return;
    const controller = new AbortController();
    async function load() {
      setQuality({ data: null, loading: true, error: "", key: qualityRequest.key });
      try { const data = await readAcquisitionQuality(session.id, qualityRequest.frame, qualityRequest.gap, controller.signal); if (!controller.signal.aborted) setQuality({ data, loading: false, error: "", key: qualityRequest.key }); }
      catch (error) { if (!controller.signal.aborted) setQuality({ data: null, loading: false, error: lifecycleError(error), key: qualityRequest.key }); }
    }
    load(); return () => controller.abort();
  }, [session.id, qualityRequest, frameKey]);
  function consult() { setRefresh((n) => n + 1); }
  function runResult(run, terminal) {
    setNotice(`Tentativa registrada: ${labels[run.estado] || run.estado}. ${terminal ? "Confira o resultado e as leituras; o estado da tentativa não classifica risco de etileno." : "Solicitação ainda em execução; não há confirmação de coleta concluída."}`);
    if (terminal) setFormOpen(false);
    setRunOffset(0); setRequest({}); consult();
  }
  function filter(event) {
    event.preventDefault();
    try { const next = readingQuery(values, session); setQueryError(""); setQuery(next); setRequest({}); setQualityRequest(null); }
    catch (error) { setQueryError(error.message); }
  }
  function qualityQuery(event) {
    event.preventDefault();
    if (!frame) return;
    try { const maximum = operationalSeconds(gap, true); setQueryError(""); setQualityRequest({ key: frameKey, frame, gap: maximum }); }
    catch (error) { setQueryError(error.message); }
  }
  const revisions = new Map();
  for (const run of runs.data?.tentativas || []) if (run.estado !== "EM_EXECUCAO") revisions.set(String(run.revisao), run.revisao);
  if (values.revisao) revisions.set(values.revisao, Number(values.revisao));
  const activeQuality = quality.key === frameKey ? quality : null;
  return <Card title="Aquisição e qualidade IoT">
    <p>Sincronização explícita por sessão. Leituras, revisões e cobertura de aquisição não são concentração de gás nem classificação de risco por etileno.</p>
    {notice && <p role="status">{notice}</p>}
    <div className="logistics-actions">
      <Button variant="secondary" disabled={busy} onClick={consult}>Atualizar aquisição</Button>
      {canWrite && <Button disabled={busy} onClick={() => setFormOpen(true)}>{attempt ? "Revisar solicitação de sincronização" : "Sincronizar dados da sessão"}</Button>}
    </div>
    {!canWrite && <p>Sincronização indisponível para o perfil/escopo ou estado desta sessão. CONSULTA somente lê; complementar sessão encerrada exige ADMIN/GESTOR; cancelada não recebe dados.</p>}
    {runs.data?.em_execucao && <p>Há execução registrada. Consulte as tentativas; o servidor recusará uma solicitação conflitante enquanto a execução estiver válida.</p>}
    {formOpen && canWrite && <SynchronizationForm session={session} user={user} attempt={attempt} setAttempt={setAttempt} runs={runs.data?.tentativas || []} busy={busy} onBusy={onBusy}
      onDone={(run) => runResult(run, true)} onAccepted={(run) => runResult(run, false)} onConsult={consult} onClose={() => setFormOpen(false)} />}
    <h3>Tentativas de sincronização</h3>
    {runs.loading && <p role="status">Consultando tentativas…</p>}
    {runs.error && <p role="alert">{runs.error}</p>}
    {runs.data && <>
      <p>Revisão consolidada disponível: {runs.data.revisao_disponivel}. Estados de falha/parcial preservam a auditoria e não equivalem a coleta completa.</p>
      {!runs.data.tentativas.length && <p>Nenhuma tentativa nesta página.</p>}
      <div className="logistics-table"><table><caption>Tentativas desta sessão</caption><thead><tr><th scope="col">Revisão</th><th scope="col">Estado</th><th scope="col">Origem / janela</th><th scope="col">Resultado</th></tr></thead>
        <tbody>{runs.data.tentativas.map((run) => <tr key={run.id}><td>{run.revisao}</td><td>{labels[run.estado]}</td><td>{run.origem_dados}<br />{time(run.inicio_janela)} → {time(run.fim_janela)}</td><td>Novas: {display(run.resumo?.novas)} · Duplicadas: {display(run.resumo?.duplicadas)} · Inválidas: {display(run.resumo?.invalidas)} · Erros: {display(run.resumo?.erros)}<br />Fim da tentativa: {time(run.finalizada_em)}{run.justificativa && <p>{run.justificativa}</p>}</td></tr>)}</tbody></table></div>
      <nav className="logistics-actions" aria-label="Paginação de tentativas"><Button variant="secondary" disabled={busy || runOffset === 0} onClick={() => setRunOffset((n) => Math.max(0, n - RUN_PAGE_SIZE))}>Tentativas anteriores</Button><span>Página {runOffset / RUN_PAGE_SIZE + 1}</span><Button variant="secondary" disabled={busy || !runs.data.hasNext} onClick={() => setRunOffset((n) => n + RUN_PAGE_SIZE)}>Próximas tentativas</Button></nav>
    </>}
    <h3>Leituras por revisão e janela</h3>
    <form className="logistics-form" aria-label="Filtrar leituras da sessão" onSubmit={filter}>
      <div className="logistics-controls">
        <Select label="Revisão das leituras" value={values.revisao} disabled={busy} options={[{ value: "", label: "Última revisão consolidada" }, ...[...revisions].map(([value]) => ({ value, label: `Revisão ${value}` }))]} onChange={(event) => setValues((old) => ({ ...old, revisao: event.target.value }))} />
        <Select label="Tipo de leitura" value={values.tipo} disabled={busy} options={[{ value: "", label: "Temperatura e umidade" }, { value: "TEMPERATURA", label: "Temperatura" }, { value: "UMIDADE", label: "Umidade" }]} onChange={(event) => setValues((old) => ({ ...old, tipo: event.target.value }))} />
        <Input label="Início da consulta (opcional)" type="datetime-local" value={values.inicio} disabled={busy} onChange={(event) => setValues((old) => ({ ...old, inicio: event.target.value }))} />
        <Input label="Fim da consulta (opcional)" type="datetime-local" value={values.fim} disabled={busy} onChange={(event) => setValues((old) => ({ ...old, fim: event.target.value }))} />
      </div><Button type="submit" disabled={busy}>Aplicar janela e revisão</Button>
    </form>
    {queryError && <p role="alert">{queryError}</p>}
    {readings.loading && <p role="status">Consultando leituras…</p>}
    {readings.error && <p role="alert">{readings.error}</p>}
    {readings.data && <>
      <p role="status">Registros {readings.data.total ? readings.data.offset + 1 : 0}–{readings.data.offset + readings.data.leituras.length} de {readings.data.total} · Revisão {readings.data.revisao}</p>
      <p>Janela fixada: {time(frame.inicio)} → {time(frame.fim)}. A consulta inicial abre a última página; registros inválidos e conflitos são preservados.</p>
      {readings.data.metadados_temporais_invalidos && <p>Há metadados temporais inválidos. A qualidade pode ser indeterminada.</p>}
      {readings.data.cancelada_para_analise && <p>Sessão cancelada: histórico mantido para consulta.</p>}
      {!readings.data.total && <p>Nenhuma leitura nessa janela/revisão. Isso não significa produção zero de etileno.</p>}
      <ReadingTable readings={readings.data.leituras} />
      {!!readings.data.ocorrencias?.length && <p>Ocorrências da revisão: {[...new Set(readings.data.ocorrencias.map((item) => item.codigo))].join(", ")}</p>}
      <nav className="logistics-actions" aria-label="Paginação das leituras IoT"><Button variant="secondary" disabled={busy || readings.data.offset === 0} onClick={() => setRequest({ offset: Math.max(0, readings.data.offset - READING_SIZE), frame })}>Leituras anteriores</Button><Button variant="secondary" disabled={busy || readings.data.offset + readings.data.limit >= readings.data.total} onClick={() => setRequest({ offset: readings.data.offset + READING_SIZE, frame })}>Leituras seguintes</Button></nav>
    </>}
    <h3>Qualidade temporal de aquisição</h3>
    <form aria-label="Consultar qualidade da aquisição" onSubmit={qualityQuery} className="logistics-form">
      <Input label="Intervalo máximo operacional G (s)" inputMode="decimal" value={gap} required disabled={busy || !frame} onChange={(event) => setGap(event.target.value)} />
      <p>G é uma escolha operacional explícita, sem padrão científico. A consulta considera todas as fontes da sessão na mesma revisão/janela, mesmo com filtro de tipo na tabela.</p>
      <Button type="submit" disabled={busy || !frame || activeQuality?.loading}>Consultar qualidade</Button>
    </form>
    {activeQuality?.loading && <p role="status">Consultando qualidade…</p>}
    {activeQuality?.error && <p role="alert">{activeQuality.error}</p>}
    {activeQuality?.data && <QualityResult key={JSON.stringify(qualityRequest)} result={activeQuality.data} sessionId={session.id} />}
  </Card>;
}

function ReadingTable({ readings }) {
  return <div className="logistics-table"><table><caption>Leituras registradas, sem interpolação</caption><thead><tr><th scope="col">Instante / tipo</th><th scope="col">Valor / unidade</th><th scope="col">Validade</th><th scope="col">Qualidade da chegada</th></tr></thead><tbody>
    {readings.map((reading) => <tr key={reading.id}><td>{time(reading.medida_em)} · {reading.tipo}</td><td>{reading.valor === null || reading.valor === undefined ? "Valor indisponível" : String(reading.valor)} {reading.unidade}</td><td>{reading.estado} · {reading.motivo || "Sem motivo adicional"}<br />Conflito: {flag(reading.conflito_observado)}</td><td>Tardia: {flag(reading.tardia)} · Fora de ordem: {flag(reading.fora_de_ordem)} · Após encerramento: {flag(reading.apos_encerramento)}<br />Recebida: {time(reading.recebida_em)}</td></tr>)}
  </tbody></table></div>;
}
function QualityResult({ result, sessionId }) {
  return <section aria-label="Resultado de qualidade">
    <p>Revisão {result.revisao} · G {result.intervalo_maximo_s} s. Cobertura temporal não mede etileno nem classifica risco científico.</p>
    {result.metadados_temporais_invalidos && <p>Metadados inválidos: cobertura pode ser indeterminada.</p>}
    {result.indicadores.map((indicator, index) => <Card key={`${indicator.sensor_id || indicator.tipo}:${index}`} title={`Qualidade: ${indicator.tipo}`}>
      <p>Cobertura: {indicator.percentual_cobertura === null || indicator.percentual_cobertura === undefined ? "Indeterminada" : `${indicator.percentual_cobertura}%`} · Coberta: {display(indicator.duracao_coberta_s)} s · Não coberta: {display(indicator.duracao_nao_coberta_s)} s</p>
      <p>Registros: {display(indicator.registros)} · Inválidos: {display(indicator.invalidos)} · Instantes conflitantes: {display(indicator.instantes_conflitantes)} · Atraso desconhecido: {display(indicator.atraso_nao_classificado)}</p>
      {indicator.intervalos && <GapList intervals={indicator.intervalos} />}
    </Card>)}
    {result.indicadores.some((row) => row.intervalos_total !== undefined) && <QualityIntervals sessionId={sessionId} result={result} />}
    <p>{result.limites}</p><p>Ocorrências: {result.codigos_ocorrencias?.join(", ") || "Nenhum código retornado"}</p>
  </section>;
}
function GapList({ intervals }) {
  const [offset, setOffset] = useState(0);
  const gaps = intervals.filter((interval) => interval.motivo !== null && interval.motivo !== undefined);
  const reasons = { SEM_LEITURAS: "Sem leituras", BORDA_SEM_LEITURA: "Borda sem leitura", PONTO_INVALIDO_OU_CONFLITANTE: "Ponto inválido ou conflitante", LACUNA_EXCESSIVA: "Lacuna excessiva" };
  return <>
    {!gaps.length ? <p>Sem intervalos de lacuna retornados.</p> : <ul>{gaps.slice(offset, offset + 20).map((interval, index) => <li key={`${interval.inicio}:${index}`}>{time(interval.inicio)} → {time(interval.fim)} · {display(interval.duracao_s)} s · {reasons[interval.motivo] || interval.motivo}</li>)}</ul>}
    {gaps.length > 20 && <nav className="logistics-actions" aria-label="Paginação de lacunas"><Button variant="secondary" disabled={offset === 0} onClick={() => setOffset((n) => Math.max(0, n - 20))}>Lacunas anteriores</Button><span>{offset + 1}–{Math.min(offset + 20, gaps.length)} de {gaps.length} lacunas</span><Button variant="secondary" disabled={offset + 20 >= gaps.length} onClick={() => setOffset((n) => n + 20)}>Próximas lacunas</Button></nav>}
  </>;
}
