import {useState, useEffect, useCallback} from "react";
import {useAuth} from "../context/AuthContext";
import {useSidebar} from "../context/SidebarContext";
import {useNavigate} from "react-router-dom";
import Sidebar from "./Sidebar";
import PageHeader from "./PageHeader";
import {getAllowedClients} from "../utils/clientPermissions";

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
  const [clientFilter, setClientFilter] = useState("all");
  const [availableClients, setAvailableClients] = useState([]);
  const [geoType, setGeoType] = useState("origen");

  // Filtros pendientes (que se pueden cambiar sin aplicar)
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState(() => {
    // Set default value to today's date in YYYY-MM-DD format
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [lineaTransporteFilter, setLineaTransporteFilter] = useState("all");
  const [operadorFilter, setOperadorFilter] = useState("all");

  // Filtros aplicados (que realmente se usan en las consultas)
  const [appliedClientFilter, setAppliedClientFilter] = useState("all");
  const [appliedFechaDesde, setAppliedFechaDesde] = useState("");
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

  // Function to apply filters when check button is pressed
  const applyFilters = () => {
    setAppliedClientFilter(clientFilter);
    setAppliedGeoType(geoType);
    setAppliedFechaDesde(fechaDesde);
    setAppliedFechaHasta(fechaHasta);
    setAppliedLineaTransporteFilter(lineaTransporteFilter);
    setAppliedOperadorFilter(operadorFilter);
    setApplyFiltersTrigger((prev) => prev + 1);

    // Limpiar estados de dropdowns de clientes cuando cambien los filtros
    setExpandedClients({});
    setClientBitacoras({});
    setLoadingClientBitacoras({});
    setClientPagination({});
    setLoadingClientDownload({});

    // Limpiar estados de dropdowns de usuarios cuando cambien los filtros
    setExpandedUsers({});
    setUserBitacoras({});
    setLoadingUserBitacoras({});
    setUserPagination({});
    setLoadingUserDownload({});

    // Limpiar estados de dropdowns de ubicaciones cuando cambien los filtros
    setExpandedLocations({});
    setLocationBitacoras({});
    setLoadingLocationBitacoras({});
    setLocationPagination({});
    setLoadingLocationDownload({});

    // Reset paginación geográfica
    setGeographicPage(1);
  };

  // Function to reset filters
  const resetFilters = () => {
    const today = new Date().toISOString().split("T")[0];
    setClientFilter("all");
    setGeoType("origen");
    setFechaDesde("");
    setFechaHasta(today);
    setLineaTransporteFilter("all");
    setOperadorFilter("all");

    // Limpiar estados de dropdowns de clientes cuando se reseteen los filtros
    setExpandedClients({});
    setClientBitacoras({});
    setLoadingClientBitacoras({});
    setClientPagination({});
    setLoadingClientDownload({});

    // Limpiar estados de dropdowns de usuarios cuando se reseteen los filtros
    setExpandedUsers({});
    setUserBitacoras({});
    setLoadingUserBitacoras({});
    setUserPagination({});
    setLoadingUserDownload({});

    // Limpiar estados de dropdowns de ubicaciones cuando se reseteen los filtros
    setExpandedLocations({});
    setLocationBitacoras({});
    setLoadingLocationBitacoras({});
    setLocationPagination({});
    setLoadingLocationDownload({});

    // Reset paginación geográfica
    setGeographicPage(1);
  };

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

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const commonParams = `clientFilter=${encodeURIComponent(
        appliedClientFilter
      )}&fechaDesde=${encodeURIComponent(appliedFechaDesde)}&fechaHasta=${encodeURIComponent(
        appliedFechaHasta
      )}&lineaTransporte=${encodeURIComponent(
        appliedLineaTransporteFilter
      )}&operador=${encodeURIComponent(appliedOperadorFilter)}`;

      const statsUrl = `${baseUrl}/dashboard/stats?${commonParams}&geoType=${encodeURIComponent(appliedGeoType)}`;
      const lineasStatsUrl = `${baseUrl}/dashboard/lineas-transporte-stats?${commonParams}`;

      const [statsResponse, lineasResponse] = await Promise.all([
        fetch(statsUrl, {method: "GET", credentials: "include"}),
        fetch(lineasStatsUrl, {method: "GET", credentials: "include"}),
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setDashboardStats((prev) => ({...prev, ...statsData}));
      }

      if (lineasResponse.ok) {
        const lineasData = await lineasResponse.json();
        setDashboardStats((prev) => ({...prev, lineasTransporteStats: lineasData}));
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [
    baseUrl,
    appliedClientFilter,
    appliedGeoType,
    appliedFechaDesde,
    appliedFechaHasta,
    appliedLineaTransporteFilter,
    appliedOperadorFilter,
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
  const renderTiposMonitoreoChart = () => {
    const tiposMonitoreo = dashboardStats.tiposMonitoreo || [];

    if (tiposMonitoreo.length === 0) {
      return <div className="text-center text-muted">No hay datos disponibles</div>;
    }

    const total = tiposMonitoreo.reduce((sum, tipo) => sum + tipo.count, 0);

    return (
      <div className="tipos-monitoreo-chart">
        <div className="tipos-table">
          <div className="table-header">
            <div className="header-cell small">Tipo</div>
            <div className="header-cell small">Cant.</div>
            <div className="header-cell small">%</div>
            <div className="header-cell small">Barra</div>
          </div>
          <div className="table-body">
            {tiposMonitoreo.map((tipo, index) => {
              const percentage = (tipo.count / total) * 100;
              return (
                <div key={index} className="table-row">
                  <div className="cell tipo-name">
                    <span className="small">{tipo.nombre}</span>
                  </div>
                  <div className="cell tipo-count small">{formatNumber(tipo.count)}</div>
                  <div className="cell tipo-percentage small">{percentage.toFixed(1)}%</div>
                  <div className="cell tipo-bar">
                    <div className="bar-container">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: tipo.color || "#3b82f6",
                        }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthlyTrendChart = () => {
    const monthlyData = dashboardStats.monthlyData || [];

    // Si no hay datos, mostrar mensaje
    if (!monthlyData || monthlyData.length === 0) {
      return (
        <div className="text-center text-muted">
          No hay datos disponibles para el período seleccionado
        </div>
      );
    }

    const maxValue = Math.max(...monthlyData.map((d) => d.value));

    // Calculate dynamic spacing based on number of months
    const gapSize = monthlyData.length <= 3 ? "20px" : monthlyData.length <= 6 ? "12px" : "8px";
    const minBarWidth =
      monthlyData.length <= 3 ? "60px" : monthlyData.length <= 6 ? "45px" : "35px";

    return (
      <div className="trend-chart">
        <div
          className="chart-bars"
          style={{
            height: "250px",
            display: "flex",
            alignItems: "flex-end",
            gap: gapSize,
            padding: "15px 0 35px 0",
            position: "relative",
            minWidth:
              monthlyData.length <= 3 ? "300px" : monthlyData.length <= 6 ? "450px" : "600px",
            justifyContent: monthlyData.length <= 3 ? "center" : "flex-start",
          }}>
          {monthlyData.map((item, index) => {
            const barHeight = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
            return (
              <div
                key={index}
                className="chart-bar-item"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: 1,
                  height: "100%",
                  position: "relative",
                  justifyContent: "flex-end",
                  minWidth: monthlyData.length <= 3 ? "60px" : "40px", // Dynamic minimum bar width
                }}>
                <div
                  className="bar"
                  style={{
                    height: `${barHeight}%`,
                    backgroundColor: "#3b82f6",
                    minHeight: item.value > 0 ? "4px" : "0px",
                    width: "100%",
                    maxWidth: minBarWidth,
                    borderRadius: "4px 4px 0 0",
                    transition: "height 0.3s ease",
                    marginBottom: "40px",
                  }}></div>
                <div
                  style={{
                    position: "absolute",
                    bottom: "-35px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    textAlign: "center",
                    width: "100%",
                  }}>
                  <span
                    className="bar-label"
                    style={{
                      fontSize: "11px",
                      fontWeight: "500",
                      color: "#6b7280",
                      display: "block",
                    }}>
                    {item.month}
                  </span>
                  <span
                    className="bar-value"
                    style={{
                      fontSize: "10px",
                      fontWeight: "bold",
                      color: "#3b82f6",
                      display: "block",
                      marginTop: "2px",
                    }}>
                    {formatNumber(item.value)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="chart-summary">
          <div className="summary-item">
            <span className="summary-label">Total del período:</span>
            <span className="summary-value">
              {formatNumber(monthlyData.reduce((sum, item) => sum + item.value, 0))} bitácoras
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Promedio mensual:</span>
            <span className="summary-value">
              {(() => {
                const monthsWithData = monthlyData.filter((item) => item.value > 0).length;
                const totalValue = monthlyData.reduce((sum, item) => sum + item.value, 0);
                const average = monthsWithData > 0 ? Math.round(totalValue / monthsWithData) : 0;
                return formatNumber(average);
              })()}{" "}
              bitácoras
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Meses con datos:</span>
            <span className="summary-value">
              {monthlyData.filter((item) => item.value > 0).length} de {monthlyData.length}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderGeographicChart = () => {
    const geographicData = dashboardStats.geographicData || [];
    const paginatedGeographic = getPaginatedGeographicData();

    if (!geographicData || geographicData.length === 0) {
      return <div className="text-center text-muted">No hay datos disponibles</div>;
    }

    return (
      <div className="geographic-chart">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <span
              className="badge"
              style={{
                backgroundColor: appliedGeoType === "origen" ? "#10b981" : "#f59e0b",
                color: "#fff",
                fontSize: "0.75rem",
                marginLeft: 8,
              }}>
              {appliedGeoType === "origen" ? "Origen" : "Destino"}
            </span>
            <span className="text-muted small">Total: {geographicData.length} ubicaciones</span>
          </div>
          <div className="d-flex align-items-center gap-3">
            {/* Selector de cantidad por página */}
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small">Mostrar:</span>
              <select
                value={geographicPageSize}
                onChange={(e) => handleGeographicPageSizeChange(parseInt(e.target.value))}
                className="form-select form-select-sm"
                style={{
                  width: "80px",
                  fontSize: "0.75rem",
                  padding: "4px 8px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={9999}>Todas</option>
              </select>
            </div>
            {/* Selector de tipo geográfico */}
            <select
              value={geoType}
              onChange={(e) => {
                setGeoType(e.target.value);
                setAppliedGeoType(e.target.value);
                setGeographicPage(1); // Reset page when changing type
                setApplyFiltersTrigger((prev) => prev + 1);
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
        </div>

        {/* Mensaje informativo cuando se muestran todas las ubicaciones */}
        {geographicPageSize >= 9999 && geographicData.length > 0 && (
          <div
            className="alert alert-success mb-3"
            style={{fontSize: "0.85rem", padding: "8px 12px"}}>
            <i className="fa fa-info-circle me-2"></i>
            <strong>Mostrando todas las ubicaciones:</strong> {geographicData.length} ubicaciones en
            total
          </div>
        )}

        {/* Lista de ubicaciones paginada */}
        <div className="geo-items" style={{minHeight: "400px"}}>
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
                    <div className="geo-name small" style={{color: "#ffffff", fontWeight: "500"}}>
                      {location.name}
                    </div>
                    <div className="geo-count small" style={{color: "#e2e8f0", fontSize: "0.8rem"}}>
                      {formatNumber(location.count)} bitácoras
                    </div>
                  </div>
                  <div
                    className="geo-percentage-container"
                    style={{display: "flex", alignItems: "center", gap: "8px"}}>
                    <div
                      className="geo-percentage small"
                      style={{color: "#ffffff", fontWeight: "600", fontSize: "0.9rem"}}>
                      {percentage}%
                    </div>
                    {/* Botón de descarga */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Evitar que se expanda/contraiga el dropdown
                        downloadLocationBitacorasExcel(location.name);
                      }}
                      disabled={loadingLocationDownload[location.name]}
                      style={{
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        border: "none",
                        borderRadius: "6px",
                        width: "24px",
                        height: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: loadingLocationDownload[location.name] ? "not-allowed" : "pointer",
                        transition: "all 0.2s ease",
                        opacity: loadingLocationDownload[location.name] ? 0.6 : 1,
                      }}
                      title="Descargar bitácoras en Excel">
                      <i
                        className={
                          loadingLocationDownload[location.name]
                            ? "fa fa-spinner fa-spin"
                            : "fa fa-download"
                        }
                        style={{
                          fontSize: "10px",
                          color: "white",
                        }}></i>
                    </button>
                    <div className="expand-icon">
                      <i
                        className={`fa fa-chevron-${isExpanded ? "up" : "down"}`}
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          transition: "transform 0.2s ease",
                        }}></i>
                    </div>
                  </div>
                </div>

                {/* Contenido expandible con las bitácoras */}
                {isExpanded && (
                  <div
                    className="location-bitacoras-list"
                    style={{
                      paddingLeft: "40px",
                      paddingRight: "8px",
                      paddingTop: "8px",
                      paddingBottom: "8px",
                      backgroundColor: "rgba(148, 163, 184, 0.05)",
                      borderRadius: "8px",
                      margin: "8px 0",
                      animation: "slideDown 0.3s ease",
                    }}>
                    {isLoading ? (
                      <div className="text-center py-2">
                        <i className="fa fa-spinner fa-spin me-2" style={{fontSize: "12px"}}></i>
                        <span style={{fontSize: "12px", color: "#94a3b8"}}>
                          Cargando bitácoras...
                        </span>
                      </div>
                    ) : bitacoras && bitacoras.length > 0 ? (
                      <div>
                        <div className="bitacoras-header" style={{marginBottom: "12px"}}>
                          <span style={{fontSize: "11px", color: "#64748b", fontWeight: "600"}}>
                            Bitácoras ({bitacoras.length}):
                          </span>
                        </div>
                        <div
                          className="bitacoras-table-container"
                          style={{
                            maxHeight: "400px",
                            overflowY: "auto",
                            overflowX: "auto",
                            border: "1px solid rgba(148, 163, 184, 0.2)",
                            borderRadius: "8px",
                            backgroundColor: "#f8fafc",
                          }}>
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              fontSize: "10px",
                              minWidth: "800px",
                            }}>
                            <thead style={{backgroundColor: "#e2e8f0", position: "sticky", top: 0}}>
                              <tr>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  No. Bitácora
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Fecha de Creación
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Cliente
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Tipo Monitoreo
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Línea de transporte
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Operador
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Origen
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Destino
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Estado
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Usuario
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {bitacoras.map((bitacora, bitIndex) => (
                                <tr
                                  key={bitIndex}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/bitacora/${bitacora._id}`);
                                  }}
                                  style={{
                                    cursor: "pointer",
                                    transition: "background-color 0.2s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "#e0f2fe";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "transparent";
                                  }}>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#1f2937",
                                      fontWeight: "600",
                                    }}>
                                    #{bitacora.bitacora_id}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                    }}>
                                    {new Date(bitacora.fechaCreacion).toLocaleDateString("es-ES", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                    })}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                    }}>
                                    {bitacora.cliente}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                    }}>
                                    {bitacora.tipoMonitoreo}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "120px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.lineaTransporte || "N/A"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "120px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.operadorTransporte || "N/A"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "150px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.origen || "N/A"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "150px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.destino || "N/A"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                    }}>
                                    <span
                                      style={{
                                        padding: "2px 6px",
                                        borderRadius: "12px",
                                        fontSize: "9px",
                                        fontWeight: "600",
                                        textTransform: "uppercase",
                                        backgroundColor:
                                          bitacora.estado === "nueva"
                                            ? "#dbeafe"
                                            : bitacora.estado === "validada"
                                            ? "#fef3c7"
                                            : bitacora.estado === "iniciada"
                                            ? "#d1fae5"
                                            : bitacora.estado === "cerrada"
                                            ? "#fee2e2"
                                            : bitacora.estado === "finalizada"
                                            ? "#e0e7ff"
                                            : "#f3f4f6",
                                        color:
                                          bitacora.estado === "nueva"
                                            ? "#1e40af"
                                            : bitacora.estado === "validada"
                                            ? "#d97706"
                                            : bitacora.estado === "iniciada"
                                            ? "#059669"
                                            : bitacora.estado === "cerrada"
                                            ? "#dc2626"
                                            : bitacora.estado === "finalizada"
                                            ? "#7c3aed"
                                            : "#6b7280",
                                      }}>
                                      {bitacora.estado}
                                    </span>
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "100px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.usuario}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Controles de paginación */}
                        {locationPagination[location.name] &&
                          locationPagination[location.name].totalPages > 1 && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "8px 12px",
                                borderTop: "1px solid #e5e7eb",
                                fontSize: "11px",
                                backgroundColor: "#f9fafb",
                              }}>
                              <div style={{display: "flex", alignItems: "center", gap: "12px"}}>
                                <span style={{color: "#6b7280"}}>
                                  Página {locationPagination[location.name].currentPage} de{" "}
                                  {locationPagination[location.name].totalPages} (
                                  {locationPagination[location.name].totalCount} total)
                                </span>
                                <div style={{display: "flex", alignItems: "center", gap: "4px"}}>
                                  <span style={{color: "#6b7280", fontSize: "10px"}}>Mostrar:</span>
                                  <select
                                    value={locationPageLimits[location.name] || 10}
                                    onChange={(e) =>
                                      handleLocationPageLimitChange(
                                        location.name,
                                        parseInt(e.target.value)
                                      )
                                    }
                                    style={{
                                      fontSize: "10px",
                                      padding: "2px 4px",
                                      border: "1px solid #d1d5db",
                                      borderRadius: "3px",
                                      backgroundColor: "#fff",
                                      color: "#374151",
                                    }}>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                  </select>
                                </div>
                              </div>
                              <div style={{display: "flex", gap: "4px"}}>
                                <button
                                  onClick={() =>
                                    handleLocationPagination(
                                      location.name,
                                      locationPagination[location.name].currentPage - 1
                                    )
                                  }
                                  disabled={
                                    !locationPagination[location.name].hasPrevPage || isLoading
                                  }
                                  style={{
                                    background:
                                      locationPagination[location.name].hasPrevPage && !isLoading
                                        ? "#f3f4f6"
                                        : "#e5e7eb",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "4px",
                                    width: "24px",
                                    height: "24px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor:
                                      locationPagination[location.name].hasPrevPage && !isLoading
                                        ? "pointer"
                                        : "not-allowed",
                                    fontSize: "10px",
                                    color:
                                      locationPagination[location.name].hasPrevPage && !isLoading
                                        ? "#374151"
                                        : "#9ca3af",
                                  }}>
                                  <i className="fa fa-chevron-left"></i>
                                </button>
                                <button
                                  onClick={() =>
                                    handleLocationPagination(
                                      location.name,
                                      locationPagination[location.name].currentPage + 1
                                    )
                                  }
                                  disabled={
                                    !locationPagination[location.name].hasNextPage || isLoading
                                  }
                                  style={{
                                    background:
                                      locationPagination[location.name].hasNextPage && !isLoading
                                        ? "#f3f4f6"
                                        : "#e5e7eb",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "4px",
                                    width: "24px",
                                    height: "24px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor:
                                      locationPagination[location.name].hasNextPage && !isLoading
                                        ? "pointer"
                                        : "not-allowed",
                                    fontSize: "10px",
                                    color:
                                      locationPagination[location.name].hasNextPage && !isLoading
                                        ? "#374151"
                                        : "#9ca3af",
                                  }}>
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
    const geographicData = dashboardStats.geographicData || [];

    if (!geographicData || geographicData.length === 0) {
      return <div className="text-center text-muted">No hay datos geográficos disponibles</div>;
    }

    return (
      <div className="geographic-bar-chart">
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
              setGeoType(e.target.value);
              setAppliedGeoType(e.target.value);
              setApplyFiltersTrigger((prev) => prev + 1);
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

        <div
          className="horizontal-bar-chart-container"
          style={{
            maxHeight: "300px",
            overflowY: "auto",
            paddingRight: "8px", // Espacio para evitar que se corten los números
            marginRight: "-8px", // Compensar el padding
          }}>
          {geographicData.map((location, index) => {
            const maxCount = Math.max(...geographicData.map((loc) => loc.count));
            const barWidth = maxCount > 0 ? (location.count / maxCount) * 180 : 0; // Reducido de 200 a 180
            const color = appliedGeoType === "origen" ? "#10b981" : "#f59e0b";

            return (
              <div
                key={index}
                className="horizontal-bar-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "12px",
                  padding: "8px 12px 8px 0", // Más padding a la derecha
                  backgroundColor: "transparent", // Quitar fondo blanco
                }}>
                <div
                  className="bar-label"
                  style={{
                    width: "120px",
                    fontSize: "12px",
                    fontWeight: "500",
                    color: "#ffffff",
                    marginRight: "12px",
                    textAlign: "right",
                    flexShrink: 0, // No permitir que se encoja
                  }}>
                  {location.name}
                </div>
                <div
                  className="bar-container"
                  style={{
                    flex: 1,
                    height: "20px",
                    backgroundColor: "rgba(59, 130, 246, 0.08)", // Azul muy opaco
                    borderRadius: "10px",
                    position: "relative",
                    marginRight: "12px",
                    minWidth: "100px", // Ancho mínimo para evitar colapso
                  }}>
                  <div
                    className="bar-fill"
                    style={{
                      width: `${barWidth}px`,
                      height: "100%",
                      backgroundColor: color,
                      borderRadius: "10px",
                      transition: "width 0.3s ease",
                      minWidth: location.count > 0 ? "4px" : "0px",
                    }}></div>
                </div>
                <div
                  className="bar-value"
                  style={{
                    fontSize: "11px",
                    fontWeight: "bold",
                    color: color,
                    minWidth: "50px", // Aumentado de 40px a 50px
                    textAlign: "right",
                    flexShrink: 0, // No permitir que se encoja
                    paddingLeft: "8px", // Espacio adicional
                  }}>
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
    const {topClients} = dashboardStats;
    const totalClients =
      topClients && topClients.length > 0
        ? topClients.reduce((sum, client) => sum + client.count, 0)
        : 0;

    return (
      <div className="top-performers" style={{maxHeight: "400px", overflowY: "auto"}}>
        {topClients && topClients.length > 0 ? (
          topClients.map((client, index) => {
            const percentage =
              totalClients > 0 ? Math.round((client.count / totalClients) * 100) : 0;
            const isExpanded = expandedClients[client.nombre];
            const bitacoras = clientBitacoras[client.nombre] || [];
            const isLoading = loadingClientBitacoras[client.nombre];

            return (
              <div key={index} className="client-dropdown-item">
                {/* Header del cliente - clickeable para expandir */}
                <div
                  className="performer-item"
                  onClick={() => toggleClientDropdown(client.nombre)}
                  style={{cursor: "pointer", transition: "all 0.2s ease"}}>
                  <div className="performer-rank small">#{index + 1}</div>
                  <div className="performer-info">
                    <div className="performer-name small">{client.nombre}</div>
                    <div className="performer-stats small">
                      {formatNumber(client.count)} bitácoras
                    </div>
                  </div>
                  <div
                    className="performer-score-container"
                    style={{display: "flex", alignItems: "center", gap: "8px"}}>
                    <div className="performer-score small">{percentage}%</div>
                    {/* Botón de descarga */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Evitar que se expanda/contraiga el dropdown
                        downloadClientBitacorasExcel(client.nombre);
                      }}
                      disabled={loadingClientDownload[client.nombre]}
                      style={{
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        border: "none",
                        borderRadius: "6px",
                        width: "24px",
                        height: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: loadingClientDownload[client.nombre] ? "not-allowed" : "pointer",
                        transition: "all 0.2s ease",
                        opacity: loadingClientDownload[client.nombre] ? 0.6 : 1,
                      }}
                      title="Descargar bitácoras en Excel">
                      <i
                        className={
                          loadingClientDownload[client.nombre]
                            ? "fa fa-spinner fa-spin"
                            : "fa fa-download"
                        }
                        style={{
                          fontSize: "10px",
                          color: "white",
                        }}></i>
                    </button>
                    <div className="expand-icon">
                      <i
                        className={`fa fa-chevron-${isExpanded ? "up" : "down"}`}
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          transition: "transform 0.2s ease",
                        }}></i>
                    </div>
                  </div>
                </div>

                {/* Contenido expandible con las bitácoras */}
                {isExpanded && (
                  <div
                    className="client-bitacoras-list"
                    style={{
                      paddingLeft: "40px",
                      paddingRight: "8px",
                      paddingTop: "8px",
                      paddingBottom: "8px",
                      backgroundColor: "rgba(148, 163, 184, 0.05)",
                      borderRadius: "8px",
                      margin: "8px 0",
                      animation: "slideDown 0.3s ease",
                    }}>
                    {isLoading ? (
                      <div className="text-center py-2">
                        <i className="fa fa-spinner fa-spin me-2" style={{fontSize: "12px"}}></i>
                        <span style={{fontSize: "12px", color: "#94a3b8"}}>
                          Cargando bitácoras...
                        </span>
                      </div>
                    ) : bitacoras && bitacoras.length > 0 ? (
                      <div>
                        <div className="bitacoras-header" style={{marginBottom: "12px"}}>
                          <span style={{fontSize: "11px", color: "#64748b", fontWeight: "600"}}>
                            Bitácoras ({bitacoras.length}):
                          </span>
                        </div>
                        <div
                          className="bitacoras-table-container"
                          style={{
                            maxHeight: "400px",
                            overflowY: "auto",
                            overflowX: "auto",
                            border: "1px solid rgba(148, 163, 184, 0.2)",
                            borderRadius: "8px",
                            backgroundColor: "#f8fafc",
                          }}>
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              fontSize: "10px",
                              minWidth: "800px",
                            }}>
                            <thead style={{backgroundColor: "#e2e8f0", position: "sticky", top: 0}}>
                              <tr>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  No. Bitácora
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Fecha de Creación
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Cliente
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Tipo Monitoreo
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Línea de transporte
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Operador
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Origen
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Destino
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Estado
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Usuario
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {bitacoras.map((bitacora, bitIndex) => (
                                <tr
                                  key={bitIndex}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/bitacora/${bitacora._id}`);
                                  }}
                                  style={{
                                    cursor: "pointer",
                                    transition: "background-color 0.2s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "#e0f2fe";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "transparent";
                                  }}>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#1f2937",
                                      fontWeight: "600",
                                    }}>
                                    #{bitacora.bitacora_id}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                    }}>
                                    {new Date(bitacora.fechaCreacion).toLocaleDateString("es-ES", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                    })}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                    }}>
                                    {bitacora.cliente}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                    }}>
                                    {bitacora.tipoMonitoreo}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "120px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.lineaTransporte || "N/A"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "120px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.operadorTransporte || "N/A"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "150px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.origen || "N/A"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "150px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.destino || "N/A"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                    }}>
                                    <span
                                      style={{
                                        padding: "2px 6px",
                                        borderRadius: "12px",
                                        fontSize: "9px",
                                        fontWeight: "600",
                                        textTransform: "uppercase",
                                        backgroundColor:
                                          bitacora.estado === "nueva"
                                            ? "#dbeafe"
                                            : bitacora.estado === "validada"
                                            ? "#fef3c7"
                                            : bitacora.estado === "iniciada"
                                            ? "#d1fae5"
                                            : bitacora.estado === "cerrada"
                                            ? "#fee2e2"
                                            : bitacora.estado === "finalizada"
                                            ? "#e0e7ff"
                                            : "#f3f4f6",
                                        color:
                                          bitacora.estado === "nueva"
                                            ? "#1e40af"
                                            : bitacora.estado === "validada"
                                            ? "#d97706"
                                            : bitacora.estado === "iniciada"
                                            ? "#059669"
                                            : bitacora.estado === "cerrada"
                                            ? "#dc2626"
                                            : bitacora.estado === "finalizada"
                                            ? "#7c3aed"
                                            : "#6b7280",
                                      }}>
                                      {bitacora.estado}
                                    </span>
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "100px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.usuario}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Controles de paginación */}
                        {clientPagination[client.nombre] &&
                          clientPagination[client.nombre].totalPages > 1 && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "8px 12px",
                                borderTop: "1px solid #e5e7eb",
                                fontSize: "11px",
                                backgroundColor: "#f9fafb",
                              }}>
                              <div style={{display: "flex", alignItems: "center", gap: "12px"}}>
                                <span style={{color: "#6b7280"}}>
                                  Página {clientPagination[client.nombre].currentPage} de{" "}
                                  {clientPagination[client.nombre].totalPages} (
                                  {clientPagination[client.nombre].totalCount} total)
                                </span>
                                <div style={{display: "flex", alignItems: "center", gap: "4px"}}>
                                  <span style={{color: "#6b7280", fontSize: "10px"}}>Mostrar:</span>
                                  <select
                                    value={clientPageLimits[client.nombre] || 10}
                                    onChange={(e) =>
                                      handleClientPageLimitChange(
                                        client.nombre,
                                        parseInt(e.target.value)
                                      )
                                    }
                                    style={{
                                      fontSize: "10px",
                                      padding: "2px 4px",
                                      border: "1px solid #d1d5db",
                                      borderRadius: "3px",
                                      backgroundColor: "#fff",
                                      color: "#374151",
                                    }}>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                  </select>
                                </div>
                              </div>
                              <div style={{display: "flex", gap: "4px"}}>
                                <button
                                  onClick={() =>
                                    handleClientPagination(
                                      client.nombre,
                                      clientPagination[client.nombre].currentPage - 1
                                    )
                                  }
                                  disabled={
                                    !clientPagination[client.nombre].hasPrevPage || isLoading
                                  }
                                  style={{
                                    background:
                                      clientPagination[client.nombre].hasPrevPage && !isLoading
                                        ? "#f3f4f6"
                                        : "#e5e7eb",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "4px",
                                    width: "24px",
                                    height: "24px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor:
                                      clientPagination[client.nombre].hasPrevPage && !isLoading
                                        ? "pointer"
                                        : "not-allowed",
                                    fontSize: "10px",
                                    color:
                                      clientPagination[client.nombre].hasPrevPage && !isLoading
                                        ? "#374151"
                                        : "#9ca3af",
                                  }}>
                                  <i className="fa fa-chevron-left"></i>
                                </button>
                                <button
                                  onClick={() =>
                                    handleClientPagination(
                                      client.nombre,
                                      clientPagination[client.nombre].currentPage + 1
                                    )
                                  }
                                  disabled={
                                    !clientPagination[client.nombre].hasNextPage || isLoading
                                  }
                                  style={{
                                    background:
                                      clientPagination[client.nombre].hasNextPage && !isLoading
                                        ? "#f3f4f6"
                                        : "#e5e7eb",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "4px",
                                    width: "24px",
                                    height: "24px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor:
                                      clientPagination[client.nombre].hasNextPage && !isLoading
                                        ? "pointer"
                                        : "not-allowed",
                                    fontSize: "10px",
                                    color:
                                      clientPagination[client.nombre].hasNextPage && !isLoading
                                        ? "#374151"
                                        : "#9ca3af",
                                  }}>
                                  <i className="fa fa-chevron-right"></i>
                                </button>
                              </div>
                            </div>
                          )}
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <span style={{fontSize: "12px", color: "#94a3b8"}}>
                          No hay bitácoras disponibles para este cliente
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center text-muted small">No hay datos disponibles</div>
        )}
      </div>
    );
  };

  const renderTopOperadores = () => {
    const {topOperadores} = dashboardStats;
    const totalOperadores =
      topOperadores && topOperadores.length > 0
        ? topOperadores.reduce((sum, operador) => sum + operador.count, 0)
        : 0;

    return (
      <div className="top-performers" style={{maxHeight: "400px", overflowY: "auto"}}>
        {topOperadores && topOperadores.length > 0 ? (
          topOperadores.map((operador, index) => {
            const percentage =
              totalOperadores > 0 ? Math.round((operador.count / totalOperadores) * 100) : 0;
            const isExpanded = expandedUsers[operador.name];
            const bitacoras = userBitacoras[operador.name] || [];
            const isLoading = loadingUserBitacoras[operador.name];

            return (
              <div key={index} className="user-dropdown-item">
                {/* Header del usuario - clickeable para expandir */}
                <div
                  className="performer-item"
                  onClick={() => toggleUserDropdown(operador.name)}
                  style={{cursor: "pointer", transition: "all 0.2s ease"}}>
                  <div className="performer-rank small">#{index + 1}</div>
                  <div className="performer-info">
                    <div className="performer-name small">{operador.name}</div>
                    <div className="performer-stats small">
                      {formatNumber(operador.count)} bitácoras
                    </div>
                  </div>
                  <div
                    className="performer-score-container"
                    style={{display: "flex", alignItems: "center", gap: "8px"}}>
                    <div className="performer-score small">{percentage}%</div>
                    {/* Botón de descarga */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Evitar que se expanda/contraiga el dropdown
                        downloadUserBitacorasExcel(operador.name);
                      }}
                      disabled={loadingUserDownload[operador.name]}
                      style={{
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        border: "none",
                        borderRadius: "6px",
                        width: "24px",
                        height: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: loadingUserDownload[operador.name] ? "not-allowed" : "pointer",
                        transition: "all 0.2s ease",
                        opacity: loadingUserDownload[operador.name] ? 0.6 : 1,
                      }}
                      title="Descargar bitácoras en Excel">
                      <i
                        className={
                          loadingUserDownload[operador.name]
                            ? "fa fa-spinner fa-spin"
                            : "fa fa-download"
                        }
                        style={{
                          fontSize: "10px",
                          color: "white",
                        }}></i>
                    </button>
                    <div className="expand-icon">
                      <i
                        className={`fa fa-chevron-${isExpanded ? "up" : "down"}`}
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          transition: "transform 0.2s ease",
                        }}></i>
                    </div>
                  </div>
                </div>

                {/* Contenido expandible con las bitácoras */}
                {isExpanded && (
                  <div
                    className="user-bitacoras-list"
                    style={{
                      paddingLeft: "40px",
                      paddingRight: "8px",
                      paddingTop: "8px",
                      paddingBottom: "8px",
                      backgroundColor: "rgba(148, 163, 184, 0.05)",
                      borderRadius: "8px",
                      margin: "8px 0",
                      animation: "slideDown 0.3s ease",
                    }}>
                    {isLoading ? (
                      <div className="text-center py-2">
                        <i className="fa fa-spinner fa-spin me-2" style={{fontSize: "12px"}}></i>
                        <span style={{fontSize: "12px", color: "#94a3b8"}}>
                          Cargando bitácoras...
                        </span>
                      </div>
                    ) : bitacoras && bitacoras.length > 0 ? (
                      <div>
                        <div className="bitacoras-header" style={{marginBottom: "12px"}}>
                          <span style={{fontSize: "11px", color: "#64748b", fontWeight: "600"}}>
                            Bitácoras ({bitacoras.length}):
                          </span>
                        </div>
                        <div
                          className="bitacoras-table-container"
                          style={{
                            maxHeight: "400px",
                            overflowY: "auto",
                            overflowX: "auto",
                            border: "1px solid rgba(148, 163, 184, 0.2)",
                            borderRadius: "8px",
                            backgroundColor: "#f8fafc",
                          }}>
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              fontSize: "10px",
                              minWidth: "800px",
                            }}>
                            <thead style={{backgroundColor: "#e2e8f0", position: "sticky", top: 0}}>
                              <tr>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  No. Bitácora
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Fecha de Creación
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Cliente
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Tipo Monitoreo
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Línea de transporte
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Operador
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Origen
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Destino
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Estado
                                </th>
                                <th
                                  style={{
                                    padding: "8px 6px",
                                    borderBottom: "1px solid #cbd5e1",
                                    fontWeight: "600",
                                    color: "#374151",
                                    textAlign: "left",
                                  }}>
                                  Usuario
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {bitacoras.map((bitacora, bitIndex) => (
                                <tr
                                  key={bitIndex}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/bitacora/${bitacora._id}`);
                                  }}
                                  style={{
                                    cursor: "pointer",
                                    transition: "background-color 0.2s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "#e0f2fe";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "transparent";
                                  }}>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#1f2937",
                                      fontWeight: "600",
                                    }}>
                                    #{bitacora.bitacora_id}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                    }}>
                                    {new Date(bitacora.fechaCreacion).toLocaleDateString("es-ES", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                    })}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                    }}>
                                    {bitacora.cliente}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                    }}>
                                    {bitacora.tipoMonitoreo}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "120px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.lineaTransporte || "N/A"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "120px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.operadorTransporte || "N/A"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "150px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.origen || "N/A"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "150px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.destino || "N/A"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                    }}>
                                    <span
                                      style={{
                                        padding: "2px 6px",
                                        borderRadius: "12px",
                                        fontSize: "9px",
                                        fontWeight: "600",
                                        textTransform: "uppercase",
                                        backgroundColor:
                                          bitacora.estado === "nueva"
                                            ? "#dbeafe"
                                            : bitacora.estado === "validada"
                                            ? "#fef3c7"
                                            : bitacora.estado === "iniciada"
                                            ? "#d1fae5"
                                            : bitacora.estado === "cerrada"
                                            ? "#fee2e2"
                                            : bitacora.estado === "finalizada"
                                            ? "#e0e7ff"
                                            : "#f3f4f6",
                                        color:
                                          bitacora.estado === "nueva"
                                            ? "#1e40af"
                                            : bitacora.estado === "validada"
                                            ? "#d97706"
                                            : bitacora.estado === "iniciada"
                                            ? "#059669"
                                            : bitacora.estado === "cerrada"
                                            ? "#dc2626"
                                            : bitacora.estado === "finalizada"
                                            ? "#7c3aed"
                                            : "#6b7280",
                                      }}>
                                      {bitacora.estado}
                                    </span>
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 6px",
                                      borderBottom: "1px solid #e5e7eb",
                                      color: "#374151",
                                      maxWidth: "100px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>
                                    {bitacora.usuario}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Controles de paginación */}
                        {userPagination[operador.name] &&
                          userPagination[operador.name].totalPages > 1 && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "8px 12px",
                                borderTop: "1px solid #e5e7eb",
                                fontSize: "11px",
                                backgroundColor: "#f9fafb",
                              }}>
                              <div style={{display: "flex", alignItems: "center", gap: "12px"}}>
                                <span style={{color: "#6b7280"}}>
                                  Página {userPagination[operador.name].currentPage} de{" "}
                                  {userPagination[operador.name].totalPages} (
                                  {userPagination[operador.name].totalCount} total)
                                </span>
                                <div style={{display: "flex", alignItems: "center", gap: "4px"}}>
                                  <span style={{color: "#6b7280", fontSize: "10px"}}>Mostrar:</span>
                                  <select
                                    value={userPageLimits[operador.name] || 10}
                                    onChange={(e) =>
                                      handleUserPageLimitChange(
                                        operador.name,
                                        parseInt(e.target.value)
                                      )
                                    }
                                    style={{
                                      fontSize: "10px",
                                      padding: "2px 4px",
                                      border: "1px solid #d1d5db",
                                      borderRadius: "3px",
                                      backgroundColor: "#fff",
                                      color: "#374151",
                                    }}>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                  </select>
                                </div>
                              </div>
                              <div style={{display: "flex", gap: "4px"}}>
                                <button
                                  onClick={() =>
                                    handleUserPagination(
                                      operador.name,
                                      userPagination[operador.name].currentPage - 1
                                    )
                                  }
                                  disabled={!userPagination[operador.name].hasPrevPage || isLoading}
                                  style={{
                                    background:
                                      userPagination[operador.name].hasPrevPage && !isLoading
                                        ? "#f3f4f6"
                                        : "#e5e7eb",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "4px",
                                    width: "24px",
                                    height: "24px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor:
                                      userPagination[operador.name].hasPrevPage && !isLoading
                                        ? "pointer"
                                        : "not-allowed",
                                    fontSize: "10px",
                                    color:
                                      userPagination[operador.name].hasPrevPage && !isLoading
                                        ? "#374151"
                                        : "#9ca3af",
                                  }}>
                                  <i className="fa fa-chevron-left"></i>
                                </button>
                                <button
                                  onClick={() =>
                                    handleUserPagination(
                                      operador.name,
                                      userPagination[operador.name].currentPage + 1
                                    )
                                  }
                                  disabled={!userPagination[operador.name].hasNextPage || isLoading}
                                  style={{
                                    background:
                                      userPagination[operador.name].hasNextPage && !isLoading
                                        ? "#f3f4f6"
                                        : "#e5e7eb",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "4px",
                                    width: "24px",
                                    height: "24px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor:
                                      userPagination[operador.name].hasNextPage && !isLoading
                                        ? "pointer"
                                        : "not-allowed",
                                    fontSize: "10px",
                                    color:
                                      userPagination[operador.name].hasNextPage && !isLoading
                                        ? "#374151"
                                        : "#9ca3af",
                                  }}>
                                  <i className="fa fa-chevron-right"></i>
                                </button>
                              </div>
                            </div>
                          )}
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <span style={{fontSize: "12px", color: "#94a3b8"}}>
                          No hay bitácoras disponibles para este usuario
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center text-muted small">No hay datos disponibles</div>
        )}
      </div>
    );
  };

  const renderUsuariosBarChart = () => {
    const {topOperadores} = dashboardStats;

    if (!topOperadores || topOperadores.length === 0) {
      return <div className="text-center text-muted">No hay datos de usuarios disponibles</div>;
    }

    const maxCount = Math.max(...topOperadores.map((operador) => operador.count));

    return (
      <div
        className="horizontal-bar-chart-container"
        style={{
          maxHeight: "300px",
          overflowY: "auto",
          paddingRight: "8px", // Espacio para evitar que se corten los números
          marginRight: "-8px", // Compensar el padding
        }}>
        {topOperadores.map((operador, index) => {
          const barWidth = maxCount > 0 ? (operador.count / maxCount) * 180 : 0; // Reducido de 200 a 180
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
            <div
              key={index}
              className="horizontal-bar-item"
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "12px",
                padding: "8px 12px 8px 0", // Más padding a la derecha
                backgroundColor: "transparent", // Quitar fondo blanco
              }}>
              <div
                className="bar-label"
                style={{
                  width: "120px",
                  fontSize: "12px",
                  fontWeight: "500",
                  color: "#ffffff",
                  marginRight: "12px",
                  textAlign: "right",
                  flexShrink: 0, // No permitir que se encoja
                }}>
                {operador.name}
              </div>
              <div
                className="bar-container"
                style={{
                  flex: 1,
                  height: "20px",
                  backgroundColor: "rgba(59, 130, 246, 0.08)", // Azul muy opaco
                  borderRadius: "10px",
                  position: "relative",
                  marginRight: "12px",
                  minWidth: "100px", // Ancho mínimo para evitar colapso
                }}>
                <div
                  className="bar-fill"
                  style={{
                    width: `${barWidth}px`,
                    height: "100%",
                    backgroundColor: color,
                    borderRadius: "10px",
                    transition: "width 0.3s ease",
                    minWidth: operador.count > 0 ? "4px" : "0px",
                  }}></div>
              </div>
              <div
                className="bar-value"
                style={{
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: color,
                  minWidth: "50px", // Aumentado de 40px a 50px
                  textAlign: "right",
                  flexShrink: 0, // No permitir que se encoja
                  paddingLeft: "8px", // Espacio adicional
                }}>
                {formatNumber(operador.count)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTopLineasTransporte = () => {
    const {topLineasTransporte} = dashboardStats;
    const totalLineas =
      topLineasTransporte && topLineasTransporte.length > 0
        ? topLineasTransporte.reduce((sum, linea) => sum + linea.count, 0)
        : 0;

    return (
      <div className="top-performers" style={{maxHeight: "300px", overflowY: "auto"}}>
        {topLineasTransporte && topLineasTransporte.length > 0 ? (
          topLineasTransporte.map((linea, index) => {
            const percentage = totalLineas > 0 ? Math.round((linea.count / totalLineas) * 100) : 0;
            return (
              <div key={index} className="performer-item">
                <div className="performer-rank small">#{index + 1}</div>
                <div className="performer-info">
                  <div className="performer-name small">{linea.nombre}</div>
                  <div className="performer-stats small">
                    {formatNumber(linea.count)} transportes
                  </div>
                </div>
                <div className="performer-score small">{percentage}%</div>
              </div>
            );
          })
        ) : (
          <div className="text-center text-muted small">No hay datos disponibles</div>
        )}
      </div>
    );
  };

  const renderTopOperadoresTransportes = () => {
    const {topOperadoresTransportes} = dashboardStats;
    const totalOperadoresTransportes =
      topOperadoresTransportes && topOperadoresTransportes.length > 0
        ? topOperadoresTransportes.reduce((sum, operador) => sum + operador.count, 0)
        : 0;

    return (
      <div className="top-performers" style={{maxHeight: "300px", overflowY: "auto"}}>
        {topOperadoresTransportes && topOperadoresTransportes.length > 0 ? (
          topOperadoresTransportes.map((operador, index) => {
            const percentage =
              totalOperadoresTransportes > 0
                ? Math.round((operador.count / totalOperadoresTransportes) * 100)
                : 0;
            return (
              <div key={index} className="performer-item">
                <div className="performer-rank small">#{index + 1}</div>
                <div className="performer-info">
                  <div className="performer-name small">{operador.nombre}</div>
                  <div className="performer-stats small">
                    {formatNumber(operador.count)} transportes
                  </div>
                </div>
                <div className="performer-score small">{percentage}%</div>
              </div>
            );
          })
        ) : (
          <div className="text-center text-muted small">No hay datos disponibles</div>
        )}
      </div>
    );
  };

  const renderLineasTransporteBarChart = () => {
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
      <div
        className="horizontal-bar-chart-container"
        style={{
          maxHeight: "300px",
          overflowY: "auto",
          paddingRight: "8px", // Espacio para evitar que se corten los números
          marginRight: "-8px", // Compensar el padding
        }}>
        {topLineasTransporte.map((linea, index) => {
          const barWidth = maxCount > 0 ? (linea.count / maxCount) * 180 : 0; // Reducido de 200 a 180
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
            <div
              key={index}
              className="horizontal-bar-item"
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "12px",
                padding: "8px 12px 8px 0", // Más padding a la derecha
                backgroundColor: "transparent", // Quitar fondo blanco
              }}>
              <div
                className="bar-label"
                style={{
                  width: "120px",
                  fontSize: "12px",
                  fontWeight: "500",
                  color: "#ffffff",
                  marginRight: "12px",
                  textAlign: "right",
                  flexShrink: 0, // No permitir que se encoja
                }}>
                {linea.nombre}
              </div>
              <div
                className="bar-container"
                style={{
                  flex: 1,
                  height: "20px",
                  backgroundColor: "rgba(59, 130, 246, 0.08)", // Azul muy opaco
                  borderRadius: "10px",
                  position: "relative",
                  marginRight: "12px",
                  minWidth: "100px", // Ancho mínimo para evitar colapso
                }}>
                <div
                  className="bar-fill"
                  style={{
                    width: `${barWidth}px`,
                    height: "100%",
                    backgroundColor: color,
                    borderRadius: "10px",
                    transition: "width 0.3s ease",
                    minWidth: linea.count > 0 ? "4px" : "0px",
                  }}></div>
              </div>
              <div
                className="bar-value"
                style={{
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: color,
                  minWidth: "50px", // Aumentado de 40px a 50px
                  textAlign: "right",
                  flexShrink: 0, // No permitir que se encoja
                  paddingLeft: "8px", // Espacio adicional
                }}>
                {formatNumber(linea.count)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderOperadoresTransportesBarChart = () => {
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
      <div
        className="horizontal-bar-chart-container"
        style={{
          maxHeight: "300px",
          overflowY: "auto",
          paddingRight: "8px", // Espacio para evitar que se corten los números
          marginRight: "-8px", // Compensar el padding
        }}>
        {topOperadoresTransportes.map((operador, index) => {
          const barWidth = maxCount > 0 ? (operador.count / maxCount) * 180 : 0; // Reducido de 200 a 180
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
            <div
              key={index}
              className="horizontal-bar-item"
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "12px",
                padding: "8px 12px 8px 0", // Más padding a la derecha
                backgroundColor: "transparent", // Quitar fondo blanco
              }}>
              <div
                className="bar-label"
                style={{
                  width: "120px",
                  fontSize: "12px",
                  fontWeight: "500",
                  color: "#ffffff",
                  marginRight: "12px",
                  textAlign: "right",
                  flexShrink: 0, // No permitir que se encoja
                }}>
                {operador.nombre}
              </div>
              <div
                className="bar-container"
                style={{
                  flex: 1,
                  height: "20px",
                  backgroundColor: "rgba(59, 130, 246, 0.08)", // Azul muy opaco
                  borderRadius: "10px",
                  position: "relative",
                  marginRight: "12px",
                  minWidth: "100px", // Ancho mínimo para evitar colapso
                }}>
                <div
                  className="bar-fill"
                  style={{
                    width: `${barWidth}px`,
                    height: "100%",
                    backgroundColor: color,
                    borderRadius: "10px",
                    transition: "width 0.3s ease",
                    minWidth: operador.count > 0 ? "4px" : "0px",
                  }}></div>
              </div>
              <div
                className="bar-value"
                style={{
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: color,
                  minWidth: "50px", // Aumentado de 40px a 50px
                  textAlign: "right",
                  flexShrink: 0, // No permitir que se encoja
                  paddingLeft: "8px", // Espacio adicional
                }}>
                {formatNumber(operador.count)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
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
            filters={
              <div className="filter-card border-0 p-0 bg-transparent">
                <div className="filter-header d-flex justify-content-end align-items-center mb-2">
                  <div className="d-flex align-items-center gap-2">
                    {loading && (
                      <span className="badge bg-warning">
                        <i className="fa fa-spinner fa-spin me-1"></i>
                        Cargando...
                      </span>
                    )}
                    {(appliedFechaDesde ||
                      appliedFechaHasta !== new Date().toISOString().split("T")[0] ||
                      appliedClientFilter !== "all" ||
                      appliedLineaTransporteFilter !== "all" ||
                      appliedOperadorFilter !== "all") && (
                      <span className="badge bg-primary">
                        <i className="fa fa-filter me-1"></i>
                        Filtros Activos
                      </span>
                    )}
                  </div>
                </div>
                <div className="filter-content">
                  <div className="row g-2 g-md-3 align-items-end">
                    {/* Filtros de fecha primero */}
                    <div className="col-12 col-sm-6 col-lg-2">
                      <div className="filter-section">
                        <label className="form-label small mb-1">Fecha Desde:</label>
                        <input
                          type="date"
                          value={fechaDesde}
                          onChange={(e) => setFechaDesde(e.target.value)}
                          className="filter-select form-control form-control-sm"
                        />
                      </div>
                    </div>
                    <div className="col-12 col-sm-6 col-lg-2">
                      <div className="filter-section">
                        <label className="form-label small mb-1">Fecha Hasta:</label>
                        <input
                          type="date"
                          value={fechaHasta}
                          onChange={(e) => setFechaHasta(e.target.value)}
                          className="filter-select form-control form-control-sm"
                        />
                      </div>
                    </div>

                    {/* Filtro de cliente después */}
                    <div className="col-12 col-sm-6 col-lg-2">
                      <div className="filter-section">
                        <label className="form-label small mb-1">Cliente:</label>
                        <select
                          value={clientFilter}
                          onChange={(e) => {
                            const newClientFilter = e.target.value;
                            setClientFilter(newClientFilter);

                            // Reset transport line filter when client changes
                            if (newClientFilter !== clientFilter) {
                              setLineaTransporteFilter("all");
                              setOperadorFilter("all");
                            }
                          }}
                          className="filter-select form-select form-select-sm">
                          <option value="all">Todos los clientes</option>
                          {availableClients && availableClients.length > 0
                            ? availableClients
                                .filter((client) => client && client.razon_social)
                                .sort((a, b) => a.razon_social.localeCompare(b.razon_social))
                                .map((client) => (
                                  <option key={client._id} value={client.razon_social}>
                                    {client.razon_social}
                                  </option>
                                ))
                            : null}
                        </select>
                      </div>
                    </div>

                    {/* Filtros de línea de transporte y operador */}
                    <div className="col-12 col-sm-6 col-lg-2">
                      <div className="filter-section">
                        <label className="form-label small mb-1">
                          Línea Transporte:
                          {loadingLineasTransporte && (
                            <i className="fa fa-spinner fa-spin ms-1"></i>
                          )}
                        </label>
                        <select
                          value={lineaTransporteFilter}
                          onChange={(e) => {
                            const newLineaTransporteFilter = e.target.value;
                            setLineaTransporteFilter(newLineaTransporteFilter);

                            // Reset operator filter when transport line changes
                            if (newLineaTransporteFilter !== lineaTransporteFilter) {
                              setOperadorFilter("all");
                            }
                          }}
                          className="filter-select form-select form-select-sm"
                          disabled={loadingLineasTransporte || clientFilter === "all"}>
                          <option value="all">
                            {clientFilter === "all"
                              ? "Selecciona un cliente primero"
                              : "Todas las líneas"}
                          </option>
                          {availableLineasTransporte && availableLineasTransporte.length > 0
                            ? availableLineasTransporte
                                .filter((linea) => linea && linea.nombre)
                                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                                .map((linea) => (
                                  <option key={linea._id} value={linea.nombre}>
                                    {linea.nombre}
                                  </option>
                                ))
                            : null}
                        </select>
                      </div>
                    </div>
                    <div className="col-12 col-sm-6 col-lg-2">
                      <div className="filter-section">
                        <label className="form-label small mb-1">
                          Operador:
                          {loadingOperadores && <i className="fa fa-spinner fa-spin ms-1"></i>}
                        </label>
                        <select
                          value={operadorFilter}
                          onChange={(e) => setOperadorFilter(e.target.value)}
                          className="filter-select form-select form-select-sm"
                          disabled={loadingOperadores || lineaTransporteFilter === "all"}>
                          <option value="all">
                            {lineaTransporteFilter === "all"
                              ? "Selecciona una línea de transporte primero"
                              : "Todos los operadores"}
                          </option>
                          {availableOperadores && availableOperadores.length > 0
                            ? availableOperadores
                                .filter((operador) => operador && operador.nombre)
                                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                                .map((operador) => (
                                  <option key={operador._id} value={operador.nombre}>
                                    {operador.nombre}
                                  </option>
                                ))
                            : null}
                        </select>
                      </div>
                    </div>
                    <div className="col-12 col-sm-6 col-lg-2">
                      <div className="filter-actions d-flex justify-content-end gap-2">
                        <button
                          className="filter-btn btn btn-outline-primary btn-sm"
                          onClick={applyFilters}>
                          <i className="fa fa-check me-1"></i>
                        </button>
                        <button
                          className="filter-btn btn btn-outline-secondary btn-sm"
                          onClick={resetFilters}>
                          <i className="fa fa-refresh me-1"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }
          />

          <div className="container-fluid px-3 px-md-4 mt-4">

            {/* Estadísticas principales con totales y porcentajes integrados */}
            <div className="row mb-3 mb-md-4 g-2 g-md-3">
              {(appliedClientFilter !== "all" ||
                appliedLineaTransporteFilter !== "all" ||
                appliedOperadorFilter !== "all" ||
                appliedFechaDesde ||
                appliedFechaHasta !== new Date().toISOString().split("T")[0]) && (
                <div className="col-12 mb-2">
                  <div className="alert alert-info py-2" style={{fontSize: "12px"}}>
                    <i className="fa fa-info-circle me-2"></i>
                    <strong>Estadísticas filtradas:</strong>{" "}
                    {appliedClientFilter !== "all" && `Cliente: ${appliedClientFilter} | `}
                    {appliedLineaTransporteFilter !== "all" &&
                      `Línea: ${appliedLineaTransporteFilter} | `}
                    {appliedOperadorFilter !== "all" && `Operador: ${appliedOperadorFilter} | `}
                    {appliedFechaDesde && `Desde: ${appliedFechaDesde} | `}
                    {appliedFechaHasta !== new Date().toISOString().split("T")[0] &&
                      `Hasta: ${appliedFechaHasta}`}
                  </div>
                </div>
              )}
              {/* Total Bitácoras */}
              <div className="col-6 col-lg mb-2 mb-lg-0">
                <div className="stat-card h-100">
                  <div
                    className="stat-icon"
                    style={{backgroundColor: "#6b7280 !important", color: "#fff"}}>
                    <i className="fa fa-book"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value fs-4 fs-md-3">
                      {formatNumber(dashboardStats.totalBitacoras || 0)}
                    </div>
                    <div className="stat-label small">Total Bitácoras</div>
                    <div
                      className="stat-percentage small"
                      style={{color: "#6b7280", fontWeight: "600"}}>
                      100%
                    </div>
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
                    <div className="stat-value fs-4 fs-md-3">
                      {formatNumber(dashboardStats.nuevasBitacoras || 0)}
                    </div>
                    <div className="stat-label small">Nuevas</div>
                    <div
                      className="stat-percentage small"
                      style={{color: "#10b981", fontWeight: "600"}}>
                      {dashboardStats.totalBitacoras > 0 &&
                      dashboardStats.nuevasBitacoras !== undefined
                        ? Math.round(
                            (dashboardStats.nuevasBitacoras / dashboardStats.totalBitacoras) * 100
                          )
                        : 0}
                      %
                    </div>
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
                    <div className="stat-value fs-4 fs-md-3">
                      {formatNumber(dashboardStats.enProcesoBitacoras || 0)}
                    </div>
                    <div className="stat-label small">En proceso</div>
                    <div
                      className="stat-percentage small"
                      style={{color: "#3b82f6", fontWeight: "600"}}>
                      {dashboardStats.totalBitacoras > 0 &&
                      dashboardStats.enProcesoBitacoras !== undefined
                        ? Math.round(
                            (dashboardStats.enProcesoBitacoras / dashboardStats.totalBitacoras) *
                              100
                          )
                        : 0}
                      %
                    </div>
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
                    <div className="stat-value fs-4 fs-md-3">
                      {formatNumber(dashboardStats.cerradasBitacoras || 0)}
                    </div>
                    <div className="stat-label small">Cerradas</div>
                    <div
                      className="stat-percentage small"
                      style={{color: "#ef4444", fontWeight: "600"}}>
                      {dashboardStats.totalBitacoras > 0 &&
                      dashboardStats.cerradasBitacoras !== undefined
                        ? Math.round(
                            (dashboardStats.cerradasBitacoras / dashboardStats.totalBitacoras) * 100
                          )
                        : 0}
                      %
                    </div>
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
                    <div className="stat-value fs-4 fs-md-3">
                      {formatNumber(getTotalAnomalias())}
                    </div>
                    <div className="stat-label small">Con Anomalías</div>
                    <div
                      className="stat-percentage small"
                      style={{color: "#f59e0b", fontWeight: "600"}}>
                      {dashboardStats.totalBitacoras > 0
                        ? Math.round((getTotalAnomalias() / dashboardStats.totalBitacoras) * 100)
                        : 0}
                      %
                    </div>
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
                      {(appliedClientFilter !== "all" ||
                        appliedLineaTransporteFilter !== "all" ||
                        appliedOperadorFilter !== "all" ||
                        appliedFechaDesde ||
                        appliedFechaHasta !== new Date().toISOString().split("T")[0]) && (
                        <span className="badge bg-info" style={{fontSize: "10px"}}>
                          <i className="fa fa-filter me-1"></i>
                          Filtrado
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="chart-body">
                    {(appliedClientFilter !== "all" ||
                      appliedLineaTransporteFilter !== "all" ||
                      appliedOperadorFilter !== "all" ||
                      appliedFechaDesde ||
                      appliedFechaHasta !== new Date().toISOString().split("T")[0]) && (
                      <div className="alert alert-info py-2 mb-3" style={{fontSize: "12px"}}>
                        <i className="fa fa-info-circle me-2"></i>
                        <strong>Filtros activos:</strong>{" "}
                        {appliedClientFilter !== "all" && `Cliente: ${appliedClientFilter} | `}
                        {appliedLineaTransporteFilter !== "all" &&
                          `Línea: ${appliedLineaTransporteFilter} | `}
                        {appliedOperadorFilter !== "all" && `Operador: ${appliedOperadorFilter} | `}
                        {appliedFechaDesde && `Desde: ${appliedFechaDesde} | `}
                        {appliedFechaHasta !== new Date().toISOString().split("T")[0] &&
                          `Hasta: ${appliedFechaHasta}`}
                      </div>
                    )}
                    <div className="overflow-auto">{renderMonthlyTrendChart()}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista descendente de clientes */}
            <div className="row mb-3 mb-md-4">
              <div className="col-12">
                <div className="chart-card">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="mb-0">Lista de Clientes</h6>
                      {(appliedClientFilter !== "all" ||
                        appliedLineaTransporteFilter !== "all" ||
                        appliedOperadorFilter !== "all" ||
                        appliedFechaDesde ||
                        appliedFechaHasta !== new Date().toISOString().split("T")[0]) && (
                        <span className="badge bg-info" style={{fontSize: "10px"}}>
                          <i className="fa fa-filter me-1"></i>
                          Filtrado
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="chart-body">
                    {(appliedClientFilter !== "all" ||
                      appliedLineaTransporteFilter !== "all" ||
                      appliedOperadorFilter !== "all" ||
                      appliedFechaDesde ||
                      appliedFechaHasta !== new Date().toISOString().split("T")[0]) && (
                      <div className="alert alert-info py-2 mb-3" style={{fontSize: "12px"}}>
                        <i className="fa fa-info-circle me-2"></i>
                        <strong>Filtros activos:</strong>{" "}
                        {appliedClientFilter !== "all" && `Cliente: ${appliedClientFilter} | `}
                        {appliedLineaTransporteFilter !== "all" &&
                          `Línea: ${appliedLineaTransporteFilter} | `}
                        {appliedOperadorFilter !== "all" && `Operador: ${appliedOperadorFilter} | `}
                        {appliedFechaDesde && `Desde: ${appliedFechaDesde} | `}
                        {appliedFechaHasta !== new Date().toISOString().split("T")[0] &&
                          `Hasta: ${appliedFechaHasta}`}
                      </div>
                    )}
                    <div className="overflow-auto">{renderTopClients()}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tipos de monitoreo */}
            <div className="row mb-3 mb-md-4">
              <div className="col-12">
                <div className="chart-card">
                  <div className="chart-header">
                    <h6 className="mb-0">Tipos de Monitoreo</h6>
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
                      {(appliedClientFilter !== "all" ||
                        appliedLineaTransporteFilter !== "all" ||
                        appliedOperadorFilter !== "all" ||
                        appliedFechaDesde ||
                        appliedFechaHasta !== new Date().toISOString().split("T")[0]) && (
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
                    {(appliedClientFilter !== "all" ||
                      appliedLineaTransporteFilter !== "all" ||
                      appliedOperadorFilter !== "all" ||
                      appliedFechaDesde ||
                      appliedFechaHasta !== new Date().toISOString().split("T")[0]) && (
                      <div className="alert alert-info py-2 mb-3" style={{fontSize: "12px"}}>
                        <i className="fa fa-info-circle me-2"></i>
                        <strong>Filtros activos:</strong>{" "}
                        {appliedClientFilter !== "all" && `Cliente: ${appliedClientFilter} | `}
                        {appliedLineaTransporteFilter !== "all" &&
                          `Línea: ${appliedLineaTransporteFilter} | `}
                        {appliedOperadorFilter !== "all" && `Operador: ${appliedOperadorFilter} | `}
                        {appliedFechaDesde && `Desde: ${appliedFechaDesde} | `}
                        {appliedFechaHasta !== new Date().toISOString().split("T")[0] &&
                          `Hasta: ${appliedFechaHasta}`}
                      </div>
                    )}
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
                      {(appliedClientFilter !== "all" ||
                        appliedLineaTransporteFilter !== "all" ||
                        appliedOperadorFilter !== "all" ||
                        appliedFechaDesde ||
                        appliedFechaHasta !== new Date().toISOString().split("T")[0]) && (
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
                    {(appliedClientFilter !== "all" ||
                      appliedLineaTransporteFilter !== "all" ||
                      appliedOperadorFilter !== "all" ||
                      appliedFechaDesde ||
                      appliedFechaHasta !== new Date().toISOString().split("T")[0]) && (
                      <div className="alert alert-info py-2 mb-3" style={{fontSize: "12px"}}>
                        <i className="fa fa-info-circle me-2"></i>
                        <strong>Filtros activos:</strong>{" "}
                        {appliedClientFilter !== "all" && `Cliente: ${appliedClientFilter} | `}
                        {appliedLineaTransporteFilter !== "all" &&
                          `Línea: ${appliedLineaTransporteFilter} | `}
                        {appliedOperadorFilter !== "all" && `Operador: ${appliedOperadorFilter} | `}
                        {appliedFechaDesde && `Desde: ${appliedFechaDesde} | `}
                        {appliedFechaHasta !== new Date().toISOString().split("T")[0] &&
                          `Hasta: ${appliedFechaHasta}`}
                      </div>
                    )}
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
                <div className="chart-card">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="mb-0">Análisis Geográfico</h6>
                      {(appliedClientFilter !== "all" ||
                        appliedLineaTransporteFilter !== "all" ||
                        appliedOperadorFilter !== "all" ||
                        appliedFechaDesde ||
                        appliedFechaHasta !== new Date().toISOString().split("T")[0]) && (
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
                    {(appliedClientFilter !== "all" ||
                      appliedLineaTransporteFilter !== "all" ||
                      appliedOperadorFilter !== "all" ||
                      appliedFechaDesde ||
                      appliedFechaHasta !== new Date().toISOString().split("T")[0]) && (
                      <div className="alert alert-info py-2 mb-3" style={{fontSize: "12px"}}>
                        <i className="fa fa-info-circle me-2"></i>
                        <strong>Filtros activos:</strong>{" "}
                        {appliedClientFilter !== "all" && `Cliente: ${appliedClientFilter} | `}
                        {appliedLineaTransporteFilter !== "all" &&
                          `Línea: ${appliedLineaTransporteFilter} | `}
                        {appliedOperadorFilter !== "all" && `Operador: ${appliedOperadorFilter} | `}
                        {appliedFechaDesde && `Desde: ${appliedFechaDesde} | `}
                        {appliedFechaHasta !== new Date().toISOString().split("T")[0] &&
                          `Hasta: ${appliedFechaHasta}`}
                      </div>
                    )}
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
                <div className="chart-card">
                  <div className="chart-header d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="mb-0">Lista de Usuarios</h6>
                      {(appliedClientFilter !== "all" ||
                        appliedLineaTransporteFilter !== "all" ||
                        appliedOperadorFilter !== "all" ||
                        appliedFechaDesde ||
                        appliedFechaHasta !== new Date().toISOString().split("T")[0]) && (
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
                    {(appliedClientFilter !== "all" ||
                      appliedLineaTransporteFilter !== "all" ||
                      appliedOperadorFilter !== "all" ||
                      appliedFechaDesde ||
                      appliedFechaHasta !== new Date().toISOString().split("T")[0]) && (
                      <div className="alert alert-info py-2 mb-3" style={{fontSize: "12px"}}>
                        <i className="fa fa-info-circle me-2"></i>
                        <strong>Filtros activos:</strong>{" "}
                        {appliedClientFilter !== "all" && `Cliente: ${appliedClientFilter} | `}
                        {appliedLineaTransporteFilter !== "all" &&
                          `Línea: ${appliedLineaTransporteFilter} | `}
                        {appliedOperadorFilter !== "all" && `Operador: ${appliedOperadorFilter} | `}
                        {appliedFechaDesde && `Desde: ${appliedFechaDesde} | `}
                        {appliedFechaHasta !== new Date().toISOString().split("T")[0] &&
                          `Hasta: ${appliedFechaHasta}`}
                      </div>
                    )}
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
