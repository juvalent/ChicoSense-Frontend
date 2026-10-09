const statusLabels = {
  in_transit: "Em trânsito",
  scheduled: "Programada",
  completed: "Concluída",
};

export default function ViagemTable({ trips = [] }) {
  return (
    <div
      className="viagem-table__scroll"
      role="region"
      aria-label="Lista de viagens"
      tabIndex={0}
    >
      <table className="viagem-table">
        <caption className="viagem-table__caption">
          Viagens e informações de transporte
        </caption>

        <thead>
          <tr>
            <th scope="col">Viagem</th>
            <th scope="col">Produto</th>
            <th scope="col">Origem</th>
            <th scope="col">Destino</th>
            <th scope="col">Veículo</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>

        <tbody>
          {trips.map((trip) => (
            <tr key={trip.id}>
              <th scope="row">{trip.code || trip.id}</th>
              <td>{trip.product || "—"}</td>
              <td>{trip.origin || "—"}</td>
              <td>{trip.destination || "—"}</td>
              <td>{trip.vehicle || "—"}</td>

              <td>
                <span
                  className={`viagem-table__status viagem-table__status--${
                    statusLabels[trip.status]
                      ? trip.status
                      : "unknown"
                  }`}
                >
                  {statusLabels[trip.status] || "Não informado"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}