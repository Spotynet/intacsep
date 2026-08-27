import {useEffect, useState, useMemo} from "react";
import Sidebar from "../Sidebar";
import PageHeader from "../PageHeader";
import FilterBar from "../FilterBar";
import DataTable from "../DataTable";
import {Select} from "../Select";
import DateTimeRangePicker from "../DateTimeRangePicker";
import * as XLSX from "xlsx";
import {saveAs} from "file-saver";
import {useAuth} from "../../context/AuthContext";
import {useSidebar} from "../../context/SidebarContext";
import {useNavigate} from "react-router-dom";

const toDateTimeLocal = (date) => {
  const pad = (num) => num.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const AuditoriasPage = () => {
  const [auditorias, setAuditorias] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const today = new Date();
  const lastMonth = new Date();
  lastMonth.setDate(today.getDate() - 30);

  const [filters, setFilters] = useState({
    tipo: "",
    bitacora_id: "",
    email: "",
    rol: "",
    seccion: "",
    campo: "",
    ValOriginal: "",
    ValNuevo: "",
    desde: toDateTimeLocal(lastMonth),
    hasta: toDateTimeLocal(today),
  });

  const baseUrl = import.meta.env.VITE_BASE_URL;

  const {user, verifyToken, setUser} = useAuth();
  const [roleData, setRoleData] = useState(null);
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      try {
        const data = await verifyToken(); 
        setUser(data);
      } catch (e) {
        navigate("/login");
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!user?.role) return;
    const fetchRolePermissions = async () => {
      try {
        const response = await fetch(`${baseUrl}/roles/${user.role}`, {
          method: "GET",
          credentials: "include",
        });
        const data = await response.json();
        setRoleData(data);
        if (!data?.auditoria_bitacora?.read) navigate("/");
      } catch (e) {
        console.error("Error fetching role permissions:", e);
      }
    };

    fetchRolePermissions();
  }, [user]);

  const fetchAuditorias = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/auditoria/bitacoras`, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAuditorias(data);
      }
    } catch (e) {
      console.error("Error fetching auditorias:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditorias();
  }, [baseUrl]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({...prev, [key]: value}));
  };

  const clearFilters = () => {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    setFilters({
      tipo: "",
      bitacora_id: "",
      email: "",
      rol: "",
      seccion: "",
      campo: "",
      ValOriginal: "",
      ValNuevo: "",
      desde: toDateTimeLocal(lastMonth),
      hasta: toDateTimeLocal(today),
    });
  };

  const hasActiveFilters = useMemo(() => {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    
    return filters.tipo || filters.bitacora_id || filters.email || filters.rol || 
           filters.seccion || filters.campo || filters.ValOriginal || filters.ValNuevo ||
           filters.desde !== toDateTimeLocal(lastMonth) || filters.hasta !== toDateTimeLocal(today);
  }, [filters]);

  const filteredData = useMemo(() => {
    return auditorias.filter((item) => {
      const matchText = (key) => {
        if (!filters[key]) return true;
        return item[key]?.toString().toLowerCase().includes(filters[key].toLowerCase());
      };

      const itemDate = new Date(item.createdAt).getTime();
      const startDate = filters.desde ? new Date(filters.desde).getTime() : 0;
      const endDate = filters.hasta ? new Date(filters.hasta).getTime() : Infinity;

      return (
        matchText("tipo") &&
        matchText("bitacora_id") &&
        matchText("email") &&
        matchText("rol") &&
        matchText("seccion") &&
        matchText("campo") &&
        matchText("ValOriginal") &&
        matchText("ValNuevo") &&
        itemDate >= startDate &&
        itemDate <= endDate
      );
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [auditorias, filters]);

  const exportToExcel = () => {
    const exportData = filteredData.map((item) => ({
      Tipo: item.tipo,
      "Bitácora ID": item.bitacora_id,
      Email: item.email,
      Rol: item.rol,
      Sección: item.seccion,
      Campo: item.campo,
      "Valor Original": item.ValOriginal,
      "Valor Nuevo": item.ValNuevo,
      Fecha: new Date(item.createdAt).toLocaleString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Auditorias");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const fileData = new Blob([excelBuffer], {type: "application/octet-stream"});
    saveAs(fileData, `auditorias_export_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const columns = [
    { key: "tipo", header: "Tipo", width: "10%" },
    { key: "bitacora_id", header: "Bitácora ID", width: "8%", className: "fw-bold" },
    { key: "email", header: "Email", width: "15%" },
    { key: "rol", header: "Rol", width: "10%" },
    { key: "seccion", header: "Sección", width: "10%" },
    { key: "campo", header: "Campo", width: "10%" },
    { key: "ValOriginal", header: "Valor Original", width: "12%", render: (row) => <span className="text-muted">{row.ValOriginal || "—"}</span> },
    { key: "ValNuevo", header: "Valor Nuevo", width: "12%", render: (row) => <span className="text-primary">{row.ValNuevo || "—"}</span> },
    { key: "createdAt", header: "Fecha", width: "13%", render: (row) => new Date(row.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }) },
  ];

  return (
    <section id="auditorias" className="settings-page">
      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title="Auditoría - Bitácoras"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            filters={
              <FilterBar onClear={clearFilters}>
                <div>
                  <span className="pselect__label">Tipo</span>
                  <div className="pdt-field">
                    <i className="fa fa-tag pdt-field__icon"></i>
                    <input
                      type="text"
                      className="pdt-field__input"
                      placeholder="Filtrar..."
                      value={filters.tipo}
                      onChange={(e) => handleFilterChange("tipo", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <span className="pselect__label">Bitácora ID</span>
                  <div className="pdt-field">
                    <i className="fa fa-hashtag pdt-field__icon"></i>
                    <input
                      type="text"
                      className="pdt-field__input"
                      placeholder="Filtrar..."
                      value={filters.bitacora_id}
                      onChange={(e) => handleFilterChange("bitacora_id", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <span className="pselect__label">Email</span>
                  <div className="pdt-field">
                    <i className="fa fa-envelope pdt-field__icon"></i>
                    <input
                      type="text"
                      className="pdt-field__input"
                      placeholder="Filtrar..."
                      value={filters.email}
                      onChange={(e) => handleFilterChange("email", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <span className="pselect__label">Campo</span>
                  <div className="pdt-field">
                    <i className="fa fa-edit pdt-field__icon"></i>
                    <input
                      type="text"
                      className="pdt-field__input"
                      placeholder="Filtrar..."
                      value={filters.campo}
                      onChange={(e) => handleFilterChange("campo", e.target.value)}
                    />
                  </div>
                </div>
                <div style={{gridColumn: 'span 2'}}>
                  <DateTimeRangePicker
                    label="Fecha"
                    startValue={filters.desde}
                    endValue={filters.hasta}
                    onStartChange={(v) => handleFilterChange("desde", v)}
                    onEndChange={(v) => handleFilterChange("hasta", v)}
                  />
                </div>
              </FilterBar>
            }>
            <div className="d-flex gap-2">
              <button className="new-btn" onClick={fetchAuditorias} disabled={loading} title="Recargar">
                <i className={`fa fa-${loading ? "spinner fa-spin" : "sync-alt"}`}></i>
              </button>
              <button className="btn-icon btn-icon--success" onClick={exportToExcel} title="Exportar Excel">
                <i className="fa fa-file-excel"></i>
              </button>
            </div>
          </PageHeader>

          <div className="bits-table-shell mt-4">
            <DataTable
              data={filteredData}
              loading={loading}
              columns={columns}
              rowKey="_id"
              maxHeight="100%"
              emptyMessage="No se encontraron registros de auditoría."
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default AuditoriasPage;
