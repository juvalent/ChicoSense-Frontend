
import {
  Info,
  RefreshCw,
  ChevronDown,
  AlertCircle,
} from "lucide-react";

import Button from "./Button";

import "../Logistics/Logistics.css";

export default function ListProgress({
  list,
  label,
  disabled = false,
}) {
  const quantidade = list.records.length;

  return (
    <nav
      className="logistics-actions list-progress"
      aria-label={`Paginação: ${label}`}
      aria-busy={list.loading}
    >

      {/* AVISO INFORMATIVO */}

      <div className="list-progress__information">

        <div className="list-progress__icon">
          <Info size={21} />
        </div>

        <div className="list-progress__content">

          <strong className="list-progress__title">
            {quantidade} {label} carregadas
          </strong>

          <p className="list-progress__description">
            Os filtros e as contagens consideram
            os registros carregados.
          </p>

          {list.hasNext && (
            <span className="list-progress__additional">
              Há mais registros disponíveis.
            </span>
          )}

          {list.loading && (
            <span
              className="list-progress__loading"
              role="status"
            >
              Carregando {label}…
            </span>
          )}

          {list.error && (
            <span
              className="list-progress__error"
              role="alert"
            >
              <AlertCircle size={15} />
              {list.error}
            </span>
          )}

        </div>

      </div>

      {/* BOTÕES DE PAGINAÇÃO E ATUALIZAÇÃO */}

      <div className="list-progress__actions">

        {list.hasNext && (
          <Button
            variant="secondary"
            disabled={disabled || list.loading}
            onClick={list.more}
          >
            <ChevronDown size={16} />

            Carregar mais {label}
          </Button>
        )}

        <Button
          variant="secondary"
          disabled={disabled || list.loading}
          onClick={list.retry}
        >
          <RefreshCw
            size={16}
            className={
              list.loading
                ? "list-progress__spinning"
                : ""
            }
          />

          {list.loading
            ? "Atualizando..."
            : `Atualizar lista de ${label}`}
        </Button>

      </div>

    </nav>
  );
}
