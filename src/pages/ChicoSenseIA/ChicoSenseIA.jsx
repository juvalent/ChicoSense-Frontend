import { Sparkles } from "lucide-react";

import Card from "../../components/UI/Card";
import EmptyState from "../../components/UI/EmptyState";
import ErrorState from "../../components/UI/ErrorState";
import LoadingState from "../../components/UI/LoadingState";

const levels = {
  low: {
    label: "Risco baixo",
    className: "ia-page__risk--low",
  },
  moderate: {
    label: "Risco moderado",
    className: "ia-page__risk--moderate",
  },
  high: {
    label: "Risco alto",
    className: "ia-page__risk--high",
  },
};

function formatDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return null;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(date);
}

export default function ChicoSenseIA({
  connected = false,
  analysis,
  loading = false,
  error,
  onRetry,
}) {
  const level = levels[analysis?.level];

  const hasScore =
    Number.isFinite(analysis?.score) &&
    analysis.score >= 0 &&
    analysis.score <= 100;

  const hasAnalysis = Boolean(
    level &&
    hasScore &&
    typeof analysis?.summary === "string" &&
    analysis.summary.trim()
  );

  const factors = Array.isArray(analysis?.factors)
    ? analysis.factors
    : [];

  const insights = Array.isArray(analysis?.insights)
    ? analysis.insights
    : [];

  const generatedAt = formatDate(analysis?.generatedAt);

  return (
    <div className="ia-page">
      <div className="ia-page__heading">
        <span className="ia-page__eyebrow">
          Assistente de apoio à decisão
        </span>

        <h1 className="page-title">ChicoSense IA</h1>

        <p className="ia-page__description">
          Consulte análises preventivas baseadas nos dados
          disponibilizados pelo sistema.
        </p>
      </div>

      <p className="ia-page__notice">
        A IA não controla o veículo nem a refrigeração.
        As recomendações apoiam a decisão e não representam
        garantia de conservação ou conformidade.
      </p>

      {loading ? (
        <Card>
          <LoadingState message="Carregando análise…" />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={onRetry} />
        </Card>
      ) : !connected ? (
        <Card>
          <EmptyState
            title="Análise ainda não conectada"
            description="Os resultados serão apresentados após a integração com o serviço de análise."
          />
        </Card>
      ) : !hasAnalysis ? (
        <Card>
          <EmptyState
            title="Nenhuma análise disponível"
            description="Ainda não há um resultado válido para o monitoramento consultado."
          />
        </Card>
      ) : (
        <>
          <Card
            title="Análise atual"
            description={analysis.reference || undefined}
            action={
              <span className="ia-page__icon" aria-hidden="true">
                <Sparkles size={23} />
              </span>
            }
          >
            <div className="ia-page__summary">
              <span className={`ia-page__risk ${level.className}`}>
                {level.label}
              </span>

              <p className="ia-page__score">
                {new Intl.NumberFormat("pt-BR", {
                  maximumFractionDigits: 1,
                }).format(analysis.score)}
                <span> / 100</span>
              </p>

              <p className="ia-page__summary-text">
                {analysis.summary}
              </p>

              {generatedAt && (
                <p className="ia-page__timestamp">
                  Análise gerada em{" "}
                  <time dateTime={analysis.generatedAt}>
                    {generatedAt}
                  </time>
                  {" "}— horário de Fortaleza.
                </p>
              )}
            </div>
          </Card>

          <div className="ia-page__details">
            <Card
              title="Principais fatores"
              description="Informações consideradas na análise."
            >
              {factors.length === 0 ? (
                <EmptyState
                  title="Fatores não informados"
                  description="O serviço não disponibilizou os fatores deste resultado."
                />
              ) : (
                <ul className="ia-page__list">
                  {factors.map((factor) => (
                    <li key={factor.id} className="ia-page__item">
                      <h2>{factor.title}</h2>
                      {factor.description && (
                        <p>{factor.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title="Insights preventivos"
              description="Observações para apoiar o acompanhamento."
            >
              {insights.length === 0 ? (
                <EmptyState
                  title="Nenhum insight disponível"
                  description="Não foram recebidas observações adicionais."
                />
              ) : (
                <ul className="ia-page__list">
                  {insights.map((insight) => (
                    <li key={insight.id} className="ia-page__item">
                      <h2>{insight.title}</h2>
                      {insight.description && (
                        <p>{insight.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}