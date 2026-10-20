import "bootstrap/dist/js/bootstrap.bundle.min";
import {useState, useEffect, useCallback} from "react";
import {useNavigate, useLocation} from "react-router-dom";
import {useAuth} from "../context/AuthContext.jsx";
import {useSidebar} from "../context/SidebarContext.jsx";
import InactivityModal from "./Settings/InactivityModal.jsx";
import Footer from "./Footer.jsx";

const Sidebar = () => {
  const {user, logout} = useAuth();
  const {isSidebarCollapsed, toggleSidebar, isMobileSidebarOpen, setIsMobileSidebarOpen} = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const baseUrl = import.meta.env.VITE_BASE_URL;

  const [showInacModal, setShowInacModal] = useState(false);
  const [roleData, setRoleData] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebar-role");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [isHovered, setIsHovered] = useState(false);
  // True whenever the sidebar should render in its expanded visual state
  const isExpanded = !isSidebarCollapsed || isHovered;
  const [collapsedItems, setCollapsedItems] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebar-sections");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      dashboardCollapse: false,
      bitacorasCollapse: false,
      settingsCollapse: false,
      catalogosCollapse: false,
      sistemaCollapse: false,
      auditoriaCollapse: false,
    };
  });

  const [summaryCounts, setSummaryCounts] = useState(null);

  const fetchSummaryCounts = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/dashboard/summary-counts`, {credentials: "include"});
      if (res.ok) {
        const data = await res.json();
        setSummaryCounts(data);
      } else {
        console.warn("[Sidebar] summary-counts HTTP", res.status);
      }
    } catch (e) {
      console.warn("[Sidebar] summary-counts error:", e);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchSummaryCounts();
    const interval = setInterval(fetchSummaryCounts, 60000);
    return () => clearInterval(interval);
  }, [fetchSummaryCounts]);

  // Active route matching
  const path = location.pathname;
  const isActive = (route) => path === route || path.startsWith(route + "/");

  useEffect(() => {
    if (!user?.role) return;
    const fetchRolePermissions = async () => {
      try {
        const response = await fetch(`${baseUrl}/roles/${user.role}`, {method: "GET", credentials: "include"});
        if (response.ok) {
          const data = await response.json();
          setRoleData(data);
          try { localStorage.setItem("sidebar-role", JSON.stringify(data)); } catch {}
        }
      } catch (e) {
        console.error("Error fetching role permissions:", e);
      }
    };
    fetchRolePermissions();
  }, [user, location.pathname]);

  // Derived visibility flags for parent groups
  const hasRead = (...keys) => keys.some((k) => roleData?.[k]?.read);
  const showDashboardGeneral = hasRead("dashboard");
  const showDashboardAnomalias = hasRead("dashboard_anomalias");
  const showReporteEventos = hasRead("reporte_eventos");
  const showReporteEstadisticas = hasRead("reporte_estadisticas");
  const showReporteControlPatios = hasRead("reporte_control_patios");
  const showDashboard = showDashboardGeneral || showDashboardAnomalias || showReporteEventos || showReporteEstadisticas || showReporteControlPatios;

  const showCatalogos = roleData && (
    roleData.tipos_de_monitoreo?.read ||
    roleData.eventos?.read ||
    roleData.clientes?.read ||
    roleData.origenes?.read ||
    roleData.destinos?.read ||
    roleData.lineas_transporte?.read ||
    roleData.operadores?.read
  );
  const showSistema = roleData && (roleData.usuarios?.read || roleData.roles?.read || roleData.inactividad?.read);
  const showAuditoria = roleData && roleData.auditoria_bitacora?.read;
  const showConfiguracion = roleData && (showCatalogos || showSistema || showAuditoria);

  const showBitacoras = hasRead("bitacoras");
  // Backwards-compat: some roles use `plandeembarque` instead of `planes_embarque`
  const showPlanesEmbarque = hasRead("planes_embarque", "plandeembarque");
  const showBuscadorPlan = hasRead("buscador_plan");
  const showControlPatios = hasRead("control_patios");
  const showEventosWialon = hasRead("eventos_wialon");
  const showMapWialon = hasRead("map_wialon");
  const showMonitoreo = showBitacoras || showPlanesEmbarque || showBuscadorPlan || showControlPatios || showEventosWialon || showMapWialon;

  // Functions
  const openInacModal = () => {
    setShowInacModal(true);
  };

  const closeInacModal = () => {
    setShowInacModal(false);
  };

  const toggleCollapse = (itemKey) => {
    setCollapsedItems((prev) => {
      const next = {...prev, [itemKey]: !prev[itemKey]};
      try { localStorage.setItem("sidebar-sections", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleIconClick = (callback, itemKey) => {
    if (isSidebarCollapsed) {
      toggleCollapse(itemKey);
    } else {
      callback();
    }
  };

  return (
    <>
      <aside
        id="leftsidebar"
        className={`${isSidebarCollapsed && !isHovered ? "collapsed" : ""} ${
          isMobileSidebarOpen ? "mobile-open" : ""
        }`}
        onMouseEnter={() => isSidebarCollapsed && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}>
        {/* Floating Collapse Button (only when collapsed) */}
        {/* {isSidebarCollapsed && (
          <div className="floating-collapse-btn d-none d-md-block">
            <button onClick={toggleSidebar} className="collapse-btn">
              <i className="fa fa-chevron-right"></i>
            </button>
          </div>
        )} */}

        <div className="sidebar-wrapper">
          {/* Mobile close button */}
          <div className="mobile-close-btn d-md-none">
            <button onClick={() => setIsMobileSidebarOpen(false)}>
              <i className="fa fa-times"></i>
            </button>
          </div>

          {/* User Profile Section */}
          <div className="user-profile">
            <div className="user-avatar">
              <img src="/logo1.png" alt="Logo" />
            </div>
            {isExpanded && (
              <div className="user-info">
                <h6 className="user-name" style={{cursor: "pointer"}} onClick={() => navigate("/perfil")} title="Ver perfil">
                  {user?.firstName} {user?.lastName}
                </h6>
                <span className="user-role">{user?.role}</span>
                <span className="user-email">{user?.email}</span>
              </div>
            )}
            {isHovered || !isSidebarCollapsed ? (
              <button className="user-profile__pin d-none d-md-flex" onClick={toggleSidebar} title={isSidebarCollapsed ? "Expandir" : "Colapsar"}>
                <i className="fa-solid fa-thumbtack" style={{transform: isSidebarCollapsed ? "rotate(45deg)" : "none"}} />
              </button>
            ) : null}
          </div>

          {/* Navigation Menu */}
          <nav className="sidebar-nav">
            <ul className="nav-menu">
              {/* Dashboard */}
              {showDashboard && (
                <li className="nav-item">
                  <div
                    className="nav-link has-submenu"
                    onClick={() =>
                      handleIconClick(() => toggleCollapse("dashboardCollapse"), "dashboardCollapse")
                    }>
                    <div className="nav-link-content">
                      <i className="fa fa-tachometer-alt"></i>
                      {isExpanded && <span>Dashboard</span>}
                    </div>
                    {isExpanded && (
                      <i
                        className={`fa fa-chevron-${
                          collapsedItems.dashboardCollapse ? "up" : "down"
                        }`}
                      />
                    )}
                  </div>

                  {collapsedItems.dashboardCollapse && isExpanded && (
                    <ul className="submenu">
                      {showDashboardGeneral && (
                        <li onClick={() => navigate("/dashboard/general")} className={isActive("/dashboard/general") ? "active" : ""}>
                          <i className="fa fa-chart-bar"></i>
                          <span>General</span>
                        </li>
                      )}
                      {showDashboardAnomalias && (
                        <li onClick={() => navigate("/dashboard/anomalias")} className={isActive("/dashboard/anomalias") ? "active" : ""}>
                          <i className="fa fa-exclamation-triangle"></i>
                          <span>Anomalías</span>
                        </li>
                      )}
                      {showReporteEventos && (
                        <li onClick={() => navigate("/reporte-eventos")} className={isActive("/reporte-eventos") ? "active" : ""}>
                          <i className="fa fa-file-lines"></i>
                          <span>Reporte Eventos</span>
                        </li>
                      )}
                      {showReporteEstadisticas && (
                        <li onClick={() => navigate("/reporte-estadisticas")} className={isActive("/reporte-estadisticas") ? "active" : ""}>
                          <i className="fa fa-clock"></i>
                          <span>Reporte de puntualidad</span>
                        </li>
                      )}
                      {showReporteControlPatios && (
                        <li onClick={() => navigate("/reporte-control-patios")} className={isActive("/reporte-control-patios") ? "active" : ""}>
                          <i className="fa fa-warehouse"></i>
                          <span>Dashboard Patios</span>
                        </li>
                      )}
                      {showReporteControlPatios && (
                        <li onClick={() => navigate("/reporte-detalle-patios")} className={isActive("/reporte-detalle-patios") ? "active" : ""}>
                          <i className="fa fa-list-alt"></i>
                          <span>Reporte Patios</span>
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              )}

              {/* Monitoreo */}
              {showMonitoreo && (
                <li className="nav-item">
                  <div
                    className="nav-link has-submenu"
                    onClick={() =>
                      handleIconClick(
                        () => toggleCollapse("bitacorasCollapse"),
                        "bitacorasCollapse"
                      )
                    }>
                    <div className="nav-link-content">
                      <i className="fa fa-chart-line"></i>
                      {isExpanded && <span>Monitoreo</span>}
                    </div>
                    {isExpanded && (
                      <i
                        className={`fa fa-chevron-${
                          collapsedItems.bitacorasCollapse ? "up" : "down"
                        }`}
                      />
                    )}
                  </div>

                  {collapsedItems.bitacorasCollapse && isExpanded && (
                    <ul className="submenu">
                      {showBitacoras && (
                        <li onClick={() => navigate("/bitacoras")} className={isActive("/bitacoras") ? "active" : ""}>
                          <i className="fa fa-book"></i>
                          <span>Bitácoras</span>
                          {summaryCounts?.totalBitacoras != null && (
                            <span className="sidebar-badge sidebar-badge--bitacora">
                              {summaryCounts.totalBitacoras}
                            </span>
                          )}
                        </li>
                      )}
                      {showPlanesEmbarque && (
                        <li onClick={() => navigate("/planes-embarque")} className={isActive("/planes-embarque") ? "active" : ""}>
                          <i className="fa fa-ship"></i>
                          <span>Planes de Embarque</span>
                        </li>
                      )}
                      {showBuscadorPlan && (
                        <li onClick={() => navigate("/buscador-plan")} className={isActive("/buscador-plan") ? "active" : ""}>
                          <i className="fa fa-magnifying-glass"></i>
                          <span>Buscador de Plan</span>
                        </li>
                      )}
                      {showControlPatios && (
                        <li onClick={() => navigate("/placa-test")} className={isActive("/placa-test") ? "active" : ""}>
                          <i className="fa fa-id-card"></i>
                          <span>Control de patios</span>
                          {summaryCounts?.enPatio && (
                            <span className="sidebar-badge sidebar-badge--patio">
                              <i className="fa fa-truck sidebar-badge__icon"></i>{summaryCounts.enPatio.tractores}
                              <span className="sidebar-badge__sep">·</span>
                              <i className="fa fa-trailer sidebar-badge__icon"></i>{summaryCounts.enPatio.remolques}
                            </span>
                          )}
                        </li>
                      )}
                      {showEventosWialon && (
                        <li onClick={() => navigate("/eventos-wialon")} className={isActive("/eventos-wialon") ? "active" : ""}>
                          <i className="fa fa-satellite-dish"></i>
                          <span>Alertas Intacsep</span>
                          {summaryCounts?.currentAlerts != null && (
                            <span className="sidebar-badge sidebar-badge--alert">
                              {summaryCounts.currentAlerts}
                            </span>
                          )}
                        </li>
                      )}
                      {showMapWialon && (
                        <li onClick={() => navigate("/map-wialon")} className={isActive("/map-wialon") ? "active" : ""}>
                          <i className="fa fa-map-marked-alt"></i>
                          <span>Mapa Intacsep</span>
                          {summaryCounts?.activeUnits != null && (
                            <span className="sidebar-badge sidebar-badge--unit">
                              {summaryCounts.activeUnits}
                            </span>
                          )}
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              )}

              {/* Configuración */}
              {showConfiguracion && (
                <li className="nav-item">
                  <div
                    className="nav-link has-submenu"
                    onClick={() =>
                      handleIconClick(() => toggleCollapse("settingsCollapse"), "settingsCollapse")
                    }>
                    <div className="nav-link-content">
                      <i className="fa fa-cog"></i>
                      {isExpanded && <span>Configuración</span>}
                    </div>
                    {isExpanded && (
                      <i
                        className={`fa fa-chevron-${
                          collapsedItems.settingsCollapse ? "up" : "down"
                        }`}
                      />
                    )}
                  </div>

                  {collapsedItems.settingsCollapse && isExpanded && (
                    <ul className="submenu">
                      {/* Catálogos */}
                      {showCatalogos && <li className="submenu-item">
                        <div
                          className="submenu-link has-submenu"
                          onClick={() => toggleCollapse("catalogosCollapse")}>
                          <div className="submenu-link-content">
                            <i className="fa fa-list"></i>
                            <span>Catálogos</span>
                          </div>
                          <i
                            className={`fa fa-chevron-${
                              collapsedItems.catalogosCollapse ? "up" : "down"
                            }`}
                          />
                        </div>

                          {collapsedItems.catalogosCollapse && (
                          <ul className="sub-submenu">
                            {roleData.tipos_de_monitoreo?.read && (
                              <li onClick={() => navigate("/tipos_monitoreo")} className={isActive("/tipos_monitoreo") ? "active" : ""}>
                                <i className="fa fa-tags"></i>
                                <span>Tipos Monitoreo</span>
                              </li>
                            )}
                            {roleData.eventos?.read && (
                              <li onClick={() => navigate("/eventos")} className={isActive("/eventos") ? "active" : ""}>
                                <i className="fa fa-calendar-alt"></i>
                                <span>Eventos</span>
                              </li>
                            )}
                            {roleData.clientes?.read && (
                              <li onClick={() => navigate("/clientes")} className={isActive("/clientes") ? "active" : ""}>
                                <i className="fa fa-building"></i>
                                <span>Clientes</span>
                              </li>
                            )}
                            {roleData.origenes?.read && (
                              <li onClick={() => navigate("/origenes")} className={isActive("/origenes") ? "active" : ""}>
                                <i className="fa fa-map-marker-alt"></i>
                                <span>Origenes</span>
                              </li>
                            )}
                            {roleData.destinos?.read && (
                              <li onClick={() => navigate("/destinos")} className={isActive("/destinos") ? "active" : ""}>
                                <i className="fa fa-map-pin"></i>
                                <span>Destinos</span>
                              </li>
                            )}
                            {roleData?.lineas_transporte?.read && (
                              <li onClick={() => navigate("/lineas-transporte")} className={isActive("/lineas-transporte") ? "active" : ""}>
                                <i className="fa fa-truck"></i>
                                <span>Líneas de transporte</span>
                              </li>
                            )}
                            {roleData?.operadores?.read && (
                              <li onClick={() => navigate("/operadores")} className={isActive("/operadores") ? "active" : ""}>
                                <i className="fa fa-user-tie"></i>
                                <span>Operadores</span>
                              </li>
                            )}
                          </ul>
                        )}
                      </li>}

                      {/* Sistema */}
                      {showSistema && <li className="submenu-item">
                        <div
                          className="submenu-link has-submenu"
                          onClick={() => toggleCollapse("sistemaCollapse")}>
                          <div className="submenu-link-content">
                            <i className="fa fa-server"></i>
                            <span>Sistema</span>
                          </div>
                          <i
                            className={`fa fa-chevron-${
                              collapsedItems.sistemaCollapse ? "up" : "down"
                            }`}
                          />
                        </div>

                        {collapsedItems.sistemaCollapse && (
                          <ul className="sub-submenu">
                            {roleData.usuarios?.read && (
                              <li onClick={() => navigate("/usuarios")} className={isActive("/usuarios") ? "active" : ""}>
                                <i className="fa fa-users"></i>
                                <span>Usuarios</span>
                              </li>
                            )}
                            {roleData.roles?.read && (
                              <li onClick={() => navigate("/roles")} className={isActive("/roles") ? "active" : ""}>
                                <i className="fa fa-user-shield"></i>
                                <span>Roles</span>
                              </li>
                            )}
                            {roleData.integraciones?.read && (
                              <li onClick={() => navigate("/integraciones")} className={isActive("/integraciones") ? "active" : ""}>
                                <i className="fa fa-plug"></i>
                                <span>Integraciones</span>
                              </li>
                            )}
                            {roleData.inactividad?.read && (
                              <li onClick={openInacModal} className={isActive("/inactividad") ? "active" : ""}>
                                <i className="fa fa-clock"></i>
                                <span>Inactividad</span>
                              </li>
                            )}
                          </ul>
                        )}
                      </li>}

                      {/* Auditoría */}
                      {showAuditoria && <li className="submenu-item">
                        <div
                          className="submenu-link has-submenu"
                          onClick={() => toggleCollapse("auditoriaCollapse")}>
                          <div className="submenu-link-content">
                            <i className="fa fa-shield-alt"></i>
                            <span>Auditoría</span>
                          </div>
                          <i
                            className={`fa fa-chevron-${
                              collapsedItems.auditoriaCollapse ? "up" : "down"
                            }`}
                          />
                        </div>

                        {collapsedItems.auditoriaCollapse && (
                          <ul className="sub-submenu">
                            {roleData.auditoria_bitacora?.read && (
                              <li onClick={() => navigate("/auditoria/bitacoras")} className={isActive("/auditoria/bitacoras") ? "active" : ""}>
                                <i className="fa fa-history"></i>
                                <span>Bitácoras</span>
                              </li>
                            )}
                          </ul>
                        )}
                      </li>}
                    </ul>
                  )}
                </li>
              )}
            </ul>
          </nav>

          {/* Logout Section */}
          <div className="sidebar-footer">
            <div className="logout-btn" onClick={logout}>
              <i className="fa fa-sign-out-alt"></i>
              {isExpanded && <span>Cerrar Sesión</span>}
            </div>
          </div>

          {isExpanded && <Footer />}
        </div>
      </aside>

      <InactivityModal show={showInacModal} handleClose={closeInacModal} />
    </>
  );
};

export default Sidebar;
