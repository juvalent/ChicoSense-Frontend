import { useState } from "react";

import ViagemTable from "../../components/Tables/ViagemTable";
import Button from "../../components/UI/Button";
import Card from "../../components/UI/Card";
import Input from "../../components/UI/Input";
import Select from "../../components/UI/Select";
import EmptyState from "../../components/UI/EmptyState";
import ErrorState from "../../components/UI/ErrorState";
import LoadingState from "../../components/UI/LoadingState";

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function Historico({
  trips = [],
  connected = false,
  loading = false,
  error,
  onRetry,
}) {
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [product, setProduct] = useState("all");

  const completedTrips = trips.filter(
    (trip) => trip.status === "completed"
  );

  const productOptions = [
    { value: "all", label: "Todos os produtos" },
    ...Array.from(
      new Set(completedTrips.map((trip) => trip.product).filter(Boolean))
    )
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((value) => ({ value, label: value })),
  ];

  const query = normalizeSearch(search);

  // Período móvel: últimas 24 horas × quantidade de dias.
  const cutoff =
    period === "all"
      ? null
      : Date.now() - Number(period) * 24 * 60 * 60 * 1000;

  const filteredTrips = completedTrips.filter((trip) => {
    const matchesSearch = [
      trip.code,
      trip.product,
      trip.origin,
      trip.destination,
      trip.vehicle,
    ].some((value) => normalizeSearch(value).includes(query));

    const matchesProduct =
      product === "all" || trip.product === product;

    const completedAt = trip.completedAt
      ? new Date(trip.completedAt).getTime()
      : NaN;

    const matchesPeriod =
      cutoff === null ||
      (Number.isFinite(completedAt) &&
        completedAt >= cutoff &&
        completedAt <= Date.now());

    return matchesSearch && matchesProduct && matchesPeriod;
  });

  const filtersDisabled = !connected || loading || Boolean(error);

  function clearFilters() {
    setSearch("");
    setPeriod("all");
    setProduct("all");
  }

  return (
    <div className="historico-page">
      <div className="historico-page__heading">
        <span className="historico-page__eyebrow">
          Registros
        </span>

        <h1 className="page-title">Histórico de viagens</h1>

        <p className="historico-page__description">
          Consulte as informações das viagens concluídas.
        </p>
      </div>

      <Card title="Filtros">
        <div className="historico-page__filters">
          <Select
            label="Período"
            name="historyPeriod"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            disabled={filtersDisabled}
            options={[
              { value: "all", label: "Todo o período recebido" },
              { value: "7", label: "Últimos 7 dias" },
              { value: "30", label: "Últimos 30 dias" },
              { value: "90", label: "Últimos 90 dias" },
            ]}
          />

          <Select
            label="Produto"
            name="historyProduct"
            value={product}
            onChange={(event) => setProduct(event.target.value)}
            disabled={filtersDisabled}
            options={productOptions}
          />

          <Input
            label="Buscar viagens"
            name="historySearch"
            type="search"
            placeholder="Código, rota ou veículo"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={filtersDisabled}
          />
        </div>
      </Card>

      <Card
        title="Viagens concluídas"
        description="Resultados dos registros recebidos."
      >
        {loading ? (
          <LoadingState message="Carregando histórico…" />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : !connected ? (
          <EmptyState
            title="Consulta ainda não conectada"
            description="O histórico será disponibilizado após a integração com o serviço de viagens concluídas."
          />
        ) : completedTrips.length === 0 ? (
          <EmptyState
            title="Nenhuma viagem concluída disponível"
            description="Os registros aparecerão aqui quando forem disponibilizados."
          />
        ) : filteredTrips.length === 0 ? (
          <EmptyState
            title="Nenhum resultado para os filtros"
            description="Altere o período, o produto ou o texto da busca."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <>
            <p className="historico-page__results" role="status">
              {filteredTrips.length} de {completedTrips.length} viagens
              concluídas recebidas
            </p>

            <ViagemTable trips={filteredTrips} />
          </>
        )}
      </Card>
    </div>
  );
}