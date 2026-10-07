import { Navigate, Route, Routes } from "react-router-dom";
import Card                        from "../components/UI/Card";
import Dashboard                   from "../pages/Dashboard/Dashboard";

const pages = [
  { path: "/viagens",       title: "Viagens" },
  { path: "/cargas",        title: "Cargas" },
  { path: "/monitoramento", title: "Monitoramento" },
  { path: "/alertas",       title: "Central de Alertas" },
  { path: "/chicosense-ia", title: "ChicoSense IA" },
  { path: "/historico",     title: "Histórico de viagens" },
  { path: "/configuracoes", title: "Configurações" },
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

export default function AppRoutes({ user }) {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/dashboard" replace />}
      />

      <Route
        path="/dashboard"
        element={<Dashboard user={user} />}
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