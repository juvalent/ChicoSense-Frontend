import { Bell, Menu } from "lucide-react";
import Select         from "../UI/Select";

const profileOptions = [
  { value: "produtor",  label: "Produtor" },
  { value: "logistica", label: "Logística" },
  { value: "cliente",   label: "Cliente" },
];

function getInitials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export default function Header({
  user,
  profile      = "produtor",
  onProfileChange,
  alertCount   = 0,
  onNotificationsClick,
  onMenuClick,
  isMenuOpen   = false,
  isDemo       = false,
}) {
  return (
    <header className  ="header">
      <div className   ="header__start">
        <button
          type         ="button"
          className    ="header__icon-button header__menu-button"
          aria-label   ={isMenuOpen ? "Fechar menu" : "Abrir menu"}
          aria-controls="main-sidebar"
          aria-expanded={isMenuOpen}
          onClick      ={onMenuClick}
        >
          <Menu size={21} aria-hidden="true" />
        </button>

        <div className="header__profile">
          <Select
            label   ="Perfil"
            name    ="profile"
            value   ={profile}
            onChange={(event) => {
              onProfileChange?.(event.target.value);
            }}
            disabled={!onProfileChange}
            options={profileOptions}
          />
        </div>
      </div>

      <div className="header__actions">
        {isDemo && (
          <span className="header__demo">
            Dados de demonstração
          </span>
        )}

        <button
          type      ="button"
          className ="header__icon-button"
          onClick   ={onNotificationsClick}
          disabled  ={!onNotificationsClick}
          aria-label={
            alertCount > 0
              ? `Notificações: ${alertCount} alertas pendentes`
              : "Notificações sem alertas pendentes"
          }
        >
          <Bell size={20} aria-hidden="true" />

          {alertCount > 0 && (
            <span
              className="header__notification-dot"
              aria-hidden="true"
            />
          )}
        </button>

        <span
          className  ="header__avatar"
          role="img"
          aria-label ={`Usuário: ${user?.name || "Usuário"}`}
          title      ={user?.name || "Usuário"}
        >
          {getInitials(user?.name)}
        </span>
      </div>
    </header>
  );
}