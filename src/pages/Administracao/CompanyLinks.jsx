import { useEffect, useRef, useState } from "react";
import Card from "../../components/UI/Card";
import Select from "../../components/UI/Select";
import Button from "../../components/UI/Button";
import { ADMIN_PAGE_SIZE, adminError, linkCompanyUser, readAdminPage, readCompanyUsers } from "../../services/adminService";

export default function CompanyLinks({ company, busy, onBusy }) {
  const [offset, setOffset] = useState(0);
  const [optionOffset, setOptionOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [view, setView] = useState({ linked: [], options: [], loading: true, error: "", hasNext: false, moreOptions: false });
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setView({ linked: [], options: [], loading: true, error: "", hasNext: false, moreOptions: false });
      try {
        const [linked, options] = await Promise.all([
          readCompanyUsers(company.id, { offset, signal: controller.signal }),
          readAdminPage("usuarios", { offset: optionOffset, signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) setView({ linked: linked.records, options: options.records, loading: false, error: "", hasNext: linked.hasNext, moreOptions: options.hasNext });
      } catch (error) {
        if (!controller.signal.aborted) setView({ linked: [], options: [], loading: false, error: adminError(error), hasNext: false, moreOptions: false });
      }
    }
    load();
    return () => controller.abort();
  }, [company.id, offset, optionOffset, refresh]);

  async function link(event) {
    event.preventDefault();
    if (busy || pending.current || !view.options.some((option) => option.id === userId)) return;
    pending.current = true; setSaving(true); onBusy(true); setFailure(""); setMessage("");
    try {
      await linkCompanyUser(company.id, userId);
      if (mounted.current) { setUserId(""); setOffset(0); setRefresh((n) => n + 1); setMessage("Vínculo confirmado."); }
    } catch (error) { if (mounted.current) setFailure(adminError(error, true)); }
    finally { pending.current = false; if (mounted.current) { setSaving(false); onBusy(false); } }
  }

  return <Card title={`Vínculos de ${company.nome}`}>
    <p>O vínculo concede acesso aos dados da empresa conforme o perfil do usuário. Tipo de empresa e perfil são informações distintas.</p>
    {message && <p role="status">{message}</p>}
    {failure && <p role="alert">{failure}</p>}
    {view.loading ? <p role="status">Consultando vínculos e usuários…</p> : view.error ? <p role="alert">{view.error}</p> : <>
      <h3>Usuários com vínculo ativo</h3>
      {view.linked.length ? <ul>{view.linked.map((person) => <li key={person.id}>{person.nome} · {person.email} · {person.ativo ? "Usuário ativo" : "Usuário inativo"}</li>)}</ul> : <p>Nenhum vínculo ativo nesta página.</p>}
      <nav className="admin-actions" aria-label="Paginação dos vínculos">
        <Button variant="secondary" disabled={busy || offset === 0} onClick={() => setOffset((n) => Math.max(0, n - ADMIN_PAGE_SIZE))}>Vínculos anteriores</Button>
        <span>Página {offset / ADMIN_PAGE_SIZE + 1}</span>
        <Button variant="secondary" disabled={busy || !view.hasNext} onClick={() => setOffset((n) => n + ADMIN_PAGE_SIZE)}>Próximos vínculos</Button>
      </nav>
      <form onSubmit={link} aria-label="Vincular usuário à empresa">
        <Select label="Usuário para vincular" value={userId} disabled={busy}
          options={[{ value: "", label: "Selecione um usuário desta página" }, ...view.options.map((person) => ({ value: person.id, label: `${person.nome} · ${person.email}${person.ativo ? "" : " (inativo)"}` }))]}
          onChange={(event) => setUserId(event.target.value)} />
        <div className="admin-actions">
          <Button variant="secondary" disabled={busy || optionOffset === 0} onClick={() => { setUserId(""); setOptionOffset((n) => Math.max(0, n - ADMIN_PAGE_SIZE)); }}>Opções anteriores de usuários</Button>
          <span>Página de opções {optionOffset / ADMIN_PAGE_SIZE + 1}</span>
          <Button variant="secondary" disabled={busy || !view.moreOptions} onClick={() => { setUserId(""); setOptionOffset((n) => n + ADMIN_PAGE_SIZE); }}>Próximas opções de usuários</Button>
          <Button type="submit" disabled={!userId || (busy && !saving)} loading={saving}>Vincular ou reativar usuário</Button>
        </div>
      </form>
    </>}
    <Button variant="secondary" disabled={busy || view.loading} onClick={() => setRefresh((n) => n + 1)}>Atualizar vínculos</Button>
    <p>A API atual permite criar ou reativar vínculos. Não oferece remoção ou desativação individual do vínculo. O vínculo não ativa uma empresa ou um usuário inativo.</p>
  </Card>;
}
