import { useEffect, useState } from "react";

import { listarViagens } from "../../services/viagemService";
import { adaptViagensResponse } from "./viagemAdapter";

import ViagemTable from "../../components/Tables/ViagemTable";
import Button from "../../components/UI/Button";
import Card from "../../components/UI/Card";
import Input from "../../components/UI/Input";
import EmptyState from "../../components/UI/EmptyState";
import ErrorState from "../../components/UI/ErrorState";
import LoadingState from "../../components/UI/LoadingState";

const categories = [
  { value: "all", label: "Todas" },
  { value: "in_transit", label: "Em trânsito" },
  { value: "scheduled", label: "Programadas" },
  { value: "completed", label: "Concluídas" },
];

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function Viagens() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  function refresh() {
    setRequestVersion((current) => current + 1);
  }

  useEffect(() => {
    let active = true;

    async function loadTrips() {
      setLoading(true);
      setError("");

      try {
        const response = await listarViagens();
        const data = adaptViagensResponse(response);

        if (active) {
          setTrips(data);
        }
      } catch (requestError) {
        if (!active) return;

        const status = requestError.response?.status;

        if (status === 404) {
          setError(
            "A consulta de viagens ainda não está disponível na API."
          );
        } else if (status === 401 || status === 403) {
          setError(
            "Seu acesso à consulta não foi autorizado. Verifique sua sessão."
          );
        } else {
          setError(
            "Não foi possível carregar as viagens. A resposta pode estar indisponível ou em um formato ainda não suportado."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadTrips();

    return () => {
      active = false;
    };
  }, [requestVersion]);

  const normalizedSearch = normalizeSearch(search);

  const filteredTrips = trips.filter((trip) => {
    const matchesCategory =
      category === "all" || trip.status === category;

    const matchesSearch = [
      trip.code,
      trip.product,
      trip.origin,
      trip.destination,
      trip.vehicle,
    ].some((value) =>
      normalizeSearch(value).includes(normalizedSearch)
    );

    return matchesCategory && matchesSearch;
  });

  function clearFilters() {
    setCategory("all");
    setSearch("");
  }

  return (
    <div className="viagens-page">
      <div className="viagens-page__heading">
        <div>
          <span className="viagens-page__eyebrow">
            Operação
          </span>

          <h1 className="page-title">Viagens</h1>

          <p className="viagens-page__description">
            Acompanhe viagens e informações de transporte.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={refresh}
          disabled={loading}
        >
          Atualizar
        </Button>
      </div>

      <Card>
        <div className="viagens-page__toolbar">
          <div
            className="viagens-page__categories"
            role="group"
            aria-label="Filtrar por situação da viagem"
          >
            {categories.map((item) => (
              <button
                key={item.value}
                type="button"
                className="viagens-page__category"
                aria-pressed={category === item.value}
                onClick={() => setCategory(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="viagens-page__search">
            <Input
              label="Buscar viagens"
              name="tripSearch"
              type="search"
              placeholder="Código, produto, rota ou veículo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <LoadingState message="Carregando viagens…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : trips.length === 0 ? (
          <EmptyState
            title="Nenhuma viagem cadastrada"
            description="As viagens aparecerão aqui quando estiverem disponíveis."
          />
        ) : filteredTrips.length === 0 ? (
          <EmptyState
            title="Nenhuma viagem encontrada"
            description="Altere a busca ou a situação selecionada."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <>
            <p className="viagens-page__results" role="status">
              {filteredTrips.length} de {trips.length} viagens recebidas
            </p>

            <ViagemTable trips={filteredTrips} />
          </>
        )}
      </Card>
    </div>
  );
}