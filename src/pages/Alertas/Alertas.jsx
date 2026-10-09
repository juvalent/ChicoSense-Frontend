import { useState } from "react";

import AlertItem from "../../components/UI/AlertItem";
import Card from "../../components/UI/Card";
import EmptyState from "../../components/UI/EmptyState";
import ErrorState from "../../components/UI/ErrorState";
import LoadingState from "../../components/UI/LoadingState";

const filters = [
  { value: "all", label: "Todos" },
  { value: "new", label: "Novos" },
  { value: "monitoring", label: "Em acompanhamento" },
  { value: "resolved", label: "Normalizados" },
];

export default function Alertas({
  alerts = [],
  connected = false,
  loading = false,
  error,
  onRetry,
}) {
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredAlerts = alerts.filter(
    (alert) =>
      statusFilter === "all" || alert.status === statusFilter
  );

  return (
    <div className="alertas-page">
      <div className="alertas-page__heading">
        <span className="alertas-page__eyebrow">
          Ocorrências
        </span>

        <h1 className="page-title">Central de Alertas</h1>

        <p className="alertas-page__description">
          Priorize anomalias e acompanhe as ocorrências registradas.
        </p>
      </div>

      <Card>
        <div
          className="alertas-page__filters"
          role="group"
          aria-label="Filtrar alertas por situação"
        >
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className="alertas-page__filter"
              aria-pressed={statusFilter === filter.value}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingState message="Carregando alertas…" />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : !connected ? (
          <EmptyState
            title="Consulta ainda não conectada"
            description="Os alertas serão apresentados após a integração com o serviço de ocorrências."
          />
        ) : alerts.length === 0 ? (
          <EmptyState
            title="Nenhum alerta registrado"
            description="As ocorrências aparecerão aqui quando estiverem disponíveis."
          />
        ) : filteredAlerts.length === 0 ? (
          <EmptyState
            title="Nenhum alerta nesta situação"
            description="Selecione outro filtro para consultar as ocorrências recebidas."
          />
        ) : (
          <>
            <p className="alertas-page__results" role="status">
              {filteredAlerts.length} de {alerts.length} alertas recebidos
            </p>

            <ul className="alertas-page__list">
              {filteredAlerts.map((alert) => (
                <AlertItem key={alert.id} alert={alert} />
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}