import { useState } from "react";

import Card from "../../components/UI/Card";
import Input from "../../components/UI/Input";
import EmptyState from "../../components/UI/EmptyState";
import LoadingState from "../../components/UI/LoadingState";
import ErrorState from "../../components/UI/ErrorState";
import CargaTable from "../../components/Tables/CargaTable";

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function Cargas({
  loads = [],
  connected = false,
  loading = false,
  error,
  onRetry,
}) {
  const [search, setSearch] = useState("");

  const query = normalizeSearch(search);

  const filteredLoads = loads.filter((load) =>
    [
      load.code,
      load.product,
      load.origin,
      load.destination,
    ].some((value) => normalizeSearch(value).includes(query))
  );

  return (
    <div className="cargas-page">
      <div className="cargas-page__heading">
        <span className="cargas-page__eyebrow">
          Operação
        </span>

        <h1 className="page-title">Cargas</h1>

        <p className="cargas-page__description">
          Consulte cargas e suas condições de monitoramento.
        </p>
      </div>

      <Card
        title="Cargas monitoradas"
        description="Informações das cargas e últimas medições disponíveis."
      >
        <div className="cargas-page__search">
          <Input
            label="Buscar cargas"
            name="loadSearch"
            type="search"
            placeholder="Código, produto, origem ou destino"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={!connected || loading || Boolean(error)}
          />
        </div>

        {loading ? (
          <LoadingState message="Carregando cargas…" />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : !connected ? (
          <EmptyState
            title="Consulta ainda não conectada"
            description="A listagem será disponibilizada após a integração com o serviço de cargas."
          />
        ) : loads.length === 0 ? (
          <EmptyState
            title="Nenhuma carga cadastrada"
            description="As cargas aparecerão aqui quando estiverem disponíveis."
          />
        ) : filteredLoads.length === 0 ? (
          <EmptyState
            title="Nenhuma carga encontrada"
            description="Altere o texto da busca para consultar outros resultados."
          />
        ) : (
          <>
            <p className="cargas-page__results" role="status">
              {filteredLoads.length} de {loads.length} cargas recebidas
            </p>

            <CargaTable loads={filteredLoads} />
          </>
        )}
      </Card>
    </div>
  );
}