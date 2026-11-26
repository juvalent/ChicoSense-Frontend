import { useEffect, useState } from "react";

import {
  Building2,
  Thermometer,
  Radio,
  UserRound,
  UsersRound,
  Info,
  Save,
} from "lucide-react";

import Card from "../../components/UI/Card";
import Button from "../../components/UI/Button";
import Input from "../../components/UI/Input";
import EmptyState from "../../components/UI/EmptyState";
import LoadingState from "../../components/UI/LoadingState";
import ListProgress from "../../components/UI/ListProgress";

import useViagemCargas from "../../hooks/useViagemCargas";

import { obterMonitoramentoCarga } from "../../services/cargaService";
import { PROFILE_LABELS } from "../../services/authProfile";
import { capabilities } from "../../services/capabilities";

import CargoDeclaration from "../../components/Cards/CargoDeclaration";
import SessionReadingsPanel from "../../components/Cards/SessionReadingsPanel";

import AdminRecords from "../Administracao/AdminRecords";

import "../Administracao/Administracao.css";
import "./ConfiguracoesVisual.css";

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function initials(name) {
  return String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function display(value) {
  return value === null ||
    value === undefined ||
    value === ""
    ? "Não informado"
    : String(value);
}

// ==========================================
// SEÇÕES DE CONFIGURAÇÕES
// ==========================================

const sections = [
  {
    value: "organization",
    label: "Perfil e organização",
    icon: Building2,
  },
  {
    value: "users",
    label: "Usuários e permissões",
    icon: UsersRound,
    adminOnly: true,
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

// ==========================================
// PÁGINA DE CONFIGURAÇÕES
// ==========================================

export default function Configuracoes({
  user,
  profile,
  trips = [],
  organization,
  onSaveOrganization,
}) {
  const [section, setSection] = useState("organization");
  const [busy, setBusy] = useState(false);

  // Controle de permissões

  const canAdminister = Boolean(
    user && capabilities(user).administer
  );

  const availableSections = sections.filter(
    (item) => !item.adminOnly || canAdminister
  );

  const currentSection =
    section === "users" && !canAdminister
      ? "organization"
      : section;

  const userName = user?.name ?? user?.nome;

  return (
    <div className="settings-page settings-visual">

      {/* CABEÇALHO */}

      <div className="settings-page__heading">

        <span className="settings-page__eyebrow">
          WORKSPACE
        </span>

        <h1 className="page-title">
          Configurações
        </h1>

        <p className="settings-page__description">
          Gerencie seu perfil, permissões, configurações
          e integrações do ChicoSense.
        </p>

      </div>

      <div className="settings-page__layout">

        {/* MENU DE NAVEGAÇÃO */}

        <nav
          className="settings-page__nav"
          aria-label="Seções de configurações"
        >

          {availableSections.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.value}
                type="button"
                disabled={busy}
                className={`settings-page__nav-button ${
                  currentSection === item.value
                    ? "settings-page__nav-button--active"
                    : ""
                }`}
                aria-current={
                  currentSection === item.value
                    ? "page"
                    : undefined
                }
                onClick={() => setSection(item.value)}
              >

                <Icon
                  size={18}
                  aria-hidden="true"
                />

                <span>{item.label}</span>

              </button>
            );
          })}

        </nav>

        {/* CONTEÚDO */}

        <div className="settings-page__content">

          {/* PERFIL E ORGANIZAÇÃO */}

          {currentSection === "organization" && (
            <>
              <Card
                title="Perfil atual"
                description="Informações do usuário autenticado."
              >

                <div className="settings-page__profile-header">

                  <span className="settings-page__profile-avatar">

                    {initials(userName) || (
                      <UserRound size={25} />
                    )}

                  </span>

                  <div>

                    <h2>{display(userName)}</h2>

                    <p>{display(user?.email)}</p>

                  </div>

                </div>

                <dl className="settings-page__profile">

                  <div>
                    <dt>Usuário</dt>
                    <dd>{display(userName)}</dd>
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

          {/* USUÁRIOS E PERMISSÕES */}

          {currentSection === "users" &&
            canAdminister && (

              <div className="settings-page__users admin-page">

                <div
                  className="settings-page__notice settings-visual__notice"
                  role="note"
                >

                  <Info
                    size={22}
                    aria-hidden="true"
                  />

                  <div>

                    <strong>
                      Gerenciamento de usuários e permissões
                    </strong>

                    <p>
                      Cadastre usuários, consulte os perfis
                      disponíveis e gerencie as permissões
                      de acesso à plataforma.
                    </p>

                  </div>

                </div>

                <AdminRecords
                  key={`settings-users:${user.id}`}
                  kind="usuarios"
                  busy={busy}
                  onBusy={setBusy}
                  actorId={user.id}
                />

              </div>

            )}

          {/* LIMITES DE MONITORAMENTO */}

          {currentSection === "limits" && (
            <MonitoringSettings trips={trips} />
          )}

          {/* INTEGRAÇÕES */}

          {currentSection === "integrations" && (
            <SessionReadingsPanel trips={trips} />
          )}

        </div>

      </div>

    </div>
  );
}

// ==========================================
// FORMULÁRIO DA ORGANIZAÇÃO
// ==========================================

function OrganizationForm({
  organization,
  onSave,
}) {
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

        <div
          className="settings-page__notice settings-visual__notice"
          role="note"
        >

          <Info
            size={22}
            aria-hidden="true"
          />

          <div>

            <strong>Edição indisponível</strong>

            <p>
              A edição da organização ainda não está
              disponível. Os dados não serão enviados
              ao backend até que a integração de
              salvamento seja implementada.
            </p>

          </div>

        </div>

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

            <Save
              size={16}
              aria-hidden="true"
            />

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

// ==========================================
// CONFIGURAÇÕES DE MONITORAMENTO
// ==========================================

function MonitoringSettings({ trips }) {

  const [tripId, setTripId] = useState("");
  const [loadId, setLoadId] = useState("");

  const cargoList = useViagemCargas(tripId);

  const loads = cargoList.records;
  const loadingLoads = cargoList.loading;

  const [configuration, setConfiguration] =
    useState(null);

  const [
    loadingConfiguration,
    setLoadingConfiguration,
  ] = useState(false);

  const [error, setError] = useState("");

  // Limpar a seleção ao trocar de viagem

  useEffect(() => {
    setLoadId("");
    setConfiguration(null);
    setLoadingConfiguration(false);
    setError("");
  }, [tripId]);

  // Consultar configuração da carga

  useEffect(() => {

    let active = true;

    setConfiguration(null);
    setError("");

    if (!loadId) {
      setLoadingConfiguration(false);
      return;
    }

    async function fetchConfiguration() {

      setLoadingConfiguration(true);

      try {

        const data = await obterMonitoramentoCarga(
          loadId
        );

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

      {/* SELETORES */}

      <div className="settings-page__selectors">

        {/* VIAGEM */}

        <div className="settings-page__field">

          <label htmlFor="settings-trip">
            Viagem
          </label>

          <select
            id="settings-trip"
            value={tripId}
            onChange={(event) => {
              setLoadId("");
              setConfiguration(null);
              setTripId(event.target.value);
            }}
          >

            <option value="">
              Selecione uma viagem
            </option>

            {trips.map((trip) => (

              <option
                key={trip.id}
                value={String(trip.id)}
              >

                {trip.code ||
                  `#${String(trip.id).slice(0, 8)}`}

              </option>

            ))}

          </select>

        </div>

        {/* CARGA */}

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

                {load.code ||
                  load.identificacao ||
                  `#${String(load.id).slice(0, 8)}`}

              </option>

            ))}

          </select>

        </div>

      </div>

      {/* PAGINAÇÃO E ATUALIZAÇÃO */}

      {tripId && (

        <ListProgress
          list={cargoList}
          label="cargas das configurações"
        />

      )}

      {/* CARREGAMENTO */}

      {(loadingLoads || loadingConfiguration) && (

        <LoadingState
          message="Consultando configurações..."
        />

      )}

      {/* ERRO */}

      {error && (

        <p
          className="settings-page__feedback settings-page__feedback--error"
          role="alert"
        >

          {error}

        </p>

      )}

      {/* NENHUMA VIAGEM SELECIONADA */}

      {!tripId && !loadingLoads && (

        <EmptyState
          title="Selecione uma viagem"
          description="Escolha uma viagem para consultar suas cargas e configurações."
        />

      )}

      {/* NENHUMA CARGA ENCONTRADA */}

      {tripId &&
        !loadingLoads &&
        loads.length === 0 &&
        !error &&
        !cargoList.error && (

          <EmptyState
            title="Nenhuma carga encontrada"
            description="Esta viagem não possui cargas disponíveis."
          />

        )}

      {/* NENHUMA CARGA SELECIONADA */}

      {tripId &&
        loads.length > 0 &&
        !loadId &&
        !loadingLoads && (

          <EmptyState
            title="Selecione uma carga"
            description="Escolha uma carga para visualizar suas configurações."
          />

        )}

      {/* CONFIGURAÇÃO NÃO ENCONTRADA */}

      {loadId &&
        !loadingConfiguration &&
        !configuration &&
        !error &&
        !cargoList.error && (

          <EmptyState
            title="Configuração não encontrada"
            description="Não há configuração de monitoramento registrada para esta carga."
          />

        )}

      {/* DECLARAÇÃO DA CARGA */}

      {configuration && !loadingConfiguration && (

        <>

          <CargoDeclaration
            declaration={configuration}
          />

          <div
            className="settings-page__notice settings-visual__notice"
            role="note"
          >

            <Info
              size={22}
              aria-hidden="true"
            />

            <div>

              <strong>Limites ambientais</strong>

              <p>
                Esta declaração identifica a carga.
                Os limites ambientais são configurados
                por sessão e não são limiares científicos
                de risco por etileno.
              </p>

            </div>

          </div>

        </>

      )}

    </Card>

  );
}