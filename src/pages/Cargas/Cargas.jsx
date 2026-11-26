import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Info, RefreshCw } from "lucide-react";

import Select from "../../components/UI/Select";
import Card from "../../components/UI/Card";
import Button from "../../components/UI/Button";

import LogisticsRecords from "../../components/Logistics/LogisticsRecords";
import TripOperations from "../../components/Logistics/TripOperations";

import {
  logisticsError,
  readTrip,
} from "../../services/logisticsService";

import "../../components/Logistics/Logistics.css";

export default function Cargas({
  trips = [],
  loading,
  error,
  onRetry,
  user,
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const [tripId, setTripId] = useState(
    location.state?.tripId ?? null
  );

  const [busy, setBusy] = useState(false);

  const selected =
    tripId === null
      ? trips[0]
      : trips.find((trip) => trip.id === tripId);

  return (
    <div className="logistics-page">

      {/* CABEÇALHO */}

      <div className="logistics-page-heading">
        <h1 className="page-title">
          Cargas de Manga
        </h1>
      </div>

      {/* AVISO INFORMATIVO */}

      <div className="logistics-notice">
        <div className="logistics-notice__icon">
          <Info size={20} />
        </div>

        <div className="logistics-notice__content">
          <strong>Gerenciamento de cargas</strong>

          <p>
            Organize viagens, cargas e caixas. Os estados
            são atualizados separadamente, preservando
            o histórico das operações.
          </p>
        </div>
      </div>

      {/* VIAGEM SELECIONADA */}

      <Card>
        <div className="logistics-section-header">
          <div>
            <h2>Viagem selecionada</h2>

            <p>
              Selecione uma viagem para consultar
              suas cargas e informações operacionais.
            </p>
          </div>

          <Button
            variant="secondary"
            disabled={busy || loading || !onRetry}
            onClick={onRetry}
          >
            <RefreshCw
              size={16}
              className={
                loading ? "logistics-spin" : ""
              }
            />

            {loading
              ? "Atualizando..."
              : "Atualizar viagens"}
          </Button>
        </div>

        <Select
          label="Viagem das cargas"
          value={selected?.id || ""}
          disabled={busy || loading || Boolean(error)}
          options={[
            {
              value: "",
              label: "Selecione uma viagem",
            },
            ...trips.map((trip) => ({
              value: trip.id,
              label: `${
                trip.code || `#${String(trip.id).slice(0, 8)}`
              } · ${trip.origin || ""} → ${
                trip.destination || ""
              }`,
            })),
          ]}
          onChange={(event) =>
            setTripId(event.target.value)
          }
        />

        {loading && (
          <p role="status">
            Carregando viagens…
          </p>
        )}

        {error && (
          <p role="alert">{error}</p>
        )}

        {!loading && !error && !trips.length && (
          <p>
            Nenhuma viagem disponível para este usuário.
          </p>
        )}
      </Card>

      {/* OPERAÇÃO E CARGAS */}

      {selected && !loading && !error && (
        <CargoWorkspace
          key={selected.id}
          user={user}
          id={selected.id}
          busy={busy}
          onBusy={setBusy}
          onTripSaved={onRetry}
          initialCargoId={
            location.state?.tripId === selected.id
              ? location.state?.loadId
              : undefined
          }
          onMonitor={(cargoId) =>
            navigate("/monitoramento", {
              state: {
                tripId: selected.id,
                loadId: cargoId,
              },
            })
          }
        />
      )}
    </div>
  );
}

// ==========================================
// OPERAÇÕES DA VIAGEM
// ==========================================

function CargoWorkspace({
  id,
  user,
  busy,
  onBusy,
  initialCargoId,
  onTripSaved,
  onMonitor,
}) {
  const [view, setView] = useState({
    trip: null,
    loading: true,
    error: "",
  });

  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setView({
        trip: null,
        loading: true,
        error: "",
      });

      try {
        const trip = await readTrip(
          id,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setView({
            trip,
            loading: false,
            error: "",
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setView({
            trip: null,
            loading: false,
            error: logisticsError(error),
          });
        }
      }
    }

    load();

    return () => controller.abort();
  }, [id, retry]);

  if (view.loading) {
    return (
      <p role="status">
        Consultando viagem…
      </p>
    );
  }

  if (view.error) {
    return (
      <Card>
        <p role="alert">{view.error}</p>

        <Button
          onClick={() => setRetry((n) => n + 1)}
        >
          Tentar novamente
        </Button>
      </Card>
    );
  }

  return (
    <>
      <TripOperations
        user={user}
        trip={view.trip}
        busy={busy}
        onBusy={onBusy}
        onSaved={(trip) => {
          setView({
            trip,
            loading: false,
            error: "",
          });

          onTripSaved?.();
        }}
      />

      <LogisticsRecords
        kind="cargas"
        parentId={id}
        trip={view.trip}
        user={user}
        busy={busy}
        onBusy={onBusy}
        initialCargoId={initialCargoId}
        onMonitor={onMonitor}
      />
    </>
  );
}