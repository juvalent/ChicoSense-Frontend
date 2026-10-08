
import { useEffect, useState } from "react";
import {
  Boxes,
  Check,
  Route,
  TriangleAlert,
} from "lucide-react";

import MetricCard from "../../components/Cards/MetricCard";
import ClimateChart from "../../components/Charts/ClimateChart";
import { listarLeituras } from "../../services/sensorService";

export default function Dashboard({
  user,
  profile,
  summary = {},
}) {
  const [sensorReadings, setSensorReadings] = useState([]);
  const [sensorLoading, setSensorLoading] = useState(true);
  const [sensorError, setSensorError] = useState("");

  const firstName = user?.name?.trim().split(/\s+/)[0];

  async function carregarSensores() {
    setSensorLoading(true);
    setSensorError("");

    try {
      const dados = await listarLeituras();
      setSensorReadings(dados);
    } catch (err) {
      console.error("Erro ao buscar sensores:", err);
      setSensorError(
        "Não foi possível carregar os dados do ThingSpeak."
      );
    } finally {
      setSensorLoading(false);
    }
  }

  useEffect(() => {
    carregarSensores();
  }, []);

  const metrics = [
    {
      title: "Viagens ativas",
      value: summary.activeTrips,
      icon: Route,
      tone: "neutral",
    },
    {
      title: "Cargas monitoradas",
      value: summary.monitoredLoads,
      icon: Boxes,
      tone: "neutral",
    },
    {
      title: "Condição normal",
      value: summary.normalLoads,
      icon: Check,
      tone: "success",
    },
    {
      title: "Exigem atenção",
      value: summary.loadsRequiringAttention,
      icon: TriangleAlert,
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

      <section
        className="dashboard__metrics"
        aria-label="Indicadores da operação"
      >
        {metrics.map(({ title, icon: Icon, ...metric }) => (
          <MetricCard
            key={title}
            title={title}
            description={
              metric.value == null
                ? "Dados indisponíveis"
                : undefined
            }
            icon={<Icon size={22} />}
            {...metric}
          />
        ))}
      </section>

      <ClimateChart
        readings={sensorReadings}
        loading={sensorLoading}
        error={sensorError}
        onRetry={carregarSensores}
      />
    </div>
  );
}
