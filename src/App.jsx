import { useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Header         from "./components/Header/Header";
import Sidebar        from "./components/Sidebar/Sidebar";
import Login          from "./pages/Login/Login";
import SelecaoPerfil  from "./pages/SelecaoPerfil/SelecaoPerfil";
import AppRoutes      from "./routes/AppRoutes";

export default function App() {
  const [user, setUser]             = useState(null);
  const [profile, setProfile]       = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  function handleContinue(loginUser) {
    setUser(loginUser);
    setProfile(null);
    navigate("/selecionar-perfil");
  }

  function handleSelectProfile(selectedProfile) {
    setProfile(selectedProfile);
    navigate("/dashboard");
  }

  function handleExit() {
    setUser      (null);
    setProfile   (null);
    setIsMenuOpen(false);
    navigate     ("/login", { replace: true });
  }

  const accessDestination = !user
    ? "/login"
    : !profile
      ? "/selecionar-perfil"
      : "/dashboard";

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={accessDestination} replace />
          ) : (
            <Login onContinue={handleContinue} />
          )
        }
      />

      <Route
        path="/selecionar-perfil"
        element={
          user ? (
            <SelecaoPerfil
              user     ={user}
              onSelect ={handleSelectProfile}
              onExit   ={handleExit}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/*"
        element={
          !user || !profile ? (
            <Navigate to={accessDestination} replace />
          ) : (
            <div className="app-layout">
              <a className="skip-link" href="#main-content">
                Ir para o conteúdo
              </a>

              <Sidebar
                user         ={user}
                alertCount   ={0}
                systemOnline ={false}
                isOpen       ={isMenuOpen}
                onClose={()  => setIsMenuOpen(false)}
                onLogout={handleExit}
              />

              <div className="app-layout__body">
                <Header
                  user            ={user}
                  profile         ={profile}
                  onProfileChange ={setProfile}
                  alertCount      ={0}
                  onNotificationsClick={() => navigate("/alertas")}
                  onMenuClick={() =>
                    setIsMenuOpen((current) => !current)
                  }
                  isMenuOpen={isMenuOpen}
                />

                <main
                  id="main-content"
                  className="app-layout__content"
                  tabIndex={-1}
                >
                  <AppRoutes user={user} />
                </main>
              </div>
            </div>
          )
        }
      />
    </Routes>
  );
}