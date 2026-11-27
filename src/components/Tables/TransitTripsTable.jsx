
function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

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

function formatIdentifier(value) {
  if (!value) return "—";

  const text = String(value);

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(text);

  return isUuid
    ? `#${text.slice(0, 8).toUpperCase()}`
    : text;
}

export default function TransitTripsTable({
  trips = [],
  onOpenTrip,
}) {
  return (
    <div
      className="transit-table__scroll"
      role="region"
      aria-label="Viagens em trânsito"
      tabIndex={0}
    >
      <table className="transit-table">
        <caption className="transit-table__caption">
          Viagens em deslocamento no momento
        </caption>

        <thead>
          <tr>
            <th scope="col">Viagem</th>
            <th scope="col">Origem → Destino</th>
            <th scope="col">Veículo</th>
            <th scope="col">Partida / Chegada</th>
            <th scope="col">Cargas</th>
            <th scope="col">Estado</th>
            <th scope="col">Ação</th>
          </tr>
        </thead>

        <tbody>
          {trips.map((trip) => {
            const identificador =
              trip.code || trip.id;

            const veiculo =
              trip.vehiclePlate ??
              trip.placa ??
              trip.vehicle;

            return (
              <tr key={trip.id}>
                <th
                  scope="row"
                  title={String(identificador ?? "")}
                >
                  {formatIdentifier(identificador)}
                </th>

                <td>
                  {trip.origin || "—"}
                  {" → "}
                  {trip.destination || "—"}
                </td>

                <td title={String(veiculo ?? "")}>
                  {formatIdentifier(veiculo)}
                </td>

                <td className="transit-table__dates">
                  <div>
                    {formatDateTime(trip.departureAt)}
                  </div>

                  <div>
                    {formatDateTime(trip.arrivalAt)}
                  </div>
                </td>

                <td>
                  {trip.loadsCount ?? "—"}
                </td>

                <td>
                  <span className="transit-table__status">
                    Em trânsito
                  </span>
                </td>

                <td>
                  <button
                    type="button"
                    className="button button--secondary transit-table__action"
                    onClick={() => onOpenTrip?.(trip)}
                  >
                    Abrir viagem
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
