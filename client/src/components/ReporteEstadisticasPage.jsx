import {useEffect, useState} from "react";
import jsPDF from "jspdf";
import {useNavigate} from "react-router-dom";
import Sidebar from "./Sidebar";
import PageHeader from "./PageHeader";
import FilterBar from "./FilterBar";
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
  const [filters, setFilters] = useState({
    startDate:     toLocalDateStr(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate:       toLocalDateStr(today),
    cliente:       "",
    origenFilter:  "",
    destinoFilter: "",
    lineaFilter:   "",
    operadorFilter: "",
    statusFilter:  "",
  });

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
        {key: "tipoTransporte", label: "Tipo unidad", width: 14},
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
          tipoTransporte: servicio.tipoTransporte || "—",
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
            defaultFiltersOpen={true}
            filters={
              <div className="reporte-est-panel mb-0">
                <div className="reporte-est-grid">
                  {/* Fecha inicio */}
                  <div className="reporte-est-field">
                    <label className="reporte-est-field__label">Fecha inicio</label>
                    <input
                      type="date"
                      className="reporte-est-field__control form-control"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange("startDate", e.target.value)}
                    />
                  </div>

                  {/* Fecha fin */}
                  <div className="reporte-est-field">
                    <label className="reporte-est-field__label">Fecha fin</label>
                    <input
                      type="date"
                      className="reporte-est-field__control form-control"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange("endDate", e.target.value)}
                    />
                  </div>

                  {/* Cliente */}
                  <div className="reporte-est-field">
                    <label className="reporte-est-field__label">Cliente</label>
                    <select
                      className="reporte-est-field__control form-select"
                      value={filters.cliente}
                      onChange={(e) => handleFilterChange("cliente", e.target.value)}>
                      <option value="">Todos los clientes</option>
                      {clients.map((c) => (
                        <option key={c._id} value={c.razon_social}>{c.razon_social}</option>
                      ))}
                    </select>
                  </div>

                  {/* Origen */}
                  <div className="reporte-est-field">
                    <label className="reporte-est-field__label">Origen</label>
                    <select
                      className="reporte-est-field__control form-select"
                      value={filters.origenFilter}
                      disabled={!filters.cliente}
                      onChange={(e) => handleFilterChange("origenFilter", e.target.value)}>
                      <option value="">Todos los orígenes</option>
                      {origenes.map((o) => (
                        <option key={o._id} value={o.nombre}>{o.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Destino */}
                  <div className="reporte-est-field">
                    <label className="reporte-est-field__label">Destino</label>
                    <select
                      className="reporte-est-field__control form-select"
                      value={filters.destinoFilter}
                      disabled={!filters.cliente}
                      onChange={(e) => handleFilterChange("destinoFilter", e.target.value)}>
                      <option value="">Todos los destinos</option>
                      {destinos.map((d) => (
                        <option key={d._id} value={d.nombre}>{d.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div className="reporte-est-field">
                    <label className="reporte-est-field__label">Estatus</label>
                    <select
                      className="reporte-est-field__control form-select"
                      value={filters.statusFilter}
                      onChange={(e) => handleFilterChange("statusFilter", e.target.value)}>
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Linea */}
                  <div className="reporte-est-field">
                    <label className="reporte-est-field__label">Línea de transporte</label>
                    <select
                      className="reporte-est-field__control form-select"
                      value={filters.lineaFilter}
                      disabled={!filters.cliente}
                      onChange={(e) => handleFilterChange("lineaFilter", e.target.value)}>
                      <option value="">Todas las líneas</option>
                      {lineas.map((l) => (
                        <option key={l._id} value={l.nombre}>{l.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Operador */}
                  <div className="reporte-est-field">
                    <label className="reporte-est-field__label">Operador</label>
                    <select
                      className="reporte-est-field__control form-select"
                      value={filters.operadorFilter}
                      disabled={!filters.cliente}
                      onChange={(e) => handleFilterChange("operadorFilter", e.target.value)}>
                      <option value="">Todos los operadores</option>
                      {operadores.map((op) => (
                        <option key={op._id} value={op.nombre}>{op.nombre}</option>
                      ))}
                    </select>
                  </div>

                </div>

                <div className="reporte-est-actions-row">
                  <div className="reporte-est-actions">
                    <button
                      type="button"
                      className="btn btn-primary reporte-est-search-btn"
                      onClick={handleSearch}
                      title="Buscar"
                      aria-label="Buscar"
                      disabled={loading || !filters.startDate || !filters.endDate}>
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm" />
                          <span>Buscar</span>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-search" />
                          <span>Buscar</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-success btn-sm reporte-est-export-btn"
                      title="Exportar PDF"
                      aria-label="Exportar PDF"
                      onClick={handlePrintPDF}
                      disabled={!searched || loading}>
                      <i className="fas fa-file-pdf"></i>
                      <span>Exportar</span>
                    </button>
                  </div>
                </div>
              </div>
            }
          />

          {roleData?.reporte_estadisticas?.read && (
          <div className="settings-content mt-4">

            {/* ── Prompt inicial: aún no se ha buscado ─────────────────── */}
            {!searched && !loading && (
              <div className="reporte-est-empty">
                <i className="fas fa-magnifying-glass" />
                <p>Selecciona un rango de fechas y los filtros que necesites, luego presiona <strong>Buscar</strong> para generar el reporte de puntualidad.</p>
              </div>
            )}

            {/* ── KPI Cards ─────────────────────────────────────────── */}
            {searched && !loading && (
              <>
                <div className="reporte-est-kpis">
                  <div className="reporte-est-kpi">
                    <span className="reporte-est-kpi__value">{total}</span>
                    <span className="reporte-est-kpi__label">Total servicios</span>
                  </div>
                  <div className="reporte-est-kpi reporte-est-kpi--warn">
                    <span className="reporte-est-kpi__value">{conDesfaseCita}</span>
                    <span className="reporte-est-kpi__sub">{pct(conDesfaseCita)}</span>
                    <span className="reporte-est-kpi__label">Desfase cita de carga</span>
                  </div>
                  <div className="reporte-est-kpi reporte-est-kpi--warn">
                    <span className="reporte-est-kpi__value">{conDesfaseSalida}</span>
                    <span className="reporte-est-kpi__sub">{pct(conDesfaseSalida)}</span>
                    <span className="reporte-est-kpi__label">Desfase hora de salida</span>
                  </div>
                  <div className="reporte-est-kpi reporte-est-kpi--warn">
                    <span className="reporte-est-kpi__value">{conDesfaseEntrega}</span>
                    <span className="reporte-est-kpi__sub">{pct(conDesfaseEntrega)}</span>
                    <span className="reporte-est-kpi__label">Desfase cita de entrega</span>
                  </div>
                  <div className="reporte-est-kpi reporte-est-kpi--info">
                    <span className="reporte-est-kpi__value">{sinRetraso}</span>
                    <span className="reporte-est-kpi__sub">{pct(sinRetraso)}</span>
                    <span className="reporte-est-kpi__label">Servicios sin retraso</span>
                  </div>
                </div>

                {/* ── Data Table ──────────────────────────────────── */}
                {total === 0 ? (
                  <div className="reporte-est-empty">
                    <i className="fas fa-inbox" />
                    <p>No se encontraron servicios en el rango seleccionado.</p>
                  </div>
                ) : (
                  <div className="reporte-est-table-wrap">
                    <table className="reporte-est-table table table-sm">
                      <thead>
                        <tr>
                          <th>Bitácora</th>
                          <th>Carrier Move</th>
                          <th>Cliente</th>
                          <th>Origen</th>
                          <th>Destino</th>
                          <th>Línea de transporte</th>
                          <th>Tipo unidad</th>
                          <th>Estatus</th>
                          <th>Cita de Carga</th>
                          <th>Presencia de origen</th>
                          <th title="Cita de Carga vs. evento Presencia en origen">Puntualidad Cita</th>
                          <th>Validación</th>
                          <th title="Presencia en origen vs. evento Validación">Tiempo de carga</th>
                          <th>Hora de Salida</th>
                          <th>Inicio de recorrido</th>
                          <th title="Hora de Salida vs. evento Inicio de recorrido">Puntualidad Salida</th>
                          <th>Cita de Entrega</th>
                          <th>Arribo a destino</th>
                          <th title="Cita de Entrega vs. evento Arribo a destino">Puntualidad Entrega</th>
                        </tr>
                      </thead>
                      <tbody>
                        {servicios.map((s) => {
                          const statusIcon = getBitacoraStatusIcon(s.desfaseCitaCargaMs, s.desfaseHoraSalidaMs, s.desfaseCitaEntregaMs);
                          return (
                          <tr key={s.bitacora_id}>
                            <td>
                              <span className="reporte-est-id-wrap">
                                <i className={`fas ${statusIcon.icon} reporte-est-id-status ${statusIcon.className}`} title={statusIcon.title}></i>
                                <span className="reporte-est-id">#{s.bitacora_id}</span>
                              </span>
                            </td>
                            <td>{s.carrierMove || "—"}</td>
                            <td>{s.cliente || "—"}</td>
                            <td>{s.origen_nombre || "—"}</td>
                            <td>{s.destino_nombre || "—"}</td>
                            <td>{s.lineaTransporte || "—"}</td>
                            <td>{s.tipoTransporte || "—"}</td>
                            <td>
                              <span className={`reporte-est-badge reporte-est-badge--${(s.status || "").replace(/\s+/g, "-").replace(/[()]/g, "")}`}>
                                {s.status || "—"}
                              </span>
                            </td>
                            <td className="text-nowrap">{formatDateTime(s.citaCarga)}</td>
                            <td className="text-nowrap">{formatDateTime(s.planEmbarqueAt)}</td>

                            <td className={`text-nowrap ${desvioClass(s.desfaseCitaCargaMs)}`}>
                              {s.desfaseCitaCargaMs !== null ? (
                                <span title={`Plan: ${formatDateTime(s.citaCarga)} → Evento: ${formatDateTime(s.planEmbarqueAt)}`}>
                                  {formatMs(s.desfaseCitaCargaMs)}
                                </span>
                              ) : "N/A"}
                            </td>
                            <td className="text-nowrap">{formatDateTime(s.validacionAt)}</td>
                            <td className="text-nowrap">
                              {s.tiempoPresenciaValidacionMs !== null ? (
                                <span title={`Presencia de origen: ${formatDateTime(s.planEmbarqueAt)} → Validación: ${formatDateTime(s.validacionAt)}`}>
                                  {formatMsAbs(s.tiempoPresenciaValidacionMs)}
                                </span>
                              ) : "N/A"}
                            </td>

                            <td className="text-nowrap">{formatDateTime(s.horaSalida)}</td>
                            <td className="text-nowrap">{formatDateTime(s.inicioRecorridoAt)}</td>

                            <td className={`text-nowrap ${desvioClass(s.desfaseHoraSalidaMs)}`}>
                              {s.desfaseHoraSalidaMs !== null ? (
                                <span title={`Plan: ${formatDateTime(s.horaSalida)} → Evento: ${formatDateTime(s.inicioRecorridoAt)}`}>
                                  {formatMs(s.desfaseHoraSalidaMs)}
                                </span>
                              ) : "N/A"}
                            </td>
                            <td className="text-nowrap">{formatDateTime(s.citaEntrega)}</td>
                            <td className="text-nowrap">{formatDateTime(s.arriboDestinoAt)}</td>
                            <td className={`text-nowrap ${desvioClass(s.desfaseCitaEntregaMs)}`}>
                              {s.desfaseCitaEntregaMs !== null ? (
                                <span title={`Plan: ${formatDateTime(s.citaEntrega)} → Evento: ${formatDateTime(s.arriboDestinoAt)}`}>
                                  {formatMs(s.desfaseCitaEntregaMs)}
                                </span>
                              ) : "N/A"}
                            </td>
                          </tr>
                        );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
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
