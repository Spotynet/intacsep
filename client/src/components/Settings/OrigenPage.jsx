import {useState, useEffect, useMemo} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import ModalTemplate from "../ModalTemplate";
import DataTable from "../DataTable";
import FilterBar from "../FilterBar";
import {Select} from "../Select";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";
import {convertToUpperCase} from "../../utils/utils";

const estados = [
  {clave: "01", nombre: "AGUASCALIENTES"},
  {clave: "02", nombre: "BAJA CALIFORNIA"},
  {clave: "03", nombre: "BAJA CALIFORNIA SUR"},
  {clave: "04", nombre: "CAMPECHE"},
  {clave: "05", nombre: "CDMX"},
  {clave: "06", nombre: "COAHUILA DE ZARAGOZA"},
  {clave: "07", nombre: "COLIMA"},
  {clave: "08", nombre: "CHIAPAS"},
  {clave: "09", nombre: "CHIHUAHUA"},
  {clave: "10", nombre: "DURANGO"},
  {clave: "11", nombre: "EDO. MÉXICO"},
  {clave: "12", nombre: "GUANAJUATO"},
  {clave: "13", nombre: "GUERRERO"},
  {clave: "14", nombre: "HIDALGO"},
  {clave: "15", nombre: "JALISCO"},
  {clave: "16", nombre: "MICHOACÁN DE OCAMPO"},
  {clave: "17", nombre: "MORELOS"},
  {clave: "18", nombre: "NAYARIT"},
  {clave: "19", nombre: "NUEVO LEÓN"},
  {clave: "20", nombre: "OAXACA"},
  {clave: "21", nombre: "PUEBLA"},
  {clave: "22", nombre: "QUERÉTARO"},
  {clave: "23", nombre: "QUINTANA ROO"},
  {clave: "24", nombre: "SAN LUIS POTOSÍ"},
  {clave: "25", nombre: "SINALOA"},
  {clave: "26", nombre: "SONORA"},
  {clave: "27", nombre: "TABASCO"},
  {clave: "28", nombre: "TAMAULIPAS"},
  {clave: "29", nombre: "TLAXCALA"},
  {clave: "30", nombre: "VERACRUZ DE IGNACIO DE LA LLAVE"},
  {clave: "31", nombre: "YUCATÁN"},
  {clave: "32", nombre: "ZACATECAS"},
];

const OrigenPage = () => {
  const [origenes, setOrigenes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [formData, setFormData] = useState({estado: "", municipio: "", nombre: ""});
  const [currentOrigen, setCurrentOrigen] = useState(null);
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [idToDelete, setIdToDelete] = useState("");
  const [modalType, setModalType] = useState("");

  // Filter state
  const [filters, setFilters] = useState({nombre: "", estado: "", cliente: ""});

  const {user, verifyToken, setUser} = useAuth();
  const [roleData, setRoleData] = useState(() => {
    try { const s = localStorage.getItem("sidebar-role"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();

  useEffect(() => {
    const init = async () => {
      try {
        const data = await verifyToken();
        setUser(data);
      } catch (e) {
        console.log("Error verifying token or fetching user:", e);
        window.location.href = "/login";
      }
    };
    init();
  }, []);

  useEffect(() => {
    const fetchRolePermissions = async () => {
      try {
        const response = await fetch(`${baseUrl}/roles/${user.role}`, {method: "GET", credentials: "include"});
        const data = await response.json();
        setRoleData(data);
      } catch (e) {
        console.log("Error fetching role permissions:", e);
      }
    };
    fetchRolePermissions();
  }, [user]);

  useEffect(() => {
    const fetchOrigenes = async () => {
      try {
        const response = await fetch(`${baseUrl}/origenes`, {method: "GET", credentials: "include"});
        if (response.ok) { setOrigenes(await response.json()); } else { console.error("Failed to fetch", response.statusText); }
        setIsLoading(false);
      } catch (e) {
        console.error("Error fetching origenes:", e);
      }
    };
    fetchOrigenes();
  }, [baseUrl]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch(`${baseUrl}/clients`, {method: "GET", credentials: "include"});
        if (response.ok) { setClients(await response.json()); } else { console.error("Failed to fetch", response.statusText); }
        setIsLoading(false);
      } catch (e) {
        console.error("Error fetching clients:", e);
      }
    };
    fetchClients();
  }, [baseUrl]);

  // Derived filtered list — passed directly to DataTable
  const filteredOrigenes = useMemo(
    () =>
      origenes.filter(
        (o) =>
          o.nombre.toLowerCase().includes(filters.nombre.toLowerCase()) &&
          o.estado.toLowerCase().includes(filters.estado.toLowerCase()) &&
          o.cliente.toLowerCase().includes(filters.cliente.toLowerCase())
      ),
    [origenes, filters]
  );

  const handleFilterChange = (e) => {
    const {name, value} = e.target;
    setFilters((prev) => ({...prev, [name]: value}));
  };

  const clearFilters = () => setFilters({nombre: "", estado: "", cliente: ""});
  const hasActiveFilters = !!(filters.nombre || filters.estado || filters.cliente);

  const handleDelete = (id) => {setIdToDelete(id); setShowDeleteModal(true);};

  const handleConfirmDelete = async (id) => {
    try {
      const response = await fetch(`${baseUrl}/origenes/${id}`, {method: "DELETE", credentials: "include"});
      if (response.ok) {
        setOrigenes((prev) => prev.filter((o) => o._id !== id));
        setShowDeleteModal(false);
      } else {
        console.error("Failed to delete origen:", response.statusText);
      }
    } catch (e) {
      console.error("Error deleting origen:", e);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const uppercaseFormData = convertToUpperCase(formData, ["_id", "createdAt", "updatedAt"]);
      const response = await fetch(`${baseUrl}/origenes`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(uppercaseFormData),
        credentials: "include",
      });
      if (response.ok) {
        const created = await response.json();
        setOrigenes((prev) => [...prev, created]);
        setFormData({estado: "", municipio: "", nombre: ""});
        setModalType("");
      } else {
        console.error("Failed to create origen:", response.statusText);
      }
    } catch (e) {
      console.error("Error creating origen:", e);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!currentOrigen) return;
    try {
      const response = await fetch(`${baseUrl}/origenes/${currentOrigen._id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(formData),
        credentials: "include",
      });
      if (response.ok) {
        const updated = await response.json();
        setOrigenes((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
        setFormData({estado: "", municipio: "", nombre: ""});
        setCurrentOrigen(null);
        setModalType("");
      } else {
        console.error("Failed to edit origen:", response.statusText);
      }
    } catch (e) {
      console.error("Error editing origen:", e);
    }
  };

  const handleEdit = (origen) => {
    setCurrentOrigen(origen);
    setFormData({estado: origen.estado, municipio: origen.cliente, nombre: origen.nombre});
    setModalType("edit");
  };

  const handleChange = (e) => {
    const {id, value} = e.target;
    setFormData((prev) => ({...prev, [id]: value}));
  };

  const columns = [
    {
      key: "numericId",
      header: "ID", headerClassName: "text-center",
      width: "60px",
      className: "text-center fw-bold",
      render: (row) => (row.numericId ? row.numericId.toString().padStart(4, "0") : "N/A"),
    },
    {key: "nombre", header: "Nombre"},
    {key: "estado", header: "Estado"},
    {key: "cliente", header: "Cliente"},
  ];

  const actions = [
    {
      icon: "fas fa-edit",
      className: "action-btn btn-primary",
      title: "Editar",
      show: roleData?.origenes?.update,
      onClick: (row) => handleEdit(row),
    },
    {
      icon: "fas fa-trash",
      className: "action-btn btn-danger",
      title: "Eliminar",
      show: roleData?.origenes?.delete,
      onClick: (row) => handleDelete(row._id),
    },
  ];

  const locationForm = (
    <>
      <div className="mb-3">
        <label htmlFor="nombre" className="form-label">Nombre</label>
        <input id="nombre" className="form-control" value={formData.nombre} onChange={handleChange} />
      </div>
      <div className="mb-3">
        <label htmlFor="estado" className="form-label">Estado</label>
        <select id="estado" className="form-control" value={formData.estado} onChange={handleChange}>
          <option value="">Selecciona un estado</option>
          {estados.map((e) => (
            <option key={e.clave} value={e.nombre}>{e.nombre}</option>
          ))}
        </select>
      </div>
      <div className="mb-3">
        <label htmlFor="municipio" className="form-label">Cliente</label>
        <select id="municipio" className="form-control" value={formData.municipio} onChange={handleChange}>
          <option value="">Selecciona un cliente</option>
          {clients.map((c) => (
            <option key={c._id} value={c.razon_social}>{c.razon_social}</option>
          ))}
        </select>
      </div>
    </>
  );

  return (
    <section id="origenPage" className="settings-page">
      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Catálogos - Orígenes"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            filters={
              roleData?.origenes?.read && (
                <FilterBar onClear={clearFilters}>
                  <div>
                    <span className="pselect__label">Nombre</span>
                    <div className="pdt-field">
                      <i className="fa fa-search pdt-field__icon"></i>
                      <input type="text" className="pdt-field__input" placeholder="Buscar..." name="nombre" value={filters.nombre} onChange={handleFilterChange} />
                    </div>
                  </div>
                  <div>
                    <Select
                      label="Estado"
                      placeholder="Todos los estados"
                      value={filters.estado || null}
                      onChange={(v) => handleFilterChange({target: {name: "estado", value: v ?? ""}})}
                      options={estados.map((e) => ({value: e.nombre, label: e.nombre}))}
                    />
                  </div>
                  <div>
                    <Select
                      label="Cliente"
                      placeholder="Todos los clientes"
                      value={filters.cliente || null}
                      onChange={(v) => handleFilterChange({target: {name: "cliente", value: v ?? ""}})}
                      options={clients.map((c) => ({value: c.razon_social, label: c.razon_social}))}
                    />
                  </div>
                </FilterBar>
              )
            }
          >
            {roleData?.origenes?.create && (
              <button type="button" className="new-btn" onClick={() => setModalType("create")}>
                <i className="fas fa-plus"></i>Crear
              </button>
            )}
          </PageHeader>

          <div className="bits-table-shell">
              <DataTable
                loading={isLoading}
                maxHeight="100%"
                data={filteredOrigenes}
                columns={columns}
                actions={actions}
                emptyMessage="No se encontraron orígenes que coincidan con los filtros."
              />
            </div>
        </div>
      </div>

      {/* Modal: Crear */}
      {modalType === "create" && (
        <ModalTemplate show title="Crear Origen" onClose={() => setModalType("")} onSubmit={handleCreate}>
          {locationForm}
        </ModalTemplate>
      )}

      {/* Modal: Editar */}
      {modalType === "edit" && currentOrigen && (
        <ModalTemplate
          show
          title="Editar Origen"
          onClose={() => {setModalType(""); setCurrentOrigen(null);}}
          onSubmit={handleSaveEdit}>
          {locationForm}
        </ModalTemplate>
      )}

      {/* Modal: Eliminar */}
      {showDeleteModal && (
        <ModalTemplate
          show
          title="Confirmar Eliminación"
          onClose={() => setShowDeleteModal(false)}
          onSubmit={(e) => {e.preventDefault(); handleConfirmDelete(idToDelete);}}>
          <p>¿Está seguro de que desea eliminar este origen?</p>
        </ModalTemplate>
      )}
    </section>
  );
};

export default OrigenPage;
