import {useState, useEffect, useMemo} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import ModalTemplate from "../ModalTemplate";
import DataTable from "../DataTable";
import FilterBar from "../FilterBar";
import {Select} from "../Select";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";

const LineaTransportePage = () => {
  const [lineasTransporte, setLineasTransporte] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [formData, setFormData] = useState({nombre: "", cliente: ""});
  const [idToDelete, setIdToDelete] = useState("");
  const [currentLineaTransporte, setCurrentLineaTransporte] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const baseUrl = import.meta.env.VITE_BASE_URL;

  // Filter states
  const [filters, setFilters] = useState({nombre: "", cliente: ""});

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
    const fetchLineasTransporte = async () => {
      try {
        const response = await fetch(`${baseUrl}/lineas-transporte`, {method: "GET", credentials: "include"});
        if (response.ok) { setLineasTransporte(await response.json()); } else { console.error("Failed to fetch", response.statusText); }
        setIsLoading(false);
      } catch (e) {
        console.error("Error fetching lineas transporte:", e);
      }
    };
    fetchLineasTransporte();
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

  const filteredLineasTransporte = useMemo(
    () =>
      lineasTransporte.filter(
        (l) =>
          (l.nombre || "").toLowerCase().includes(filters.nombre.toLowerCase()) &&
          (l.cliente || "").toLowerCase().includes(filters.cliente.toLowerCase())
      ),
    [lineasTransporte, filters]
  );

  const handleFilterChange = (e) => {
    const {name, value} = e.target;
    setFilters((prev) => ({...prev, [name]: value}));
  };

  const clearFilters = () => setFilters({nombre: "", cliente: ""});
  const hasActiveFilters = !!(filters.nombre || filters.cliente);

  const handleDelete = (id) => {setIdToDelete(id); setShowDeleteModal(true);};

  const handleConfirmDelete = async (id) => {
    try {
      const response = await fetch(`${baseUrl}/lineas-transporte/${id}`, {method: "DELETE", credentials: "include"});
      if (response.ok) {
        setLineasTransporte((prev) => prev.filter((l) => l._id !== id));
        setShowDeleteModal(false);
      } else {
        console.error("Failed to delete linea transporte:", response.statusText);
      }
    } catch (e) {
      console.error("Error deleting linea transporte:", e);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${baseUrl}/lineas-transporte`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(formData),
        credentials: "include",
      });
      if (response.ok) {
        const created = await response.json();
        setLineasTransporte((prev) => [...prev, created]);
        setFormData({nombre: "", cliente: ""});
        setModalType("");
      } else {
        console.error("Failed to create linea transporte:", response.statusText);
      }
    } catch (e) {
      console.error("Error creating linea transporte:", e);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!currentLineaTransporte) return;
    try {
      const response = await fetch(`${baseUrl}/lineas-transporte/${currentLineaTransporte._id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(formData),
        credentials: "include",
      });
      if (response.ok) {
        const updated = await response.json();
        setLineasTransporte((prev) => prev.map((l) => (l._id === updated._id ? updated : l)));
        setFormData({nombre: "", cliente: ""});
        setCurrentLineaTransporte(null);
        setModalType("");
      } else {
        console.error("Failed to update linea transporte:", response.statusText);
      }
    } catch (e) {
      console.error("Error updating linea transporte:", e);
    }
  };

  const handleEdit = (linea) => {
    setCurrentLineaTransporte(linea);
    setFormData({nombre: linea.nombre, cliente: linea.cliente});
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
    {key: "cliente", header: "Cliente"},
  ];

  const actions = [
    {
      icon: "fas fa-edit",
      className: "action-btn btn-primary",
      title: "Editar",
      show: roleData?.lineas_transporte?.update,
      onClick: (row) => handleEdit(row),
    },
    {
      icon: "fas fa-trash",
      className: "action-btn btn-danger",
      title: "Eliminar",
      show: roleData?.lineas_transporte?.delete,
      onClick: (row) => handleDelete(row._id),
    },
  ];

  const lineaForm = (
    <>
      <div className="mb-3">
        <label htmlFor="nombre" className="form-label">Nombre</label>
        <input id="nombre" className="form-control" value={formData.nombre} onChange={handleChange} required />
      </div>
      <div className="mb-3">
        <label htmlFor="cliente" className="form-label">Cliente</label>
        <select id="cliente" className="form-control" value={formData.cliente} onChange={handleChange} required>
          <option value="">Selecciona un cliente</option>
          {clients.map((client) => (
            <option key={client._id} value={client.razon_social}>{client.razon_social}</option>
          ))}
        </select>
      </div>
    </>
  );

  return (
    <section id="lineasTransporte" className="settings-page">
      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Catálogos - Líneas de Transporte"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            filters={
              roleData?.lineas_transporte?.read && (
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
            {roleData?.lineas_transporte?.create && (
              <button type="button" className="new-btn" onClick={() => setModalType("create")}>
                <i className="fas fa-plus"></i>Crear
              </button>
            )}
          </PageHeader>

          <div className="bits-table-shell">
              <DataTable
                loading={isLoading}
                maxHeight="100%"
                data={filteredLineasTransporte}
                columns={columns}
                actions={actions}
                emptyMessage="No se encontraron líneas de transporte que coincidan con los filtros."
              />
            </div>
        </div>
      </div>

      {/* Modal: Crear */}
      {modalType === "create" && (
        <ModalTemplate show title="Crear Línea de Transporte" onClose={() => setModalType("")} onSubmit={handleCreate}>
          {lineaForm}
        </ModalTemplate>
      )}

      {/* Modal: Editar */}
      {modalType === "edit" && currentLineaTransporte && (
        <ModalTemplate
          show
          title="Editar Línea de Transporte"
          onClose={() => {setModalType(""); setCurrentLineaTransporte(null);}}
          onSubmit={handleSaveEdit}>
          {lineaForm}
        </ModalTemplate>
      )}

      {/* Modal: Eliminar */}
      {showDeleteModal && (
        <ModalTemplate
          show
          title="Confirmar Eliminación"
          onClose={() => setShowDeleteModal(false)}
          onSubmit={(e) => {e.preventDefault(); handleConfirmDelete(idToDelete);}}>
          <p>¿Está seguro de que desea eliminar esta línea de transporte?</p>
        </ModalTemplate>
      )}
    </section>
  );
};

export default LineaTransportePage;
