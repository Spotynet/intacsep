import {useState, useEffect} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import ModalTemplate from "../ModalTemplate";
import Toast from "../Toast";
import {useToast} from "../../hooks/useToast";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";
import {useNavigate} from "react-router-dom";
import {Select} from "../Select";

// ── Constants ────────────────────────────────────────────────────────────────

const emptyPerms = {
  bitacoras:               {create: false, read: false, read_all: false, update: false, delete: false},
  eventos:                 {create: false, read: false, update: false, delete: false},
  clientes:                {create: false, read: false, update: false, delete: false},
  usuarios:                {create: false, read: false, update: false, delete: false},
  roles:                   {create: false, read: false, update: false, delete: false},
  origenes:                {create: false, read: false, update: false, delete: false},
  destinos:                {create: false, read: false, update: false, delete: false},
  operadores:              {create: false, read: false, update: false, delete: false},
  lineas_transporte:       {create: false, read: false, update: false, delete: false},
  tipos_de_monitoreo:      {create: false, read: false, update: false, delete: false},
  integraciones:           {create: false, read: false, update: false, delete: false},
  inactividad:             {create: false, read: false, update: false, delete: false},
  bitacora_abierta:        {create: false, read: false, update: false, delete: false},
  bitacora_cerrada:        {create: false, read: false, update: false, delete: false},
  bit_detalles:            {create: false, read: false, update: false, delete: false},
  bit_eventos:             {create: false, read: false, update: false, delete: false},
  bit_transportes:         {create: false, read: false, update: false, delete: false},
  auditoria_bitacora:      {create: false, read: false, update: false, delete: false},
  dashboard:               {create: false, read: false, update: false, delete: false},
  dashboard_anomalias:     {create: false, read: false, update: false, delete: false},
  gps_id:                  {create: false, read: false, update: false, delete: false},
  tracto:                  {create: false, read: false, update: false, delete: false},
  remolque:                {create: false, read: false, update: false, delete: false},
  operador:                {create: false, read: false, update: false, delete: false},
  planes_embarque:         {create: false, read: false, update: false, delete: false},
  buscador_plan:           {create: false, read: false, update: false, delete: false},
  reporte_eventos:         {create: false, read: false, update: false, delete: false},
  reporte_estadisticas:    {create: false, read: false, update: false, delete: false},
  reporte_control_patios:  {create: false, read: false, update: false, delete: false},
  control_patios:          {create: false, read: false, update: false, delete: false},
  control_patios_remolques:{create: false, read: false, update: false, delete: false},
  eventos_wialon:         {create: false, read: false, update: false, delete: false},
  map_wialon:             {create: false, read: false, update: false, delete: false},
};

const emptyFlags = {
  client_access: "all",
  allowed_clients: [],
  ver_bitacoras_cerradas: true,
  crear_draft_transporte: false,
  aceptar_draft: false,
  plan_linea_transporte: true,
  plan_operador: true,
  plan_telefono: true,
};

const defaultRole = {name: "", ...emptyPerms, ...emptyFlags};

const permLabels = {
  bitacoras:               "Bitácoras",
  planes_embarque:         "Planes de embarque",
  buscador_plan:           "Buscador de planes",
  control_patios:          "Control de patios — Tractos",
  control_patios_remolques:"Control de patios — Remolques",
  bit_detalles:            "Detalles de bitácora",
  bit_transportes:         "Transportes de bitácora",
  bit_eventos:             "Eventos de bitácora",
  gps_id:                  "GPS ID",
  remolque:                "Remolque",
  tracto:                  "Tracto",
  operador:                "Operador",
  tipos_de_monitoreo:      "Tipos de monitoreo",
  eventos:                 "Eventos",
  clientes:                "Clientes",
  origenes:                "Orígenes",
  destinos:                "Destinos",
  lineas_transporte:       "Líneas de transporte",
  operadores:              "Operadores",
  usuarios:                "Usuarios",
  roles:                   "Roles",
  integraciones:           "Integraciones",
  inactividad:             "Inactividad",
  auditoria_bitacora:      "Auditoría bitácora",
  dashboard:               "Dashboard",
  dashboard_anomalias:     "Dashboard anomalías",
  reporte_eventos:         "Reporte eventos",
  reporte_estadisticas:    "Reporte de puntualidad",
  reporte_control_patios:  "Control de patios",
  eventos_wialon:          "Alertas Wialon",
  map_wialon:              "Mapa Wialon",
};

const disabledPerms = {
  bit_detalles:       {create: true, delete: true},
  bit_transportes:    {delete: true},
  bit_eventos:        {delete: true},
  gps_id:             {delete: true},
  tracto:             {delete: true},
  remolque:           {delete: true},
  operador:           {delete: true},
  inactividad:        {create: true, delete: true},
  auditoria_bitacora: {create: true, update: true, delete: true},
  dashboard:          {create: true, update: true, delete: true},
  dashboard_anomalias:{create: true, update: true, delete: true},
  eventos_wialon:    {create: true, update: true, delete: true},
  map_wialon:        {create: true, update: true, delete: true},
};

const permSections = [
  {label: "Monitoreo",                        keys: ["bitacoras","planes_embarque","buscador_plan","control_patios","control_patios_remolques","eventos_wialon","map_wialon"]},
  {label: "Bitácoras — Datos",                keys: ["bit_detalles","bit_transportes","bit_eventos"]},
  {label: "Bitácoras — Datos de transporte",  keys: ["gps_id","remolque","tracto","operador"]},
  {label: "Catálogos",                        keys: ["tipos_de_monitoreo","eventos","clientes","origenes","destinos","lineas_transporte","operadores"]},
  {label: "Sistema",                          keys: ["usuarios","roles","integraciones","inactividad"]},
  {label: "Auditoría",                        keys: ["auditoria_bitacora"]},
  {label: "Dashboard & Reportes",             keys: ["dashboard","dashboard_anomalias","reporte_eventos","reporte_estadisticas","reporte_control_patios"]},
  {label: "Configuración adicional", flags: [
    {key: "ver_bitacoras_cerradas",   label: "Ver bitácoras cerradas",              def: true},
    {key: "crear_draft_transporte",   label: "Crear borrador de transporte",         def: false},
    {key: "aceptar_draft",            label: "Aceptar / rechazar borradores",        def: false},
    {key: "plan_linea_transporte",    label: "Planes — mostrar línea de transporte", def: true},
    {key: "plan_operador",            label: "Planes — mostrar operador",            def: true},
    {key: "plan_telefono",            label: "Planes — mostrar teléfono",            def: true},
  ]},
];

// ── Sub-components ────────────────────────────────────────────────────────────

const RpCheck = ({checked, disabled, onChange, na = false}) =>
  na ? (
    <span className="rp-check-na">—</span>
  ) : (
    <input
      type="checkbox"
      className="rp-check"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
    />
  );

const PermRow = ({permKey, data, setData, disabled}) => {
  const isBitacoras = permKey === "bitacoras";
  const cols = ["create", "read", "update", "delete"];

  return (
    <tr className="rp-perm-row">
      <td className="rp-perm-label">{permLabels[permKey] || permKey.replace(/_/g, " ")}</td>
      {cols.map((action) => (
        <td key={action} className="rp-perm-cell">
          <RpCheck
            na={!!disabledPerms[permKey]?.[action]}
            checked={data[permKey]?.[action] || false}
            disabled={disabled}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                [permKey]: {...prev[permKey], [action]: e.target.checked},
              }))
            }
          />
        </td>
      ))}
      <td className="rp-perm-cell">
        {isBitacoras ? (
          <RpCheck
            checked={data.bitacoras?.read_all || false}
            disabled={disabled}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                bitacoras: {...prev.bitacoras, read_all: e.target.checked},
              }))
            }
          />
        ) : (
          <span className="rp-check-na">—</span>
        )}
      </td>
    </tr>
  );
};

const SectionRow = ({label}) => (
  <tr className="rp-section-row">
    <td colSpan={6}>{label}</td>
  </tr>
);

const BoolRow = ({flagKey, label, def, data, setData, disabled}) => (
  <tr className="rp-perm-row">
    <td className="rp-perm-label">{label}</td>
    <td className="rp-perm-cell">
      <RpCheck
        checked={data[flagKey] ?? def}
        disabled={disabled}
        onChange={(e) => setData((prev) => ({...prev, [flagKey]: e.target.checked}))}
      />
    </td>
    <td className="rp-perm-cell"><span className="rp-check-na">—</span></td>
    <td className="rp-perm-cell"><span className="rp-check-na">—</span></td>
    <td className="rp-perm-cell"><span className="rp-check-na">—</span></td>
    <td className="rp-perm-cell"><span className="rp-check-na">—</span></td>
  </tr>
);

const PermTable = ({data, setData, editMode}) => (
  <table className="rp-table">
    <thead>
      <tr>
        <th className="rp-th-module">Módulo</th>
        <th className="rp-th-action">Crear</th>
        <th className="rp-th-action">Ver</th>
        <th className="rp-th-action">Editar</th>
        <th className="rp-th-action">Eliminar</th>
        <th className="rp-th-action">Ver todo</th>
      </tr>
    </thead>
    <tbody>
      {permSections.map(({label, keys, flags}) => (
        <>
          <SectionRow key={`s-${label}`} label={label} />
          {flags
            ? flags.map(({key, label: fl, def}) => (
                <BoolRow key={key} flagKey={key} label={fl} def={def} data={data} setData={setData} disabled={!editMode} />
              ))
            : keys.map((k) => (
            <PermRow key={k} permKey={k} data={data} setData={setData} disabled={!editMode} />
          ))}
        </>
      ))}
    </tbody>
  </table>
);

;

// ── Main component ────────────────────────────────────────────────────────────

const RolePage = () => {
  const [roles, setRoles]         = useState([]);
  const [clients, setClients]     = useState([]);
  const [editRole, setEditRole]   = useState(null);
  const [editRoleData, setEditRoleData] = useState(defaultRole);
  const [isEditing, setIsEditing] = useState(false);
  const [showCreate, setShowCreate]   = useState(false);
  const [newRole, setNewRole]     = useState(defaultRole);
  const [showDelete, setShowDelete]   = useState(false);
  const [idToDelete, setIdToDelete]   = useState("");

  const baseUrl = import.meta.env.VITE_BASE_URL;
  const {user, verifyToken, setUser} = useAuth();
  const [roleData, setRoleData] = useState(() => {
    try { const s = localStorage.getItem("sidebar-role"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const navigate = useNavigate();
  const {toasts, showToast, removeToast} = useToast();

  useEffect(() => {
    verifyToken().then(setUser).catch(() => navigate("/login"));
  }, []);

  useEffect(() => {
    if (!user?.role) return;
    fetch(`${baseUrl}/roles/${user.role}`, {credentials: "include"})
      .then((r) => r.json()).then(setRoleData).catch(() => {});
  }, [user]);

  useEffect(() => {
    fetch(`${baseUrl}/roles`, {credentials: "include"})
      .then((r) => r.ok ? r.json() : []).then(setRoles).catch(() => {});
    fetch(`${baseUrl}/clients`, {credentials: "include"})
      .then((r) => r.ok ? r.json() : []).then(setClients).catch(() => {});
  }, [baseUrl]);

  const selectRole = (role) => {
    setIsEditing(false);
    setEditRole(role);
    setEditRoleData({...defaultRole, ...role});
  };

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditRoleData({...defaultRole, ...editRole});
    setIsEditing(false);
  };

  const handleEditSave = async () => {
    try {
      const res = await fetch(`${baseUrl}/roles/${editRole._id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(editRoleData),
        credentials: "include",
      });
      if (res.ok) {
        const updated = await res.json();
        setRoles((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
        setEditRole(updated);
        setEditRoleData({...defaultRole, ...updated});
        setIsEditing(false);
        // Sync sidebar cache if editing own role
        if (user?.role === updated.name) {
          try { localStorage.setItem("sidebar-role", JSON.stringify(updated)); } catch {}
        }
        showToast("Rol actualizado correctamente", "success");
      } else {
        showToast("Error al actualizar el rol", "error");
      }
    } catch {
      showToast("Error al actualizar el rol", "error");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${baseUrl}/roles`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(newRole),
        credentials: "include",
      });
      if (res.ok) {
        const created = await res.json();
        setRoles((prev) => [...prev, created]);
        setNewRole(defaultRole);
        setShowCreate(false);
        showToast("Rol creado correctamente", "success");
        selectRole(created);
      } else {
        showToast("Error al crear el rol", "error");
      }
    } catch {
      showToast("Error al crear el rol", "error");
    }
  };

  const handleConfirmDelete = async () => {
    try {
      const res = await fetch(`${baseUrl}/roles/${idToDelete}`, {method: "DELETE", credentials: "include"});
      if (res.ok) {
        setRoles((prev) => prev.filter((r) => r._id !== idToDelete));
        setShowDelete(false);
        if (editRole?._id === idToDelete) { setEditRole(null); setIsEditing(false); }
        showToast("Rol eliminado correctamente", "success");
      } else {
        showToast("Error al eliminar el rol", "error");
      }
    } catch {
      showToast("Error al eliminar el rol", "error");
    }
  };

  const addAllowedClient = (clientId, clientName, setter) =>
    setter((prev) => ({
      ...prev,
      allowed_clients: prev.allowed_clients.some((c) => c.client_id === clientId)
        ? prev.allowed_clients
        : [...prev.allowed_clients, {client_id: clientId, client_name: clientName}],
    }));

  const removeAllowedClient = (clientId, setter) =>
    setter((prev) => ({
      ...prev,
      allowed_clients: prev.allowed_clients.filter((c) => c.client_id !== clientId),
    }));

  // ── Extras panel ────────────────────────────────────────────────────────────

  const ExtrasPanel = ({data, setData, editMode}) => {
    return (
      <div className="rp-extras">
        <div className="rp-access-row">
          <p className="rp-extras__col-title">Acceso a clientes</p>

          <div className="rp-access-select-wrap">
            <Select
              clearable={false}
              searchable={false}
              direction="up"
              disabled={!editMode}
              value={data.client_access}
              options={[
                {value: "all",      label: "Todos los clientes"},
                {value: "specific", label: "Clientes específicos"},
              ]}
              onChange={(val) =>
                setData((prev) => ({
                  ...prev,
                  client_access: val,
                  allowed_clients: val === "all" ? [] : prev.allowed_clients,
                }))
              }
            />
          </div>

          {data.client_access === "specific" && (
            <div className="rp-access-chips">
              {editMode && (
                <div className="rp-access-select">
                  <Select
                    placeholder="Agregar cliente…"
                    value={null}
                    clearable={false}
                    direction="up"
                    options={clients
                      .filter((c) => !data.allowed_clients?.some((a) => a.client_id === c._id))
                      .map((c) => ({value: c._id, label: c.razon_social || c.name}))}
                    onChange={(id) => {
                      const c = clients.find((x) => x._id === id);
                      if (c) addAllowedClient(c._id, c.razon_social || c.name, setData);
                    }}
                  />
                </div>
              )}
              {data.allowed_clients?.length > 0 ? data.allowed_clients.map((ac) => (
                <span key={ac.client_id} className="rp-client-chip">
                  {ac.client_name}
                  {editMode && (
                    <button type="button" className="rp-client-chip__remove"
                      onClick={() => removeAllowedClient(ac.client_id, setData)}>
                      <i className="fa fa-times"></i>
                    </button>
                  )}
                </span>
              )) : (
                <span className="rp-client-empty">Sin clientes seleccionados</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <section id="rolePage" className="settings-page">
      <div className="w-100 d-flex h-100 mt-0">
        <div className="sidebar-wrapper"><Sidebar /></div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader title="Sistema - Roles" onToggleSidebar={() => setIsMobileSidebarOpen(true)}>
            {roleData?.roles?.create && (
              <button className="new-btn" onClick={() => { setNewRole(defaultRole); setShowCreate(true); }}>
                <i className="fa fa-plus"></i>Crear
              </button>
            )}
          </PageHeader>

          <div className="rp-shell">
            {/* ── Left: role list ── */}
            <nav className="rp-nav">
              {roles.length === 0 ? (
                <p className="rp-nav-empty">Sin roles</p>
              ) : (
                roles.map((role) => (
                  <button
                    key={role._id}
                    className={`rp-nav-item${editRole?._id === role._id ? " rp-nav-item--active" : ""}`}
                    onClick={() => selectRole(role)}>
                    {role.name}
                  </button>
                ))
              )}
            </nav>

            {/* ── Right: editor ── */}
            <div className="rp-editor">
              {editRole ? (
                <>
                  {/* Editor header */}
                  <div className="rp-editor__header">
                    <div className="rp-editor__title-block">
                      <span className="rp-editor__title">{editRole.name}</span>
                      {isEditing && <span className="rp-editor__editing-badge">Editando</span>}
                    </div>
                    <div className="rp-editor__actions">
                      {isEditing ? (
                        <>
                          <button className="rp-btn rp-btn--ghost" onClick={handleCancelEdit}>
                            <i className="fa fa-times"></i> Cancelar
                          </button>
                          <button className="rp-btn rp-btn--save" onClick={handleEditSave}>
                            <i className="fa fa-check"></i> Guardar
                          </button>
                        </>
                      ) : (
                        <>
                          {roleData?.roles?.update && (
                            <button className="action-btn btn-primary" title="Editar" onClick={handleEditClick}>
                              <i className="fa fa-edit"></i>
                            </button>
                          )}
                          {roleData?.roles?.delete && (
                            <button className="action-btn btn-danger" title="Eliminar" onClick={() => { setIdToDelete(editRole._id); setShowDelete(true); }}>
                              <i className="fa fa-trash"></i>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Scrollable table */}
                  <div className="rp-editor__content">
                    <PermTable data={editRoleData} setData={setEditRoleData} editMode={isEditing} />
                  </div>

                  {/* Fixed extras below */}
                  <div className="rp-editor__extras">
                    <ExtrasPanel data={editRoleData} setData={setEditRoleData} editMode={isEditing} />
                  </div>
                </>
              ) : (
                <div className="rp-empty">
                  <i className="fa fa-shield-alt"></i>
                  <p>Selecciona un rol para ver y editar sus permisos</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Create modal ── */}
      {showCreate && (
        <ModalTemplate show title="Nuevo Rol" onClose={() => setShowCreate(false)} onSubmit={handleCreate}>
          <div className="rp-create-modal">
            <div>
              <span className="pselect__label">Nombre del rol<span className="text-danger ms-1">*</span></span>
              <div className="pdt-field">
                <i className="fa fa-tag pdt-field__icon"></i>
                <input className="pdt-field__input" type="text" placeholder="Ej: Monitorista, Supervisor…"
                  value={newRole.name} onChange={(e) => setNewRole((p) => ({...p, name: e.target.value}))} required />
              </div>
            </div>
            <p className="rp-create-hint">Los permisos se configuran después de crear el rol.</p>
          </div>
        </ModalTemplate>
      )}

      {/* ── Delete modal ── */}
      {showDelete && (
        <ModalTemplate show title="Eliminar Rol"
          onClose={() => setShowDelete(false)}
          onSubmit={(e) => { e.preventDefault(); handleConfirmDelete(); }}
          submitText="Eliminar" submitClass="btn btn-danger">
          <p>¿Confirmas que deseas eliminar el rol <strong>{editRole?.name}</strong>? Esta acción no se puede deshacer.</p>
        </ModalTemplate>
      )}

      <Toast toasts={toasts} removeToast={removeToast} />
    </section>
  );
};

export default RolePage;
