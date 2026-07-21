import {useState, useEffect, useMemo} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import ModalTemplate from "../ModalTemplate";
import DataTable from "../DataTable";
import FilterBar from "../FilterBar";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";
import {useNavigate} from "react-router-dom";

const TiposMonitoreo = () => {
  const [monitoreos, setMonitoreos] = useState([]);
  const [newMonitoreo, setNewMonitoreo] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [currentMonitoreo, setCurrentMonitoreo] = useState(null);
  const [editingName, setEditingName] = useState("");
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [idToDelete, setIdToDelete] = useState("");

  // Filter state
  const [filters, setFilters] = useState({tipoMonitoreo: ""});

  const {user, verifyToken, setUser} = useAuth();
  const [roleData, setRoleData] = useState(null);
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      try {
        const data = await verifyToken();
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

  useEffect(() => {
    const fetchMonitoreos = async () => {
      try {
        const response = await fetch(`${baseUrl}/monitoreos`, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setMonitoreos(data);
        } else {
          console.error("Failed to fetch monitoreos:", response.statusText);
        }
      } catch (e) {
        console.error("Error fetching monitoreos:", e);
      }
    };
    fetchMonitoreos();
  }, []);

  // Derived filtered list — passed directly to DataTable
  const filteredMonitoreos = useMemo(
    () =>
      monitoreos.filter((m) =>
        m.tipoMonitoreo.toLowerCase().includes(filters.tipoMonitoreo.toLowerCase())
      ),
    [monitoreos, filters]
  );

  const handleFilterChange = (e) => {
    const {name, value} = e.target;
    setFilters((prev) => ({...prev, [name]: value}));
  };

  const clearFilters = () => setFilters({tipoMonitoreo: ""});

  const handleConfirmDelete = async (id) => {
    try {
      const response = await fetch(`${baseUrl}/monitoreos/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        setMonitoreos((prev) => prev.filter((m) => m._id !== id));
        setShowDeleteModal(false);
      } else {
        console.error("Failed to delete monitoreo:", response.statusText);
      }
    } catch (e) {
      console.error("Error deleting monitoreo:", e);
    }
  };

  const handleDelete = (id) => {
    setIdToDelete(id);
    setShowDeleteModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newMonitoreo) return;
    try {
      const response = await fetch(`${baseUrl}/monitoreos`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({tipoMonitoreo: newMonitoreo}),
        credentials: "include",
      });
      if (response.ok) {
        const created = await response.json();
        setMonitoreos((prev) => [...prev, created]);
        setNewMonitoreo("");
        setShowModal(false);
      } else {
        console.error("Failed to create monitoreo:", response.statusText);
      }
    } catch (e) {
      console.error("Error creating monitoreo:", e);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!currentMonitoreo) return;
    try {
      const response = await fetch(`${baseUrl}/monitoreos/${currentMonitoreo._id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({tipoMonitoreo: editingName}),
        credentials: "include",
      });
      if (response.ok) {
        const updated = await response.json();
        setMonitoreos((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
        setShowModal(false);
        setCurrentMonitoreo(null);
        setEditingName("");
      } else {
        console.error("Failed to edit Monitoreo:", response.statusText);
      }
    } catch (e) {
      console.error("Error editing Monitoreo:", e);
    }
  };

  const columns = [
    {
      key: "numericId",
      header: "ID",
      width: "60px",
      className: "text-center fw-bold",
      render: (row) => (row.numericId ? row.numericId.toString().padStart(4, "0") : "N/A"),
    },
    {key: "tipoMonitoreo", header: "Tipo de Monitoreo"},
  ];

  const actions = [
    {
      icon: "fas fa-edit",
      className: "btn btn-primary",
      title: "Editar",
      show: roleData?.tipos_de_monitoreo?.update,
      onClick: (row) => {
        setCurrentMonitoreo(row);
        setEditingName(row.tipoMonitoreo);
        setShowModal("edit");
      },
    },
    {
      icon: "fas fa-trash",
      className: "btn btn-danger",
      title: "Eliminar",
      show: roleData?.tipos_de_monitoreo?.delete,
      onClick: (row) => handleDelete(row._id),
    },
  ];

  return (
    <section id="pastBits" className="settings-page">
      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Catálogos - Tipos de Monitoreo"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            filters={
              roleData?.tipos_de_monitoreo?.read && (
                <FilterBar onClear={clearFilters}>
                  <input
                    type="text"
                    className="form-control form-control-sm border-0 bg-white shadow-sm"
                    placeholder="Buscar por tipo de monitoreo..."
                    name="tipoMonitoreo"
                    value={filters.tipoMonitoreo}
                    onChange={handleFilterChange}
                  />
                </FilterBar>
              )
            }
          >
            {roleData?.tipos_de_monitoreo?.create && (
              <button type="button" className="new-btn" onClick={() => setShowModal("create")}>
                <i className="fas fa-plus"></i>Crear
              </button>
            )}
          </PageHeader>

          {roleData?.tipos_de_monitoreo?.read && (
            <div className="settings-content mt-4">
              <DataTable
                data={filteredMonitoreos}
                columns={columns}
                actions={actions}
                emptyMessage="No se encontraron tipos de monitoreo que coincidan con los filtros."
              />
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showModal === "create" && (
        <ModalTemplate
          show
          title="Crear Tipo de Monitoreo"
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}>
          <div className="mb-3">
            <label htmlFor="newMonitoreo" className="form-label">
              Tipo de Monitoreo
            </label>
            <input
              id="newMonitoreo"
              type="text"
              className="form-control"
              value={newMonitoreo}
              onChange={(e) => setNewMonitoreo(e.target.value)}
              placeholder="Ingrese nuevo tipo de monitoreo"
              required
            />
          </div>
        </ModalTemplate>
      )}

      {/* Edit Modal */}
      {showModal === "edit" && currentMonitoreo && (
        <ModalTemplate
          show
          title="Editar Monitoreo"
          onClose={() => {
            setShowModal(false);
            setCurrentMonitoreo(null);
          }}
          onSubmit={handleSaveEdit}>
          <div className="mb-3">
            <label htmlFor="editMonitoreo" className="form-label">
              Tipo de Monitoreo
            </label>
            <input
              id="editMonitoreo"
              type="text"
              className="form-control"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              required
            />
          </div>
        </ModalTemplate>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <ModalTemplate
          show
          title="Confirmar Eliminación"
          onClose={() => setShowDeleteModal(false)}
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirmDelete(idToDelete);
          }}>
          <p>¿Está seguro de que desea eliminar este tipo de monitoreo?</p>
        </ModalTemplate>
      )}
    </section>
  );
};

export default TiposMonitoreo;
