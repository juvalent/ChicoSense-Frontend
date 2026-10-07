import { Activity, Leaf, Store, Truck } from "lucide-react";
import Button                           from "../../components/UI/Button";
import Card                             from "../../components/UI/Card";

const profiles = [
  {
    value: "produtor",
    title: "Produtor",
    description:
      "Acompanhe suas cargas desde a expedição até o destino.",
    icon: Leaf,
  },
  {
    value: "logistica",
    title: "Logística",
    description:
      "Acompanhe viagens, sensores e condições de transporte.",
    icon: Truck,
  },
  {
    value: "cliente",
    title: "Cliente / Mercado",
    description:
      "Consulte a origem e as condições de transporte das cargas.",
    icon: Store,
  },
];

export default function SelecaoPerfil({
  user,
  onSelect,
  onExit,
}) {
  return (
    <div className        ="profile-page">
      <header className   ="profile-page__header">
        <div className    ="access-brand">
          <span className ="access-brand__icon">
            <Activity size={24} aria-hidden="true" />
          </span>

          <div>
            <strong>ChicoSense</strong>
            <span className="access-brand__caption">
              COLD CHAIN INTELLIGENCE
            </span>
          </div>
        </div>

        <Button variant="ghost" onClick={onExit}>
          Voltar ao login
        </Button>
      </header>

      <main className  ="profile-page__content">
        <div className ="profile-page__heading">
          <h1>Como você deseja acessar o ChicoSense?</h1>

          <p>
            Selecione seu perfil. Todas as opções compartilham
            as mesmas funcionalidades.
          </p>

          <p className="profile-page__email">
            {user?.email}
          </p>
        </div>

        <div className="profile-page__grid">
          {profiles.map(({ value, title, description, icon: Icon }) => (
            <Card key={value} className="profile-card">
              <span className="profile-card__icon">
                <Icon size={25} aria-hidden="true" />
              </span>

              <h2 className="profile-card__title">{title}</h2>

              <p className="profile-card__description">
                {description}
              </p>

              <Button
                variant={
                  value === "logistica" ? "primary" : "secondary"
                }
                onClick={() => onSelect(value)}
                aria-label={`Acessar como ${title}`}
              >
                Acessar perfil
              </Button>
            </Card>
          ))}
        </div>

        <p className="profile-page__hint">
          Você poderá trocar o perfil pelo cabeçalho do sistema.
        </p>
      </main>
    </div>
  );
}