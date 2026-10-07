import {
  Boxes,
  Check,
  Route,
  TriangleAlert,
}                   from "lucide-react";
import MetricCard   from "../../components/Cards/MetricCard";
import ClimateChart from "../../components/Charts/ClimateChart";

export default function Dashboard({
  user,
  summary = {},
  readings = [],
  temperatureLimit,
  loading = false,
  error,
  onRetry,
}) {

    const firstName = user?.name?.trim().split(/\s+/)[0];

  const metrics = [
    {
      title: "Viagens ativas",
      value: summary.activeTrips,
      icon:  Route,
      tone:  "neutral",
    },
    {
      title: "Cargas monitoradas",
      value: summary.monitoredLoads,
      icon:  Boxes,
      tone: "neutral",
    },
    {
      title: "Condição normal",
      value: summary.normalLoads,
      icon:  Check,
      tone:  "success",
    },
    {
      title:  "Exigem atenção",
      value:  summary.loadsRequiringAttention,
      icon:   TriangleAlert,
      tone:   "warning",
    },
  ];

  return (
    <div className      ="dashboard">
      <div className    ="dashboard__heading">
        <span className ="dashboard__eyebrow">
          Visão geral
        </span>

        <h1 className ="dashboard__title">
          {firstName ? `Olá, ${firstName}.` : "Olá."} Visão das suas cargas
        </h1>

        <p className  ="dashboard__description">
          Acompanhe as condições da cadeia fria e priorize o que
          precisa de atenção.
        </p>
      </div>

      <section
        className="dashboard__metrics"
        aria-label="Indicadores da operação"
      >
        {metrics.map(({ title, icon: Icon, ...metric }) => (
          <MetricCard
            key   ={title}
            title ={title}
            description={
              loading
                ? "Carregando…"
                : metric.value == null
                  ? "Dados indisponíveis"
                  : undefined
            }
            icon={<Icon size={22} />}
            {...metric}
          />
        ))}
      </section>

      <ClimateChart
        readings         ={readings}
        temperatureLimit ={temperatureLimit}
        loading          ={loading}
        error            ={error}
        onRetry          ={onRetry}
      />
    </div>
  );
}