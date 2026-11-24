import Button from "../UI/Button";
import CargoDeclaration from "./CargoDeclaration";
import Card from "../UI/Card";
import EmptyState from "../UI/EmptyState";
import ErrorState from "../UI/ErrorState";
import LoadingState from "../UI/LoadingState";

export default function CargaDetalhes({
  load,
  trip,
  monitoring,
  loading = false,
  error,
  onRetry,
  onOpenMonitoring,
}) {


  return (
    <Card
      className="load-details"
      title={`${load.code || load.id}${
        load.variety ? ` · ${load.variety}` : ""
      }`}
      description={`Lote ${load.harvestLot || "—"} · ${
        trip?.origin || "—"
      } → ${trip?.destination || "—"}`}
      action={
        <Button onClick={() => onOpenMonitoring?.(load)}>
          Ir ao monitoramento
        </Button>
      }
    >
      {loading ? (
        <LoadingState message="Carregando dados de monitoramento…" />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !monitoring ? (
        <EmptyState
          title="Dados de monitoramento não declarados"
          description="Os dados adicionais desta carga aparecerão aqui depois de declarados."
        />
      ) : (
        <CargoDeclaration declaration={monitoring} />
      )}
    </Card>
  );
}