import { useEffect, useState } from "react";
import Card from "../UI/Card";
import Button from "../UI/Button";
import Input from "../UI/Input";
import CargoDeclaration from "../Cards/CargoDeclaration";
import LogisticsEditor from "./LogisticsEditor";
import { obterMonitoramentoCarga } from "../../services/cargaService";
import { canCreateLogistics, canOperateTrip, LOGISTICS_PAGE_SIZE, logisticsError, readLogistics } from "../../services/logisticsService";
import "./Logistics.css";

export default function LogisticsRecords({ kind, parentId, trip, cargo, user, busy, onBusy, initialCargoId, onMonitor }) {
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState({ records: [], hasNext: false, loading: true, error: "" });
  const [editor, setEditor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const canWrite = canOperateTrip(user, trip);
  const singular = kind === "cargas" ? "carga" : "caixa";
  const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visibleRecords = page.records.filter((record) => normalize(`${record.identificacao} ${record.status} ${record.codigo_externo || ""}`).includes(normalize(search)));
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setPage({ records: [], hasNext: false, loading: true, error: "" });
      try {
        const data = await readLogistics(kind, parentId, { offset, signal: controller.signal });
        if (!controller.signal.aborted) {
          setPage({ ...data, loading: false, error: "" });
          if (initialCargoId) setDetail(data.records.find((record) => record.id === initialCargoId) || null);
        }
      } catch (error) { if (!controller.signal.aborted) setPage({ records: [], hasNext: false, loading: false, error: logisticsError(error) }); }
    }
    load(); return () => controller.abort();
  }, [kind, parentId, offset, refresh, initialCargoId]);
  function edit(record) { if (!busy && canWrite) { setNotice(""); setDetail(null); setEditor({ record }); } }
  function saved() { setEditor(null); setDetail(null); setOffset(0); setRefresh((n) => n + 1); setNotice(`${kind === "cargas" ? "Carga salva" : "Caixa salva"} com sucesso.`); }
  return <Card title={kind === "cargas" ? "Cargas da viagem" : `Caixas de ${cargo.identificacao}`} action={canWrite && canCreateLogistics(kind, trip, cargo) && <Button disabled={busy || page.loading || Boolean(page.error)} onClick={() => edit(null)}>Nova {singular}</Button>}>
    {notice && <p role="status">{notice}</p>}
    {!canWrite && <p>Consulta somente: alterações exigem perfil de operação e vínculo com a transportadora desta viagem.</p>}
    {editor && canWrite && <LogisticsEditor key={editor.record?.id || "new"} kind={kind} parentId={parentId} trip={trip} cargo={cargo} record={editor.record} onBusy={onBusy} onSaved={saved} onCancel={() => setEditor(null)} />}
    <Input label={`Buscar ${kind} nesta página`} type="search" value={search} disabled={busy || page.loading} onChange={(event) => setSearch(event.target.value)} />
    <div className="logistics-actions"><Button variant="secondary" disabled={busy || page.loading} onClick={() => { setEditor(null); setDetail(null); setRefresh((n) => n + 1); }}>Atualizar {kind}</Button></div>
    {page.loading && <p role="status">Consultando {kind}…</p>}
    {page.error && <p role="alert">{page.error}</p>}
    {!page.loading && !page.error && !page.records.length && <p>Nenhum registro nesta página.</p>}
    {!page.loading && !page.error && page.records.length > 0 && visibleRecords.length === 0 && <p>Nenhum resultado nesta página para a busca informada.</p>}
    {!!visibleRecords.length && <div className="logistics-table"><table>
      <caption>{kind === "cargas" ? "Cargas desta viagem" : "Caixas desta carga"}</caption>
      <thead><tr><th scope="col">Identificação</th><th scope="col">Estado</th><th scope="col">{kind === "cargas" ? "Quantidade / unidade" : "Peso informado"}</th><th scope="col">Ações</th></tr></thead>
      <tbody>{visibleRecords.map((record) => <tr key={record.id}>
        <td>{record.identificacao}</td><td>{record.status}</td><td>{kind === "cargas" ? `${record.quantidade ?? "Não informada"} ${record.unidade || ""}` : record.peso ?? "Não informado"}</td>
        <td><div className="logistics-actions">
          {canWrite && <Button variant="secondary" disabled={busy} onClick={() => edit(record)} aria-label={`Editar ${record.identificacao}`}>Editar</Button>}
          {kind === "cargas" && <Button variant="secondary" disabled={busy} onClick={() => { setEditor(null); setDetail(record); }} aria-label={`Caixas e monitoramento de ${record.identificacao}`}>Caixas e monitoramento</Button>}
        </div></td>
      </tr>)}</tbody>
    </table></div>}
    <nav className="logistics-actions" aria-label={`Paginação de ${kind}`}>
      <Button variant="secondary" disabled={busy || page.loading || offset === 0} onClick={() => { setEditor(null); setDetail(null); setSearch(""); setOffset((n) => Math.max(0, n - LOGISTICS_PAGE_SIZE)); }}>Página anterior</Button>
      <span>Página {offset / LOGISTICS_PAGE_SIZE + 1}</span>
      <Button variant="secondary" disabled={busy || page.loading || !page.hasNext} onClick={() => { setEditor(null); setDetail(null); setSearch(""); setOffset((n) => n + LOGISTICS_PAGE_SIZE); }}>Próxima página</Button>
    </nav>
    {detail && kind === "cargas" && <div className="logistics-detail">
      <Button variant="secondary" disabled={busy} onClick={() => setDetail(null)}>Fechar carga</Button>
      <CargoInspection key={`declaration:${detail.id}`} cargo={detail} onMonitor={onMonitor} busy={busy} />
      <LogisticsRecords key={`boxes:${detail.id}`} kind="caixas" parentId={detail.id} trip={trip} cargo={detail} user={user} busy={busy} onBusy={onBusy} />
    </div>}
  </Card>;
}

function CargoInspection({ cargo, onMonitor, busy }) {
  const [view, setView] = useState({ data: null, loading: true, error: "" });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setView({ data: null, loading: true, error: "" });
      try {
        const data = await obterMonitoramentoCarga(cargo.id, { signal: controller.signal });
        if (!controller.signal.aborted) setView({ data, loading: false, error: "" });
      } catch (error) { if (!controller.signal.aborted) setView({ data: null, loading: false, error: logisticsError(error) }); }
    }
    load(); return () => controller.abort();
  }, [cargo.id, refresh]);
  return <Card title={`Carga ${cargo.identificacao}`}>
    <p>Caixas declaradas: {cargo.quantidade_caixas ?? "Não informado"}. Origem: {cargo.origem_produto || "Não informada"}.</p>
    {cargo.observacoes && <p>{cargo.observacoes}</p>}
    {view.loading ? <p role="status">Consultando declaração de monitoramento…</p> : view.error ? <p role="alert">{view.error}</p> : view.data ? <CargoDeclaration declaration={view.data} /> : <p>Dados de monitoramento ainda não declarados. Ausência de declaração não significa produção zero.</p>}
    <div className="logistics-actions"><Button variant="secondary" disabled={busy || view.loading} onClick={() => setRefresh((n) => n + 1)}>Atualizar declaração</Button><Button disabled={busy} onClick={() => onMonitor?.(cargo.id)}>Ir ao monitoramento</Button></div>
  </Card>;
}
