import React, {useState, useEffect, useMemo, useCallback, useRef} from "react";
import {useAuth} from "../context/AuthContext";
import {useSidebar} from "../context/SidebarContext";
import {useNavigate} from "react-router-dom";
import Sidebar from "./Sidebar";
import PageHeader from "./PageHeader";
import FilterBar from "./FilterBar";
import {Select} from "./Select";
import DatePicker from "./DatePicker";
import DataTable from "./DataTable";
import {getAllowedClients} from "../utils/clientPermissions";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";

// Standardized Skeleton component
const Skeleton = ({ width = "100%", height = "20px", className = "" }) => (
  <div 
    className={`skeleton-loader ${className}`} 
    style={{ width, height, borderRadius: '6px', display: 'inline-block' }}
  />
);

const AnomaliasDashboardPage = () => {
  const {user} = useAuth();
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const navigate = useNavigate();

  const baseUrl = import.meta.env.VITE_BASE_URL || "http://localhost:3001";

  const [roleData, setRoleData] = useState(null);

  // Role permissions are now fetched bundled in fetchDashboardData initial load
  // to minimize re-renders and synchronized loading.

  const [oncEventsData, setOncEventsData] = useState([]);
  const [bitacorasAnomalias, setBitacorasAnomalias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  
  // Unified loading state for synchronized transitions
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  
  const [availableClients, setAvailableClients] = useState([]);
  const [availableLineasTransporte, setAvailableLineasTransporte] = useState([]);
  const [availableOperadores, setAvailableOperadores] = useState([]);
  const [loadingLineasTransporte, setLoadingLineasTransporte] = useState(false);
  const [loadingOperadores, setLoadingOperadores] = useState(false);

  // Estados para controlar las vistas de las gráficas
  const [lineasViewMode, setLineasViewMode] = useState("pie"); // 'pie' or 'bar'
  const [operadoresViewMode, setOperadoresViewMode] = useState("pie"); // 'pie' or 'bar'
  const [tiposViewMode, setTiposViewMode] = useState("pie"); // 'pie' or 'bar'

  // Function to fetch transport lines filtered by client
  const fetchLineasTransporte = useCallback(
    async (cliente = "all") => {
      try {
        setLoadingLineasTransporte(true);
        let lineasData = [];

        // Only fetch transport lines if a specific client is selected (not "all")
        if (cliente && cliente !== "all") {
          try {
            const lineasResponse = await fetch(
              `${baseUrl}/lineas-transporte?cliente=${encodeURIComponent(cliente)}`,
              {
                method: "GET",
                credentials: "include",
              }
            );
            if (lineasResponse.ok) {
              const newLineasData = await lineasResponse.json();
              lineasData = newLineasData.map((linea) => ({
                _id: linea._id,
                nombre: linea.nombre,
              }));
            }
          } catch (error) {
            console.warn("New transport lines endpoint not available:", error);
          }
        }

        // Only use data from the LineaTransporte model, not from bitacoras
        // This ensures we only show transport lines that exist in the database

        setAvailableLineasTransporte(lineasData);
      } catch (error) {
        console.error("Error fetching transport lines:", error);
        setAvailableLineasTransporte([]);
      } finally {
        setLoadingLineasTransporte(false);
      }
    },
    [baseUrl]
  );

  // Function to fetch operators filtered by transport line
  const fetchOperadores = useCallback(
    async (lineaTransporte = "all") => {
      try {
        setLoadingOperadores(true);
        let operadoresData = [];

        // Only fetch operators if a specific transport line is selected (not "all")
        if (lineaTransporte && lineaTransporte !== "all") {
          try {
            const operadoresResponse = await fetch(
              `${baseUrl}/operadores?lineaTransporte=${encodeURIComponent(lineaTransporte)}`,
              {
                method: "GET",
                credentials: "include",
              }
            );
            if (operadoresResponse.ok) {
              const newOperadoresData = await operadoresResponse.json();
              operadoresData = newOperadoresData.map((operador) => ({
                _id: operador._id,
                nombre: operador.nombre || operador.name || "",
              }));
            }
          } catch (error) {
            console.warn("New operators endpoint not available:", error);
          }
        }

        // Only use data from the Operador model, not from bitacoras
        // This ensures we only show operators that exist in the database

        setAvailableOperadores(operadoresData);
      } catch (error) {
        console.error("Error fetching operators:", error);
        setAvailableOperadores([]);
      } finally {
        setLoadingOperadores(false);
      }
    },
    [baseUrl]
  );

  // Date helpers
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const lastMonthStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  }, []);

  // Filtros pendientes
  const [filters, setFilters] = useState({
    cliente: "all",
    fechaDesde: lastMonthStr,
    fechaHasta: todayStr,
    lineaTransporte: "all",
    operador: "all"
  });

  // Filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    cliente: "all",
    fechaDesde: lastMonthStr,
    fechaHasta: todayStr,
    lineaTransporte: "all",
    operador: "all"
  });

  const [applyFiltersTrigger, setApplyFiltersTrigger] = useState(0);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Table filters state and visibility
  const [isTableFiltersOpen, setIsTableFiltersOpen] = useState(false);
  const [tableFilters, setTableFilters] = useState({
    bitacoraId: "",
    cliente: "",
    anomalias: "",
    lineaTransporte: "",
    operador: "",
    origen: "",
    destino: "",
    estado: "",
  });

  const hasActiveTableFilters = useMemo(() => {
    return Object.values(tableFilters).some(val => val !== "");
  }, [tableFilters]);

  // Expanded rows state for detail panel
  const [expandedRows, setExpandedRows] = useState(new Set());
  const toggleRow = (key) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const hasActiveFilters = useMemo(() => {
    return (
      appliedFilters.fechaDesde !== lastMonthStr ||
      appliedFilters.fechaHasta !== todayStr ||
      appliedFilters.cliente !== "all" ||
      appliedFilters.lineaTransporte !== "all" ||
      appliedFilters.operador !== "all"
    );
  }, [appliedFilters, lastMonthStr, todayStr]);

  // Function to apply filters when check button is pressed
  const applyFilters = () => {
    setFilterLoading(true);
    setAppliedFilters({ ...filters });
    setApplyFiltersTrigger((prev) => prev + 1);
  };

  // Function to reset filters
  const resetFilters = () => {
    const defaultFilters = {
      cliente: "all",
      fechaDesde: lastMonthStr,
      fechaHasta: todayStr,
      lineaTransporte: "all",
      operador: "all"
    };
    setFilters(defaultFilters);
    setFilterLoading(true);
    setAppliedFilters({ ...defaultFilters });
    setApplyFiltersTrigger((prev) => prev + 1);
  };

  // Function to handle table filter changes
  const handleTableFilterChange = (field, value) => {
    setTableFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Function to clear all table filters
  const clearTableFilters = () => {
    setTableFilters({
      bitacoraId: "",
      cliente: "",
      anomalias: "",
      lineaTransporte: "",
      operador: "",
      origen: "",
      destino: "",
      estado: "",
    });
  };

  // Get unique values for dropdown filters
  const getUniqueValues = (field) => {
    const values = bitacorasAnomalias
      .map((item) => {
        if (field === "anomalias") {
          return item.categorias || [];
        }

        const fieldValue = item[field] || "";

        // Handle concatenated values (like "DHL/MAGDAMEX, DHL/BUZMYR")
        if (field === "lineaTransporte" || field === "operador") {
          if (typeof fieldValue === "string" && fieldValue.includes(",")) {
            return fieldValue
              .split(",")
              .map((v) => v.trim())
              .filter((v) => v && v !== "N/A");
          }
        }

        return fieldValue;
      })
      .flat()
      .filter((value) => value && value.trim() !== "" && value !== "N/A")
      .map((value) => value.toString().trim());

    return [...new Set(values)].sort();
  };

  // Get unique anomaly categories
  const getUniqueAnomalias = () => {
    const allCategories = bitacorasAnomalias
      .flatMap((item) => item.categorias || [])
      .filter((cat) => cat && cat.trim() !== "");
    return [...new Set(allCategories)].sort();
  };

  // Function to handle transport line selection from pie chart
  const handleLineaTransporteClick = (data) => {
    if (data && data.lineaTransporte) {
      const nextFilters = {
        ...filters,
        lineaTransporte: data.lineaTransporte,
        operador: "all"
      };
      setFilters(nextFilters);
      setAppliedFilters({ ...nextFilters });
    }
  };

  // Function to handle operator selection from pie chart
  const handleOperadorClick = (data) => {
    if (data && data.operador) {
      const nextFilters = {
        ...filters,
        operador: data.operador
      };
      setFilters(nextFilters);
      setAppliedFilters({ ...nextFilters });
    }
  };

  // Helper function to format numbers with thousands separator
  const formatNumber = (num) => {
    if (num === null || num === undefined) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Helper function to get anomaly color (matching dashboard colors)
  const getAnomaliaColor = (categoria) => {
    const colorMap = {
      ENA: "#3b82f6", // Blue (same as dashboard)
      FM: "#10b981", // Green (same as dashboard)
      ONC: "#f59e0b", // Orange (same as dashboard)
      DR: "#ef4444", // Red (same as dashboard)
    };
    return colorMap[categoria] || "#6b7280";
  };

  const downloadBitacorasAnomaliasExcel = (filteredData) => {
    if (!filteredData || filteredData.length === 0) {
      alert("No hay datos para exportar");
      return;
    }

    const dash = "—";
    const val = (v) => (v && v !== "N/A" ? v : dash);

    // Expand multi-GPS events: one row per GPS unit, repeating anomaly fields
    const excelData = [];
    filteredData.forEach((bitacora) => {
      const base = {
        "No. Bitácora":    val(bitacora.bitacora_id),
        "Folio Servicio":  val(bitacora.folio_servicio),
        "Cliente":         val(bitacora.cliente),
        "Categoría":       bitacora.categorias?.length > 0 ? bitacora.categorias.join(", ") : dash,
        "Evento":          bitacora.eventoNombres?.length > 0 ? bitacora.eventoNombres.join(", ") : dash,
        "Línea Transporte": val(bitacora.linea_transporte),
        "Operador":        val(bitacora.operador),
        "Origen":          val(bitacora.origen),
        "Destino":         val(bitacora.destino),
        "Estado":          val(bitacora.status),
      };

      const readings = bitacora.gpsReadings || [];
      if (readings.length === 0) {
        excelData.push({
          ...base,
          "Último Posicionamiento": dash,
          "Ubicación":              dash,
          "Coordenadas":            dash,
          "Velocidad (km/h)":       dash,
        });
      } else {
        readings.forEach((r) => {
          excelData.push({
            ...base,
            "Último Posicionamiento": val(r.ultimo_posicionamiento),
            "Ubicación":              val(r.ubicacion),
            "Coordenadas":            val(r.coordenadas),
            "Velocidad (km/h)":       val(r.velocidad),
          });
        });
      }
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    worksheet["!cols"] = [
      {wch: 14},  // No. Bitácora
      {wch: 18},  // Folio Servicio
      {wch: 22},  // Cliente
      {wch: 12},  // Categoría
      {wch: 28},  // Evento
      {wch: 22},  // Línea Transporte
      {wch: 24},  // Operador
      {wch: 28},  // Origen
      {wch: 28},  // Destino
      {wch: 14},  // Estado
      {wch: 22},  // Último Posicionamiento
      {wch: 45},  // Ubicación
      {wch: 28},  // Coordenadas
      {wch: 16},  // Velocidad
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Anomalías");

    const currentDate = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `Bitacoras_Anomalias_${currentDate}.xlsx`);
  };

  const downloadBitacorasAnomaliasPDF = async (filteredData) => {
    if (!filteredData || filteredData.length === 0) {
      alert("No hay datos para exportar");
      return;
    }

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
    } catch (_) {}

    const doc = new jsPDF({orientation: "landscape", unit: "mm", format: "a4"});
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageW - margin * 2;
    const footerH = 8;
    const usableBottom = pageH - footerH - 4;
    let y = 0;

    const addPage = () => {
      drawFooter();
      doc.addPage();
      y = margin;
    };
    const checkPageBreak = (needed = 10) => { if (y + needed > usableBottom) addPage(); };

    const drawFooter = () => {
      const p = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, pageH - footerH, pageW - margin, pageH - footerH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("Reporte de Anomalías — INTACSEP", margin, pageH - 3);
      doc.text(`Página ${p}`, pageW - margin, pageH - 3, {align: "right"});
    };

    const sectionTitle = (text) => {
      checkPageBreak(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(text, margin, y);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.line(margin, y + 1.5, margin + contentW, y + 1.5);
      y += 6;
    };

    const drawSummaryCard = (x, cardY, w, h, value, label, fill = [248, 250, 252]) => {
      doc.setFillColor(...fill);
      doc.roundedRect(x, cardY, w, h, 2.5, 2.5, "F");
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, cardY, w, h, 2.5, 2.5, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text(String(value), x + 4, cardY + 8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.splitTextToSize(label, w - 8).forEach((line, i) => doc.text(line, x + 4, cardY + 13 + i * 3.5));
    };

    // ── Header bar ──
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 20, "F");
    if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", margin, 2, 15, 15);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Reporte de Anomalías", logoDataUrl ? margin + 18 : margin, 13);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generado el ${new Date().toLocaleString("es-MX", {dateStyle: "short", timeStyle: "short"})}`,
      pageW - margin, 13, {align: "right"}
    );
    y = 26;

    // ── Active filters ──
    sectionTitle("Filtros aplicados");
    const filters = [
      ["Cliente", appliedFilters.cliente !== "all" ? appliedFilters.cliente : "Todos"],
      ["Fecha desde", appliedFilters.fechaDesde || "—"],
      ["Fecha hasta", appliedFilters.fechaHasta || "—"],
      ["Línea transporte", appliedFilters.lineaTransporte !== "all" ? appliedFilters.lineaTransporte : "Todas"],
      ["Operador", appliedFilters.operador !== "all" ? appliedFilters.operador : "Todos"],
    ];
    const colW = contentW / 3;
    filters.forEach(([label, value], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const fx = margin + col * colW;
      const fy = y + row * 7;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(label.toUpperCase(), fx, fy);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(String(value), fx, fy + 3.5);
    });
    y += Math.ceil(filters.length / 3) * 7 + 4;

    // ── Summary cards ──
    sectionTitle("Resumen");
    const total = filteredData.length;
    const byStatus = filteredData.reduce((acc, b) => { acc[b.status] = (acc[b.status] || 0) + 1; return acc; }, {});
    const byCategoria = filteredData.reduce((acc, b) => {
      (b.categorias || []).forEach(c => { acc[c] = (acc[c] || 0) + 1; });
      return acc;
    }, {});
    const topCat = Object.entries(byCategoria).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const cards = [
      {value: total, label: "Total anomalías", fill: [239, 246, 255]},
      {value: byStatus["Nueva"] || 0, label: "Nuevas", fill: [236, 253, 245]},
      {value: byStatus["En proceso"] || 0, label: "En proceso", fill: [239, 246, 255]},
      {value: byStatus["Cerrada"] || 0, label: "Cerradas", fill: [254, 242, 242]},
      ...topCat.map(([cat, count]) => ({value: count, label: cat, fill: [255, 251, 235]})),
    ];
    const cardW = (contentW - 4 * (cards.length - 1)) / cards.length;
    cards.forEach((c, i) => drawSummaryCard(margin + i * (cardW + 4), y, cardW, 20, c.value, c.label, c.fill));
    y += 26;

    // ── Table ──
    sectionTitle("Detalle de anomalías");

    const columns = [
      {label: "Bitácora",    key: "bitacora_id",       w: 14},
      {label: "Folio",       key: "folio_servicio",    w: 18},
      {label: "Cliente",     key: "cliente",           w: 22},
      {label: "Categoría",   key: "_categoria",        w: 12},
      {label: "Evento",      key: "_evento",           w: 30},
      {label: "Línea",       key: "linea_transporte",  w: 22},
      {label: "Operador",    key: "operador",          w: 24},
      {label: "Origen",      key: "origen",            w: 24},
      {label: "Destino",     key: "destino",           w: 24},
      {label: "Estado",      key: "status",            w: 16},
      {label: "Últ. Pos.",   key: "_gpsTime",          w: 20},
      {label: "Ubicación",   key: "_gpsLoc",           w: 50},
      {label: "Coords.",     key: "_gpsCoords",        w: 26},
      {label: "Vel.",        key: "_gpsSpeed",         w: 10},
    ];
    // Scale columns proportionally to fit contentW
    const rawTotalW = columns.reduce((s, c) => s + c.w, 0);
    const scale = contentW / rawTotalW;
    columns.forEach(c => { c.w = c.w * scale; });

    const cellPad = 1.2;
    const rowH = 5.5;
    const headerH = 6;

    // Header row
    const drawTableHeader = () => {
      doc.setFillColor(30, 41, 59);
      doc.rect(margin, y, contentW, headerH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      let cx = margin;
      columns.forEach(col => {
        const lines = doc.splitTextToSize(col.label, col.w - cellPad * 2);
        doc.text(lines[0], cx + cellPad, y + 4);
        cx += col.w;
      });
      y += headerH;
    };

    drawTableHeader();

    // Expand multi-GPS rows
    const rows = [];
    filteredData.forEach(b => {
      const readings = b.gpsReadings || [];
      const base = {
        bitacora_id: b.bitacora_id || "—",
        folio_servicio: b.folio_servicio || "—",
        cliente: b.cliente || "—",
        _categoria: (b.categorias || []).join(", ") || "—",
        _evento: (b.eventoNombres || []).join(", ") || "—",
        linea_transporte: b.linea_transporte || "—",
        operador: b.operador || "—",
        origen: b.origen || "—",
        destino: b.destino || "—",
        status: b.status || "—",
      };
      if (readings.length === 0) {
        rows.push({...base, _gpsTime: "—", _gpsLoc: "—", _gpsCoords: "—", _gpsSpeed: "—"});
      } else {
        readings.forEach(r => {
          rows.push({...base, _gpsTime: r.ultimo_posicionamiento || "—", _gpsLoc: r.ubicacion || "—", _gpsCoords: r.coordenadas || "—", _gpsSpeed: r.velocidad || "—"});
        });
      }
    });

    const statusColor = (s) => {
      const n = (s || "").toLowerCase();
      if (n === "nueva") return [236, 253, 245];
      if (n.includes("proceso")) return [239, 246, 255];
      if (n === "cerrada") return [254, 242, 242];
      return [248, 250, 252];
    };

    rows.forEach((row, ri) => {
      checkPageBreak(rowH + 1);
      const rowFill = ri % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
      doc.setFillColor(...rowFill);
      doc.rect(margin, y, contentW, rowH, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(30, 41, 59);

      let cx = margin;
      columns.forEach(col => {
        const raw = String(row[col.key] ?? "—");
        // Status gets a tinted cell
        if (col.key === "status") {
          doc.setFillColor(...statusColor(raw));
          doc.rect(cx + 0.5, y + 0.5, col.w - 1, rowH - 1, "F");
        }
        const lines = doc.splitTextToSize(raw, col.w - cellPad * 2);
        doc.text(lines[0], cx + cellPad, y + rowH / 2 + 1.5);
        cx += col.w;
      });

      // Row separator
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.1);
      doc.line(margin, y + rowH, margin + contentW, y + rowH);
      y += rowH;
    });

    drawFooter();

    const currentDate = new Date().toISOString().split("T")[0];
    doc.save(`Bitacoras_Anomalias_${currentDate}.pdf`);
  };

  const controllersRef = useRef({});
  const isMountedRef = useRef(false);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const getAbortSignal = (key) => {
    if (controllersRef.current[key]) {
      controllersRef.current[key].abort();
    }
    controllersRef.current[key] = new AbortController();
    return controllersRef.current[key].signal;
  };

  // Dedicated effect to fetch available clients once roleData is ready
  useEffect(() => {
    // We now fetch clients and roleData bundled in fetchDashboardData initial load
    // to minimize re-renders and synchronized loading.
  }, []);

  const fetchDashboardData = useCallback(
    async () => {
      const signal = getAbortSignal('dashboard-data');
      const isInitialLoad = isInitialLoadRef.current;
      
      try {
        setIsDashboardLoading(true);

        if (isInitialLoad) {
          // Only reset essential data on initial load
          setBitacorasAnomalias([]);
          setOncEventsData([]);
        } else {
          setFilterLoading(true);
        }

        const filterQs = `clientFilter=${encodeURIComponent(appliedFilters.cliente)}&fechaDesde=${encodeURIComponent(appliedFilters.fechaDesde)}&fechaHasta=${encodeURIComponent(appliedFilters.fechaHasta)}&lineaTransporte=${encodeURIComponent(appliedFilters.lineaTransporte)}&operador=${encodeURIComponent(appliedFilters.operador)}`;
        
        const fetchJson = async (url) => {
          const res = await fetch(url, { 
            method: "GET", 
            credentials: "include",
            signal 
          });
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        };

        // Unified Fetch: Anomalies Table and ONC Events
        const tasks = [
          fetchJson(`${baseUrl}/dashboard/bitacoras-anomalias?${filterQs}`),
          fetchJson(`${baseUrl}/dashboard/onc-events?${filterQs}`),
        ];

        // Bundle role permissions and clients fetch on initial load to reduce renders
        if (isInitialLoad && user?.role) {
          tasks.push(fetchJson(`${baseUrl}/roles/${user.role}`));
          tasks.push(fetchJson(`${baseUrl}/clients`));
        }

        const results = await Promise.all(tasks);

        // Atomic State Updates
        if (isMountedRef.current) {
          if (isInitialLoad && user?.role) {
            const [tableData, oncData, rolePerms, clientsData] = results;
            setBitacorasAnomalias(tableData);
            setOncEventsData(oncData);
            setRoleData(rolePerms);
            // Apply role-based filtering to clients
            setAvailableClients(getAllowedClients(rolePerms, clientsData));
          } else {
            const [tableData, oncData] = results;
            setBitacorasAnomalias(tableData);
            setOncEventsData(oncData);
          }
        }

      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error("Error fetching dashboard data:", error);
        }
      } finally {
        if (isMountedRef.current) {
          setIsDashboardLoading(false);
          setFilterLoading(false);
          if (isInitialLoad) {
            setLoadingInitial(false);
            setLoading(false);
            isInitialLoadRef.current = false;
          }
        }
      }
    },
    [
      baseUrl,
      appliedFilters,
      user?.role
    ]
  );

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    
    fetchDashboardData();
  }, [user, navigate, fetchDashboardData, applyFiltersTrigger]);

  // Update transport lines when client filter changes
  useEffect(() => {
    if (user) {
      fetchLineasTransporte(filters.cliente);
    }
  }, [user, filters.cliente, fetchLineasTransporte]);

  // Update operators when transport line filter changes
  useEffect(() => {
    if (user) {
      fetchOperadores(filters.lineaTransporte);
    }
  }, [user, filters.lineaTransporte, fetchOperadores]);

  // Clean up effect
  useEffect(() => {
    return () => {
      // Abort all pending requests on unmount
      Object.values(controllersRef.current).forEach(controller => controller.abort());
    };
  }, []);

  // Memoize filtered data calculation
  // Apply dashboard filters first, then table filters to the backend data
  const filteredAnomaliasData = useMemo(() => {
    let filtered = bitacorasAnomalias;

    // First apply dashboard filters (these should already be applied by the backend, but we'll double-check)
    if (appliedFilters.cliente !== "all") {
      filtered = filtered.filter((item) => item.cliente === appliedFilters.cliente);
    }
    if (appliedFilters.lineaTransporte !== "all") {
      filtered = filtered.filter((item) => {
        const itemValue = item.linea_transporte || "";
        // Handle concatenated values (like "DHL/MAGDAMEX, DHL/BUZMYR")
        if (typeof itemValue === "string" && itemValue.includes(",")) {
          const values = itemValue.split(",").map((v) => v.trim());
          return values.includes(appliedFilters.lineaTransporte);
        }
        return itemValue === appliedFilters.lineaTransporte;
      });
    }
    if (appliedFilters.operador !== "all") {
      filtered = filtered.filter((item) => {
        const itemValue = item.operador || "";
        // Handle concatenated values (like "FRANCISCO JAVIER, ABEL GARCIA")
        if (typeof itemValue === "string" && itemValue.includes(",")) {
          const values = itemValue.split(",").map((v) => v.trim());
          return values.includes(appliedFilters.operador);
        }
        return itemValue === appliedFilters.operador;
      });
    }

    // Then apply table filters
    if (tableFilters.bitacoraId) {
      // Bitácora ID uses partial match (text input)
      filtered = filtered.filter((item) =>
        item.bitacora_id?.toLowerCase().includes(tableFilters.bitacoraId.toLowerCase())
      );
    }
    if (tableFilters.cliente) {
      // Dropdown filters use exact match
      filtered = filtered.filter((item) => item.cliente === tableFilters.cliente);
    }
    if (tableFilters.anomalias) {
      // Anomalies filter checks if the selected category exists in the item's categories
      filtered = filtered.filter((item) => item.categorias?.includes(tableFilters.anomalias));
    }
    if (tableFilters.lineaTransporte) {
      filtered = filtered.filter((item) => {
        const itemValue = item.linea_transporte || "";
        // Handle concatenated values (like "DHL/MAGDAMEX, DHL/BUZMYR")
        if (typeof itemValue === "string" && itemValue.includes(",")) {
          const values = itemValue.split(",").map((v) => v.trim());
          return values.includes(tableFilters.lineaTransporte);
        }
        return itemValue === tableFilters.lineaTransporte;
      });
    }
    if (tableFilters.operador) {
      filtered = filtered.filter((item) => {
        const itemValue = item.operador || "";
        // Handle concatenated values (like "FRANCISCO JAVIER, ABEL GARCIA")
        if (typeof itemValue === "string" && itemValue.includes(",")) {
          const values = itemValue.split(",").map((v) => v.trim());
          return values.includes(tableFilters.operador);
        }
        return itemValue === tableFilters.operador;
      });
    }
    if (tableFilters.origen) {
      filtered = filtered.filter((item) => item.origen === tableFilters.origen);
    }
    if (tableFilters.destino) {
      filtered = filtered.filter((item) => item.destino === tableFilters.destino);
    }
    if (tableFilters.estado) {
      filtered = filtered.filter((item) => item.status === tableFilters.estado);
    }

    return filtered;
  }, [
    bitacorasAnomalias,
    appliedFilters.cliente,
    appliedFilters.lineaTransporte,
    appliedFilters.operador,
    tableFilters,
  ]);

  const STATUS_MAP = {
    cerrada:    {label: "Cerrada",    bg: "#dc3545"},
    nueva:      {label: "Nueva",      bg: "#f59e0b"},
    iniciada:   {label: "Iniciada",   bg: "#3b82f6"},
    validada:   {label: "Validada",   bg: "#06b6d4"},
    finalizada: {label: "Finalizada", bg: "#6b7280"},
  };

  const getStatusStyle = (status) => STATUS_MAP[status?.toLowerCase()] || {label: status || "—", bg: "#6b7280"};

  const columns = [
    {
      key: "bitacora_id",
      header: "No. Bitácora",
      width: "110px",
      render: (row, {isExpanded}) => (
        <div style={{display: "inline-flex", alignItems: "center", gap: "6px"}}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: isExpanded ? "#3b82f6" : "#e2e8f0",
            color: isExpanded ? "#fff" : "#94a3b8",
            fontSize: "8px",
            transition: "all 0.2s",
            flexShrink: 0,
          }}>
            <i className={`fa fa-chevron-${isExpanded ? "up" : "down"}`}></i>
          </span>
          <span style={{
            background: "#f1f5f9",
            color: "#475569",
            padding: "2px 6px",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontWeight: 600,
            fontSize: "11px"
          }}>
            #{row.bitacora_id || "—"}
          </span>
        </div>
      )
    },
    {
      key: "folio_servicio",
      header: "Folio Servicio",
      render: (row) => (
        <span style={{color: "#64748b", fontSize: "12px", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}} title={row.folio_servicio || ""}>
          {row.folio_servicio || <span style={{opacity:0.3}}>—</span>}
        </span>
      )
    },
    {key: "cliente", header: "Cliente"},
    {
      key: "categorias",
      header: "Anomalías",
      render: (row) => (
        <div style={{display: "flex", gap: "4px", flexWrap: "wrap"}}>
          {row.categorias?.length > 0 ? (
            row.categorias.map((cat, i) => (
              <span key={i} style={{
                background: getAnomaliaColor(cat),
                color: "#fff",
                fontSize: "10px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "20px",
                letterSpacing: "0.03em",
              }}>{cat}</span>
            ))
          ) : <span style={{opacity: 0.3, fontSize: "12px"}}>—</span>}
        </div>
      )
    },
    {key: "linea_transporte", header: "Línea Transporte"},
    {key: "operador", header: "Operador"},
    {key: "origen", header: "Origen"},
    {key: "destino", header: "Destino"},
    {
      key: "status",
      header: "Estado",
      headerClassName: "text-center",
      className: "text-center",
      render: (row) => {
        const info = getStatusStyle(row.status);
        return (
          <span style={{
            background: info.bg,
            color: "#fff",
            fontSize: "10px",
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: "20px",
            whiteSpace: "nowrap",
            letterSpacing: "0.02em",
          }}>{info.label}</span>
        );
      }
    }
  ];

  const renderExpansion = (bitacora) => {
    const eventoText = bitacora.eventoNombres?.length > 0
      ? bitacora.eventoNombres.join(" | ")
      : null;

    return (
      <div className="dt-expansion-content">
        <div style={{display: "flex", flexWrap: "wrap", gap: "20px"}}>
          {eventoText && (
            <div style={{flex: "1 1 100%"}}>
              <div style={{fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", marginBottom: "4px", display: "flex", alignItems: "center", gap: "5px"}}>
                <i className="fa fa-bell" style={{color: "#f59e0b"}}></i> Evento
              </div>
              <div style={{fontWeight: 600, color: "#111827", fontSize: "13px"}}>{eventoText}</div>
            </div>
          )}
          {(() => {
            const readings = bitacora.gpsReadings || [];
            const fields = [
              { key: "ultimo_posicionamiento", label: "Último Pos.", icon: "fa-clock", color: "#3b82f6", mono: false },
              { key: "ubicacion", label: "Ubicación", icon: "fa-map-marker-alt", color: "#10b981", mono: false },
              { key: "coordenadas", label: "Coordenadas", icon: "fa-crosshairs", color: "#8b5cf6", mono: true },
              { key: "velocidad", label: "Velocidad", icon: "fa-tachometer-alt", color: "#ef4444", mono: false },
            ];

            if (readings.length === 0) {
              return fields.map(({ key, label, icon, color }) => (
                <div key={key} style={{flex: "1 1 140px", minWidth: 0}}>
                  <div style={{fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", marginBottom: "4px", display: "flex", alignItems: "center", gap: "5px"}}>
                    <i className={`fa ${icon}`} style={{color}}></i> {label}
                  </div>
                  <div style={{color: "#d1d5db", fontSize: "12px"}}>—</div>
                </div>
              ));
            }

            if (readings.length === 1) {
              const r = readings[0];
              return fields.map(({ key, label, icon, color, mono }) => (
                <div key={key} style={{flex: "1 1 140px", minWidth: 0}}>
                  <div style={{fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", marginBottom: "4px", display: "flex", alignItems: "center", gap: "5px"}}>
                    <i className={`fa ${icon}`} style={{color}}></i> {label}
                  </div>
                  <div style={{color: r[key] ? "#374151" : "#d1d5db", fontSize: "12px", fontFamily: mono ? "monospace" : "inherit"}}>
                    {r[key] || "—"}
                  </div>
                </div>
              ));
            }

            return (
              <div style={{flex: "1 1 100%", minWidth: 0}}>
                <div style={{fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", marginBottom: "8px", display: "flex", alignItems: "center", gap: "5px"}}>
                  <i className="fa fa-satellite-dish" style={{color: "#6366f1"}}></i> GPS por Unidad
                </div>
                <div style={{display: "flex", flexWrap: "wrap", gap: "8px"}}>
                  {readings.map((r, idx) => (
                    <div key={idx} style={{
                      background: "#f8fafc", border: "1px solid #e2e8f0",
                      borderRadius: "8px", padding: "8px 10px", minWidth: "200px", flex: "1 1 200px",
                    }}>
                      {r.unit && (
                        <div style={{
                          fontSize: "10px", fontWeight: 600, color: "#6366f1",
                          marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px",
                          borderBottom: "1px solid #e2e8f0", paddingBottom: "5px",
                        }}>
                          <i className="fa fa-satellite" style={{fontSize: "9px"}}></i>
                          {r.unit}
                        </div>
                      )}
                      <div style={{display: "flex", flexDirection: "column", gap: "4px"}}>
                        {fields.map(({ key, label, icon, color, mono }) => (
                          <div key={key} style={{display: "flex", alignItems: "baseline", gap: "5px"}}>
                            <i className={`fa ${icon}`} style={{color, fontSize: "9px", width: "10px", flexShrink: 0}}></i>
                            <span style={{fontSize: "10px", color: "#9ca3af", flexShrink: 0}}>{label}:</span>
                            <span style={{fontSize: "11px", color: r[key] ? "#374151" : "#d1d5db", fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-word"}}>
                              {r[key] || "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  // Helper function to calculate total anomalies based on applied filters
  // This function provides a unified way to calculate total anomalies across all sections
  // FIXED: Now calculates from bitacorasAnomalias array (single source of truth)
  const getTotalAnomalias = useCallback(() => {
    // Count every individual anomaly occurrence across all bitácoras
    const totalAnomalias = bitacorasAnomalias.reduce((sum, bitacora) => {
      // Each bitacora.categorias is an array of anomaly types
      // Count each occurrence (e.g., if a bitacora has [ENA, FM], count as 2)
      return sum + (bitacora.categorias?.length || 0);
    }, 0);

    return totalAnomalias;
  }, [bitacorasAnomalias]);

  // Helper function to calculate event categories stats from bitacorasAnomalias
  // FIXED: Calculate from table data for consistency
  const getEventCategoriesFromTable = useCallback(() => {
    const categoryCounts = {};
    const colorMap = {
      ENA: "#3b82f6", // Blue
      FM: "#10b981", // Green
      ONC: "#f59e0b", // Orange
      DR: "#ef4444", // Red
    };

    // Count each anomaly occurrence across all bitácoras
    bitacorasAnomalias.forEach((bitacora) => {
      if (bitacora.categorias && Array.isArray(bitacora.categorias)) {
        bitacora.categorias.forEach((categoria) => {
          categoryCounts[categoria] = (categoryCounts[categoria] || 0) + 1;
        });
      }
    });

    // Convert to array format
    return Object.entries(categoryCounts).map(([categoria, count]) => ({
      categoria,
      count,
      color: colorMap[categoria] || "#6b7280",
    }));
  }, [bitacorasAnomalias]);

  // Helper function to calculate transport lines stats from bitacorasAnomalias
  // FIXED: Calculate from table data for consistency
  const getLineasTransporteFromTable = useCallback(() => {
    const lineaCounts = {};
    const colors = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#ec4899",
      "#06b6d4",
      "#84cc16",
      "#f97316",
      "#14b8a6",
      "#a855f7",
      "#f43f5e",
      "#0ea5e9",
      "#22c55e",
      "#eab308",
    ];

    // Count anomalies per transport line
    bitacorasAnomalias.forEach((bitacora) => {
      const linea = bitacora.linea_transporte || "N/A";
      const anomaliasCount = bitacora.categorias?.length || 0;

      if (!lineaCounts[linea]) {
        lineaCounts[linea] = {
          lineaTransporte: linea,
          anomalias: 0,
          bitacoras: new Set(),
        };
      }

      lineaCounts[linea].anomalias += anomaliasCount;
      lineaCounts[linea].bitacoras.add(bitacora.bitacora_id);
    });

    // Convert to array format
    return Object.values(lineaCounts).map((stat, index) => ({
      lineaTransporte: stat.lineaTransporte,
      anomalias: stat.anomalias,
      bitacorasCount: stat.bitacoras.size,
      color: colors[index % colors.length],
      cliente: appliedFilters.cliente !== "all" ? appliedFilters.cliente : "all",
    }));
  }, [bitacorasAnomalias, appliedFilters.cliente]);

  // Aggregate summary stats from bitacorasAnomalias
  const summaryStats = useMemo(() => {
    let nuevas = 0;
    let enProceso = 0;
    let cerradas = 0;

    bitacorasAnomalias.forEach((b) => {
      const status = b.status?.toLowerCase();
      if (status === "nueva") nuevas++;
      else if (["validada", "iniciada", "iniciado"].includes(status)) enProceso++;
      else if (["cerrada", "finalizada", "finalizado"].includes(status)) cerradas++;
    });

    return {
      total: bitacorasAnomalias.length,
      nuevas,
      enProceso,
      cerradas,
      conAnomalias: bitacorasAnomalias.reduce((sum, b) => sum + (b.categorias?.length || 0), 0)
    };
  }, [bitacorasAnomalias]);

  // Helper function to calculate operators stats from bitacorasAnomalias
  // FIXED: Calculate from table data for consistency
  const getOperadoresFromTable = useCallback(() => {
    const operadorCounts = {};
    const colors = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#ec4899",
      "#06b6d4",
      "#84cc16",
      "#f97316",
      "#14b8a6",
      "#a855f7",
      "#f43f5e",
      "#0ea5e9",
      "#22c55e",
      "#eab308",
    ];

    // Count anomalies per operator
    bitacorasAnomalias.forEach((bitacora) => {
      // Handle multiple operators (comma-separated)
      const operadores = bitacora.operador
        ? bitacora.operador.split(",").map((op) => op.trim())
        : ["N/A"];

      operadores.forEach((operador) => {
        const anomaliasCount = bitacora.categorias?.length || 0;

        if (!operadorCounts[operador]) {
          operadorCounts[operador] = {
            operador: operador,
            anomalias: 0,
            bitacoras: new Set(),
          };
        }

        operadorCounts[operador].anomalias += anomaliasCount;
        operadorCounts[operador].bitacoras.add(bitacora.bitacora_id);
      });
    });

    // Convert to array format
    return Object.values(operadorCounts).map((stat, index) => ({
      operador: stat.operador,
      anomalias: stat.anomalias,
      bitacorasCount: stat.bitacoras.size,
      color: colors[index % colors.length],
      cliente: appliedFilters.cliente !== "all" ? appliedFilters.cliente : "all",
      lineaTransporte:
        appliedFilters.lineaTransporte !== "all" ? appliedFilters.lineaTransporte : "all",
    }));
  }, [bitacorasAnomalias, appliedFilters.cliente, appliedFilters.lineaTransporte]);

  // Custom tooltip for pie charts
  const CustomTooltip = ({active, payload, label}) => {
    if (active && payload && payload.length) {
      const totalAnomalias =
        payload[0].payload?.totalAnomalias ||
        summaryStats.conAnomalias ||
        0;
      return (
        <div
          style={{
            padding: "12px",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            border: "1px solid #ddd",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}>
          <div className="small text-muted">{label}</div>
          <div className="h6 text-primary">{formatNumber(payload[0].value)} anomalías</div>
          <div className="small text-muted">
            {totalAnomalias > 0 ? ((payload[0].value / totalAnomalias) * 100).toFixed(1) : 0}% del
            total
          </div>
        </div>
      );
    }
    return null;
  };

  // Render transport lines anomalies pie chart
  const renderLineasTransportePieChart = () => {
    // FIXED: Use table data instead of backend stats
    const lineasTransporteStats = getLineasTransporteFromTable();

    // Debug logging
    if (lineasTransporteStats.length > 0) {
      console.log("[DEBUG] Frontend transport lines stats:", {
        cliente: appliedFilters.cliente,
        lineaTransporte: appliedFilters.lineaTransporte,
        lineasTransporteStatsLength: lineasTransporteStats.length,
        lineasTransporteStats: lineasTransporteStats.slice(0, 3),
      });
    } else {
      console.log(
        "[DEBUG] Frontend: No transport lines stats received for client:",
        appliedFilters.cliente,
        "linea:",
        appliedFilters.lineaTransporte
      );
    }

    if (lineasTransporteStats.length === 0) {
      return (
        <div className="text-center text-muted py-5">
          <i className="fa fa-check-circle fa-3x mb-3" style={{opacity: 0.3}}></i>
          <h6>Sin Anomalías Detectadas</h6>
          <p className="small">
            {appliedFilters.lineaTransporte !== "all"
              ? `No se encontraron anomalías para la línea de transporte "${appliedFilters.lineaTransporte}"`
              : appliedFilters.cliente !== "all"
              ? "No se encontraron líneas de transporte con anomalías para el cliente seleccionado"
              : "No se encontraron líneas de transporte con anomalías en el sistema"}
          </p>
        </div>
      );
    }

    // Filter data based on applied filters
    let statsToUse = lineasTransporteStats;

    // If a specific client is selected, filter by client
    if (appliedFilters.cliente !== "all") {
      statsToUse = statsToUse.filter((stat) => stat.cliente === appliedFilters.cliente);
    }

    // If a specific transport line is selected, filter by transport line
    if (appliedFilters.lineaTransporte !== "all") {
      statsToUse = statsToUse.filter(
        (stat) => stat.lineaTransporte === appliedFilters.lineaTransporte
      );
    }

    // Sort by anomalias count (descending) and limit to top 15 for better visualization
    const sortedStats = statsToUse.sort((a, b) => b.anomalias - a.anomalias).slice(0, 15);

    // Group remaining transport lines into "Otros" category if there are more than 15
    let chartData = sortedStats.map((stat) => ({
      name: stat.lineaTransporte,
      value: stat.anomalias, // Usar anomalias totales en lugar de bitacoras únicas
      color: stat.color,
      lineaTransporte: stat.lineaTransporte,
      totalAnomalias: statsToUse.reduce((sum, s) => sum + s.anomalias, 0), // Usar anomalias totales
    }));

    // Add "Otros" category if there are more than 15 transport lines
    if (statsToUse.length > 15) {
      const othersAnomalias = statsToUse.slice(15).reduce((sum, stat) => sum + stat.anomalias, 0);

      if (othersAnomalias > 0) {
        chartData.push({
          name: `Otros (${statsToUse.length - 15} líneas)`,
          value: othersAnomalias,
          color: "#94a3b8", // Gray color for "Others"
          lineaTransporte: "otros",
          totalAnomalias: statsToUse.reduce((sum, s) => sum + s.anomalias, 0),
        });
      }
    }

    return (
      <div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              dataKey="value"
              onClick={handleLineaTransporteClick}
              style={{cursor: "pointer"}}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"2px 8px", marginTop:"8px"}}>
          {chartData.slice(0, 8).map((entry, index) => (
            <div key={index} style={{display:"flex", alignItems:"center", gap:"5px", overflow:"hidden"}}>
              <span style={{width:"7px", height:"7px", borderRadius:"50%", background:entry.color, flexShrink:0}}/>
              <span style={{fontSize:"10px", color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{entry.name}</span>
              <span style={{fontSize:"10px", color:"#94a3b8", marginLeft:"auto", flexShrink:0}}>{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render operators anomalies pie chart
  const renderOperadoresPieChart = () => {
    // FIXED: Use table data instead of backend stats
    const operadoresStats = getOperadoresFromTable();

    if (operadoresStats.length === 0) {
      return (
        <div className="text-center text-muted py-5">
          <i className="fa fa-check-circle fa-3x mb-3" style={{opacity: 0.3}}></i>
          <h6>Sin Anomalías Detectadas</h6>
          <p className="small">
            {appliedFilters.lineaTransporte !== "all"
              ? `No se encontraron operadores con anomalías para la línea de transporte "${appliedFilters.lineaTransporte}"`
              : appliedFilters.cliente !== "all"
              ? "No se encontraron operadores con anomalías para el cliente seleccionado"
              : "No se encontraron operadores con anomalías en el sistema"}
          </p>
        </div>
      );
    }

    // Filter data based on applied filters
    let filteredStats = operadoresStats;

    // If a specific client is selected, filter by client
    if (appliedFilters.cliente !== "all") {
      filteredStats = filteredStats.filter((stat) => stat.cliente === appliedFilters.cliente);
    }

    // If a specific transport line is selected, filter by transport line
    if (appliedFilters.lineaTransporte !== "all") {
      filteredStats = filteredStats.filter(
        (stat) => stat.lineaTransporte === appliedFilters.lineaTransporte
      );
    }

    if (filteredStats.length === 0) {
      return (
        <div className="text-center text-muted py-5">
          <i className="fa fa-check-circle fa-3x mb-3" style={{opacity: 0.3}}></i>
          <h6>Sin Anomalías Detectadas</h6>
          <p className="small">
            {appliedFilters.lineaTransporte !== "all"
              ? `No se encontraron operadores con anomalías para la línea de transporte "${appliedFilters.lineaTransporte}"`
              : appliedFilters.cliente !== "all"
              ? "No se encontraron operadores con anomalías para el cliente seleccionado"
              : "No se encontraron operadores con anomalías en el sistema"}
          </p>
        </div>
      );
    }

    // Transform data for Recharts format
    // If a specific operator is selected, show only that one
    const statsToUse =
      appliedFilters.operador !== "all"
        ? filteredStats.filter((stat) => stat.operador === appliedFilters.operador)
        : filteredStats;

    // Sort by anomalias count (descending) and limit to top 15 for better visualization
    const sortedStats = statsToUse.sort((a, b) => b.anomalias - a.anomalias).slice(0, 15);

    // Group remaining operators into "Otros" category if there are more than 15
    let chartData = sortedStats.map((stat) => ({
      name: stat.operador,
      value: stat.anomalias, // Usar anomalias totales en lugar de bitacoras únicas
      color: stat.color,
      operador: stat.operador,
      totalAnomalias: statsToUse.reduce((sum, s) => sum + s.anomalias, 0), // Usar anomalias totales
    }));

    // Add "Otros" category if there are more than 15 operators
    if (statsToUse.length > 15) {
      const othersAnomalias = statsToUse.slice(15).reduce((sum, stat) => sum + stat.anomalias, 0);

      if (othersAnomalias > 0) {
        chartData.push({
          name: `Otros (${statsToUse.length - 15} operadores)`,
          value: othersAnomalias,
          color: "#94a3b8", // Gray color for "Others"
          operador: "otros",
          totalAnomalias: statsToUse.reduce((sum, s) => sum + s.anomalias, 0),
        });
      }
    }

    return (
      <div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              dataKey="value"
              onClick={handleOperadorClick}
              style={{cursor: "pointer"}}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"2px 8px", marginTop:"8px"}}>
          {chartData.slice(0, 8).map((entry, index) => (
            <div key={index} style={{display:"flex", alignItems:"center", gap:"5px", overflow:"hidden"}}>
              <span style={{width:"7px", height:"7px", borderRadius:"50%", background:entry.color, flexShrink:0}}/>
              <span style={{fontSize:"10px", color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{entry.name}</span>
              <span style={{fontSize:"10px", color:"#94a3b8", marginLeft:"auto", flexShrink:0}}>{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render transport lines anomalies bar chart
  const renderLineasTransporteBarChart = () => {
    // FIXED: Use table data instead of backend stats
    const lineasTransporteStats = getLineasTransporteFromTable();

    if (lineasTransporteStats.length === 0) {
      return (
        <div className="text-center text-muted py-5">
          <i className="fa fa-check-circle fa-3x mb-3" style={{opacity: 0.3}}></i>
          <h6>Sin Anomalías Detectadas</h6>
          <p className="small">
            {appliedFilters.lineaTransporte !== "all"
              ? `No se encontraron anomalías para la línea de transporte "${appliedFilters.lineaTransporte}"`
              : appliedFilters.cliente !== "all"
              ? "No se encontraron líneas de transporte con anomalías para el cliente seleccionado"
              : "No se encontraron líneas de transporte con anomalías en el sistema"}
          </p>
        </div>
      );
    }

    // Filter data based on applied filters
    let statsToUse = lineasTransporteStats;

    // If a specific client is selected, filter by client
    if (appliedFilters.cliente !== "all") {
      statsToUse = statsToUse.filter((stat) => stat.cliente === appliedFilters.cliente);
    }

    // If a specific transport line is selected, filter by transport line
    if (appliedFilters.lineaTransporte !== "all") {
      statsToUse = statsToUse.filter(
        (stat) => stat.lineaTransporte === appliedFilters.lineaTransporte
      );
    }

    // Sort by anomalias count (descending) and limit to top 15 for better visualization
    const sortedStats = statsToUse.sort((a, b) => b.anomalias - a.anomalias).slice(0, 15);

    // Group remaining transport lines into "Otros" category if there are more than 15
    let chartData = sortedStats.map((stat) => ({
      name: stat.lineaTransporte,
      value: stat.anomalias,
      color: stat.color,
      lineaTransporte: stat.lineaTransporte,
      totalAnomalias: statsToUse.reduce((sum, s) => sum + s.anomalias, 0),
    }));

    // Add "Otros" category if there are more than 15 transport lines
    if (statsToUse.length > 15) {
      const othersAnomalias = statsToUse.slice(15).reduce((sum, stat) => sum + stat.anomalias, 0);

      if (othersAnomalias > 0) {
        chartData.push({
          name: `Otros (${statsToUse.length - 15} líneas)`,
          value: othersAnomalias,
          color: "#94a3b8", // Gray color for "Others"
          lineaTransporte: "otros",
          totalAnomalias: statsToUse.reduce((sum, s) => sum + s.anomalias, 0),
        });
      }
    }

    const maxAnomalias = Math.max(...chartData.map((item) => item.value));

    return (
      <div>
        <div className="custom-bar-chart" style={{maxHeight:"180px", overflowY:"auto"}}>
          {chartData.map((item, index) => {
            const percentage = maxAnomalias > 0 ? (item.value / maxAnomalias) * 100 : 0;
            return (
              <div key={index} onClick={() => handleLineaTransporteClick({lineaTransporte: item.lineaTransporte})}
                style={{cursor:"pointer", padding:"4px 0", marginBottom:"4px"}}
                onMouseEnter={(e) => e.currentTarget.style.opacity="0.8"}
                onMouseLeave={(e) => e.currentTarget.style.opacity="1"}
                title={`${item.name}: ${formatNumber(item.value)}`}>
                <div style={{display:"flex", justifyContent:"space-between", marginBottom:"2px"}}>
                  <span style={{fontSize:"10px", color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"75%"}}>{item.name}</span>
                  <span style={{fontSize:"10px", fontWeight:600, color:"#374151", flexShrink:0}}>{formatNumber(item.value)}</span>
                </div>
                <div style={{height:"6px", background:"#f1f5f9", borderRadius:"3px"}}>
                  <div style={{width:`${percentage}%`, height:"100%", background:item.color, borderRadius:"3px", minWidth:"4px"}}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary information */}
        <div className="mt-3 p-3 bg-light rounded" style={{fontSize: "12px"}}>
          <div className="row text-center">
            <div className="col-4">
              <div className="fw-bold text-primary">{chartData.length}</div>
              <div className="text-muted">Categorías</div>
            </div>
            <div className="col-4">
              <div className="fw-bold text-success">{getTotalAnomalias()}</div>
              <div className="text-muted">Total Anomalías</div>
            </div>
            <div className="col-4">
              <div className="fw-bold text-info">
                {statsToUse.length > 15 ? statsToUse.length - 15 : 0}
              </div>
              <div className="text-muted">En &quot;Otros&quot;</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render operators anomalies bar chart
  const renderOperadoresBarChart = () => {
    // FIXED: Use table data instead of backend stats
    const operadoresStats = getOperadoresFromTable();

    if (operadoresStats.length === 0) {
      return (
        <div className="text-center text-muted py-5">
          <i className="fa fa-check-circle fa-3x mb-3" style={{opacity: 0.3}}></i>
          <h6>Sin Anomalías Detectadas</h6>
          <p className="small">
            {appliedFilters.lineaTransporte !== "all"
              ? `No se encontraron operadores con anomalías para la línea de transporte "${appliedFilters.lineaTransporte}"`
              : appliedFilters.cliente !== "all"
              ? "No se encontraron operadores con anomalías para el cliente seleccionado"
              : "No se encontraron operadores con anomalías en el sistema"}
          </p>
        </div>
      );
    }

    // Filter data based on applied filters
    let filteredStats = operadoresStats;

    // If a specific client is selected, filter by client
    if (appliedFilters.cliente !== "all") {
      filteredStats = filteredStats.filter((stat) => stat.cliente === appliedFilters.cliente);
    }

    // If a specific transport line is selected, filter by transport line
    if (appliedFilters.lineaTransporte !== "all") {
      filteredStats = filteredStats.filter(
        (stat) => stat.lineaTransporte === appliedFilters.lineaTransporte
      );
    }

    if (filteredStats.length === 0) {
      return (
        <div className="text-center text-muted py-5">
          <i className="fa fa-check-circle fa-3x mb-3" style={{opacity: 0.3}}></i>
          <h6>Sin Anomalías Detectadas</h6>
          <p className="small">
            {appliedFilters.lineaTransporte !== "all"
              ? `No se encontraron operadores con anomalías para la línea de transporte "${appliedFilters.lineaTransporte}"`
              : appliedFilters.cliente !== "all"
              ? "No se encontraron operadores con anomalías para el cliente seleccionado"
              : "No se encontraron operadores con anomalías en el sistema"}
          </p>
        </div>
      );
    }

    // Transform data for Recharts format
    // If a specific operator is selected, show only that one
    const statsToUse =
      appliedFilters.operador !== "all"
        ? filteredStats.filter((stat) => stat.operador === appliedFilters.operador)
        : filteredStats;

    // Sort by anomalias count (descending) and limit to top 15 for better visualization
    const sortedStats = statsToUse.sort((a, b) => b.anomalias - a.anomalias).slice(0, 15);

    // Group remaining operators into "Otros" category if there are more than 15
    let chartData = sortedStats.map((stat) => ({
      name: stat.operador,
      value: stat.anomalias,
      color: stat.color,
      operador: stat.operador,
      totalAnomalias: statsToUse.reduce((sum, s) => sum + s.anomalias, 0),
    }));

    // Add "Otros" category if there are more than 15 operators
    if (statsToUse.length > 15) {
      const othersAnomalias = statsToUse.slice(15).reduce((sum, stat) => sum + stat.anomalias, 0);

      if (othersAnomalias > 0) {
        chartData.push({
          name: `Otros (${statsToUse.length - 15} operadores)`,
          value: othersAnomalias,
          color: "#94a3b8", // Gray color for "Others"
          operador: "otros",
          totalAnomalias: statsToUse.reduce((sum, s) => sum + s.anomalias, 0),
        });
      }
    }

    const maxAnomalias = Math.max(...chartData.map((item) => item.value));

    return (
      <div>
        <div
          className="custom-bar-chart"
          style={{maxHeight:"180px", overflowY:"auto"}}>
          {chartData.map((item, index) => {
            const percentage = maxAnomalias > 0 ? (item.value / maxAnomalias) * 100 : 0;
            return (
              <div key={index} onClick={() => handleOperadorClick({operador: item.operador})}
                style={{cursor:"pointer", padding:"4px 0", marginBottom:"4px"}}
                onMouseEnter={(e) => e.currentTarget.style.opacity="0.8"}
                onMouseLeave={(e) => e.currentTarget.style.opacity="1"}
                title={`${item.name}: ${formatNumber(item.value)}`}>
                <div style={{display:"flex", justifyContent:"space-between", marginBottom:"2px"}}>
                  <span style={{fontSize:"10px", color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"75%"}}>{item.name}</span>
                  <span style={{fontSize:"10px", fontWeight:600, color:"#374151", flexShrink:0}}>{formatNumber(item.value)}</span>
                </div>
                <div style={{height:"6px", background:"#f1f5f9", borderRadius:"3px"}}>
                  <div style={{width:`${percentage}%`, height:"100%", background:item.color, borderRadius:"3px", minWidth:"4px"}}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary information */}
        <div className="mt-3 p-3 bg-light rounded" style={{fontSize: "12px"}}>
          <div className="row text-center">
            <div className="col-4">
              <div className="fw-bold text-primary">{chartData.length}</div>
              <div className="text-muted">Categorías</div>
            </div>
            <div className="col-4">
              <div className="fw-bold text-success">{getTotalAnomalias()}</div>
              <div className="text-muted">Total Anomalías</div>
            </div>
            <div className="col-4">
              <div className="fw-bold text-info">
                {statsToUse.length > 15 ? statsToUse.length - 15 : 0}
              </div>
              <div className="text-muted">En &quot;Otros&quot;</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render event categories bar chart
  const renderEventCategoriesBarChart = () => {
    // FIXED: Use table data instead of backend stats
    const eventCategoriesStatsData = getEventCategoriesFromTable();

    if (eventCategoriesStatsData.length === 0) {
      return (
        <div className="text-center text-muted py-5">
          <i className="fa fa-check-circle fa-3x mb-3" style={{opacity: 0.3}}></i>
          <h6>Sin Anomalías Detectadas</h6>
          <p className="small">No se encontraron anomalías en las categorías especificadas</p>
        </div>
      );
    }

    // Sort by count (descending)
    const chartData = eventCategoriesStatsData.sort((a, b) => b.count - a.count);
    const maxCount = Math.max(...chartData.map((item) => item.count));

    return (
      <div>
        <div className="custom-bar-chart" style={{maxHeight:"180px", overflowY:"auto"}}>
          {chartData.map((item, index) => {
            const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
            const categoryName =
              item.categoria === "ENA" ? "Estadia no autorizada"
              : item.categoria === "FM" ? "Falla mecánica"
              : item.categoria === "ONC" ? "Usuario no responde"
              : item.categoria === "DR" ? "Desvío de ruta"
              : item.categoria;
            return (
              <div key={index} style={{padding:"4px 0", marginBottom:"4px"}}>
                <div style={{display:"flex", justifyContent:"space-between", marginBottom:"2px"}}>
                  <span style={{fontSize:"10px", color:"#374151"}}>{categoryName}</span>
                  <span style={{fontSize:"10px", fontWeight:600, color:"#374151"}}>{formatNumber(item.count)}</span>
                </div>
                <div style={{height:"6px", background:"#f1f5f9", borderRadius:"3px"}}>
                  <div style={{width:`${percentage}%`, height:"100%", background:item.color, borderRadius:"3px", minWidth:"4px"}}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary information */}
        <div className="mt-3 p-3 bg-light rounded" style={{fontSize: "12px"}}>
          <div className="row text-center">
            <div className="col-4">
              <div className="fw-bold text-primary">{chartData.length}</div>
              <div className="text-muted">Categorías</div>
            </div>
            <div className="col-4">
              <div className="fw-bold text-success">
                {chartData.reduce((sum, item) => sum + item.count, 0)}
              </div>
              <div className="text-muted">Total Anomalías</div>
            </div>
            <div className="col-4">
              <div className="fw-bold text-info">
                <i className="fa fa-chart-pie me-1"></i>
                Tipos
              </div>
              <div className="text-muted">Anomalías</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render event categories pie chart
  const renderEventCategoriesPieChart = () => {
    // FIXED: Use table data instead of backend stats
    const eventCategoriesStatsData = getEventCategoriesFromTable();

    if (eventCategoriesStatsData.length === 0) {
      return (
        <div className="text-center text-muted py-5">
          <i className="fa fa-check-circle fa-3x mb-3" style={{opacity: 0.3}}></i>
          <h6>Sin Eventos Registrados</h6>
          <p className="small">No hay eventos registrados en las categorías especificadas</p>
        </div>
      );
    }

    const chartData = eventCategoriesStatsData.map((category) => ({
      name:
        category.categoria === "ENA"
          ? "Estadia no autorizada"
          : category.categoria === "FM"
          ? "Falla mecánica"
          : category.categoria === "ONC"
          ? "Usuario no responde"
          : category.categoria === "DR"
          ? "Desvío de ruta"
          : category.categoria,
      value: category.count,
      color: category.color,
    }));

    return (
      <div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              dataKey="value">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"2px 8px", marginTop:"8px"}}>
          {chartData.slice(0, 8).map((entry, index) => (
            <div key={index} style={{display:"flex", alignItems:"center", gap:"5px", overflow:"hidden"}}>
              <span style={{width:"7px", height:"7px", borderRadius:"50%", background:entry.color, flexShrink:0}}/>
              <span style={{fontSize:"10px", color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{entry.name}</span>
              <span style={{fontSize:"10px", color:"#94a3b8", marginLeft:"auto", flexShrink:0}}>{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render ONC events bar chart
  const renderOncBarChart = () => {
    if (oncEventsData.length === 0) {
      return (
        <div className="text-center text-muted py-4" style={{fontSize:"12px"}}>
          <i className="fa fa-user fa-2x mb-2" style={{opacity:0.3, display:"block"}}></i>
          Sin Eventos ONC
        </div>
      );
    }

    const chartData = oncEventsData.map((event) => ({
      name: event.initials,
      eventos: event.count,
      color: event.color,
      fullName: event.eventName,
    }));

    return (
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{top:4, right:4, left:-20, bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
          <XAxis dataKey="name" tick={{fontSize:10, fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fontSize:10, fill:"#94a3b8"}} axisLine={false} tickLine={false}/>
          <Tooltip
            contentStyle={{fontSize:"11px", border:"1px solid #e2e8f0", borderRadius:"6px", boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}
            formatter={(value, name, props) => {
              const data = chartData.find((item) => item.name === props.payload.name);
              return [`${formatNumber(value)} eventos`, data ? data.fullName : "Evento"];
            }}
          />
          <Bar dataKey="eventos" radius={[3,3,0,0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  // Render autocomplete component
  const renderAutocomplete = (field, placeholder = "Filtrar...") => {
    const state = autocompleteStates[field];
    const filteredOptions = getFilteredOptions(field, state.searchTerm);
    const displayValue = state.isOpen ? state.searchTerm : tableFilters[field];

    return (
      <div className="position-relative">
        <div className="input-group input-group-sm">
          <input
            type="text"
            className="form-control"
            placeholder={placeholder}
            value={displayValue}
            onChange={(e) => handleAutocompleteInput(field, e.target.value)}
            onFocus={() =>
              setAutocompleteStates((prev) => ({
                ...prev,
                [field]: {...prev[field], isOpen: true},
              }))
            }
            style={{fontSize: "11px", minWidth: "80px"}}
          />
          <button
            className="btn btn-outline-secondary"
            type="button"
            onClick={() => toggleAutocomplete(field)}
            style={{fontSize: "10px", padding: "2px 6px"}}>
            <i className={`fa fa-chevron-${state.isOpen ? "up" : "down"}`}></i>
          </button>
        </div>

        {state.isOpen && (
          <div
            className="position-absolute w-100 bg-white border rounded shadow-sm"
            style={{
              zIndex: 1000,
              maxHeight: "200px",
              overflowY: "auto",
              top: "100%",
              left: 0,
              right: 0,
            }}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option}
                  className="px-2 py-1 cursor-pointer hover-bg-light"
                  style={{
                    fontSize: "11px",
                    cursor: "pointer",
                    borderBottom: "1px solid #eee",
                  }}
                  onMouseEnter={(e) => (e.target.style.backgroundColor = "#f8f9fa")}
                  onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
                  onClick={() => handleAutocompleteSelect(field, option)}>
                  {option}
                </div>
              ))
            ) : (
              <div className="px-2 py-1 text-muted" style={{fontSize: "11px"}}>
                No se encontraron opciones
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render filterable table header
  const renderFilterableHeader = (
    title,
    field,
    placeholder = "Filtrar...",
    isAutocomplete = false
  ) => {
    return (
      <th className="position-relative">
        <div className="d-flex flex-column">
          <div className="fw-semibold mb-1">{title}</div>
          {isAutocomplete ? (
            renderAutocomplete(field, placeholder)
          ) : (
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder={placeholder}
              value={tableFilters[field]}
              onChange={(e) => handleTableFilterChange(field, e.target.value)}
              style={{fontSize: "11px", minWidth: "80px"}}
            />
          )}
        </div>
      </th>
    );
  };

  // Render anomalies table
  const renderAnomaliasTable = () => {
    if (bitacorasAnomalias.length === 0) {
      return (
        <div className="text-center py-5" style={{color: "rgba(255,255,255,0.5)"}}>
          <i className="fa fa-check-circle fa-3x mb-3 d-block" style={{opacity: 0.3}}></i>
          <div className="fw-semibold mb-1">Sin Anomalías Registradas</div>
          <div className="small">No hay anomalías en el período seleccionado</div>
        </div>
      );
    }

    return (
      <div className="bits-table-shell mt-2">
        <DataTable
          data={filteredAnomaliasData}
          columns={columns}
          loading={isDashboardLoading}
          renderExpansion={renderExpansion}
          expandedRows={Array.from(expandedRows)}
          onExpandedRowsChange={(newRows) => setExpandedRows(new Set(newRows))}
          emptyMessage="No se encontraron anomalías con los filtros aplicados."
          rowKey={(row) => row._id || row.bitacora_id}
          maxHeight="100%"
        />
      </div>
    );
  };

  // Skeleton components removed since we now use the standardized Skeleton component at the top

  if (loadingInitial) {
    return (
      <section id="dashboard">
        <div className="w-100 d-flex h-100 mt-0">
          <div className="sidebar-wrapper">
            <Sidebar />
          </div>
          <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
            <div
              className="d-flex justify-content-center align-items-center"
              style={{height: "100vh"}}>
              <div className="text-center">
                <i className="fa fa-spinner fa-spin fa-2x text-primary mb-3"></i>
                <p className="text-muted">Cargando dashboard...</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="dashboard">
      <div className="w-100 d-flex h-100 mt-0">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Dashboard de Anomalías"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={resetFilters}
            filters={
              <FilterBar onClear={resetFilters}>
                <div>
                  <DatePicker
                    label="Desde"
                    value={filters.fechaDesde}
                    onChange={(v) => {
                      const next = { ...filters, fechaDesde: v || "" };
                      setFilters(next);
                      setAppliedFilters(next);
                      setApplyFiltersTrigger(p => p + 1);
                    }}
                  />
                </div>
                <div>
                  <DatePicker
                    label="Hasta"
                    value={filters.fechaHasta}
                    onChange={(v) => {
                      const next = { ...filters, fechaHasta: v || "" };
                      setFilters(next);
                      setAppliedFilters(next);
                      setApplyFiltersTrigger(p => p + 1);
                    }}
                  />
                </div>
                <div>
                  <Select
                    label="Cliente"
                    placeholder="Todos"
                    value={filters.cliente === "all" ? null : filters.cliente}
                    onChange={(v) => {
                      const next = { 
                        ...filters, 
                        cliente: v || "all",
                        lineaTransporte: "all",
                        operador: "all"
                      };
                      setFilters(next);
                      setAppliedFilters(next);
                      setApplyFiltersTrigger(p => p + 1);
                    }}
                    options={(availableClients || [])
                      .filter((c) => c?.razon_social)
                      .sort((a, b) => a.razon_social.localeCompare(b.razon_social))
                      .map((c) => ({ value: c.razon_social, label: c.razon_social }))}
                  />
                </div>
                <div>
                  <Select
                    label="Línea Transporte"
                    placeholder={
                      filters.cliente === "all"
                        ? "Selecciona un cliente"
                        : loadingLineasTransporte
                          ? "Cargando..."
                          : "Todas"
                    }
                    value={filters.lineaTransporte === "all" ? null : filters.lineaTransporte}
                    disabled={loadingLineasTransporte || filters.cliente === "all"}
                    onChange={(v) => {
                      const next = { 
                        ...filters, 
                        lineaTransporte: v || "all",
                        operador: "all"
                      };
                      setFilters(next);
                      setAppliedFilters(next);
                      setApplyFiltersTrigger(p => p + 1);
                    }}
                    options={(availableLineasTransporte || [])
                      .filter((l) => l?.nombre)
                      .sort((a, b) => a.nombre.localeCompare(b.nombre))
                      .map((l) => ({ value: l.nombre, label: l.nombre }))}
                  />
                </div>
                <div>
                  <Select
                    label="Operador"
                    placeholder={
                      filters.lineaTransporte === "all"
                        ? "Selecciona una línea"
                        : loadingOperadores
                          ? "Cargando..."
                          : "Todos"
                    }
                    value={filters.operador === "all" ? null : filters.operador}
                    disabled={loadingOperadores || filters.lineaTransporte === "all"}
                    onChange={(v) => {
                      const next = { ...filters, operador: v || "all" };
                      setFilters(next);
                      setAppliedFilters(next);
                      setApplyFiltersTrigger(p => p + 1);
                    }}
                    options={(availableOperadores || [])
                      .filter((o) => o?.nombre)
                      .sort((a, b) => a.nombre.localeCompare(b.nombre))
                      .map((o) => ({ value: o.nombre, label: o.nombre }))}
                  />
                </div>
              </FilterBar>
            }
            filterActions={<>
              <button
                className="header-action-btn header-action-btn--green"
                title="Descargar reporte Excel"
                onClick={() => downloadBitacorasAnomaliasExcel(filteredAnomaliasData)}
                disabled={isDashboardLoading || filteredAnomaliasData.length === 0}>
                <i className="fas fa-file-excel"></i>
                <span>Excel</span>
              </button>
              <button
                className="header-action-btn header-action-btn--red"
                title="Descargar reporte PDF"
                onClick={() => downloadBitacorasAnomaliasPDF(filteredAnomaliasData)}
                disabled={isDashboardLoading || filteredAnomaliasData.length === 0}>
                <i className="fas fa-file-pdf"></i>
                <span>PDF</span>
              </button>
            </>}
          />

          <div className="container-fluid px-3 px-md-4 mt-4">

            {/* Estadísticas principales con totales y porcentajes integrados */}
            <div className="row mb-3 mb-md-4 g-2 g-md-3">
              {/* Total Bitácoras */}
              <div className="col-6 col-md-4 col-lg-2 mb-2 mb-lg-0">
                <div className={`stat-card h-100 ${!isDashboardLoading ? "fade-in" : ""}`}>
                  <div className="stat-icon total">
                    <i className="fa fa-book"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {isDashboardLoading ? (
                        <Skeleton width="60px" height="24px" />
                      ) : (
                        formatNumber(summaryStats.total || 0)
                      )}
                    </div>
                    <div className="stat-label">Total</div>
                  </div>
                  <div className="stat-percentage" style={{color: "#64748b"}}>
                    100%
                  </div>
                </div>
              </div>

              {/* Nuevas */}
              <div className="col-6 col-md-4 col-lg-2 mb-2 mb-lg-0">
                <div className={`stat-card h-100 ${!isDashboardLoading ? "fade-in" : ""}`}>
                  <div className="stat-icon new">
                    <i className="fa fa-plus-circle"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {isDashboardLoading ? (
                        <Skeleton width="60px" height="24px" />
                      ) : (
                        formatNumber(summaryStats.nuevas || 0)
                      )}
                    </div>
                    <div className="stat-label">Nuevas</div>
                  </div>
                  <div className="stat-percentage" style={{color: "#10b981"}}>
                    {isDashboardLoading ? (
                      <Skeleton width="30px" height="14px" />
                    ) : (
                      <>
                        {summaryStats.total > 0 && summaryStats.nuevas !== undefined
                          ? Math.round((summaryStats.nuevas / summaryStats.total) * 100)
                          : 0}%
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* En Proceso */}
              <div className="col-6 col-md-4 col-lg-2 mb-2 mb-lg-0">
                <div className={`stat-card h-100 ${!isDashboardLoading ? "fade-in" : ""}`}>
                  <div className="stat-icon pending">
                    <i className="fa fa-clock"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {isDashboardLoading ? (
                        <Skeleton width="60px" height="24px" />
                      ) : (
                        formatNumber(summaryStats.enProceso || 0)
                      )}
                    </div>
                    <div className="stat-label">En proceso</div>
                  </div>
                  <div className="stat-percentage" style={{color: "#3b82f6"}}>
                    {isDashboardLoading ? (
                      <Skeleton width="30px" height="14px" />
                    ) : (
                      <>
                        {summaryStats.total > 0 && summaryStats.enProceso !== undefined
                          ? Math.round((summaryStats.enProceso / summaryStats.total) * 100)
                          : 0}%
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Cerradas */}
              <div className="col-6 col-md-4 col-lg-2 mb-2 mb-lg-0">
                <div className={`stat-card h-100 ${!isDashboardLoading ? "fade-in" : ""}`}>
                  <div className="stat-icon closed">
                    <i className="fa fa-lock"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {isDashboardLoading ? (
                        <Skeleton width="60px" height="24px" />
                      ) : (
                        formatNumber(summaryStats.cerradas || 0)
                      )}
                    </div>
                    <div className="stat-label">Cerradas</div>
                  </div>
                  <div className="stat-percentage" style={{color: "#ef4444"}}>
                    {isDashboardLoading ? (
                      <Skeleton width="30px" height="14px" />
                    ) : (
                      <>
                        {summaryStats.total > 0 && summaryStats.cerradas !== undefined
                          ? Math.round((summaryStats.cerradas / summaryStats.total) * 100)
                          : 0}%
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Bitácoras con Anomalías */}
              <div className="col-6 col-md-4 col-lg-2 mb-2 mb-lg-0">
                <div className={`stat-card h-100 ${!isDashboardLoading ? "fade-in" : ""}`}>
                  <div className="stat-icon anomalia">
                    <i className="fa fa-exclamation-triangle"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {isDashboardLoading ? (
                        <Skeleton width="60px" height="24px" />
                      ) : (
                        formatNumber(summaryStats.total)
                      )}
                    </div>
                    <div className="stat-label">Con Anomalías</div>
                  </div>
                  <div className="stat-percentage" style={{color: "#f59e0b"}}>
                    100%
                  </div>
                </div>
              </div>

              {/* Total Anomalías */}
              <div className="col-6 col-md-4 col-lg-2 mb-2 mb-lg-0">
                <div className={`stat-card h-100 ${!isDashboardLoading ? "fade-in" : ""}`}>
                  <div className="stat-icon anomalia-total">
                    <i className="fa fa-bug"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {isDashboardLoading ? (
                        <Skeleton width="60px" height="24px" />
                      ) : (
                        formatNumber(summaryStats.conAnomalias)
                      )}
                    </div>
                    <div className="stat-label">Total Anomalías</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Anomalies Table — row 2, directly below stat cards */}
            <div className="row mb-3 mb-md-4">
              <div className="col-12">
                <div className="chart-card">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="mb-0">Bitácoras con anomalías</h6>
                      {hasActiveFilters && (
                        <span className="badge bg-info" style={{fontSize: "10px"}}>
                          <i className="fa fa-filter me-1"></i>
                          Panel Superior
                        </span>
                      )}
                      {hasActiveTableFilters && (
                        <span className="badge bg-primary" style={{fontSize: "10px"}}>
                          <i className="fa fa-filter me-1"></i>
                          Panel Tabla
                        </span>
                      )}
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className={`header-action-btn${isTableFiltersOpen ? ' is-active' : ''}${hasActiveTableFilters ? ' has-filters' : ''}`}
                        onClick={() => setIsTableFiltersOpen(!isTableFiltersOpen)}
                        title={isTableFiltersOpen ? "Ocultar filtros de tabla" : "Mostrar filtros de tabla"}
                      >
                        <i className="fa fa-sliders"></i>
                        <span>Filtros</span>
                        {hasActiveTableFilters && (
                          <i
                            className="fa fa-times filter-clear-btn"
                            onClick={(e) => { e.stopPropagation(); clearTableFilters(); }}
                            title="Limpiar filtros de tabla"
                          />
                        )}
                      </button>
                      
                      <button
                        onClick={() => downloadBitacorasAnomaliasExcel(filteredAnomaliasData)}
                        disabled={filteredAnomaliasData.length === 0}
                        title="Exportar Excel"
                        style={{
                          background: filteredAnomaliasData.length === 0 ? "#d1fae5" : "#10b981",
                          border: "none", borderRadius: "8px", color: "#fff",
                          width: "34px", height: "34px",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: "14px",
                          cursor: filteredAnomaliasData.length === 0 ? "default" : "pointer",
                          transition: "background 0.15s",
                          opacity: filteredAnomaliasData.length === 0 ? 0.5 : 1,
                        }}>
                        <i className="fa fa-file-excel"></i>
                      </button>
                      <button
                        onClick={() => downloadBitacorasAnomaliasPDF(filteredAnomaliasData)}
                        disabled={filteredAnomaliasData.length === 0}
                        title="Exportar PDF"
                        style={{
                          background: filteredAnomaliasData.length === 0 ? "#fecaca" : "#ef4444",
                          border: "none", borderRadius: "8px", color: "#fff",
                          width: "34px", height: "34px",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: "14px",
                          cursor: filteredAnomaliasData.length === 0 ? "default" : "pointer",
                          transition: "background 0.15s",
                          opacity: filteredAnomaliasData.length === 0 ? 0.5 : 1,
                        }}>
                        <i className="fa fa-file-pdf"></i>
                      </button>
                    </div>
                  </div>
                  <div className="chart-body" style={{ minHeight: "360px" }}>
                    {/* Table Filters Panel */}
                    <div className={`bits-header-filters ${isTableFiltersOpen ? 'is-open' : ''}`} style={{ margin: '0 -15px 15px -15px', borderRadius: 0, borderLeft: 'none', borderRight: 'none' }}>
                      <div className="bits-header-filters__content">
                        <div className="bits-filters-panel">
                          <div className="bits-filters-grid">
                            <div>
                              <span className="pselect__label">No. Bitácora</span>
                              <div className="pdt-field">
                                <i className="fa fa-hashtag pdt-field__icon"></i>
                                <input
                                  type="text"
                                  className="pdt-field__input"
                                  placeholder="Ej: 005024"
                                  value={tableFilters.bitacoraId}
                                  onChange={(e) => handleTableFilterChange("bitacoraId", e.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <Select
                                label="Cliente"
                                placeholder="Filtrar..."
                                value={tableFilters.cliente || null}
                                onChange={(val) => handleTableFilterChange("cliente", val || "")}
                                options={getUniqueValues("cliente").map(v => ({ value: v, label: v }))}
                                searchable={true}
                                clearable={true}
                              />
                            </div>
                            <div>
                              <Select
                                label="Anomalías"
                                placeholder="Filtrar..."
                                value={tableFilters.anomalias || null}
                                onChange={(val) => handleTableFilterChange("anomalias", val || "")}
                                options={getUniqueAnomalias().map(v => ({ value: v, label: v }))}
                                searchable={true}
                                clearable={true}
                              />
                            </div>
                            <div>
                              <Select
                                label="Línea Transporte"
                                placeholder="Filtrar..."
                                value={tableFilters.lineaTransporte || null}
                                onChange={(val) => handleTableFilterChange("lineaTransporte", val || "")}
                                options={getUniqueValues("lineaTransporte").map(v => ({ value: v, label: v }))}
                                searchable={true}
                                clearable={true}
                              />
                            </div>
                            <div>
                              <Select
                                label="Operador"
                                placeholder="Filtrar..."
                                value={tableFilters.operador || null}
                                onChange={(val) => handleTableFilterChange("operador", val || "")}
                                options={getUniqueValues("operador").map(v => ({ value: v, label: v }))}
                                searchable={true}
                                clearable={true}
                              />
                            </div>
                            <div>
                              <Select
                                label="Origen"
                                placeholder="Filtrar..."
                                value={tableFilters.origen || null}
                                onChange={(val) => handleTableFilterChange("origen", val || "")}
                                options={getUniqueValues("origen").map(v => ({ value: v, label: v }))}
                                searchable={true}
                                clearable={true}
                              />
                            </div>
                            <div>
                              <Select
                                label="Destino"
                                placeholder="Filtrar..."
                                value={tableFilters.destino || null}
                                onChange={(val) => handleTableFilterChange("destino", val || "")}
                                options={getUniqueValues("destino").map(v => ({ value: v, label: v }))}
                                searchable={true}
                                clearable={true}
                              />
                            </div>
                            <div>
                              <Select
                                label="Estado"
                                placeholder="Filtrar..."
                                value={tableFilters.estado || null}
                                onChange={(val) => handleTableFilterChange("estado", val || "")}
                                options={getUniqueValues("status").map(v => ({ value: v, label: v }))}
                                searchable={true}
                                clearable={true}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isDashboardLoading ? (
                      <div style={{display:"flex", flexDirection:"column", gap:"8px", padding:"8px 0"}}>
                        {[...Array(8)].map((_, i) => <Skeleton key={i} height="36px" />)}
                      </div>
                    ) : (
                      <div className="overflow-auto fade-in">{renderAnomaliasTable()}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row 1: Líneas, Operadores, Tipos */}
            <div className="row mb-3 g-2">
              {/* Líneas de Transporte */}
              <div className="col-12 col-sm-6 col-lg-4">
                <div className="chart-card h-100 d-flex flex-column">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <span style={{fontSize:"12px", fontWeight:600, color:"#1e293b"}}>Líneas de Transporte</span>
                    <div className="d-flex align-items-center gap-2">
                      {(appliedFilters.cliente !== "all" || appliedFilters.lineaTransporte !== "all") && (
                        <span className="badge bg-info" style={{fontSize:"9px"}}>Filtrado</span>
                      )}
                      <div className="btn-group btn-group-sm" role="group">
                        <button type="button" className={`btn btn-xs ${lineasViewMode === "pie" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setLineasViewMode("pie")} title="Donut"><i className="fa fa-pie-chart"></i></button>
                        <button type="button" className={`btn btn-xs ${lineasViewMode === "bar" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setLineasViewMode("bar")} title="Barras"><i className="fa fa-bar-chart"></i></button>
                      </div>
                    </div>
                  </div>
                  <div className="chart-body" style={{ minHeight: "300px" }}>
                    {isDashboardLoading ? (
                      <Skeleton height="260px" />
                    ) : (
                      <div className="overflow-auto fade-in">
                        {lineasViewMode === "pie" ? renderLineasTransportePieChart() : renderLineasTransporteBarChart()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Operadores */}
              <div className="col-12 col-sm-6 col-lg-4">
                <div className="chart-card h-100 d-flex flex-column">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <span style={{fontSize:"12px", fontWeight:600, color:"#1e293b"}}>Operadores</span>
                    <div className="d-flex align-items-center gap-2">
                      {(appliedFilters.cliente !== "all" || appliedFilters.lineaTransporte !== "all" || appliedFilters.operador !== "all") && (
                        <span className="badge bg-info" style={{fontSize:"9px"}}>Filtrado</span>
                      )}
                      <div className="btn-group btn-group-sm" role="group">
                        <button type="button" className={`btn btn-xs ${operadoresViewMode === "pie" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setOperadoresViewMode("pie")} title="Donut"><i className="fa fa-pie-chart"></i></button>
                        <button type="button" className={`btn btn-xs ${operadoresViewMode === "bar" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setOperadoresViewMode("bar")} title="Barras"><i className="fa fa-bar-chart"></i></button>
                      </div>
                    </div>
                  </div>
                  <div className="chart-body" style={{ minHeight: "300px" }}>
                    {isDashboardLoading ? (
                      <Skeleton height="260px" />
                    ) : (
                      <div className="overflow-auto fade-in">
                        {operadoresViewMode === "pie" ? renderOperadoresPieChart() : renderOperadoresBarChart()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tipos de Anomalías */}
              <div className="col-12 col-sm-6 col-lg-4">
                <div className="chart-card h-100 d-flex flex-column">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <span style={{fontSize:"12px", fontWeight:600, color:"#1e293b"}}>Tipos de Anomalías</span>
                    <div className="d-flex align-items-center gap-2">
                      {(appliedFilters.cliente !== "all" || appliedFilters.lineaTransporte !== "all") && (
                        <span className="badge bg-info" style={{fontSize:"9px"}}>Filtrado</span>
                      )}
                      <div className="btn-group btn-group-sm" role="group">
                        <button type="button" className={`btn btn-xs ${tiposViewMode === "pie" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setTiposViewMode("pie")} title="Donut"><i className="fa fa-pie-chart"></i></button>
                        <button type="button" className={`btn btn-xs ${tiposViewMode === "bar" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setTiposViewMode("bar")} title="Barras"><i className="fa fa-bar-chart"></i></button>
                      </div>
                    </div>
                  </div>
                  <div className="chart-body" style={{ minHeight: "300px" }}>
                    {isDashboardLoading ? (
                      <Skeleton height="260px" />
                    ) : (
                      <div className="overflow-auto fade-in">
                        {tiposViewMode === "pie" ? renderEventCategoriesPieChart() : renderEventCategoriesBarChart()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row 2: ONC + Event Categories Bar */}
            <div className="row mb-3 g-2">
              {/* ONC Events */}
              <div className="col-12 col-lg-6">
                <div className="chart-card h-100 d-flex flex-column">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <span style={{fontSize:"12px", fontWeight:600, color:"#1e293b"}}>Usuario No Responde (ONC)</span>
                    {(appliedFilters.cliente !== "all" || appliedFilters.lineaTransporte !== "all") && (
                      <span className="badge bg-info" style={{fontSize:"9px"}}>Filtrado</span>
                    )}
                  </div>
                  <div className="chart-body" style={{ minHeight: "220px" }}>
                    {isDashboardLoading ? (
                      <Skeleton height="180px" />
                    ) : (
                      <div className="overflow-auto fade-in">{renderOncBarChart()}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Event Categories Bar */}
              <div className="col-12 col-lg-6">
                <div className="chart-card h-100 d-flex flex-column">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <span style={{fontSize:"12px", fontWeight:600, color:"#1e293b"}}>Categorías por Evento</span>
                    {(appliedFilters.cliente !== "all" || appliedFilters.lineaTransporte !== "all") && (
                      <span className="badge bg-info" style={{fontSize:"9px"}}>Filtrado</span>
                    )}
                  </div>
                  <div className="chart-body" style={{ minHeight: "220px" }}>
                    {isDashboardLoading ? (
                      <Skeleton height="180px" />
                    ) : (
                      <div className="overflow-auto fade-in">{renderEventCategoriesBarChart()}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnomaliasDashboardPage;
