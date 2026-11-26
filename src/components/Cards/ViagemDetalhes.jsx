
import { Route, Truck, UserRound, CalendarClock } from "lucide-react";

import Card from "../UI/Card";
import EmptyState from "../UI/EmptyState";
import ViagemCargasTable from "../Tables/ViagemCargasTable";
import Button from "../UI/Button";

const statusLabels = {
  in_transit: "Em trânsito",
  scheduled: "Programada",
  completed: "Concluída",
  cancelled: "Cancelada",
};

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Fortaleza",
  })
    .format(date)
    .replace(",", "");
}

function formatCode(value) {
  if (!value) return "—";

  const text = String(value);

  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);

  return isUUID
    ? `#${text.slice(0, 8).toUpperCase()}`
    : text;
}

export default function ViagemDetalhes({
  trip,
  onOpenLoad,
  onOpenCargas,
  busy = false,
}) {
  const loads = Array.isArray(trip?.loads)
    ? trip.loads
    : [];

  return (
    <Card className="trip-details">

      {/* CABEÇALHO DA VIAGEM */}

      <div className="trip-details__header">

        <div className="trip-details__header-content">

          <span className="trip-details__eyebrow">
            Identificação da viagem
          </span>

          <h2
            className="trip-details__title"
            title={trip.id}
          >
            Viagem {formatCode(trip.code || trip.id)}
          </h2>

          <div className="trip-details__route">
            <Route size={18} />

            <span>
              {trip.origin || "—"}
              {" → "}
              {trip.destination || "—"}
            </span>
          </div>

          <p className="trip-details__description">
            Dados operacionais e cargas vinculadas
            a esta viagem.
          </p>

        </div>

        <span
          className={`viagem-table__status viagem-table__status--${
            statusLabels[trip.status]
              ? trip.status
              : "unknown"
          }`}
        >
          {statusLabels[trip.status] ||
            "Não informado"}
        </span>

      </div>

      {/* INFORMAÇÕES DA VIAGEM */}

      <dl className="trip-details__info">

        <div className="trip-details__item">

          <dt>Veículo frigorífico</dt>

          <dd title={trip.vehicle || ""}>
            <Truck size={19} />

            <span>
              {formatCode(trip.vehicle)}
            </span>
          </dd>

        </div>

        <div className="trip-details__item">

          <dt>Motorista responsável</dt>

          <dd title={trip.driver || ""}>
            <UserRound size={19} />

            <span>
              {formatCode(trip.driver)}
            </span>
          </dd>

        </div>

        <div className="trip-details__item">

          <dt>Janela prevista</dt>

          <dd>
            <CalendarClock size={19} />

            <span>
              {formatDateTime(trip.departureAt)}
              {" → "}
              {formatDateTime(trip.arrivalAt)}
            </span>
          </dd>

        </div>

      </dl>

      {/* CARGAS DA VIAGEM */}

      <div className="trip-details__loads">

        <div className="trip-details__loads-header">

          <div>

            <h3 className="trip-details__loads-title">
              Cargas desta viagem
              {Array.isArray(trip?.loads)
                ? ` (${loads.length})`
                : ""}
            </h3>

            {!Array.isArray(trip?.loads) && (
              <p className="trip-details__description">
                Consulte as cargas autorizadas
                na página de Cargas.
              </p>
            )}

          </div>

          <Button
            onClick={onOpenCargas}
            disabled={busy}
          >
            Abrir cargas da viagem
          </Button>

        </div>

        {Array.isArray(trip?.loads) && (
          loads.length === 0 ? (
            <EmptyState
              title="Nenhuma carga vinculada"
              description="As cargas desta viagem aparecerão aqui quando forem cadastradas."
            />
          ) : (
            <ViagemCargasTable
              loads={loads}
              onOpenLoad={(load) => {
                if (!busy) onOpenLoad?.(load);
              }}
            />
          )
        )}

      </div>

    </Card>
  );
}
