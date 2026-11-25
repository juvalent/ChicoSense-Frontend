import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { dashboardSummary } from "../../services/backendIntegrationService";
import Button from "../../components/UI/Button";
import {
  Activity,
  Bell,
  Boxes,
  Route,
} from "lucide-react";

import MetricCard from "../../components/Cards/MetricCard";
import SessionReadingsPanel from "../../components/Cards/SessionReadingsPanel";
import TransitTripsTable from "../../components/Tables/TransitTripsTable";
import Card from "../../components/UI/Card";
import EmptyState from "../../components/UI/EmptyState";
import ErrorState from "../../components/UI/ErrorState";
import LoadingState from "../../components/UI/LoadingState";

export default function Dashboard({
  user,
  trips = [],
  tripsLoading = false,
  tripsError,
  onRetryTrips,
}) {
  const navigate = useNavigate();
  const [totals, setTotals] = useState({ data: null, error: "", loading: true });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    dashboardSummary(controller.signal).then((data) => { if (!controller.signal.aborted) setTotals({ data, error: "", loading: false }); })
      .catch(() => { if (!controller.signal.aborted) setTotals({ data: null, error: "Não foi possível consultar os totais autorizados. Dados indisponíveis não representam zero.", loading: false }); });
    return () => controller.abort();
  }, [user?.id, refresh]);
  const summary = totals.data || {};

  const firstName = user?.name?.trim().split(/\s+/)[0];

  const transitTrips = trips.filter(
    (trip) => trip.status === "in_transit"
  );

  const metrics = [
    {
      title: "Viagens em trânsito",
      value: summary.transitTrips,
      description: "Total autorizado no backend",
      icon: Route,
      tone: "neutral",
    },
    {
      title: "Cargas monitoradas",
      value: summary.monitoredLoads,
      description: "Cargas com declaração de monitoramento",
      icon: Boxes,
      tone: "neutral",
    },
    {
      title: "Sessões ativas",
      value: summary.activeSessions,
      description: "Estado da sessão, sem garantia de aquisição contínua",
      icon: Activity,
      tone: "active",
    },
    {
      title: "Alertas abertos",
      value: summary.openAlerts,
      description: "Pendentes de resolução final",
      icon: Bell,
      tone: "warning",
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard__heading">
        <span className="dashboard__eyebrow">
          Visão geral
        </span>

        <h1 className="dashboard__title">
          {firstName ? `Olá, ${firstName}.` : "Olá."} Visão das suas cargas
        </h1>

        <p className="dashboard__description">
          Acompanhe as condições da cadeia fria e priorize o que
          precisa de atenção.
        </p>
      </div>

      {totals.error && <p role="alert">{totals.error}</p>}
      {totals.loading && <p role="status">Consultando totais autorizados…</p>}
      <Button variant="secondary" disabled={totals.loading} onClick={() => { setTotals({ data: null, error: "", loading: true }); setRefresh((n) => n + 1); }}>Atualizar indicadores</Button>
      <section
        className="dashboard__metrics"
        aria-label="Indicadores da operação"
      >
        {metrics.map(({ title, icon: Icon, description, ...metric }) => (
          <MetricCard
            key={title}
            title={title}
            description={
              metric.value == null
                ? "Dados indisponíveis"
                : description
            }
            icon={<Icon size={18} />}
            {...metric}
          />
        ))}
      </section>

      <SessionReadingsPanel trips={trips} />

      <Card
        title="Viagens em trânsito"
        description="Rotas em deslocamento entre as viagens carregadas. Use Carregar mais viagens para ampliar a consulta."
      >
        {tripsLoading ? (
          <LoadingState message="Carregando viagens…" />
        ) : tripsError ? (
          <ErrorState message={tripsError} onRetry={onRetryTrips} />
        ) : transitTrips.length === 0 ? (
          <EmptyState
            title="Nenhuma viagem em trânsito entre os registros carregados"
            description="Carregue mais viagens para ampliar a consulta. Esta lista não é um total global."
          />
        ) : (
          <TransitTripsTable
            trips={transitTrips}
            onOpenTrip={() => navigate("/viagens")}
          />
        )}
      </Card>
    </div>
  );
}
