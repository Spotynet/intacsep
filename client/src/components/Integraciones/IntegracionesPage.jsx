import { useState, useEffect, useMemo } from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import { useAuth } from "../../context/AuthContext";
import ModalTemplate from "../ModalTemplate";
import DataTable from "../DataTable";
import FilterBar from "../FilterBar";
import {Select} from "../Select";
import { useSidebar } from "../../context/SidebarContext";
import { useNavigate } from "react-router-dom";
import IntegrationModal from "./IntegrationModal";
import { fetchIntegrations, createIntegration, updateIntegration, deleteIntegration } from "../../utils/api";

const IntegracionesPage = () => {
  const [integrations, setIntegrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [idToDelete, setIdToDelete] = useState("");
  const { user, verifyToken, setUser } = useAuth();
  const [roleData, setRoleData] = useState(() => {
    try { const s = localStorage.getItem("sidebar-role"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
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

  const loadIntegrations = async (showLoader = false) => {
    if (showLoader) setIsLoading(true);
    try {
      const data = await fetchIntegrations();
      setIntegrations(data);
    } catch (e) {
      console.error("Error fetching integrations:", e);
    } finally {
      setIsLoading(false);
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
  const hasActiveFilters = !!(filters.name || filters.provider);

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
      header: "ID", headerClassName: "text-center",
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
      className: "action-btn btn-primary",
      title: "Editar",
      show: roleData?.integraciones?.update,
      onClick: (row) => handleEdit(row),
    },
    {
      icon: "fas fa-trash",
      className: "action-btn btn-danger",
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
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            filters={
              roleData?.integraciones?.read && (
                <FilterBar onClear={clearFilters}>
                  <div>
                    <span className="pselect__label">Nombre</span>
                    <div className="pdt-field">
                      <i className="fa fa-search pdt-field__icon"></i>
                      <input type="text" className="pdt-field__input" placeholder="Buscar..." name="name" value={filters.name} onChange={handleFilterChange} />
                    </div>
                  </div>
                  <div>
                    <Select
                      label="Proveedor"
                      placeholder="Todos los proveedores"
                      value={filters.provider || null}
                      onChange={(v) => handleFilterChange({target: {name: "provider", value: v ?? ""}})}
                      options={[{value: "samsara", label: "Samsara"}]}
                    />
                  </div>
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

          <div className="bits-table-shell">
              <DataTable
                loading={isLoading}
                maxHeight="100%"
                data={filteredIntegrations}
                columns={columns}
                actions={actions}
                emptyMessage="No se encontraron integraciones que coincidan con los filtros."
              />
            </div>
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
