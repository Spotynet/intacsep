import {useState, useEffect, useCallback, useRef} from "react";
import {useAuth} from "../context/AuthContext";
import {useSidebar} from "../context/SidebarContext";
import {useNavigate} from "react-router-dom";
import Sidebar from "./Sidebar";
import PageHeader from "./PageHeader";
import FilterBar from "./FilterBar";
import {Select} from "./Select";
import DatePicker from "./DatePicker";
import {getAllowedClients} from "../utils/clientPermissions";

const Skeleton = ({ width = "100%", height = "20px", className = "" }) => (
  <div 
    className={`skeleton-loader ${className}`} 
    style={{ width, height, borderRadius: '6px' }}
  />
);

const DashboardPage = () => {
  const {user} = useAuth();
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const navigate = useNavigate();

  const [roleData, setRoleData] = useState(null);

  const [dashboardStats, setDashboardStats] = useState({
    totalBitacoras: 0,
    nuevasBitacoras: 0,
    enProcesoBitacoras: 0,
    cerradasBitacoras: 0,
    eventCategoriesStats: [],
    lineasTransporteStats: [],
    totalBitacorasConAnomalias: 0,
    totalUsers: 0,
    totalClients: 0,
    recentActivity: [],
    monthlyData: [],
    statusDistribution: [],
    topClients: [],
    topOperadores: [],
    topLineasTransporte: [],
    topOperadoresTransportes: [],
    statusTrends: [],
    eventDistribution: [],
    geographicData: [],
    operatorEfficiency: [],
    clientPerformance: [],
    tiposMonitoreo: [],
  });

  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [clientFilter, setClientFilter] = useState("all");
  const [availableClients, setAvailableClients] = useState([]);
  const [geoType, setGeoType] = useState("origen");

  // Filtros pendientes (que se pueden cambiar sin aplicar)
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [fechaHasta, setFechaHasta] = useState(() => {
    // Set default value to today's date in YYYY-MM-DD format
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [lineaTransporteFilter, setLineaTransporteFilter] = useState("all");
  const [operadorFilter, setOperadorFilter] = useState("all");

  // Filtros aplicados (que realmente se usan en las consultas)
  const [appliedClientFilter, setAppliedClientFilter] = useState("all");
  const [appliedFechaDesde, setAppliedFechaDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [appliedFechaHasta, setAppliedFechaHasta] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [appliedLineaTransporteFilter, setAppliedLineaTransporteFilter] = useState("all");
  const [appliedOperadorFilter, setAppliedOperadorFilter] = useState("all");
  const [appliedGeoType, setAppliedGeoType] = useState("origen");

  const [availableLineasTransporte, setAvailableLineasTransporte] = useState([]);
  const [availableOperadores, setAvailableOperadores] = useState([]);
  const [applyFiltersTrigger, setApplyFiltersTrigger] = useState(0);
  const [loadingLineasTransporte, setLoadingLineasTransporte] = useState(false);
  const [loadingOperadores, setLoadingOperadores] = useState(false);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const baseUrl = import.meta.env.VITE_BASE_URL || "http://localhost:3001";

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
          } catch {
            // endpoint unavailable
          }
        }

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
          } catch {
            // endpoint unavailable
          }
        }

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

  const [lineasViewMode, setLineasViewMode] = useState("chart"); // 'chart' or 'list'
  const [operadoresTransportesViewMode, setOperadoresTransportesViewMode] = useState("chart"); // 'chart' or 'list'
  const [usuariosViewMode, setUsuariosViewMode] = useState("chart"); // 'chart' or 'list'
  const [geograficoViewMode, setGeograficoViewMode] = useState("chart"); // 'chart' or 'list'

  // Estado para los dropdowns de clientes
  const [expandedClients, setExpandedClients] = useState({}); // {clienteId: boolean}
  const [clientBitacoras, setClientBitacoras] = useState({}); // {clienteId: [bitacoras]}
  const [loadingClientBitacoras, setLoadingClientBitacoras] = useState({}); // {clienteId: boolean}
  const [clientPagination, setClientPagination] = useState({}); // {clienteId: paginationInfo}
  const [loadingClientDownload, setLoadingClientDownload] = useState({}); // {clienteId: boolean}
  const [clientPageLimits, setClientPageLimits] = useState({}); // {clienteId: limit}

  // Estado para los dropdowns de usuarios
  const [expandedUsers, setExpandedUsers] = useState({}); // {userName: boolean}
  const [userBitacoras, setUserBitacoras] = useState({}); // {userName: [bitacoras]}
  const [loadingUserBitacoras, setLoadingUserBitacoras] = useState({}); // {userName: boolean}
  const [userPagination, setUserPagination] = useState({}); // {userName: paginationInfo}
  const [loadingUserDownload, setLoadingUserDownload] = useState({}); // {userName: boolean}
  const [userPageLimits, setUserPageLimits] = useState({}); // {userName: limit}

  // Estado para los dropdowns de ubicaciones geográficas
  const [expandedLocations, setExpandedLocations] = useState({}); // {locationName: boolean}
  const [locationBitacoras, setLocationBitacoras] = useState({}); // {locationName: [bitacoras]}
  const [loadingLocationBitacoras, setLoadingLocationBitacoras] = useState({}); // {locationName: boolean}
  const [locationPagination, setLocationPagination] = useState({}); // {locationName: paginationInfo}
  const [loadingLocationDownload, setLoadingLocationDownload] = useState({}); // {locationName: boolean}
  const [locationPageLimits, setLocationPageLimits] = useState({}); // {locationName: limit}

  // Estado para paginación de la vista geográfica principal
  const [geographicPage, setGeographicPage] = useState(1);
  const [geographicPageSize, setGeographicPageSize] = useState(50); // Aumentado a 50 por defecto

  const clearExpandedStates = () => {
    setExpandedClients({});
    setClientBitacoras({});
    setLoadingClientBitacoras({});
    setClientPagination({});
    setLoadingClientDownload({});

    setExpandedUsers({});
    setUserBitacoras({});
    setLoadingUserBitacoras({});
    setUserPagination({});
    setLoadingUserDownload({});

    setExpandedLocations({});
    setLocationBitacoras({});
    setLoadingLocationBitacoras({});
    setLocationPagination({});
    setLoadingLocationDownload({});

    setGeographicPage(1);
  };

  const commitFilters = ({
    nextClientFilter = clientFilter,
    nextGeoType = geoType,
    nextFechaDesde = fechaDesde,
    nextFechaHasta = fechaHasta,
    nextLineaTransporteFilter = lineaTransporteFilter,
    nextOperadorFilter = operadorFilter,
  } = {}) => {
    setClientFilter(nextClientFilter);
    setGeoType(nextGeoType);
    setFechaDesde(nextFechaDesde);
    setFechaHasta(nextFechaHasta);
    setLineaTransporteFilter(nextLineaTransporteFilter);
    setOperadorFilter(nextOperadorFilter);

    setAppliedClientFilter(nextClientFilter);
    setAppliedGeoType(nextGeoType);
    setAppliedFechaDesde(nextFechaDesde);
    setAppliedFechaHasta(nextFechaHasta);
    setAppliedLineaTransporteFilter(nextLineaTransporteFilter);
    setAppliedOperadorFilter(nextOperadorFilter);
    setApplyFiltersTrigger((prev) => prev + 1);
    clearExpandedStates();
  };

  const clearFilters = () => {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fechaDesdeDefault = thirtyDaysAgo.toISOString().split("T")[0];

    commitFilters({
      nextClientFilter: "all",
      nextGeoType: "origen",
      nextFechaDesde: fechaDesdeDefault,
      nextFechaHasta: today,
      nextLineaTransporteFilter: "all",
      nextOperadorFilter: "all",
    });
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  const hasActiveFilters =
    appliedFechaDesde !== thirtyDaysAgoStr ||
    appliedFechaHasta !== todayStr ||
    appliedClientFilter !== "all" ||
    appliedLineaTransporteFilter !== "all" ||
    appliedOperadorFilter !== "all";

  // Helper function to format numbers with thousands separator
  const formatNumber = (num) => {
    if (num === null || num === undefined) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Helper function to get total anomalies from the anomalies endpoint
  const getTotalAnomalias = useCallback(() => {
    // Use the totalBitacorasConAnomalias from the anomalies endpoint which has strict validation
    return dashboardStats.totalBitacorasConAnomalias || 0;
  }, [dashboardStats.totalBitacorasConAnomalias]);

  // Función para cargar las bitácoras de un cliente específico con paginación
  const fetchClientBitacoras = async (clienteNombre, page = 1, customLimit = null) => {
    try {
      setLoadingClientBitacoras((prev) => ({...prev, [clienteNombre]: true}));

      const limit = customLimit || clientPageLimits[clienteNombre] || 10;
      const url = `${baseUrl}/bitacoras/by-client/${encodeURIComponent(
        clienteNombre
      )}?fechaDesde=${encodeURIComponent(appliedFechaDesde)}&fechaHasta=${encodeURIComponent(
        appliedFechaHasta
      )}&lineaTransporte=${encodeURIComponent(
        appliedLineaTransporteFilter
      )}&operador=${encodeURIComponent(appliedOperadorFilter)}&page=${page}&limit=${limit}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setClientBitacoras((prev) => ({
          ...prev,
          [clienteNombre]: data.bitacoras,
        }));
        setClientPagination((prev) => ({
          ...prev,
          [clienteNombre]: data.pagination,
        }));
      } else {
        console.error("Error fetching client bitacoras:", response.statusText);
        setClientBitacoras((prev) => ({
          ...prev,
          [clienteNombre]: [],
        }));
        setClientPagination((prev) => ({
          ...prev,
          [clienteNombre]: null,
        }));
      }
    } catch (error) {
      console.error("Error fetching client bitacoras:", error);
      setClientBitacoras((prev) => ({
        ...prev,
        [clienteNombre]: [],
      }));
      setClientPagination((prev) => ({
        ...prev,
        [clienteNombre]: null,
      }));
    } finally {
      setLoadingClientBitacoras((prev) => ({...prev, [clienteNombre]: false}));
    }
  };

  // Función para manejar el toggle del dropdown de cliente
  const toggleClientDropdown = (clienteNombre) => {
    const isCurrentlyExpanded = expandedClients[clienteNombre];

    setExpandedClients((prev) => ({
      ...prev,
      [clienteNombre]: !isCurrentlyExpanded,
    }));

    // Si se está expandiendo y no tenemos las bitácoras, las cargamos
    if (!isCurrentlyExpanded && !clientBitacoras[clienteNombre]) {
      const currentLimit = clientPageLimits[clienteNombre] || 10;
      fetchClientBitacoras(clienteNombre, 1, currentLimit);
    }
  };

  // Función para manejar la paginación de bitácoras de cliente
  const handleClientPagination = (clienteNombre, page) => {
    const currentLimit = clientPageLimits[clienteNombre] || 10;
    fetchClientBitacoras(clienteNombre, page, currentLimit);
  };

  // Función para manejar el cambio de límite de página para clientes
  const handleClientPageLimitChange = (clienteNombre, newLimit) => {
    setClientPageLimits((prev) => ({...prev, [clienteNombre]: newLimit}));
    fetchClientBitacoras(clienteNombre, 1, newLimit); // Reset to first page when changing limit
  };

  // Función para descargar bitácoras de cliente en Excel
  const downloadClientBitacorasExcel = async (clienteNombre) => {
    try {
      setLoadingClientDownload((prev) => ({...prev, [clienteNombre]: true}));

      const url = `${baseUrl}/bitacoras/download/${encodeURIComponent(
        clienteNombre
      )}?fechaDesde=${encodeURIComponent(appliedFechaDesde)}&fechaHasta=${encodeURIComponent(
        appliedFechaHasta
      )}&lineaTransporte=${encodeURIComponent(
        appliedLineaTransporteFilter
      )}&operador=${encodeURIComponent(appliedOperadorFilter)}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();

        if (data.bitacoras && data.bitacoras.length > 0) {
          // Importar XLSX dinámicamente
          const XLSX = await import("xlsx");

          // Preparar datos para Excel
          const excelData = data.bitacoras.map((bitacora, index) => ({
            "#": index + 1,
            "ID Bitácora": bitacora.bitacora_id,
            "Fecha de Creación": new Date(bitacora.fechaCreacion).toLocaleDateString("es-ES"),
            Cliente: bitacora.cliente,
            "Tipo de Monitoreo": bitacora.tipoMonitoreo,
            "Línea de Transporte": bitacora.lineaTransporte,
            "Operador de Transporte": bitacora.operadorTransporte,
            Origen: bitacora.origen,
            Destino: bitacora.destino,
            Estado: bitacora.estado,
            Usuario: bitacora.usuario,
          }));

          // Crear libro de trabajo
          const workbook = XLSX.utils.book_new();
          const worksheet = XLSX.utils.json_to_sheet(excelData);

          // Ajustar ancho de columnas
          const colWidths = [
            {wch: 5}, // #
            {wch: 15}, // ID Bitácora
            {wch: 18}, // Fecha de Creación
            {wch: 25}, // Cliente
            {wch: 20}, // Tipo de Monitoreo
            {wch: 25}, // Línea de Transporte
            {wch: 25}, // Operador de Transporte
            {wch: 30}, // Origen
            {wch: 30}, // Destino
            {wch: 15}, // Estado
            {wch: 20}, // Usuario
          ];
          worksheet["!cols"] = colWidths;

          // Agregar hoja al libro
          XLSX.utils.book_append_sheet(workbook, worksheet, "Bitácoras");

          // Generar nombre de archivo
          const fechaActual = new Date().toISOString().split("T")[0];
          const filename = `Bitacoras_${clienteNombre.replace(
            /[^a-zA-Z0-9]/g,
            "_"
          )}_${fechaActual}.xlsx`;

          // Descargar archivo
          XLSX.writeFile(workbook, filename);
        } else {
          alert("No hay bitácoras disponibles para descargar");
        }
      } else {
        console.error("Error downloading client bitacoras:", response.statusText);
        alert("Error al descargar las bitácoras");
      }
    } catch (error) {
      console.error("Error downloading client bitacoras:", error);
      alert("Error al descargar las bitácoras");
    } finally {
      setLoadingClientDownload((prev) => ({...prev, [clienteNombre]: false}));
    }
  };

  // Función para cargar las bitácoras de un usuario específico con paginación
  const fetchUserBitacoras = async (userName, page = 1, customLimit = null) => {
    try {
      setLoadingUserBitacoras((prev) => ({...prev, [userName]: true}));

      const limit = customLimit || userPageLimits[userName] || 10;
      const url = `${baseUrl}/bitacoras/by-user/${encodeURIComponent(
        userName
      )}?fechaDesde=${encodeURIComponent(appliedFechaDesde)}&fechaHasta=${encodeURIComponent(
        appliedFechaHasta
      )}&lineaTransporte=${encodeURIComponent(
        appliedLineaTransporteFilter
      )}&operador=${encodeURIComponent(appliedOperadorFilter)}&page=${page}&limit=${limit}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUserBitacoras((prev) => ({
          ...prev,
          [userName]: data.bitacoras,
        }));
        setUserPagination((prev) => ({
          ...prev,
          [userName]: data.pagination,
        }));
      } else {
        console.error("Error fetching user bitacoras:", response.statusText);
        setUserBitacoras((prev) => ({
          ...prev,
          [userName]: [],
        }));
        setUserPagination((prev) => ({
          ...prev,
          [userName]: null,
        }));
      }
    } catch (error) {
      console.error("Error fetching user bitacoras:", error);
      setUserBitacoras((prev) => ({
        ...prev,
        [userName]: [],
      }));
      setUserPagination((prev) => ({
        ...prev,
        [userName]: null,
      }));
    } finally {
      setLoadingUserBitacoras((prev) => ({...prev, [userName]: false}));
    }
  };

  // Función para manejar el toggle del dropdown de usuario
  const toggleUserDropdown = (userName) => {
    const isCurrentlyExpanded = expandedUsers[userName];

    setExpandedUsers((prev) => ({
      ...prev,
      [userName]: !isCurrentlyExpanded,
    }));

    // Si se está expandiendo y no tenemos las bitácoras, las cargamos
    if (!isCurrentlyExpanded && !userBitacoras[userName]) {
      const currentLimit = userPageLimits[userName] || 10;
      fetchUserBitacoras(userName, 1, currentLimit);
    }
  };

  // Función para manejar la paginación de bitácoras de usuario
  const handleUserPagination = (userName, page) => {
    const currentLimit = userPageLimits[userName] || 10;
    fetchUserBitacoras(userName, page, currentLimit);
  };

  // Función para manejar el cambio de límite de página para usuarios
  const handleUserPageLimitChange = (userName, newLimit) => {
    setUserPageLimits((prev) => ({...prev, [userName]: newLimit}));
    fetchUserBitacoras(userName, 1, newLimit); // Reset to first page when changing limit
  };

  // Función para descargar bitácoras de usuario en Excel
  const downloadUserBitacorasExcel = async (userName) => {
    try {
      setLoadingUserDownload((prev) => ({...prev, [userName]: true}));

      const url = `${baseUrl}/bitacoras/download-user/${encodeURIComponent(
        userName
      )}?fechaDesde=${encodeURIComponent(appliedFechaDesde)}&fechaHasta=${encodeURIComponent(
        appliedFechaHasta
      )}&lineaTransporte=${encodeURIComponent(
        appliedLineaTransporteFilter
      )}&operador=${encodeURIComponent(appliedOperadorFilter)}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();

        if (data.bitacoras && data.bitacoras.length > 0) {
          // Importar XLSX dinámicamente
          const XLSX = await import("xlsx");

          // Preparar datos para Excel
          const excelData = data.bitacoras.map((bitacora, index) => ({
            "#": index + 1,
            "ID Bitácora": bitacora.bitacora_id,
            "Fecha de Creación": new Date(bitacora.fechaCreacion).toLocaleDateString("es-ES"),
            Cliente: bitacora.cliente,
            "Tipo de Monitoreo": bitacora.tipoMonitoreo,
            "Línea de Transporte": bitacora.lineaTransporte,
            "Operador de Transporte": bitacora.operadorTransporte,
            Origen: bitacora.origen,
            Destino: bitacora.destino,
            Estado: bitacora.estado,
            Usuario: bitacora.usuario,
          }));

          // Crear libro de trabajo
          const workbook = XLSX.utils.book_new();
          const worksheet = XLSX.utils.json_to_sheet(excelData);

          // Ajustar ancho de columnas
          const colWidths = [
            {wch: 5}, // #
            {wch: 15}, // ID Bitácora
            {wch: 18}, // Fecha de Creación
            {wch: 25}, // Cliente
            {wch: 20}, // Tipo de Monitoreo
            {wch: 25}, // Línea de Transporte
            {wch: 25}, // Operador de Transporte
            {wch: 30}, // Origen
            {wch: 30}, // Destino
            {wch: 15}, // Estado
            {wch: 20}, // Usuario
          ];
          worksheet["!cols"] = colWidths;

          // Agregar hoja al libro
          XLSX.utils.book_append_sheet(workbook, worksheet, "Bitácoras");

          // Generar nombre de archivo
          const fechaActual = new Date().toISOString().split("T")[0];
          const filename = `Bitacoras_Usuario_${userName.replace(
            /[^a-zA-Z0-9]/g,
            "_"
          )}_${fechaActual}.xlsx`;

          // Descargar archivo
          XLSX.writeFile(workbook, filename);
        } else {
          alert("No hay bitácoras disponibles para descargar");
        }
      } else {
        console.error("Error downloading user bitacoras:", response.statusText);
        alert("Error al descargar las bitácoras");
      }
    } catch (error) {
      console.error("Error downloading user bitacoras:", error);
      alert("Error al descargar las bitácoras");
    } finally {
      setLoadingUserDownload((prev) => ({...prev, [userName]: false}));
    }
  };

  // Función para cargar las bitácoras de una ubicación específica con paginación
  const fetchLocationBitacoras = async (locationName, page = 1, customLimit = null) => {
    try {
      setLoadingLocationBitacoras((prev) => ({...prev, [locationName]: true}));

      const limit = customLimit || locationPageLimits[locationName] || 10;
      const url = `${baseUrl}/bitacoras/by-location/${encodeURIComponent(
        locationName
      )}?fechaDesde=${encodeURIComponent(appliedFechaDesde)}&fechaHasta=${encodeURIComponent(
        appliedFechaHasta
      )}&lineaTransporte=${encodeURIComponent(
        appliedLineaTransporteFilter
      )}&operador=${encodeURIComponent(appliedOperadorFilter)}&geoType=${encodeURIComponent(
        appliedGeoType
      )}&page=${page}&limit=${limit}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setLocationBitacoras((prev) => ({
          ...prev,
          [locationName]: data.bitacoras,
        }));
        setLocationPagination((prev) => ({
          ...prev,
          [locationName]: data.pagination,
        }));
      } else {
        console.error("Error fetching location bitacoras:", response.statusText);
        setLocationBitacoras((prev) => ({
          ...prev,
          [locationName]: [],
        }));
        setLocationPagination((prev) => ({
          ...prev,
          [locationName]: null,
        }));
      }
    } catch (error) {
      console.error("Error fetching location bitacoras:", error);
      setLocationBitacoras((prev) => ({
        ...prev,
        [locationName]: [],
      }));
      setLocationPagination((prev) => ({
        ...prev,
        [locationName]: null,
      }));
    } finally {
      setLoadingLocationBitacoras((prev) => ({...prev, [locationName]: false}));
    }
  };

  // Función para manejar el toggle del dropdown de ubicación
  const toggleLocationDropdown = (locationName) => {
    const isCurrentlyExpanded = expandedLocations[locationName];

    setExpandedLocations((prev) => ({
      ...prev,
      [locationName]: !isCurrentlyExpanded,
    }));

    // Si se está expandiendo y no tenemos las bitácoras, las cargamos
    if (!isCurrentlyExpanded && !locationBitacoras[locationName]) {
      const currentLimit = locationPageLimits[locationName] || 10;
      fetchLocationBitacoras(locationName, 1, currentLimit);
    }
  };

  // Función para manejar la paginación de bitácoras de ubicación
  const handleLocationPagination = (locationName, page) => {
    const currentLimit = locationPageLimits[locationName] || 10;
    fetchLocationBitacoras(locationName, page, currentLimit);
  };

  // Función para manejar el cambio de límite de página para ubicaciones
  const handleLocationPageLimitChange = (locationName, newLimit) => {
    setLocationPageLimits((prev) => ({...prev, [locationName]: newLimit}));
    fetchLocationBitacoras(locationName, 1, newLimit); // Reset to first page when changing limit
  };

  // Función para descargar bitácoras de ubicación en Excel
  const downloadLocationBitacorasExcel = async (locationName) => {
    try {
      setLoadingLocationDownload((prev) => ({...prev, [locationName]: true}));

      const url = `${baseUrl}/bitacoras/download-location/${encodeURIComponent(
        locationName
      )}?fechaDesde=${encodeURIComponent(appliedFechaDesde)}&fechaHasta=${encodeURIComponent(
        appliedFechaHasta
      )}&lineaTransporte=${encodeURIComponent(
        appliedLineaTransporteFilter
      )}&operador=${encodeURIComponent(appliedOperadorFilter)}&geoType=${encodeURIComponent(
        appliedGeoType
      )}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();

        if (data.bitacoras && data.bitacoras.length > 0) {
          // Importar XLSX dinámicamente
          const XLSX = await import("xlsx");

          // Preparar datos para Excel
          const excelData = data.bitacoras.map((bitacora, index) => ({
            "#": index + 1,
            "ID Bitácora": bitacora.bitacora_id,
            "Fecha de Creación": new Date(bitacora.fechaCreacion).toLocaleDateString("es-ES"),
            Cliente: bitacora.cliente,
            "Tipo de Monitoreo": bitacora.tipoMonitoreo,
            "Línea de Transporte": bitacora.lineaTransporte,
            "Operador de Transporte": bitacora.operadorTransporte,
            Origen: bitacora.origen,
            Destino: bitacora.destino,
            Estado: bitacora.estado,
            Usuario: bitacora.usuario,
          }));

          // Crear libro de trabajo
          const workbook = XLSX.utils.book_new();
          const worksheet = XLSX.utils.json_to_sheet(excelData);

          // Ajustar ancho de columnas
          const colWidths = [
            {wch: 5}, // #
            {wch: 15}, // ID Bitácora
            {wch: 18}, // Fecha de Creación
            {wch: 25}, // Cliente
            {wch: 20}, // Tipo de Monitoreo
            {wch: 25}, // Línea de Transporte
            {wch: 25}, // Operador de Transporte
            {wch: 30}, // Origen
            {wch: 30}, // Destino
            {wch: 15}, // Estado
            {wch: 20}, // Usuario
          ];
          worksheet["!cols"] = colWidths;

          // Agregar hoja al libro
          XLSX.utils.book_append_sheet(workbook, worksheet, "Bitácoras");

          // Generar nombre de archivo
          const fechaActual = new Date().toISOString().split("T")[0];
          const filename = `Bitacoras_${
            appliedGeoType === "origen" ? "Origen" : "Destino"
          }_${locationName.replace(/[^a-zA-Z0-9]/g, "_")}_${fechaActual}.xlsx`;

          // Descargar archivo
          XLSX.writeFile(workbook, filename);
        } else {
          alert("No hay bitácoras disponibles para descargar");
        }
      } else {
        console.error("Error downloading location bitacoras:", response.statusText);
        alert("Error al descargar las bitácoras");
      }
    } catch (error) {
      console.error("Error downloading location bitacoras:", error);
      alert("Error al descargar las bitácoras");
    } finally {
      setLoadingLocationDownload((prev) => ({...prev, [locationName]: false}));
    }
  };

  // Funciones para manejar la paginación geográfica
  const handleGeographicPageChange = (newPage) => {
    setGeographicPage(newPage);
  };

  const handleGeographicPageSizeChange = (newPageSize) => {
    setGeographicPageSize(newPageSize);
    setGeographicPage(1); // Reset to first page when changing page size
  };

  const getPaginatedGeographicData = () => {
    const geographicData = dashboardStats.geographicData || [];

    // Si el tamaño de página es muy grande (9999), mostrar todos los elementos
    if (geographicPageSize >= 9999) {
      return {
        data: geographicData,
        totalItems: geographicData.length,
        totalPages: 1,
        currentPage: 1,
        hasNextPage: false,
        hasPrevPage: false,
      };
    }

    const startIndex = (geographicPage - 1) * geographicPageSize;
    const endIndex = startIndex + geographicPageSize;
    const paginatedData = geographicData.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      totalItems: geographicData.length,
      totalPages: Math.ceil(geographicData.length / geographicPageSize),
      currentPage: geographicPage,
      hasNextPage: endIndex < geographicData.length,
      hasPrevPage: geographicPage > 1,
    };
  };

  const appliedGeoTypeRef = useRef(appliedGeoType);
  useEffect(() => {
    appliedGeoTypeRef.current = appliedGeoType;
  }, [appliedGeoType]);

  const fetchGeographicData = useCallback(
    async (nextGeoType = appliedGeoType) => {
      try {
        setLoadingGeo(true);
        const commonParams = `clientFilter=${encodeURIComponent(
          appliedClientFilter
        )}&fechaDesde=${encodeURIComponent(appliedFechaDesde)}&fechaHasta=${encodeURIComponent(
          appliedFechaHasta
        )}&lineaTransporte=${encodeURIComponent(
          appliedLineaTransporteFilter
        )}&operador=${encodeURIComponent(appliedOperadorFilter)}`;

        const geoUrl = `${baseUrl}/dashboard/geographic-stats?${commonParams}&geoType=${encodeURIComponent(
          nextGeoType
        )}`;
        const response = await fetch(geoUrl, {method: "GET", credentials: "include"});

        if (response.ok) {
          const geoData = await response.json();
          setDashboardStats((prev) => ({...prev, geographicData: geoData}));
          setAppliedGeoType(nextGeoType);
        }
      } catch (error) {
        console.error("Error fetching geographic data:", error);
      } finally {
        setLoadingGeo(false);
      }
    },
    [
      baseUrl,
      appliedClientFilter,
      appliedFechaDesde,
      appliedFechaHasta,
      appliedLineaTransporteFilter,
      appliedOperadorFilter,
      appliedGeoType,
    ]
  );

  const controllersRef = useRef({});

  const getAbortSignal = (key) => {
    if (controllersRef.current[key]) {
      controllersRef.current[key].abort();
    }
    controllersRef.current[key] = new AbortController();
    return controllersRef.current[key].signal;
  };

  const fetchDashboardData = useCallback(async () => {
    // Initial full-page loading only on first mount
    // Subsquent updates will use individual skeleton loaders
    const isInitialLoad = loading;
    
    const commonParams = `clientFilter=${encodeURIComponent(
      appliedClientFilter
    )}&fechaDesde=${encodeURIComponent(appliedFechaDesde)}&fechaHasta=${encodeURIComponent(
      appliedFechaHasta
    )}&lineaTransporte=${encodeURIComponent(
      appliedLineaTransporteFilter
    )}&operador=${encodeURIComponent(appliedOperadorFilter)}`;

    const fetchGranular = async (key, endpoint, loadingSetter) => {
      const signal = getAbortSignal(key);
      try {
        if (!isInitialLoad) loadingSetter(true);
        const response = await fetch(`${baseUrl}${endpoint}?${commonParams}`, {
          method: "GET",
          credentials: "include",
          signal
        });
        if (response.ok) {
          const data = await response.json();
          setDashboardStats(prev => ({ ...prev, ...data }));
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(`Error fetching ${key}:`, error);
        }
      } finally {
        if (!isInitialLoad) loadingSetter(false);
      }
    };

    try {
      if (isInitialLoad) setLoading(true);

      // Execute all granular fetches in parallel without awaiting the whole group if not initial load
      const tasks = [
        fetchGranular('summary', '/dashboard/summary', setLoadingSummary),
        fetchGranular('trends', '/dashboard/trends', setLoadingTrends),
        fetchGranular('rankings', '/dashboard/rankings', setLoadingRankings),
        fetchGranular('events', '/dashboard/event-stats', setLoadingEvents),
        fetchGranular('performance', '/dashboard/performance', setLoadingPerformance),
        fetchGeographicData(appliedGeoTypeRef.current)
      ];

      if (isInitialLoad) {
        await Promise.all(tasks);
      }
    } catch (error) {
      console.error("Error in fetchDashboardData:", error);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, [
    baseUrl,
    appliedClientFilter,
    appliedFechaDesde,
    appliedFechaHasta,
    appliedLineaTransporteFilter,
    appliedOperadorFilter,
    fetchGeographicData,
    loading
  ]);

  // Fetch role permissions once on mount
  useEffect(() => {
    if (!user?.role) return;
    fetch(`${baseUrl}/roles/${user.role}`, {method: "GET", credentials: "include"})
      .then((r) => r.json())
      .then(setRoleData)
      .catch(() => {});
  }, [baseUrl, user?.role]);

  // Fetch available clients once after roleData is ready
  useEffect(() => {
    if (!roleData) return;
    fetch(`${baseUrl}/clients`, {method: "GET", credentials: "include"})
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setAvailableClients(getAllowedClients(roleData, data)))
      .catch(() => {});
  }, [baseUrl, roleData]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchDashboardData();
  }, [user, navigate, fetchDashboardData, applyFiltersTrigger]);

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      Object.values(controllersRef.current).forEach(c => c.abort());
    };
  }, []);

  // Update transport lines when client filter changes
  useEffect(() => {
    if (user) {
      fetchLineasTransporte(clientFilter);
    }
  }, [user, clientFilter, fetchLineasTransporte]);

  // Update operators when transport line filter changes
  useEffect(() => {
    if (user) {
      fetchOperadores(lineaTransporteFilter);
    }
  }, [user, lineaTransporteFilter, fetchOperadores]);

  // Chart rendering functions
  const renderEventDistributionChart = () => {
    if (loadingEvents) {
      return (
        <div className="d-flex flex-column gap-3 py-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} height="35px" />
          ))}
        </div>
      );
    }
    const eventDistribution = dashboardStats.eventDistribution || [];
    if (eventDistribution.length === 0) {
      return (
        <div className="text-center py-4 text-muted">
          <p className="small mb-0">No hay datos de eventos</p>
        </div>
      );
    }

    return (
      <div className="event-distribution-list">
        {eventDistribution.map((event, index) => (
          <div key={index} className="mb-3">
            <div className="d-flex justify-content-between mb-1">
              <span className="small fw-bold">{event.name}</span>
              <span className="small text-muted">{event.count}</span>
            </div>
            <div className="progress" style={{ height: "6px" }}>
              <div
                className="progress-bar"
                role="progressbar"
                style={{
                  width: `${(event.count / eventDistribution[0].count) * 100}%`,
                  backgroundColor: event.color || "#3b82f6",
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPerformanceChart = () => {
    if (loadingPerformance) {
      return (
        <div className="d-flex flex-column gap-3 py-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} height="35px" />
          ))}
        </div>
      );
    }
    const operatorEfficiency = dashboardStats.operatorEfficiency || [];
    if (operatorEfficiency.length === 0) {
      return (
        <div className="text-center py-4 text-muted">
          <p className="small mb-0">No hay datos de rendimiento</p>
        </div>
      );
    }

    return (
      <div className="performance-list">
        {operatorEfficiency.map((op, index) => {
          const rate = op.total > 0 ? Math.round((op.completed / op.total) * 100) : 0;
          return (
            <div key={index} className="mb-3">
              <div className="d-flex justify-content-between mb-1">
                <span className="small fw-bold">{op.name || "N/A"}</span>
                <span className="small text-muted">{rate}% ({op.completed}/{op.total})</span>
              </div>
              <div className="progress" style={{ height: "6px" }}>
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{
                    width: `${rate}%`,
                    backgroundColor: rate > 80 ? "#10b981" : rate > 50 ? "#f59e0b" : "#ef4444",
                  }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTiposMonitoreoChart = () => {
    const tiposMonitoreo = dashboardStats.tiposMonitoreo || [];

    if (tiposMonitoreo.length === 0) {
      return (
        <div className="text-center py-4 text-muted">
          <i className="fa fa-info-circle mb-2 opacity-50" style={{ fontSize: '1.5rem' }}></i>
          <p className="small mb-0">No hay datos disponibles</p>
        </div>
      );
    }

    const total = tiposMonitoreo.reduce((sum, tipo) => sum + tipo.count, 0);
    
    // Icon mapping for common monitoring types
    const getTipoIcon = (nombre) => {
      const lower = (nombre || "").toLowerCase();
      if (lower.includes("gps")) return "fa-satellite";
      if (lower.includes("custodia")) return "fa-shield-alt";
      if (lower.includes("escolta")) return "fa-user-shield";
      if (lower.includes("dedicado")) return "fa-truck-loading";
      if (lower.includes("spot")) return "fa-map-marker-alt";
      return "fa-broadcast-tower";
    };

    return (
      <div className="tipos-monitoreo-chart">
        <div className="tipos-list">
          {tiposMonitoreo.map((tipo, index) => {
            const percentage = (tipo.count / total) * 100;
            return (
              <div key={index} className="tipo-item-modern">
                <div className="tipo-info-header">
                  <div className="tipo-label-group">
                    <div className="tipo-icon-box" style={{ backgroundColor: `${tipo.color}15`, color: tipo.color }}>
                      <i className={`fa ${getTipoIcon(tipo.nombre)}`}></i>
                    </div>
                    <span className="tipo-name-text">{tipo.nombre}</span>
                  </div>
                  <div className="tipo-stats-group">
                    <span className="tipo-count-text">{formatNumber(tipo.count)}</span>
                    <span className="tipo-percentage-text">{percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="tipo-progress-wrapper">
                  <div className="bar-container-modern">
                    <div
                      className="bar-fill-modern"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: tipo.color || "#3b82f6",
                        boxShadow: `0 0 10px ${tipo.color}40`
                      }}>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonthlyTrendChart = () => {
    if (loadingTrends) {
      return (
        <div className="d-flex flex-column gap-3 py-4 px-2">
          <Skeleton height="200px" />
          <div className="d-flex justify-content-between">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} width="40px" height="12px" />
            ))}
          </div>
        </div>
      );
    }
    const monthlyData = dashboardStats.monthlyData || [];

    if (!monthlyData || monthlyData.length === 0) {
      return (
        <div className="text-center py-5">
          <i className="fa fa-chart-bar mb-3 opacity-20" style={{ fontSize: "3rem" }}></i>
          <p className="text-muted">No hay datos disponibles para el período seleccionado</p>
        </div>
      );
    }

    const maxValue = Math.max(...monthlyData.map((d) => d.value));
    const totalValue = monthlyData.reduce((sum, item) => sum + item.value, 0);
    const monthsWithData = monthlyData.filter((item) => item.value > 0).length;
    const average = monthsWithData > 0 ? Math.round(totalValue / monthsWithData) : 0;

    return (
      <div className="trend-chart-container">
        <div className="trend-chart">
          {/* Background Grid */}
          <div className="chart-grid">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="grid-line">
                <span>{maxValue > 0 ? formatNumber(Math.round((maxValue * (4 - i)) / 4)) : ""}</span>
              </div>
            ))}
          </div>

          <div className="chart-bars">
            {monthlyData.map((item, index) => {
              const barHeight = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
              const isPeak = item.value === maxValue && maxValue > 0;
              return (
                <div key={index} className="chart-bar-wrap">
                  <div className="chart-bar-fill-container">
                    <div
                      className={`chart-bar-fill ${isPeak ? 'peak' : ''}`}
                      style={{ height: `${barHeight}%` }}
                    >
                      {item.value > 0 && (
                        <div className="bar-tooltip">
                          {formatNumber(item.value)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="chart-bar-info">
                    <span className="bar-label">{item.month}</span>
                    {item.year && <span className="bar-year">'{item.year.toString().slice(-2)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="chart-summary-row mt-3">
          <div className="chart-summary-item">
            <span className="summary-label">Total Período</span>
            <span className="summary-value">{formatNumber(totalValue)}</span>
          </div>
          <div className="chart-summary-item">
            <span className="summary-label">Promedio Mensual</span>
            <span className="summary-value">{formatNumber(average)}</span>
          </div>
          <div className="chart-summary-item">
            <span className="summary-label">Meses Activos</span>
            <span className="summary-value">{monthsWithData}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderGeographicChart = () => {
    if (loadingGeo) {
      return (
        <div className="d-flex flex-column gap-3 py-4 px-2">
          <Skeleton height="250px" />
          <div className="d-flex flex-column gap-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} height="15px" />
            ))}
          </div>
        </div>
      );
    }
    const geographicData = dashboardStats.geographicData || [];
    const paginatedGeographic = getPaginatedGeographicData();

    if (!geographicData || geographicData.length === 0) {
      return <div className="text-center text-muted py-5">No hay datos disponibles</div>;
    }

    return (
      <div className="geographic-chart position-relative">
        {loadingGeo && (
          <div 
            className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" 
            style={{ 
              background: "rgba(255,255,255,0.7)", 
              zIndex: 10,
              borderRadius: "12px"
            }}>
            <i className="fa fa-spinner fa-spin text-primary"></i>
          </div>
        )}
        <div className="d-flex align-items-center justify-content-between mb-3 px-1">
          <div className="d-flex align-items-center gap-2">
            <span
              className="badge"
              style={{
                backgroundColor: appliedGeoType === "origen" ? "#10b981" : "#f59e0b",
                color: "#fff",
                fontSize: "0.65rem",
                padding: "3px 8px",
                borderRadius: "6px"
              }}>
              {appliedGeoType === "origen" ? "Origen" : "Destino"}
            </span>
            <span className="text-muted" style={{fontSize: "0.7rem"}}>Total: {geographicData.length}</span>
          </div>
          <div className="d-flex align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted" style={{fontSize: "0.7rem"}}>Mostrar:</span>
              <select
                value={geographicPageSize}
                onChange={(e) => handleGeographicPageSizeChange(parseInt(e.target.value))}
                className="form-select form-select-sm py-0"
                style={{
                  width: "70px",
                  fontSize: "0.7rem",
                  height: "24px",
                  borderRadius: "6px",
                  borderColor: "#e2e8f0"
                }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={9999}>Todas</option>
              </select>
            </div>
            <select
              value={geoType}
              onChange={(e) => {
                const nextGeo = e.target.value;
                setGeoType(nextGeo);
                setGeographicPage(1);
                fetchGeographicData(nextGeo);
              }}
              className="form-select form-select-sm py-0"
              style={{
                width: "110px",
                fontSize: "0.75rem",
                height: "28px",
                borderRadius: "8px",
                fontWeight: "600",
                color: geoType === "origen" ? "#10b981" : "#f59e0b",
                borderColor: "#e2e8f0"
              }}>
              <option value="origen">Origen</option>
              <option value="destino">Destino</option>
            </select>
          </div>
        </div>

        {/* Lista de ubicaciones paginada */}
        <div className="geo-items custom-scrollbar">
          {paginatedGeographic.data.map((location, index) => {
            const percentage = Math.round(
              (location.count / geographicData.reduce((sum, loc) => sum + loc.count, 0)) * 100
            );
            const isExpanded = expandedLocations[location.name];
            const bitacoras = locationBitacoras[location.name] || [];
            const isLoading = loadingLocationBitacoras[location.name];

            return (
              <div key={index} className="location-dropdown-item">
                {/* Header de la ubicación - clickeable para expandir */}
                <div
                  className="geo-item"
                  onClick={() => toggleLocationDropdown(location.name)}
                  style={{cursor: "pointer", transition: "all 0.2s ease"}}>
                  <div
                    className="geo-icon"
                    style={{background: appliedGeoType === "origen" ? "#10b981" : "#f59e0b"}}>
                    <i className="fa fa-map-marker-alt" style={{color: "#fff"}}></i>
                  </div>
                  <div className="geo-info">
                    <div className="geo-name">
                      {location.name}
                    </div>
                    <div className="geo-count">
                      {formatNumber(location.count)} bitácoras
                    </div>
                  </div>
                  <div className="geo-percentage-container">
                    <div className="geo-percentage">
                      {percentage}%
                    </div>
                    {/* Botón de descarga */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadLocationBitacorasExcel(location.name);
                      }}
                      disabled={loadingLocationDownload[location.name]}
                      className="download-btn"
                      title="Descargar bitácoras en Excel">
                      <i
                        className={
                          loadingLocationDownload[location.name]
                            ? "fa fa-spinner fa-spin"
                            : "fa fa-file-excel"
                        }></i>
                    </button>
                    <div className="expand-icon">
                      <i className={`fa fa-chevron-${isExpanded ? "up" : "down"}`}></i>
                    </div>
                  </div>
                </div>

                {/* Contenido expandible con las bitácoras */}
                {isExpanded && (
                  <div className="location-bitacoras-list">
                    {isLoading ? (
                      <div className="d-flex flex-column gap-2 py-3">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} height="35px" />
                        ))}
                      </div>
                    ) : bitacoras && bitacoras.length > 0 ? (
                      <div>
                        <div className="bitacoras-header">
                          <i className="fa fa-list-ul"></i>
                          Bitácoras ({bitacoras.length})
                        </div>
                        <div className="bitacoras-table-container custom-scrollbar">
                          <table>
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Fecha</th>
                                <th>Cliente</th>
                                <th>Monitoreo</th>
                                <th>Línea</th>
                                <th>Operador</th>
                                <th>Origen</th>
                                <th>Destino</th>
                                <th>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bitacoras.map((bitacora, bitIndex) => (
                                <tr key={bitIndex} onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/bitacora/${bitacora._id}`);
                                }}>
                                  <td className="bitacora-id">
                                    <span className="bitacora-id-chip">#{bitacora.bitacora_id}</span>
                                  </td>
                                  <td>{new Date(bitacora.fechaCreacion).toLocaleDateString("es-ES", {day: "2-digit", month: "2-digit", year: "numeric"})}</td>
                                  <td>{bitacora.cliente}</td>
                                  <td>{bitacora.tipoMonitoreo}</td>
                                  <td>{bitacora.lineaTransporte || "N/A"}</td>
                                  <td>{bitacora.operadorTransporte || "N/A"}</td>
                                  <td title={bitacora.origen}>{bitacora.origen || "N/A"}</td>
                                  <td title={bitacora.destino}>{bitacora.destino || "N/A"}</td>
                                  <td>
                                    <span className={`status-badge ${bitacora.estado}`}>
                                      {bitacora.estado}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {locationPagination[location.name] && locationPagination[location.name].totalPages > 1 && (
                          <div className="pagination-controls">
                            <span className="pagination-info">
                              Pág. {locationPagination[location.name].currentPage} de {locationPagination[location.name].totalPages}
                            </span>
                            <div className="btn-group">
                              <button
                                className="pagination-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLocationPagination(location.name, locationPagination[location.name].currentPage - 1);
                                }}
                                disabled={!locationPagination[location.name].hasPrevPage || isLoading}
                              >
                                <i className="fa fa-chevron-left"></i>
                              </button>
                              <button
                                className="pagination-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLocationPagination(location.name, locationPagination[location.name].currentPage + 1);
                                }}
                                disabled={!locationPagination[location.name].hasNextPage || isLoading}
                              >
                                <i className="fa fa-chevron-right"></i>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <span style={{fontSize: "12px", color: "#94a3b8"}}>
                          No hay bitácoras disponibles para esta ubicación
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Controles de paginación elegantes */}
        {paginatedGeographic.totalItems > 0 && geographicPageSize < 9999 && (
          <div className="mt-4">
            <div
              className="d-flex justify-content-between align-items-center p-3"
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(16, 24, 40, 0.1)",
              }}>
              {/* Información de paginación */}
              <div className="d-flex align-items-center gap-3">
                <span
                  className="text-muted"
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "500",
                  }}>
                  Mostrando{" "}
                  <span className="fw-bold text-dark">
                    {(geographicPage - 1) * geographicPageSize + 1}
                  </span>{" "}
                  a{" "}
                  <span className="fw-bold text-dark">
                    {Math.min(geographicPage * geographicPageSize, paginatedGeographic.totalItems)}
                  </span>{" "}
                  de <span className="fw-bold text-dark">{paginatedGeographic.totalItems}</span>{" "}
                  ubicaciones
                </span>
              </div>

              {/* Controles de navegación */}
              <div className="d-flex align-items-center gap-2">
                {/* Botón anterior */}
                <button
                  onClick={() => handleGeographicPageChange(geographicPage - 1)}
                  disabled={!paginatedGeographic.hasPrevPage}
                  className="btn btn-sm"
                  style={{
                    backgroundColor: paginatedGeographic.hasPrevPage ? "#ffffff" : "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: paginatedGeographic.hasPrevPage ? "pointer" : "not-allowed",
                    color: paginatedGeographic.hasPrevPage ? "#374151" : "#9ca3af",
                    transition: "all 0.2s ease",
                    boxShadow: paginatedGeographic.hasPrevPage
                      ? "0 1px 2px rgba(16, 24, 40, 0.05)"
                      : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (paginatedGeographic.hasPrevPage) {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (paginatedGeographic.hasPrevPage) {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                      e.currentTarget.style.transform = "translateY(0)";
                    }
                  }}>
                  <i className="fa fa-chevron-left" style={{fontSize: "12px"}}></i>
                </button>

                {/* Números de página */}
                <div className="d-flex gap-1">
                  {(() => {
                    const pages = [];
                    const totalPages = paginatedGeographic.totalPages;
                    const currentPage = paginatedGeographic.currentPage;
                    let startPage = Math.max(1, currentPage - 2);
                    let endPage = Math.min(totalPages, currentPage + 2);

                    // Ajustar para mostrar siempre 5 páginas si es posible
                    if (endPage - startPage < 4) {
                      if (startPage === 1) {
                        endPage = Math.min(totalPages, startPage + 4);
                      } else {
                        startPage = Math.max(1, endPage - 4);
                      }
                    }

                    // Primera página si no está visible
                    if (startPage > 1) {
                      pages.push(
                        <button
                          key={1}
                          onClick={() => handleGeographicPageChange(1)}
                          className="btn btn-sm"
                          style={{
                            backgroundColor: "#ffffff",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            width: "36px",
                            height: "36px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            color: "#374151",
                            fontSize: "0.8rem",
                            fontWeight: "500",
                            transition: "all 0.2s ease",
                            boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f8fafc";
                            e.currentTarget.style.transform = "translateY(-1px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#ffffff";
                            e.currentTarget.style.transform = "translateY(0)";
                          }}>
                          1
                        </button>
                      );
                      if (startPage > 2) {
                        pages.push(
                          <span
                            key="dots1"
                            className="d-flex align-items-center"
                            style={{color: "#9ca3af", fontSize: "0.8rem", padding: "0 8px"}}>
                            ...
                          </span>
                        );
                      }
                    }

                    // Páginas del rango
                    for (let page = startPage; page <= endPage; page++) {
                      const isActive = page === currentPage;
                      pages.push(
                        <button
                          key={page}
                          onClick={() => handleGeographicPageChange(page)}
                          className="btn btn-sm"
                          style={{
                            backgroundColor: isActive
                              ? appliedGeoType === "origen"
                                ? "#10b981"
                                : "#f59e0b"
                              : "#ffffff",
                            border: `1px solid ${
                              isActive
                                ? appliedGeoType === "origen"
                                  ? "#10b981"
                                  : "#f59e0b"
                                : "#e2e8f0"
                            }`,
                            borderRadius: "8px",
                            width: "36px",
                            height: "36px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            color: isActive ? "#ffffff" : "#374151",
                            fontSize: "0.8rem",
                            fontWeight: isActive ? "600" : "500",
                            transition: "all 0.2s ease",
                            boxShadow: isActive
                              ? "0 2px 4px rgba(16, 24, 40, 0.1)"
                              : "0 1px 2px rgba(16, 24, 40, 0.05)",
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor = "#f8fafc";
                              e.currentTarget.style.transform = "translateY(-1px)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor = "#ffffff";
                              e.currentTarget.style.transform = "translateY(0)";
                            }
                          }}>
                          {page}
                        </button>
                      );
                    }

                    // Última página si no está visible
                    if (endPage < totalPages) {
                      if (endPage < totalPages - 1) {
                        pages.push(
                          <span
                            key="dots2"
                            className="d-flex align-items-center"
                            style={{color: "#9ca3af", fontSize: "0.8rem", padding: "0 8px"}}>
                            ...
                          </span>
                        );
                      }
                      pages.push(
                        <button
                          key={totalPages}
                          onClick={() => handleGeographicPageChange(totalPages)}
                          className="btn btn-sm"
                          style={{
                            backgroundColor: "#ffffff",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            width: "36px",
                            height: "36px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            color: "#374151",
                            fontSize: "0.8rem",
                            fontWeight: "500",
                            transition: "all 0.2s ease",
                            boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f8fafc";
                            e.currentTarget.style.transform = "translateY(-1px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#ffffff";
                            e.currentTarget.style.transform = "translateY(0)";
                          }}>
                          {totalPages}
                        </button>
                      );
                    }

                    return pages;
                  })()}
                </div>

                {/* Botón siguiente */}
                <button
                  onClick={() => handleGeographicPageChange(geographicPage + 1)}
                  disabled={!paginatedGeographic.hasNextPage}
                  className="btn btn-sm"
                  style={{
                    backgroundColor: paginatedGeographic.hasNextPage ? "#ffffff" : "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: paginatedGeographic.hasNextPage ? "pointer" : "not-allowed",
                    color: paginatedGeographic.hasNextPage ? "#374151" : "#9ca3af",
                    transition: "all 0.2s ease",
                    boxShadow: paginatedGeographic.hasNextPage
                      ? "0 1px 2px rgba(16, 24, 40, 0.05)"
                      : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (paginatedGeographic.hasNextPage) {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (paginatedGeographic.hasNextPage) {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                      e.currentTarget.style.transform = "translateY(0)";
                    }
                  }}>
                  <i className="fa fa-chevron-right" style={{fontSize: "12px"}}></i>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGeographicBarChart = () => {
    if (loadingGeo) {
      return (
        <div className="d-flex flex-column gap-3 py-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} height="30px" />
          ))}
        </div>
      );
    }
    const geographicData = dashboardStats.geographicData || [];

    if (!geographicData || geographicData.length === 0) {
      return <div className="text-center text-muted">No hay datos geográficos disponibles</div>;
    }

    return (
      <div className="geographic-bar-chart position-relative">
        {loadingGeo && (
          <div 
            className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" 
            style={{ 
              background: "rgba(255,255,255,0.7)", 
              zIndex: 10,
              borderRadius: "12px"
            }}>
            <i className="fa fa-spinner fa-spin text-primary"></i>
          </div>
        )}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <span
              className="badge"
              style={{
                backgroundColor: appliedGeoType === "origen" ? "#10b981" : "#f59e0b",
                color: "#fff",
                fontSize: "0.75rem",
              }}>
              {appliedGeoType === "origen" ? "Origen" : "Destino"}
            </span>
          </div>
          <select
            value={geoType}
            onChange={(e) => {
              const nextGeo = e.target.value;
              setGeoType(nextGeo);
              fetchGeographicData(nextGeo);
            }}
            className={`filter-select geo-type-select ${geoType} form-select form-select-sm`}
            style={{
              width: 120,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: geoType === "origen" ? "#10b981" : "#f59e0b",
              fontWeight: 600,
              boxShadow: "0 2px 8px rgba(16,24,40,0.06)",
              padding: "6px 12px",
              outline: "none",
              transition: "border-color 0.2s",
              fontSize: "0.8rem",
            }}>
            <option value="origen">Por Origen</option>
            <option value="destino">Por Destino</option>
          </select>
        </div>

        <div className="horizontal-bar-chart-container">
          {geographicData.map((location, index) => {
            const maxCount = Math.max(...geographicData.map((loc) => loc.count));
            const barWidth = maxCount > 0 ? (location.count / maxCount) * 100 : 0;
            const color = appliedGeoType === "origen" ? "#10b981" : "#f59e0b";

            return (
              <div key={index} className="horizontal-bar-item">
                <div className="bar-label">{location.name}</div>
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: color,
                      boxShadow: `0 0 8px ${color}40`
                    }}></div>
                </div>
                <div className="bar-value" style={{ color: color }}>
                  {formatNumber(location.count)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTopClients = () => {
    if (loadingRankings) {
      return (
        <div className="d-flex flex-column gap-2 p-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} height="40px" />
          ))}
        </div>
      );
    }
    const {topClients} = dashboardStats;
    const totalClients =
      topClients && topClients.length > 0
        ? topClients.reduce((sum, client) => sum + client.count, 0)
        : 0;

    return (
      <div className="top-performers custom-scrollbar">
        {topClients && topClients.length > 0 ? (
          topClients.map((client, index) => {
            const percentage =
              totalClients > 0 ? Math.round((client.count / totalClients) * 100) : 0;
            const isExpanded = expandedClients[client.nombre];
            const bitacoras = clientBitacoras[client.nombre] || [];
            const isLoading = loadingClientBitacoras[client.nombre];

            return (
              <div key={index} className="client-dropdown-item">
                <div
                  className="performer-item"
                  onClick={() => toggleClientDropdown(client.nombre)}
                >
                  <div className="performer-rank">#{index + 1}</div>
                  <div className="performer-info">
                    <div className="performer-name">{client.nombre}</div>
                    <div className="performer-stats">
                      {formatNumber(client.count)} bitácoras
                    </div>
                  </div>
                  <div className="performer-score-container">
                    <div className="performer-score">{percentage}%</div>
                    <button
                      className="download-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadClientBitacorasExcel(client.nombre);
                      }}
                      disabled={loadingClientDownload[client.nombre]}
                      title="Descargar bitácoras en Excel"
                    >
                      <i
                        className={
                          loadingClientDownload[client.nombre]
                            ? "fa fa-spinner fa-spin"
                            : "fa fa-file-excel"
                        }
                      ></i>
                    </button>
                    <div className="expand-icon">
                      <i className={`fa fa-chevron-${isExpanded ? "up" : "down"}`}></i>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="client-bitacoras-list">
                    {isLoading ? (
                      <div className="d-flex flex-column gap-2 py-3 px-3">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} height="35px" />
                        ))}
                      </div>
                    ) : bitacoras && bitacoras.length > 0 ? (
                      <div>
                        <div className="bitacoras-header">
                          <i className="fa fa-list-ul"></i>
                          Bitácoras ({bitacoras.length})
                        </div>
                        <div className="bitacoras-table-container custom-scrollbar">
                          <table>
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Fecha</th>
                                <th>Monitoreo</th>
                                <th>Línea</th>
                                <th>Origen</th>
                                <th>Destino</th>
                                <th>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bitacoras.map((bitacora, bIdx) => (
                                <tr key={bIdx} onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/bitacora/${bitacora._id}`);
                                }}>
                                  <td className="bitacora-id">
                                    <span className="bitacora-id-chip">#{bitacora.bitacora_id}</span>
                                  </td>
                                  <td>{new Date(bitacora.fechaCreacion).toLocaleDateString("es-ES", {day: "2-digit", month: "2-digit", year: "numeric"})}</td>
                                  <td>{bitacora.tipoMonitoreo}</td>
                                  <td>{bitacora.lineaTransporte || "N/A"}</td>
                                  <td title={bitacora.origen}>{bitacora.origen || "N/A"}</td>
                                  <td title={bitacora.destino}>{bitacora.destino || "N/A"}</td>
                                  <td>
                                    <span className={`status-badge ${bitacora.estado}`}>
                                      {bitacora.estado}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {clientPagination[client.nombre] && clientPagination[client.nombre].totalPages > 1 && (
                          <div className="pagination-controls">
                            <span className="pagination-info">
                              Pág. {clientPagination[client.nombre].currentPage} de {clientPagination[client.nombre].totalPages}
                            </span>
                            <div className="btn-group">
                              <button
                                className="pagination-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClientPagination(client.nombre, clientPagination[client.nombre].currentPage - 1);
                                }}
                                disabled={!clientPagination[client.nombre].hasPrevPage || isLoading}
                              >
                                <i className="fa fa-chevron-left"></i>
                              </button>
                              <button
                                className="pagination-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClientPagination(client.nombre, clientPagination[client.nombre].currentPage + 1);
                                }}
                                disabled={!clientPagination[client.nombre].hasNextPage || isLoading}
                              >
                                <i className="fa fa-chevron-right"></i>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-muted" style={{fontSize: "12px"}}>
                        No se encontraron bitácoras para este cliente.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-5">
            <i className="fa fa-users opacity-10 mb-2" style={{fontSize: "2rem"}}></i>
            <p className="text-muted small">No hay datos de clientes disponibles</p>
          </div>
        )}
      </div>
    );
  };

  const renderTopOperadores = () => {
    if (loadingRankings) {
      return (
        <div className="d-flex flex-column gap-2 p-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} height="40px" />
          ))}
        </div>
      );
    }
    const {topOperadores} = dashboardStats;
    const totalOperadores =
      topOperadores && topOperadores.length > 0
        ? topOperadores.reduce((sum, operador) => sum + operador.count, 0)
        : 0;

    return (
      <div className="top-performers custom-scrollbar">
        {topOperadores && topOperadores.length > 0 ? (
          topOperadores.map((operador, index) => {
            const percentage =
              totalOperadores > 0 ? Math.round((operador.count / totalOperadores) * 100) : 0;
            const isExpanded = expandedUsers[operador.name];
            const bitacoras = userBitacoras[operador.name] || [];
            const isLoading = loadingUserBitacoras[operador.name];

            return (
              <div key={index} className="client-dropdown-item">
                <div
                  className="performer-item"
                  onClick={() => toggleUserDropdown(operador.name)}
                >
                  <div className="performer-rank">#{index + 1}</div>
                  <div className="performer-info">
                    <div className="performer-name">{operador.name}</div>
                    <div className="performer-stats">
                      {formatNumber(operador.count)} bitácoras
                    </div>
                  </div>
                  <div className="performer-score-container">
                    <div className="performer-score">{percentage}%</div>
                    <button
                      className="download-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadUserBitacorasExcel(operador.name);
                      }}
                      disabled={loadingUserDownload[operador.name]}
                      title="Descargar bitácoras en Excel"
                    >
                      <i
                        className={
                          loadingUserDownload[operador.name]
                            ? "fa fa-spinner fa-spin"
                            : "fa fa-file-excel"
                        }
                      ></i>
                    </button>
                    <div className="expand-icon">
                      <i className={`fa fa-chevron-${isExpanded ? "up" : "down"}`}></i>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="client-bitacoras-list">
                    {isLoading ? (
                      <div className="d-flex flex-column gap-2 py-3 px-3">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} height="35px" />
                        ))}
                      </div>
                    ) : bitacoras && bitacoras.length > 0 ? (
                      <div>
                        <div className="bitacoras-header">
                          <i className="fa fa-list-ul"></i>
                          Bitácoras ({bitacoras.length})
                        </div>
                        <div className="bitacoras-table-container custom-scrollbar">
                          <table>
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Fecha</th>
                                <th>Cliente</th>
                                <th>Monitoreo</th>
                                <th>Línea</th>
                                <th>Origen</th>
                                <th>Destino</th>
                                <th>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bitacoras.map((bitacora, bIdx) => (
                                <tr key={bIdx} onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/bitacora/${bitacora._id}`);
                                }}>
                                  <td className="bitacora-id">
                                    <span className="bitacora-id-chip">#{bitacora.bitacora_id}</span>
                                  </td>
                                  <td>{new Date(bitacora.fechaCreacion).toLocaleDateString("es-ES", {day: "2-digit", month: "2-digit", year: "numeric"})}</td>
                                  <td>{bitacora.cliente}</td>
                                  <td>{bitacora.tipoMonitoreo}</td>
                                  <td>{bitacora.lineaTransporte || "N/A"}</td>
                                  <td title={bitacora.origen}>{bitacora.origen || "N/A"}</td>
                                  <td title={bitacora.destino}>{bitacora.destino || "N/A"}</td>
                                  <td>
                                    <span className={`status-badge ${bitacora.estado}`}>
                                      {bitacora.estado}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {userPagination[operador.name] && userPagination[operador.name].totalPages > 1 && (
                          <div className="pagination-controls">
                            <span className="pagination-info">
                              Pág. {userPagination[operador.name].currentPage} de {userPagination[operador.name].totalPages}
                            </span>
                            <div className="btn-group">
                              <button
                                className="pagination-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUserPagination(operador.name, userPagination[operador.name].currentPage - 1);
                                }}
                                disabled={!userPagination[operador.name].hasPrevPage || isLoading}
                              >
                                <i className="fa fa-chevron-left"></i>
                              </button>
                              <button
                                className="pagination-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUserPagination(operador.name, userPagination[operador.name].currentPage + 1);
                                }}
                                disabled={!userPagination[operador.name].hasNextPage || isLoading}
                              >
                                <i className="fa fa-chevron-right"></i>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-muted" style={{fontSize: "12px"}}>
                        No se encontraron bitácoras para este operador.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-5">
            <i className="fa fa-users opacity-10 mb-2" style={{fontSize: "2rem"}}></i>
            <p className="text-muted small">No hay datos de operadores disponibles</p>
          </div>
        )}
      </div>
    );
  };

  const renderUsuariosBarChart = () => {
    if (loadingRankings) {
      return (
        <div className="d-flex flex-column gap-3 py-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} height="30px" />
          ))}
        </div>
      );
    }
    const {topOperadores} = dashboardStats;

    if (!topOperadores || topOperadores.length === 0) {
      return <div className="text-center text-muted">No hay datos de usuarios disponibles</div>;
    }

    const maxCount = Math.max(...topOperadores.map((operador) => operador.count));

    return (
      <div className="horizontal-bar-chart-container">
        {topOperadores.map((operador, index) => {
          const barWidth = maxCount > 0 ? (operador.count / maxCount) * 100 : 0;
          const colors = [
            "#3b82f6",
            "#10b981",
            "#f59e0b",
            "#ef4444",
            "#8b5cf6",
            "#06b6d4",
            "#84cc16",
            "#f97316",
            "#ec4899",
            "#6366f1",
          ];
          const color = colors[index % colors.length];

          return (
            <div key={index} className="horizontal-bar-item">
              <div className="bar-label">{operador.name}</div>
              <div className="bar-container">
                <div
                  className="bar-fill"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: color,
                    boxShadow: `0 0 8px ${color}40`
                  }}></div>
              </div>
              <div className="bar-value" style={{ color: color }}>
                {formatNumber(operador.count)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTopLineasTransporte = () => {
    if (loadingRankings) {
      return (
        <div className="d-flex flex-column gap-2 p-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} height="40px" />
          ))}
        </div>
      );
    }
    const {topLineasTransporte} = dashboardStats;
    const totalLineas =
      topLineasTransporte && topLineasTransporte.length > 0
        ? topLineasTransporte.reduce((sum, linea) => sum + linea.count, 0)
        : 0;

    return (
      <div className="top-performers custom-scrollbar">
        {topLineasTransporte && topLineasTransporte.length > 0 ? (
          topLineasTransporte.map((linea, index) => {
            const percentage = totalLineas > 0 ? Math.round((linea.count / totalLineas) * 100) : 0;
            return (
              <div key={index} className="client-dropdown-item">
                <div className="performer-item" style={{cursor: "default"}}>
                  <div className="performer-rank">#{index + 1}</div>
                  <div className="performer-info">
                    <div className="performer-name">{linea.nombre}</div>
                    <div className="performer-stats">
                      {formatNumber(linea.count)} transportes
                    </div>
                  </div>
                  <div className="performer-score-container">
                    <div className="performer-score">{percentage}%</div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-4">
            <i className="fa fa-truck opacity-10 mb-2" style={{fontSize: "1.5rem"}}></i>
            <p className="text-muted small">No hay datos de líneas disponibles</p>
          </div>
        )}
      </div>
    );
  };

  const renderTopOperadoresTransportes = () => {
    if (loadingRankings) {
      return (
        <div className="d-flex flex-column gap-2 p-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} height="40px" />
          ))}
        </div>
      );
    }
    const {topOperadoresTransportes} = dashboardStats;
    const totalOperadoresTransportes =
      topOperadoresTransportes && topOperadoresTransportes.length > 0
        ? topOperadoresTransportes.reduce((sum, operador) => sum + operador.count, 0)
        : 0;

    return (
      <div className="top-performers custom-scrollbar">
        {topOperadoresTransportes && topOperadoresTransportes.length > 0 ? (
          topOperadoresTransportes.map((operador, index) => {
            const percentage =
              totalOperadoresTransportes > 0
                ? Math.round((operador.count / totalOperadoresTransportes) * 100)
                : 0;
            return (
              <div key={index} className="client-dropdown-item">
                <div className="performer-item" style={{cursor: "default"}}>
                  <div className="performer-rank">#{index + 1}</div>
                  <div className="performer-info">
                    <div className="performer-name">{operador.nombre}</div>
                    <div className="performer-stats">
                      {formatNumber(operador.count)} transportes
                    </div>
                  </div>
                  <div className="performer-score-container">
                    <div className="performer-score">{percentage}%</div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-4">
            <i className="fa fa-id-card opacity-10 mb-2" style={{fontSize: "1.5rem"}}></i>
            <p className="text-muted small">No hay datos de operadores disponibles</p>
          </div>
        )}
      </div>
    );
  };

  const renderLineasTransporteBarChart = () => {
    if (loadingRankings) {
      return (
        <div className="d-flex flex-column gap-3 py-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} height="30px" />
          ))}
        </div>
      );
    }
    const {topLineasTransporte} = dashboardStats;

    if (!topLineasTransporte || topLineasTransporte.length === 0) {
      return (
        <div className="text-center text-muted">
          No hay datos de líneas de transporte disponibles
        </div>
      );
    }

    const maxCount = Math.max(...topLineasTransporte.map((linea) => linea.count));

    return (
      <div className="horizontal-bar-chart-container">
        {topLineasTransporte.map((linea, index) => {
          const barWidth = maxCount > 0 ? (linea.count / maxCount) * 100 : 0;
          const colors = [
            "#3b82f6",
            "#10b981",
            "#f59e0b",
            "#ef4444",
            "#8b5cf6",
            "#06b6d4",
            "#84cc16",
            "#f97316",
            "#ec4899",
            "#6366f1",
          ];
          const color = colors[index % colors.length];

          return (
            <div key={index} className="horizontal-bar-item">
              <div className="bar-label">{linea.nombre}</div>
              <div className="bar-container">
                <div
                  className="bar-fill"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: color,
                    boxShadow: `0 0 8px ${color}40`
                  }}></div>
              </div>
              <div className="bar-value" style={{ color: color }}>
                {formatNumber(linea.count)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderOperadoresTransportesBarChart = () => {
    if (loadingRankings) {
      return (
        <div className="d-flex flex-column gap-3 py-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} height="30px" />
          ))}
        </div>
      );
    }
    const {topOperadoresTransportes} = dashboardStats;

    if (!topOperadoresTransportes || topOperadoresTransportes.length === 0) {
      return (
        <div className="text-center text-muted">
          No hay datos de operadores de transportes disponibles
        </div>
      );
    }

    const maxCount = Math.max(...topOperadoresTransportes.map((operador) => operador.count));

    return (
      <div className="horizontal-bar-chart-container">
        {topOperadoresTransportes.map((operador, index) => {
          const barWidth = maxCount > 0 ? (operador.count / maxCount) * 100 : 0;
          const colors = [
            "#3b82f6",
            "#10b981",
            "#f59e0b",
            "#ef4444",
            "#8b5cf6",
            "#06b6d4",
            "#84cc16",
            "#f97316",
            "#ec4899",
            "#6366f1",
          ];
          const color = colors[index % colors.length];

          return (
            <div key={index} className="horizontal-bar-item">
              <div className="bar-label">{operador.nombre}</div>
              <div className="bar-container">
                <div
                  className="bar-fill"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: color,
                    boxShadow: `0 0 8px ${color}40`
                  }}></div>
              </div>
              <div className="bar-value" style={{ color: color }}>
                {formatNumber(operador.count)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const isInitialLoading = loading && dashboardStats.monthlyData.length === 0;

  if (isInitialLoading) {
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
            title="Dashboard General"
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            filters={
              <FilterBar>
                <div>
                  <DatePicker
                    label="Fecha Desde"
                    value={fechaDesde}
                    onChange={(v) => commitFilters({nextFechaDesde: v ?? ""})}
                    placeholder="Sin fecha"
                  />
                </div>
                <div>
                  <DatePicker
                    label="Fecha Hasta"
                    value={fechaHasta}
                    onChange={(v) => commitFilters({nextFechaHasta: v ?? ""})}
                    placeholder="Sin fecha"
                  />
                </div>
                <div>
                  <Select
                    label="Cliente"
                    placeholder="Todos los clientes"
                    value={clientFilter === "all" ? null : clientFilter}
                    onChange={(v) =>
                      commitFilters({
                        nextClientFilter: v ?? "all",
                        nextLineaTransporteFilter: "all",
                        nextOperadorFilter: "all",
                      })
                    }
                    options={(availableClients || [])
                      .filter((c) => c?.razon_social)
                      .sort((a, b) => a.razon_social.localeCompare(b.razon_social))
                      .map((c) => ({value: c.razon_social, label: c.razon_social}))}
                  />
                </div>
                <div>
                  <Select
                    label="Línea Transporte"
                    placeholder={
                      clientFilter === "all"
                        ? "Selecciona un cliente primero"
                        : loadingLineasTransporte
                          ? "Cargando..."
                          : "Todas las líneas"
                    }
                    value={lineaTransporteFilter === "all" ? null : lineaTransporteFilter}
                    onChange={(v) =>
                      commitFilters({
                        nextLineaTransporteFilter: v ?? "all",
                        nextOperadorFilter: "all",
                      })
                    }
                    disabled={loadingLineasTransporte || clientFilter === "all"}
                    options={(availableLineasTransporte || [])
                      .filter((l) => l?.nombre)
                      .sort((a, b) => a.nombre.localeCompare(b.nombre))
                      .map((l) => ({value: l.nombre, label: l.nombre}))}
                  />
                </div>
                <div>
                  <Select
                    label="Operador"
                    placeholder={
                      lineaTransporteFilter === "all"
                        ? "Selecciona una línea primero"
                        : loadingOperadores
                          ? "Cargando..."
                          : "Todos los operadores"
                    }
                    value={operadorFilter === "all" ? null : operadorFilter}
                    onChange={(v) => commitFilters({nextOperadorFilter: v ?? "all"})}
                    disabled={loadingOperadores || lineaTransporteFilter === "all"}
                    options={(availableOperadores || [])
                      .filter((o) => o?.nombre)
                      .sort((a, b) => a.nombre.localeCompare(b.nombre))
                      .map((o) => ({value: o.nombre, label: o.nombre}))}
                  />
                </div>
              </FilterBar>
            }
          />

          <div className="container-fluid px-3 px-md-4 mt-4">

            {/* Estadísticas principales con totales y porcentajes integrados */}
            <div className="row mb-3 mb-md-4 g-2 g-md-3">
              {hasActiveFilters && (
                <div className="col-12 mb-3">
                  <div 
                    className="d-flex align-items-center gap-2 px-3 py-2" 
                    style={{
                      backgroundColor: "#eff6ff", 
                      borderRadius: "8px", 
                      border: "1px solid #dbeafe",
                      color: "#1e40af",
                      fontSize: "0.75rem"
                    }}
                  >
                    <i className="fa fa-info-circle" style={{opacity: 0.8}}></i>
                    <span>
                      <strong style={{fontWeight: "700"}}>Vista filtrada:</strong>{" "}
                      {appliedClientFilter !== "all" && <span className="me-2">Cliente: <span style={{fontWeight: "600"}}>{appliedClientFilter}</span></span>}
                      {appliedLineaTransporteFilter !== "all" && <span className="me-2">Línea: <span style={{fontWeight: "600"}}>{appliedLineaTransporteFilter}</span></span>}
                      {appliedOperadorFilter !== "all" && <span className="me-2">Operador: <span style={{fontWeight: "600"}}>{appliedOperadorFilter}</span></span>}
                      {appliedFechaDesde !== lastYearStr && <span className="me-2">Desde: <span style={{fontWeight: "600"}}>{appliedFechaDesde}</span></span>}
                      {appliedFechaHasta !== todayStr && <span>Hasta: <span style={{fontWeight: "600"}}>{appliedFechaHasta}</span></span>}
                    </span>
                  </div>
                </div>
              )}
              {/* Total Bitácoras */}
              <div className="col-6 col-lg mb-2 mb-lg-0">
                <div className="stat-card h-100">
                  <div className="stat-icon total">
                    <i className="fa fa-book"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {loadingSummary ? (
                        <Skeleton width="60px" height="24px" />
                      ) : (
                        formatNumber(dashboardStats.totalBitacoras || 0)
                      )}
                    </div>
                    <div className="stat-label">Total Bitácoras</div>
                  </div>
                  <div className="stat-percentage" style={{color: "#64748b"}}>
                    100%
                  </div>
                </div>
              </div>

              {/* Nuevas */}
              <div className="col-6 col-lg mb-2 mb-lg-0">
                <div className="stat-card h-100">
                  <div className="stat-icon new">
                    <i className="fa fa-plus-circle"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {loadingSummary ? (
                        <Skeleton width="60px" height="24px" />
                      ) : (
                        formatNumber(dashboardStats.nuevasBitacoras || 0)
                      )}
                    </div>
                    <div className="stat-label">Nuevas</div>
                  </div>
                  <div className="stat-percentage" style={{color: "#059669"}}>
                    {loadingSummary ? (
                      <Skeleton width="30px" height="14px" />
                    ) : (
                      <>
                        {dashboardStats.totalBitacoras > 0 &&
                        dashboardStats.nuevasBitacoras !== undefined
                          ? Math.round(
                              (dashboardStats.nuevasBitacoras / dashboardStats.totalBitacoras) * 100
                            )
                          : 0}
                        %
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* En Proceso */}
              <div className="col-6 col-lg mb-2 mb-lg-0">
                <div className="stat-card h-100">
                  <div className="stat-icon pending">
                    <i className="fa fa-clock"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {loadingSummary ? (
                        <Skeleton width="60px" height="24px" />
                      ) : (
                        formatNumber(dashboardStats.enProcesoBitacoras || 0)
                      )}
                    </div>
                    <div className="stat-label">En proceso</div>
                  </div>
                  <div className="stat-percentage" style={{color: "#2563eb"}}>
                    {loadingSummary ? (
                      <Skeleton width="30px" height="14px" />
                    ) : (
                      <>
                        {dashboardStats.totalBitacoras > 0 &&
                        dashboardStats.enProcesoBitacoras !== undefined
                          ? Math.round(
                              (dashboardStats.enProcesoBitacoras / dashboardStats.totalBitacoras) *
                                100
                            )
                          : 0}
                        %
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Cerradas */}
              <div className="col-6 col-lg mb-2 mb-lg-0">
                <div className="stat-card h-100">
                  <div className="stat-icon closed">
                    <i className="fa fa-lock"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {loadingSummary ? (
                        <Skeleton width="60px" height="24px" />
                      ) : (
                        formatNumber(dashboardStats.cerradasBitacoras || 0)
                      )}
                    </div>
                    <div className="stat-label">Cerradas</div>
                  </div>
                  <div className="stat-percentage" style={{color: "#dc2626"}}>
                    {loadingSummary ? (
                      <Skeleton width="30px" height="14px" />
                    ) : (
                      <>
                        {dashboardStats.totalBitacoras > 0 &&
                        dashboardStats.cerradasBitacoras !== undefined
                          ? Math.round(
                              (dashboardStats.cerradasBitacoras / dashboardStats.totalBitacoras) * 100
                            )
                          : 0}
                        %
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Con Anomalías */}
              <div className="col-6 col-lg mb-2 mb-lg-0">
                <div className="stat-card h-100">
                  <div className="stat-icon anomalia">
                    <i className="fa fa-exclamation-triangle"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">
                      {loadingSummary ? (
                        <Skeleton width="60px" height="24px" />
                      ) : (
                        formatNumber(getTotalAnomalias())
                      )}
                    </div>
                    <div className="stat-label">Con Anomalías</div>
                  </div>
                  <div className="stat-percentage" style={{color: "#d97706"}}>
                    {loadingSummary ? (
                      <Skeleton width="30px" height="14px" />
                    ) : (
                      <>
                        {dashboardStats.totalBitacoras > 0
                          ? Math.round((getTotalAnomalias() / dashboardStats.totalBitacoras) * 100)
                          : 0}
                        %
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tendencia mensual */}
            <div className="row mb-3 mb-md-4">
              <div className="col-12">
                <div className="chart-card">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="mb-0">Tendencia Mensual</h6>
                      {hasActiveFilters && (
                        <span className="badge bg-info" style={{fontSize: "10px"}}>
                          <i className="fa fa-filter me-1"></i>
                          Filtrado
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="chart-body">
                    {renderMonthlyTrendChart()}
                  </div>
                </div>
              </div>
            </div>

            {/* Eventos y Rendimiento */}
            <div className="row mb-3 mb-md-4">
              <div className="col-md-6 mb-3 mb-md-0">
                <div className="chart-card compact">
                  <div className="chart-header">
                    <h6 className="mb-0">Distribución de Eventos</h6>
                  </div>
                  <div className="chart-body">
                    {renderEventDistributionChart()}
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="chart-card compact">
                  <div className="chart-header">
                    <h6 className="mb-0">Eficiencia de Operadores</h6>
                  </div>
                  <div className="chart-body">
                    {renderPerformanceChart()}
                  </div>
                </div>
              </div>
            </div>

            {/* Lista descendente de clientes */}
            <div className="row mb-3 mb-md-4">
              <div className="col-12">
                <div className="chart-card compact">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="mb-0">Lista de Clientes</h6>
                      {hasActiveFilters && (
                        <span className="badge bg-info" style={{fontSize: "10px"}}>
                          <i className="fa fa-filter me-1"></i>
                          Filtrado
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="chart-body">
                    <div className="overflow-auto">{renderTopClients()}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tipos de monitoreo */}
            <div className="row mb-3 mb-md-4">
              <div className="col-12">
                <div className="chart-card compact">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="mb-0">Tipos de Monitoreo</h6>
                      {hasActiveFilters && (
                        <span className="badge bg-info" style={{fontSize: "10px"}}>
                          <i className="fa fa-filter me-1"></i>
                          Filtrado
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="chart-body">
                    <div className="overflow-auto">{renderTiposMonitoreoChart()}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Líneas de Transporte */}
            <div className="row mb-3 mb-md-4">
              <div className="col-12">
                <div className="chart-card">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="mb-0">Lista de Líneas de Transporte</h6>
                      {hasActiveFilters && (
                        <span className="badge bg-info" style={{fontSize: "10px"}}>
                          <i className="fa fa-filter me-1"></i>
                          Filtrado
                        </span>
                      )}
                    </div>
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className={`btn ${
                          lineasViewMode === "chart" ? "btn-primary" : "btn-outline-primary"
                        }`}
                        onClick={() => setLineasViewMode("chart")}
                        title="Vista de gráfico">
                        <i className="fa fa-bar-chart"></i>
                      </button>
                      <button
                        type="button"
                        className={`btn ${
                          lineasViewMode === "list" ? "btn-primary" : "btn-outline-primary"
                        }`}
                        onClick={() => setLineasViewMode("list")}
                        title="Vista de lista">
                        <i className="fa fa-list"></i>
                      </button>
                    </div>
                  </div>
                  <div className="chart-body">
                    {lineasViewMode === "chart"
                      ? renderLineasTransporteBarChart()
                      : renderTopLineasTransporte()}
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de Operadores de Transportes */}
            <div className="row mb-3 mb-md-4">
              <div className="col-12">
                <div className="chart-card">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="mb-0">Lista de Operadores</h6>
                      {hasActiveFilters && (
                        <span className="badge bg-info" style={{fontSize: "10px"}}>
                          <i className="fa fa-filter me-1"></i>
                          Filtrado
                        </span>
                      )}
                    </div>
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className={`btn ${
                          operadoresTransportesViewMode === "chart"
                            ? "btn-primary"
                            : "btn-outline-primary"
                        }`}
                        onClick={() => setOperadoresTransportesViewMode("chart")}
                        title="Vista de gráfico">
                        <i className="fa fa-bar-chart"></i>
                      </button>
                      <button
                        type="button"
                        className={`btn ${
                          operadoresTransportesViewMode === "list"
                            ? "btn-primary"
                            : "btn-outline-primary"
                        }`}
                        onClick={() => setOperadoresTransportesViewMode("list")}
                        title="Vista de lista">
                        <i className="fa fa-list"></i>
                      </button>
                    </div>
                  </div>
                  <div className="chart-body">
                    {operadoresTransportesViewMode === "chart"
                      ? renderOperadoresTransportesBarChart()
                      : renderTopOperadoresTransportes()}
                  </div>
                </div>
              </div>
            </div>

            {/* Análisis geográfico */}
            <div className="row mb-3 mb-md-4">
              <div className="col-12">
                <div className="chart-card compact">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="mb-0">Análisis Geográfico</h6>
                      {hasActiveFilters && (
                        <span className="badge bg-info" style={{fontSize: "10px"}}>
                          <i className="fa fa-filter me-1"></i>
                          Filtrado
                        </span>
                      )}
                    </div>
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className={`btn ${
                          geograficoViewMode === "chart" ? "btn-primary" : "btn-outline-primary"
                        }`}
                        onClick={() => setGeograficoViewMode("chart")}
                        title="Vista de lista con iconos">
                        <i className="fa fa-map-marker-alt"></i>
                      </button>
                      <button
                        type="button"
                        className={`btn ${
                          geograficoViewMode === "list" ? "btn-primary" : "btn-outline-primary"
                        }`}
                        onClick={() => setGeograficoViewMode("list")}
                        title="Vista de gráfico de barras">
                        <i className="fa fa-bar-chart"></i>
                      </button>
                    </div>
                  </div>
                  <div className="chart-body">
                    <div className="overflow-auto">
                      {geograficoViewMode === "chart"
                        ? renderGeographicChart()
                        : renderGeographicBarChart()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de Usuarios */}
            <div className="row mb-3 mb-md-4">
              <div className="col-12">
                <div className="chart-card compact">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="mb-0">Lista de Usuarios</h6>
                      {hasActiveFilters && (
                        <span className="badge bg-info" style={{fontSize: "10px"}}>
                          <i className="fa fa-filter me-1"></i>
                          Filtrado
                        </span>
                      )}
                    </div>
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className={`btn ${
                          usuariosViewMode === "chart" ? "btn-primary" : "btn-outline-primary"
                        }`}
                        onClick={() => setUsuariosViewMode("chart")}
                        title="Vista de gráfico">
                        <i className="fa fa-bar-chart"></i>
                      </button>
                      <button
                        type="button"
                        className={`btn ${
                          usuariosViewMode === "list" ? "btn-primary" : "btn-outline-primary"
                        }`}
                        onClick={() => setUsuariosViewMode("list")}
                        title="Vista de lista">
                        <i className="fa fa-list"></i>
                      </button>
                    </div>
                  </div>
                  <div className="chart-body">
                    {usuariosViewMode === "chart"
                      ? renderUsuariosBarChart()
                      : renderTopOperadores()}
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones rápidas */}
            {/* <div className="row mb-3 mb-md-4">
              <div className="col-12">
                <div className="chart-card">
                  <div className="chart-header">
                    <h6 className="mb-0">Acciones Rápidas</h6>
                  </div>
                  <div className="chart-body">
                    <div className="row g-2 g-md-3">
                      {roleData?.bitacoras?.create && (
                        <div className="col-6 col-md-3 mb-2 mb-md-0">
                          <button
                            className="action-btn primary btn w-100"
                            onClick={() => navigate("/bitacoras")}>
                            <i className="fa fa-plus me-1 me-md-2"></i>
                            <span className="d-none d-sm-inline">Nueva Bitácora</span>
                            <span className="d-sm-none">Nueva</span>
                          </button>
                        </div>
                      )}

                      {roleData?.bitacoras?.read && (
                        <div className="col-6 col-md-3 mb-2 mb-md-0">
                          <button
                            className="action-btn info btn w-100"
                            onClick={() => navigate("/bitacoras")}>
                            <i className="fa fa-list me-1 me-md-2"></i>
                            <span className="d-none d-sm-inline">Ver Bitácoras</span>
                            <span className="d-sm-none">Ver</span>
                          </button>
                        </div>
                      )}

                      {roleData?.clientes?.read && (
                        <div className="col-6 col-md-3 mb-2 mb-md-0">
                          <button
                            className="action-btn success btn w-100"
                            onClick={() => navigate("/clientes")}>
                            <i className="fa fa-building me-1 me-md-2"></i>
                            <span className="d-none d-sm-inline">Gestionar Clientes</span>
                            <span className="d-sm-none">Clientes</span>
                          </button>
                        </div>
                      )}

                      {roleData?.usuarios?.read && (
                        <div className="col-6 col-md-3 mb-2 mb-md-0">
                          <button
                            className="action-btn warning btn w-100"
                            onClick={() => navigate("/usuarios")}>
                            <i className="fa fa-users me-1 me-md-2"></i>
                            <span className="d-none d-sm-inline">Gestionar Usuarios</span>
                            <span className="d-sm-none">Usuarios</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div> */}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashboardPage;
