import {useEffect, useState, useCallback, useMemo, useRef} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import DataTable from "../DataTable";
import CellBadge from "../CellBadge";
import Tooltip from "../Tooltip";
import {Select} from "../Select";
import Toast from "../Toast";
import ModalTemplate from "../ModalTemplate";
import NewEventModal from "../Bitacoras/Eventos/NewEventModal";
import QuickPatchForm, {enrichTransportWithGps} from "./QuickPatchForm";
import {useWialon} from "../../context/WialonProvider";
import {findBestEventMatch} from "../../utils/wialonUtils";
import {useToast} from "../../hooks/useToast";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";
import {useNavigate} from "react-router-dom";
import {TRIGGER_LABELS, TRIGGER_COLORS, TRIGGER_ICONS} from "../../utils/wialonNotifications";

const fmtTime = (ts) => {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("es-MX", {dateStyle: "short", timeStyle: "short"});
};

// Wialon puede quedar inalcanzable desde el servidor; evita exponer el error crudo de fetch.
const friendlyWialonError = (msg) =>
  /fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR|network/i.test(msg || "")
    ? "No se pudo conectar con la API de Wialon. El servidor puede estar sin salida a Wialon o Wialon no responde. Intenta de nuevo en unos segundos."
    : msg;

// Reusable Alertas Wialon panel.
// Props:
//  - embedded: when true, render without Sidebar/PageHeader/full-viewport shell.
//  - unitIds: string[] — optional, restrict notifications to those touching any of these Wialon unit IDs.
//  - bitacoraId: string — optional, when set trims each row's activeBitacoras to that bitácora.
//  - onEventSaved: optional, called after an alert event is stored (auto or manual).
const EventosWialonPanel = ({embedded = false, unitIds = null, bitacoraId = null, onEventSaved = null}) => {
  const {user, verifyToken, setUser} = useAuth();
  const {getUnitById} = useWialon();
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const token = localStorage.getItem("wialonToken");
  const {toasts, showToast, removeToast} = useToast();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [resourceFilter, setResourceFilter] = useState(null);

  // Sorting state
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Unit modal state
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [selectedNotifForUnits, setSelectedNotifForUnits] = useState(null);
  const [selectedUnitInModal, setSelectedUnitInModal] = useState(null);

  // New event state
  const [eventTypes, setEventTypes] = useState([]);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [activeEventContext] = useState({ bitacoraId: null, transporteId: null });

  const quickPatchRef = useRef();

  // Stable Set<string> of scoped unit IDs (v2 note: v1 is client-side filter only).
  // Numeric-normalized variants are also stored so legacy formats like "012345"
  // or "12345.0" still match Wialon's integer IDs on notifications.
  const unitIdsKey = useMemo(() => {
    if (!Array.isArray(unitIds)) return "";
    return unitIds.map(String).sort().join("|");
  }, [unitIds]);
  const unitIdSet = useMemo(() => {
    if (!Array.isArray(unitIds) || unitIds.length === 0) return null;
    const set = new Set();
    for (const raw of unitIds) {
      if (raw == null) continue;
      const s = String(raw).trim();
      if (!s) continue;
      set.add(s);
      const n = Number(s);
      if (!Number.isNaN(n)) set.add(String(n));
    }
    return set.size > 0 ? set : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitIdsKey]);

  // Compare a raw unit id (from Wialon) against the scope set with the same
  // dual-form matching used in WialonMap.
  const matchesScope = useCallback(
    (rawId) => {
      if (!unitIdSet) return true;
      if (rawId == null) return false;
      const s = String(rawId);
      return unitIdSet.has(s) || unitIdSet.has(String(Number(s)));
    },
    [unitIdSet]
  );

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const res = await fetch(`${baseUrl}/event_types`, {credentials: "include"});
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
    if (embedded) return; // Parent (BitacoraDetailPage) already runs auth
    const init = async () => {
      try {
        const data = await verifyToken();
        setUser(data);
      } catch {
        navigate("/login");
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded]);

  useEffect(() => {
    if (embedded) return; // Parent already role-gated the page
    if (!user?.role) return;
    fetch(`${baseUrl}/roles/${user.role}`, {credentials: "include"})
      .then((r) => r.json())
      .then((role) => {
        if (!role?.eventos_wialon?.read) navigate("/");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, embedded]);

  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setError("Token de Wialon no configurado.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (Array.isArray(unitIds) && unitIds.length > 0) {
        params.set("unitIds", unitIds.map(String).join(","));
      }
      const query = params.toString();
      const res = await fetch(`${baseUrl}/wialon/notifications${query ? `?${query}` : ""}`, {
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
      setError(friendlyWialonError(err.message) || "Error al cargar alertas");
    } finally {
      setLoading(false);
    }
  }, [token, baseUrl, unitIds]);

  useEffect(() => {
    // In embedded mode we don't wait for verifyToken; fetch as soon as we can.
    if (embedded || user) {
      fetchNotifications();
    }
  }, [user, embedded, fetchNotifications]);

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

    // 0. Scope by unit IDs (bitácora tab), then trim activeBitacoras to the current bitácora if given.
    if (unitIdSet) {
      result = result
        .filter((n) => (n.units || []).some((u) => matchesScope(u)))
        .map((n) => {
          const trimmedActive = bitacoraId
            ? (n.activeBitacoras || []).filter((b) => String(b._id) === String(bitacoraId))
            : n.activeBitacoras || [];
          return {
            ...n,
            activeBitacoras: trimmedActive,
            hasActiveBitacora: trimmedActive.length > 0 ? 1 : 0,
          };
        });
    }

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
  }, [notifications, unitIdSet, bitacoraId, search, typeFilter, statusFilter, resourceFilter, sortField, sortOrder]);

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

  const handleAutoEvent = async (notification) => {
    if (savingKey) return;
    if (!notification.activeBitacoras?.length) {
      showToast("No hay bitácoras activas vinculadas a esta alerta.", "warning");
      return;
    }

    const best = findBestEventMatch(notification.name, eventTypes);
    if (!best?.match?.evento) {
      showToast("No hay un tipo de evento que corresponda a esta alerta.", "warning");
      return;
    }

    // Embedded view is already limited to this bitácora. Standalone uses the first open one.
    const targetBitId = bitacoraId || notification.activeBitacoras[0]._id;
    const bits = notification.activeBitacoras.filter((b) => String(b._id) === String(targetBitId));
    const transporteIds = new Set(bits.map((b) => String(b.transporteId)));
    if (!transporteIds.size) {
      showToast("No hay transportes vinculados a esta alerta.", "warning");
      return;
    }

    setSavingKey(notification._key);
    try {
      const res = await fetch(`${baseUrl}/bitacora/${targetBitId}`, {credentials: "include"});
      if (!res.ok) throw new Error("No se pudo cargar la bitácora");
      const data = await res.json();
      const transportes = (data.transportes || []).filter((t) => transporteIds.has(String(t.id)));
      if (!transportes.length) throw new Error("No hay transportes vinculados a esta alerta.");

      const enriched = await Promise.all(
        transportes.map((t) => enrichTransportWithGps(t, getUnitById))
      );

      const patchRes = await fetch(`${baseUrl}/bitacora/${targetBitId}/event`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        credentials: "include",
        body: JSON.stringify({
          nombre: best.match.evento,
          descripcion: `Alerta Wialon: ${notification.name}`,
          registrado_por: user ? `${user.firstName} ${user.lastName}` : "Sistema",
          frecuencia: 10,
          transportes: enriched,
        }),
      });
      if (!patchRes.ok) throw new Error("Error al guardar el evento");

      showToast("Evento registrado en bitácora", "success");
      if (onEventSaved) await onEventSaved();
    } catch (err) {
      showToast(err.message || "Error al guardar el evento", "error");
    } finally {
      setSavingKey(null);
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
      width: "20%",
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
      key: "status",
      header: "Estatus",
      width: "15%",
      render: (row) => row.status ? (
        <CellBadge
          label={`${row.status === "plan de embarque" ? "Embarque" : row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : ""}${row.edited ? " (e)" : ""}`}
          variant={
            row.status === "nueva"      ? "blue"   :
            row.status === "validada"   ? "yellow" :
            row.status === "iniciada"   ? "green"  :
            row.status === "cerrada"    ? "red"    :
            row.status === "finalizada" ? "purple" : "gray"
          }
        />
      ) : <span className="text-muted small">—</span>
    },
    {
      key: "eventName",
      header: "Alerta",
      width: "25%",
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
      disabled: (row) => ["cerrada", "cerrada (e)", "finalizada"].includes(row.status),
      onClick: (row) => {
        setSelectedUnitInModal(row);
      }
    }
  ];

  const unitListData = useMemo(() => {
    if (!selectedNotifForUnits) return [];

    const { units, unitNames, activeBitacoras, name } = selectedNotifForUnits;

    // In scoped (tab) mode, only show rows for units that belong to the bitácora.
    const scopedUnits = unitIdSet
      ? units.filter((uId) => unitIdSet.has(String(uId)))
      : units;

    return scopedUnits.map((uId) => {
      const idx = units.indexOf(uId);
      const uName = unitNames[idx] || `ID: ${uId}`;
      const bit = activeBitacoras.find(b => String(b.wialonId) === String(uId));

      return {
        id: uId,
        name: uName,
        bitacora_id: bit?.bitacora_id || null,
        bitacora_raw_id: bit?._id || null,
        transporte_id: bit?.transporteId || null,
        status: bit?.status || null,
        edited: bit?.edited || false,
        placa: bit?.placa || null,
        eco: bit?.eco || null,
        eventName: name,
        // for DataTable rowKey
        _key: `unit-${uId}-${idx}`
      };
    });
  }, [selectedNotifForUnits, unitIdSet]);

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
        // In scoped mode, count only the in-scope units.
        const scopedCount = unitIdSet
          ? (row.units || []).filter((u) => unitIdSet.has(String(u))).length
          : (row.units?.length || 0);
        const hasActive = row.activeBitacoras?.length > 0;

        return (
          <div style={{display: "flex", alignItems: "center", gap: "6px", position: "relative"}}>
            <CellBadge
              label={scopedCount > 0 ? String(scopedCount) : "0"}
              variant={scopedCount > 0 ? "blue" : "gray"}
              onClick={(e) => {
                e.stopPropagation();
                if (scopedCount > 0) {
                  setSelectedNotifForUnits(row);
                  setUnitModalVisible(true);
                }
              }}
              style={{cursor: scopedCount > 0 ? "pointer" : "default"}}
            />
            {hasActive && (
              <Tooltip text="Unidades con bitácora activa" position="top">
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    backgroundColor: "#10b981",
                    borderRadius: "50%",
                    boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.2)",
                    display: "inline-block"
                  }}
                />
              </Tooltip>
            )}
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
          <Tooltip text="Auto-evento" position="left">
            <button
              className="action-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleAutoEvent(row);
              }}
              style={{
                backgroundColor: row.activeBitacoras?.length ? "#10b981" : "#e5e7eb",
                border: "none",
                color: "white",
                cursor: row.activeBitacoras?.length && !savingKey ? "pointer" : "not-allowed",
                padding: "6px",
                fontSize: "0.9rem",
                borderRadius: "6px",
                width: "30px",
                height: "30px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
                boxShadow: row.activeBitacoras?.length ? "0 2px 4px rgba(16, 185, 129, 0.2)" : "none"
              }}
              disabled={loading || !!savingKey || !row.activeBitacoras?.length}
            >
              <i className={`fa ${savingKey === row._key ? "fa-spinner fa-spin" : "fa-magic"}`}></i>
            </button>
          </Tooltip>
        </div>
      ),
    },
  ];

  const filtersPanel = (
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
  );

  const tableSection = (
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
  );

  const modals = (
    <>
      <Toast toasts={toasts} removeToast={removeToast} />

      <ModalTemplate
        show={unitModalVisible}
        onClose={() => {
          setUnitModalVisible(false);
          setSelectedUnitInModal(null);
        }}
        title={
          selectedUnitInModal ? (
            <div className="d-flex align-items-center gap-2">
              <button
                className="bits-breadcrumb__back me-1"
                onClick={() => setSelectedUnitInModal(null)}
                type="button"
                style={{ background: 'none', border: 'none', padding: 0, width: 'auto', height: 'auto', color: 'inherit' }}
              >
                <i className="fa fa-chevron-left" style={{ fontSize: '0.9rem' }}></i>
              </button>
              <h1 className="bits-header__title mb-0" style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                <span className="bits-breadcrumb__ancestor" style={{ color: '#64748b', fontWeight: 400 }}>Monitoreo<span className="bits-breadcrumb__sep" style={{ margin: '0 4px', opacity: 0.5 }}>/</span></span>
                <span className="bits-breadcrumb__ancestor" style={{ color: '#64748b', fontWeight: 400 }}>Alertas Wialon<span className="bits-breadcrumb__sep" style={{ margin: '0 4px', opacity: 0.5 }}>/</span></span>
                <span className="bits-breadcrumb__current" style={{ color: '#1e293b' }}>Crear nuevo evento</span>
              </h1>
            </div>
          ) : (
            `Unidades vinculadas: ${selectedNotifForUnits?.name || ""}`
          )
        }
        extraWide={true}
        hideFooter={!selectedUnitInModal}
        submitText="Guardar Evento"
        cancelText="Cancelar"
        onSubmit={(e) => {
          e.preventDefault();
          quickPatchRef.current?.submit();
        }}
        className="split-view-modal"
      >
        <div style={{ minHeight: "400px", padding: selectedUnitInModal ? "20px" : "0" }}>
          {!selectedUnitInModal ? (
            <div className="bits-table-shell bits-table-shell--no-padding" style={{ height: "500px" }}>
              <DataTable
                data={unitListData}
                columns={unitColumns}
                actions={unitActions}
                rowKey="_key"
                emptyMessage="No hay unidades registradas para esta alerta."
                maxHeight="100%"
              />
            </div>
          ) : (
            <div className="animate__animated animate__fadeIn">
              <QuickPatchForm
                ref={quickPatchRef}
                unit={selectedUnitInModal}
                eventTypes={eventTypes}
                onSuccess={async () => {
                  fetchNotifications();
                  setSelectedUnitInModal(null);
                  if (onEventSaved) await onEventSaved();
                }}
              />
            </div>
          )}
        </div>
      </ModalTemplate>

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
    </>
  );

  if (embedded) {
    return (
      <div className="eventos-wialon-panel eventos-wialon-panel--embedded">
        {modals}
        <div className="eventos-wialon-panel__toolbar">
          <div className="eventos-wialon-panel__filters">{filtersPanel}</div>
          <div className="eventos-wialon-panel__actions">
            {hasActiveFilters && (
              <button
                className="new-btn new-btn--ghost"
                onClick={clearFilters}
                title="Limpiar filtros">
                <i className="fa fa-times"></i>
              </button>
            )}
            <button
              className="new-btn"
              onClick={fetchNotifications}
              disabled={loading}
              title="Recargar">
              <i className={`fa fa-${loading ? "spinner fa-spin" : "sync-alt"}`}></i>
            </button>
          </div>
        </div>
        {tableSection}
      </div>
    );
  }

  return (
    <section id="eventosWialonPage" className="settings-page">
      {modals}
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
            filters={filtersPanel}>
            <button
              className="new-btn"
              onClick={fetchNotifications}
              disabled={loading}
              title="Recargar">
              <i className={`fa fa-${loading ? "spinner fa-spin" : "sync-alt"}`}></i>
            </button>
          </PageHeader>

          {tableSection}
        </div>
      </div>
    </section>
  );
};

export default EventosWialonPanel;
