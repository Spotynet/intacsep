import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import "jspdf-autotable";
import PageHeader from "../PageHeader";
import Sidebar from "../Sidebar";
import FilterBar from "../FilterBar";
import DataTable from "../DataTable";
import DateTimeRangePicker from "../DateTimeRangePicker";
import { MultiSelect } from "../Select";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";

const baseUrl = import.meta.env.VITE_BASE_URL;

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

const formatDuration = (seconds) => {
  if (seconds == null || seconds < 0) return "—";
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (parts.length === 0 || (d === 0 && h === 0 && m < 5)) {
    if (s > 0) parts.push(`${s}s`);
  }

  return parts.length > 0 ? parts.join(" ") : "0s";
};

const formatTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
};

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
};

const formatAxisDuration = (seconds) => {
  if (seconds === 0) return "0";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
};

const toDateTimeLocal = (date) => {
  const pad = (num) => num.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const ControlPatiosDashboard = () => {
  const { user, verifyToken, setUser } = useAuth();
  const { isSidebarCollapsed, setIsMobileSidebarOpen } = useSidebar();
  const navigate = useNavigate();

  const [roleData, setRoleData] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const userData = await verifyToken();
        setUser(userData);
        const roleRes = await fetch(`${baseUrl}/roles/${userData.role}`, { credentials: "include" });
        const role = await roleRes.json();
        setRoleData(role);
        if (!role?.control_patios?.read) { navigate("/"); return; }
      } catch (e) {
        console.error("Error initializing dashboard:", e);
        navigate("/login");
      }
    };
    init();
  }, []);

  const [data, setData] = useState({
    totalRecords: 0,
    anomaliesCount: 0,
    anomaliesList: [],
    longestStay: null,
    shortestStay: null,
    movements: [],
    entryEvents: [],
    exitEvents: [],
    distinctPlates: [],
    distinctRemolquePlates: [],
    remolques: [],
    remolquesEnPatio: 0,
    tractoresEnPatio: 0,
    conCambioRemolque: 0,
    sinCambioRemolque: 0,
  });
  
  const [selectedPlates, setSelectedPlates] = useState([]);
  const [selectedLineas, setSelectedLineas] = useState([]);
  const [periodRange, setPeriodRange] = useState(() => {
    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(now.getMonth() - 1);
    return { start: toDateTimeLocal(oneMonthAgo), end: toDateTimeLocal(now) };
  });

  // Keep a ref always up-to-date with latest filters so fetchDashboardData closure is never stale
  const filtersRef = useRef({ periodRange, selectedPlates, selectedLineas });
  useEffect(() => {
    filtersRef.current = { periodRange, selectedPlates, selectedLineas };
  }, [periodRange, selectedPlates, selectedLineas]);

  // Stable fetch function — reads filters from ref so it never needs to be recreated
  const fetchDashboardData = useCallback(async () => {
    const { periodRange, selectedPlates, selectedLineas } = filtersRef.current;
    try {
      let url = `${baseUrl}/control-patios/dashboard-summary?`;
      if (periodRange.start) url += `&desde=${encodeURIComponent(periodRange.start)}`;
      if (periodRange.end)   url += `&hasta=${encodeURIComponent(periodRange.end)}`;
      if (selectedPlates.length > 0) url += `&plate=${selectedPlates.join(',')}`;
      if (selectedLineas.length > 0) url += `&linea=${selectedLineas.join(',')}`;

      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (e) {
      console.error("Error fetching dashboard data:", e);
    }
  }, []); // stable — no dependencies needed

  // Re-fetch whenever filters change
  useEffect(() => {
    if (roleData) fetchDashboardData();
  }, [roleData, periodRange, selectedPlates, selectedLineas, fetchDashboardData]);

  // Auto-refresh every 30 seconds — interval is stable, always uses latest filters via ref
  useEffect(() => {
    if (!roleData) return;
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [roleData, fetchDashboardData]);

  // Server already filters by plate, line and date range — use data.movements directly
  const filteredMovements = useMemo(() => data.movements, [data.movements]);

  const hasActiveFilters = useMemo(() => {
    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(now.getMonth() - 1);
    const defaultStart = toDateTimeLocal(oneMonthAgo);
    const defaultEnd = toDateTimeLocal(now);

    return selectedPlates.length > 0 || selectedLineas.length > 0 || 
           periodRange.start !== defaultStart || periodRange.end !== defaultEnd;
  }, [selectedPlates, selectedLineas, periodRange]);

  const barChartData = useMemo(() => {
    return filteredMovements
      .filter(m => m.stay_seconds != null)
      .slice(0, 10)
      .map(m => ({
        plate: m.placa,
        seconds: m.stay_seconds,
        duration: formatDuration(m.stay_seconds)
      }));
  }, [filteredMovements]);

  const pieChartData = useMemo(() => {
    const top5 = filteredMovements
      .filter(m => m.stay_seconds != null)
      .sort((a, b) => b.stay_seconds - a.stay_seconds)
      .slice(0, 5);
    
    return top5.map(m => ({
      name: m.placa,
      value: m.stay_seconds
    }));
  }, [filteredMovements]);

  const handleResolveAnomaly = async (id) => {
    try {
      const res = await fetch(`${baseUrl}/patio-anomalies/${id}/resolve`, {
        method: "PATCH",
        credentials: "include"
      });
      if (res.ok) fetchDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  const exportToExcel = () => {
    if (filteredMovements.length === 0) {
      alert("No hay datos para exportar");
      return;
    }
    const exportData = filteredMovements.map((m) => ({
      "Placa Camión": m.placa ? m.placa.toUpperCase() : "—",
      "Remolque Entrada": m.placa_remolque_entrada || "—",
      "Remolque Salida": m.placa_remolque_salida || (m.fecha_hora_salida ? "Sin remolque" : "—"),
      "Cambio Remolque": m.hubo_cambio_remolque === true ? "Sí" : m.hubo_cambio_remolque === false ? "No" : "—",
      "Línea de Transporte": m.linea_transporte || "—",
      Entrada: m.fecha_hora_inicio ? `${formatDate(m.fecha_hora_inicio)} ${formatTime(m.fecha_hora_inicio)}` : "—",
      Salida: m.fecha_hora_salida ? `${formatDate(m.fecha_hora_salida)} ${formatTime(m.fecha_hora_salida)}` : "En patio",
      Duración: formatDuration(m.stay_seconds),
      Estado: m.status || "—",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const fileData = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(fileData, `movimientos_patios_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToPDF = async () => {
    if (filteredMovements.length === 0) {
      alert("No hay datos para exportar");
      return;
    }

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

    const doc = new jsPDF({ orientation: "portrait" });
    const now = new Date();
    const formattedNow = now.toLocaleString("es-MX");

    // Header Background
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, "F");

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", 14, 3, 16, 16);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Reporte Control de Patios", logoDataUrl ? 35 : 14, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Generado: ${formattedNow}`, doc.internal.pageSize.getWidth() - 14, 14, { align: "right" });

    // Reset text color for body
    doc.setTextColor(0, 0, 0);

    // Filters Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Filtros Aplicados:", 14, 30);
    doc.setFont("helvetica", "normal");
    
    const startRange = periodRange.start ? new Date(periodRange.start).toLocaleString("es-MX") : "Inicio";
    const endRange = periodRange.end ? new Date(periodRange.end).toLocaleString("es-MX") : "Fin";
    doc.text(`Rango de fecha: ${startRange} - ${endRange}`, 14, 35);
    doc.text(`Placas filtradas: ${selectedPlates.length > 0 ? selectedPlates.join(", ") : "Todas"}`, 14, 40);
    doc.text(`Líneas filtradas: ${selectedLineas.length > 0 ? selectedLineas.join(", ") : "Todas"}`, 14, 45);

    // Stats Summary Box
    doc.setFont("helvetica", "bold");
    doc.text("Estadísticas del Período:", 14, 54);
    
    // Draw box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 249, 250);
    doc.rect(14, 57, 182, 28, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text("Registros Totales:", 18, 64);
    doc.text("Anomalías Activas:", 18, 70);
    doc.text("Mayor Tiempo:", 18, 76);
    doc.text("Menor Tiempo:", 110, 64);

    doc.setFont("helvetica", "normal");
    doc.text(String(filteredMovements.length), 55, 64);
    doc.text(String(data.anomaliesCount), 55, 70);
    doc.text(data.longestStay ? `${data.longestStay.plate} (${formatDuration(data.longestStay.seconds)})` : "—", 55, 76);
    doc.text(data.shortestStay ? `${data.shortestStay.plate} (${formatDuration(data.shortestStay.seconds)})` : "—", 138, 64);

    doc.setTextColor(0, 0, 0);

    // Table of Movements
    doc.autoTable({
      startY: 92,
      head: [["Placa Camión", "Rem. Entrada", "Rem. Salida", "Cambio", "Línea", "Entrada", "Salida", "Duración", "Estado"]],
      body: filteredMovements.map(m => [
        m.placa ? m.placa.toUpperCase() : "—",
        m.placa_remolque_entrada || "—",
        m.placa_remolque_salida || (m.fecha_hora_salida ? "Sin remolque" : "—"),
        m.hubo_cambio_remolque === true ? "Sí" : m.hubo_cambio_remolque === false ? "No" : "—",
        m.linea_transporte || "—",
        m.fecha_hora_inicio ? `${formatDate(m.fecha_hora_inicio)} ${formatTime(m.fecha_hora_inicio)}` : "—",
        m.fecha_hora_salida ? `${formatDate(m.fecha_hora_salida)} ${formatTime(m.fecha_hora_salida)}` : "En patio",
        formatDuration(m.stay_seconds),
        m.status || "—",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`reporte-control-patios-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleClearFilters = () => {
    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(now.getMonth() - 1);
    setPeriodRange({ start: toDateTimeLocal(oneMonthAgo), end: toDateTimeLocal(now) });
    setSelectedPlates([]);
    setSelectedLineas([]);
  };

  const columns = [
    { key: "placa", header: "Placa Camión", className: "fw-bold text-uppercase" },
    { key: "placa_remolque_entrada", header: "Remolque entrada", render: (row) => row.placa_remolque_entrada || <span className="text-muted">—</span> },
    { key: "placa_remolque_salida", header: "Remolque salida", render: (row) => row.placa_remolque_salida || (row.fecha_hora_salida ? <span className="text-muted small">Sin remolque</span> : <span className="text-muted">—</span>) },
    {
      key: "swap",
      header: "Cambio",
      render: (row) => {
        if (row.hubo_cambio_remolque === true) return <span className="badge bg-warning text-dark">Cambio remolque</span>;
        if (row.hubo_cambio_remolque === false) return <span className="badge bg-success">Salió igual</span>;
        return row.placa_remolque_entrada ? <span className="badge bg-secondary">En patio</span> : <span className="text-muted small">Sin remolque</span>;
      },
    },
    { key: "linea_transporte", header: "Línea" },
    { key: "fecha_hora_inicio", header: "Entrada", render: (row) => `${formatDate(row.fecha_hora_inicio)} ${formatTime(row.fecha_hora_inicio)}` },
    { key: "fecha_hora_salida", header: "Salida", render: (row) => row.fecha_hora_salida ? `${formatDate(row.fecha_hora_salida)} ${formatTime(row.fecha_hora_salida)}` : <span className="badge bg-info">En patio</span> },
    { key: "stay_seconds", header: "Duración", render: (row) => formatDuration(row.stay_seconds) },
    { key: "status", header: "Estado", render: (row) => <span className={`badge bg-${row.status === "En patio" ? "info" : "success"}`}>{row.status}</span> },
  ];

  if (!user || !roleData) return <div className="p-4">Cargando dashboard...</div>;

  return (
    <div id="controlPatiosDashboardPage" className="d-flex h-100 bg-light" style={{ minHeight: "100vh" }}>
      <div className="sidebar-wrapper"><Sidebar /></div>
      
      <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        
        <PageHeader
          title="Control de Patios"
          onToggleSidebar={() => setIsMobileSidebarOpen(true)}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          filters={
            <div className="reporte-patios-panel mb-0">
              <div className="reporte-patios-grid">
                <div className="reporte-patios-field">
                  <MultiSelect
                    label="Placas camión"
                    options={data.distinctPlates || []}
                    value={selectedPlates}
                    onChange={setSelectedPlates}
                  />
                </div>
                
                <div className="reporte-patios-field">
                  <MultiSelect 
                    label="Líneas"
                    options={data.distinctLineas || []}
                    value={selectedLineas}
                    onChange={setSelectedLineas}
                  />
                </div>

                <div className="reporte-patios-field" style={{ gridColumn: 'span 2' }}>
                  <DateTimeRangePicker 
                    label="Periodo"
                    startValue={periodRange.start}
                    endValue={periodRange.end}
                    onStartChange={(val) => setPeriodRange(prev => ({ ...prev, start: val }))}
                    onEndChange={(val) => setPeriodRange(prev => ({ ...prev, end: val }))}
                  />
                </div>
              </div>
            </div>
          }
        >
          <div className="d-flex gap-2">
            <button className="btn-icon btn-icon--success" onClick={exportToExcel} title="Exportar Excel" disabled={filteredMovements.length === 0}>
              <i className="fa fa-file-excel"></i>
            </button>
            <button className="btn-icon btn-icon--danger" onClick={exportToPDF} title="Exportar PDF" disabled={filteredMovements.length === 0}>
              <i className="fa fa-file-pdf"></i>
            </button>
          </div>
        </PageHeader>

        <div className="px-3 mt-4">
          <div className="row g-3 mb-4">
            <div className="col-md-2 col-6">
              <div className="metric-card h-100">
                <div className="metric-card__icon metric-card__icon--duration">
                  <i className="fa fa-truck"></i>
                </div>
                <div className="metric-card__body">
                  <div className="metric-card__value">{data.tractoresEnPatio}</div>
                  <div className="metric-card__label">Camiones</div>
                </div>
              </div>
            </div>
            <div className="col-md-2 col-6">
              <div className="metric-card h-100">
                <div className="metric-card__icon metric-card__icon--events">
                  <i className="fa fa-trailer"></i>
                </div>
                <div className="metric-card__body">
                  <div className="metric-card__value">{data.remolquesEnPatio}</div>
                  <div className="metric-card__label">Remolques</div>
                </div>
              </div>
            </div>
            <div className="col-md-2 col-6">
              <div className="metric-card h-100">
                <div className="metric-card__icon metric-card__icon--alerts">
                  <i className="fa fa-exchange-alt"></i>
                </div>
                <div className="metric-card__body">
                  <div className="metric-card__value">{data.conCambioRemolque}</div>
                  <div className="metric-card__label">Con Cambio</div>
                </div>
              </div>
            </div>
            <div className="col-md-2 col-6">
              <div className="metric-card h-100">
                <div className="metric-card__icon metric-card__icon--events">
                  <i className="fa fa-check-circle"></i>
                </div>
                <div className="metric-card__body">
                  <div className="metric-card__value">{data.sinCambioRemolque}</div>
                  <div className="metric-card__label">Sin Cambio</div>
                </div>
              </div>
            </div>
            <div className="col-md-2 col-6">
              <div className="metric-card h-100">
                <div className="metric-card__icon metric-card__icon--duration">
                  <i className="fa fa-clock"></i>
                </div>
                <div className="metric-card__body">
                  <div className="metric-card__value" style={{fontSize: '0.85rem'}}>
                    {data.longestStay ? `${data.longestStay.plate}: ${formatDuration(data.longestStay.seconds)}` : "—"}
                  </div>
                  <div className="metric-card__label">Mayor Estadía</div>
                </div>
              </div>
            </div>
            <div className="col-md-2 col-6">
              <div className="metric-card h-100">
                <div className="metric-card__icon metric-card__icon--alerts">
                  <i className="fa fa-shield-halved"></i>
                </div>
                <div className="metric-card__body">
                  <div className="metric-card__value">{data.anomaliesCount}</div>
                  <div className="metric-card__label">Anomalías</div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-8">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0 py-3">
                  <h6 className="mb-0 fw-bold">Movimientos Recientes</h6>
                </div>
                <div className="card-body p-0">
                  <DataTable
                    data={filteredMovements}
                    columns={columns}
                    maxHeight="400px"
                    emptyMessage="No hay movimientos en el periodo seleccionado."
                  />
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0 py-3">
                  <h6 className="mb-0 fw-bold text-danger">Anomalías Recientes</h6>
                </div>
                <div className="card-body p-0 overflow-auto" style={{ maxHeight: "450px" }}>
                  <ul className="list-group list-group-flush">
                    {data.anomaliesList.map(a => (
                      <li key={a._id} className="list-group-item py-3">
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <span className="fw-bold text-primary">{a.plate}</span>
                          <span className={`badge bg-${a.severity === "high" ? "danger" : a.severity === "medium" ? "warning" : "info"} x-small`}>{a.severity}</span>
                        </div>
                        <div className="text-muted small mb-2">{a.description || a.anomaly_type.replace(/_/g, " ")}</div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="x-small text-muted">{new Date(a.createdAt).toLocaleString()}</span>
                          <button 
                            className="btn btn-outline-primary btn-sm x-small px-2 py-1" 
                            onClick={() => handleResolveAnomaly(a._id)}
                          >
                            Resolver
                          </button>
                        </div>
                      </li>
                    ))}
                    {data.anomaliesList.length === 0 && (
                      <li className="list-group-item text-center py-4 text-muted">No hay anomalías pendientes.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-8">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0 py-3">
                  <h6 className="mb-0 fw-bold">Tiempo de estadía por placa (Top 10)</h6>
                </div>
                <div className="card-body" style={{ height: "350px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} layout="vertical" margin={{ left: 10, right: 30, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis 
                        type="number" 
                        tickFormatter={formatAxisDuration}
                        tick={{ fontSize: 10, fill: "#6c757d" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                      />
                      <YAxis dataKey="plate" type="category" width={100} tick={{ fontSize: 11, fill: "#374151", fontWeight: 500 }} />
                      <ReTooltip 
                        formatter={(value) => formatDuration(value)}
                        labelStyle={{ color: "#333", fontWeight: "bold" }}
                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                      />
                      <Bar dataKey="seconds" name="tiempo" fill="#4ca6f6" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-0 py-3">
                  <h6 className="mb-0 fw-bold">Distribución de Estadía (Top 5)</h6>
                </div>
                <div className="card-body" style={{ height: "350px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="name"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ReTooltip 
                        formatter={(value, name) => [formatDuration(value), "tiempo"]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPatiosDashboard;
