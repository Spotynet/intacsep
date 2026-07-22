import {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import ModalTemplate from "../ModalTemplate";
import CellBadge from "../CellBadge";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";

const fmt = (dt) =>
  dt ? new Date(dt).toLocaleString("es-MX", {dateStyle: "short", timeStyle: "short"}) : "—";

const emptyTransporteData = {lineaTransporte: "", operador: "", telefono: ""};

const BuscadorPlanPage = () => {
  const [query, setQuery]             = useState("");
  const [plan, setPlan]               = useState(null);
  const [searched, setSearched]       = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Modal state
  const [showModal, setShowModal]         = useState(false);
  const [transporteData, setTransporteData] = useState(emptyTransporteData);
  const [isStarting, setIsStarting]       = useState(false);
  const [startError, setStartError]       = useState("");

  // Success state
  const [started, setStarted] = useState(null); // { bitacora_id, bitacora_num_id }

  const [planPerms, setPlanPerms] = useState({
    linea_transporte: true,
    operador: true,
    telefono: true,
  });

  const {user} = useAuth();
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    fetch(`${baseUrl}/roles/${user.role}`, {credentials: "include"})
      .then((r) => r.json())
      .then((role) => {
        if (!role?.buscador_plan?.read) navigate("/");
        setPlanPerms({
          linea_transporte: role?.plan_linea_transporte ?? true,
          operador:         role?.plan_operador ?? true,
          telefono:         role?.plan_telefono ?? true,
        });
      })
      .catch(() => {});
  }, [user, baseUrl, navigate]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setIsSearching(true);
    setSearchError("");
    setPlan(null);
    setSearched(false);
    setStarted(null);

    try {
      const res = await fetch(
        `${baseUrl}/planes-embarque/search/carrier?carrierMove=${encodeURIComponent(q)}`,
        {credentials: "include"}
      );
      if (!res.ok) throw new Error("Error al buscar");
      const data = await res.json();
      setPlan(data);
      setSearched(true);
    } catch {
      setSearchError("Error de conexión. Intenta nuevamente.");
    } finally {
      setIsSearching(false);
    }
  };

  const openModal = () => {
    setTransporteData(emptyTransporteData);
    setStartError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setStartError("");
  };

  const handleFieldChange = (e) => {
    const {name, value} = e.target;
    setTransporteData((prev) => ({...prev, [name]: value}));
  };

  const isFormValid =
    (!planPerms.linea_transporte || transporteData.lineaTransporte.trim()) &&
    (!planPerms.operador         || transporteData.operador.trim()) &&
    (!planPerms.telefono         || transporteData.telefono.trim());
  const isPlanUsed = !!plan?.linked_bitacora;

  const handleConfirmStart = async (e) => {
    e.preventDefault();
    if (!plan || isPlanUsed || isStarting || !isFormValid) return;
    setIsStarting(true);
    setStartError("");
    try {
      const res = await fetch(`${baseUrl}/planes-embarque/${plan._id}/start`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "include",
        body: JSON.stringify({
          creado_por:      `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim(),
          lineaTransporte: planPerms.linea_transporte ? transporteData.lineaTransporte.trim() : "",
          operador:        planPerms.operador         ? transporteData.operador.trim()         : "",
          telefono:        planPerms.telefono         ? transporteData.telefono.trim()         : "",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Error al iniciar el plan");
      }
      const data = await res.json();
      setStarted(data);
      setShowModal(false);
    } catch (err) {
      setStartError(err.message);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <section id="buscadorPlanPage" className="settings-page">
      <div className="w-100 d-flex h-100 mt-0">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Buscador de Plan"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
          />

          <div className="buscador-plan-container">

            {/* ── Search box ── */}
            <form className="buscador-search-box" onSubmit={handleSearch}>
              <p className="buscador-search-label">Carrier Move</p>
              <div className="buscador-search-inner">
                <i className="fa fa-search buscador-search-icon"></i>
                <input
                  type="text"
                  className="buscador-search-input"
                  placeholder="Ej. CM-20240512-001"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (!e.target.value.trim()) {
                      setPlan(null);
                      setSearched(false);
                      setStarted(null);
                    }
                  }}
                  autoFocus
                />
                <button
                  type="submit"
                  className="buscador-search-btn"
                  disabled={isSearching || !query.trim()}>
                  {isSearching
                    ? <span className="spinner-border spinner-border-sm" />
                    : <><i className="fa fa-search me-1"></i>Buscar</>}
                </button>
              </div>
            </form>

            {/* ── Idle hint ── */}
            {!searched && !searchError && !started && (
              <div className="buscador-idle">
                <i className="fa-solid fa-barcode buscador-idle-icon"></i>
                <p className="buscador-idle-text">Ingresa un Carrier Move para buscar el plan de embarque</p>
              </div>
            )}

            {/* ── Search error ── */}
            {searchError && (
              <div className="buscador-error-state">
                <i className="fa-solid fa-triangle-exclamation buscador-error-icon"></i>
                <p className="buscador-error-text">{searchError}</p>
              </div>
            )}

            {/* ── Success ── */}
            {started && (
              <div className="buscador-success-card">
                <div className="buscador-success-icon">
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <h5 className="buscador-success-title">¡Plan iniciado correctamente!</h5>
                <p className="buscador-success-sub">
                  Bitácora <strong>#{started.bitacora_num_id}</strong> creada.
                </p>
                <button
                  className="buscador-new-search-btn"
                  onClick={() => {
                    setQuery("");
                    setPlan(null);
                    setSearched(false);
                    setStarted(null);
                  }}>
                  <i className="fa fa-search me-1"></i>Nueva búsqueda
                </button>
              </div>
            )}

            {/* ── Result card ── */}
            {!started && searched && (
              plan ? (
                <div
                  className={`buscador-result-card ${isPlanUsed ? "buscador-result-card--used" : ""}`}
                  onClick={() => { if (!isPlanUsed) openModal(); }}>
                  <div className="buscador-result-header">
                    <span className="buscador-carrier-badge">
                      <i className="fa-solid fa-barcode me-2"></i>
                      {plan.carrierMove}
                    </span>
                    <CellBadge label={plan.tipoViaje} variant="blue" />
                  </div>

                  <div className="buscador-result-body">
                    <div className="buscador-detail-row">
                      <span className="buscador-detail-label">
                        <i className="fa-solid fa-building me-1"></i>Cliente
                      </span>
                      <span className="buscador-detail-value">{plan.cliente?.razon_social ?? "—"}</span>
                    </div>
                    <div className="buscador-detail-row">
                      <span className="buscador-detail-label">
                        <i className="fa-solid fa-map-pin me-1"></i>Destino
                      </span>
                      <span className="buscador-detail-value">{plan.destino?.nombre ?? "—"}</span>
                    </div>
                    <div className="buscador-detail-row">
                      <span className="buscador-detail-label">
                        <i className="fa-solid fa-truck me-1"></i>Transporte
                      </span>
                      <span className="buscador-detail-value">{plan.transporte}</span>
                    </div>
                    <div className="buscador-detail-row">
                      <span className="buscador-detail-label">
                        <i className="fa-solid fa-box-open me-1"></i>Cita de Carga
                      </span>
                      <span className="buscador-detail-value">{fmt(plan.citaCarga)}</span>
                    </div>
                    <div className="buscador-detail-row">
                      <span className="buscador-detail-label">
                        <i className="fa-solid fa-clock me-1"></i>Hora de Salida
                      </span>
                      <span className="buscador-detail-value">{fmt(plan.horaSalida)}</span>
                    </div>
                  </div>

                  <div className="buscador-result-footer">
                    {isPlanUsed ? (
                      <span className="buscador-used-hint__text">
                        <i className="fa-solid fa-circle-info me-2"></i>
                        Ya se usó en una bitácora
                      </span>
                    ) : (
                      <span className="buscador-tap-hint">
                        <i className="fa-solid fa-hand-pointer me-2"></i>
                        Toca para iniciar este plan
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="buscador-not-found">
                  <i className="fa-solid fa-magnifying-glass-minus buscador-not-found-icon"></i>
                  <p className="buscador-not-found-text">No se encontró ningún plan con ese Carrier Move.</p>
                  <p className="buscador-not-found-sub">Verifica que el número sea exacto y vuelve a intentarlo.</p>
                </div>
              )
            )}

          </div>
        </div>
      </div>

      {/* ── Start modal ── */}
      {showModal && plan && (
        <ModalTemplate
          show={showModal}
          title="Iniciar Plan de Embarque"
          onClose={closeModal}
          onSubmit={handleConfirmStart}
          submitText={isStarting ? "Iniciando…" : "Confirmar inicio"}
          submitClass="btn btn-success"
          submitDisabled={isPlanUsed || isStarting || !isFormValid}
          cancelText="Cancelar"
          cancelClass="btn btn-outline-secondary">

          {startError && (
            <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
              <i className="fas fa-exclamation-circle"></i>
              <span>{startError}</span>
            </div>
          )}

          {/* Plan summary */}
          <div className="buscador-confirm-details mb-4">
            <div className="buscador-detail-row">
              <span className="buscador-detail-label">Carrier Move</span>
              <span className="buscador-detail-value fw-bold">{plan.carrierMove}</span>
            </div>
            <div className="buscador-detail-row">
              <span className="buscador-detail-label">Tipo de Viaje</span>
              <span className="buscador-detail-value">{plan.tipoViaje}</span>
            </div>
            <div className="buscador-detail-row">
              <span className="buscador-detail-label">Cliente</span>
              <span className="buscador-detail-value">{plan.cliente?.razon_social ?? "—"}</span>
            </div>
            <div className="buscador-detail-row">
              <span className="buscador-detail-label">Destino</span>
              <span className="buscador-detail-value">{plan.destino?.nombre ?? "—"}</span>
            </div>
            <div className="buscador-detail-row">
              <span className="buscador-detail-label">Transporte</span>
              <span className="buscador-detail-value">{plan.transporte}</span>
            </div>
          </div>

          {/* Transporte data fields */}
          {(planPerms.linea_transporte || planPerms.operador || planPerms.telefono) && (
            <>
              <p className="buscador-modal-section-label">Datos del transporte</p>
              <div className="d-flex flex-column gap-2">
                {planPerms.linea_transporte && (
                  <div>
                    <span className="pselect__label">Línea de Transporte <span className="text-danger">*</span></span>
                    <div className="pdt-field">
                      <i className="fa fa-truck pdt-field__icon"></i>
                      <input type="text" className="pdt-field__input" name="lineaTransporte" value={transporteData.lineaTransporte} onChange={handleFieldChange} placeholder="Ej. TRANSPORTES XYZ" autoComplete="off" />
                    </div>
                  </div>
                )}
                {planPerms.operador && (
                  <div>
                    <span className="pselect__label">Operador <span className="text-danger">*</span></span>
                    <div className="pdt-field">
                      <i className="fa fa-user pdt-field__icon"></i>
                      <input type="text" className="pdt-field__input" name="operador" value={transporteData.operador} onChange={handleFieldChange} placeholder="Nombre del operador" autoComplete="off" />
                    </div>
                  </div>
                )}
                {planPerms.telefono && (
                  <div>
                    <span className="pselect__label">Teléfono <span className="text-danger">*</span></span>
                    <div className="pdt-field">
                      <i className="fa fa-phone pdt-field__icon"></i>
                      <input type="tel" className="pdt-field__input" name="telefono" value={transporteData.telefono} onChange={handleFieldChange} placeholder="Ej. 55 1234 5678" autoComplete="off" />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </ModalTemplate>
      )}
    </section>
  );
};

export default BuscadorPlanPage;
