import { useEffect, useState }      from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header                       from "./components/Header/Header";
import Sidebar                      from "./components/Sidebar/Sidebar";
import AppRoutes                    from "./routes/AppRoutes";

const demoUsers = {
  produtor: {
    name:  "Marina Costa",
    email: "marina@example.com",
  },
  logistica: {
    name:  "José Oliveira",
    email: "jose@example.com",
  },
  cliente: {
    name: "Ana Rosa",
    email: "ana@example.com",
  },
};

export default function App() {
  const [profile, setProfile]       = useState("produtor");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const user       = demoUsers[profile];
  const alertCount = 0;

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

  return (
    <div className  ="app-layout">
      <a classNam   ="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>

      <Sidebar
        user         ={user}
        alertCount   ={alertCount}
        systemOnline ={false}
        isOpen       ={isMenuOpen}
        onClose={()  => setIsMenuOpen(false)}
      />

      <div className="app-layout__body">
        <Header
          user                     ={user}
          profile                  ={profile}
          onProfileChange          ={setProfile}
          alertCount               ={alertCount}
          onNotificationsClick={() => navigate("/alertas")}
          onMenuClick={()          => setIsMenuOpen((current) => !current)}
          isMenuOpen={isMenuOpen}
          isDemo
        />

        <main
          id         ="main-content"
          className  ="app-layout__content"
          tabIndex   ={-1}
        >
          <AppRoutes />
        </main>
      </div>
    </div>
  );
}