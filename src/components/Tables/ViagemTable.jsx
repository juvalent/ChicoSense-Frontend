
import { Eye, Route } from "lucide-react";
import Button from "../UI/Button";

// ==========================================
// STATUS DAS VIAGENS
// ==========================================

const statusLabels = {
  in_transit: "Em trânsito",
  scheduled: "Programada",
  completed: "Concluída",
  cancelled: "Cancelada",
  unknown: "Não informado",
};

// ==========================================
// FORMATAÇÃO DOS DADOS
// ==========================================

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(date);
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

// ==========================================
// TABELA DE VIAGENS
// ==========================================

export default function ViagemTable({
  trips = [],
  selectedTripId,
  onOpenTrip,
}) {
  return (
    <div
      className="viagem-table__scroll"
      role="region"
      aria-label="Lista de viagens"
      tabIndex={0}
    >
      <table className="viagem-table">

        <caption className="viagem-table__caption">
          Viagens cadastradas
        </caption>

        <thead>
          <tr>
            <th scope="col">Viagem</th>
            <th scope="col">Rota</th>
            <th scope="col">Veículo</th>
            <th scope="col">Motorista</th>
            <th scope="col">Saída</th>
            <th scope="col">Previsão de chegada</th>
            <th scope="col">Cargas</th>
            <th scope="col">Status</th>
            <th scope="col">Ação</th>
          </tr>
        </thead>

        <tbody>

          {trips.map((trip) => {
            const isSelected =
              selectedTripId != null &&
              String(trip.id) === String(selectedTripId);

            return (
              <tr
                key={trip.id}
                className={
                  isSelected
                    ? "viagem-table__row--selected"
                    : undefined
                }
              >

                {/* IDENTIFICAÇÃO */}

                <th
                  scope="row"
                  title={String(trip.code || trip.id)}
                >
                  <span className="viagem-table__code">
                    {formatCode(trip.code || trip.id)}
                  </span>
                </th>

                {/* ROTA */}

                <td>
                  <div className="viagem-table__route">

                    <Route size={17} />

                    <div className="viagem-table__route-text">
                      <strong>
                        {trip.origin || "—"}
                      </strong>

                      <span>
                        → {trip.destination || "—"}
                      </span>
                    </div>

                  </div>
                </td>

                {/* VEÍCULO */}

                <td title={trip.vehicle || ""}>
                  {formatCode(trip.vehicle)}
                </td>

                {/* MOTORISTA */}

                <td title={trip.driver || ""}>
                  {formatCode(trip.driver)}
                </td>

                {/* SAÍDA */}

                <td className="viagem-table__date">
                  {formatDate(
                    trip.actualDepartureAt ||
                    trip.departureAt
                  )}
                </td>

                {/* CHEGADA */}

                <td className="viagem-table__date">
                  {formatDate(trip.arrivalAt)}
                </td>

                {/* QUANTIDADE DE CARGAS */}

                <td>
                  {trip.loadsCount ?? "—"}
                </td>

                {/* STATUS */}

                <td>
                  <span
                    className={
                      "viagem-table__status " +
                      `viagem-table__status--${trip.status || "unknown"}`
                    }
                  >
                    <span className="viagem-table__status-dot" />

                    {statusLabels[trip.status] ||
                      "Não informado"}
                  </span>
                </td>

                {/* AÇÃO */}

                <td>
                  <Button
                    variant={
                      isSelected
                        ? "primary"
                        : "secondary"
                    }
                    className="viagem-table__action"
                    aria-pressed={isSelected}
                    onClick={() => onOpenTrip?.(trip)}
                  >
                    <Eye size={16} />

                    {isSelected
                      ? "Viagem aberta"
                      : "Abrir viagem"}
                  </Button>
                </td>

              </tr>
            );
          })}

          {trips.length === 0 && (
            <tr>
              <td
                colSpan={9}
                className="viagem-table__empty"
              >
                Nenhuma viagem disponível.
              </td>
            </tr>
          )}

        </tbody>
      </table>
    </div>
  );
}
