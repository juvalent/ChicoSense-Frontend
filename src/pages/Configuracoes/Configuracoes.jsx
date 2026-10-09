import { useState } from "react";

import Button from "../../components/UI/Button";
import Card from "../../components/UI/Card";
import Input from "../../components/UI/Input";
import EmptyState from "../../components/UI/EmptyState";

const sections = [
  { value: "organization", label: "Perfil e organização" },
  { value: "limits", label: "Limites de monitoramento" },
  { value: "integrations", label: "Integrações" },
];

const profileLabels = {
  produtor: "Produtor",
  logistica: "Logística",
  cliente: "Cliente / Mercado",
};

export default function Configuracoes({
  user,
  profile,
  organization,
  onSaveOrganization,
}) {
  const [section, setSection] = useState("organization");

  return (
    <div className="settings-page">
      <div className="settings-page__heading">
        <span className="settings-page__eyebrow">
          Workspace
        </span>

        <h1 className="page-title">Configurações</h1>

        <p className="settings-page__description">
          Consulte seu perfil e gerencie as informações da organização.
        </p>
      </div>

      <div className="settings-page__layout">
        <nav
          className="settings-page__nav"
          aria-label="Seções de configurações"
        >
          {sections.map((item) => (
            <button
              key={item.value}
              type="button"
              className="settings-page__nav-button"
              aria-pressed={section === item.value}
              onClick={() => setSection(item.value)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="settings-page__content">
          {section === "organization" && (
            <>
              <Card
                title="Perfil atual"
                description="Informações recebidas pela aplicação."
              >
                <dl className="settings-page__profile">
                  <div>
                    <dt>Usuário</dt>
                    <dd>{user?.name || "Não informado"}</dd>
                  </div>

                  <div>
                    <dt>E-mail</dt>
                    <dd>{user?.email || "Não informado"}</dd>
                  </div>

                  <div>
                    <dt>Perfil selecionado</dt>
                    <dd>
                      {profileLabels[profile] || "Não informado"}
                    </dd>
                  </div>
                </dl>
              </Card>

              <OrganizationForm
                key={JSON.stringify([
                  organization?.id,
                  organization?.name,
                  organization?.responsible,
                  organization?.email,
                ])}
                organization={organization}
                onSave={onSaveOrganization}
              />
            </>
          )}

          {section === "limits" && (
            <Card title="Limites de monitoramento">
              <EmptyState
                title="Configuração ainda não conectada"
                description="Os limites por produto serão apresentados quando o serviço de configuração estiver disponível."
              />
            </Card>
          )}

          {section === "integrations" && (
            <Card title="Integrações">
              <dl className="settings-page__profile">
                <div>
                  <dt>Fonte de sensores</dt>
                  <dd>ThingSpeak, por meio do backend</dd>
                </div>

                <div>
                  <dt>Situação da conexão</dt>
                  <dd>Não consultada nesta página</dd>
                </div>
              </dl>

              <p className="settings-page__notice">
                Esta seção não modifica a conexão utilizada pelo
                Dashboard. O status será conectado ao serviço
                de integração em uma próxima etapa.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function OrganizationForm({ organization, onSave }) {
  const [name, setName] = useState(organization?.name ?? "");
  const [responsible, setResponsible] = useState(
    organization?.responsible ?? ""
  );
  const [email, setEmail] = useState(organization?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const canSave = typeof onSave === "function";

  function clearFeedback() {
    setFeedback(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canSave || saving) return;

    setSaving(true);
    setFeedback(null);

    try {
      await onSave({
        name: name.trim(),
        responsible: responsible.trim(),
        email: email.trim(),
      });

      setFeedback({
        type: "success",
        message: "Informações salvas.",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "Não foi possível salvar. Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Organização"
      description="Informações administrativas da organização."
    >
      <form onSubmit={handleSubmit}>
        {!canSave && (
          <p className="settings-page__notice">
            O salvamento ainda não está conectado. Você pode
            preencher os campos, mas as alterações não serão
            persistidas.
          </p>
        )}

        <div className="settings-page__form-grid">
          <Input
            label="Nome da organização"
            name="organizationName"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearFeedback();
            }}
            disabled={saving}
            required
            maxLength={150}
            pattern=".*\S.*"
          />

          <Input
            label="Responsável"
            name="organizationResponsible"
            value={responsible}
            onChange={(event) => {
              setResponsible(event.target.value);
              clearFeedback();
            }}
            disabled={saving}
            required
            maxLength={150}
            pattern=".*\S.*"
          />

          <Input
            label="E-mail da organização"
            name="organizationEmail"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearFeedback();
            }}
            disabled={saving}
            required
          />
        </div>

        <div className="settings-page__form-actions">
          <Button
            type="submit"
            disabled={!canSave}
            loading={saving}
          >
            Salvar alterações
          </Button>
        </div>

        {feedback && (
          <p
            className={`settings-page__feedback settings-page__feedback--${feedback.type}`}
            role={feedback.type === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        )}
      </form>
    </Card>
  );
}