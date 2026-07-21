import {useState, useEffect} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import ModalTemplate from "../ModalTemplate";
import Toast from "../Toast";
import {useToast} from "../../hooks/useToast";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";
import {useNavigate} from "react-router-dom";

const RolePage = () => {
  const [roles, setRoles] = useState([]);
  const [clients, setClients] = useState([]); // Lista de todos los clientes disponibles
  const [newRole, setNewRole] = useState({
    name: "",
    bitacoras: {create: false, read: false, read_all: false, update: false, delete: false},
    eventos: {create: false, read: false, update: false, delete: false},
    clientes: {create: false, read: false, update: false, delete: false},
    usuarios: {create: false, read: false, update: false, delete: false},
    roles: {create: false, read: false, update: false, delete: false},
    origenes: {create: false, read: false, update: false, delete: false},
    destinos: {create: false, read: false, update: false, delete: false},
    operadores: {create: false, read: false, update: false, delete: false},
    lineas_transporte: {create: false, read: false, update: false, delete: false},
    tipos_de_monitoreo: {create: false, read: false, update: false, delete: false},
    integraciones: {create: false, read: false, update: false, delete: false},
    inactividad: {create: false, read: false, update: false, delete: false},
    bitacora_abierta: {create: false, read: false, update: false, delete: false},
    bitacora_cerrada: {create: false, read: false, update: false, delete: false},
    bit_detalles: {create: false, read: false, update: false, delete: false},
    bit_eventos: {create: false, read: false, update: false, delete: false},
    bit_transportes: {create: false, read: false, update: false, delete: false},
    auditoria_bitacora: {create: false, read: false, update: false, delete: false},
    dashboard: {create: false, read: false, update: false, delete: false},
    dashboard_anomalias: {create: false, read: false, update: false, delete: false},
    gps_id: {create: false, read: false, update: false, delete: false},
    tracto: {create: false, read: false, update: false, delete: false},
    remolque: {create: false, read: false, update: false, delete: false},
    operador: {create: false, read: false, update: false, delete: false},
    // Permisos de acceso a clientes
    client_access: "all", // 'all' o 'specific'
    allowed_clients: [], // Array de clientes permitidos
    ver_bitacoras_cerradas: true,
    crear_draft_transporte: false,
    aceptar_draft: false,
    plan_linea_transporte: true,
    plan_operador: true,
    plan_telefono: true,
    planes_embarque: {create: false, read: false, update: false, delete: false},
    buscador_plan: {create: false, read: false, update: false, delete: false},
    reporte_eventos: {create: false, read: false, update: false, delete: false},
    reporte_estadisticas: {create: false, read: false, update: false, delete: false},
    reporte_control_patios: {create: false, read: false, update: false, delete: false},
    control_patios: {create: false, read: false, update: false, delete: false},
    control_patios_remolques: {create: false, read: false, update: false, delete: false},
  });

  const [editRole, setEditRole] = useState(null);
  const [editRoleData, setEditRoleData] = useState({
    name: "",
    bitacoras: {create: false, read: false, read_all: false, update: false, delete: false},
    eventos: {create: false, read: false, update: false, delete: false},
    clientes: {create: false, read: false, update: false, delete: false},
    usuarios: {create: false, read: false, update: false, delete: false},
    roles: {create: false, read: false, update: false, delete: false},
    origenes: {create: false, read: false, update: false, delete: false},
    destinos: {create: false, read: false, update: false, delete: false},
    operadores: {create: false, read: false, update: false, delete: false},
    lineas_transporte: {create: false, read: false, update: false, delete: false},
    tipos_de_monitoreo: {create: false, read: false, update: false, delete: false},
    integraciones: {create: false, read: false, update: false, delete: false},
    inactividad: {create: false, read: false, update: false, delete: false},
    bitacora_abierta: {create: false, read: false, update: false, delete: false},
    bitacora_cerrada: {create: false, read: false, update: false, delete: false},
    bit_detalles: {create: false, read: false, update: false, delete: false},
    bit_eventos: {create: false, read: false, update: false, delete: false},
    bit_transportes: {create: false, read: false, update: false, delete: false},
    auditoria_bitacora: {create: false, read: false, update: false, delete: false},
    dashboard: {create: false, read: false, update: false, delete: false},
    dashboard_anomalias: {create: false, read: false, update: false, delete: false},
    gps_id: {create: false, read: false, update: false, delete: false},
    tracto: {create: false, read: false, update: false, delete: false},
    remolque: {create: false, read: false, update: false, delete: false},
    operador: {create: false, read: false, update: false, delete: false},
    // Permisos de acceso a clientes
    client_access: "all", // 'all' o 'specific'
    allowed_clients: [], // Array de clientes permitidos
    ver_bitacoras_cerradas: true,
    crear_draft_transporte: false,
    aceptar_draft: false,
    plan_linea_transporte: true,
    plan_operador: true,
    plan_telefono: true,
    planes_embarque: {create: false, read: false, update: false, delete: false},
    buscador_plan: {create: false, read: false, update: false, delete: false},
    reporte_eventos: {create: false, read: false, update: false, delete: false},
    reporte_estadisticas: {create: false, read: false, update: false, delete: false},
    reporte_control_patios: {create: false, read: false, update: false, delete: false},
    control_patios: {create: false, read: false, update: false, delete: false},
    control_patios_remolques: {create: false, read: false, update: false, delete: false},
  });

  const [showModal, setShowModal] = useState(false);
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [idToDelete, setIdToDelete] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const {user, verifyToken, setUser} = useAuth();
  const [roleData, setRoleData] = useState(null);
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const navigate = useNavigate();
  const {toasts, showToast, removeToast} = useToast();

  useEffect(() => {
    const init = async () => {
      try {
        const data = await verifyToken(); // Ensure user is verified
        setUser(data);
      } catch (e) {
        console.log("Error verifying token or fetching user:", e);
        navigate("/login");
      }
    };
    init();
  }, []);

  useEffect(() => {
    const fetchRolePermissions = async () => {
      try {
        const response = await fetch(`${baseUrl}/roles/${user.role}`, {
          method: "GET",
          credentials: "include",
        });
        const data = await response.json();
        setRoleData(data);
      } catch (e) {
        console.log("Error fetching role permissions:", e);
      }
    };

    fetchRolePermissions();
  }, [user]);

  // Fetch roles from API
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch(`${baseUrl}/roles`, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setRoles(data);
        } else {
          console.error("Failed to fetch roles:", response.statusText);
        }
      } catch (e) {
        console.error("Error fetching roles:", e);
      }
    };

    fetchRoles();
  }, [baseUrl]);

  // Fetch clients for client permissions
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch(`${baseUrl}/clients`, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setClients(data);
        } else {
          console.error("Failed to fetch clients:", response.statusText);
        }
      } catch (e) {
        console.error("Error fetching clients:", e);
      }
    };

    fetchClients();
  }, [baseUrl]);

  // Handle role deletion
  const handleConfirmDelete = async (id) => {
    try {
      const response = await fetch(`${baseUrl}/roles/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        setRoles(roles.filter((role) => role._id !== id));
        setShowDeleteModal(false);
        showToast("Rol eliminado correctamente", "success");
      } else {
        console.error("Failed to delete role:", response.statusText);
        showToast("Error al eliminar el rol", "error");
      }
    } catch (e) {
      console.error("Error deleting role:", e);
      showToast("Error al eliminar el rol", "error");
    }
  };

  const handleDelete = (id) => {
    setIdToDelete(id);
    setShowDeleteModal(true);
  };
  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
  };

  // Handle new role creation
  const handleCreate = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${baseUrl}/roles`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(newRole),
        credentials: "include",
      });

      if (response.ok) {
        const createdRole = await response.json();
        setRoles([...roles, createdRole]);

        // Reset state using proper nested permission object
        const resetPermissions = {};
        Object.keys(newRole).forEach((key) => {
          if (typeof newRole[key] === "object") {
            resetPermissions[key] = {create: false, read: false, update: false, delete: false};
          }
        });

        setNewRole({name: "", ...resetPermissions});
        setShowModal(false);
        showToast("Rol creado correctamente", "success");
      } else {
        console.error("Failed to create role:", response.statusText);
        showToast("Error al crear el rol", "error");
      }
    } catch (e) {
      console.error("Error creating role:", e);
      showToast("Error al crear el rol", "error");
    }
  };

  // Handle role edit button click
  const handleEditClick = (role) => {
    setEditRole(role);
    setEditRoleData({ver_bitacoras_cerradas: true, crear_draft_transporte: false, aceptar_draft: false, plan_linea_transporte: true, plan_operador: true, plan_telefono: true, ...role});
    setIsEditing(true); // << ENABLE EDIT MODE
  };

  // Handle role update
  const handleEditSave = async (id) => {
    try {
      const response = await fetch(`${baseUrl}/roles/${id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(editRoleData),
        credentials: "include",
      });

      if (response.ok) {
        const updatedRole = await response.json();
        setRoles(roles.map((role) => (role._id === id ? updatedRole : role)));
        setEditRole(updatedRole);
        setEditRoleData({ver_bitacoras_cerradas: true, plan_linea_transporte: true, plan_operador: true, plan_telefono: true, ...updatedRole});
        setIsEditing(false);
        showToast("Rol actualizado correctamente", "success");
      } else {
        console.error("Failed to update role:", response.statusText);
        showToast("Error al actualizar el rol", "error");
      }
    } catch (e) {
      console.error("Error updating role:", e);
      showToast("Error al actualizar el rol", "error");
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditRoleData({ver_bitacoras_cerradas: true, plan_linea_transporte: true, plan_operador: true, plan_telefono: true, ...editRole});
    setIsEditing(false);
  };

  // Handle form input changes
  const handleInputChange = (e, setter) => {
    const {name, type, checked, value} = e.target;
    setter((prevState) => ({
      ...prevState,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Handle client access type change
  const handleClientAccessChange = (value, setter) => {
    setter((prevState) => ({
      ...prevState,
      client_access: value,
      allowed_clients: value === "all" ? [] : prevState.allowed_clients,
    }));
  };

  // Handle adding client to allowed list
  const handleAddAllowedClient = (clientId, clientName, setter) => {
    setter((prevState) => {
      const isAlreadyAdded = prevState.allowed_clients.some((c) => c.client_id === clientId);
      if (isAlreadyAdded) return prevState;

      return {
        ...prevState,
        allowed_clients: [
          ...prevState.allowed_clients,
          {client_id: clientId, client_name: clientName},
        ],
      };
    });
  };

  // Handle removing client from allowed list
  const handleRemoveAllowedClient = (clientId, setter) => {
    setter((prevState) => ({
      ...prevState,
      allowed_clients: prevState.allowed_clients.filter((c) => c.client_id !== clientId),
    }));
  };

  const disabledPermissions = {
    bit_detalles: {
      create: true,
      delete: true,
    },
    bit_transportes: {
      delete: true,
    },
    bit_eventos: {
      delete: true,
    },
    gps_id: {
      delete: true,
    },
    tracto: {
      delete: true,
    },
    remolque: {
      delete: true,
    },
    operador: {
      delete: true,
    },
    inactividad: {
      create: true,
      delete: true,
    },
    auditoria_bitacora: {
      create: true,
      update: true,
      delete: true,
    },
    dashboard: {
      create: true,
      update: true,
      delete: true,
    },
    dashboard_anomalias: {
      create: true,
      update: true,
      delete: true,
    },
  };

  const permissionLabels = {
    bitacoras: "Bitácoras",
    planes_embarque: "Planes de embarque",
    buscador_plan: "Buscador de planes",
    bit_detalles: "Detalles de bitácora",
    bit_transportes: "Transportes de bitácora",
    bit_eventos: "Eventos de bitácora",
    gps_id: "GPS ID",
    remolque: "Remolque",
    tracto: "Tracto",
    operador: "Operador",
    tipos_de_monitoreo: "Tipos de monitoreo",
    eventos: "Eventos",
    clientes: "Clientes",
    origenes: "Orígenes",
    destinos: "Destinos",
    lineas_transporte: "Líneas de transporte",
    operadores: "Operadores",
    usuarios: "Usuarios",
    roles: "Roles",
    integraciones: "Integraciones",
    inactividad: "Inactividad",
    auditoria_bitacora: "Auditoría bitácora",
    dashboard: "Dashboard",
    dashboard_anomalias: "Dashboard anomalías",
    reporte_eventos: "Reporte eventos",
    reporte_estadisticas: "Reporte de puntualidad",
    reporte_control_patios: "Control de Patios",
    control_patios: "Control de patios — Tractos",
    control_patios_remolques: "Control de patios — Remolques",
  };

  const renderPermissionRow = (key, roleData, setRoleData) => {
    const actions =
      key === "bitacoras"
        ? ["create", "read", "update", "delete", "read_all"]
        : ["create", "read", "update", "delete"];

    return (
      <tr key={key}>
        <td>{permissionLabels[key] || key.replace(/_/g, " ")}</td>
        {actions.map((action) => {
          const isDisabled = disabledPermissions[key]?.[action];

          return (
            <td className="text-center" key={action}>
              {isDisabled ? (
                <span className="text-muted">N/A</span>
              ) : (
                <input
                  type="checkbox"
                  checked={roleData[key]?.[action] || false}
                  disabled={!isEditing}
                  onChange={(e) =>
                    setRoleData((prev) => ({
                      ...prev,
                      [key]: {
                        ...prev[key],
                        [action]: e.target.checked,
                      },
                    }))
                  }
                />
              )}
            </td>
          );
        })}
        {key !== "bitacoras" && (
          <td className="text-center">
            <span className="text-muted">—</span>
          </td>
        )}
      </tr>
    );
  };

  return (
    <section id="rolePage" className="settings-page">
      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Sistema - Roles"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
          >
            {roleData?.roles?.create && (
              <button className="new-btn" onClick={() => setShowModal(true)}>
                <i className="fas fa-plus"></i>Crear
              </button>
            )}
          </PageHeader>

          {/* Role Cards */}
          {roleData?.roles?.read && (
            <div className="settings-content">
              <div className="mb-3 d-flex align-items-end gap-2">
                <div className="flex-grow-1">
                  <label htmlFor="roleSelect" className="form-label fw-bold">
                    Seleccionar Rol
                  </label>
                  <select
                    id="roleSelect"
                    className="form-select"
                    value={editRole?._id || ""}
                    onChange={(e) => {
                      const selected = roles.find((r) => r._id === e.target.value);
                      setEditRole(selected || null);
                      setEditRoleData({ver_bitacoras_cerradas: true, plan_linea_transporte: true, plan_operador: true, plan_telefono: true, ...JSON.parse(JSON.stringify(selected))});
                    }}>
                    <option value="">-- Seleccione un rol --</option>
                    {roles.map((role) => (
                      <option key={role._id} value={role._id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <>
                  {roleData?.roles?.update &&
                    (isEditing ? (
                      <button
                        className="btn btn-secondary"
                        title="Cancelar"
                        onClick={handleCancelEdit}>
                        <i className="fa fa-times"></i>
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        title="Editar"
                        onClick={() => handleEditClick(editRole)}>
                        <i className="fa fa-edit"></i>
                      </button>
                    ))}

                  {isEditing ? (
                    <button
                      className="btn btn-success"
                      title="Guardar"
                      onClick={() => handleEditSave(editRole._id)}>
                      <i className="fa fa-save"></i>
                    </button>
                  ) : (
                    roleData?.roles?.delete && (
                      <button
                        className="btn btn-danger"
                        title="Eliminar"
                        onClick={() => handleDelete(editRole._id)}>
                        <i className="fa fa-trash"></i>
                      </button>
                    )
                  )}
                </>
              </div>

              {editRole && (
                <>
                  <div className="table-wrapper" style={{minHeight: "60vh", maxHeight: "80vh", overflowY: "auto"}}>
                    <div className="table-responsive">
                      <table className="table">
                        <thead
                          className="table-light"
                          style={{
                            position: "sticky",
                            top: 0,
                            zIndex: 1,
                            backgroundColor: "#f8f9fa",
                          }}>
                          <tr>
                            <th>Módulo</th>
                            <th className="text-center">Crear</th>
                            <th className="text-center">Ver</th>
                            <th className="text-center">Editar</th>
                            <th className="text-center">Eliminar</th>
                            <th className="text-center">Ver Todo</th>
                          </tr>
                        </thead>

                        <tbody>
                          {/* PANEL 1: Monitoreo */}
                          <tr className="table-group-divider fw-bold bg-secondary text-white">
                            <td colSpan="6">Monitoreo</td>
                          </tr>
                          {["bitacoras", "planes_embarque", "buscador_plan", "control_patios", "control_patios_remolques"].map((key) =>
                            renderPermissionRow(key, editRoleData, setEditRoleData)
                          )}
                          <tr className="table-group-divider fw-bold bg-secondary text-white">
                            <td colSpan="6">Monitoreo &gt; Bitácoras &gt; Datos Bitácora</td>
                          </tr>
                          {["bit_detalles", "bit_transportes", "bit_eventos"].map((key) =>
                            renderPermissionRow(key, editRoleData, setEditRoleData)
                          )}

                          <tr className="table-group-divider fw-bold bg-secondary text-white">
                            <td colSpan="6">
                              Monitoreo &gt; Bitácoras &gt; Datos Bitácora &gt; Datos Transportes
                            </td>
                          </tr>
                          {["gps_id", "remolque", "tracto", "operador"].map((key) =>
                            renderPermissionRow(key, editRoleData, setEditRoleData)
                          )}

                          {/* PANEL 2: Configuración > Catálogos */}
                          <tr className="table-group-divider fw-bold bg-secondary text-white">
                            <td colSpan="6">Configuración &gt; Catálogos</td>
                          </tr>
                          {[
                            "tipos_de_monitoreo",
                            "eventos",
                            "clientes",
                            "origenes",
                            "destinos",
                            "lineas_transporte",
                            "operadores",
                          ].map((key) => renderPermissionRow(key, editRoleData, setEditRoleData))}

                          {/* PANEL 2: Configuración > Sistema */}
                          <tr className="fw-bold bg-secondary text-white">
                            <td colSpan="6">Configuración &gt; Sistema</td>
                          </tr>
                          {["usuarios", "roles", "integraciones", "inactividad"].map((key) =>
                            renderPermissionRow(key, editRoleData, setEditRoleData)
                          )}

                          {/* PANEL 3: Auditoría */}
                          <tr className="table-group-divider fw-bold bg-secondary text-white">
                            <td colSpan="6">Auditoría</td>
                          </tr>
                          {["auditoria_bitacora"].map((key) =>
                            renderPermissionRow(key, editRoleData, setEditRoleData)
                          )}

                          {/* PANEL 4: Dashboard */}
                          <tr className="table-group-divider fw-bold bg-secondary text-white">
                            <td colSpan="6">Dashboard</td>
                          </tr>
                          {["dashboard", "dashboard_anomalias", "reporte_eventos", "reporte_estadisticas", "reporte_control_patios"].map((key) =>
                            renderPermissionRow(key, editRoleData, setEditRoleData)
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Sección de Permisos adicionales */}
                    <div className="mt-3 pt-3 border-top">
                      <h6 className="mb-2 text-secondary">Permisos adicionales</h6>
                      <div className="bg-light p-3 rounded">
                        {[
                          { key: "ver_bitacoras_cerradas", label: "Ver bitácoras cerradas", defaultVal: true },
                          { key: "crear_draft_transporte", label: "Crear borrador de transporte (línea / operador)", defaultVal: false },
                          { key: "aceptar_draft", label: "Aceptar / rechazar borradores de transporte", defaultVal: false },
                        ].map(({ key, label, defaultVal }) => (
                          <div className="d-flex align-items-center mb-2" key={key}>
                            <input
                              type="checkbox"
                              id={key}
                              className="form-check-input me-2"
                              checked={editRoleData[key] ?? defaultVal}
                              disabled={!isEditing}
                              onChange={(e) =>
                                setEditRoleData((prev) => ({ ...prev, [key]: e.target.checked }))
                              }
                            />
                            <label htmlFor={key} className="form-check-label fw-semibold">
                              {label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sección de Planes de embarque — campos visibles */}
                    <div className="mt-3 pt-3 border-top">
                      <h6 className="mb-2 text-secondary">Planes de embarque — campos del transporte</h6>
                      <div className="bg-light p-3 rounded">
                        {[
                          { key: "plan_linea_transporte", label: "Mostrar campo Línea de Transporte" },
                          { key: "plan_operador",         label: "Mostrar campo Operador" },
                          { key: "plan_telefono",         label: "Mostrar campo Teléfono" },
                        ].map(({ key, label }) => (
                          <div className="d-flex align-items-center mb-2" key={key}>
                            <input
                              type="checkbox"
                              id={key}
                              className="form-check-input me-2"
                              checked={editRoleData[key] ?? true}
                              disabled={!isEditing}
                              onChange={(e) =>
                                setEditRoleData((prev) => ({ ...prev, [key]: e.target.checked }))
                              }
                            />
                            <label htmlFor={key} className="form-check-label fw-semibold">
                              {label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sección de Permisos de Clientes */}
                    <div className="mt-3 pt-3 border-top">
                      <h6 className="mb-2 text-secondary">Permisos de Acceso a Clientes</h6>

                      <div className="bg-light p-3 rounded">
                        {/* Tipo de acceso - inline radio buttons */}
                        <div className="d-flex align-items-center mb-2">
                          <span className="fw-semibold me-3" style={{minWidth: "120px"}}>
                            Tipo de Acceso:
                          </span>
                          <div className="form-check form-check-inline me-3">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="client_access"
                              id="access_all"
                              value="all"
                              checked={editRoleData.client_access === "all"}
                              disabled={!isEditing}
                              onChange={(e) =>
                                handleClientAccessChange(e.target.value, setEditRoleData)
                              }
                            />
                            <label className="form-check-label" htmlFor="access_all">
                              Todos los clientes
                            </label>
                          </div>
                          <div className="form-check form-check-inline">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="client_access"
                              id="access_specific"
                              value="specific"
                              checked={editRoleData.client_access === "specific"}
                              disabled={!isEditing}
                              onChange={(e) =>
                                handleClientAccessChange(e.target.value, setEditRoleData)
                              }
                            />
                            <label className="form-check-label" htmlFor="access_specific">
                              Clientes específicos
                            </label>
                          </div>
                        </div>

                        {/* Sección de clientes específicos */}
                        {editRoleData.client_access === "specific" && (
                          <>
                            {/* Selector de clientes */}
                            {isEditing && (
                              <div className="d-flex align-items-center mb-2">
                                <span className="fw-semibold me-3" style={{minWidth: "120px"}}>
                                  Agregar Cliente:
                                </span>
                                <select
                                  className="form-select form-select-sm"
                                  style={{maxWidth: "300px"}}
                                  onChange={(e) => {
                                    const clientId = e.target.value;
                                    const clientName =
                                      e.target.options[e.target.selectedIndex].text;
                                    if (clientId) {
                                      handleAddAllowedClient(clientId, clientName, setEditRoleData);
                                      e.target.value = "";
                                    }
                                  }}>
                                  <option value="">-- Seleccionar Cliente --</option>
                                  {clients
                                    .filter(
                                      (client) =>
                                        !editRoleData.allowed_clients?.some(
                                          (ac) => ac.client_id === client._id
                                        )
                                    )
                                    .map((client) => (
                                      <option key={client._id} value={client._id}>
                                        {client.razon_social || client.name}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            )}

                            {/* Lista de clientes permitidos */}
                            <div className="d-flex align-items-start">
                              <span
                                className="fw-semibold me-3"
                                style={{minWidth: "120px", paddingTop: "2px"}}>
                                Clientes Permitidos:
                              </span>
                              <div className="flex-grow-1">
                                {editRoleData.allowed_clients?.length > 0 ? (
                                  <div className="d-flex flex-wrap gap-1">
                                    {editRoleData.allowed_clients.map((allowedClient) => (
                                      <span
                                        key={allowedClient.client_id}
                                        className="badge bg-primary d-flex align-items-center gap-1"
                                        style={{fontSize: "11px", padding: "4px 8px"}}>
                                        {allowedClient.client_name}
                                        {isEditing && (
                                          <button
                                            type="button"
                                            className="btn-close btn-close-white"
                                            style={{fontSize: "8px", width: "8px", height: "8px"}}
                                            onClick={() =>
                                              handleRemoveAllowedClient(
                                                allowedClient.client_id,
                                                setEditRoleData
                                              )
                                            }
                                            aria-label="Remover"></button>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted fst-italic small">
                                    No hay clientes seleccionados
                                  </span>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Modal for Creating New Role */}
      {showModal && (
        <ModalTemplate
          show={showModal}
          title="Crear Rol"
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}>
          <div className="mb-3">
            <label htmlFor="roleName" className="form-label">
              Nombre
            </label>
            <input
              type="text"
              id="roleName"
              name="name"
              className="form-control"
              value={newRole.name}
              onChange={(e) => handleInputChange(e, setNewRole)}
              placeholder="Nombre del rol"
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label fw-bold">Permisos</label>
            <div className="table-responsive" style={{maxHeight: "300px", overflowY: "auto"}}>
              <table className="table table-bordered table-sm">
                <thead className="table-light sticky-top bg-light">
                  <tr>
                    <th>Módulo</th>
                    <th className="text-center">Crear</th>
                    <th className="text-center">Ver</th>
                    <th className="text-center">Editar</th>
                    <th className="text-center">Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(newRole)
                    .filter(([, val]) => typeof val === "object" && "create" in val)
                    .map(([key]) => (
                      <tr key={key}>
                        <td>{permissionLabels[key] || key.replace(/_/g, " ")}</td>
                        {["create", "read", "update", "delete"].map((action) => (
                          <td className="text-center" key={action}>
                            <input
                              type="checkbox"
                              checked={newRole[key][action]}
                              onChange={(e) =>
                                setNewRole((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...prev[key],
                                    [action]: e.target.checked,
                                  },
                                }))
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </ModalTemplate>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <ModalTemplate
          show={showDeleteModal}
          title="Confirmar Eliminación"
          onClose={handleCloseDeleteModal}
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirmDelete(idToDelete);
          }}>
          <p>¿Está seguro de que desea eliminar este rol?</p>
        </ModalTemplate>
      )}

      <Toast toasts={toasts} removeToast={removeToast} />
    </section>
  );
};

export default RolePage;
