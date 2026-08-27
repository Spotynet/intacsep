import {useEffect, useRef, useState, useMemo, useCallback} from "react";
import {useNavigate} from "react-router-dom";
import jsPDF from "jspdf";
import Sidebar from "./Sidebar";
import PageHeader from "./PageHeader";
import FilterBar from "./FilterBar";
import {Select, MultiSelect} from "./Select";
import DatePicker from "./DatePicker";
import CellBadge from "./CellBadge";
import {useAuth} from "../context/AuthContext";
import {useSidebar} from "../context/SidebarContext";
import {fetchClients, fetchLineasTransporte, fetchOperadores} from "../utils/api";

// Helper: Standardized Skeleton component
const Skeleton = ({ width = "100%", height = "20px", className = "" }) => (
  <div 
    className={`skeleton-loader ${className}`} 
    style={{ width, height, borderRadius: '6px', display: 'inline-block' }}
  />
);

const formatDateTime = (value) =>
  new Date(value).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });

const formatTimeDifference = (current, previous) => {
  if (!previous) return "Primer evento";

  const diffMs = new Date(current).getTime() - new Date(previous).getTime();
  const totalMinutes = Math.max(0, Math.round(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min después`;
  }

  if (minutes === 0) {
    return `${hours} h después`;
  }

  return `${hours} h ${minutes} min después`;
};

const formatDeviation = (actual, planned) => {
  const diffMs = new Date(actual).getTime() - new Date(planned).getTime();
  const sign = diffMs >= 0 ? "+" : "−";
  const abs = Math.abs(diffMs);
  const totalMin = Math.round(abs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const t = h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
  return `${sign}${t}`;
};

const ReporteEventosPage = () => {
  const {user, verifyToken, setUser} = useAuth();
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_BASE_URL;

  // Date helpers (Default 30 days)
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const lastMonthStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  }, []);

  const [roleData, setRoleData] = useState(null);
  const [clients, setClients] = useState([]);
  const [lineasTransporte, setLineasTransporte] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [bitacoras, setBitacoras] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  
  // Loading states
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetchingOptions, setIsFetchingOptions] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  const [filters, setFilters] = useState({
    cliente: "",
    operador: "",
    lineaTransporte: "",
    status: "",
    fechaDesde: lastMonthStr,
    fechaHasta: todayStr,
    bitacoraId: "",
    tipoEventos: [],
  });

  const [appliedFilters, setAppliedFilters] = useState({
    cliente: "",
    operador: "",
    lineaTransporte: "",
    status: "",
    fechaDesde: lastMonthStr,
    fechaHasta: todayStr,
    bitacoraId: "",
    tipoEventos: [],
  });

  const [applyFiltersTrigger, setApplyFiltersTrigger] = useState(0);

  // Authentication & Role setup
  useEffect(() => {
    const init = async () => {
      try {
        const data = await verifyToken();
        setUser(data);
        
        // Fetch role permissions
        const roleResp = await fetch(`${baseUrl}/roles/${data.role}`, {
          method: "GET",
          credentials: "include",
        });
        const roleData = await roleResp.json();
        setRoleData(roleData);

        if (!roleData?.reporte_eventos?.read) {
          navigate("/");
          return;
        }

        // Fetch clients initial load
        const clientsData = await fetchClients(roleData);
        setClients(clientsData);
        
        setIsInitialLoading(false);
      } catch (e) {
        console.error("Auth initialization failed:", e);
        navigate("/login");
      }
    };
    init();
  }, []);

  // Fetch options (Lineas, Operadores, Bitacoras) when root filters change
  const fetchFilteredOptions = useCallback(async () => {
    if (!roleData?.reporte_eventos?.read) return;

    setIsFetchingOptions(true);
    try {
      const tasks = [];
      
      // Always fetch Bitacoras for selection based on date range
      const params = new URLSearchParams({
        page: "1",
        limit: "500",
        sortField: "bitacora_id",
        sortOrder: "desc",
        fechaDesde: filters.fechaDesde,
        fechaHasta: filters.fechaHasta,
      });

      if (filters.cliente) params.append("clienteFilter", filters.cliente);
      if (filters.operador) params.append("operadorFilter", filters.operador);
      if (filters.status) params.append("statusFilter", filters.status);

      if (roleData?.client_access === "specific" && roleData.allowed_clients?.length) {
        const names = roleData.allowed_clients.map(c => c.client_name).join(",");
        params.append("allowed_clients", names);
      }

      // Bitacoras fetch is now always included
      const bitacorasPromise = fetch(`${baseUrl}/bitacoras?${params.toString()}`, {
        method: "GET",
        credentials: "include"
      }).then(r => r.json());

      if (filters.cliente) {
        tasks.push(fetchLineasTransporte(filters.cliente));
        tasks.push(fetchOperadores(filters.lineaTransporte || null));
      } else {
        tasks.push(Promise.resolve([]));
        tasks.push(Promise.resolve([]));
      }
      
      tasks.push(bitacorasPromise);

      const [lineas, ops, bitsData] = await Promise.all(tasks);
      
      setLineasTransporte(lineas);
      setOperadores(ops);
      setBitacoras(bitsData?.bitacoras || []);
      
    } catch (e) {
      console.error("Error fetching filtered options:", e);
    } finally {
      setIsFetchingOptions(false);
    }
  }, [filters.cliente, filters.fechaDesde, filters.fechaHasta, filters.lineaTransporte, filters.operador, filters.status, roleData, baseUrl]);

  useEffect(() => {
    if (!isInitialLoading) {
      fetchFilteredOptions();
    }
  }, [isInitialLoading, fetchFilteredOptions]);

  // Fetch Event Types once on mount
  useEffect(() => {
    if (isInitialLoading) return;
    
    const fetchEventTypes = async () => {
      try {
        const response = await fetch(`${baseUrl}/event_types`, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) setEventTypes(await response.json());
      } catch (e) {
        console.error("Error fetching event types:", e);
      }
    };
    fetchEventTypes();
  }, [isInitialLoading, baseUrl]);

  // Selected Bitácora Details
  const selectedBitacora = useMemo(() => 
    bitacoras.find(b => b.bitacora_id === appliedFilters.bitacoraId),
  [bitacoras, appliedFilters.bitacoraId]);

  const selectedEventos = useMemo(() => {
    const events = (selectedBitacora?.eventos?.length ? selectedBitacora.eventos : null)
      || selectedBitacora?.edited_bitacora?.eventos
      || [];
    return [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [selectedBitacora]);

  const planDeEmbarqueEvento = useMemo(() => 
    selectedEventos.find(e => ["PLAN DE EMBARQUE", "PRESENCIA EN ORIGEN"].includes(e.nombre?.toUpperCase()))
  , [selectedEventos]);

  const filteredEvents = useMemo(() => {
    let events = [...selectedEventos];
    if (appliedFilters.tipoEventos.length) {
      events = events.filter(e => appliedFilters.tipoEventos.includes(e.nombre));
    }
    // Always include Plan de Embarque for deviation calculation if not already there?
    // Actually the UI handles it if it's in the timeline.
    return events;
  }, [selectedEventos, appliedFilters.tipoEventos]);

  // Insights Calculations
  const insights = useMemo(() => {
    if (!selectedBitacora || !selectedEventos.length) return null;
    
    const start = new Date(selectedEventos[0].createdAt);
    const end = new Date(selectedEventos[selectedEventos.length - 1].createdAt);
    const diffMs = end.getTime() - start.getTime();
    const totalMin = Math.max(0, Math.round(diffMs / 60000));
    
    const anomalies = selectedEventos.filter(e => 
      ["ENA", "DR", "FM", "ONC"].includes(e.metadata?.categoriaAnomalia) ||
      /anomalia/i.test(e.nombre)
    ).length;

    return {
      duration: totalMin,
      totalEvents: selectedEventos.length,
      anomalies
    };
  }, [selectedBitacora, selectedEventos]);

  const handleApplyFilters = () => {
    setAppliedFilters({...filters});
    setApplyFiltersTrigger(prev => prev + 1);
  };

  const handleClearFilters = () => {
    const reset = {
      cliente: "",
      operador: "",
      lineaTransporte: "",
      status: "",
      fechaDesde: lastMonthStr,
      fechaHasta: todayStr,
      bitacoraId: "",
      tipoEventos: [],
    };
    setFilters(reset);
    setAppliedFilters(reset);
    setApplyFiltersTrigger(prev => prev + 1);
  };

  const hasActiveFilters = useMemo(() => {
    return !!(appliedFilters.cliente || 
           appliedFilters.operador ||
           appliedFilters.lineaTransporte ||
           appliedFilters.status ||
           appliedFilters.bitacoraId ||
           appliedFilters.tipoEventos?.length > 0 ||
           appliedFilters.fechaDesde !== lastMonthStr || 
           appliedFilters.fechaHasta !== todayStr);
  }, [appliedFilters, lastMonthStr, todayStr]);

  const handlePrintPDF = async () => {
    if (!selectedBitacora || filteredEvents.length === 0) return;

    // Load logo
    let logoDataUrl = null;
    try {
      const resp = await fetch("/logo1.png");
      const blob = await resp.blob();
      logoDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (_) { /* logo is optional */ }

    const doc = new jsPDF({orientation: "portrait", unit: "mm", format: "a4"});
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 16;
    const contentW = pageW - margin * 2;
    let y = 0;

    const footerH = 10;
    const usableBottom = pageH - footerH - 6;

    const addPage = () => {
      doc.addPage();
      y = margin;
    };

    const checkPageBreak = (needed = 10) => {
      if (y + needed > usableBottom) addPage();
    };

    // Helper: draw a label+value pair
    const drawField = (label, value, x, fy, labelW = 22) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(label.toUpperCase(), x, fy);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(String(value || "—"), x + labelW, fy);
    };

    // Helper: section title
    const sectionTitle = (text, yPos) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(text, margin, yPos);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos + 1.5, margin + contentW, yPos + 1.5);
    };

    // ── Header bar ──────────────────────────────────────────────
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 22, "F");
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", margin, 3, 16, 16);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Reporte de Eventos", logoDataUrl ? margin + 20 : margin, 14);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generado el ${new Date().toLocaleString("es-MX", {dateStyle: "short", timeStyle: "short"})}`,
      pageW - margin, 14, {align: "right"}
    );
    y = 28;

    // ── Bitácora title ───────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text(`Bitácora #${selectedBitacora.bitacora_id}`, margin, y);
    
    // Status Badge in PDF
    const statusText = (selectedBitacora.status || "Nueva").toUpperCase();
    const statusW = doc.getTextWidth(statusText) + 6;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin + 45, y - 5, statusW, 7, 1, 1, "F");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(statusText, margin + 48, y);
    
    y += 8;

    // ── General info (2-col grid) ────────────────────────────────
    sectionTitle("Información General", y);
    y += 6;

    const bit = selectedBitacora;
    const col2W = contentW / 2;

    const bitEventos = (bit.eventos?.length ? bit.eventos : null)
      || bit.edited_bitacora?.eventos
      || [];

    const planEvento = bitEventos.find(
      (e) => ["PLAN DE EMBARQUE", "PRESENCIA EN ORIGEN"].includes(e.nombre?.toUpperCase())
    );
    const citaCarga  = planEvento?.metadata?.citaCarga;
    const horaSalida = planEvento?.metadata?.horaSalida;

    const validacionEvento = bitEventos.find(
      (e) => e.nombre?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === "validacion"
    );
    const cierreEvento = bitEventos.find(
      (e) => e.nombre?.toLowerCase() === "cierre de servicio"
    );
    const inicioMonitoreo = validacionEvento?.transportes?.[0]?.inicioMonitoreo || bit.inicioMonitoreo;
    const finalMonitoreo  = cierreEvento?.transportes?.[0]?.finalMonitoreo     || bit.finalMonitoreo;

    const origenDisplay  = bit.origen_nombre  || bit.origen  || "";
    const destinoDisplay = bit.destino_nombre || bit.destino || "";

    const generalRows = [
      ["Folio Servicio",   bit.folio_servicio,                              "Estatus",         (bit.status || "").toUpperCase()],
      ["Cliente",          bit.cliente,                                     "Línea",           bit.linea_transporte],
      ["Operador",         bit.operador,                                    "Tipo Monitoreo",  bit.monitoreo],
      ["Origen",           origenDisplay,                                   "Destino",         destinoDisplay],
      ["Cita de Carga",    citaCarga  ? formatDateTime(citaCarga)  : null,  "Inicio Monitoreo", inicioMonitoreo ? formatDateTime(inicioMonitoreo) : null],
      ["Hora de Salida",   horaSalida ? formatDateTime(horaSalida) : null,  "Final Monitoreo",  finalMonitoreo  ? formatDateTime(finalMonitoreo)  : null],
    ];

    generalRows.forEach(([l1, v1, l2, v2]) => {
      checkPageBreak(8);
      drawField(l1, v1, margin,           y, 26);
      drawField(l2, v2, margin + col2W,   y, 28);
      y += 8;
    });

    y += 6;

    // ── Insights Summary ─────────────────────────────────────────
    if (insights) {
      checkPageBreak(25);
      sectionTitle("Resumen de Métricas", y);
      y += 8;
      
      const insightW = contentW / 3;
      
      // Background for insights
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, contentW, 14, 2, 2, "F");
      
      const drawInsight = (label, value, x) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(label.toUpperCase(), x + 4, y + 5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(String(value), x + 4, y + 10);
      };

      const durationStr = formatTimeDifference(selectedEventos[selectedEventos.length-1]?.createdAt, selectedEventos[0]?.createdAt).replace(' Primer evento', '');
      
      drawInsight("Duración Total", durationStr, margin);
      drawInsight("Eventos Registrados", insights.totalEvents, margin + insightW);
      drawInsight("Alertas de Riesgo", insights.anomalies, margin + insightW * 2);
      
      y += 20;
    } else {
      y += 4;
    }

    // ── Timeline ─────────────────────────────────────────────────
    checkPageBreak(16);
    sectionTitle("Timeline de eventos", y);
    y += 5;

    if (filteredEvents.length >= 2) {
      const diffMs =
        new Date(filteredEvents[filteredEvents.length - 1].createdAt) -
        new Date(filteredEvents[0].createdAt);
      const totalMin = Math.max(0, Math.round(diffMs / 60000));
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      const durationLabel = h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(`${durationLabel} en total`, margin, y + 4);
      y += 9;
    } else {
      y += 4;
    }

    const dotX = margin + 3;
    const textX = margin + 10;

    filteredEvents.forEach((evento, index) => {
      const isLast = index === filteredEvents.length - 1;
      const prevTime = index > 0 ? filteredEvents[index - 1].createdAt : null;
      const desc = evento.descripcion || "";
      const descLines = desc ? doc.splitTextToSize(desc, contentW - 14).length : 0;
      const isInicioRecorrido = /inicio de recorrido/i.test(evento.nombre);
      const showDesvio = isInicioRecorrido && !!horaSalida;
      const blockH = 7 + (descLines > 0 ? descLines * 4 + 2 : 0) + (prevTime ? 5 : 0) + (showDesvio ? 5 : 0);
      checkPageBreak(blockH + 4);

      doc.setFillColor(59, 130, 246);
      doc.circle(dotX, y + 1.5, 2, "F");

      if (!isLast) {
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.line(dotX, y + 4, dotX, y + blockH + 2);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(evento.nombre, textX, y + 2);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(formatDateTime(evento.createdAt), pageW - margin, y + 2, {align: "right"});
      y += 6;

      if (prevTime) {
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.setFont("helvetica", "italic");
        doc.text(`+ ${formatTimeDifference(evento.createdAt, prevTime)}`, textX, y);
        y += 5;
      }

      if (showDesvio) {
        doc.setFontSize(7.5);
        doc.setTextColor(180, 130, 0);
        doc.setFont("helvetica", "italic");
        doc.text(
          `Plan: ${formatDateTime(horaSalida)}  ·  Desfase: ${formatDeviation(evento.createdAt, horaSalida)}`,
          textX, y
        );
        y += 5;
      }

      if (desc) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        const lines = doc.splitTextToSize(desc, contentW - 14);
        doc.text(lines, textX, y);
        y += lines.length * 4 + 2;
      }

      y += 3;
    });

    // ── Footer on every page ─────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(241, 245, 249);
      doc.rect(0, pageH - footerH, pageW, footerH, "F");
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text("Intacsep — Reporte de Eventos", margin, pageH - 3.5);
      doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 3.5, {align: "right"});
    }

    doc.save(`reporte-eventos-${bit.bitacora_id}.pdf`);
  };

  const bitacoraOptions = useMemo(() => 
    bitacoras.map(b => {
      const rawStatus = (b.status || 'Nueva').toUpperCase();
      const status = rawStatus.replace(/[\[\]]/g, "").trim();
      let badgeVariant = "gray";
      
      if (status.includes("CERRADA")) badgeVariant = "green";
      if (status.includes("CANCELADA")) badgeVariant = "red";
      if (status.includes("TRANSITO") || status.includes("RUTA")) badgeVariant = "blue";
      if (status.includes("PROGRAMADA") || status.includes("NUEVA")) badgeVariant = "gray";
      if (status.includes("ORIGEN") || status.includes("CARGA")) badgeVariant = "yellow";
      if (status.includes("DESTINO") || status.includes("ARRIBO")) badgeVariant = "purple";
      if (status.includes("FINALIZADA")) badgeVariant = "green";

      return {
        value: b.bitacora_id,
        searchText: `#${b.bitacora_id} ${b.folio_servicio || ''} ${status}`,
        label: (
          <div className="d-flex align-items-center justify-content-between w-100 gap-2 py-1">
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold text-primary" style={{minWidth: '45px', fontSize: '0.85rem'}}>#{b.bitacora_id}</span>
              <span className="text-muted opacity-25">|</span>
              <span className="text-truncate fw-medium" style={{maxWidth: '180px', color: '#334155'}}>{b.folio_servicio || 'Sin Folio'}</span>
            </div>
            <CellBadge 
              label={status} 
              variant={badgeVariant} 
              className="p-1 px-2 fw-bold"
              style={{ fontSize: '0.62rem', minWidth: '85px', textAlign: 'center', letterSpacing: '0.02em' }}
            />
          </div>
        )
      };
    })
  , [bitacoras]);

  const eventTypeOptions = useMemo(() => 
    eventTypes.map(et => ({ value: et.evento, label: et.evento }))
  , [eventTypes]);

  return (
    <section id="reporteEventosPage" className="settings-page">
      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>

        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Dashboard - Reporte Eventos"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
            filters={
              <FilterBar onClear={handleClearFilters}>
                <div className="reporte-field">
                  <Select
                    label="Cliente"
                    options={clients.map(c => ({ value: c.razon_social, label: c.razon_social }))}
                    value={filters.cliente}
                    onChange={(v) => setFilters(prev => ({ ...prev, cliente: v, bitacoraId: "", lineaTransporte: "", operador: "" }))}
                    placeholder="Seleccionar cliente..."
                  />
                </div>
                <div className="reporte-field">
                  <DatePicker
                    label="Desde"
                    value={filters.fechaDesde}
                    onChange={(v) => setFilters(prev => ({ ...prev, fechaDesde: v, bitacoraId: "" }))}
                  />
                </div>
                <div className="reporte-field">
                  <DatePicker
                    label="Hasta"
                    value={filters.fechaHasta}
                    onChange={(v) => setFilters(prev => ({ ...prev, fechaHasta: v, bitacoraId: "" }))}
                  />
                </div>
                <div className="reporte-field">
                  <Select
                    label="Línea de Transporte"
                    options={lineasTransporte.map(l => ({ value: l.nombre, label: l.nombre }))}
                    value={filters.lineaTransporte}
                    onChange={(v) => setFilters(prev => ({ ...prev, lineaTransporte: v, bitacoraId: "", operador: "" }))}
                    placeholder="Todas las líneas"
                    disabled={!filters.cliente}
                  />
                </div>
                <div className="reporte-field">
                  <Select
                    label="Operador"
                    options={operadores.map(o => ({ value: o.nombre, label: o.nombre }))}
                    value={filters.operador}
                    onChange={(v) => setFilters(prev => ({ ...prev, operador: v, bitacoraId: "" }))}
                    placeholder="Todos los operadores"
                    disabled={!filters.cliente}
                  />
                </div>
                <div className="reporte-field">
                  <Select
                    label="Bitácora (ID / Folio)"
                    options={bitacoraOptions}
                    value={filters.bitacoraId}
                    onChange={(v) => setFilters(prev => ({ ...prev, bitacoraId: v }))}
                    placeholder={isFetchingOptions ? "Actualizando listado..." : "Selecciona una bitácora..."}
                    searchable={true}
                    disabled={isFetchingOptions}
                  />
                </div>
                <div className="reporte-field">
                  <MultiSelect
                    label="Tipos de Evento"
                    options={eventTypeOptions}
                    value={filters.tipoEventos}
                    onChange={(v) => setFilters(prev => ({ ...prev, tipoEventos: v }))}
                    placeholder="Todos los eventos"
                  />
                </div>
              </FilterBar>
            }
            filterActions={<>
              <button
                className="new-btn"
                style={{minWidth: '140px'}}
                onClick={handleApplyFilters}
                disabled={isFetchingOptions || !filters.bitacoraId}>
                {isFetchingOptions ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>Cargando...</>
                ) : (
                  <><i className="fa fa-wand-magic-sparkles me-2"></i>Generar Reporte</>
                )}
              </button>
            </>}
          />

          <div className="settings-content pt-3 px-4">
            {isInitialLoading ? (
              <div className="p-0">
                <Skeleton height="120px" className="mb-3" />
                <Skeleton height="100px" className="mb-4" />
                <div className="row g-3 mb-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="col-md-4">
                      <Skeleton height="100px" />
                    </div>
                  ))}
                </div>
                <Skeleton height="400px" />
              </div>
            ) : (
              <>
                {!appliedFilters.bitacoraId ? (
                  <div className="reporte-eventos-empty fade-in mt-5">
                    <div className="text-center py-5">
                      <i className="fa fa-file-invoice fa-4x mb-3 text-muted opacity-25"></i>
                      <h5>Generar Reporte de Bitácora</h5>
                      <p className="text-muted">
                        Ajusta los filtros de alcance en el <strong>Paso 1</strong> y selecciona una bitácora en el <strong>Paso 2</strong> para visualizar la línea de tiempo.
                      </p>
                    </div>
                  </div>
                ) : (
              <div className="reporte-eventos-container">
                {insights && (
                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <div className="metric-card">
                        <div className="metric-card__icon metric-card__icon--duration">
                          <i className="fa fa-clock"></i>
                        </div>
                        <div className="metric-card__body">
                          <div className="metric-card__value">
                            {formatTimeDifference(selectedEventos[selectedEventos.length-1]?.createdAt, selectedEventos[0]?.createdAt).replace(' Primer evento', '')}
                          </div>
                          <div className="metric-card__label">Duración Total</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="metric-card">
                        <div className="metric-card__icon metric-card__icon--events">
                          <i className="fa fa-list-ul"></i>
                        </div>
                        <div className="metric-card__body">
                          <div className="metric-card__value">{insights.totalEvents}</div>
                          <div className="metric-card__label">Total de Eventos</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="metric-card">
                        <div className="metric-card__icon metric-card__icon--alerts">
                          <i className="fa fa-shield-halved"></i>
                        </div>
                        <div className="metric-card__body">
                          <div className="metric-card__value">{insights.anomalies}</div>
                          <div className="metric-card__label">Alertas de Riesgo</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="card mb-3 border-0 shadow-sm" style={{borderRadius: '12px'}}>
                  <div className="card-header bg-white py-2 px-3 border-bottom d-flex justify-content-between align-items-center">
                    <h6 className="mb-0 fw-bold" style={{fontSize: '0.85rem'}}>
                      <i className="fa fa-route me-2 text-primary"></i>
                      Bitácora #{selectedBitacora.bitacora_id}
                    </h6>
                    <button className="btn btn-success btn-sm px-3 fw-semibold" style={{fontSize: '0.78rem', borderRadius: '8px'}} onClick={handlePrintPDF}>
                      <i className="fa fa-file-pdf me-1"></i>Exportar PDF
                    </button>
                  </div>
                  <div className="card-body p-3">
                    <div className="reporte-meta-grid">
                      {[
                        { label: "Cliente", value: selectedBitacora.cliente },
                        { label: "Línea de Transporte", value: selectedBitacora.linea_transporte },
                        { label: "Operador", value: selectedBitacora.operador },
                        { label: "Folio de Servicio", value: selectedBitacora.folio_servicio },
                        { label: "Origen", value: selectedBitacora.origen_nombre || selectedBitacora.origen },
                        { label: "Destino", value: selectedBitacora.destino_nombre || selectedBitacora.destino },
                      ].map((item, idx) => (
                        <div key={idx} className="reporte-meta-item">
                          <div className="reporte-meta-item__label">{item.label}</div>
                          <div className="reporte-meta-item__value">{item.value || "—"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="reporte-timeline-wrapper">
                  <div className="reporte-timeline-header">
                    <h5 className="reporte-timeline-header__title">Cronología del Servicio</h5>
                    <span className="reporte-timeline-header__badge">
                      {filteredEvents.length} evento{filteredEvents.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="reporte-timeline">
                    {filteredEvents.map((evento, index) => (
                      <div key={evento._id || index} className="reporte-timeline__item">
                        <div className="reporte-timeline__rail">
                          <span className="reporte-timeline__dot"></span>
                          {index !== filteredEvents.length - 1 && <span className="reporte-timeline__line"></span>}
                        </div>

                        <div className="reporte-timeline__content">
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <div>
                              <CellBadge 
                                variant={evento.metadata?.categoriaAnomalia ? "red" : "blue"} 
                                label={evento.nombre}
                                className="mb-1"
                              />
                              <div className="reporte-timeline__date">
                                <i className="far fa-clock me-1"></i>{formatDateTime(evento.createdAt)}
                              </div>
                            </div>
                            <span className="reporte-timeline__diff">
                              {formatTimeDifference(evento.createdAt, index > 0 ? filteredEvents[index - 1].createdAt : null)}
                            </span>
                          </div>

                          <p className="reporte-timeline__description mb-0">
                            {evento.descripcion || "Evento registrado sin observaciones adicionales."}
                          </p>

                          {/inicio de recorrido/i.test(evento.nombre) && planDeEmbarqueEvento?.metadata?.horaSalida && (
                            <div className="reporte-timeline__plan-diff">
                              <i className="fa fa-history"></i>
                              Desfase vs Plan: <strong>{formatDeviation(evento.createdAt, planDeEmbarqueEvento.metadata.horaSalida)}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  </div>
</section>
  );
};

export default ReporteEventosPage;
