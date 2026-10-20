import {useState, useEffect, useMemo} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import ModalTemplate from "../ModalTemplate";
import DataTable from "../DataTable";
import FilterBar from "../FilterBar";
import {Select} from "../Select";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";
import {useNavigate} from "react-router-dom";

const EventsPage = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({evento: "", categoria: "", calificacion: ""});
  const [editEvent, setEditEvent] = useState(null);
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [idToDelete, setIdToDelete] = useState("");
  const [modalType, setModalType] = useState("");

  // Filter state
  const [filters, setFilters] = useState({evento: "", categoria: "", calificacion: ""});

  const {user, verifyToken, setUser} = useAuth();
  const [roleData, setRoleData] = useState(() => {
    try { const s = localStorage.getItem("sidebar-role"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
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
    const fetchEvents = async () => {
      try {
        const response = await fetch(`${baseUrl}/event_types`, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setEvents(data);
        } else {
          console.error("Failed to fetch events:", response.statusText);
        }
      } catch (e) {
        console.error("Error fetching events:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, [baseUrl]);

  // Derived filtered list — passed directly to DataTable
  const filteredEvents = useMemo(
    () =>
      events.filter((e) => {
        return (
          e.evento.toLowerCase().includes(filters.evento.toLowerCase()) &&
          e.categoria.toLowerCase().includes(filters.categoria.toLowerCase()) &&
          e.calificacion.toString().includes(filters.calificacion)
        );
      }),
    [events, filters]
  );

  const handleChange = (e) => {
    const {id, value} = e.target;
    setFormData((prev) => ({...prev, [id]: value}));
  };

  const handleFilterChange = (e) => {
    const {name, value} = e.target;
    setFilters((prev) => ({...prev, [name]: value}));
  };

  const clearFilters = () => setFilters({evento: "", categoria: "", calificacion: ""});
  const hasActiveFilters = !!(filters.evento || filters.categoria || filters.calificacion);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.evento || !formData.categoria || !formData.calificacion) return;
    try {
      const response = await fetch(`${baseUrl}/event_types`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "include",
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        const created = await response.json();
        setEvents((prev) => [...prev, created]);
        setFormData({evento: "", categoria: "", calificacion: ""});
        setModalType("");
      } else {
        const err = await response.json();
        alert(`ERROR: ${err.message}`);
      }
    } catch (e) {
      console.error("Error creating event:", e);
    }
  };

  const handleEditClick = (event) => {
    setEditEvent(event);
    setFormData({evento: event.evento, categoria: event.categoria, calificacion: event.calificacion});
    setModalType("edit");
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editEvent) return;
    try {
      const response = await fetch(`${baseUrl}/event_types/${editEvent._id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        credentials: "include",
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        const updated = await response.json();
        setEvents((prev) => prev.map((ev) => (ev._id === updated._id ? updated : ev)));
        setFormData({evento: "", categoria: "", calificacion: ""});
        setEditEvent(null);
        setModalType("");
      } else {
        console.error("Failed to update event:", response.statusText);
      }
    } catch (e) {
      console.error("Error updating event:", e);
    }
  };

  const handleDelete = (id) => {
    setIdToDelete(id);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async (id) => {
    try {
      const response = await fetch(`${baseUrl}/event_types/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        setEvents((prev) => prev.filter((ev) => ev._id !== id));
        setShowDeleteModal(false);
      }
    } catch (e) {
      console.error("Error deleting event:", e);
    }
  };

  const columns = [
    {
      key: "numericId",
      header: "ID", headerClassName: "text-center",
      width: "60px",
      className: "text-center fw-bold",
      render: (row) => (row.numericId ? row.numericId.toString().padStart(4, "0") : "N/A"),
    },
    {key: "evento", header: "Evento"},
    {key: "categoria", header: "Categoría"},
    {key: "calificacion", header: "Calificación"},
  ];

  const actions = [
    {
      icon: "fa fa-edit",
      className: "action-btn btn-primary",
      title: "Editar",
      show: roleData?.eventos?.update,
      onClick: (row) => handleEditClick(row),
    },
    {
      icon: "fas fa-trash",
      className: "action-btn btn-danger",
      title: "Eliminar",
      show: roleData?.eventos?.delete,
      onClick: (row) => handleDelete(row._id),
    },
  ];

  const eventForm = (
    <>
      <div className="mb-3">
        <label htmlFor="evento" className="form-label">Evento</label>
        <input id="evento" className="form-control" value={formData.evento} onChange={handleChange} required />
      </div>
      <div className="mb-3">
        <label htmlFor="categoria" className="form-label">Categoría</label>
        <input id="categoria" className="form-control" value={formData.categoria} onChange={handleChange} required />
      </div>
      <div className="mb-3">
        <label htmlFor="calificacion" className="form-label">Calificación</label>
        <input
          type="number" min={0} max={3}
          id="calificacion" className="form-control"
          value={formData.calificacion} onChange={handleChange} required
        />
      </div>
    </>
  );

  return (
    <section id="eventsPage" className="settings-page">
      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Catálogos - Eventos"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            filters={
              roleData?.eventos?.read && (
                <FilterBar onClear={clearFilters}>
                  <div>
                    <span className="pselect__label">Evento</span>
                    <div className="pdt-field">
                      <i className="fa fa-search pdt-field__icon"></i>
                      <input type="text" className="pdt-field__input" placeholder="Buscar..." name="evento" value={filters.evento} onChange={handleFilterChange} />
                    </div>
                  </div>
                  <div>
                    <span className="pselect__label">Categoría</span>
                    <div className="pdt-field">
                      <i className="fa fa-tag pdt-field__icon"></i>
                      <input type="text" className="pdt-field__input" placeholder="Buscar..." name="categoria" value={filters.categoria} onChange={handleFilterChange} />
                    </div>
                  </div>
                  <div>
                    <span className="pselect__label">Calificación</span>
                    <div className="pdt-field">
                      <i className="fa fa-star pdt-field__icon"></i>
                      <input type="text" className="pdt-field__input" placeholder="Buscar..." name="calificacion" value={filters.calificacion} onChange={handleFilterChange} />
                    </div>
                  </div>
                </FilterBar>
              )
            }
          >
            {roleData?.eventos?.create && (
              <button type="button" className="new-btn" onClick={() => setModalType("create")}>
                <i className="fas fa-plus"></i>Crear
              </button>
            )}
          </PageHeader>

          <div className="bits-table-shell">
              <DataTable
                loading={isLoading}
                maxHeight="100%"
                data={filteredEvents}
                columns={columns}
                actions={actions}
                emptyMessage="No se encontraron eventos que coincidan con los filtros."
              />
            </div>
        </div>
      </div>

      {/* Modal: Crear */}
      {modalType === "create" && (
        <ModalTemplate
          show
          title="Crear Evento"
          onClose={() => setModalType("")}
          onSubmit={handleCreate}>
          {eventForm}
        </ModalTemplate>
      )}

      {/* Modal: Editar */}
      {modalType === "edit" && editEvent && (
        <ModalTemplate
          show
          title="Editar Evento"
          onClose={() => {setModalType(""); setEditEvent(null);}}
          onSubmit={handleEditSave}>
          {eventForm}
        </ModalTemplate>
      )}

      {/* Modal: Eliminar */}
      {showDeleteModal && (
        <ModalTemplate
          show
          title="Confirmar Eliminación"
          onClose={() => setShowDeleteModal(false)}
          onSubmit={(e) => {e.preventDefault(); handleConfirmDelete(idToDelete);}}>
          <p>¿Está seguro de que desea eliminar este evento?</p>
        </ModalTemplate>
      )}
    </section>
  );
};

export default EventsPage;
