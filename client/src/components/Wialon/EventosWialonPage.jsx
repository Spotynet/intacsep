import {useEffect, useState, useCallback, useMemo} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import DataTable from "../DataTable";
import CellBadge from "../CellBadge";
import Tooltip from "../Tooltip";
import {Select} from "../Select";
import Toast from "../Toast";
import ModalTemplate from "../ModalTemplate";
import NewEventModal from "../Bitacoras/Eventos/NewEventModal";
import QuickPatchForm from "./QuickPatchForm";
import {useToast} from "../../hooks/useToast";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";
import {useNavigate} from "react-router-dom";

const fmtTime = (ts) => {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("es-MX", {dateStyle: "short", timeStyle: "short"});
};

const TRIGGER_LABELS = {
  speed: "Velocidad",
  speeding_gis: "Exceso de velocidad",
  geozone: "Geocerca",
  sensor_value: "Sensor",
  alarm: "Alarma",
  digital_input: "Entrada digital",
  msg_param: "Parámetro de mensaje",
  outage: "Desconexión",
  driver: "Conductor",
  route_control: "Ruta",
  service_intervals: "Mantenimiento",
  interposition: "Distancia",
  msgs_counter: "Mensajes",
  sms: "SMS",
  address: "Dirección",
  expression: "Expresión",
  tag: "Etiqueta",
  tag_alarm: "Alarma de etiqueta",
  fuel_filling: "Carga de combustible",
};

const TRIGGER_COLORS = {
  speed: "#ef4444",
  speeding_gis: "#dc2626",
  geozone: "#6366f1",
  sensor_value: "#f59e0b",
  alarm: "#dc2626",
  digital_input: "#8b5cf6",
  msg_param: "#3b82f6",
  outage: "#6b7280",
  driver: "#10b981",
  route_control: "#14b8a6",
  service_intervals: "#f97316",
  interposition: "#ec4899",
  msgs_counter: "#06b6d4",
  sms: "#a855f7",
  address: "#84cc16",
  expression: "#0ea5e9",
  tag: "#a3a3a3",
  tag_alarm: "#b91c1c",
  fuel_filling: "#16a34a",
};

const TRIGGER_ICONS = {
  speed: "fa-tachometer-alt",
  speeding_gis: "fa-tachometer-alt",
  geozone: "fa-draw-polygon",
  sensor_value: "fa-microchip",
  alarm: "fa-exclamation-triangle",
  digital_input: "fa-plug",
  msg_param: "fa-code",
  outage: "fa-wifi-slash",
  driver: "fa-user-tie",
  route_control: "fa-route",
  service_intervals: "fa-wrench",
  interposition: "fa-arrows-alt-h",
  msgs_counter: "fa-envelope",
  sms: "fa-comment-alt",
  address: "fa-map-marker-alt",
  expression: "fa-equals",
  tag: "fa-tag",
  tag_alarm: "fa-bell",
  fuel_filling: "fa-gas-pump",
};

const ACTION_ICONS = {
  Popup: {icon: "fa-window-restore", color: "#3b82f6"},
  Email: {icon: "fa-envelope", color: "#8b5cf6"},
  SMS: {icon: "fa-comment", color: "#f59e0b"},
  Comando: {icon: "fa-terminal", color: "#6b7280"},
  HTTP: {icon: "fa-globe", color: "#06b6d4"},
  Evento: {icon: "fa-flag", color: "#ef4444"},
  Móvil: {icon: "fa-mobile-alt", color: "#10b981"},
  Telegram: {icon: "fa-telegram", color: "#0ea5e9"},
  WhatsApp: {icon: "fa-whatsapp", color: "#16a34a"},
};

const EventosWialonPage = () => {
  const {user, verifyToken, setUser} = useAuth();
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const token = localStorage.getItem("wialonToken");
  const {toasts, showToast, removeToast} = useToast();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [resourceFilter, setResourceFilter] = useState(null);

  // Sorting state
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  const [togglingId, setTogglingId] = useState(null);

  // Log state
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [selectedNotifForLog, setSelectedNotifForLog] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [notificationLogs, setNotificationLogs] = useState([]);

  // Unit modal state
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [selectedNotifForUnits, setSelectedNotifForUnits] = useState(null);
  const [selectedUnitInModal, setSelectedUnitInModal] = useState(null);
  
  // New event state
  const [eventTypes, setEventTypes] = useState([]);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [activeEventContext, setActiveEventContext] = useState({ bitacoraId: null, transporteId: null });

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const res = await fetch(`${baseUrl}/event-types`, {credentials: "include"});
        if (res.ok) {
          const data = await res.json();
          setEventTypes(data);
        }
      } catch (err) {
        console.error("Error fetching event types:", err);
      }
    };
    fetchEventTypes();
  }, [baseUrl]);

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
        if (!role?.eventos_wialon?.read) navigate("/");
      })
      .catch(() => {});
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setError("Token de Wialon no configurado.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${baseUrl}/wialon/notifications`, {
        headers: {"x-wialon-token": token},
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({error: `HTTP ${res.status}`}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      const mapped = data.notifications
        .map((n) => ({
          ...n,
          triggerLabel: TRIGGER_LABELS[n.triggerType] || n.triggerType,
          triggerColor: TRIGGER_COLORS[n.triggerType] || "#6b7280",
          text: n.text || "—",
          units: n.units || [],
          unitNames: n.unitNames || [],
          unitsText: (n.unitNames && n.unitNames.length
            ? n.unitNames.join(", ")
            : n.units && n.units.length
            ? n.units.join(", ")
            : "Todas"),
          activeBitacoras: n.activeBitacoras || [],
          hasActiveBitacora: (n.activeBitacoras && n.activeBitacoras.length > 0) ? 1 : 0,
          actionLabels: n.actionLabels || [],
          actionDescriptions: n.actionDescriptions || [],
        }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setNotifications(mapped);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError(err.message || "Error al cargar alertas");
    } finally {
      setLoading(false);
    }
  }, [token, baseUrl]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  // Derived filter options
  const typeOptions = useMemo(() => {
    const types = [...new Set(notifications.map((n) => n.triggerType))];
    return types
      .map((t) => ({value: t, label: TRIGGER_LABELS[t] || t}))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [notifications]);

  const resourceOptions = useMemo(() => {
    const resources = [...new Set(notifications.map((n) => n.resourceName).filter(Boolean))];
    return resources.map((r) => ({value: r, label: r})).sort((a, b) => a.label.localeCompare(b.label));
  }, [notifications]);

  const statusOptions = [
    {value: "active", label: "Activas"},
    {value: "inactive", label: "Inactivas"},
  ];

  // Filtered and Sorted data
  const filteredNotifications = useMemo(() => {
    let result = [...notifications];
    
    // 1. Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          (n.name || "").toLowerCase().includes(q) ||
          (n.description || "").toLowerCase().includes(q) ||
          (n.resourceName || "").toLowerCase().includes(q) ||
          (n.triggerLabel || "").toLowerCase().includes(q) ||
          (n.unitNames || []).some((u) => u.toLowerCase().includes(q))
      );
    }

    // 2. Filters
    if (typeFilter) result = result.filter((n) => n.triggerType === typeFilter);
    if (statusFilter === "active") result = result.filter((n) => n.enabled);
    if (statusFilter === "inactive") result = result.filter((n) => !n.enabled);
    if (resourceFilter) result = result.filter((n) => n.resourceName === resourceFilter);

    // 3. Sorting
    if (sortField) {
      result.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        // Handle specific fields if needed
        if (sortField === "unitsText") {
          valA = a.units?.length || 0;
          valB = b.units?.length || 0;
        }

        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        let comparison = 0;
        if (typeof valA === "string") {
          comparison = valA.localeCompare(valB);
        } else {
          comparison = valA < valB ? -1 : 1;
        }

        return sortOrder === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [notifications, search, typeFilter, statusFilter, resourceFilter, sortField, sortOrder]);

  const handleSortChange = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const hasActiveFilters = search || typeFilter || statusFilter || resourceFilter;

  const clearFilters = () => {
    setSearch("");
    setTypeFilter(null);
    setStatusFilter(null);
    setResourceFilter(null);
  };

  // Toggle single notification
  const handleToggle = async (notification) => {
    setTogglingId(notification._key);
    try {
      const res = await fetch(
        `${baseUrl}/wialon/notifications/${notification.resourceId}/${notification.id}/toggle`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          credentials: "include",
          body: JSON.stringify({enabled: !notification.enabled}),
        }
      );
      if (!res.ok) throw new Error("Error al cambiar estado");
      setNotifications((prev) =>
        prev.map((n) => (n._key === notification._key ? {...n, enabled: !n.enabled} : n))
      );
      showToast(`Notificación ${!notification.enabled ? "activada" : "desactivada"}`, "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => showToast("Copiado al portapapeles", "success"))
      .catch(() => showToast("Error al copiar", "error"));
  };

  const fetchNotificationLogs = async (notification) => {
    setSelectedNotifForLog(notification);
    setLogModalVisible(true);
    setLoadingLogs(true);
    setNotificationLogs([]);

    try {
      const res = await fetch(
        `${baseUrl}/wialon/notifications/${notification.resourceId}/${notification.id}/log`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Error al cargar historial");
      const data = await res.json();
      setNotificationLogs(data.logs || []);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoadingLogs(false);
    }
  };

  const unitColumns = [
    { 
      key: "name", 
      header: "Unidad", 
      width: "35%",
      render: (row) => <span className="fw-bold">{row.name}</span>
    },
    { 
      key: "bitacora_id", 
      header: "Bitácora", 
      width: "25%",
      render: (row) => row.bitacora_id ? (
        <CellBadge 
          label={row.bitacora_id} 
          variant="blue" 
          onClick={() => navigate(`/bitacora/${row.bitacora_raw_id}`)}
          style={{cursor: "pointer"}}
        />
      ) : <span className="text-muted small">No vinculada</span>
    },
    { 
      key: "eventName", 
      header: "Evento", 
      width: "30%",
      render: (row) => <span className="text-muted small">{row.eventName}</span>
    },
  ];

  const unitActions = [
    {
      icon: "fa fa-external-link-alt",
      className: "action-btn btn-primary",
      title: "Ir a Bitácora",
      show: (row) => !!row.bitacora_raw_id,
      onClick: (row) => {
        setUnitModalVisible(false);
        navigate(`/bitacora/${row.bitacora_raw_id}`);
      }
    },
    {
      icon: "fa fa-plus-circle",
      className: "action-btn btn-success",
      title: "Crear Evento",
      show: (row) => !!row.bitacora_raw_id,
      onClick: (row) => {
        setSelectedUnitInModal(row);
      }
    }
  ];

  const unitListData = useMemo(() => {
    if (!selectedNotifForUnits) return [];
    
    const { units, unitNames, activeBitacoras, name } = selectedNotifForUnits;
    
    return units.map((uId, idx) => {
      const uName = unitNames[idx] || `ID: ${uId}`;
      const bit = activeBitacoras.find(b => String(b.wialonId) === String(uId));
      
      return {
        id: uId,
        name: uName,
        bitacora_id: bit?.bitacora_id || null,
        bitacora_raw_id: bit?._id || null,
        transporte_id: bit?.transporteId || null,
        eventName: name,
        // for DataTable rowKey
        _key: `unit-${uId}-${idx}`
      };
    });
  }, [selectedNotifForUnits]);

  const columns = [
    {
      key: "name",
      header: "Nombre",
      width: "15%",
      sortable: true,
      render: (row) => {
        const icon = TRIGGER_ICONS[row.triggerType] || "fa-bell";
        return (
          <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
            <i 
              className={`fa ${icon}`} 
              style={{
                color: row.triggerColor, 
                fontSize: "0.9rem",
                width: "20px",
                textAlign: "center"
              }}
            />
            <span style={{fontWeight: 600, color: "#1f2937"}}>{row.name}</span>
          </div>
        );
      },
    },
    {
      key: "triggerLabel",
      header: "Tipo",
      width: "8%",
      sortable: true,
      render: (row) => (
        <span style={{fontSize: "0.82rem", fontWeight: 500, color: "#374151"}}>
          {row.triggerLabel}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Creada",
      width: "8%",
      sortable: true,
      render: (row) => (
        <span style={{fontSize: "0.8rem", color: "#6b7280"}}>{fmtTime(row.createdAt)}</span>
      ),
    },
    {
      key: "actionDescriptions",
      header: "Acciones",
      width: "30%",
      render: (row) => {
        const descriptions = row.actionDescriptions || [];
        if (descriptions.length === 0) return <span style={{color: "#9ca3af", fontSize: "0.78rem"}}>—</span>;
        
        const fullText = descriptions.join(", ");
        return (
          <span 
            style={{color: "#4b5563", fontSize: "0.82rem", lineHeight: "1.2"}} 
            title={fullText}
          >
            {fullText}
          </span>
        );
      },
    },
    {
      key: "resourceName",
      header: "Recurso",
      width: "10%",
      sortable: true,
      render: (row) => (
        <span style={{fontSize: "0.82rem", color: "#6b7280"}} title={row.resourceName}>
          {row.resourceName && row.resourceName.length > 20
            ? row.resourceName.slice(0, 20) + "..."
            : row.resourceName || "—"}
        </span>
      ),
    },
    {
      key: "description",
      header: "Descripción",
      width: "15%",
      sortable: true,
      render: (row) => (
        <span style={{color: "#6b7280", fontSize: "0.82rem"}} title={row.description}>
          {row.description || "—"}
        </span>
      ),
    },
    {
      key: "unitsText",
      header: "Unidades",
      width: "6%",
      sortable: true,
      render: (row) => {
        const count = row.units?.length || 0;
        
        return (
          <div style={{display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap"}}>
            <CellBadge 
              label={count > 0 ? String(count) : "0"} 
              variant={count > 0 ? "blue" : "gray"} 
              onClick={(e) => {
                e.stopPropagation();
                if (count > 0) {
                  setSelectedNotifForUnits(row);
                  setUnitModalVisible(true);
                }
              }}
              style={{cursor: count > 0 ? "pointer" : "default"}}
            />
          </div>
        );
      },
    },
    {
      key: "botones",
      header: "Controles",
      width: "8%",
      className: "text-center",

      render: (row) => (
        <div style={{display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"}}>
          <button 
            className={`notification-toggle ${row.enabled ? "active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (togglingId === row._key) return;
              handleToggle(row);
            }}
            disabled={togglingId === row._key}
            title={row.enabled ? "Desactivar" : "Activar"}
          >
            <span className="toggle-track">
              <span className="toggle-thumb">
                {togglingId === row._key && (
                  <i 
                    className="fa fa-spinner fa-spin" 
                    style={{
                      fontSize: "0.6rem", 
                      color: "#6b7280",
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)"
                    }}
                  />
                )}
              </span>
            </span>
          </button>
          <button 
            className="action-icon-btn" 
            onClick={(e) => {
              e.stopPropagation();
              fetchNotificationLogs(row);
            }}
            title="Ver historial"
            style={{
              background: "none",
              border: "none",
              color: "#6b7280",
              cursor: "pointer",
              padding: "4px",
              fontSize: "0.9rem"
            }}
          >
            <i className="fa fa-history"></i>
          </button>
        </div>
      ),
    },
  ];

  return (
    <section id="eventosWialonPage" className="settings-page">
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Log Modal */}
      <ModalTemplate
        show={logModalVisible}
        onClose={() => setLogModalVisible(false)}
        title={`Historial: ${selectedNotifForLog?.name || "Notificación"}`}
        width="800px"
      >
        <div style={{padding: "20px"}}>
          {loadingLogs ? (
            <div className="text-center py-5">
              <i className="fa fa-spinner fa-spin fa-2x text-primary mb-3"></i>
              <p className="text-muted">Cargando eventos recientes...</p>
            </div>
          ) : notificationLogs.length === 0 ? (
            <div className="text-center py-5">
              <i className="fa fa-info-circle fa-2x text-muted mb-3"></i>
              <p className="text-muted">No se encontraron registros recientes para esta alerta.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Fecha/Hora</th>
                    <th>Unidad</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {notificationLogs.map((log, i) => (
                    <tr key={i}>
                      <td style={{whiteSpace: "nowrap"}}>{fmtTime(log.t)}</td>
                      <td>{log.u || "—"}</td>
                      <td style={{fontSize: "0.85rem"}}>{log.m || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ModalTemplate>
      
      {/* Units Detail Modal */}
      <ModalTemplate
        show={unitModalVisible}
        onClose={() => {
          setUnitModalVisible(false);
          setSelectedUnitInModal(null);
        }}
        title={`Unidades vinculadas: ${selectedNotifForUnits?.name || ""}`}
        extraWide={true}
        hideFooter={true}
        className="split-view-modal"
      >
        <div className="d-flex" style={{ height: "600px" }}>
          <div 
            className="unit-list-side" 
            style={{ 
              flex: selectedUnitInModal ? "0 0 400px" : "1",
              borderRight: selectedUnitInModal ? "1px solid #e5e7eb" : "none",
              transition: "all 0.3s ease",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div className="bits-table-shell bits-table-shell--no-padding">
              <DataTable
                data={unitListData}
                columns={unitColumns}
                actions={unitActions}
                rowKey="_key"
                emptyMessage="No hay unidades registradas para esta alerta."
                maxHeight="100%"
              />
            </div>
          </div>
          
          {selectedUnitInModal && (
            <div 
              className="unit-form-side" 
              style={{ 
                flex: "1",
                padding: "20px",
                overflowY: "auto",
                backgroundColor: "#f9fafb"
              }}
            >
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h5 className="mb-0 fw-bold text-primary">
                  Gestionar Bitácora: #{selectedUnitInModal.bitacora_id}
                </h5>
                <button 
                  className="btn btn-sm btn-light"
                  onClick={() => setSelectedUnitInModal(null)}
                >
                  <i className="fa fa-times me-1"></i> Cerrar Panel
                </button>
              </div>
              
              <QuickPatchForm 
                unit={selectedUnitInModal}
                eventTypes={eventTypes}
                onSuccess={() => {
                  fetchNotifications();
                }}
              />
            </div>
          )}
        </div>
      </ModalTemplate>

      {/* New Event Modal */}
      <NewEventModal
        show={eventModalVisible}
        onClose={() => setEventModalVisible(false)}
        eventTypes={eventTypes}
        bitacoraId={activeEventContext.bitacoraId}
        initialTransporteId={activeEventContext.transporteId}
        onEventAdded={() => {
          setEventModalVisible(false);
          showToast("Evento creado correctamente", "success");
        }}
      />

      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Monitoreo - Alertas Wialon"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            count={filteredNotifications.length}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            filters={
              <div className="bits-filters-panel">
                <div className="bits-filters-grid">
                  <div>
                    <span className="pselect__label">Buscar</span>
                    <div className="pdt-field">
                      <i className="fa fa-search pdt-field__icon"></i>
                      <input
                        type="text"
                        className="pdt-field__input"
                        placeholder="Nombre, texto, unidad..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Select
                      label="Tipo"
                      placeholder="Todos..."
                      options={typeOptions}
                      value={typeFilter}
                      onChange={setTypeFilter}
                    />
                  </div>
                  <div>
                    <Select
                      label="Estado"
                      placeholder="Todos..."
                      options={statusOptions}
                      value={statusFilter}
                      onChange={setStatusFilter}
                    />
                  </div>
                  <div>
                    <Select
                      label="Recurso"
                      placeholder="Todos..."
                      options={resourceOptions}
                      value={resourceFilter}
                      onChange={setResourceFilter}
                    />
                  </div>
                </div>
              </div>
            }>
            <button
              className="new-btn"
              onClick={fetchNotifications}
              disabled={loading}
              title="Recargar">
              <i className={`fa fa-${loading ? "spinner fa-spin" : "sync-alt"}`}></i>
            </button>
          </PageHeader>

          <div className="bits-table-shell">
            {error ? (
              <div
                className="d-flex flex-column align-items-center justify-content-center"
                style={{minHeight: "300px"}}>
                <i
                  className="fa fa-exclamation-triangle"
                  style={{fontSize: "2.5rem", color: "#f59e0b", marginBottom: "12px"}}></i>
                <h5 style={{color: "#374151", fontWeight: 600, marginBottom: "8px"}}>
                  Error al cargar
                </h5>
                <p style={{color: "#6b7280", fontSize: "0.85rem", marginBottom: "16px"}}>
                  {error}
                </p>
                <button className="new-btn" onClick={fetchNotifications}>
                  <i className="fa fa-redo"></i> Reintentar
                </button>
              </div>
            ) : (
              <DataTable
                data={filteredNotifications}
                loading={loading}
                columns={columns}
                rowKey="_key"
                maxHeight="100%"
                emptyMessage="No se encontraron alertas configuradas en Wialon."
                sortField={sortField}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default EventosWialonPage;
