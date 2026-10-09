import {
  CheckCircle,
  Info,
  TriangleAlert,
} from "lucide-react";

const severityConfig = {
  info: {
    label: "Informação",
    icon: Info,
  },
  warning: {
    label: "Atenção",
    icon: TriangleAlert,
  },
  critical: {
    label: "Crítico",
    icon: TriangleAlert,
  },
};

const statusLabels = {
  new: "Novo",
  monitoring: "Em acompanhamento",
  resolved: "Normalizado",
};

function formatDate(value) {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(date);
}

export default function AlertItem({ alert }) {
  const severity = severityConfig[alert.severity];
  const status = statusLabels[alert.status];
  const Icon =
    alert.status === "resolved"
      ? CheckCircle
      : severity?.icon || Info;

  return (
    <li className="alert-item">
      <span
        className={`alert-item__icon alert-item__icon--${
          alert.status === "resolved"
            ? "resolved"
            : severity
              ? alert.severity
              : "info"
        }`}
        aria-hidden="true"
      >
        <Icon size={22} />
      </span>

      <div className="alert-item__content">
        <div className="alert-item__labels">
          <span className="alert-item__status">
            {status || "Situação não informada"}
          </span>

          <span className="alert-item__severity">
            {severity?.label || "Gravidade não informada"}
          </span>
        </div>

        <h2 className="alert-item__title">
          {alert.title || "Ocorrência sem título"}
        </h2>

        {alert.description && (
          <p className="alert-item__description">
            {alert.description}
          </p>
        )}

        <dl className="alert-item__details">
          <div>
            <dt>Referência</dt>
            <dd>{alert.reference || "Não informada"}</dd>
          </div>

          <div>
            <dt>Valor registrado</dt>
            <dd>{alert.recordedValue ?? "Não informado"}</dd>
          </div>

          <div>
            <dt>Data e hora</dt>
            <dd>{formatDate(alert.occurredAt)}</dd>
          </div>
        </dl>
      </div>
    </li>
  );
}