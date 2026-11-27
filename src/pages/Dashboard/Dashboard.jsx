
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import {
  Activity,
  Bell,
  Boxes,
  Route,
  RefreshCw,
  Thermometer,
  Droplets,
  Info,
} from "lucide-react";

import {
  dashboardSummary,
} from "../../services/backendIntegrationService";

import {
  listarLeiturasDashboard,
} from "../../services/sensorService";

import Button from "../../components/UI/Button";
import MetricCard from "../../components/Cards/MetricCard";
import ClimateChart from "../../components/Charts/ClimateChart";
import SessionReadingsPanel from "../../components/Cards/SessionReadingsPanel";
import TransitTripsTable from "../../components/Tables/TransitTripsTable";
import Card from "../../components/UI/Card";
import EmptyState from "../../components/UI/EmptyState";
import ErrorState from "../../components/UI/ErrorState";
import LoadingState from "../../components/UI/LoadingState";

// ==========================================
// FORMATAÇÃO DOS DADOS
// ==========================================

function formatarMedicao(value, unit) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })} ${unit}`;
}

function formatarHorario(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(date);
}

// ==========================================
// DASHBOARD
// ==========================================

export default function Dashboard({
  user,
  trips = [],
  tripsLoading = false,
  tripsError,
  onRetryTrips,
  tripsList,
}) {
  const navigate = useNavigate();

  const [totals, setTotals] = useState({
    data: null,
    error: "",
    loading: true,
  });

  const [refresh, setRefresh] = useState(0);

  const [sensorReadings, setSensorReadings] =
    useState([]);

  const [sensorLoading, setSensorLoading] =
    useState(true);

  const [sensorError, setSensorError] =
    useState("");

  const [sensorRefresh, setSensorRefresh] =
    useState(0);

  // ==========================================
  // INDICADORES DO BACKEND
  // ==========================================

  useEffect(() => {
    const controller = new AbortController();

    dashboardSummary(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setTotals({
            data,
            error: "",
            loading: false,
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTotals({
            data: null,
            error:
              "Não foi possível consultar os indicadores.",
            loading: false,
          });
        }
      });

    return () => controller.abort();
  }, [user?.id, refresh]);

  function atualizarIndicadores() {
    setTotals((previous) => ({
      ...previous,
      error: "",
      loading: true,
    }));

    setRefresh((n) => n + 1);
  }

  // ==========================================
  // THINGSPEAK - TODOS OS PERFIS
  // ==========================================

  useEffect(() => {
    let cancelled = false;
    let running = false;

    async function carregarSensores(initial = false) {
      if (running || cancelled) return;

      running = true;

      if (initial) {
        setSensorLoading(true);
      }

      try {
        const dados = await listarLeiturasDashboard(100);

        if (!cancelled) {
          setSensorReadings(dados);
          setSensorError("");
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Erro ao consultar ThingSpeak:",
            error
          );

          setSensorError(
            error?.response?.status === 403
              ? "O backend não autorizou a consulta ao ThingSpeak para este perfil."
              : "Não foi possível atualizar os dados do ThingSpeak."
          );
        }
      } finally {
        running = false;

        if (!cancelled) {
          setSensorLoading(false);
        }
      }
    }

    carregarSensores(true);

    // Atualização automática a cada 30 segundos
    const interval = setInterval(() => {
      carregarSensores();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id, sensorRefresh]);

  function atualizarSensores() {
    setSensorRefresh((n) => n + 1);
  }

  // ==========================================
  // TRATAMENTO DOS DADOS
  // ==========================================

  const summary = totals.data || {};

  const firstName = (
    user?.name ??
    user?.nome ??
    ""
  ).trim().split(/\s+/)[0];

  const transitTrips = trips.filter(
    (trip) => trip.status === "in_transit"
  );

  const ultimaLeitura =
    sensorReadings[sensorReadings.length - 1];

  const ultimaTemperatura = [...sensorReadings]
    .reverse()
    .find((item) =>
      Number.isFinite(item.temperature)
    );

  const ultimaUmidade = [...sensorReadings]
    .reverse()
    .find((item) =>
      Number.isFinite(item.humidity)
    );

  // ==========================================
  // INDICADORES OPERACIONAIS
  // ==========================================

  const metrics = [
    {
      title: "Viagens em trânsito",
      value: summary.transitTrips,
      description: "Viagens em deslocamento",
      icon: Route,
      tone: "neutral",
    },
    {
      title: "Cargas monitoradas",
      value: summary.monitoredLoads,
      description: "Cargas com monitoramento declarado",
      icon: Boxes,
      tone: "neutral",
    },
    {
      title: "Sessões ativas",
      value: summary.activeSessions,
      description: "Sessões de monitoramento abertas",
      icon: Activity,
      tone: "active",
    },
    {
      title: "Alertas abertos",
      value: summary.openAlerts,
      description: "Pendentes de resolução",
      icon: Bell,
      tone: "warning",
    },
  ];

  // ==========================================
  // INTERFACE
  // ==========================================

  return (
    <div className="dashboard">

      {/* CABEÇALHO PRINCIPAL */}

      <div className="dashboard__heading">

        <span className="dashboard__eyebrow">
          Visão geral
        </span>

        <div className="dashboard__title-row">

          <h1 className="dashboard__title">
            {firstName
              ? `Olá, ${firstName}.`
              : "Olá."}
            {" "}Visão das suas cargas
          </h1>

          <Button
            variant="secondary"
            disabled={totals.loading}
            onClick={atualizarIndicadores}
          >
            <RefreshCw
              size={16}
              className={
                totals.loading
                  ? "dashboard__refresh--spinning"
                  : ""
              }
            />

            {totals.loading
              ? "Atualizando..."
              : "Atualizar indicadores"}
          </Button>

        </div>

        <p className="dashboard__description">
          Acompanhe as condições da cadeia fria
          e priorize o que precisa de atenção.
        </p>

      </div>

      {/* ESTADOS DOS INDICADORES */}

      {totals.error && (
        <div
          className="dashboard__notice dashboard__notice--error"
          role="alert"
        >
          <Info
            size={20}
            className="dashboard__notice-icon"
            aria-hidden="true"
          />

          <div className="dashboard__notice-content">
            <strong>
              Indicadores indisponíveis
            </strong>

            <p>{totals.error}</p>
          </div>
        </div>
      )}

      {/* CARDS OPERACIONAIS */}

      <section
        className="dashboard__metrics"
        aria-label="Indicadores da operação"
        aria-busy={totals.loading}
      >
        {metrics.map(
          ({ title, icon: Icon, description, ...metric }) => (
            <MetricCard
              key={title}
              title={title}
              description={
                totals.loading && metric.value == null
                  ? "Carregando informações..."
                  : metric.value == null
                    ? "Dados indisponíveis"
                    : description
              }
              icon={<Icon size={18} />}
              {...metric}
            />
          )
        )}
      </section>

      {/* MONITORAMENTO IOT */}

      <section
        className="dashboard__iot"
        aria-label="Monitoramento IoT"
      >
        <div className="dashboard__iot-heading">

          <div>
            <h2>Monitoramento IoT</h2>

            <p>
              Leituras globais do protótipo
              conectado ao ThingSpeak.
            </p>
          </div>

          <Button
            variant="secondary"
            disabled={sensorLoading}
            onClick={atualizarSensores}
          >
            <RefreshCw
              size={16}
              className={
                sensorLoading
                  ? "dashboard__refresh--spinning"
                  : ""
              }
            />

            {sensorLoading
              ? "Atualizando..."
              : "Atualizar leituras"}
          </Button>

        </div>

        {/* TEMPERATURA E UMIDADE */}

        <div className="dashboard__sensor-grid">

          <MetricCard
            title="Temperatura"
            value={formatarMedicao(
              ultimaTemperatura?.temperature,
              "°C"
            )}
            description={
              sensorError
                ? ultimaTemperatura
                  ? "Último valor disponível; atualização falhou"
                  : "Dados indisponíveis"
                : formatarHorario(
                    ultimaTemperatura?.timestamp
                  )
            }
            icon={<Thermometer size={18} />}
            tone="neutral"
          />

          <MetricCard
            title="Umidade"
            value={formatarMedicao(
              ultimaUmidade?.humidity,
              "%"
            )}
            description={
              sensorError
                ? ultimaUmidade
                  ? "Último valor disponível; atualização falhou"
                  : "Dados indisponíveis"
                : formatarHorario(
                    ultimaUmidade?.timestamp
                  )
            }
            icon={<Droplets size={18} />}
            tone="neutral"
          />

        </div>

        {/* GRÁFICO THINGSPEAK */}

        <ClimateChart
          title="Histórico de temperatura e umidade"
          description={
            "Leituras globais do ThingSpeak. " +
            "Não representam uma carga específica."
          }
          readings={sensorReadings}
          loading={sensorLoading}
          error={sensorError}
          onRetry={atualizarSensores}
        />

        <p className="dashboard__sensor-info">
          Última medição recebida:{" "}
          {formatarHorario(
            ultimaLeitura?.timestamp
          )}
          {" · "}Consulta automática a cada 30 segundos.
        </p>

      </section>

      {/* LEITURAS VINCULADAS ÀS SESSÕES */}

      <SessionReadingsPanel trips={trips} />

      {/* VIAGENS EM TRÂNSITO */}

      <Card>

        <div className="dashboard__section-header">

          <div>
            <h2 className="dashboard__section-title">
              Viagens em trânsito
            </h2>

            <p className="dashboard__section-description">
              Acompanhe as viagens em deslocamento.
            </p>
          </div>

          <div className="dashboard__trip-actions">
  {tripsList?.hasNext && (
    <Button
      variant="secondary"
      disabled={tripsList.loading}
      onClick={tripsList.more}
    >
      Carregar mais viagens
    </Button>
  )}

  <Button
    variant="secondary"
    disabled={
      tripsLoading ||
      tripsList?.loading ||
      !onRetryTrips
    }
    onClick={() => onRetryTrips?.()}
  >
    <RefreshCw
      size={16}
      className={
        tripsLoading || tripsList?.loading
          ? "dashboard__refresh--spinning"
          : ""
      }
    />

    {tripsLoading || tripsList?.loading
      ? "Atualizando..."
      : "Atualizar lista de viagens"}
  </Button>
</div>

        </div>

        {/* AVISO DE REGISTROS CARREGADOS */}

        {!tripsLoading && !tripsError && (
          <div
            className="dashboard__notice"
            role="status"
          >
            <Info
              size={20}
              className="dashboard__notice-icon"
              aria-hidden="true"
            />

            <div className="dashboard__notice-content">

              <strong>
                {trips.length}{" "}
                {trips.length === 1
                  ? "viagem carregada"
                  : "viagens carregadas"}
              </strong>

              <p>
                Os filtros e as contagens desta lista
                consideram apenas os registros carregados.
                Os indicadores gerais são consultados
                diretamente no backend.
              </p>

            </div>
          </div>
        )}

        {/* TABELA DE VIAGENS */}

        {tripsLoading ? (
          <LoadingState
            message="Carregando viagens…"
          />
        ) : tripsError ? (
          <ErrorState
            message={tripsError}
            onRetry={onRetryTrips}
          />
        ) : transitTrips.length === 0 ? (
          <EmptyState
            title="Nenhuma viagem em trânsito"
            description="Não existem viagens em trânsito entre os registros carregados."
          />
        ) : (
          <TransitTripsTable
            trips={transitTrips}
            onOpenTrip={() =>
              navigate("/viagens")
            }
          />
        )}

      </Card>

    </div>
  );
}
