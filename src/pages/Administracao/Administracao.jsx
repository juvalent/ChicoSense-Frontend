
import { useState } from "react";
import { Info } from "lucide-react";

import Button from "../../components/UI/Button";

import {
  capabilities,
} from "../../services/capabilities";

import AdminRecords from "./AdminRecords";

import "./Administracao.css";

// ==========================================
// CONTROLE DE ACESSO
// ==========================================

export default function Administracao({ user }) {
  return capabilities(user).administer ? (
    <AdminWorkspace
      key={user.id}
      user={user}
    />
  ) : (
    <main>

      <h1 className="page-title">
        Administração
      </h1>

      <p role="alert">
        Acesso exclusivo a administradores ativos.
      </p>

    </main>
  );
}

// ==========================================
// ÁREA ADMINISTRATIVA
// ==========================================

function AdminWorkspace({ user }) {
  const [kind, setKind] = useState("empresas");
  const [busy, setBusy] = useState(false);

  return (
    <div className="admin-page">

      {/* CABEÇALHO DA PÁGINA */}

      <header className="admin-page__header">

        <span className="admin-page__eyebrow">
          Gestão do sistema
        </span>

        <h1 className="page-title">
          Administração
        </h1>

        <p className="admin-description">
          Gerencie empresas, usuários, vínculos
          e o catálogo de produtos da plataforma.
        </p>

      </header>

      {/* AVISO INFORMATIVO */}

      <div
        className="admin-notice"
        role="note"
      >

        <div className="admin-notice__icon">
          <Info
            size={21}
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>

        <div className="admin-notice__content">

          <strong>
            Preservação dos registros
          </strong>

          <p>
            A inativação de cadastros preserva
            os registros e o histórico de operações
            do sistema.
          </p>

        </div>

      </div>

      {/* NAVEGAÇÃO ADMINISTRATIVA */}

      <nav
        className="admin-actions admin-navigation"
        aria-label="Cadastros administrativos"
      >

        {[
          ["empresas", "Empresas"],
          ["usuarios", "Usuários"],
          ["produtos", "Produtos"],
        ].map(([value, label]) => (

          <Button
            key={value}
            variant={
              value === kind
                ? "primary"
                : "secondary"
            }
            disabled={busy}
            aria-pressed={value === kind}
            onClick={() => setKind(value)}
          >
            {label}
          </Button>

        ))}

      </nav>

      {/* REGISTROS ADMINISTRATIVOS */}

      <AdminRecords
        key={kind}
        kind={kind}
        busy={busy}
        onBusy={setBusy}
        actorId={user.id}
      />

    </div>
  );
}
