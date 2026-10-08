import Card from "../UI/Card";

export default function MetricCard({
  title,
  value,
  description,
  icon,
  tone      = "neutral",
  className = "",
}) {
  return (
    <Card className     ={`metric-card ${className}`.trim()}>
      <div className    ="metric-card__layout">
        {icon && (
          <span
            className   ={`metric-card__icon metric-card__icon--${tone}`}
            aria-hidden ="true"
          >{icon}
          </span>
        )}

        <div className  ="metric-card__info">
          <h2 className ="metric-card__title">{title}</h2>

          <p className  ="metric-card__value">{value ?? "—"}</p>

          {description && (
            <p className ="metric-card__description">
              {description}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}