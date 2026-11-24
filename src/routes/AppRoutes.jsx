
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Card from "../components/UI/Card";

const Dashboard = lazy(() => import("../pages/Dashboard/Dashboard"));
const Viagens = lazy(() => import("../pages/Viagens/Viagens"));
const Cargas = lazy(() => import("../pages/Cargas/Cargas"));
const Monitoramento = lazy(() => import("../pages/Monitoramento/Monitoramento"));
const Etileno = lazy(() => import("../pages/Etileno/Etileno"));
const Alertas = lazy(() => import("../pages/Alertas/Alertas"));
const Historico = lazy(() => import("../pages/Historico/Historico"));
const ChicoSenseIA = lazy(() => import("../pages/ChicoSenseIA/ChicoSenseIA"));
const Configuracoes = lazy(() => import("../pages/Configuracoes/Configuracoes"));
const Frota = lazy(() => import("../pages/Frota/Frota"));
const Administracao = lazy(() => import("../pages/Administracao/Administracao"));

import useIncrementalList from "../hooks/useIncrementalList";
import { tripList } from "../services/pagedLists";
import ListProgress from "../components/UI/ListProgress";

const pages = [];

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
  const list = useIncrementalList(user?.id, tripList);
  const trips = list.records, loading = list.loading && !trips.length, error = list.error, reload = list.retry;

  return (
    <><ListProgress list={list} label="viagens" /><Suspense fallback={<p role="status">Carregando página…</p>}><Routes>
      <Route path="/administracao" element={<Administracao user={user} />} />
      <Route path="/frota" element={<Frota user={user} />} />
      {/* Rota inicial */}
      <Route
        path="/"
        element={<Navigate to="/dashboard" replace />}
      />

      {/* Dashboard */}
      <Route
        path="/dashboard"
        element={
          <Dashboard
            user={user}
            profile={profile}
            trips={trips}
            tripsLoading={loading}
            tripsError={error}
            onRetryTrips={reload}
          />
        }
      />

      {/* Viagens */}
      <Route
        path="/viagens"
        element={
          <Viagens
            user={user}
            trips={trips}
            loading={loading}
            error={error}
            onRetry={reload}
          />
        }
      />

      {/* Cargas */}
      <Route
        path="/cargas"
        element={
          <Cargas
            user={user}
            trips={trips}
            loading={loading}
            error={error}
            onRetry={reload}
          />
        }
      />

      {/* Monitoramento ambiental */}
      <Route
        path="/monitoramento"
        element={
          <Monitoramento
            user={user}
            trips={trips}
            tripsLoading={loading}
            tripsError={error}
            onRetryTrips={reload}
          />
        }
      />

      {/* Análises de Etileno */}
      <Route
        path="/etileno"
        element={
          <Etileno
            user={user}
            trips={trips}
          />
        }
      />

      {/* Central de Alertas */}
      <Route
        path="/alertas"
        element={
          <Alertas
            user={user}
            trips={trips}
            tripsLoading={loading}
            tripsError={error}
            onRetryTrips={reload}
          />
        }
      />

      <Route
  path="/historico"
  element={
    <Historico
      trips={trips}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  }
/>

      <Route
  path="/chicosense-ia"
  element={
    <ChicoSenseIA
      trips={trips}
      tripsLoading={loading}
      tripsError={error}
      onRetryTrips={reload}
    />
  }
/>

      {/* Configurações */}
      <Route
  path="/configuracoes"
  element={
    <Configuracoes
      user={user}
      profile={profile}
      trips={trips}
    />
  }
/>

      {/* Páginas futuras */}
      {pages.map(({ path, title }) => (
        <Route
          key={path}
          path={path}
          element={<InitialPage title={title} />}
        />
      ))}

      {/* Página não encontrada */}
      <Route
        path="*"
        element={
          <InitialPage title="Página não encontrada" />
        }
      />
    </Routes></Suspense></>
  );
}
