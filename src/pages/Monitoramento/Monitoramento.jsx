import { Droplets, Thermometer } from "lucide-react";

import ComparisonCard from "../../components/Cards/ComparisonCard";
import Card from "../../components/UI/Card";
import EmptyState from "../../components/UI/EmptyState";
import ErrorState from "../../components/UI/ErrorState";
import LoadingState from "../../components/UI/LoadingState";

export default function Monitoramento({
  connected = false,
  comparison,
  loading = false,
  error,
  onRetry,
}) {
  const hasMeasurements = [
    comparison?.environmentTemperature,
    comparison?.productTemperature,
    comparison?.environmentHumidity,
    comparison?.productHumidity,
  ].some((value) => Number.isFinite(value));

  return (
    <div className="monitoramento-page">
      <div className="monitoramento-page__heading">
        <span className="monitoramento-page__eyebrow">
          Telemetria IoT
        </span>

        <h1 className="page-title">Ambiente × Produto</h1>

        <p className="monitoramento-page__description">
          Compare as condições do ambiente refrigerado com as
          medições próximas às frutas.
        </p>
      </div>

      {loading ? (
        <Card>
          <LoadingState message="Carregando monitoramento…" />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={onRetry} />
        </Card>
      ) : !connected ? (
        <Card>
          <EmptyState
            title="Comparação ainda não conectada"
            description="A comparação será disponibilizada quando os sensores de ambiente e produto estiverem identificados na integração."
          />
        </Card>
      ) : !hasMeasurements ? (
        <Card>
          <EmptyState
            title="Nenhuma medição disponível"
            description="As condições aparecerão quando houver leituras para o monitoramento selecionado."
          />
        </Card>
      ) : (
        <>
          <div className="monitoramento-page__comparisons">
            <ComparisonCard
              title="Temperatura"
              icon={<Thermometer size={22} />}
              environmentValue={comparison?.environmentTemperature}
              productValue={comparison?.productTemperature}
              unit=" °C"
            />

            <ComparisonCard
              title="Umidade"
              icon={<Droplets size={22} />}
              environmentValue={comparison?.environmentHumidity}
              productValue={comparison?.productHumidity}
              unit="%"
              differenceUnit=" p.p."
            />
          </div>

          <p className="monitoramento-page__note">
            A comparação deve utilizar medições do mesmo
            monitoramento e de horários compatíveis.
          </p>
        </>
      )}
    </div>
  );
}