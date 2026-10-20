import {useState, useEffect, useMemo} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import ModalTemplate from "../ModalTemplate";
import DataTable from "../DataTable";
import FilterBar from "../FilterBar";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";
import {convertToUpperCase} from "../../utils/utils";

const emptyForm = {
  alcaldia: "", calle: "", ciudad: "", clave_pais: "", codigo_postal: "",
  colonia: "", num_ext: "", num_int: "", razon_social: "", RFC: "",
  contacto: {nombres: "", apellidos: "", telefono: "", email: "", pais: ""},
};

const emptyContact = {nombres: "", apellidos: "", telefono: "", email: "", pais: ""};

const ClientsPage = () => {
  const [clients, setClients]       = useState([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditing, setIsEditing]   = useState(false);
  const [currentClient, setCurrentClient] = useState(null);
  const [formData, setFormData]     = useState(emptyForm);
  const [search, setSearch]         = useState("");

  const baseUrl = import.meta.env.VITE_BASE_URL;
  const {user, verifyToken, setUser} = useAuth();
  const [roleData, setRoleData] = useState(() => {
    try { const s = localStorage.getItem("sidebar-role"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();

  useEffect(() => {
    verifyToken().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.role) return;
    fetch(`${baseUrl}/roles/${user.role}`, {credentials: "include"})
      .then((r) => r.json())
      .then(setRoleData)
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetch(`${baseUrl}/clients`, {credentials: "include"})
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setClients(data); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      (c.razon_social || "").toLowerCase().includes(q) ||
      (c.RFC || "").toLowerCase().includes(q) ||
      (c.ciudad || "").toLowerCase().includes(q) ||
      (c.contacto?.nombres || "").toLowerCase().includes(q) ||
      (c.contacto?.apellidos || "").toLowerCase().includes(q) ||
      (c.contacto?.email || "").toLowerCase().includes(q)
    );
  }, [clients, search]);

  const openCreate = () => {
    setIsEditing(false);
    setCurrentClient(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (client) => {
    setIsEditing(true);
    setCurrentClient(client);
    setFormData({...client, contacto: {...emptyContact, ...client.contacto}});
    setShowModal(true);
  };

  const openDelete = (client) => {
    setCurrentClient(client);
    setShowDeleteModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setCurrentClient(null);
  };

  const handleChange = (e) => {
    const {id, value} = e.target;
    if (id.startsWith("c_")) {
      setFormData((p) => ({...p, contacto: {...p.contacto, [id.slice(2)]: value}}));
    } else {
      setFormData((p) => ({...p, [id]: value}));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const excludeFields = ["_id", "createdAt", "updatedAt", "contacto.email", "contacto.telefono"];
    const payload = convertToUpperCase(formData, excludeFields);
    const method = isEditing ? "PUT" : "POST";
    const url = isEditing ? `${baseUrl}/clients/${currentClient._id}` : `${baseUrl}/clients`;
    try {
      const res = await fetch(url, {
        method, credentials: "include",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      const result = await res.json();
      setClients((prev) =>
        isEditing ? prev.map((c) => (c._id === result._id ? result : c)) : [...prev, result]
      );
      closeModal();
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmDelete = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${baseUrl}/clients/${currentClient._id}`, {method: "DELETE", credentials: "include"});
      if (res.ok) {
        setClients((prev) => prev.filter((c) => c._id !== currentClient._id));
        setShowDeleteModal(false);
        setCurrentClient(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const hasActiveFilters = !!search;

  const columns = [
    {
      key: "ID_Cliente",
      header: "ID",
      width: "60px",
      className: "text-center fw-bold",
      render: (row) => String(row.ID_Cliente || "").padStart(4, "0"),
    },
    {key: "razon_social", header: "Razón Social"},
    {key: "RFC", header: "RFC"},
    {key: "ciudad", header: "Ciudad"},
    {
      key: "contacto",
      header: "Contacto",
      render: (row) => [row.contacto?.nombres, row.contacto?.apellidos].filter(Boolean).join(" ") || "—",
    },
  ];

  const actions = [
    {
      icon: "fas fa-edit",
      className: "action-btn btn-primary",
      title: "Editar",
      show: roleData?.clientes?.update,
      onClick: (row) => openEdit(row),
    },
    {
      icon: "fas fa-trash",
      className: "action-btn btn-danger",
      title: "Eliminar",
      show: roleData?.clientes?.delete,
      onClick: (row) => openDelete(row),
    },
  ];

  return (
    <section id="clientsPage" className="settings-page">
      <div className="w-100 d-flex h-100 mt-0">
        <div className="sidebar-wrapper"><Sidebar /></div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Catálogos - Clientes"
            count={filteredClients.length}
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={() => setSearch("")}
            filters={
              <FilterBar onClear={() => setSearch("")}>
                <div>
                  <span className="pselect__label">Buscar</span>
                  <div className="pdt-field">
                    <i className="fa fa-search pdt-field__icon"></i>
                    <input
                      type="text"
                      className="pdt-field__input"
                      placeholder="Razón social, RFC, ciudad..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
              </FilterBar>
            }
          >
            {roleData?.clientes?.create && (
              <button className="new-btn" onClick={openCreate}>
                <i className="fa fa-plus"></i>Crear
              </button>
            )}
          </PageHeader>

          <div className="bits-table-shell">
            <DataTable
              loading={isLoading}
              maxHeight="100%"
              data={filteredClients}
              columns={columns}
              actions={actions}
              emptyMessage="No se encontraron clientes que coincidan con los filtros."
            />
          </div>
        </div>
      </div>

      {/* Create / Edit modal */}
      {showModal && (
        <ModalTemplate
          show
          title={isEditing ? "Editar Cliente" : "Nuevo Cliente"}
          onClose={closeModal}
          onSubmit={handleSubmit}>
          <div className="cc-modal-body" style={{maxHeight: "60vh", overflowY: "auto", paddingRight: "6px"}}>
            <p className="cc-modal-section-label">Datos del cliente</p>
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label htmlFor="razon_social" className="form-label">Razón Social *</label>
                <input type="text" className="form-control" id="razon_social" value={formData.razon_social} onChange={handleChange} required />
              </div>
              <div className="col-md-6">
                <label htmlFor="RFC" className="form-label">RFC</label>
                <input type="text" className="form-control" id="RFC" value={formData.RFC} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label htmlFor="calle" className="form-label">Calle</label>
                <input type="text" className="form-control" id="calle" value={formData.calle} onChange={handleChange} />
              </div>
              <div className="col-md-3">
                <label htmlFor="num_ext" className="form-label">Núm. Ext.</label>
                <input type="text" className="form-control" id="num_ext" value={formData.num_ext} onChange={handleChange} />
              </div>
              <div className="col-md-3">
                <label htmlFor="num_int" className="form-label">Núm. Int.</label>
                <input type="text" className="form-control" id="num_int" value={formData.num_int} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label htmlFor="colonia" className="form-label">Colonia</label>
                <input type="text" className="form-control" id="colonia" value={formData.colonia} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label htmlFor="alcaldia" className="form-label">Alcaldía</label>
                <input type="text" className="form-control" id="alcaldia" value={formData.alcaldia} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label htmlFor="ciudad" className="form-label">Ciudad</label>
                <input type="text" className="form-control" id="ciudad" value={formData.ciudad} onChange={handleChange} />
              </div>
              <div className="col-md-3">
                <label htmlFor="codigo_postal" className="form-label">C.P.</label>
                <input type="text" className="form-control" id="codigo_postal" value={formData.codigo_postal} onChange={handleChange} />
              </div>
              <div className="col-md-3">
                <label htmlFor="clave_pais" className="form-label">País</label>
                <input type="text" className="form-control" id="clave_pais" value={formData.clave_pais} onChange={handleChange} />
              </div>
            </div>

            <p className="cc-modal-section-label">Contacto</p>
            <div className="row g-3">
              <div className="col-md-6">
                <label htmlFor="c_nombres" className="form-label">Nombres *</label>
                <input type="text" className="form-control" id="c_nombres" value={formData.contacto.nombres} onChange={handleChange} required />
              </div>
              <div className="col-md-6">
                <label htmlFor="c_apellidos" className="form-label">Apellidos *</label>
                <input type="text" className="form-control" id="c_apellidos" value={formData.contacto.apellidos} onChange={handleChange} required />
              </div>
              <div className="col-md-6">
                <label htmlFor="c_email" className="form-label">Email *</label>
                <input type="email" className="form-control" id="c_email" value={formData.contacto.email} onChange={handleChange} required />
              </div>
              <div className="col-md-6">
                <label htmlFor="c_telefono" className="form-label">Teléfono</label>
                <input type="text" className="form-control" id="c_telefono" value={formData.contacto.telefono} onChange={handleChange} />
              </div>
            </div>
          </div>
        </ModalTemplate>
      )}

      {/* Delete modal */}
      {showDeleteModal && currentClient && (
        <ModalTemplate
          show
          title="Eliminar Cliente"
          onClose={() => { setShowDeleteModal(false); setCurrentClient(null); }}
          onSubmit={handleConfirmDelete}
          submitText="Eliminar"
          submitClass="btn btn-danger">
          <p>¿Confirmas que deseas eliminar a <strong>{currentClient.razon_social}</strong>? Esta acción no se puede deshacer.</p>
        </ModalTemplate>
      )}
    </section>
  );
};

export default ClientsPage;
