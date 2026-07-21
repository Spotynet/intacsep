import React, {useState, useEffect} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import ClientCard from "./ClientCard";
import ModalTemplate from "../ModalTemplate";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";
import {convertToUpperCase} from "../../utils/utils";

const ClientsPage = () => {
  const [clients, setClients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // New state for edit mode
  const [currentClient, setCurrentClient] = useState(null); // State for the client being edited
  const [formData, setFormData] = useState({
    alcaldia: "",
    calle: "",
    ciudad: "",
    clave_pais: "",
    codigo_postal: "",
    colonia: "",
    num_ext: "",
    num_int: "",
    razon_social: "",
    RFC: "",
    contacto: {
      nombres: "",
      apellidos: "",
      telefono: "",
      email: "",
      pais: "",
    },
  });

  const baseUrl = import.meta.env.VITE_BASE_URL;

  const {user, verifyToken, setUser} = useAuth();
  const [roleData, setRoleData] = useState(null);
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();

  useEffect(() => {
    const init = async () => {
      try {
        const data = await verifyToken(); // Ensure user is verified
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

  // Fetch clients from the server
  const fetchClients = async () => {
    try {
      const response = await fetch(`${baseUrl}/clients`, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      } else {
        console.error("Failed to fetch clients:", response.statusText);
      }
    } catch (e) {
      console.error("Error fetching clients:", e);
    }
  };

  useEffect(() => {
    fetchClients(); // Fetch clients on component mount
  }, []);

  // Handle client deletion
  const handleDelete = async (id) => {
    fetchClients();
    try {
      const response = await fetch(`${baseUrl}/clients/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        // Fetch updated client list after deletion
        await fetchClients();
      } else {
        console.error("Failed to delete client:", response.statusText);
      }
    } catch (e) {
      console.error("Error deleting client:", e);
    }
  };

  // Toggle modal visibility
  const handleModalToggle = async () => {
    setShowModal(!showModal);
    if (showModal) {
      // Reset the form when closing the modal
      fetchClients();
      setFormData({
        alcaldia: "",
        calle: "",
        ciudad: "",
        clave_pais: "",
        codigo_postal: "",
        colonia: "",
        num_ext: "",
        num_int: "",
        razon_social: "",
        RFC: "",
        contacto: {
          nombres: "",
          apellidos: "",
          telefono: "",
          email: "",
          pais: "",
        },
      });

      setIsEditing(false);
      setCurrentClient(null);
      // Fetch updated client list after closing the modal
    }
  };

  // Prepare form data for editing
  const handleEdit = (client) => {
    setCurrentClient(client);
    setIsEditing(true);
    setFormData({
      ...client,
      contacto: client.contacto || {
        nombres: "",
        apellidos: "",
        telefono: "",
        email: "",
        pais: "",
      },
    });
    setShowModal(true);
  };

  // Handle form input changes
  const handleChange = (e) => {
    const {id, value} = e.target;
    if (id.startsWith("contacto_")) {
      setFormData((prevData) => ({
        ...prevData,
        contacto: {
          ...prevData.contacto,
          [id.replace("contacto_", "")]: value,
        },
      }));
    } else {
      setFormData((prevData) => ({
        ...prevData,
        [id]: value,
      }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const method = isEditing ? "PUT" : "POST"; // Determine method based on edit mode
      const url = isEditing ? `${baseUrl}/clients/${currentClient._id}` : `${baseUrl}/clients`;

      // Convert text fields to uppercase before sending
      // Exclude certain fields that should remain as-is (emails, phones, etc.)
      const excludeFields = ['_id', 'createdAt', 'updatedAt', 'contacto.email', 'contacto.telefono'];
      const uppercaseFormData = convertToUpperCase(formData, excludeFields);

      const response = await fetch(url, {
        method: method,
        headers: {"Content-Type": "application/json"},
        credentials: "include",
        body: JSON.stringify(uppercaseFormData),
      });

      if (response.ok) {
        const result = await response.json();
        if (isEditing) {
          setClients((prevClients) =>
            prevClients.map((client) => (client._id === result._id ? result : client))
          );
        } else {
          setClients((prevClients) => [...prevClients, result]);
        }
        handleModalToggle(); // Close the modal and refresh the list
      } else {
        const errorData = await response.json();
        console.error("Failed to save client:", errorData.message);
      }
    } catch (e) {
      console.error("Error saving client:", e);
    }
  };

  return (
    <section id="clientsPage">
      <div className="w-100 d-flex mt-0">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Catálogos - Clientes"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}>
            {roleData?.clientes?.create && (
              <button className="new-btn" onClick={() => setShowModal(true)}>
                <i className="fa fa-plus"></i>Crear
              </button>
            )}
          </PageHeader>

          {roleData?.clientes?.read && (
            <div className="mx-3 my-4">
              <div className="col">
                {clients.map((client) => (
                  <div className="col mb-4" key={client._id}>
                    <ClientCard
                      client={client}
                      onDelete={() => handleDelete(client._id)}
                      onEdit={() => handleEdit(client)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {showModal && (
            <ModalTemplate
              show
              title={isEditing ? "Editar Cliente" : "Crear Nuevo Cliente"}
              onClose={handleModalToggle}
              onSubmit={handleSubmit}>
              <div style={{maxHeight: "60vh", overflowY: "auto", paddingRight: "6px"}}>
                {/* Regular client fields */}
                <div className="mb-3">
                  <label htmlFor="razon_social" className="form-label">
                    Razón Social
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="razon_social"
                    value={formData.razon_social}
                    onChange={handleChange}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="RFC" className="form-label">
                    RFC
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="RFC"
                    value={formData.RFC}
                    onChange={handleChange}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="calle" className="form-label">
                    Calle
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="calle"
                    value={formData.calle}
                    onChange={handleChange}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="num_ext" className="form-label">
                    Número Ext.
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="num_ext"
                    value={formData.num_ext}
                    onChange={handleChange}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="num_int" className="form-label">
                    Número Int.
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="num_int"
                    value={formData.num_int}
                    onChange={handleChange}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="colonia" className="form-label">
                    Colonia
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="colonia"
                    value={formData.colonia}
                    onChange={handleChange}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="alcaldia" className="form-label">
                    Alcaldía
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="alcaldia"
                    value={formData.alcaldia}
                    onChange={handleChange}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="ciudad" className="form-label">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="ciudad"
                    value={formData.ciudad}
                    onChange={handleChange}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="codigo_postal" className="form-label">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="codigo_postal"
                    value={formData.codigo_postal}
                    onChange={handleChange}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="clave_pais" className="form-label">
                    Clave País
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="clave_pais"
                    value={formData.clave_pais}
                    onChange={handleChange}
                  />
                </div>

                <hr />
                <p className="fw-semibold">Contacto:</p>
                <hr />

                <div className="mb-3">
                  <label htmlFor="contacto_nombres" className="form-label">
                    Nombres
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="contacto_nombres"
                    value={formData.contacto.nombres}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="contacto_apellidos" className="form-label">
                    Apellidos
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="contacto_apellidos"
                    value={formData.contacto.apellidos}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="contacto_email" className="form-label">
                    Email
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    id="contacto_email"
                    value={formData.contacto.email}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="contacto_telefono" className="form-label">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="contacto_telefono"
                    value={formData.contacto.telefono}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="contacto_pais" className="form-label">
                    País
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="contacto_pais"
                    value={formData.contacto.pais}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </ModalTemplate>
          )}
        </div>
      </div>
    </section>
  );
};

export default ClientsPage;
