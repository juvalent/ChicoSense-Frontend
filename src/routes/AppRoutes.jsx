
import { lazy, Suspense } from "react";

import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import Card from "../components/UI/Card";
import ListProgress from "../components/UI/ListProgress";

import useIncrementalList from "../hooks/useIncrementalList";
import { tripList } from "../services/pagedLists";

// ==========================================
// CARREGAMENTO DAS PÁGINAS
// ==========================================

const Dashboard = lazy(() =>
  import("../pages/Dashboard/Dashboard")
);

const Viagens = lazy(() =>
  import("../pages/Viagens/Viagens")
);

const Cargas = lazy(() =>
  import("../pages/Cargas/Cargas")
);

const Monitoramento = lazy(() =>
  import("../pages/Monitoramento/Monitoramento")
);

const Etileno = lazy(() =>
  import("../pages/Etileno/Etileno")
);

const Alertas = lazy(() =>
  import("../pages/Alertas/Alertas")
);

const Historico = lazy(() =>
  import("../pages/Historico/Historico")
);

const ChicoSenseIA = lazy(() =>
  import("../pages/ChicoSenseIA/ChicoSenseIA")
);

const Configuracoes = lazy(() =>
  import("../pages/Configuracoes/Configuracoes")
);

const Frota = lazy(() =>
  import("../pages/Frota/Frota")
);

const Administracao = lazy(() =>
  import("../pages/Administracao/Administracao")
);

const pages = [];

// ==========================================
// PÁGINAS FUTURAS
// ==========================================

function InitialPage({ title }) {
  return (
    <div>
      <h1 className="page-title">
        {title}
      </h1>

      <Card>
        <p className="page-placeholder">
          O conteúdo desta página será implementado
          nas próximas etapas.
        </p>
      </Card>
    </div>
  );
}

// ==========================================
// ROTAS DA APLICAÇÃO
// ==========================================

export default function AppRoutes({
  user,
  profile,
}) {
  const location = useLocation();

  const list = useIncrementalList(
    user?.id,
    tripList
  );

  const trips = list.records;

  const loading =
    list.loading && !trips.length;

  const error = list.error;
  const reload = list.retry;

  // O Dashboard possui seus próprios controles
  // de atualização e paginação.

  const currentPath =
    location.pathname
      .replace(/\/+$/, "")
      .toLowerCase() || "/";

  const isDashboard =
    currentPath === "/dashboard" ||
    currentPath === "/";

  return (
    <>
      {/* PAGINAÇÃO GLOBAL DAS DEMAIS PÁGINAS */}

      {!isDashboard && (
        <ListProgress
          list={list}
          label="viagens"
        />
      )}

      <Suspense
        fallback={
          <p role="status">
            Carregando página…
          </p>
        }
      >
        <Routes>

          {/* ROTA INICIAL */}

          <Route
            path="/"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          {/* DASHBOARD */}

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
                tripsList={list}
              />
            }
          />

          {/* VIAGENS */}

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

          {/* CARGAS */}

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

          {/* MONITORAMENTO */}

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

          {/* ANÁLISES DE ETILENO */}

          <Route
            path="/etileno"
            element={
              <Etileno
                user={user}
                trips={trips}
              />
            }
          />

          {/* CENTRAL DE ALERTAS */}

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

          {/* HISTÓRICO */}

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

          {/* CHICOSENSE IA */}

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

          {/* CONFIGURAÇÕES */}

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

          {/* FROTA */}

          <Route
            path="/frota"
            element={
              <Frota user={user} />
            }
          />

          {/* ADMINISTRAÇÃO */}

          <Route
            path="/administracao"
            element={
              <Administracao user={user} />
            }
          />

          {/* PÁGINAS FUTURAS */}

          {pages.map(({ path, title }) => (
            <Route
              key={path}
              path={path}
              element={
                <InitialPage title={title} />
              }
            />
          ))}

          {/* PÁGINA NÃO ENCONTRADA */}

          <Route
            path="*"
            element={
              <InitialPage
                title="Página não encontrada"
              />
            }
          />

        </Routes>
      </Suspense>
    </>
  );
}
