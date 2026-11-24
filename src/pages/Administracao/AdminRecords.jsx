import { useEffect, useState } from "react";
import Card from "../../components/UI/Card";
import Button from "../../components/UI/Button";
import AdminEditor from "./AdminEditor";
import CompanyLinks from "./CompanyLinks";
import { ADMIN_PAGE_SIZE, adminDefinitions, adminError, readAdminPage, readProfiles } from "../../services/adminService";

export default function AdminRecords({ kind, parentId, busy, onBusy, actorId }) {
  const definition = adminDefinitions[kind];
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState({ records: [], profiles: [], hasNext: false, loading: true, error: "" });
  const [editor, setEditor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setPage({ records: [], profiles: [], hasNext: false, loading: true, error: "" });
      try {
        const [result, profiles] = await Promise.all([
          readAdminPage(kind, { parentId, offset, signal: controller.signal }),
          kind === "usuarios" ? readProfiles(controller.signal) : Promise.resolve([]),
        ]);
        if (!controller.signal.aborted) setPage({ ...result, profiles, loading: false, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setPage({ records: [], profiles: [], hasNext: false, loading: false, error: adminError(error) });
      }
    }
    load();
    return () => controller.abort();
  }, [kind, parentId, offset, refresh]);

  function edit(record) {
    if (busy) return;
    setNotice(""); setDetail(null); setEditor({ record });
  }
  function saved(record) {
    setEditor(null); setDetail(null); setOffset(0); setRefresh((n) => n + 1); setNotice("Cadastro salvo com sucesso.");
    if (kind === "usuarios" && record.id === actorId) window.dispatchEvent(new Event("auth:refresh"));
  }
  function extra(record) {
    if (kind === "empresas") return record.tipo;
    if (kind === "usuarios") return `${record.email} · ${page.profiles.find((profile) => profile.id === record.perfil_id)?.nome || "Perfil não informado"}`;
    if (kind === "parametros") return `Mínimo: ${record.valor_minimo ?? "Não informado"} · Máximo: ${record.valor_maximo ?? "Não informado"} · ${record.unidade || "Unidade não informada"}`;
    return record.descricao || "Descrição não informada";
  }
  return <Card title={definition.title} action={<Button disabled={busy || page.loading || Boolean(page.error)} onClick={() => edit(null)}>{kind === "empresas" ? "Nova empresa" : `Novo ${definition.singular}`}</Button>}>
    {notice && <p role="status">{notice}</p>}
    {editor && <AdminEditor key={editor.record?.id || "new"} kind={kind} record={editor.record} profiles={page.profiles} parentId={parentId} onBusy={onBusy} onSaved={saved} onCancel={() => setEditor(null)} />}
    <div className="admin-actions"><Button variant="secondary" disabled={busy || page.loading} onClick={() => { setEditor(null); setDetail(null); setRefresh((n) => n + 1); }}>Atualizar {definition.title.toLowerCase()}</Button></div>
    {page.loading && <p role="status">Carregando {definition.title.toLowerCase()}…</p>}
    {page.error && <p role="alert">{page.error}</p>}
    {!page.loading && !page.error && !page.records.length && <p>Nenhum registro nesta página.</p>}
    {!!page.records.length && <div className="admin-table"><table>
      <caption>Lista de {definition.title.toLowerCase()}</caption>
      <thead><tr><th scope="col">Nome</th><th scope="col">Informações</th>{definition.active && <th scope="col">Situação</th>}<th scope="col">Ações</th></tr></thead>
      <tbody>{page.records.map((record) => <tr key={record.id}>
        <td>{record.nome || record.nome_parametro}</td><td>{extra(record)}</td>
        {definition.active && <td>{record.ativo ? "Ativo" : "Inativo"}</td>}
        <td><div className="admin-actions">
          <Button variant="secondary" disabled={busy} onClick={() => edit(record)} aria-label={`Editar ${record.nome || record.nome_parametro}`}>Editar</Button>
          {kind === "empresas" && <Button variant="secondary" disabled={busy} onClick={() => { setEditor(null); setDetail(record); }} aria-label={`Vínculos de ${record.nome}`}>Vínculos</Button>}
          {kind === "produtos" && <Button variant="secondary" disabled={busy} onClick={() => { setEditor(null); setDetail(record); }} aria-label={`Parâmetros de ${record.nome}`}>Parâmetros</Button>}
        </div></td>
      </tr>)}</tbody>
    </table></div>}
    <nav className="admin-actions" aria-label={`Paginação de ${definition.title.toLowerCase()}`}>
      <Button variant="secondary" disabled={busy || page.loading || offset === 0} onClick={() => { setEditor(null); setDetail(null); setOffset((n) => Math.max(0, n - ADMIN_PAGE_SIZE)); }}>Página anterior</Button>
      <span>Página {offset / ADMIN_PAGE_SIZE + 1}</span>
      <Button variant="secondary" disabled={busy || page.loading || !page.hasNext} onClick={() => { setEditor(null); setDetail(null); setOffset((n) => n + ADMIN_PAGE_SIZE); }}>Próxima página</Button>
    </nav>
    {detail && <div className="admin-detail">
      <Button variant="secondary" disabled={busy} onClick={() => setDetail(null)}>Fechar detalhes</Button>
      {kind === "empresas" && <CompanyLinks key={detail.id} company={detail} busy={busy} onBusy={onBusy} />}
      {kind === "produtos" && <><h3>Parâmetros de {detail.nome}</h3><AdminRecords key={detail.id} kind="parametros" parentId={detail.id} busy={busy} onBusy={onBusy} actorId={actorId} /></>}
    </div>}
  </Card>;
}
