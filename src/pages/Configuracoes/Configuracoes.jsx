
import { useEffect, useState } from "react";
import {
  Building2,
  Thermometer,
  Radio,
  UserRound,
} from "lucide-react";

import Card from "../../components/UI/Card";
import Button from "../../components/UI/Button";
import Input from "../../components/UI/Input";
import EmptyState from "../../components/UI/EmptyState";
import LoadingState from "../../components/UI/LoadingState";

import useViagemCargas from "../../hooks/useViagemCargas";
import ListProgress from "../../components/UI/ListProgress";
import { obterMonitoramentoCarga } from "../../services/cargaService";
import { PROFILE_LABELS } from "../../services/authProfile";
import CargoDeclaration from "../../components/Cards/CargoDeclaration";
import SessionReadingsPanel from "../../components/Cards/SessionReadingsPanel";

const sections = [
  {
    value: "organization",
    label: "Perfil e organização",
    icon: Building2,
  },
  {
    value: "limits",
    label: "Limites de monitoramento",
    icon: Thermometer,
  },
  {
    value: "integrations",
    label: "Integrações",
    icon: Radio,
  },
];

function display(value) {
  return value === null ||
    value === undefined ||
    value === ""
    ? "Não informado"
    : String(value);
}

export default function Configuracoes({
  user,
  profile,
  trips = [],
  organization,
  onSaveOrganization,
}) {
  const [section, setSection] = useState("organization");

  return (
    <div className="settings-page">
      <div className="settings-page__heading">
        <span className="settings-page__eyebrow">
          WORKSPACE
        </span>

        <h1 className="page-title">Configurações</h1>

        <p className="settings-page__description">
          Gerencie seu perfil e consulte as configurações
          e integrações do ChicoSense.
        </p>
      </div>

      <div className="settings-page__layout">
        <nav
          className="settings-page__nav"
          aria-label="Seções de configurações"
        >
          {sections.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.value}
                type="button"
                className={`settings-page__nav-button ${
                  section === item.value
                    ? "settings-page__nav-button--active"
                    : ""
                }`}
                aria-current={
                  section === item.value ? "page" : undefined
                }
                onClick={() => setSection(item.value)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="settings-page__content">
          {section === "organization" && (
            <>
              <Card
                title="Perfil atual"
                description="Informações do usuário autenticado."
              >
                <div className="settings-page__profile-header">
                  <span className="settings-page__profile-avatar">
                    <UserRound size={25} />
                  </span>

                  <div>
                    <h2>{display(user?.name)}</h2>
                    <p>{display(user?.email)}</p>
                  </div>
                </div>

                <dl className="settings-page__profile">
                  <div>
                    <dt>Usuário</dt>
                    <dd>{display(user?.name)}</dd>
                  </div>

                  <div>
                    <dt>E-mail</dt>
                    <dd>{display(user?.email)}</dd>
                  </div>

                  <div>
                    <dt>Perfil de acesso</dt>
                    <dd>
                      {PROFILE_LABELS[profile] ||
                        display(profile)}
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
            <MonitoringSettings trips={trips} />
          )}

          {section === "integrations" && (
            <SessionReadingsPanel trips={trips} />
          )}
        </div>
      </div>
    </div>
  );
}

function OrganizationForm({ organization, onSave }) {
  const [name, setName] = useState(
    organization?.name ?? ""
  );

  const [responsible, setResponsible] = useState(
    organization?.responsible ?? ""
  );

  const [email, setEmail] = useState(
    organization?.email ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const canSave = typeof onSave === "function";

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
        message: "Informações salvas com sucesso.",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "Não foi possível salvar as informações.",
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
      {!canSave && (
        <p className="settings-page__notice">
          A edição da organização ainda não está
          disponível. Os dados não serão enviados
          ao backend até que a integração de
          salvamento seja implementada.
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="settings-page__form-grid">
          <Input
            label="Nome da organização"
            name="organizationName"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setFeedback(null);
            }}
            disabled={saving || !canSave}
            required
          />

          <Input
            label="Responsável"
            name="organizationResponsible"
            value={responsible}
            onChange={(event) => {
              setResponsible(event.target.value);
              setFeedback(null);
            }}
            disabled={saving || !canSave}
            required
          />

          <Input
            label="E-mail da organização"
            name="organizationEmail"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFeedback(null);
            }}
            disabled={saving || !canSave}
            required
          />
        </div>

        <div className="settings-page__form-actions">
          <Button
            type="submit"
            disabled={!canSave || saving}
            loading={saving}
          >
            Salvar alterações
          </Button>
        </div>

        {feedback && (
          <p
            className={`settings-page__feedback settings-page__feedback--${feedback.type}`}
            role={
              feedback.type === "error"
                ? "alert"
                : "status"
            }
          >
            {feedback.message}
          </p>
        )}
      </form>
    </Card>
  );
}

function MonitoringSettings({ trips }) {
  const [tripId, setTripId] = useState("");
  const [loadId, setLoadId] = useState("");
  const cargoList = useViagemCargas(tripId);
  const loads = cargoList.records, loadingLoads = cargoList.loading;
  const [configuration, setConfiguration] = useState(null);

  const [loadingConfiguration, setLoadingConfiguration] =
    useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setLoadId(""); setConfiguration(null); setError(""); }, [tripId]);
  useEffect(() => {
    let active = true;

    setConfiguration(null);
    setError("");

    if (!loadId) return;

    async function fetchConfiguration() {
      setLoadingConfiguration(true);

      try {
        const data = await obterMonitoramentoCarga(loadId);

        if (active) {
          setConfiguration(data);
        }
      } catch {
        if (active) {
          setError(
            "Não foi possível consultar a configuração da carga."
          );
        }
      } finally {
        if (active) {
          setLoadingConfiguration(false);
        }
      }
    }

    fetchConfiguration();

    return () => {
      active = false;
    };
  }, [loadId]);

  return (
    <Card
      title="Configurações de monitoramento"
      description="Consulte as configurações registradas para cada carga."
    >
      <div className="settings-page__selectors">
        <div className="settings-page__field">
          <label htmlFor="settings-trip">
            Viagem
          </label>

          <select
            id="settings-trip"
            value={tripId}
            onChange={(event) =>
              setTripId(event.target.value)
            }
          >
            <option value="">
              Selecione uma viagem
            </option>

            {trips.map((trip) => (
              <option
                key={trip.id}
                value={String(trip.id)}
              >
                {trip.code || trip.id}
              </option>
            ))}
          </select>
        </div>

        <div className="settings-page__field">
          <label htmlFor="settings-load">
            Carga
          </label>

          <select
            id="settings-load"
            value={loadId}
            onChange={(event) =>
              setLoadId(event.target.value)
            }
            disabled={!tripId || loadingLoads}
          >
            <option value="">
              Selecione uma carga
            </option>

            {loads.map((load) => (
              <option
                key={load.id}
                value={String(load.id)}
              >
                {load.code || load.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tripId && <ListProgress list={cargoList} label="cargas das configurações" />}
      {(loadingLoads || loadingConfiguration) && (
        <LoadingState message="Consultando configurações..." />
      )}

      {error && (
        <p
          className="settings-page__feedback settings-page__feedback--error"
          role="alert"
        >
          {error}
        </p>
      )}

      {!tripId && !loadingLoads && (
        <EmptyState
          title="Selecione uma viagem"
          description="Escolha uma viagem para consultar suas cargas e configurações."
        />
      )}

      {tripId &&
        !loadingLoads &&
        loads.length === 0 &&
        !error && !cargoList.error && (
          <EmptyState
            title="Nenhuma carga encontrada"
            description="Esta viagem não possui cargas disponíveis."
          />
        )}

      {tripId &&
        loads.length > 0 &&
        !loadId &&
        !loadingLoads && (
          <EmptyState
            title="Selecione uma carga"
            description="Escolha uma carga para visualizar suas configurações."
          />
        )}

      {loadId &&
        !loadingConfiguration &&
        !configuration &&
        !error && !cargoList.error && (
          <EmptyState
            title="Configuração não encontrada"
            description="Não há configuração de monitoramento registrada para esta carga."
          />
        )}

      {configuration && !loadingConfiguration && (
        <>
          <CargoDeclaration declaration={configuration} />
          <p className="settings-page__notice">Esta declaração identifica a carga. Os limites ambientais são configurados por sessão e não são limiares científicos de risco por etileno.</p>
        </>
      )}
    </Card>
  );
}
