import { useState } from "react";
import Button from "../../components/UI/Button";
import { capabilities } from "../../services/capabilities";
import AdminRecords from "./AdminRecords";
import "./Administracao.css";

export default function Administracao({ user }) {
  return capabilities(user).administer ? <AdminWorkspace key={user.id} user={user} /> :
    <main><h1 className="page-title">Administração</h1><p role="alert">Acesso exclusivo a administradores ativos.</p></main>;
}

function AdminWorkspace({ user }) {
  const [kind, setKind] = useState("empresas");
  const [busy, setBusy] = useState(false);
  return <div className="admin-page">
    <h1 className="page-title">Administração</h1>
    <p>Gerencie empresas, usuários, vínculos e o catálogo de produtos. Inativar preserva registros e histórico.</p>
    <nav className="admin-actions" aria-label="Cadastros administrativos">
      {[['empresas', 'Empresas'], ['usuarios', 'Usuários'], ['produtos', 'Produtos']].map(([value, label]) =>
        <Button key={value} variant={value === kind ? "primary" : "secondary"} disabled={busy} aria-pressed={value === kind} onClick={() => setKind(value)}>{label}</Button>)}
    </nav>
    <AdminRecords key={kind} kind={kind} busy={busy} onBusy={setBusy} actorId={user.id} />
  </div>;
}
