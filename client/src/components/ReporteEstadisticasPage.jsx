import {useEffect, useState, useMemo} from "react";
import jsPDF from "jspdf";
import {useNavigate} from "react-router-dom";
import Sidebar from "./Sidebar";
import PageHeader from "./PageHeader";
import FilterBar from "./FilterBar";
import DataTable from "./DataTable";
import {Select} from "./Select";
import DatePicker from "./DatePicker";
import {useAuth} from "../context/AuthContext";
import {useSidebar} from "../context/SidebarContext";
import {fetchClients, fetchOrigenes, fetchDestinos, fetchLineasTransporte, fetchOperadores} from "../utils/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("es-MX", {dateStyle: "short", timeStyle: "short"})
    : "—";

const formatMs = (ms) => {
  if (ms === null || ms === undefined) return "N/A";
  const abs = Math.abs(ms);
  const totalMin = Math.round(abs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const t = h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
  const sign = ms >= 0 ? "+" : "−";
  return `${sign}${t}`;
};

const formatMsAbs = (ms) => {
  if (ms === null || ms === undefined) return "N/A";
  const abs = Math.abs(ms);
  const totalMin = Math.round(abs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
};

const desvioClass = (ms) => {
  if (ms === null || ms === undefined) return "";
  if (ms <= 0) return "cell--ok";
  if (ms <= 3600000) return "cell--warn";
  return "cell--alert";
};

const getBitacoraStatusIcon = (...comparisons) => {
  const validComparisons = comparisons.filter((value) => value !== null && value !== undefined);
  const onTimeCount = validComparisons.filter((value) => value <= 0).length;
  const lateCount = validComparisons.filter((value) => value > 0).length;

  if (validComparisons.length > 0 && onTimeCount === validComparisons.length) {
    return {
      icon: "fa-circle-check",
      className: "reporte-est-id-status--ok",
      title: "Todas las comparaciones en tiempo",
    };
  }

  if (validComparisons.length > 0 && lateCount === validComparisons.length) {
    return {
      icon: "fa-circle-xmark",
      className: "reporte-est-id-status--alert",
      title: "Todas las comparaciones con retraso",
    };
  }

  return {
    icon: "fa-triangle-exclamation",
    className: "reporte-est-id-status--warn",
    title: "Comparaciones mixtas o incompletas",
  };
};

const STATUS_OPTIONS = [
  {value: "",                  label: "Todos los estatus"},
  {value: "plan de embarque",  label: "Plan de embarque"},
  {value: "creada",            label: "Creada"},
  {value: "cerrada",           label: "Cerrada"},
  {value: "cerrada (e)",       label: "Cerrada (editada)"},
];

// ── Component ─────────────────────────────────────────────────────────────────

const ReporteEstadisticasPage = () => {
  const {user, verifyToken, setUser} = useAuth();
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_BASE_URL;

  const [roleData, setRoleData]   = useState(null);
  const [clients, setClients]     = useState([]);
  const [origenes, setOrigenes]   = useState([]);
  const [destinos, setDestinos]   = useState([]);
  const [lineas, setLineas]       = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [searched, setSearched]   = useState(false);
  const [servicios, setServicios] = useState([]);

  const today = new Date();
  const lastMonth = new Date();
  lastMonth.setDate(today.getDate() - 30);

  const [filters, setFilters] = useState({
    startDate:     toLocalDateStr(lastMonth),
    endDate:       toLocalDateStr(today),
    cliente:       "",
    origenFilter:  "",
    destinoFilter: "",
    lineaFilter:   "",
    operadorFilter: "",
    statusFilter:  "",
  });

  const hasActiveFilters = useMemo(() => {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    const defaultStart = toLocalDateStr(lastMonth);
    const defaultEnd = toLocalDateStr(today);

    return !!(filters.cliente || filters.origenFilter || filters.destinoFilter || 
           filters.lineaFilter || filters.operadorFilter || filters.statusFilter ||
           filters.startDate !== defaultStart || filters.endDate !== defaultEnd);
  }, [filters]);

  const handleClearFilters = () => {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    
    setFilters({
      startDate: toLocalDateStr(lastMonth),
      endDate: toLocalDateStr(today),
      cliente: "",
      origenFilter: "",
      destinoFilter: "",
      lineaFilter: "",
      operadorFilter: "",
      statusFilter: "",
    });
  };

  // ── Auth & permissions ───────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try { const data = await verifyToken(); setUser(data); }
      catch { navigate("/login"); }
    };
    init();
  }, []);

  useEffect(() => {
    if (!user?.role) return;
    const fetchRole = async () => {
      try {
        const res = await fetch(`${baseUrl}/roles/${user.role}`, {
          method: "GET", credentials: "include",
        });
        const data = await res.json();
        setRoleData(data);
        if (!data?.reporte_estadisticas?.read) navigate("/");
      } catch (e) { console.error("Error fetching role:", e); }
    };
    fetchRole();
  }, [user]);

  // ── Clients (always loaded) ──────────────────────────────────────────────
  useEffect(() => {
    if (!roleData?.reporte_estadisticas?.read) return;
    fetchClients(roleData).then(setClients).catch(console.error);
  }, [roleData]);

  // ── Origenes & Destinos — reload when cliente changes ───────────────────
  useEffect(() => {
    if (!filters.cliente) {
      setOrigenes([]);
      setDestinos([]);
      setLineas([]);
      return;
    }
    Promise.all([
      fetchOrigenes(filters.cliente),
      fetchDestinos(filters.cliente),
      fetchLineasTransporte(filters.cliente),
      fetchOperadores(filters.cliente),
    ]).then(([o, d, l, op]) => {
      setOrigenes(o);
      setDestinos(d);
      setLineas(l);
      setOperadores(op);
    }).catch(console.error);
  }, [filters.cliente]);

  // ── Filter change ────────────────────────────────────────────────────────
  const handleFilterChange = (field, value) => {
    setFilters((prev) => {
      const next = {...prev, [field]: value};
      if (field === "cliente") {
        next.origenFilter  = "";
        next.destinoFilter = "";
        next.lineaFilter   = "";
        next.operadorFilter = "";
      }
      return next;
    });
  };

  // ── Search ───────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!filters.startDate || !filters.endDate) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate:   filters.endDate,
      });
      if (filters.cliente)       params.append("clienteFilter",  filters.cliente);
      if (filters.origenFilter)  params.append("origenFilter",   filters.origenFilter);
      if (filters.destinoFilter) params.append("destinoFilter",  filters.destinoFilter);
      if (filters.lineaFilter)   params.append("lineaFilter",    filters.lineaFilter);
      if (filters.operadorFilter) params.append("operadorFilter", filters.operadorFilter);
      if (filters.statusFilter)  params.append("statusFilter",   filters.statusFilter);

      const res  = await fetch(`${baseUrl}/reporte-estadisticas?${params}`, {credentials: "include"});
      const data = await res.json();
      setServicios(data.servicios || []);
    } catch (e) {
      console.error("Error fetching estadísticas:", e);
      setServicios([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPDF = async () => {
    if (!searched) return;

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

    const doc = new jsPDF({orientation: "landscape", unit: "mm", format: "a4"});
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 16;
    const contentW = pageW - margin * 2;
    const footerH = 10;
    const usableBottom = pageH - footerH - 6;
    let y = 0;

    const addPage = () => {
      doc.addPage();
      y = margin;
    };

    const checkPageBreak = (needed = 10) => {
      if (y + needed > usableBottom) addPage();
    };

    const drawField = (label, value, x, fy, labelW = 24) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(label.toUpperCase(), x, fy);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(String(value || "—"), x + labelW, fy);
    };

    const sectionTitle = (text, yPos) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(text, margin, yPos);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos + 1.5, margin + contentW, yPos + 1.5);
    };

    const drawSummaryCard = (x, yPos, w, h, value, label, fill = [248, 250, 252]) => {
      doc.setFillColor(...fill);
      doc.roundedRect(x, yPos, w, h, 3, 3, "F");
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, yPos, w, h, 3, 3, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(30, 41, 59);
      doc.text(String(value), x + 5, yPos + 8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const lines = doc.splitTextToSize(label, w - 10);
      doc.text(lines, x + 5, yPos + 14);
    };

    const statusBadgeColor = (status) => {
      const normalized = (status || "").toLowerCase();
      if (normalized === "cerrada") return [220, 252, 231];
      if (normalized === "cerrada (e)") return [254, 249, 195];
      if (normalized === "plan de embarque") return [219, 234, 254];
      return [241, 245, 249];
    };

    const punctualityFill = (ms) => {
      if (ms === null || ms === undefined) return [248, 250, 252];
      if (ms <= 0) return [220, 252, 231];
      if (ms <= 3600000) return [254, 249, 195];
      return [254, 226, 226];
    };

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 22, "F");
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", margin, 3, 16, 16);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Reporte de puntualidad", logoDataUrl ? margin + 20 : margin, 14);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generado el ${new Date().toLocaleString("es-MX", {dateStyle: "short", timeStyle: "short"})}`,
      pageW - margin, 14, {align: "right"}
    );
    y = 28;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("Resumen", margin, y);
    y += 8;

    sectionTitle("Filtros aplicados", y);
    y += 6;

    const col2W = contentW / 2;
    const filterRows = [
      ["Fecha inicio", filters.startDate || "—", "Fecha fin", filters.endDate || "—"],
      ["Cliente", filters.cliente || "Todos", "Estatus", filters.statusFilter || "Todos"],
      ["Origen", filters.origenFilter || "Todos", "Destino", filters.destinoFilter || "Todos"],
    ];

    filterRows.forEach(([l1, v1, l2, v2]) => {
      checkPageBreak(8);
      drawField(l1, v1, margin, y, 23);
      drawField(l2, v2, margin + col2W, y, 23);
      y += 8;
    });

    y += 2;
    sectionTitle("Indicadores", y);
    y += 6;

    const cardGap = 6;
    const cardW = (contentW - cardGap * 4) / 5;
    const cardY = y;
    drawSummaryCard(margin, cardY, cardW, 20, total, "Total servicios");
    drawSummaryCard(margin + cardW + cardGap, cardY, cardW, 20, `${conDesfaseCita} (${pct(conDesfaseCita)})`, "Desfase cita de carga", [255, 251, 235]);
    drawSummaryCard(margin + (cardW + cardGap) * 2, cardY, cardW, 20, `${conDesfaseSalida} (${pct(conDesfaseSalida)})`, "Desfase hora de salida", [255, 251, 235]);
    drawSummaryCard(margin + (cardW + cardGap) * 3, cardY, cardW, 20, `${conDesfaseEntrega} (${pct(conDesfaseEntrega)})`, "Desfase cita de entrega", [255, 251, 235]);
    drawSummaryCard(margin + (cardW + cardGap) * 4, cardY, cardW, 20, `${sinRetraso} (${pct(sinRetraso)})`, "Servicios sin retraso", [239, 246, 255]);
    y += 26;

    sectionTitle("Detalle de servicios", y);
    y += 7;

    if (servicios.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("No se encontraron servicios en el rango seleccionado.", margin, y);
    } else {
      const columns = [
        {key: "bitacora_id", label: "Bit.", width: 11},
        {key: "carrierMove", label: "Carrier", width: 16},
        {key: "cliente", label: "Cliente", width: 17},
        {key: "origen_nombre", label: "Origen", width: 14},
        {key: "destino_nombre", label: "Destino", width: 14},
        {key: "lineaTransporte", label: "Linea", width: 14},
        {key: "status", label: "Estatus", width: 12},
        {key: "citaCarga", label: "Cita Carga", width: 16},
        {key: "planEmbarqueAt", label: "Pres. origen", width: 13},
        {key: "desfaseCitaCargaMs", label: "Punt. Cita", width: 12},
        {key: "validacionAt", label: "Validacion", width: 13},
        {key: "tiempoPresenciaValidacionMs", label: "Tiempo de carga", width: 12},
        {key: "horaSalida", label: "H. Salida", width: 16},
        {key: "inicioRecorridoAt", label: "Inicio Rec.", width: 13},
        {key: "desfaseHoraSalidaMs", label: "Punt. Salida", width: 12},
        {key: "citaEntrega", label: "Cita Entr.", width: 16},
        {key: "arriboDestinoAt", label: "Arribo Dest.", width: 13},
        {key: "desfaseCitaEntregaMs", label: "Punt. Entr.", width: 12},
      ];

      const cellPadX = 1.2;
      const cellPadY = 2.2;
      const cellLineH = 3.5;
      const headerLineH = 2.8;

      const getWrappedLines = (value, width) =>
        doc.splitTextToSize(String(value ?? "—"), Math.max(1, width - cellPadX * 2));

      const drawMultilineText = (lines, x, yTop, lineHeight) => {
        lines.forEach((line, index) => {
          doc.text(line, x, yTop + index * lineHeight);
        });
      };

      const drawTableHeader = () => {
        const headerLinesByCol = columns.map((col) => getWrappedLines(col.label, col.width));
        const maxHeaderLines = Math.max(...headerLinesByCol.map((lines) => lines.length));
        const headerH = Math.max(8, maxHeaderLines * headerLineH + cellPadY * 2);

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(margin, y - 1, contentW, headerH, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
        let x = margin;
        columns.forEach((col, index) => {
          const headerLines = headerLinesByCol[index];
          drawMultilineText(headerLines, x + cellPadX, y + cellPadY + 2, headerLineH);
          x += col.width;
        });
        y += headerH + 1;
      };

      drawTableHeader();

      servicios.forEach((servicio) => {
        const rowValues = {
          bitacora_id: `#${servicio.bitacora_id || "—"}`,
          carrierMove: servicio.carrierMove || "—",
          cliente: servicio.cliente || "—",
          origen_nombre: servicio.origen_nombre || "—",
          destino_nombre: servicio.destino_nombre || "—",
          lineaTransporte: servicio.lineaTransporte || "—",
          status: servicio.status || "—",
          citaCarga: formatDateTime(servicio.citaCarga),
          planEmbarqueAt: formatDateTime(servicio.planEmbarqueAt),
          desfaseCitaCargaMs: servicio.desfaseCitaCargaMs !== null ? formatMs(servicio.desfaseCitaCargaMs) : "N/A",
          validacionAt: formatDateTime(servicio.validacionAt),
          tiempoPresenciaValidacionMs: servicio.tiempoPresenciaValidacionMs !== null ? formatMsAbs(servicio.tiempoPresenciaValidacionMs) : "N/A",
          horaSalida: formatDateTime(servicio.horaSalida),
          inicioRecorridoAt: formatDateTime(servicio.inicioRecorridoAt),
          desfaseHoraSalidaMs: servicio.desfaseHoraSalidaMs !== null ? formatMs(servicio.desfaseHoraSalidaMs) : "N/A",
          citaEntrega: formatDateTime(servicio.citaEntrega),
          arriboDestinoAt: formatDateTime(servicio.arriboDestinoAt),
          desfaseCitaEntregaMs: servicio.desfaseCitaEntregaMs !== null ? formatMs(servicio.desfaseCitaEntregaMs) : "N/A",
        };

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.2);
        const wrappedLinesByCol = columns.map((col) => getWrappedLines(rowValues[col.key], col.width));
        const maxLines = Math.max(...wrappedLinesByCol.map((lines) => lines.length));
        const rowH = Math.max(8, maxLines * cellLineH + cellPadY * 2);

        if (y + rowH > usableBottom) {
          addPage();
          drawTableHeader();
        }

        let x = margin;
        columns.forEach((col) => {
          const isStatus = col.key === "status";
          const isPunctuality = col.key === "desfaseCitaCargaMs" || col.key === "desfaseHoraSalidaMs" || col.key === "desfaseCitaEntregaMs";
          const fill = isStatus
            ? statusBadgeColor(servicio.status)
            : isPunctuality
              ? punctualityFill(servicio[col.key])
              : [255, 255, 255];

          doc.setFillColor(...fill);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.rect(x, y, col.width, rowH, "FD");

          doc.setFont("helvetica", col.key === "bitacora_id" ? "bold" : "normal");
          doc.setFontSize(7.2);
          doc.setTextColor(30, 41, 59);
          const lines = wrappedLinesByCol[columns.indexOf(col)];
          drawMultilineText(lines, x + cellPadX, y + cellPadY + 2.2, cellLineH);
          x += col.width;
        });

        y += rowH;
      });
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(241, 245, 249);
      doc.rect(0, pageH - footerH, pageW, footerH, "F");
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text("Intacsep — Reporte de puntualidad", margin, pageH - 3.5);
      doc.text(`Página ${p} de ${totalPages}`, pageW - margin, pageH - 3.5, {align: "right"});
    }

    doc.save(`reporte-de-puntualidad-${filters.startDate}-${filters.endDate}.pdf`);
  };

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const total            = servicios.length;
  const conDesfaseCita   = servicios.filter((s) => s.desfaseCitaCargaMs  !== null && s.desfaseCitaCargaMs  > 0).length;
  const conDesfaseSalida = servicios.filter((s) => s.desfaseHoraSalidaMs !== null && s.desfaseHoraSalidaMs > 0).length;
  const conDesfaseEntrega = servicios.filter((s) => s.desfaseCitaEntregaMs !== null && s.desfaseCitaEntregaMs > 0).length;
  const sinRetraso       = servicios.filter(
    (s) => (s.desfaseCitaCargaMs === null || s.desfaseCitaCargaMs <= 0)
      && (s.desfaseHoraSalidaMs === null || s.desfaseHoraSalidaMs <= 0)
      && (s.desfaseCitaEntregaMs === null || s.desfaseCitaEntregaMs <= 0)
  ).length;
  const pct = (n) => (total > 0 ? `${Math.round((n / total) * 100)}%` : "—");

  const clientOptions = useMemo(() => 
    clients.map(c => ({ value: c.razon_social, label: c.razon_social }))
  , [clients]);

  const origenOptions = useMemo(() => 
    origenes.map(o => ({ value: o.nombre, label: o.nombre }))
  , [origenes]);

  const destinoOptions = useMemo(() => 
    destinos.map(d => ({ value: d.nombre, label: d.nombre }))
  , [destinos]);

  const lineaOptions = useMemo(() => 
    lineas.map(l => ({ value: l.nombre, label: l.nombre }))
  , [lineas]);

  const operadorOptions = useMemo(() => 
    operadores.map(op => ({ value: op.nombre, label: op.nombre }))
  , [operadores]);

  const columns = useMemo(() => [
    {
      key: "bitacora_id",
      header: "Bitácora",
      width: "90px",
      sortable: true,
      render: (s) => {
        const statusIcon = getBitacoraStatusIcon(s.desfaseCitaCargaMs, s.desfaseHoraSalidaMs, s.desfaseCitaEntregaMs);
        return (
          <span className="reporte-est-id-wrap">
            <i className={`fas ${statusIcon.icon} reporte-est-id-status ${statusIcon.className}`} title={statusIcon.title}></i>
            <span className="reporte-est-id">#{s.bitacora_id}</span>
          </span>
        );
      }
    },
    { key: "carrierMove", header: "Carrier", width: "90px" },
    { key: "cliente", header: "Cliente", width: "120px" },
    { key: "origen_nombre", header: "Origen", width: "120px" },
    { key: "destino_nombre", header: "Destino", width: "120px" },
    { key: "lineaTransporte", header: "Línea", width: "120px" },
    {
      key: "status",
      header: "Estatus",
      width: "100px",
      render: (s) => (
        <span className={`reporte-est-badge reporte-est-badge--${(s.status || "").replace(/\s+/g, "-").replace(/[()]/g, "")}`}>
          {s.status || "—"}
        </span>
      )
    },
    { 
      key: "citaCarga", 
      header: "Cita Carga", 
      width: "130px", 
      render: (s) => <span className="text-nowrap">{formatDateTime(s.citaCarga)}</span> 
    },
    { 
      key: "planEmbarqueAt", 
      header: "Pres. Origen", 
      width: "130px", 
      render: (s) => <span className="text-nowrap">{formatDateTime(s.planEmbarqueAt)}</span> 
    },
    {
      key: "desfaseCitaCargaMs",
      header: "Punt. Cita",
      width: "100px",
      render: (s) => (
        <span className={`text-nowrap ${desvioClass(s.desfaseCitaCargaMs)}`}>
          {s.desfaseCitaCargaMs !== null ? formatMs(s.desfaseCitaCargaMs) : "N/A"}
        </span>
      )
    },
    { 
      key: "validacionAt", 
      header: "Validación", 
      width: "130px", 
      render: (s) => <span className="text-nowrap">{formatDateTime(s.validacionAt)}</span> 
    },
    {
      key: "tiempoPresenciaValidacionMs",
      header: "T. Carga",
      width: "100px",
      render: (s) => (
        <span className="text-nowrap">
          {s.tiempoPresenciaValidacionMs !== null ? formatMsAbs(s.tiempoPresenciaValidacionMs) : "N/A"}
        </span>
      )
    },
    { 
      key: "horaSalida", 
      header: "H. Salida", 
      width: "130px", 
      render: (s) => <span className="text-nowrap">{formatDateTime(s.horaSalida)}</span> 
    },
    { 
      key: "inicioRecorridoAt", 
      header: "Inicio Rec.", 
      width: "130px", 
      render: (s) => <span className="text-nowrap">{formatDateTime(s.inicioRecorridoAt)}</span> 
    },
    {
      key: "desfaseHoraSalidaMs",
      header: "Punt. Salida",
      width: "100px",
      render: (s) => (
        <span className={`text-nowrap ${desvioClass(s.desfaseHoraSalidaMs)}`}>
          {s.desfaseHoraSalidaMs !== null ? formatMs(s.desfaseHoraSalidaMs) : "N/A"}
        </span>
      )
    },
    { 
      key: "citaEntrega", 
      header: "Cita Entr.", 
      width: "130px", 
      render: (s) => <span className="text-nowrap">{formatDateTime(s.citaEntrega)}</span> 
    },
    { 
      key: "arriboDestinoAt", 
      header: "Arribo Dest.", 
      width: "130px", 
      render: (s) => <span className="text-nowrap">{formatDateTime(s.arriboDestinoAt)}</span> 
    },
    {
      key: "desfaseCitaEntregaMs",
      header: "Punt. Entr.",
      width: "100px",
      render: (s) => (
        <span className={`text-nowrap ${desvioClass(s.desfaseCitaEntregaMs)}`}>
          {s.desfaseCitaEntregaMs !== null ? formatMs(s.desfaseCitaEntregaMs) : "N/A"}
        </span>
      )
    }
  ], []);

  if (!roleData) return null;

  return (
    <section id="reporteEstadisticasPage" className="settings-page">
      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>

        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Dashboard — Reporte de puntualidad"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
            filters={
              <FilterBar onClear={handleClearFilters}>
                <div>
                  <DatePicker
                    label="Fecha inicio"
                    value={filters.startDate}
                    onChange={(v) => handleFilterChange("startDate", v)}
                  />
                </div>
                <div>
                  <DatePicker
                    label="Fecha fin"
                    value={filters.endDate}
                    onChange={(v) => handleFilterChange("endDate", v)}
                  />
                </div>
                <div>
                  <Select
                    label="Cliente"
                    options={clientOptions}
                    value={filters.cliente}
                    onChange={(v) => handleFilterChange("cliente", v)}
                    placeholder="Seleccionar cliente..."
                  />
                </div>
                <div>
                  <Select
                    label="Origen"
                    options={origenOptions}
                    value={filters.origenFilter}
                    onChange={(v) => handleFilterChange("origenFilter", v)}
                    placeholder="Todos los orígenes"
                    disabled={!filters.cliente}
                  />
                </div>
                <div>
                  <Select
                    label="Destino"
                    options={destinoOptions}
                    value={filters.destinoFilter}
                    onChange={(v) => handleFilterChange("destinoFilter", v)}
                    placeholder="Todos los destinos"
                    disabled={!filters.cliente}
                  />
                </div>
                <div>
                  <Select
                    label="Estatus"
                    options={STATUS_OPTIONS}
                    value={filters.statusFilter}
                    onChange={(v) => handleFilterChange("statusFilter", v)}
                  />
                </div>
                <div>
                  <Select
                    label="Línea de transporte"
                    options={lineaOptions}
                    value={filters.lineaFilter}
                    onChange={(v) => handleFilterChange("lineaFilter", v)}
                    placeholder="Todas las líneas"
                    disabled={!filters.cliente}
                  />
                </div>
                <div>
                  <Select
                    label="Operador"
                    options={operadorOptions}
                    value={filters.operadorFilter}
                    onChange={(v) => handleFilterChange("operadorFilter", v)}
                    placeholder="Todos los operadores"
                    disabled={!filters.cliente}
                  />
                </div>
              </FilterBar>
            }
            filterActions={<>
              <button
                type="button"
                className="new-btn"
                onClick={handleSearch}
                disabled={loading || !filters.startDate || !filters.endDate}>
                <i className={`fas fa-${loading ? "spinner fa-spin" : "search"} me-1`}></i>
                {loading ? "Procesando..." : "Buscar"}
              </button>
              <button
                type="button"
                className="header-action-btn header-action-btn--green"
                onClick={handlePrintPDF}
                disabled={!searched || loading}>
                <i className="fas fa-file-pdf"></i>
                <span>PDF</span>
              </button>
            </>}
          />

          {roleData?.reporte_estadisticas?.read && (
            <div className="settings-content pt-3 px-4">
              {!searched && !loading ? (
                <div className="reporte-est-empty fade-in mt-5">
                  <div className="text-center py-5">
                    <i className="fa fa-chart-column fa-4x mb-3 text-muted opacity-25"></i>
                    <h5 className="fw-bold text-dark">Generar Reporte de Puntualidad</h5>
                    <p className="text-muted mx-auto" style={{maxWidth: '500px'}}>
                      Selecciona un rango de fechas y aplica los filtros necesarios para analizar los tiempos de carga, salida y entrega de tus servicios.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="row g-3 mb-4">
                    <div className="col-md">
                      <div className="metric-card">
                        <div className="metric-card__icon" style={{background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0'}}>
                          <i className="fa fa-truck-loading"></i>
                        </div>
                        <div className="metric-card__body">
                          <div className="metric-card__value">{total}</div>
                          <div className="metric-card__label">Total servicios</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md">
                      <div className="metric-card">
                        <div className="metric-card__icon metric-card__icon--alerts" style={{background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a'}}>
                          <i className="fa fa-clock"></i>
                        </div>
                        <div className="metric-card__body">
                          <div className="metric-card__value">{conDesfaseCita} <span className="fs-7 opacity-75 ms-1">({pct(conDesfaseCita)})</span></div>
                          <div className="metric-card__label">Desfase Cita</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md">
                      <div className="metric-card">
                        <div className="metric-card__icon metric-card__icon--alerts" style={{background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a'}}>
                          <i className="fa fa-truck-arrow-right"></i>
                        </div>
                        <div className="metric-card__body">
                          <div className="metric-card__value">{conDesfaseSalida} <span className="fs-7 opacity-75 ms-1">({pct(conDesfaseSalida)})</span></div>
                          <div className="metric-card__label">Desfase Salida</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md">
                      <div className="metric-card">
                        <div className="metric-card__icon metric-card__icon--alerts" style={{background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a'}}>
                          <i className="fa fa-truck-fast"></i>
                        </div>
                        <div className="metric-card__body">
                          <div className="metric-card__value">{conDesfaseEntrega} <span className="fs-7 opacity-75 ms-1">({pct(conDesfaseEntrega)})</span></div>
                          <div className="metric-card__label">Desfase Entrega</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md">
                      <div className="metric-card">
                        <div className="metric-card__icon metric-card__icon--events" style={{background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd'}}>
                          <i className="fa fa-check-double"></i>
                        </div>
                        <div className="metric-card__body">
                          <div className="metric-card__value">{sinRetraso} <span className="fs-7 opacity-75 ms-1">({pct(sinRetraso)})</span></div>
                          <div className="metric-card__label">Sin Retraso</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bits-table-shell">
                    <DataTable
                      data={servicios}
                      columns={columns}
                      loading={loading}
                      maxHeight="100%"
                      emptyMessage="No se encontraron servicios en el rango seleccionado."
                      rowKey="bitacora_id"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ReporteEstadisticasPage;
