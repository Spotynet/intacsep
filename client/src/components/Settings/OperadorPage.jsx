import {useState, useEffect, useMemo} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import ModalTemplate from "../ModalTemplate";
import DataTable from "../DataTable";
import FilterBar from "../FilterBar";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";

const OperadorPage = () => {
  const [operadores, setOperadores] = useState([]);
  const [lineasTransporte, setLineasTransporte] = useState([]);
  const [formData, setFormData] = useState({nombre: "", lineaTransporte: ""});
  const [idToDelete, setIdToDelete] = useState("");
  const [currentOperador, setCurrentOperador] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const baseUrl = import.meta.env.VITE_BASE_URL;

  // Filter states
  const [filters, setFilters] = useState({nombre: "", lineaTransporte: ""});

  const {user, verifyToken, setUser} = useAuth();
  const [roleData, setRoleData] = useState(null);
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
    const fetchOperadores = async () => {
      try {
        const response = await fetch(`${baseUrl}/operadores`, {method: "GET", credentials: "include"});
        if (response.ok) setOperadores(await response.json());
        else console.error("Failed to fetch operadores:", response.statusText);
      } catch (e) {
        console.error("Error fetching operadores:", e);
      }
    };
    fetchOperadores();
  }, [baseUrl]);

  useEffect(() => {
    const fetchLineasTransporte = async () => {
      try {
        const response = await fetch(`${baseUrl}/lineas-transporte`, {method: "GET", credentials: "include"});
        if (response.ok) setLineasTransporte(await response.json());
        else console.error("Failed to fetch lineas transporte:", response.statusText);
      } catch (e) {
        console.error("Error fetching lineas transporte:", e);
      }
    };
    fetchLineasTransporte();
  }, [baseUrl]);

  const filteredOperadores = useMemo(
    () =>
      operadores.filter((o) => {
        const nombre = o.nombre || o.name || "";
        const linea = o.lineaTransporte || "";
        return (
          nombre.toLowerCase().includes(filters.nombre.toLowerCase()) &&
          linea.toLowerCase().includes(filters.lineaTransporte.toLowerCase())
        );
      }),
    [operadores, filters]
  );

  const handleFilterChange = (e) => {
    const {name, value} = e.target;
    setFilters((prev) => ({...prev, [name]: value}));
  };

  const clearFilters = () => setFilters({nombre: "", lineaTransporte: ""});

  const handleDelete = (id) => {setIdToDelete(id); setShowDeleteModal(true);};

  const handleConfirmDelete = async (id) => {
    try {
      const response = await fetch(`${baseUrl}/operadores/${id}`, {method: "DELETE", credentials: "include"});
      if (response.ok) {
        setOperadores((prev) => prev.filter((o) => o._id !== id));
        setShowDeleteModal(false);
      } else {
        console.error("Failed to delete operador:", response.statusText);
      }
    } catch (e) {
      console.error("Error deleting operador:", e);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${baseUrl}/operadores`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(formData),
        credentials: "include",
      });
      if (response.ok) {
        const created = await response.json();
        setOperadores((prev) => [...prev, created]);
        setFormData({nombre: "", lineaTransporte: ""});
        setModalType("");
      } else {
        console.error("Failed to create operador:", response.statusText);
      }
    } catch (e) {
      console.error("Error creating operador:", e);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!currentOperador) return;
    try {
      const response = await fetch(`${baseUrl}/operadores/${currentOperador._id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(formData),
        credentials: "include",
      });
      if (response.ok) {
        const updated = await response.json();
        setOperadores((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
        setFormData({nombre: "", lineaTransporte: ""});
        setCurrentOperador(null);
        setModalType("");
      } else {
        console.error("Failed to update operador:", response.statusText);
      }
    } catch (e) {
      console.error("Error updating operador:", e);
    }
  };

  const handleEdit = (operador) => {
    setCurrentOperador(operador);
    setFormData({nombre: operador.nombre || operador.name || "", lineaTransporte: operador.lineaTransporte || ""});
    setModalType("edit");
  };

  const handleChange = (e) => {
    const {id, value} = e.target;
    setFormData((prev) => ({...prev, [id]: value}));
  };

  const columns = [
    {
      key: "numericId",
      header: "ID",
      width: "60px",
      className: "text-center fw-bold",
      render: (row) => (row.numericId ? row.numericId.toString().padStart(4, "0") : "N/A"),
    },
    {key: "nombre", header: "Nombre", render: (row) => row.nombre || row.name || ""},
    {key: "lineaTransporte", header: "Línea de Transporte"},
  ];

  const actions = [
    {
      icon: "fas fa-edit",
      className: "btn btn-primary",
      title: "Editar",
      show: roleData?.operadores?.update,
      onClick: (row) => handleEdit(row),
    },
    {
      icon: "fas fa-trash",
      className: "btn btn-danger",
      title: "Eliminar",
      show: roleData?.operadores?.delete,
      onClick: (row) => handleDelete(row._id),
    },
  ];

  const operadorForm = (
    <>
      <div className="mb-3">
        <label htmlFor="nombre" className="form-label">Nombre</label>
        <input id="nombre" className="form-control" value={formData.nombre} onChange={handleChange} required />
      </div>
      <div className="mb-3">
        <label htmlFor="lineaTransporte" className="form-label">Línea de Transporte</label>
        <select id="lineaTransporte" className="form-control" value={formData.lineaTransporte} onChange={handleChange} required>
          <option value="">Selecciona una línea de transporte</option>
          {lineasTransporte.map((linea) => (
            <option key={linea._id} value={linea.nombre}>{linea.nombre}</option>
          ))}
        </select>
      </div>
    </>
  );

  return (
    <section id="operadores" className="settings-page">
      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Catálogos - Operadores"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            filters={
              roleData?.operadores?.read && (
                <FilterBar onClear={clearFilters}>
                  <input
                    type="text"
                    className="form-control form-control-sm border-0 bg-white shadow-sm"
                    placeholder="Buscar por nombre..."
                    name="nombre"
                    value={filters.nombre}
                    onChange={handleFilterChange}
                  />
                  <select
                    className="form-control form-control-sm border-0 bg-white shadow-sm"
                    name="lineaTransporte"
                    value={filters.lineaTransporte}
                    onChange={handleFilterChange}>
                    <option value="">Todas las líneas de transporte</option>
                    {lineasTransporte.map((linea) => (
                      <option key={linea._id} value={linea.nombre}>{linea.nombre}</option>
                    ))}
                  </select>
                </FilterBar>
              )
            }
          >
            {roleData?.operadores?.create && (
              <button type="button" className="new-btn" onClick={() => setModalType("create")}>
                <i className="fas fa-plus"></i>Crear
              </button>
            )}
          </PageHeader>

          {roleData?.operadores?.read && (
            <div className="settings-content mt-4">
              <DataTable
                data={filteredOperadores}
                columns={columns}
                actions={actions}
                emptyMessage="No se encontraron operadores que coincidan con los filtros."
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal: Crear */}
      {modalType === "create" && (
        <ModalTemplate show title="Crear Operador" onClose={() => setModalType("")} onSubmit={handleCreate}>
          {operadorForm}
        </ModalTemplate>
      )}

      {/* Modal: Editar */}
      {modalType === "edit" && currentOperador && (
        <ModalTemplate
          show
          title="Editar Operador"
          onClose={() => {setModalType(""); setCurrentOperador(null);}}
          onSubmit={handleSaveEdit}>
          {operadorForm}
        </ModalTemplate>
      )}

      {/* Modal: Eliminar */}
      {showDeleteModal && (
        <ModalTemplate
          show
          title="Confirmar Eliminación"
          onClose={() => setShowDeleteModal(false)}
          onSubmit={(e) => {e.preventDefault(); handleConfirmDelete(idToDelete);}}>
          <p>¿Está seguro de que desea eliminar este operador?</p>
        </ModalTemplate>
      )}
    </section>
  );
};

export default OperadorPage;
