import {useState, useEffect, useMemo} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import ClientCard from "./ClientCard";
import ModalTemplate from "../ModalTemplate";
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

const Field = ({label, id, value, onChange, type = "text", required = false}) => (
  <div>
    <span className="pselect__label">{label}{required && <span className="text-danger ms-1">*</span>}</span>
    <div className="pdt-field">
      <input type={type} className="pdt-field__input" id={id} value={value} onChange={onChange} />
    </div>
  </div>
);

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

  const clientFields = [
    {id: "razon_social", label: "Razón Social", required: true},
    {id: "RFC", label: "RFC"},
    {id: "calle", label: "Calle"},
    {id: "num_ext", label: "Núm. Ext."},
    {id: "num_int", label: "Núm. Int."},
    {id: "colonia", label: "Colonia"},
    {id: "alcaldia", label: "Alcaldía"},
    {id: "ciudad", label: "Ciudad"},
    {id: "codigo_postal", label: "Código Postal"},
    {id: "clave_pais", label: "Clave País"},
  ];

  const contactFields = [
    {id: "c_nombres", label: "Nombres", required: true},
    {id: "c_apellidos", label: "Apellidos", required: true},
    {id: "c_email", label: "Email", type: "email", required: true},
    {id: "c_telefono", label: "Teléfono"},
    {id: "c_pais", label: "País"},
  ];

  const getFieldValue = (id) =>
    id.startsWith("c_") ? (formData.contacto[id.slice(2)] || "") : (formData[id] || "");

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
              <FilterBar>
                <div>
                  <span className="pselect__label">Buscar</span>
                  <div className="pdt-field">
                    <i className="fa fa-search pdt-field__icon"></i>
                    <input
                      type="text"
                      className="pdt-field__input"
                      placeholder="Razón social, RFC, ciudad, contacto…"
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

          <div className="cc-shell">
            {isLoading ? (
              <div className="cl-list">
                {Array.from({length: 6}).map((_, i) => (
                  <div key={i} className="cl-card cl-card--skeleton">
                    <div className="cl-card__header">
                      <div className="cl-card__header-left">
                        <div className="cc-skeleton cc-skeleton--line" style={{width: 36, height: 20, flexShrink: 0}}></div>
                        <div style={{display: "flex", flexDirection: "column", gap: 6}}>
                          <div className="cc-skeleton cc-skeleton--line" style={{width: `${140 + (i * 23) % 80}px`}}></div>
                          <div className="cc-skeleton cc-skeleton--line" style={{width: 72, height: 10}}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="cc-empty">
                <i className="fa fa-building cc-empty__icon"></i>
                <p className="cc-empty__text">{search ? "Sin resultados para tu búsqueda." : "No hay clientes registrados."}</p>
              </div>
            ) : (
              <div className="cl-list">
                {filteredClients.map((client) => (
                  <ClientCard
                    key={client._id}
                    client={client}
                    roleData={roleData}
                    onEdit={openEdit}
                    onDelete={openDelete}
                  />
                ))}
              </div>
            )}
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
          <div className="cc-modal-body">
            <p className="cc-modal-section-label">Datos del cliente</p>
            <div className="cc-modal-grid">
              {clientFields.map(({id, label, required}) => (
                <Field key={id} id={id} label={label} required={required} value={getFieldValue(id)} onChange={handleChange} />
              ))}
            </div>
            <p className="cc-modal-section-label" style={{marginTop: 20}}>Contacto</p>
            <div className="cc-modal-grid">
              {contactFields.map(({id, label, type, required}) => (
                <Field key={id} id={id} label={label} type={type} required={required} value={getFieldValue(id)} onChange={handleChange} />
              ))}
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
