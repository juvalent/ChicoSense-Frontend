import { Navigate, Route, Routes } from "react-router-dom";
import Card                        from "../components/UI/Card";
import Dashboard                   from "../pages/Dashboard/Dashboard";
import Viagens                     from "../pages/Viagens/Viagens";
import Cargas                      from "../pages/Cargas/Cargas";
import Monitoramento               from "../pages/Monitoramento/Monitoramento";
import Alertas                     from "../pages/Alertas/Alertas";
import Historico                   from "../pages/Historico/Historico";
import ChicoSenseIA                from "../pages/ChicoSenseIA/ChicoSenseIA";
import Configuracoes               from "../pages/Configuracoes/Configuracoes";

const pages = [
];

function InitialPage({ title }) {
  return (
    <div>
      <h1 className="page-title">{title}</h1>

      <Card>
        <p className="page-placeholder">
          O conteúdo desta página será implementado nas próximas etapas.
        </p>
      </Card>
    </div>
  );
}

export default function AppRoutes({ user, profile }) {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/dashboard" replace />}
      />

      <Route
        path="/dashboard"
        element={<Dashboard user={user} profile={profile} />}
      />

      <Route
        path="/viagens"
        element={<Viagens />}
      />

      <Route
        path="/cargas"
        element={<Cargas />}
      />

      <Route
      path="/monitoramento"
      element={<Monitoramento />}
    />

    <Route
      path="/alertas"
      element={<Alertas />}
    />

    <Route
     path="/historico"
      element={<Historico />}
    />

    <Route
      path="/chicosense-ia"
      element={<ChicoSenseIA />}
    />

    <Route
      path="/configuracoes"
      element={
        <Configuracoes
      user={user}
      profile={profile}
      />
  }
/>

      {pages.map(({ path, title }) => (
        <Route
          key={path}
          path={path}
          element={<InitialPage title={title} />}
        />
      ))}

      <Route
        path="*"
        element={<InitialPage title="Página não encontrada" />}
      />
    </Routes>
  );
}