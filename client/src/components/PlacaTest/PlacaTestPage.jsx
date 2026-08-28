import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import FilterBar from "../FilterBar";
import ModalTemplate from "../ModalTemplate";
import DataTable from "../DataTable";
import CellBadge from "../CellBadge";
import {Select} from "../Select";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import { fetchLineasTransporte } from "../../utils/api";

const baseUrl = import.meta.env.VITE_BASE_URL;

const MAX_PX = 1024;
const compressImage = (file) =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.85);
      } catch (err) {
        console.warn("Canvas compression failed:", err);
        resolve(file);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

const formatDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

const ConfidenceBadge = ({ value }) => {
  if (value == null) return <CellBadge label="N/A" variant="gray" />;
  if (value >= 85) return <CellBadge label={`Alta (${value.toFixed(1)}%)`} variant="green" />;
  if (value >= 60) return <CellBadge label={`Media (${value.toFixed(1)}%)`} variant="yellow" />;
  return <CellBadge label={`Baja (${value.toFixed(1)}%)`} variant="red" />;
};

const SwapBadge = ({ record }) => {
  if (record.hubo_cambio_remolque === null || record.hubo_cambio_remolque === undefined) {
    return record.placa_remolque_entrada
      ? <CellBadge label="En patio" variant="blue" />
      : <span className="text-muted small">—</span>;
  }
  if (record.hubo_cambio_remolque === false)
    return <CellBadge label="Salió igual" variant="green" />;
  return <CellBadge label="Cambio remolque" variant="yellow" />;
};

const PlacaTestPage = () => {
  const { user, verifyToken, setUser } = useAuth();
  const { isSidebarCollapsed, setIsMobileSidebarOpen } = useSidebar();
  const navigate = useNavigate();

  const openCameraInput = (handler) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
    document.body.appendChild(input);

    const cleanup = () => {
      if (document.body.contains(input)) document.body.removeChild(input);
      window.removeEventListener("popstate", onPopState);
    };

    // Android Chrome pushes a history entry when the camera activity opens.
    // When the camera closes it pops that entry, which React Router intercepts
    // as a back-navigation. We push a dummy state first so the pop is absorbed
    // here instead of reaching the router.
    const onPopState = (e) => {
      if (e.state?.__cameraGuard) {
        // camera closed without selecting — just clean up
        cleanup();
      }
    };
    window.addEventListener("popstate", onPopState);
    history.pushState({ __cameraGuard: true }, "");

    input.addEventListener("change", (e) => {
      // Pop our guard state so browser history stays clean
      if (history.state?.__cameraGuard) history.back();
      handler(e);
      // Defer removal so Android doesn't treat the DOM mutation as navigation
      setTimeout(cleanup, 100);
    });

    input.addEventListener("cancel", () => {
      if (history.state?.__cameraGuard) history.back();
      setTimeout(cleanup, 100);
    });

    input.click();
  };
  const [capturedDataUrl, setCapturedDataUrl] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [error, setError] = useState("");
  const [savedRecords, setSavedRecords] = useState([]);
  const [remolqueRecords, setRemolqueRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState(() => ({
    placa: "",
    linea: "",
    status: "En patio",
    fechaDesde: "",
    fechaHasta: ""
  }));
  const handleFilterChange = (e) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const clearFilters = () => {
    setFilters({
      placa: "",
      linea: "",
      status: "En patio",
      fechaDesde: "",
      fechaHasta: ""
    });
  };
  const hasActiveFilters = useMemo(() => {
    return !!(filters.placa || filters.linea || filters.status !== "En patio" || 
             filters.fechaDesde || filters.fechaHasta);
  }, [filters]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [idToDelete, setIdToDelete] = useState(null);
  const [selectedRecordForSalida, setSelectedRecordForSalida] = useState(null);
  const [isSmartMode, setIsSmartMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState("tractos");
  const [highlightedId, setHighlightedId] = useState(null);

  const [lineasTransporte, setLineasTransporte] = useState([]);
  const [roleData, setRoleData] = useState(null);
  const [formData, setFormData] = useState({
    placa: "",
    placaRemolque: "",
    lineaTransporte: "",
    hasRemolque: false,
    cliente: "",
    timestamp: "",
  });

  const isSmartModeRef = useRef(isSmartMode);
  const selectedRecordRef = useRef(selectedRecordForSalida);
  const savedRecordsRef = useRef(savedRecords);
  useEffect(() => { isSmartModeRef.current = isSmartMode; }, [isSmartMode]);
  useEffect(() => { selectedRecordRef.current = selectedRecordForSalida; }, [selectedRecordForSalida]);
  useEffect(() => { savedRecordsRef.current = savedRecords; }, [savedRecords]);

  useEffect(() => {
    const init = async () => {
      try {
        const userData = await verifyToken();
        setUser(userData);
        const roleRes = await fetch(`${baseUrl}/roles/${userData.role}`, { credentials: "include" });
        const role = await roleRes.json();
        setRoleData(role);
        if (!role?.control_patios?.read) { navigate("/"); return; }

        let lineas;
        if (role.client_access === "specific" && role.allowed_clients) {
          const promises = role.allowed_clients.map(ac => fetchLineasTransporte(ac.client_name));
          const results = await Promise.all(promises);
          lineas = Array.from(new Set(results.flat().map(l => JSON.stringify(l)))).map(s => JSON.parse(s));
        } else {
          lineas = await fetchLineasTransporte();
        }
        setLineasTransporte(lineas);
      } catch (e) {
        console.log("Error initializing:", e);
        navigate("/login");
      }
    };
    init();
  }, []);

  const loadSavedRecords = useCallback(async () => {
    try {
      const [tractorRes, remolqueRes] = await Promise.all([
        fetch(`${baseUrl}/control-patios`, { credentials: "include" }),
        fetch(`${baseUrl}/remolque-visitas`, { credentials: "include" }),
      ]);
      if (tractorRes.ok) {
        const data = await tractorRes.json();
        if (roleData?.client_access === "specific" && roleData?.allowed_clients) {
          const allowedNames = roleData.allowed_clients.map(ac => ac.client_name);
          setSavedRecords(data.filter(r => !r.cliente || allowedNames.includes(r.cliente)));
        } else {
          setSavedRecords(data);
        }
      }
      if (remolqueRes.ok) {
        const data = await remolqueRes.json();
        setRemolqueRecords(data);
      }
    } catch (e) {
      console.error("Error loading records:", e);
    } finally {
      setIsLoading(false);
    }
  }, [roleData]);

  useEffect(() => {
    if (user && roleData) loadSavedRecords();
  }, [user, roleData, loadSavedRecords]);

  const remolquesEnPatio = remolqueRecords.filter(r => r.status === "En patio");

  const handleOpenModal = (record = null, mode = "salida") => {
    if (record && record._id) {
      if (mode === "edit") {
        setIsEditMode(true);
        setSelectedRecordForSalida(null);
        setIsSmartMode(false);
        setFormData({ placa: record.placa, placaRemolque: record.placa_remolque_entrada || "", lineaTransporte: record.linea_transporte, hasRemolque: false, cliente: record.cliente, timestamp: record.fecha_hora_inicio, _id: record._id });
      } else {
        setIsEditMode(false);
        setSelectedRecordForSalida(record);
        setIsSmartMode(false);
        setFormData({ placa: "", placaRemolque: "", lineaTransporte: record.linea_transporte, hasRemolque: false, cliente: record.cliente, timestamp: new Date().toISOString() });
      }
    } else {
      setIsEditMode(false);
      setSelectedRecordForSalida(null);
      setIsSmartMode(true);
      setFormData({ placa: "", placaRemolque: "", lineaTransporte: "", hasRemolque: false, cliente: "", timestamp: new Date().toISOString() });
    }
    setCapturedDataUrl(null);
    setCapturedBlob(null);
    setOcrResult(null);
    setError("");
    setShowModal(true);
  };

  const handleImageSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setOcrResult(null);
    setError("");
    setOcrLoading(true);
    const compressed = await compressImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCapturedDataUrl(ev.target.result);
    reader.readAsDataURL(compressed);
    setCapturedBlob(compressed);
    readPlate(compressed, "tractor");
  };

  const handleRemolqueImageSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setOcrLoading(true);
    const compressed = await compressImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCapturedDataUrl(ev.target.result);
    reader.readAsDataURL(compressed);
    readPlate(compressed, "remolque");
  };

  const readPlate = async (blob, target = "tractor") => {
    if (!blob) { setError("No hay imagen para procesar."); return; }
    setOcrLoading(true);
    if (target === "tractor") { setOcrResult(null); setError(""); }
    try {
      const fd = new FormData();
      fd.append("image", blob, "plate.jpg");
      const response = await fetch(`${baseUrl}/plates/test-scan`, { method: "POST", body: fd, credentials: "include" });
      const data = await response.json();
      if (!response.ok) { setError(data?.message || `Error ${response.status} al leer la placa.`); return; }
      if (!data.success || !data.plate) {
        setError("No se detectó ninguna placa en la imagen.");
        return;
      }
      const detectedPlate = data.plate.toUpperCase();
      if (target === "remolque") {
        setFormData(prev => ({ ...prev, placaRemolque: detectedPlate }));
        return;
      }
      // tractor
      if (target === "tractor") setOcrResult(data);
      if (isSmartModeRef.current) {
        const activeRecord = savedRecordsRef.current.find(r => r.placa.toUpperCase() === detectedPlate && !r.fecha_hora_salida);
        if (activeRecord) {
          setPendingExit(activeRecord);
        } else {
          setSelectedRecordForSalida(null);
          setFormData(prev => ({ ...prev, placa: detectedPlate }));
        }
      } else {
        const sel = selectedRecordRef.current;
        if (sel && detectedPlate !== sel.placa.toUpperCase()) {
          setError(`La placa detectada (${detectedPlate}) no coincide con la registrada (${sel.placa.toUpperCase()}).`);
        } else {
          setFormData(prev => ({ ...prev, placa: detectedPlate }));
        }
      }
    } catch (e) {
      console.error("OCR error:", e);
      setError(e?.message || "Error al contactar el servicio OCR.");
    } finally {
      setOcrLoading(false);
    }
  };

  const [saving, setSaving] = useState(false);
  const [pendingExit, setPendingExit] = useState(null);

  const savePlate = async () => {
    if (!formData.placa || !formData.lineaTransporte) return;
    if (!isSalidaMode && formData.hasRemolque && !formData.placaRemolque) {
      setError("Si incluyes remolque, debes ingresar su placa.");
      return;
    }
    if (!isSalidaMode && formData.hasRemolque && formData.placaRemolque && formData.placa.toUpperCase() === formData.placaRemolque.toUpperCase()) {
      setError("La placa del remolque no puede ser igual a la placa del tracto.");
      return;
    }

    setSaving(true);
    try {
      if (isEditMode && formData._id) {
        const response = await fetch(`${baseUrl}/control-patios/${formData._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placa: formData.placa, linea_transporte: formData.lineaTransporte }),
          credentials: "include",
        });
        if (response.ok) { loadSavedRecords(); setShowModal(false); }
        else { const e = await response.json(); setError(e.error || "Error al actualizar el registro."); }
      } else if (isSalidaMode) {
        const response = await fetch(`${baseUrl}/control-patios/${selectedRecordForSalida._id}/salida`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fecha_hora_salida: formData.timestamp }),
          credentials: "include",
        });
        if (!response.ok) { const e = await response.json(); setError(e.error || "Error al registrar la salida."); return; }

        // If checkbox checked, also close the remolque that matches the entered plate
        if (formData.hasRemolque && formData.placaRemolque) {
          const remolqueRecord = remolqueRecords.find(r =>
            r.placa.toUpperCase() === formData.placaRemolque.toUpperCase() && r.status === "En patio"
          );
          if (remolqueRecord) {
            await fetch(`${baseUrl}/remolque-visitas/${remolqueRecord._id}/salida`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fecha_hora_salida: formData.timestamp,
                linea_transporte: formData.lineaTransporte || null,
              }),
              credentials: "include",
            });
          }
        }

        loadSavedRecords(); setShowModal(false);
      } else {
        let clientToSave = "";
        if (roleData?.client_access === "specific" && roleData?.allowed_clients?.length > 0) {
          clientToSave = roleData.allowed_clients[0].client_name;
        }
        const response = await fetch(`${baseUrl}/control-patios`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            placa: formData.placa,
            placa_remolque: formData.hasRemolque && formData.placaRemolque ? formData.placaRemolque : null,
            remolque_linea_transporte: formData.hasRemolque ? formData.lineaTransporte : null,
            linea_transporte: formData.lineaTransporte,
            cliente: clientToSave,
            fecha_hora_inicio: formData.timestamp,
            confidence: typeof ocrResult?.confidence === "number" ? ocrResult.confidence : null,
          }),
          credentials: "include",
        });
        if (response.ok) { loadSavedRecords(); setShowModal(false); }
        else { const e = await response.json(); setError(e.error || "Error al guardar el registro."); }
      }
    } catch (e) {
      console.error("Error saving record:", e);
      setError("Error de conexión al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = (id, type) => { setIdToDelete({ id, type }); setShowDeleteModal(true); };

  const handleConfirmDelete = async () => {
    if (!idToDelete) return;
    try {
      const endpoint = idToDelete.type === "remolque" ? "remolque-visitas" : "control-patios";
      const response = await fetch(`${baseUrl}/${endpoint}/${idToDelete.id}`, { method: "DELETE", credentials: "include" });
      if (response.ok) { loadSavedRecords(); setShowDeleteModal(false); setIdToDelete(null); }
      else { const e = await response.json(); alert(e.error || "Error al eliminar el registro."); }
    } catch (e) {
      console.error("Error deleting entry:", e);
      alert("Error de conexión al eliminar.");
    }
  };

  const closeModal = () => {
    setCapturedDataUrl(null); setCapturedBlob(null); setOcrResult(null); setError("");
    setIsEditMode(false); setSelectedRecordForSalida(null);
    setShowModal(false);
  };

  if (!user) return <div>Cargando...</div>;

  const canSave = !!formData.placa;

  const isSalidaMode = !!selectedRecordForSalida;
  const modalTitle = isEditMode ? "Editar registro" : isSalidaMode ? "Registrar salida" : "Nuevo registro";
  const submitText = saving ? "Guardando..." : isEditMode ? "Actualizar" : isSalidaMode ? "Registrar salida" : "Registrar ingreso";

  const tractosEnPatio = savedRecords.filter(r => r.status === "En patio").length;

  const applyDateFilter = (dateStr, desde, hasta) => {
    if (!dateStr) return !desde && !hasta;
    const d = new Date(dateStr);
    if (desde && d < new Date(desde)) return false;
    if (hasta && d > new Date(hasta + "T23:59:59")) return false;
    return true;
  };

  const filteredTractores = savedRecords.filter(r => {
    const matchPlaca = !filters.placa || r.placa?.toLowerCase().includes(filters.placa.toLowerCase()) || r.placa_remolque_entrada?.toLowerCase().includes(filters.placa.toLowerCase()) || r.placa_remolque_salida?.toLowerCase().includes(filters.placa.toLowerCase());
    const matchLinea = !filters.linea || r.linea_transporte === filters.linea;
    const matchStatus = !filters.status || r.status === filters.status;
    const matchDate = applyDateFilter(r.fecha_hora_inicio, filters.fechaDesde, filters.fechaHasta);
    return matchPlaca && matchLinea && matchStatus && matchDate;
  });
  const filteredRemolques = remolqueRecords.filter(r => {
    const matchPlaca = !filters.placa || r.placa?.toLowerCase().includes(filters.placa.toLowerCase()) || r.tractor_entrada_placa?.toLowerCase().includes(filters.placa.toLowerCase()) || r.tractor_salida_placa?.toLowerCase().includes(filters.placa.toLowerCase());
    const matchLinea = !filters.linea || r.linea_de_transporte === filters.linea || r.linea_transporte === filters.linea;
    const matchStatus = !filters.status || r.status === filters.status;
    const matchDate = applyDateFilter(r.fecha_hora_entrada, filters.fechaDesde, filters.fechaHasta);
    return matchPlaca && matchLinea && matchStatus && matchDate;
  });

  const navigateToRemolque = (placa) => {
    if (!placa) return;
    const rec = remolqueRecords.find(r => r.placa?.toUpperCase() === placa.toUpperCase());
    if (!rec) return;
    setHighlightedId(rec._id);
    setActiveTab("remolques");
  };
  const navigateToTracto = (placa) => {
    if (!placa) return;
    const rec = savedRecords.find(r => r.placa?.toUpperCase() === placa.toUpperCase());
    if (!rec) return;
    setHighlightedId(rec._id);
    setActiveTab("tractos");
  };

  const tractoColumns = [
    { key: "placa", header: "Placa", className: "fw-bold text-uppercase" },
    { key: "linea_transporte", header: "Línea", render: (row) => row.linea_transporte || <span className="text-muted">—</span> },
    { key: "remolque_entrada", header: "Remolque entrada", render: (row) => row.placa_remolque_entrada ? <CellBadge label={row.placa_remolque_entrada} variant="blue" onClick={() => navigateToRemolque(row.placa_remolque_entrada)} /> : <span className="text-muted">—</span> },
    { key: "remolque_salida", header: "Remolque salida", render: (row) => row.fecha_hora_salida ? (row.placa_remolque_salida ? <CellBadge label={row.placa_remolque_salida} variant="blue" onClick={() => navigateToRemolque(row.placa_remolque_salida)} /> : <span className="text-muted">Sin remolque</span>) : <span className="text-muted">—</span> },
    { key: "fecha_hora_inicio", header: "Entrada", render: (row) => formatDate(row.fecha_hora_inicio) },
    {
      key: "fecha_hora_salida",
      header: "Salida",
      render: (row) => row.fecha_hora_salida
        ? formatDate(row.fecha_hora_salida)
        : roleData?.control_patios?.update ? <button className="salida-btn" onClick={() => handleOpenModal(row)}><i className="fa fa-sign-out-alt"></i>Marcar salida</button> : <span className="text-muted">—</span>,
    },
    { key: "status", header: "Estado", render: (row) => <CellBadge label={row.status} variant={row.status === "En patio" ? "blue" : "green"} /> },
    { key: "swap", header: "Cambio remolque", render: (row) => <SwapBadge record={row} /> },
    {
      key: "acciones", header: "Acciones", headerClassName: "text-end", width: "8%",
      render: (row) => (
        <div className="d-flex justify-content-end gap-2">
          {roleData?.control_patios?.update && <button className="action-btn btn-primary" title="Editar" onClick={() => handleOpenModal(row, "edit")}><i className="fas fa-edit"></i></button>}
          {roleData?.control_patios?.delete && <button className="action-btn btn-danger" title="Eliminar" onClick={() => deleteEntry(row._id, "tractor")}><i className="fas fa-trash"></i></button>}
        </div>
      ),
    },
  ];

  const remolqueColumns = [
    { key: "placa", header: "Placa", className: "fw-bold text-uppercase" },
    { key: "tracto_entrada", header: "Tracto entrada", render: (row) => row.tractor_entrada_placa ? <CellBadge label={row.tractor_entrada_placa} variant="blue" onClick={() => navigateToTracto(row.tractor_entrada_placa)} /> : <span className="text-muted">—</span> },
    { key: "tracto_salida", header: "Tracto salida", render: (row) => row.fecha_hora_salida ? (row.tractor_salida_placa ? <CellBadge label={row.tractor_salida_placa} variant="blue" onClick={() => navigateToTracto(row.tractor_salida_placa)} /> : <span className="text-muted">—</span>) : <span className="text-muted">—</span> },
    { key: "fecha_hora_entrada", header: "Entrada", render: (row) => formatDate(row.fecha_hora_entrada) },
    { key: "fecha_hora_salida", header: "Salida", render: (row) => row.fecha_hora_salida ? formatDate(row.fecha_hora_salida) : <CellBadge label="En patio" variant="blue" /> },
    { key: "status", header: "Estado", render: (row) => <CellBadge label={row.status} variant={row.status === "En patio" ? "blue" : "green"} /> },
    { key: "cambio_tracto", header: "Cambio tracto", render: (row) => row.hubo_cambio_tractor === true ? <CellBadge label="Sí" variant="yellow" /> : row.hubo_cambio_tractor === false ? <CellBadge label="No" variant="green" /> : <span className="text-muted small">—</span> },
    {
      key: "acciones", header: "Acciones", headerClassName: "text-end", width: "8%",
      render: (row) => (
        <div className="d-flex justify-content-end gap-2">
          {roleData?.control_patios_remolques?.delete && <button className="action-btn btn-danger" title="Eliminar" onClick={() => deleteEntry(row._id, "remolque")}><i className="fas fa-trash"></i></button>}
        </div>
      ),
    },
  ];

  return (
    <section id="placaTestPage" className="settings-page">
      <div className="w-100 d-flex h-100 mt-0">
        <div className="sidebar-wrapper"><Sidebar /></div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Control de patios"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            filters={
              <FilterBar>
                <div>
                  <span className="pselect__label">Placa</span>
                  <div className="pdt-field">
                    <i className="fa fa-search pdt-field__icon"></i>
                    <input type="text" className="pdt-field__input" placeholder="Buscar..." name="placa" value={filters.placa} onChange={handleFilterChange} />
                  </div>
                </div>
                <div>
                  <Select
                    label="Línea de transporte"
                    placeholder="Todas las líneas"
                    value={filters.linea || null}
                    onChange={(v) => setFilters(p => ({...p, linea: v ?? ""}))}
                    options={lineasTransporte.map(l => ({value: l.nombre, label: l.nombre}))}
                  />
                </div>
                <div>
                  <Select
                    label="Estado"
                    placeholder="Todos los estados"
                    value={filters.status || null}
                    onChange={(v) => setFilters(p => ({...p, status: v ?? ""}))}
                    options={[{value: "En patio", label: "En patio"}, {value: "Salida", label: "Salida"}]}
                  />
                </div>
                <div>
                  <span className="pselect__label">Desde</span>
                  <div className="pdt-field">
                    <i className="fa fa-calendar pdt-field__icon"></i>
                    <input type="date" className="pdt-field__input" name="fechaDesde" value={filters.fechaDesde} onChange={handleFilterChange} />
                  </div>
                </div>
                <div>
                  <span className="pselect__label">Hasta</span>
                  <div className="pdt-field">
                    <i className="fa fa-calendar pdt-field__icon"></i>
                    <input type="date" className="pdt-field__input" name="fechaHasta" value={filters.fechaHasta} onChange={handleFilterChange} />
                  </div>
                </div>
              </FilterBar>
            }
          >
            {roleData?.control_patios?.create && (
              <button className="new-btn" onClick={() => handleOpenModal()} title="Nuevo registro">
                <i className="fa fa-plus"></i>Crear
              </button>
            )}
          </PageHeader>

          <div className="patio-shell">
            <div className="patio-tab-bar">
              <button
                className={`patio-tab-btn ${activeTab === "tractos" ? "active" : ""}`}
                onClick={() => { setActiveTab("tractos"); setHighlightedId(null); }}
              >
                <i className="fa fa-truck"></i>
                Tractos
                <span className="patio-tab-count">{tractosEnPatio} en patio</span>
              </button>
              {roleData?.control_patios_remolques?.read && (
                <button
                  className={`patio-tab-btn ${activeTab === "remolques" ? "active" : ""}`}
                  onClick={() => { setActiveTab("remolques"); setHighlightedId(null); }}
                >
                  <i className="fa fa-trailer"></i>
                  Remolques
                  <span className="patio-tab-count">{remolqueRecords.filter(r => r.status === "En patio").length} en patio</span>
                </button>
              )}
            </div>
            <div className="bits-table-shell" style={{padding: 0}}>
              {activeTab === "tractos" ? (
                <DataTable
                  data={filteredTractores}
                  columns={tractoColumns}
                  loading={isLoading}
                  maxHeight="100%"
                  emptyMessage="No se encontraron tractos."
                  highlightId={highlightedId}
                />
              ) : (
                <DataTable
                  data={filteredRemolques}
                  columns={remolqueColumns}
                  loading={isLoading}
                  maxHeight="100%"
                  emptyMessage="No se encontraron remolques."
                  highlightId={highlightedId}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main entry/exit/edit modal */}
      <ModalTemplate
        show={showModal}
        title={modalTitle}
        onClose={closeModal}
        onSubmit={(e) => { e.preventDefault(); savePlate(); }}
        submitText={submitText}
        submitClass={isSalidaMode ? "btn btn-warning" : "btn btn-success"}
        submitDisabled={saving || (!canSave && !isEditMode) || (!isEditMode && !isSalidaMode && !formData.lineaTransporte)}
      >
        {error && (
          <div className="alert alert-danger d-flex align-items-center mb-3" role="alert">
            <i className="fa fa-exclamation-triangle me-2"></i>
            <div>{error}</div>
          </div>
        )}

        {/* ── TRACTOR / ENTRY / EDIT FORM ── */}
        {true && (
          <div className="d-flex flex-column gap-4">
            {!isEditMode && (
              <div className="d-flex flex-wrap gap-2 justify-content-center border-bottom pb-3">
                <button type="button" className="btn btn-primary px-4" onClick={() => openCameraInput(handleImageSelected)}>
                  <i className="fa fa-camera me-2"></i>{capturedDataUrl ? "Tomar otra foto" : "Tomar foto tracto"}
                </button>
              </div>
            )}

            {capturedDataUrl && !isEditMode && (
              <div className="text-center">
                <img src={capturedDataUrl} alt="Captura" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8, border: "2px solid #dee2e6" }} />
              </div>
            )}

            {ocrLoading && (
              <div className="d-flex align-items-center justify-content-center text-primary gap-2">
                <div className="spinner-border spinner-border-sm" role="status"></div>
                <span className="fw-bold">Analizando placa...</span>
              </div>
            )}

            <div className="row g-3">
              {/* 1. Placa tracto */}
              <div className="col-12">
                <div className="d-flex justify-content-between align-items-end mb-2">
                  <label className="form-label fw-bold mb-0">Placa Tracto</label>
                  {ocrResult && <ConfidenceBadge value={ocrResult.confidence} />}
                </div>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control text-uppercase fw-bold"
                    placeholder="Ej. ABC-123"
                    value={formData.placa}
                    onChange={(e) => setFormData(prev => ({ ...prev, placa: e.target.value.toUpperCase() }))}
                  />
                  <span className="input-group-text"><i className="fa fa-truck"></i></span>
                </div>
                {!ocrResult && !ocrLoading && !isEditMode && !isSalidaMode && (
                  <div className="form-text text-muted">Toma una foto o escribe la placa manualmente.</div>
                )}
              </div>

              {/* 2. Línea de transporte (shared for tracto and remolque) */}
              <div className="col-12">
                <label className="form-label fw-bold">Línea de transporte *</label>
                <select
                  className="form-select"
                  value={formData.lineaTransporte}
                  onChange={(e) => setFormData(prev => ({ ...prev, lineaTransporte: e.target.value }))}
                  disabled={!!selectedRecordForSalida}
                  required
                >
                  <option value="">Selecciona una línea...</option>
                  {lineasTransporte.map((l) => (
                    <option key={l._id} value={l.nombre}>{l.nombre}</option>
                  ))}
                </select>
              </div>

              {/* 3. Remolque checkbox + 4. remolque photo/plate (entry and exit) */}
              {!isEditMode && roleData?.control_patios_remolques?.create && (
                <div className="col-12">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="hasRemolqueCheck"
                      checked={formData.hasRemolque}
                      onChange={(e) => setFormData(prev => ({ ...prev, hasRemolque: e.target.checked, placaRemolque: "" }))}
                    />
                    <label className="form-check-label fw-bold" htmlFor="hasRemolqueCheck">
                      <i className="fa fa-trailer me-2" style={{ color: "#7c3aed" }}></i>
                      {isSalidaMode ? "Registrar salida de remolque también" : "¿Tiene remolque?"}
                    </label>
                  </div>

                  {formData.hasRemolque && (() => {
                    const remolqueEnPatio = isSalidaMode && formData.placaRemolque
                      ? remolqueRecords.find(r => r.placa.toUpperCase() === formData.placaRemolque.toUpperCase() && r.status === "En patio")
                      : null;
                    const tractorDiferente = remolqueEnPatio &&
                      remolqueEnPatio.tractor_entrada_placa &&
                      remolqueEnPatio.tractor_entrada_placa.toUpperCase() !== selectedRecordForSalida?.placa?.toUpperCase();
                    return (
                      <div className="mt-3 p-3 rounded" style={{ background: "#f8f5ff", border: "1.5px solid #ddd6fe" }}>
                        <div className="d-flex justify-content-between align-items-end mb-2">
                          <label className="form-label fw-bold mb-0 small">Placa Remolque *</label>
                          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => openCameraInput(handleRemolqueImageSelected)}>
                            <i className="fa fa-camera me-1"></i>Foto remolque
                          </button>
                        </div>
                        <div className="input-group">
                          <input
                            type="text"
                            className="form-control text-uppercase"
                            placeholder="Ej. R-456"
                            value={formData.placaRemolque}
                            onChange={(e) => setFormData(prev => ({ ...prev, placaRemolque: e.target.value.toUpperCase() }))}
                          />
                          <span className="input-group-text"><i className="fa fa-trailer"></i></span>
                        </div>
                        {tractorDiferente && (
                          <div className="alert alert-info d-flex align-items-start gap-2 mb-0 mt-3 py-2 px-3" style={{ fontSize: "0.85rem" }}>
                            <i className="fa fa-info-circle mt-1" style={{ flexShrink: 0 }}></i>
                            <span>
                              Este remolque entró con el tracto <strong>{remolqueEnPatio.tractor_entrada_placa}</strong> pero está siendo retirado por <strong>{selectedRecordForSalida?.placa}</strong>. Puedes continuar.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="col-12 border-top pt-2">
                <label className="form-label text-muted small mb-0">Fecha y Hora de registro</label>
                <div className="fw-bold">{formatDate(formData.timestamp)}</div>
              </div>
            </div>
          </div>
        )}

      </ModalTemplate>

      {/* Pending exit modal (smart mode) */}
      {pendingExit && (
        <ModalTemplate
          show={!!pendingExit}
          title="Placa en proceso"
          onClose={() => setPendingExit(null)}
          onSubmit={(e) => {
            e.preventDefault();
            setSelectedRecordForSalida(pendingExit);
            setFormData(prev => ({ ...prev, placa: pendingExit.placa, lineaTransporte: pendingExit.linea_transporte, cliente: pendingExit.cliente }));
            setPendingExit(null);
            setShowModal(true);
          }}
          submitClass="btn btn-primary"
          submitText="Registrar Salida"
        >
          <p>La placa <strong>{pendingExit.placa}</strong> ya se encuentra en proceso. ¿Desea registrar esta foto como salida?</p>
        </ModalTemplate>
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <ModalTemplate
          show
          title="Confirmar Eliminación"
          onClose={() => setShowDeleteModal(false)}
          onSubmit={(e) => { e.preventDefault(); handleConfirmDelete(); }}
        >
          <p>¿Está seguro de que desea eliminar este registro? Esta acción no se puede deshacer.</p>
        </ModalTemplate>
      )}
    </section>
  );
};

export default PlacaTestPage;
