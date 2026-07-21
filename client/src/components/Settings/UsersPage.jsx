import {useState, useEffect, useMemo} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import {useAuth} from "../../context/AuthContext";
import ModalTemplate from "../ModalTemplate";
import DataTable from "../DataTable";
import FilterBar from "../FilterBar";
import {useSidebar} from "../../context/SidebarContext";
import {useNavigate} from "react-router-dom";

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    countryKey: "",
    role: "",
    inactivityTimeout: 0,
  });
  const [isModalVisible, setModalVisible] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [idToDelete, setIdToDelete] = useState("");
  const {user, verifyToken, setUser} = useAuth();
  const [roleData, setRoleData] = useState(null);
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const navigate = useNavigate();

  // Filter states
  const [filters, setFilters] = useState({email: "", firstName: "", lastName: "", role: ""});

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
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${baseUrl}/users`, {method: "GET", credentials: "include"});
        if (response.ok) {
          const data = await response.json();
          const currentUserRole = user?.role;
          const filtered = currentUserRole !== "Máster" ? data.filter((u) => u.role?.name !== "Máster") : data;
          const normalized = filtered.map((u) => ({
            ...u,
            role: typeof u.role === "object" ? u.role.name : u.role,
          }));
          setUsers(normalized);
        } else {
          console.error("Failed to fetch users:", response.statusText);
        }
      } catch (e) {
        console.error("Error fetching users:", e);
      }
    };

    const fetchRoles = async () => {
      try {
        const response = await fetch(`${baseUrl}/roles`, {method: "GET", credentials: "include"});
        if (response.ok) {
          const data = await response.json();
          const currentUserRole = user?.role;
          const filtered =
            currentUserRole !== "Máster"
              ? data.filter((role) => role.name !== "Máster" && role.name !== "Owner")
              : data;
          setRoles(filtered);
        } else {
          console.error("Failed to fetch roles:", response.statusText);
        }
      } catch (e) {
        console.error("Error fetching roles:", e);
      }
    };

    fetchUsers();
    fetchRoles();
  }, []);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          (u.email || "").toLowerCase().includes(filters.email.toLowerCase()) &&
          (u.firstName || "").toLowerCase().includes(filters.firstName.toLowerCase()) &&
          (u.lastName || "").toLowerCase().includes(filters.lastName.toLowerCase()) &&
          (u.role || "").toLowerCase().includes(filters.role.toLowerCase())
      ),
    [users, filters]
  );

  const handleConfirmDelete = async (id) => {
    try {
      const response = await fetch(`${baseUrl}/users/${id}`, {method: "DELETE", credentials: "include"});
      if (response.ok) {
        setUsers((prev) => prev.filter((u) => u._id !== id));
        setShowDeleteModal(false);
      } else {
        console.error("Failed to delete user:", response.statusText);
      }
    } catch (e) {
      console.error("Error deleting user:", e);
    }
  };

  const handleDelete = (id) => {setIdToDelete(id); setShowDeleteModal(true);};

  const handleEdit = (u) => {
    setEditingUserId(u._id);
    setFormData({...u, password: ""});
    setModalVisible(true);
  };

  const handleChange = (e) => {
    const {id, value} = e.target;
    setFormData((prev) => ({...prev, [id]: value}));
  };

  const handleFilterChange = (e) => {
    const {name, value} = e.target;
    setFilters((prev) => ({...prev, [name]: value}));
  };

  const clearFilters = () => setFilters({email: "", firstName: "", lastName: "", role: ""});

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = editingUserId ? "PUT" : "POST";
      const url = editingUserId ? `${baseUrl}/users/${editingUserId}` : `${baseUrl}/users`;

      const response = await fetch(url, {
        method,
        headers: {"Content-Type": "application/json"},
        credentials: "include",
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          countryKey: formData.countryKey,
          role: formData.role,
          inactivityTimeout: formData.inactivityTimeout === "" || formData.inactivityTimeout == null ? null : Number(formData.inactivityTimeout),
        }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        const normalized = {
          ...updatedUser,
          role: typeof updatedUser.role === "object" ? updatedUser.role.name : updatedUser.role,
        };

        if (editingUserId) {
          setUsers((prev) => prev.map((u) => (u._id === normalized._id ? normalized : u)));
        } else {
          setUsers((prev) => [...prev, normalized]);
        }

        setEditingUserId(null);
        setFormData({email: "", password: "", firstName: "", lastName: "", phone: "", countryKey: "", role: "", inactivityTimeout: 0});
        setModalVisible(false);
      } else {
        const errorData = await response.json();
        console.error("Failed to save user:", errorData.message);
      }
    } catch (e) {
      console.error("Error saving user:", e);
    }
  };

  const handleCreateNew = () => {
    setEditingUserId(null);
    setFormData({email: "", password: "", firstName: "", lastName: "", phone: "", countryKey: "", role: "", inactivityTimeout: 0});
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingUserId(null);
  };

  const columns = [
    {
      key: "index",
      header: "ID",
      width: "60px",
      className: "text-center fw-bold",
      render: (_row, {rowIndex, currentPage, itemsPerPage}) =>
        (currentPage - 1) * itemsPerPage + rowIndex + 1,
    },
    {key: "email", header: "Email"},
    {key: "firstName", header: "Nombre"},
    {key: "lastName", header: "Apellido"},
    {key: "phone", header: "Teléfono"},
    {key: "role", header: "Rol"},
    {
      key: "inactivityTimeout",
      header: "Inactividad",
      render: (row) => {
        if (row.inactivityTimeout === 0) return <span className="badge bg-success">Infinita</span>;
        if (row.inactivityTimeout > 0) return `${row.inactivityTimeout} min`;
        return <span className="text-muted">Global</span>;
      },
    },
  ];

  const actions = [
    {
      icon: "fas fa-edit",
      className: "btn btn-primary",
      title: "Editar",
      show: roleData?.usuarios?.update,
      onClick: (row) => handleEdit(row),
    },
    {
      icon: "fas fa-trash",
      className: "btn btn-danger",
      title: "Eliminar",
      show: roleData?.usuarios?.delete,
      onClick: (row) => handleDelete(row._id),
    },
  ];

  return (
    <section id="usersPage" className="settings-page">
      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Sistema - Usuarios"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            filters={
              <FilterBar onClear={clearFilters}>
                <input
                  type="text"
                  className="form-control form-control-sm border-0 bg-white shadow-sm"
                  placeholder="Buscar por email..."
                  name="email"
                  value={filters.email}
                  onChange={handleFilterChange}
                />
                <input
                  type="text"
                  className="form-control form-control-sm border-0 bg-white shadow-sm"
                  placeholder="Buscar por nombre..."
                  name="firstName"
                  value={filters.firstName}
                  onChange={handleFilterChange}
                />
                <input
                  type="text"
                  className="form-control form-control-sm border-0 bg-white shadow-sm"
                  placeholder="Buscar por apellido..."
                  name="lastName"
                  value={filters.lastName}
                  onChange={handleFilterChange}
                />
                <select
                  className="form-control form-control-sm border-0 bg-white shadow-sm"
                  name="role"
                  value={filters.role}
                  onChange={handleFilterChange}>
                  <option value="">Todos los roles</option>
                  {roles.map((role) => (
                    <option key={role._id} value={role.name}>{role.name}</option>
                  ))}
                </select>
              </FilterBar>
            }
          >
            {roleData?.usuarios?.create && (
              <button className="new-btn" onClick={handleCreateNew}>
                <i className="fas fa-plus"></i>Crear
              </button>
            )}
          </PageHeader>

          {roleData?.usuarios?.read && (
            <div className="settings-content mt-4">
              {/* Tabla */}
                <DataTable
                  data={filteredUsers}
                  columns={columns}
                  actions={actions}
                  emptyMessage="No se encontraron usuarios que coincidan con los filtros."
                />
              </div>
          )}
        </div>
      </div>

      {/* Modal: Crear / Editar */}
      {isModalVisible && (
        <ModalTemplate
          show={isModalVisible}
          title={editingUserId ? "Editar Usuario" : "Crear Nuevo Usuario"}
          onClose={closeModal}
          onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email</label>
            <input type="email" className="form-control" id="email" value={formData.email} onChange={handleChange} required />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className="form-label">Contraseña</label>
            <input type="password" className="form-control" id="password" value={formData.password} onChange={handleChange} required={!editingUserId} />
          </div>
          <div className="mb-3">
            <label htmlFor="firstName" className="form-label">Nombre</label>
            <input type="text" className="form-control" id="firstName" value={formData.firstName} onChange={handleChange} required />
          </div>
          <div className="mb-3">
            <label htmlFor="lastName" className="form-label">Apellido</label>
            <input type="text" className="form-control" id="lastName" value={formData.lastName} onChange={handleChange} required />
          </div>
          <div className="mb-3">
            <label htmlFor="phone" className="form-label">Teléfono</label>
            <input type="text" className="form-control" id="phone" value={formData.phone} onChange={handleChange} required />
          </div>
          <div className="mb-3">
            <label htmlFor="role" className="form-label">Rol</label>
            <select id="role" className="form-select" value={formData.role} onChange={handleChange} required>
              <option value="">Seleccione un rol</option>
              {roles.map((role) => (
                <option key={role._id} value={role.name}>{role.name}</option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label">Tiempo de inactividad personal</label>

            <div className="form-check mb-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="infiniteSession"
                checked={formData.inactivityTimeout === 0}
                onChange={(e) => setFormData(prev => ({ ...prev, inactivityTimeout: e.target.checked ? 0 : "" }))}
              />
              <label className="form-check-label" htmlFor="infiniteSession">
                Sesión infinita — nunca expirará por inactividad
              </label>
            </div>

            {formData.inactivityTimeout !== 0 && (
              <input
                type="number"
                className="form-control"
                id="inactivityTimeout"
                min={1}
                value={formData.inactivityTimeout ?? ""}
                onChange={handleChange}
                placeholder="Vacío = usar configuración global"
              />
            )}

            <div className="form-text">
              {formData.inactivityTimeout === 0
                ? "Este usuario nunca será desconectado por inactividad."
                : Number(formData.inactivityTimeout) > 0
                  ? `La sesión expirará tras ${formData.inactivityTimeout} min de inactividad.`
                  : "Sin valor personal — usará la configuración global del sistema."}
            </div>
          </div>
        </ModalTemplate>
      )}

      {/* Modal: Eliminar */}
      {showDeleteModal && (
        <ModalTemplate
          show={showDeleteModal}
          title="Confirmar Eliminación"
          onClose={() => setShowDeleteModal(false)}
          onSubmit={(e) => {e.preventDefault(); handleConfirmDelete(idToDelete);}}>
          <p>¿Está seguro de que desea eliminar este usuario?</p>
        </ModalTemplate>
      )}
    </section>
  );
};

export default UsersPage;
