import { useEffect, useMemo, useRef, useState } from "react";
import { X, Info } from "lucide-react";

import "./HistoricoVisual.css";
import HistoricoTable from "../Tables/HistoricoTable";
import Button from "../../components/UI/Button";
import Card from "../../components/UI/Card";
import Input from "../../components/UI/Input";
import Select from "../../components/UI/Select";
import EmptyState from "../../components/UI/EmptyState";
import ErrorState from "../../components/UI/ErrorState";
import LoadingState from "../../components/UI/LoadingState";

import { listarCargas } from "../../services/viagemService";
import useViagemCargas from "../../hooks/useViagemCargas";
import ListProgress from "../../components/UI/ListProgress";

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(value) {
  if (!value) return "Não informada";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "Não informada";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Recife",
  }).format(date);
}

export default function Historico({
  trips = [],
  loading = false,
  error,
  onRetry,
}) {
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [product, setProduct] = useState("all");
  const [transportadora, setTransportadora] = useState("all");

  const [loadsByTrip, setLoadsByTrip] = useState({});
  const [loadsLoading, setLoadsLoading] = useState(false);
  const [loadsError, setLoadsError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const productCache = useRef({});

  const completedTrips = useMemo(
    () => trips.filter((trip) => trip.status === "completed"),
    [trips]
  );

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      if (!completedTrips.length) {
        setLoadsByTrip({});
        setLoadsLoading(false);
        setLoadsError("");
        return;
      }

      setLoadsLoading(true);
      setLoadsError("");

      // Bound concurrency and summary size. Full cargo access is on demand below.
      const results = new Array(completedTrips.length);
      const cache = productCache.current;
      let nextIndex = 0;
      await Promise.all(Array.from({ length: Math.min(4, completedTrips.length) }, async () => {
        while (active && nextIndex < completedTrips.length) {
          const index = nextIndex++;
          try {
            const id = completedTrips[index].id;
            const value = cache[id] || await listarCargas(id, { params: { limit: 20, offset: 0 } });
            if (active) cache[id] = value;
            results[index] = { status: "fulfilled", value };
          }
          catch { results[index] = { status: "rejected" }; }
        }
      }));

      if (!active) return;

      const next = {};
      let failures = 0;

      results.forEach((result, index) => {
        const tripId = String(completedTrips[index].id);

        if (result.status === "fulfilled") {
          next[tripId] = Array.isArray(result.value)
            ? result.value
            : [];
        } else {
          failures += 1;
          next[tripId] = [];
        }
      });

      setLoadsByTrip(next);

      if (failures > 0) {
        setLoadsError(
          `Não foi possível consultar as cargas de ${failures} viagem(ns). Alguns produtos podem não aparecer.`
        );
      }

      setLoadsLoading(false);
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, [completedTrips, reloadKey]);

  const enrichedTrips = useMemo(
    () =>
      completedTrips.map((trip) => {
        const loads = loadsByTrip[String(trip.id)] || [];

        const products = [
          ...new Set(
            loads.map((load) => load.variety).filter(Boolean)
          ),
        ];

        return {
          ...trip,
          product: products.join(", "),
          products,
          loads,
          completedAt: trip.actualArrivalAt || null,
          temperature: null,
          humidity: null,
        };
      }),
    [completedTrips, loadsByTrip]
  );

  const productOptions = useMemo(() => {
    const values = [
      ...new Set(enrichedTrips.flatMap((trip) => trip.products)),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));

    return [
      { value: "all", label: "Todos os produtos" },
      ...values.map((value) => ({ value, label: value })),
    ];
  }, [enrichedTrips]);

  const transportadoraOptions = useMemo(() => {
    const values = [
      ...new Set(
        completedTrips
          .map((trip) => trip.transportadoraId)
          .filter((value) => value !== null && value !== undefined)
          .map(String)
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));

    return [
      { value: "all", label: "Todas" },
      ...values.map((value) => ({
        value,
        label: `Transportadora #${value.slice(0, 8)}`,
      })),
    ];
  }, [completedTrips]);

  const filteredTrips = useMemo(() => {
    const query = normalizeSearch(search);
    const now = Date.now();

    const cutoff =
      period === "all"
        ? null
        : now - Number(period) * 24 * 60 * 60 * 1000;

    return enrichedTrips.filter((trip) => {
      const matchesSearch = [
        trip.code,
        trip.origin,
        trip.destination,
        trip.vehicle,
        trip.product,
      ].some((value) =>
        normalizeSearch(value).includes(query)
      );

      const matchesProduct =
        product === "all" ||
        trip.products.includes(product);

      const matchesTransportadora =
        transportadora === "all" ||
        String(trip.transportadoraId) === transportadora;

      const completedAt = trip.completedAt
        ? new Date(trip.completedAt).getTime()
        : NaN;

      const matchesPeriod =
        cutoff === null ||
        (Number.isFinite(completedAt) &&
          completedAt >= cutoff &&
          completedAt <= now);

      return (
        matchesSearch &&
        matchesProduct &&
        matchesTransportadora &&
        matchesPeriod
      );
    });
  }, [
    enrichedTrips,
    search,
    period,
    product,
    transportadora,
  ]);

  const selectedTrip = enrichedTrips.find(
    (trip) => String(trip.id) === String(selectedTripId)
  );

  function clearFilters() {
    setSearch("");
    setPeriod("all");
    setProduct("all");
    setTransportadora("all");
  }

  function handleRetry() {
    if (error) {
      onRetry?.();
    } else {
      productCache.current = {};
      setReloadKey((value) => value + 1);
    }
  }

  const busy = loading || loadsLoading;

  return (
    <div className="historico-page">
      <div className="historico-page__heading">
        <span className="historico-page__eyebrow">
          Registros
        </span>

        <h1 className="page-title">
          Histórico de viagens
        </h1>

        <p className="historico-page__description">
          Consulte informações das viagens concluídas.
        </p>
        <div className="visual-notice"><Info size={20} /><div><strong>Sobre os resultados</strong><p>Filtros de produtos usam até 20 cargas por viagem carregada. Abra os detalhes para consultar as demais cargas. Contagens e filtros não representam totais globais.</p></div></div>
      </div>

      <Card title="Filtros">
        <div className="historico-page__filters">
          <Select
            label="Período"
            name="historyPeriod"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            disabled={busy}
            options={[
              { value: "all", label: "Todo o período" },
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
            disabled={busy}
            options={productOptions}
          />

          <Select
            label="Transportadora"
            name="historyCarrier"
            value={transportadora}
            onChange={(event) =>
              setTransportadora(event.target.value)
            }
            disabled={busy}
            options={transportadoraOptions}
          />

          <Input
            label="Buscar viagens"
            name="historySearch"
            type="search"
            placeholder="Código, rota ou veículo"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={busy}
          />
        </div>
      </Card>

      <Card
        title={`${filteredTrips.length} ${filteredTrips.length === 1 ? "viagem concluída" : "viagens concluídas"}`}
        description="Resultados conforme os filtros selecionados."
      >
        {busy ? (
          <LoadingState message="Carregando histórico..." />
        ) : error ? (
          <ErrorState message={error} onRetry={handleRetry} />
        ) : completedTrips.length === 0 ? (
          <EmptyState
            title="Nenhuma viagem concluída"
            description="Ainda não existem viagens concluídas disponíveis."
          />
        ) : (
          <>
            {loadsError && (
              <div className="historico-page__warning" role="alert">
                <span>{loadsError}</span>
                <Button variant="secondary" onClick={handleRetry}>
                  Tentar novamente
                </Button>
              </div>
            )}

            {filteredTrips.length === 0 ? (
              <EmptyState
                title="Nenhum resultado encontrado"
                description="Altere os filtros para consultar outras viagens."
                action={
                  <Button
                    variant="secondary"
                    onClick={clearFilters}
                  >
                    Limpar filtros
                  </Button>
                }
              />
            ) : (
              <>
                <p
                  className="historico-page__results"
                  role="status"
                >
                  {filteredTrips.length} de{" "}
                  {completedTrips.length} {completedTrips.length === 1 ? "viagem concluída" : "viagens concluídas"}
                </p>

                <HistoricoTable
                  trips={filteredTrips}
                  onOpenTrip={(trip) =>
                    setSelectedTripId(trip.id)
                  }
                />
              </>
            )}
          </>
        )}
      </Card>

      {selectedTrip && (
        <div
          className="historico-page__modal-overlay"
          onClick={() => setSelectedTripId(null)}
        >
          <section
            className="historico-page__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="historico-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="historico-page__modal-header">
              <div>
                <span className="historico-page__eyebrow">
                  Detalhes da viagem
                </span>
                <h2 id="historico-modal-title">
                  {selectedTrip.code || selectedTrip.id}
                </h2>
              </div>

              <button
                type="button"
                className="historico-page__modal-close"
                onClick={() => setSelectedTripId(null)}
                aria-label="Fechar detalhes"
              >
                <X size={20} />
              </button>
            </div>

            <dl className="historico-page__modal-details">
              <div>
                <dt>Origem</dt>
                <dd>{selectedTrip.origin || "Não informada"}</dd>
              </div>

              <div>
                <dt>Destino</dt>
                <dd>{selectedTrip.destination || "Não informado"}</dd>
              </div>

              <div>
                <dt>Produto</dt>
                <dd>{selectedTrip.product || "Não informado"}</dd>
              </div>

              <div>
                <dt>Veículo</dt>
                <dd>{selectedTrip.vehicle || "Não informado"}</dd>
              </div>

              <div>
                <dt>Motorista</dt>
                <dd>{selectedTrip.driver || "Não informado"}</dd>
              </div>

              <div>
                <dt>Transportadora</dt>
                <dd>
                  {selectedTrip.transportadoraId ?? "Não informada"}
                </dd>
              </div>

              <div>
                <dt>Saída real</dt>
                <dd>
                  {formatDate(selectedTrip.actualDepartureAt)}
                </dd>
              </div>

              <div>
                <dt>Chegada real</dt>
                <dd>
                  {formatDate(selectedTrip.actualArrivalAt)}
                </dd>
              </div>

              <div>
                <dt>Cargas carregadas no resumo</dt>
                <dd>{selectedTrip.loads.length}</dd>
              </div>

              <div>
                <dt>Status</dt>
                <dd>Concluída</dd>
              </div>
            </dl>
            <HistoryCargoList key={selectedTrip.id} tripId={selectedTrip.id} />

            <div className="historico-page__modal-footer">
              <Button
                variant="secondary"
                onClick={() => setSelectedTripId(null)}
              >
                Fechar
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function HistoryCargoList({ tripId }) {
  const list = useViagemCargas(tripId);
  return <Card title="Cargas da viagem concluída"><ListProgress list={list} label="cargas do histórico" />
    <ul>{list.records.map((cargo) => <li key={cargo.id}>{cargo.code || cargo.id} · {cargo.variety || "Produto não informado"} · {cargo.netWeightKg ?? "Massa não informada"}</li>)}</ul>
  </Card>;
}
