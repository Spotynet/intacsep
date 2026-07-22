import {useState, useEffect, useMemo, useRef} from "react";
import * as XLSX from "xlsx";
import PageHeader from "../PageHeader";
import Sidebar from "../Sidebar";
import ModalTemplate from "../ModalTemplate";
import DataTable from "../DataTable";
import FilterBar from "../FilterBar";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";
import {useNavigate} from "react-router-dom";
import CellBadge from "../CellBadge";
import {Select} from "../Select";

const fmt = (dt) =>
  dt ? new Date(dt).toLocaleString("es-MX", {dateStyle: "short", timeStyle: "short"}) : "—";

// Normalise an Excel header to a lookup key
const normaliseHeader = (h) => String(h ?? "").trim().toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // strip accents

// Excel serial date → JS Date
const excelSerialToDate = (serial) => {
  const utc_days = Math.floor(serial - 25569);
  return new Date(utc_days * 86400 * 1000);
};

const MONTH_ABBR = {
  jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
  jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
  ene:0, abr:3, ago:7, oct2:9, // spanish aliases already covered by above
};

const parseExcelDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val) ? null : val;
  if (typeof val === "number") return excelSerialToDate(val);

  const s = String(val).trim();

  // "02/Jun/2026 18:00" or "02/Jun/2026"
  const abbr = s.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (abbr) {
    const mon = MONTH_ABBR[abbr[2].toLowerCase()];
    if (mon !== undefined) {
      let yr = parseInt(abbr[3], 10);
      if (yr < 100) yr += 2000;
      const h = abbr[4] ? parseInt(abbr[4], 10) : 0;
      const m = abbr[5] ? parseInt(abbr[5], 10) : 0;
      return new Date(yr, mon, parseInt(abbr[1], 10), h, m);
    }
  }

  // "6/3/26 6:00" or "6/3/2026 6:00" — M/D/YY(YY) H:MM
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (mdy) {
    let yr = parseInt(mdy[3], 10);
    if (yr < 100) yr += 2000;
    const h = mdy[4] ? parseInt(mdy[4], 10) : 0;
    const m = mdy[5] ? parseInt(mdy[5], 10) : 0;
    return new Date(yr, parseInt(mdy[1], 10) - 1, parseInt(mdy[2], 10), h, m);
  }

  const d = new Date(s);
  return isNaN(d) ? null : d;
};

// Map flexible header names to our canonical field names
const HEADER_MAP = {
  "tipo de viaje": "tipoViaje",
  "tipo viaje":    "tipoViaje",
  "tipo_viaje":    "tipoViaje",
  tipoviaje:       "tipoViaje",
  "carrier move":  "carrierMove",
  "carrier_move":  "carrierMove",
  carriermove:     "carrierMove",
  carrier:         "carrierMove",
  cliente:         "clienteNombre",
  "cita de carga": "citaCarga",
  "cita carga":    "citaCarga",
  "cita_carga":    "citaCarga",
  citacarga:       "citaCarga",
  "cita de entrega": "citaEntrega",
  "cita entrega":    "citaEntrega",
  "cita_entrega":    "citaEntrega",
  citaentrega:       "citaEntrega",
  "hora de salida":"horaSalida",
  "hora salida":   "horaSalida",
  "hora_salida":   "horaSalida",
  horasalida:      "horaSalida",
  destino:         "destinoNombre",
  transporte:      "transporte",
};

const TEMPLATE_HEADERS = [
  "Tipo de Viaje",
  "Carrier Move",
  "Cliente",
  "Destino",
  "Cita de Carga",
  "Hora de Salida",
  "Cita de Entrega",
  "Transporte",
];

const emptyForm = {
  tipoViaje: "",
  carrierMove: "",
  cliente: "",
  destino: "",
  citaCarga: "",
  horaSalida: "",
  citaEntrega: "",
  transporte: "",
};

const PlanesDeEmbarquePage = () => {
  const [planes, setPlanes]               = useState([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [clientes, setClientes]           = useState([]);
  const [destinos, setDestinos]           = useState([]);
  const [filteredDestinos, setFilteredDestinos] = useState([]);
  const [formData, setFormData]           = useState(emptyForm);
  const [editingId, setEditingId]         = useState(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [idToDelete, setIdToDelete]       = useState("");
  const [filters, setFilters]             = useState({tipoViaje: "", cliente: "", destino: "", transporte: ""});
  const [formError, setFormError]         = useState("");

  // Import state
  const [importRows, setImportRows]       = useState([]); // parsed preview rows
  const [importResults, setImportResults] = useState(null); // null = not yet run
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting]     = useState(false);
  const [importParseError, setImportParseError] = useState("");
  const [importFetchError, setImportFetchError] = useState("");
  const fileInputRef = useRef(null);

  const {user, verifyToken, setUser} = useAuth();
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const navigate                     = useNavigate();
  const baseUrl                      = import.meta.env.VITE_BASE_URL;

  useEffect(() => {
    const init = async () => {
      try { setUser(await verifyToken()); }
      catch { navigate("/login"); }
    };
    init();
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch(`${baseUrl}/roles/${user.role}`, {credentials: "include"})
      .then((r) => r.json())
      .then((role) => { if (!role?.planes_embarque?.read) navigate("/"); })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [planesRes, clientesRes, destinosRes] = await Promise.all([
          fetch(`${baseUrl}/planes-embarque`, {credentials: "include"}),
          fetch(`${baseUrl}/clients`,         {credentials: "include"}),
          fetch(`${baseUrl}/destinos`,         {credentials: "include"}),
        ]);
        if (planesRes.ok)   setPlanes(await planesRes.json());
        if (clientesRes.ok) setClientes(await clientesRes.json());
        if (destinosRes.ok) setDestinos(await destinosRes.json());
      } catch (e) {
        console.error("Error fetching data:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Filter destinos whenever selected cliente changes
  useEffect(() => {
    if (!formData.cliente) { setFilteredDestinos([]); return; }
    const selected = clientes.find((c) => c._id === formData.cliente);
    if (!selected) { setFilteredDestinos([]); return; }
    setFilteredDestinos(destinos.filter((d) => d.cliente === selected.razon_social));
  }, [formData.cliente, clientes, destinos]);

  const filteredPlanes = useMemo(
    () =>
      planes.filter((p) => {
        const clienteNombre = p.cliente?.razon_social ?? "";
        const destinoNombre = p.destino?.nombre ?? "";
        return (
          (!filters.tipoViaje  || p.tipoViaje.toLowerCase().includes(filters.tipoViaje.toLowerCase())) &&
          (!filters.cliente    || clienteNombre === filters.cliente) &&
          (!filters.destino    || destinoNombre === filters.destino) &&
          (!filters.transporte || p.transporte.toLowerCase().includes(filters.transporte.toLowerCase()))
        );
      }),
    [planes, filters]
  );

  const handleChange = (e) => {
    const {name, value} = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "cliente" ? {destino: ""} : {}),
    }));
  };

  const handleFilterChange = (e) => {
    const {name, value} = e.target;
    setFilters((prev) => ({...prev, [name]: value}));
  };

  const clearFilters = () => setFilters({tipoViaje: "", cliente: "", destino: "", transporte: ""});
  const hasActiveFilters = !!(filters.tipoViaje || filters.cliente || filters.destino || filters.transporte);

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setFormError("");
    setModalVisible(true);
  };

  const openEdit = (plan) => {
    setEditingId(plan._id);
    setFormData({
      tipoViaje:   plan.tipoViaje,
      carrierMove: plan.carrierMove,
      cliente:     plan.cliente?._id ?? "",
      destino:     plan.destino?._id  ?? "",
      citaCarga:   plan.citaCarga  ? new Date(plan.citaCarga).toISOString().slice(0, 16)  : "",
      horaSalida:  plan.horaSalida ? new Date(plan.horaSalida).toISOString().slice(0, 16) : "",
      citaEntrega: plan.citaEntrega ? new Date(plan.citaEntrega).toISOString().slice(0, 16) : "",
      transporte:  plan.transporte,
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingId(null);
    setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    try {
      const method = editingId ? "PUT" : "POST";
      const url    = editingId
        ? `${baseUrl}/planes-embarque/${editingId}`
        : `${baseUrl}/planes-embarque`;

      const body = formData;

      const res = await fetch(url, {
        method,
        headers: {"Content-Type": "application/json"},
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const result = await res.json();
        const saved = result;
        setPlanes((prev) =>
          editingId
            ? prev.map((p) => (p._id === saved._id ? saved : p))
            : [...prev, saved]
        );
        closeModal();
      } else {
        const err = await res.json().catch(() => ({}));
        setFormError(err.message ?? "Error al guardar el plan.");
      }
    } catch (e) {
      setFormError("Error de conexión. Intente nuevamente.");
    }
  };

  const handleDelete = (id) => { setIdToDelete(id); setShowDeleteModal(true); };

  const handleConfirmDelete = async (id) => {
    try {
      const res = await fetch(`${baseUrl}/planes-embarque/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setPlanes((prev) => prev.filter((p) => p._id !== id));
        setShowDeleteModal(false);
      }
    } catch (e) {
      console.error("Error deleting plan:", e);
    }
  };

  // ── IMPORT ──────────────────────────────────────────────────

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      // Example row
      ["IMPORTACION", "ABC123", "CLIENTE EJEMPLO", "DESTINO EJEMPLO", "2025-04-01 08:00", "2025-04-01 10:00", "2025-04-01 16:00", "TRANSPORTE-001"],
    ]);
    // Set column widths
    ws["!cols"] = TEMPLATE_HEADERS.map(() => ({wch: 22}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Planes de Embarque");
    XLSX.writeFile(wb, "plantilla_planes_embarque.xlsx");
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    // Reset so the same file can be re-selected after fixing
    e.target.value = "";
    if (!file) return;

    setImportParseError("");
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, {type: "binary", cellDates: true});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, {header: 1, defval: ""});

        if (raw.length < 2) {
          setImportParseError("El archivo no contiene datos. Asegúrate de usar la plantilla correcta.");
          setShowImportModal(true);
          return;
        }

        const headers = raw[0].map(normaliseHeader);
        const fieldMap = {}; // colIndex → canonical field name
        headers.forEach((h, i) => {
          if (HEADER_MAP[h]) fieldMap[i] = HEADER_MAP[h];
        });

        const required = ["tipoViaje", "carrierMove", "clienteNombre", "destinoNombre", "citaCarga", "horaSalida", "citaEntrega", "transporte"];
        const missing = required.filter((f) => !Object.values(fieldMap).includes(f));
        if (missing.length > 0) {
          const humanNames = {"tipoViaje":"Tipo de Viaje","carrierMove":"Carrier Move","clienteNombre":"Cliente","destinoNombre":"Destino","citaCarga":"Cita de Carga","horaSalida":"Hora de Salida","citaEntrega":"Cita de Entrega","transporte":"Transporte"};
          const detectedCols = raw[0].filter((h) => String(h).trim() !== "").join(", ");
          setImportParseError(
            `Faltan columnas requeridas: ${missing.map((f) => humanNames[f] ?? f).join(", ")}.\n` +
            `Columnas detectadas en el archivo: ${detectedCols || "(ninguna)"}.`
          );
          setShowImportModal(true);
          return;
        }

        const rows = raw.slice(1).filter((r) => r.some((v) => v !== "")).map((r, idx) => {
          const obj = {_rowNum: idx + 2};
          Object.entries(fieldMap).forEach(([col, field]) => {
            obj[field] = r[col];
          });
          // Normalise dates to ISO string
          const citaDate  = parseExcelDate(obj.citaCarga);
          const salidaDate = parseExcelDate(obj.horaSalida);
          const entregaDate = parseExcelDate(obj.citaEntrega);
          obj.citaCarga  = citaDate  ? citaDate.toISOString()  : "";
          obj.horaSalida = salidaDate ? salidaDate.toISOString() : "";
          obj.citaEntrega = entregaDate ? entregaDate.toISOString() : "";
          return obj;
        });

        if (rows.length === 0) {
          setImportParseError("El archivo no tiene filas de datos (solo encabezados).");
          setShowImportModal(true);
          return;
        }

        setImportRows(rows);
        setShowImportModal(true);
      } catch (err) {
        setImportParseError("No se pudo leer el archivo. Asegúrate de que sea un archivo Excel válido (.xlsx o .xls).");
        setShowImportModal(true);
      }
    };
    reader.readAsBinaryString(file);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportRows([]);
    setImportResults(null);
    setImportParseError("");
    setImportFetchError("");
  };

  const handleImportConfirm = async () => {
    if (isImporting) return;
    setIsImporting(true);
    setImportFetchError("");
    try {
      const res = await fetch(`${baseUrl}/planes-embarque/bulk`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "include",
        body: JSON.stringify({
          rows: importRows,
          creado_por: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Error del servidor (${res.status})`);
      }

      const data = await res.json();
      setImportResults(data.results ?? []);

      // Add successfully imported plans to the list
      const newPlans = (data.results ?? [])
        .filter((r) => r.status === "ok")
        .map((r) => r.plan);
      if (newPlans.length > 0) setPlanes((prev) => [...prev, ...newPlans]);
    } catch (e) {
      setImportFetchError(e.message ?? "Error de conexión. Intente nuevamente.");
    } finally {
      setIsImporting(false);
    }
  };

  // ── COLUMNS & ACTIONS ────────────────────────────────────────

  const columns = [
    {
      key: "index",
      header: "#",
      width: "55px",
      headerClassName: "text-center",
      className: "text-center fw-bold",
      render: (_row, {rowIndex, currentPage, itemsPerPage}) =>
        (currentPage - 1) * itemsPerPage + rowIndex + 1,
    },
    {key: "tipoViaje",   header: "Tipo de Viaje"},
    {key: "carrierMove", header: "Carrier Move"},
    {
      key: "cliente",
      header: "Cliente",
      render: (row) => row.cliente?.razon_social ?? "—",
    },
    {
      key: "destino",
      header: "Destino",
      render: (row) => row.destino?.nombre ?? "—",
    },
    {
      key: "citaCarga",
      header: "Cita de Carga",
      render: (row) => fmt(row.citaCarga),
    },
    {
      key: "horaSalida",
      header: "Hora de Salida",
      render: (row) => fmt(row.horaSalida),
    },
    {
      key: "citaEntrega",
      header: "Cita de Entrega",
      render: (row) => fmt(row.citaEntrega),
    },
    {key: "transporte", header: "Transporte"},
    {
      key: "linked_bitacora",
      header: "Bitácora",
      render: (row) =>
        row.linked_bitacora ? (
          <CellBadge
            label={`#${row.linked_bitacora.bitacora_id}`}
            variant="blue"
            onClick={() => navigate(`/bitacora/${row.linked_bitacora._id}`)}
          />
        ) : (
          "—"
        ),
    },
    {
      key: "acciones",
      header: "Acciones",
      width: "8%",
      headerClassName: "text-end",
      className: "table-cell",
      render: (row) => (
        <div className="d-flex justify-content-end gap-2">
          <button className="action-btn btn-primary" title="Editar" onClick={() => openEdit(row)}>
            <i className="fas fa-edit"></i>
          </button>
          <button className="action-btn btn-danger" title="Eliminar" onClick={() => handleDelete(row._id)}>
            <i className="fas fa-trash"></i>
          </button>
        </div>
      ),
    },
  ];

  const actions = [];

  const planForm = (
    <>
      {formError && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
          <i className="fas fa-exclamation-circle"></i>
          <span>{formError}</span>
        </div>
      )}
      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label fw-semibold">Tipo de Viaje <span className="text-danger">*</span></label>
          <input className="form-control" name="tipoViaje" value={formData.tipoViaje}
            onChange={handleChange} required />
        </div>
        <div className="col-md-6">
          <label className="form-label fw-semibold">Carrier Move <span className="text-danger">*</span></label>
          <input className="form-control" name="carrierMove" value={formData.carrierMove}
            onChange={handleChange} required />
        </div>
        <div className="col-md-6">
          <label className="form-label fw-semibold">Cliente <span className="text-danger">*</span></label>
          <select className="form-select" name="cliente" value={formData.cliente}
            onChange={handleChange} required>
            <option value="">Selecciona un cliente</option>
            {[...clientes].sort((a, b) => a.razon_social.localeCompare(b.razon_social)).map((c) => (
              <option key={c._id} value={c._id}>{c.razon_social}</option>
            ))}
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label fw-semibold">Destino <span className="text-danger">*</span></label>
          <select className="form-select" name="destino" value={formData.destino}
            onChange={handleChange} required disabled={!formData.cliente}>
            <option value="">
              {formData.cliente ? "Selecciona un destino" : "Selecciona un cliente primero"}
            </option>
            {[...filteredDestinos].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((d) => (
              <option key={d._id} value={d._id}>{d.nombre}</option>
            ))}
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label fw-semibold">Cita de Carga <span className="text-danger">*</span></label>
          <input type="datetime-local" className="form-control" name="citaCarga"
            value={formData.citaCarga} onChange={handleChange} required />
        </div>
        <div className="col-md-6">
          <label className="form-label fw-semibold">Hora de Salida <span className="text-danger">*</span></label>
          <input type="datetime-local" className="form-control" name="horaSalida"
            value={formData.horaSalida} onChange={handleChange} required />
        </div>
        <div className="col-md-6">
          <label className="form-label fw-semibold">Cita de Entrega <span className="text-danger">*</span></label>
          <input type="datetime-local" className="form-control" name="citaEntrega"
            value={formData.citaEntrega} onChange={handleChange} required />
        </div>
        <div className="col-12">
          <label className="form-label fw-semibold">Transporte <span className="text-danger">*</span></label>
          <input className="form-control" name="transporte" value={formData.transporte}
            onChange={handleChange} required />
        </div>
      </div>
    </>
  );

  // ── IMPORT MODAL CONTENT ──────────────────────────────────────

  const importDone    = importResults !== null;
  const successCount  = importDone ? importResults.filter((r) => r.status === "ok").length    : 0;
  const errorCount    = importDone ? importResults.filter((r) => r.status === "error").length : 0;
  // "done" means no more action to take — show only Cerrar button
  const importModalClosed = importDone || !!importParseError;

  const importModalContent = (
    <div className="import-preview">
      {importFetchError && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
          <i className="fas fa-exclamation-circle"></i>
          <span>{importFetchError}</span>
        </div>
      )}
      {importParseError ? (
        <div className="alert alert-danger mb-0">
          <div className="d-flex align-items-start gap-2">
            <i className="fas fa-exclamation-circle mt-1 flex-shrink-0"></i>
            <div>
              {importParseError.split("\n").map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      ) : importDone ? (
        <>
          <div className={`alert ${errorCount === 0 ? "alert-success" : "alert-warning"} d-flex align-items-center gap-2 mb-3`}>
            <i className={`fas ${errorCount === 0 ? "fa-check-circle" : "fa-exclamation-triangle"}`}></i>
            <span>
              {successCount} plan{successCount !== 1 ? "es" : ""} importado{successCount !== 1 ? "s" : ""} correctamente
              {errorCount > 0 && ` · ${errorCount} con error`}
            </span>
          </div>
          <div className="import-table-wrapper">
            <table className="table table-sm table-bordered import-table">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Tipo de Viaje</th>
                  <th>Cliente</th>
                  <th>Destino</th>
                  <th>Transporte</th>
                  <th>Estado / Detalle</th>
                </tr>
              </thead>
              <tbody>
                {importResults.map((r) => (
                  <tr key={r.row} className={r.status === "error" ? "table-danger" : "table-success"}>
                    <td>{r.row}</td>
                    <td>{r.tipoViaje ?? "—"}</td>
                    <td>{r.clienteNombre ?? "—"}</td>
                    <td>{r.destinoNombre ?? "—"}</td>
                    <td>{r.transporte ?? "—"}</td>
                    <td>
                      {r.status === "ok"
                        ? <span className="badge bg-success">OK</span>
                        : (
                          <div>
                            <span className="badge bg-danger">Error</span>
                            {r.message && (
                              <div className="text-danger mt-1" style={{fontSize: "0.75rem", lineHeight: 1.3}}>
                                {r.message}
                              </div>
                            )}
                          </div>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted mb-3" style={{fontSize: "0.875rem"}}>
            Se importarán <strong>{importRows.length}</strong> plan{importRows.length !== 1 ? "es" : ""} de embarque.
            Revisa los datos antes de confirmar.
          </p>
          <div className="import-table-wrapper">
            <table className="table table-sm table-bordered import-table">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Tipo de Viaje</th>
                  <th>Carrier Move</th>
                  <th>Cliente</th>
                  <th>Destino</th>
                  <th>Cita de Carga</th>
                  <th>Hora de Salida</th>
                  <th>Cita de Entrega</th>
                  <th>Transporte</th>
                </tr>
              </thead>
              <tbody>
                {importRows.map((r) => (
                  <tr key={r._rowNum}>
                    <td className="text-muted">{r._rowNum}</td>
                    <td>{r.tipoViaje}</td>
                    <td>{r.carrierMove}</td>
                    <td>{r.clienteNombre}</td>
                    <td>{r.destinoNombre}</td>
                    <td>{r.citaCarga  ? fmt(r.citaCarga)  : <span className="text-danger">—</span>}</td>
                    <td>{r.horaSalida ? fmt(r.horaSalida) : <span className="text-danger">—</span>}</td>
                    <td>{r.citaEntrega ? fmt(r.citaEntrega) : <span className="text-danger">—</span>}</td>
                    <td>{r.transporte}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );

  return (
    <section id="planesDeEmbarquePage" className="settings-page">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{display: "none"}}
        onChange={handleFileChange}
      />

      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Monitoreo — Planes de Embarque"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            filters={
              <FilterBar onClear={clearFilters}>
                <div>
                  <span className="pselect__label">Tipo de Viaje</span>
                  <div className="pdt-field">
                    <i className="fa fa-route pdt-field__icon"></i>
                    <input
                      type="text"
                      className="pdt-field__input"
                      placeholder="Buscar..."
                      value={filters.tipoViaje}
                      onChange={(e) => setFilters((p) => ({...p, tipoViaje: e.target.value}))}
                    />
                  </div>
                </div>
                <div>
                  <Select
                    label="Cliente"
                    placeholder="Todos los clientes"
                    value={filters.cliente || null}
                    onChange={(v) => setFilters((p) => ({...p, cliente: v ?? ""}))}
                    options={[...clientes]
                      .sort((a, b) => a.razon_social.localeCompare(b.razon_social))
                      .map((c) => ({value: c.razon_social, label: c.razon_social}))}
                  />
                </div>
                <div>
                  <Select
                    label="Destino"
                    placeholder="Todos los destinos"
                    value={filters.destino || null}
                    onChange={(v) => setFilters((p) => ({...p, destino: v ?? ""}))}
                    options={[...destinos]
                      .sort((a, b) => a.nombre.localeCompare(b.nombre))
                      .map((d) => ({value: d.nombre, label: d.nombre}))}
                  />
                </div>
                <div>
                  <span className="pselect__label">Transporte</span>
                  <div className="pdt-field">
                    <i className="fa fa-truck pdt-field__icon"></i>
                    <input
                      type="text"
                      className="pdt-field__input"
                      placeholder="Buscar..."
                      value={filters.transporte}
                      onChange={(e) => setFilters((p) => ({...p, transporte: e.target.value}))}
                    />
                  </div>
                </div>
              </FilterBar>
            }
            filterActions={<>
              <button
                className="header-action-btn header-action-btn--green"
                title="Descargar plantilla Excel"
                onClick={downloadTemplate}>
                <i className="fas fa-file-download"></i>
                <span>Plantilla</span>
              </button>
              <button
                className="header-action-btn header-action-btn--indigo"
                title="Importar desde Excel"
                onClick={() => fileInputRef.current?.click()}>
                <i className="fas fa-file-import"></i>
                <span>Importar</span>
              </button>
            </>}
          >
            <button className="new-btn" title="Nuevo plan" onClick={openCreate}>
              <i className="fas fa-plus"></i>Crear
            </button>
          </PageHeader>

          <div className="bits-table-shell">
            <DataTable
              data={filteredPlanes}
              columns={columns}
              loading={isLoading}
              emptyMessage="No se encontraron planes de embarque."
              maxHeight="100%"
            />
          </div>
        </div>
      </div>

      {/* Create / Edit modal */}
      {isModalVisible && (
        <ModalTemplate
          wide
          show={isModalVisible}
          title={editingId ? "Editar Plan de Embarque" : "Nuevo Plan de Embarque"}
          onClose={closeModal}
          onSubmit={handleSubmit}>
          {planForm}
        </ModalTemplate>
      )}

      {/* Import preview / results modal */}
      {showImportModal && (
        <ModalTemplate
          wide
          show={showImportModal}
          title="Importar Planes de Embarque"
          onClose={closeImportModal}
          onSubmit={(e) => {
            e.preventDefault();
            if (importModalClosed) closeImportModal();
            else handleImportConfirm();
          }}
          submitText={importModalClosed ? "Cerrar" : isImporting ? "Importando…" : `Importar ${importRows.length} plan${importRows.length !== 1 ? "es" : ""}`}
          submitClass={importModalClosed ? "btn btn-secondary" : "btn btn-success"}
          submitDisabled={isImporting}
          cancelText="Cancelar"
          cancelClass={importModalClosed ? "d-none" : "btn btn-danger"}
          hideFooter={false}>
          {importModalContent}
        </ModalTemplate>
      )}

      {/* Delete confirmation */}
      {showDeleteModal && (
        <ModalTemplate
          show={showDeleteModal}
          title="Confirmar Eliminación"
          onClose={() => setShowDeleteModal(false)}
          onSubmit={(e) => { e.preventDefault(); handleConfirmDelete(idToDelete); }}>
          <p>¿Está seguro de que desea eliminar este plan de embarque?</p>
        </ModalTemplate>
      )}
    </section>
  );
};

export default PlanesDeEmbarquePage;
