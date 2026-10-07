import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Card         from "../UI/Card";
import EmptyState   from "../UI/EmptyState";
import ErrorState   from "../UI/ErrorState";
import LoadingState from "../UI/LoadingState";

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour:     "2-digit",
    minute:   "2-digit",
    timeZone: "America/Fortaleza",
  }).format(new Date(timestamp));
}

function formatTemperature(value) {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value)} °C`;
}

export default function ClimateChart({
  readings  = [],
  temperatureLimit,
  loading   = false,
  error,
  onRetry,
}) {
  const validReadings = readings
    .filter(
      (reading) =>
        Number.isFinite   (new Date(reading.timestamp).getTime()) &&
        (Number.isFinite  (reading.environmentTemperature) ||
          Number.isFinite (reading.productTemperature))
    )
    .map((reading) => ({
      timestamp: new Date(reading.timestamp).getTime(),
      environmentTemperature: Number.isFinite(reading.environmentTemperature)
        ? reading.environmentTemperature
        : null,
      productTemperature: Number.isFinite(reading.productTemperature)
        ? reading.productTemperature
        : null,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  return (
    <Card
      title="Ambiente × Produto"
      description="Temperatura do ambiente refrigerado e próxima ao produto."
    >
      {loading ? (
        <LoadingState message="Carregando leituras de temperatura…" />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : validReadings.length === 0 ? (
        <EmptyState
          title="Nenhuma leitura disponível"
          description="O gráfico aparecerá quando houver leituras dos sensores."
        />
      ) : (
        <div className="climate-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              accessibilityLayer
              data={validReadings}
              margin={{ top: 20, right: 24, bottom: 12, left: 0 }}
            >
              <CartesianGrid
                stroke="var(--color-border)"
                vertical={false}
              />

              <XAxis
                dataKey       ="timestamp"
                type          ="number"
                scale         ="time"
                domain        ={["dataMin", "dataMax"]}
                tickFormatter ={formatTime}
                tickLine      ={false}
                axisLine      ={false}
                minTickGap    ={32}
              />

              <YAxis
                unit      =" °C"
                tickLine   ={false}
                axisLine   ={false}
                width      ={64}
                domain     ={["auto", "auto"]}
              />

              <Tooltip
                labelFormatter ={formatTime}
                formatter      ={(value, name) => [
                  formatTemperature(value),
                  name,
                ]}
              />

              <Legend />

              {Number.isFinite(temperatureLimit) && (
                <ReferenceLine
                  y               ={temperatureLimit}
                  stroke          ="var(--color-warning)"
                  strokeDasharray ="5 5"
                  ifOverflow      ="extendDomain"
                  label={{
                    value:    "Limite configurado",
                    position: "insideTopRight",
                    fill:     "var(--color-text-muted)",
                    fontSize:  12,
                  }}
                />
              )}

              <Line
                name        ="Ambiente refrigerado"
                dataKey     ="environmentTemperature"
                type        ="linear"
                stroke      ="var(--color-chart-environment)"
                strokeWidth ={2}
                dot={validReadings.length === 1}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />

              <Line
                name        ="Próximo ao produto"
                dataKey     ="productTemperature"
                type        ="linear"
                stroke      ="var(--color-chart-product)"
                strokeWidth ={2}
                dot={validReadings.length === 1}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}