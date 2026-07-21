import { useState, useEffect, useMemo } from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import { useAuth } from "../../context/AuthContext";
import ModalTemplate from "../ModalTemplate";
import DataTable from "../DataTable";
import FilterBar from "../FilterBar";
import { useSidebar } from "../../context/SidebarContext";
import { useNavigate } from "react-router-dom";
import IntegrationModal from "./IntegrationModal";
import { fetchIntegrations, createIntegration, updateIntegration, deleteIntegration } from "../../utils/api";

const IntegracionesPage = () => {
  const [integrations, setIntegrations] = useState([]);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [idToDelete, setIdToDelete] = useState("");
  const { user, verifyToken, setUser } = useAuth();
  const [roleData, setRoleData] = useState(null);
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const { isSidebarCollapsed, setIsMobileSidebarOpen } = useSidebar();
  const navigate = useNavigate();

  // Filter states
  const [filters, setFilters] = useState({ name: "", provider: "" });

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
    if (!user?.role) return;
    const fetchRolePermissions = async () => {
      try {
        const response = await fetch(`${baseUrl}/roles/${user.role}`, { method: "GET", credentials: "include" });
        const data = await response.json();
        setRoleData(data);
      } catch (e) {
        console.log("Error fetching role permissions:", e);
      }
    };
    fetchRolePermissions();
  }, [user]);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const data = await fetchIntegrations();
      setIntegrations(data);
    } catch (e) {
      console.error("Error fetching integrations:", e);
    }
  };

  const filteredIntegrations = useMemo(
    () =>
      integrations.filter(
        (i) =>
          i.name.toLowerCase().includes(filters.name.toLowerCase()) &&
          i.provider.toLowerCase().includes(filters.provider.toLowerCase())
      ),
    [integrations, filters]
  );

  const handleConfirmDelete = async (id) => {
    try {
      await deleteIntegration(id);
      setIntegrations((prev) => prev.filter((i) => i._id !== id));
      setShowDeleteModal(false);
    } catch (e) {
      console.error("Error deleting integration:", e);
    }
  };

  const handleDelete = (id) => {
    setIdToDelete(id);
    setShowDeleteModal(true);
  };

  const handleEdit = (i) => {
    setEditingIntegration(i);
    setModalVisible(true);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => setFilters({ name: "", provider: "" });

  const handleSubmit = async (formData) => {
    try {
      let result;
      if (editingIntegration) {
        result = await updateIntegration(editingIntegration._id, formData);
        setIntegrations((prev) => prev.map((i) => (i._id === result._id ? result : i)));
      } else {
        result = await createIntegration(formData);
        setIntegrations((prev) => [...prev, result]);
      }
      loadIntegrations(); // Reload to get counts and populated fields
      return result;
    } catch (e) {
      console.error("Error saving integration:", e);
      throw e;
    }
  };

  const handleCreateNew = () => {
    setEditingIntegration(null);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingIntegration(null);
  };

  const columns = [
    {
      key: "index",
      header: "ID",
      width: "60px",
      className: "text-center fw-bold",
      render: (_row, { rowIndex, currentPage, itemsPerPage }) =>
        (currentPage - 1) * itemsPerPage + rowIndex + 1,
    },
    { key: "name", header: "Nombre" },
    { 
      key: "type", 
      header: "Tipo", 
      render: (row) => row.type === 'inbound-rest' ? 'Inbound (Webhook)' : 'API Directo' 
    },
    { key: "provider", header: "Proveedor", className: "text-capitalize" },
    { 
      key: "clientId", 
      header: "Cliente", 
      render: (row) => row.clientId?.razon_social || row.clientId?.name || "N/A" 
    },
    { key: "vehicleCount", header: "Vehículos", className: "text-center" },
    {
      key: "lastInboundAt",
      header: "Último mensaje",
      render: (row) => row.lastInboundAt
        ? new Date(row.lastInboundAt).toLocaleString()
        : <span className="text-muted">Sin datos</span>,
    },
    { 
      key: "status", 
      header: "Estado",
      render: (row) => (
        <span className={`badge ${row.status === 'active' ? 'bg-success' : 'bg-secondary'}`}>
          {row.status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
      )
    },
  ];

  const actions = [
    {
      icon: "fas fa-edit",
      className: "btn btn-primary",
      title: "Editar",
      show: roleData?.integraciones?.update,
      onClick: (row) => handleEdit(row),
    },
    {
      icon: "fas fa-trash",
      className: "btn btn-danger",
      title: "Eliminar",
      show: roleData?.integraciones?.delete,
      onClick: (row) => handleDelete(row._id),
    },
  ];

  if (!roleData) return <div>Cargando...</div>;

  return (
    <section id="integracionesPage" className="settings-page">
      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Sistema - Integraciones GPS"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            filters={
              roleData?.integraciones?.read && (
                <FilterBar onClear={clearFilters}>
                  <input
                    type="text"
                    className="form-control form-control-sm border-0 bg-white shadow-sm"
                    placeholder="Buscar por nombre..."
                    name="name"
                    value={filters.name}
                    onChange={handleFilterChange}
                  />
                  <select
                    className="form-control form-control-sm border-0 bg-white shadow-sm"
                    name="provider"
                    value={filters.provider}
                    onChange={handleFilterChange}
                  >
                    <option value="">Todos los proveedores</option>
                    <option value="samsara">Samsara</option>
                  </select>
                </FilterBar>
              )
            }
          >
            {roleData?.integraciones?.create && (
              <button className="new-btn" onClick={handleCreateNew}>
                <i className="fas fa-plus"></i>Crear
              </button>
            )}
          </PageHeader>

          {roleData?.integraciones?.read && (
            <div className="settings-content mt-4">
              <DataTable
                data={filteredIntegrations}
                columns={columns}
                actions={actions}
                emptyMessage="No se encontraron integraciones que coincidan con los filtros."
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal: Crear / Editar */}
      {isModalVisible && (
        <IntegrationModal
          show={isModalVisible}
          integration={editingIntegration}
          editing={!!editingIntegration}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}

      {/* Modal: Eliminar */}
      {showDeleteModal && (
        <ModalTemplate
          show={showDeleteModal}
          title="Confirmar Eliminación"
          onClose={() => setShowDeleteModal(false)}
          onSubmit={(e) => { e.preventDefault(); handleConfirmDelete(idToDelete); }}
        >
          <p>¿Está seguro de que desea eliminar esta integración y todos sus mapeos de vehículos?</p>
        </ModalTemplate>
      )}
    </section>
  );
};

export default IntegracionesPage;
