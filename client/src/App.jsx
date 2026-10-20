import "./App.scss";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min";
import "@fortawesome/fontawesome-free/css/all.min.css";
import {Route, Routes} from "react-router-dom";
import {SidebarProvider} from "./context/SidebarContext";
import Login from "./components/LoginPage";
import Home from "./components/Home";
import DashboardPage from "./components/DashboardPage";
import AnomaliasDashboardPage from "./components/AnomaliasDashboardPage";
import TiposMonitoreo from "./components/Settings/TiposMonitoreo";
import UsersPage from "./components/Settings/UsersPage";
import UserRolePage from "./components/Settings/RolePage";
import ClientsPage from "./components/Settings/ClientsPage";
import EventsPage from "./components/Settings/EventsPage";
import BitacorasPage from "./components/Bitacoras/BitacorasPage";
import OrigenPage from "./components/Settings/OrigenPage";
import DestinoPage from "./components/Settings/DestinoPage";
import LineaTransportePage from "./components/Settings/LineaTransportePage";
import OperadorPage from "./components/Settings/OperadorPage";
import ProfilePage from "./components/Profile/ProfilePage";
import IntegracionesPage from "./components/Integraciones/IntegracionesPage";
import ResetPassword from "./components/ResetPassword";
import WialonTracker from "./components/wialon/WialonTracker";
import WialonUnits from "./components/wialon/WialonUnits";
import BitacoraRouter from "./components/Bitacoras/BitacoraRouter";
import AuditoriasPage from "./components/Auditorias/AuditoriasPage";
import PlanesDeEmbarquePage from "./components/PlanesDeEmbarque/PlanesDeEmbarquePage";
import BuscadorPlanPage from "./components/PlanesDeEmbarque/BuscadorPlanPage";
import ReporteEventosPage from "./components/ReporteEventosPage";
import ReporteEstadisticasPage from "./components/ReporteEstadisticasPage";
import PlacaTestPage from "./components/PlacaTest/PlacaTestPage";
import ControlPatiosDashboard from "./components/PlacaTest/ControlPatiosDashboard";
import ReporteControlPatiosPage from "./components/PlacaTest/ReporteControlPatiosPage";
import EventosWialonPage from "./components/Wialon/EventosWialonPage";
import MapWialonPage from "./components/Wialon/MapWialonPage";

function App() {
  return (
    <SidebarProvider>
      <Routes>
        <Route path="/" element={<Login />}></Route>
        <Route path="/login" element={<Login />}></Route>
        <Route path="/inicio" element={<Home />}></Route>
        <Route path="/dashboard/general" element={<DashboardPage />}></Route>
        <Route path="/dashboard/anomalias" element={<AnomaliasDashboardPage />}></Route>
        <Route path="/bitacoras" element={<BitacorasPage />}></Route>
        <Route path="/bitacora/:id" element={<BitacoraRouter edited={false} />} />
        <Route path="/bitacoras/:id/editada" element={<BitacoraRouter edited={true} />} />
        <Route path="/tipos_monitoreo" element={<TiposMonitoreo />}></Route>
        <Route path="/usuarios" element={<UsersPage />}></Route>
        <Route path="/roles" element={<UserRolePage />}></Route>
        <Route path="/clientes" element={<ClientsPage />}></Route>
        <Route path="/eventos" element={<EventsPage />}></Route>
        <Route path="/origenes" element={<OrigenPage />}></Route>
        <Route path="/destinos" element={<DestinoPage />}></Route>
        <Route path="/lineas-transporte" element={<LineaTransportePage />}></Route>
        <Route path="/operadores" element={<OperadorPage />}></Route>
        <Route path="/perfil" element={<ProfilePage />}></Route>
        <Route path="/integraciones" element={<IntegracionesPage />}></Route>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/wialon" element={<WialonTracker />} />
        <Route path="/units" element={<WialonUnits />} />
        <Route path="/auditoria/bitacoras" element={<AuditoriasPage />} />
        <Route path="/planes-embarque" element={<PlanesDeEmbarquePage />} />
        <Route path="/buscador-plan" element={<BuscadorPlanPage />} />
        <Route path="/reporte-eventos" element={<ReporteEventosPage />} />
        <Route path="/reporte-estadisticas" element={<ReporteEstadisticasPage />} />
        <Route path="/placa-test" element={<PlacaTestPage />} />
        <Route path="/reporte-control-patios" element={<ControlPatiosDashboard />} />
        <Route path="/reporte-detalle-patios" element={<ReporteControlPatiosPage />} />
        <Route path="/eventos-wialon" element={<EventosWialonPage />} />
        <Route path="/map-wialon" element={<MapWialonPage />} />
      </Routes>
    </SidebarProvider>
  );
}

export default App;
