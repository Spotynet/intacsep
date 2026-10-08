import {useState, useEffect} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";
import {useNavigate} from "react-router-dom";
import WialonMap from "../wialon/WialonMap";

const MapWialonPage = () => {
  const {user, verifyToken, setUser} = useAuth();
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        const data = await verifyToken();
        setUser(data);
      } catch {
        navigate("/login");
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!user?.role) return;
    fetch(`${baseUrl}/roles/${user.role}`, {credentials: "include"})
      .then((r) => r.json())
      .then((role) => {
        if (!role?.map_wialon?.read) navigate("/");
      })
      .catch(() => {});
  }, [user]);

  return (
    <section id="mapWialonPage" className="settings-page">
      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Mapa Intacsep"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
          >
            <input
              type="text"
              className="wialon-map-search"
              placeholder="Buscar unidad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </PageHeader>

          <div className="content-area">
            <WialonMap searchTerm={searchTerm} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default MapWialonPage;
