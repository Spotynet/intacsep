import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import FilterBar from "../FilterBar";
import DataTable from "../DataTable";
import { Select } from "../Select";
import DatePicker from "../DatePicker";
import CellBadge from "../CellBadge";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import { fetchLineasTransporte } from "../../utils/api";

import { getAllowedClients } from "../../utils/clientPermissions";

const baseUrl = import.meta.env.VITE_BASE_URL;

const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
};

const formatDuration = (ms) => {
  if (ms == null || ms < 0) return "—";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
};

const calcDuration = (entrada, salida) => {
  if (!entrada || !salida) return null;
  return new Date(salida).getTime() - new Date(entrada).getTime();
};

const SwapBadge = ({ record }) => {
  if (record.hubo_cambio_remolque === true)
    return <CellBadge label="Cambio remolque" variant="yellow" />;
  if (record.hubo_cambio_remolque === false)
    return <CellBadge label="Salió igual" variant="green" />;
  if (record.placa_remolque_entrada && !record.fecha_hora_salida)
    return <CellBadge label="En patio" variant="blue" />;
  return <span className="text-muted small">—</span>;
};

const MetricCard = ({ label, value, icon, variant = "duration" }) => (
  <div className="col-md-3 col-6">
    <div className="metric-card">
      <div className={`metric-card__icon metric-card__icon--${variant}`}>
        <i className={`fa ${icon}`}></i>
      </div>
      <div className="metric-card__body">
        <div className="metric-card__value">{value}</div>
        <div className="metric-card__label">{label}</div>
      </div>
    </div>
  </div>
);

const ReporteControlPatiosPage = () => {
  const { user, verifyToken, setUser } = useAuth();
  const { isSidebarCollapsed, setIsMobileSidebarOpen } = useSidebar();
  const navigate = useNavigate();

  const [roleData, setRoleData] = useState(null);
  const [records, setRecords] = useState([]);
  const [remolqueRecords, setRemolqueRecords] = useState([]);
  const [lineas, setLineas] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("camiones"); // "camiones" | "remolques"

  const today = new Date();
  const lastMonth = new Date();
  lastMonth.setDate(today.getDate() - 30);

  const [filters, setFilters] = useState({
    desde: toLocalDateStr(lastMonth),
    hasta: toLocalDateStr(today),
    cliente: "",
    linea: "",
    status: "",
    cambio: "", // "" | "true" | "false"
    placa: "",
  });

  const hasActiveFilters = useMemo(() => {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    const defaultStart = toLocalDateStr(lastMonth);
    const defaultEnd = toLocalDateStr(today);

    return !!(filters.cliente || filters.linea || filters.status || filters.cambio || filters.placa ||
           filters.desde !== defaultStart || filters.hasta !== defaultEnd);
  }, [filters]);

  const handleClearFilters = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setFilters({
      desde: toLocalDateStr(thirtyDaysAgo),
      hasta: toLocalDateStr(today),
      cliente: "",
      linea: "",
      status: "",
      cambio: "",
      placa: "",
    });
  };

  useEffect(() => {
    const init = async () => {
      try {
        const userData = await verifyToken();
        setUser(userData);
        const roleRes = await fetch(`${baseUrl}/roles/${userData.role}`, { credentials: "include" });
        const role = await roleRes.json();
        setRoleData(role);
        if (!role?.reporte_control_patios?.read) { navigate("/"); return; }

        let lineasData;
        if (role.client_access === "specific" && role.allowed_clients) {
          const results = await Promise.all(role.allowed_clients.map(ac => fetchLineasTransporte(ac.client_name)));
          lineasData = Array.from(new Set(results.flat().map(l => JSON.stringify(l)))).map(s => JSON.parse(s));
        } else {
          lineasData = await fetchLineasTransporte();
        }
        setLineas(lineasData);
        const clientsData = await fetch(`${baseUrl}/clients`, { credentials: "include" }).then(r => r.json());
        setClients(clientsData);
      } catch (e) {
        console.error(e);
        navigate("/login");
      }
    };
    init();
  }, []);

  const fetchRecords = useCallback(async () => {
    if (!roleData) return;
    setLoading(true);
    try {
      const [tractorRes, remolqueRes] = await Promise.all([
        fetch(`${baseUrl}/control-patios`, { credentials: "include" }),
        fetch(`${baseUrl}/remolque-visitas`, { credentials: "include" }),
      ]);

      let data = tractorRes.ok ? await tractorRes.json() : [];
      let remolqueData = remolqueRes.ok ? await remolqueRes.json() : [];

      // Client access filter
      if (roleData.client_access === "specific" && roleData.allowed_clients) {
        const allowed = roleData.allowed_clients.map(ac => ac.client_name);
        data = data.filter(r => !r.cliente || allowed.includes(r.cliente));
        remolqueData = remolqueData.filter(r => !r.cliente || allowed.includes(r.cliente));
      }

      // Date range
      const from = filters.desde ? new Date(filters.desde + "T00:00:00") : null;
      const to = filters.hasta ? new Date(filters.hasta + "T23:59:59") : null;
      if (from) {
        data = data.filter(r => new Date(r.fecha_hora_inicio) >= from);
        remolqueData = remolqueData.filter(r => new Date(r.fecha_hora_entrada) >= from);
      }
      if (to) {
        data = data.filter(r => new Date(r.fecha_hora_inicio) <= to);
        remolqueData = remolqueData.filter(r => new Date(r.fecha_hora_entrada) <= to);
      }

      if (filters.cliente) {
        data = data.filter(r => r.cliente === filters.cliente);
        remolqueData = remolqueData.filter(r => r.cliente === filters.cliente);
      }
      if (filters.linea) {
        data = data.filter(r => r.linea_transporte === filters.linea);
        remolqueData = remolqueData.filter(r => r.linea_transporte === filters.linea);
      }
      if (filters.status) {
        data = data.filter(r => r.status === filters.status);
        remolqueData = remolqueData.filter(r => r.status === filters.status);
      }
      if (filters.cambio !== "") {
        const val = filters.cambio === "true";
        data = data.filter(r => r.hubo_cambio_remolque === val);
      }
      if (filters.placa) {
        const term = filters.placa.toLowerCase();
        data = data.filter(r =>
          r.placa?.toLowerCase().includes(term) ||
          r.placa_remolque_entrada?.toLowerCase().includes(term) ||
          r.placa_remolque_salida?.toLowerCase().includes(term)
        );
        remolqueData = remolqueData.filter(r =>
          r.placa?.toLowerCase().includes(term) ||
          r.tractor_entrada_placa?.toLowerCase().includes(term) ||
          r.tractor_salida_placa?.toLowerCase().includes(term)
        );
      }

      setRecords(data);
      setRemolqueRecords(remolqueData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [roleData, filters]);

  useEffect(() => {
    if (roleData) fetchRecords();
  }, [roleData, fetchRecords]);

  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  // Tractor stats
  const total = records.length;
  const enPatio = records.filter(r => r.status === "En patio").length;
  const finalizados = records.filter(r => r.status === "Finalizado").length;
  const conCambio = records.filter(r => r.hubo_cambio_remolque === true).length;
  const sinCambio = records.filter(r => r.hubo_cambio_remolque === false).length;
  const duraciones = records.map(r => calcDuration(r.fecha_hora_inicio, r.fecha_hora_salida)).filter(d => d != null && d > 0);
  const avgDuration = duraciones.length > 0 ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length) : null;

  // Remolque stats
  const remolqueTotal = remolqueRecords.length;
  const remolquesEnPatio = remolqueRecords.filter(r => r.status === "En patio").length;
  const conCambioTractor = remolqueRecords.filter(r => r.hubo_cambio_tractor === true).length;

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Reporte Control de Patios", 14, 15);
    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleString("es-MX")}  |  Período: ${filters.desde} → ${filters.hasta}`, 14, 22);

    if (activeTab === "camiones") {
      doc.autoTable({
        startY: 28,
        head: [["Placa Camión", "Rem. Entrada", "Rem. Salida", "Cambio", "Línea", "Cliente", "Entrada", "Salida", "Duración", "Estado"]],
        body: records.map(r => {
          const dur = calcDuration(r.fecha_hora_inicio, r.fecha_hora_salida);
          return [
            r.placa,
            r.placa_remolque_entrada || "—",
            r.placa_remolque_salida || (r.fecha_hora_salida ? "Sin remolque" : "—"),
            r.hubo_cambio_remolque === true ? "Sí" : r.hubo_cambio_remolque === false ? "No" : "—",
            r.linea_transporte,
            r.cliente || "—",
            formatDate(r.fecha_hora_inicio),
            formatDate(r.fecha_hora_salida),
            formatDuration(dur),
            r.status,
          ];
        }),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [33, 37, 41] },
      });
    } else {
      doc.autoTable({
        startY: 28,
        head: [["Placa Remolque", "Camión entrada", "Camión salida", "Cambio camión", "Línea", "Entrada", "Salida", "Duración", "Estado"]],
        body: remolqueRecords.map(r => {
          const dur = calcDuration(r.fecha_hora_entrada, r.fecha_hora_salida);
          return [
            r.placa,
            r.tractor_entrada_placa || "—",
            r.tractor_salida_placa || (r.fecha_hora_salida ? "—" : "En patio"),
            r.hubo_cambio_tractor === true ? "Sí" : r.hubo_cambio_tractor === false ? "No" : "—",
            r.linea_transporte || "—",
            formatDate(r.fecha_hora_entrada),
            formatDate(r.fecha_hora_salida),
            formatDuration(dur),
            r.status,
          ];
        }),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [33, 37, 41] },
      });
    }

    doc.save(`reporte-control-patios-${filters.desde}-${filters.hasta}.pdf`);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const tractorSheet = XLSX.utils.json_to_sheet(records.map(r => ({
      "Placa Camión": r.placa,
      "Remolque Entrada": r.placa_remolque_entrada || "—",
      "Remolque Salida": r.placa_remolque_salida || (r.fecha_hora_salida ? "Sin remolque" : "—"),
      "Cambio Remolque": r.hubo_cambio_remolque === true ? "Sí" : r.hubo_cambio_remolque === false ? "No" : "—",
      "Línea": r.linea_transporte,
      "Cliente": r.cliente || "—",
      "Entrada": formatDate(r.fecha_hora_inicio),
      "Salida": formatDate(r.fecha_hora_salida),
      "Duración": formatDuration(calcDuration(r.fecha_hora_inicio, r.fecha_hora_salida)),
      "Estado": r.status,
      "Confianza OCR": r.confidence != null ? `${r.confidence.toFixed(1)}%` : "N/A",
    })));
    XLSX.utils.book_append_sheet(wb, tractorSheet, "Camiones");

    const remolqueSheet = XLSX.utils.json_to_sheet(remolqueRecords.map(r => ({
      "Placa Remolque": r.placa,
      "Camión Entrada": r.tractor_entrada_placa || "—",
      "Camión Salida": r.tractor_salida_placa || "—",
      "Cambio Camión": r.hubo_cambio_tractor === true ? "Sí" : r.hubo_cambio_tractor === false ? "No" : "—",
      "Línea": r.linea_transporte || "—",
      "Cliente": r.cliente || "—",
      "Entrada": formatDate(r.fecha_hora_entrada),
      "Salida": formatDate(r.fecha_hora_salida),
      "Duración": formatDuration(calcDuration(r.fecha_hora_entrada, r.fecha_hora_salida)),
      "Estado": r.status,
    })));
    XLSX.utils.book_append_sheet(wb, remolqueSheet, "Remolques");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer], { type: "application/octet-stream" }), `reporte-patios-${filters.desde}-${filters.hasta}.xlsx`);
  };

  const visibleClients = useMemo(() => getAllowedClients(roleData, clients), [roleData, clients]);

  const clientOptions = useMemo(() => visibleClients.map(c => ({ value: c.razon_social, label: c.razon_social })), [visibleClients]);
  const lineaOptions  = useMemo(() => lineas.map(l => ({ value: l.nombre, label: l.nombre })), [lineas]);
  const statusOptions = [
    { value: "En patio", label: "En patio" },
    { value: "Finalizado", label: "Finalizado" }
  ];
  const cambioOptions = [
    { value: "true", label: "Con cambio" },
    { value: "false", label: "Sin cambio" }
  ];

  const tractorColumns = [
    {key: "placa", header: "Placa Camión", className: "fw-bold text-uppercase"},
    {key: "placa_remolque_entrada", header: "Rem. Entrada", render: (r) => r.placa_remolque_entrada || "—"},
    {
      key: "placa_remolque_salida",
      header: "Rem. Salida",
      render: (r) => r.placa_remolque_salida || (r.fecha_hora_salida ? <span className="text-muted small">Sin remolque</span> : "—")
    },
    {key: "cambio", header: "Cambio", render: (r) => <SwapBadge record={r} />},
    {key: "linea_transporte", header: "Línea"},
    {key: "cliente", header: "Cliente", render: (r) => r.cliente || "—"},
    {key: "fecha_hora_inicio", header: "Entrada", render: (r) => formatDate(r.fecha_hora_inicio)},
    {key: "fecha_hora_salida", header: "Salida", render: (r) => formatDate(r.fecha_hora_salida)},
    {key: "duracion", header: "Duración", render: (r) => formatDuration(calcDuration(r.fecha_hora_inicio, r.fecha_hora_salida))},
    {
      key: "status",
      header: "Estado",
      render: (r) => <CellBadge label={r.status} variant={r.status === "En patio" ? "blue" : "green"} />
    },
    {
      key: "confidence",
      header: "Confianza",
      render: (r) => (
        r.confidence != null
          ? <CellBadge 
              label={`${r.confidence.toFixed(1)}%`} 
              variant={r.confidence >= 85 ? "green" : r.confidence >= 60 ? "yellow" : "red"} 
            />
          : <CellBadge label="N/A" variant="gray" />
      )
    },
  ];

  const remolqueColumns = [
    {key: "placa", header: "Placa Remolque", className: "fw-bold text-uppercase"},
    {key: "tractor_entrada_placa", header: "Camión Entrada", render: (r) => r.tractor_entrada_placa || "—"},
    {key: "tractor_salida_placa", header: "Camión Salida", render: (r) => r.tractor_salida_placa || "—"},
    {
      key: "hubo_cambio_tractor",
      header: "Cambio Camión",
      render: (r) => (
        r.hubo_cambio_tractor === true
          ? <CellBadge label="Cambió camión" variant="yellow" />
          : r.hubo_cambio_tractor === false
            ? <CellBadge label="Mismo camión" variant="green" />
            : <span className="text-muted small">—</span>
      )
    },
    {key: "linea_transporte", header: "Línea", render: (r) => r.linea_transporte || "—"},
    {key: "cliente", header: "Cliente", render: (r) => r.cliente || "—"},
    {key: "fecha_hora_entrada", header: "Entrada", render: (r) => formatDate(r.fecha_hora_entrada)},
    {key: "fecha_hora_salida", header: "Salida", render: (r) => formatDate(r.fecha_hora_salida)},
    {key: "duracion", header: "Duración", render: (r) => formatDuration(calcDuration(r.fecha_hora_entrada, r.fecha_hora_salida))},
    {
      key: "status",
      header: "Estado",
      render: (r) => <CellBadge label={r.status} variant={r.status === "En patio" ? "blue" : "green"} />
    },
  ];

  if (!user) return <div>Cargando...</div>;

  return (
    <section id="reporteDetallePatiosPage" className="settings-page">
      <div className="w-100 d-flex h-100 mt-0">
        <div className="sidebar-wrapper"><Sidebar /></div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Reporte Control de Patios"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
            filters={
              <FilterBar onClear={handleClearFilters}>
                <div>
                  <DatePicker label="Desde" value={filters.desde} onChange={v => setFilter("desde", v)} />
                </div>
                <div>
                  <DatePicker label="Hasta" value={filters.hasta} onChange={v => setFilter("hasta", v)} />
                </div>
                <div>
                  <span className="pselect__label">Placa</span>
                  <div className="pdt-field">
                    <i className="fa fa-search pdt-field__icon"></i>
                    <input type="text" className="pdt-field__input"
                      placeholder="Buscar placa..."
                      value={filters.placa}
                      onChange={e => setFilter("placa", e.target.value.toUpperCase())} />
                  </div>
                </div>
                <div>
                  <Select label="Cliente" value={filters.cliente} onChange={v => setFilter("cliente", v)} options={clientOptions} placeholder="Todos" />
                </div>
                <div>
                  <Select label="Línea" value={filters.linea} onChange={v => setFilter("linea", v)} options={lineaOptions} placeholder="Todas" />
                </div>
                <div>
                  <Select label="Estado" value={filters.status} onChange={v => setFilter("status", v)} options={statusOptions} placeholder="Todos" />
                </div>
                <div>
                  <Select label="Cambio remolque" value={filters.cambio} onChange={v => setFilter("cambio", v)} options={cambioOptions} placeholder="Todos" />
                </div>
              </FilterBar>
            }
          >
            <div className="d-flex gap-2">
              <button className="btn-icon btn-icon--success" onClick={exportExcel} title="Exportar Excel" disabled={records.length === 0 && remolqueRecords.length === 0}>
                <i className="fa fa-file-excel"></i>
              </button>
              <button className="btn-icon btn-icon--danger" onClick={exportPDF} title="Exportar PDF" disabled={records.length === 0 && remolqueRecords.length === 0}>
                <i className="fa fa-file-pdf"></i>
              </button>
            </div>
          </PageHeader>

          <div className="settings-content mt-4">
            <div className="reporte-patios-container">
              {/* Stat cards */}
              <div className="row g-3 mb-4">
                <MetricCard label="Total camiones" value={total} icon="fa-truck" variant="duration" />
                <MetricCard label="Camiones en patio" value={enPatio} icon="fa-parking" variant="events" />
                <MetricCard label="Con cambio remolque" value={conCambio} icon="fa-exchange-alt" variant="alerts" />
                <MetricCard label="Tiempo promedio" value={formatDuration(avgDuration)} icon="fa-clock" variant="duration" />
              </div>

              {/* Tabs */}
              <ul className="nav nav-tabs mb-3">
              <li className="nav-item">
                <button className={`nav-link ${activeTab === "camiones" ? "active" : ""}`} onClick={() => setActiveTab("camiones")}>
                  <i className="fa fa-truck me-2"></i>Camiones ({total})
                </button>
              </li>
              <li className="nav-item">
                <button className={`nav-link ${activeTab === "remolques" ? "active" : ""}`} onClick={() => setActiveTab("remolques")}>
                  <i className="fa fa-trailer me-2"></i>Remolques ({remolqueTotal})
                </button>
              </li>
            </ul>

            <div className="bits-table-shell">
              <DataTable
                loading={loading}
                data={activeTab === "camiones" ? records : remolqueRecords}
                columns={activeTab === "camiones" ? tractorColumns : remolqueColumns}
                maxHeight="100%"
                emptyMessage={activeTab === "camiones" ? "No se encontraron registros de camiones." : "No se encontraron registros de remolques."}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
  );
};

export default ReporteControlPatiosPage;
