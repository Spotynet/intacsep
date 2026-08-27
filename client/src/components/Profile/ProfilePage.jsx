import React, {useState, useEffect} from "react";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";
import {useNavigate} from "react-router-dom";
import LoadingScreen from "../LoadingScreen";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import TextInput from "../TextInput";
import Toast from "../Toast";
import {useToast} from "../../hooks/useToast";

const ProfilePage = () => {
  const {user, verifyToken, setUser} = useAuth();
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const [initialized, setInitialized] = useState(false);
  const [formData, setFormData] = useState({
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const {toasts, showToast, removeToast} = useToast();
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_BASE_URL;

  const fetchUser = async () => {
    try {
      const data = await verifyToken();
      setUser(data);
      const response = await fetch(`${baseUrl}/user/${data.email}`, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const userData = await response.json();
        setFormData({
          password: userData.password || "",
          firstName: userData.firstName || "",
          lastName: userData.lastName || "",
          phone: userData.phone || "",
        });
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await fetchUser();
        setInitialized(true);
      } catch (e) {
        navigate("/login");
      }
    };
    init();
  }, []);

  if (!initialized || !user) {
    return <LoadingScreen />;
  }

  const handleChange = (e) => {
    const {name, value} = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch(`${baseUrl}/users/${user._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include",
      });

      if (response.ok) {
        await verifyToken();
        setUser((prev) => ({
          ...prev,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
        }));
        showToast("Perfil actualizado correctamente", "success");
      } else {
        showToast("Error al actualizar el perfil", "error");
      }
    } catch (error) {
      showToast("Error de conexión", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="profilePage" className="settings-page">
      <div className="w-100 d-flex h-100 mt-0">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Mi Perfil"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
          />

          <div className="settings-content">
            <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
              <div className="card-header bg-white border-0 pt-4 px-4">
                <h5 className="mb-0 fw-bold">Información Personal</h5>
                <p className="text-muted small mb-0">Actualiza tus datos de contacto y contraseña</p>
              </div>
              <div className="card-body p-4">
                <form onSubmit={handleSubmit}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <TextInput
                        label="Nombre"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <TextInput
                        label="Apellido"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <TextInput
                        label="Teléfono"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <TextInput
                        label="Contraseña"
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="col-md-6">
                      <TextInput
                        label="Email (No editable)"
                        value={user.email}
                        disabled
                      />
                    </div>
                    <div className="col-md-6">
                      <TextInput
                        label="Rol (No editable)"
                        value={user.role}
                        disabled
                      />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-top d-flex justify-content-end">
                    <button
                      type="submit"
                      className="btn btn-primary px-4 py-2 rounded-3 fw-bold"
                      disabled={submitting}>
                      {submitting ? (
                        <>
                          <i className="fa fa-spinner fa-spin me-2"></i>
                          Guardando...
                        </>
                      ) : (
                        <>
                          <i className="fa fa-save me-2"></i>
                          Guardar Cambios
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Toast toasts={toasts} removeToast={removeToast} />
    </section>
  );
};

export default ProfilePage;
