import React, {useState, useEffect} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {useWialon} from "../../context/WialonProvider";
import Sidebar from "../Sidebar";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faPlus} from "@fortawesome/free-solid-svg-icons";
import {useAuth} from "../../context/AuthContext";
import {Form, Tabs, Tab} from "react-bootstrap";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import CreateTransporteModal from "./Transportes/CreateTransporteModal";
import NewEventModal from "./Eventos/NewEventModal";
import {generateAuditoriasFromChanges} from "../../utils/auditoria";
import {getLocationText} from "../../utils/api";
import {convertToUpperCase} from "../../utils/utils";
import ModalTemplate from "../../components/ModalTemplate"; // make sure path is valid
import {useSidebar} from "../../context/SidebarContext";
import PageHeader from "../PageHeader";
import CellBadge from "../CellBadge";
import TextInput from "../TextInput";
import {Select} from "../Select";
import TextArea from "../TextArea";

const getTransporteLabel = (transporte) => {
  const id = transporte.id || "";
  if (!id) return "Sin ID";
  if (id.startsWith("T") && id.includes("_")) return id;
  const parts = id.split("_");
  if (parts.length >= 3) return `${parts[1]} - ${parts[2]}`;
  if (parts.length === 2) return `${parts[0]} - ${parts[1]}`;
  return id;
};

const CollapsibleTransporte = ({transporte}) => {
  const [isOpen, setIsOpen] = useState(false);
  const displayId = getTransporteLabel(transporte);

  return (
    <div className="evento-transporte">
      <div
        className="evento-transporte__header"
        onClick={() => setIsOpen((o) => !o)}>
        <div className="evento-transporte__header-left">
          <i className={`fa-solid fa-caret-${isOpen ? "down" : "right"} evento-transporte__icon`}></i>
          <span className="evento-transporte__id">{displayId}</span>
          {transporte.gpsData && transporte.gpsData.length > 0 && (
            <span className="evento-transporte__gps-badge">
              {transporte.gpsData.length} GPS
            </span>
          )}
        </div>
      </div>
      {isOpen && (
        <div className="evento-transporte__body">
          {transporte.gpsData && transporte.gpsData.length > 0 ? (
            <div>
              {transporte.gpsData.map((gps, index) => (
                <div key={index} className="evento-gps-card">
                  <div className="evento-gps-card__header">
                    <span className="evento-gps-card__name">{gps.name}</span>
                    <span className="evento-gps-card__id">ID: {gps.wialonId}</span>
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="info-group mb-1">
                        <label className="info-label">Duración:</label>
                        <span className="info-value">{gps.data?.duracion || "--"}</span>
                      </div>
                      <div className="info-group mb-1">
                        <label className="info-label">Ubicación:</label>
                        <span className="info-value">{gps.data?.ubicacion || "--"}</span>
                      </div>
                      <div className="info-group mb-1">
                        <label className="info-label">Velocidad:</label>
                        <span className="info-value">{gps.data?.velocidad || "--"}</span>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="info-group mb-1">
                        <label className="info-label">Último Posicionamiento:</label>
                        <span className="info-value">{gps.data?.ultimo_posicionamiento || "--"}</span>
                      </div>
                      <div className="info-group mb-1">
                        <label className="info-label">Coordenadas:</label>
                        <span className="info-value">{gps.data?.coordenadas || "--"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="row">
              <div className="col-md-6">
                <div className="info-group mb-1">
                  <label className="info-label">Duración:</label>
                  <span className="info-value">{transporte.registro?.duracion || "--"}</span>
                </div>
                <div className="info-group mb-1">
                  <label className="info-label">Ubicación:</label>
                  <span className="info-value">{transporte.registro?.ubicacion || "--"}</span>
                </div>
                <div className="info-group mb-1">
                  <label className="info-label">Velocidad:</label>
                  <span className="info-value">{transporte.registro?.velocidad || "--"}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="info-group mb-1">
                  <label className="info-label">Último Posicionamiento:</label>
                  <span className="info-value">{transporte.registro?.ultimo_posicionamiento || "--"}</span>
                </div>
                <div className="info-group mb-1">
                  <label className="info-label">Coordenadas:</label>
                  <span className="info-value">{transporte.registro?.coordenadas || "--"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const EventCard = ({event, events, bitacora, setBitacora, setEventos, handleEditSubmit, roleData}) => {
  const {user} = useAuth();
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const {nombre, descripcion, createdAt, registrado_por, frecuencia} = event;
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    nombre,
    registrado_por,
    descripcion,
    frecuencia,
    createdAt,
    transportes: event.transportes,
  });
  const [eventColor, setEventColor] = useState("#333235");
  const [showTransporteModal, setShowTransporteModal] = useState(false);
  const [selectedTransporte, setSelectedTransporte] = useState(null);

  const isLastEvent = event._id === events[events.length - 1]?._id;

  useEffect(() => {
    const computeEventColor = () => {
      if (!frecuencia) return "#333235";
      if (!isLastEvent) {
        return event.isFrecuenciaMet ? "#51FF4E" : "#F82929";
      }
      const frecuenciaMs = frecuencia * 60000;
      const elapsed = Date.now() - new Date(createdAt).getTime();
      if (elapsed < frecuenciaMs * 0.75) return "#51FF4E";
      if (elapsed < frecuenciaMs) return "#ECEC27";
      return "#F82929";
    };
    setEventColor(computeEventColor());
    const interval = setInterval(() => setEventColor(computeEventColor()), 60000);
    return () => clearInterval(interval);
  }, [createdAt, frecuencia, isLastEvent]);

  const handleEditClick = () => setShowModal(true);
  const handleClose = () => setShowModal(false);

  const handleCloseTransporteModal = () => {
    setShowTransporteModal(false);
    setSelectedTransporte(null);
  };

  const handleInputChange = (e) => {
    const {name, value} = e.target;
    setFormData((prev) => ({...prev, [name]: value}));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const updatedEventos = bitacora.eventos.map((evt) =>
      evt._id === event._id
        ? {...evt, descripcion: formData.descripcion, frecuencia: formData.frecuencia}
        : evt
    );
    const oldEvent = bitacora.eventos.find((evt) => evt._id === event._id);
    const newEvent = updatedEventos.find((evt) => evt._id === event._id);
    const updatedBitacora = {...bitacora, eventos: updatedEventos};
    setBitacora(updatedBitacora);
    setEventos(updatedEventos);
    await handleEditSubmit(e, updatedBitacora);
    await generateAuditoriasFromChanges({
      oldData: oldEvent,
      newData: newEvent,
      bitacoraId: bitacora.bitacora_id,
      user,
      seccion: "Eventos",
    });
    setShowModal(false);
  };

  return (
    <div className="evento-card">
      <div className="evento-card__header">
        <div className="evento-card__header-left">
          <div className="evento-card__dot" style={{backgroundColor: eventColor}}></div>
          <div className="evento-card__meta">
            <span className="evento-card__name">{nombre}</span>
            <span className="evento-card__date">
              {new Date(createdAt).toLocaleString("es-MX", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
          </div>
        </div>
        {roleData?.bit_eventos?.update && (
          <button onClick={handleEditClick} className="evento-card__edit-btn" title="Editar evento">
            <i className="fa fa-pen"></i>
          </button>
        )}
      </div>

      <div className="evento-card__body">
        <div className="row">
          <div className="col-md-6">
            <div className="info-group mb-1">
              <label className="info-label">Registrado por:</label>
              <span className="info-value">{registrado_por}</span>
            </div>
            <div className="info-group mb-1">
              <label className="info-label">Descripción:</label>
              <span className="info-value">{descripcion}</span>
            </div>
            <div className="info-group mb-1">
              <label className="info-label">Frecuencia:</label>
              <span className="info-value">{`${frecuencia} min`}</span>
            </div>
          </div>

          <div className="col-md-6">
            <div className="evento-card__transportes-header">
              <span>Transportes</span>
              <span className="evento-card__transportes-count">{event.transportes.length}</span>
            </div>
            {event.transportes.map((t, i) => (
              <CollapsibleTransporte key={t.id || i} transporte={t} />
            ))}
          </div>
        </div>
      </div>

      <ModalTemplate
        show={showTransporteModal}
        title="Transporte Information"
        onClose={handleCloseTransporteModal}>
        {selectedTransporte && (
          <div className="row mt-3">
            <div className="col-md-6">
              <h5>Tracto:</h5>
              {["eco", "placa", "marca", "modelo", "color", "tipo"].map((field) => (
                <p key={field}>
                  <strong>{field.charAt(0).toUpperCase() + field.slice(1)}:</strong>{" "}
                  {selectedTransporte.tracto?.[field]}
                </p>
              ))}
            </div>
            <div className="col-md-6">
              <h5>Remolque:</h5>
              {["eco", "placa", "color", "capacidad", "sello"].map((field) => (
                <p key={field}>
                  <strong>{field.charAt(0).toUpperCase() + field.slice(1)}:</strong>{" "}
                  {selectedTransporte.remolque?.[field]}
                </p>
              ))}
            </div>
          </div>
        )}
      </ModalTemplate>

      <ModalTemplate
        show={showModal}
        title="Editar Evento"
        onClose={handleClose}
        onSubmit={handleFormSubmit}>
        <TextInput label="Nombre" name="nombre" value={formData.nombre} disabled className="mb-3" />
        <TextInput label="Registrado por" name="registrado_por" value={formData.registrado_por} disabled className="mb-3" />
        <TextInput
          label="Transportes"
          name="transportes"
          value={formData.transportes.map((t) => getTransporteLabel(t)).join(", ")}
          disabled
          className="mb-3"
        />
        <TextArea
          label="Descripción"
          name="descripcion"
          value={formData.descripcion}
          onChange={handleInputChange}
          rows={3}
          placeholder="Detalles del evento..."
          className="mb-3"
        />
        <TextInput
          label="Frecuencia (min)"
          type="number"
          name="frecuencia"
          value={formData.frecuencia}
          onChange={handleInputChange}
          className="mb-3"
        />
      </ModalTemplate>
    </div>
  );
};

const BitacoraDetailPage = ({edited}) => {
  const {id} = useParams();
  const {user, verifyToken, setUser} = useAuth();
  const [bitacora, setBitacora] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [edited_bitacora, setEditedBitacora] = useState({});
  const [roleData, setRoleData] = useState(null);
  const [initialized, setInitialized] = useState(false); // Track initialization
  const [origenes, setOrigenes] = useState([]);
  const [destinos, setDestinos] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [lineasTransporte, setLineasTransporte] = useState([]);
  const [clients, setClients] = useState([]);
  const [monitoreos, setMonitoreos] = useState([]);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("detalles");
  const [selectedTransporte, setSelectedTransporte] = useState(null);
  const [transportes, setTransportes] = useState(bitacora?.transportes || []);
  const [showModal, setShowModal] = useState(false);
  const [isEditTransporteModalVisible, setEditTransporteModalVisible] = useState(false);
  const [editedTransporte, setEditedTransporte] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [idMethod, setIdMethod] = useState("automatic");
  const [selectedGpsUnits, setSelectedGpsUnits] = useState([]); // Para múltiples GPS
  const [gpsSearchTerm, setGpsSearchTerm] = useState(""); // Para buscar GPS
  const { units } = useWialon();
  const [modalOpen, setModalOpen] = useState(false);
  const {isSidebarCollapsed, setIsMobileSidebarOpen} = useSidebar();
  const [phoneError, setPhoneError] = useState("");
  const [isEdited, setIsEdited] = useState(false);
  const [selectedTransportes, setSelectedTransportes] = useState([]);
  const [isEventStarted, setIsEventStarted] = useState(false);
  const [finishButtonDisabled, setFinishButtonDisabled] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [draftModalDismissed, setDraftModalDismissed] = useState(false);
  const [editDraftLineaText, setEditDraftLineaText] = useState("");
  const [editDraftOperadorText, setEditDraftOperadorText] = useState("");
  const [pendingRejectDraftId, setPendingRejectDraftId] = useState(null);
  const [editIsPlanDraft, setEditIsPlanDraft] = useState(false);
  const [editTransporteStep, setEditTransporteStep] = useState(0);
  const [editTransporteSlide, setEditTransporteSlide] = useState("forward");

  const validatePhoneNumber = (phone) => {
    // Regex para validar número de teléfono mexicano de exactamente 10 dígitos seguidos
    // Solo acepta formato: 1234567890 (sin espacios, guiones o paréntesis)
    const phoneRegex = /^\d{10}$/;

    // Debe ser exactamente 10 dígitos seguidos
    return phoneRegex.test(phone);
  };

  const handleEditTransporte = async () => {
    const selected = selectedTransporte;

    console.log("handleEditTransporte called with selected transporte:", selected);

    // Determine ID method based on the existing ID
    let initialIdMethod = "automatic";
    if (selected.id && !selected.id.startsWith("T") && !selected.id.startsWith("blank_")) {
      initialIdMethod = "wialon";
    }

    setEditedTransporte({
      ...selected,
      tracto:   selected.tracto   ?? {},
      remolque: selected.remolque ?? {},
      originalId: selected.id,
    });
    setIdMethod(initialIdMethod);

    // Cargar operadores para la línea de transporte del transporte seleccionado
    if (selected.lineaTransporte) {
      console.log("Loading operadores for existing lineaTransporte:", selected.lineaTransporte);
      await fetchOperadores(selected.lineaTransporte);
    } else {
      console.log("No lineaTransporte found in selected transporte");
      setOperadores([]);
    }

    // Inicializar GPS seleccionados si existen
    if (selected.gpsUnits && selected.gpsUnits.length > 0) {
      setSelectedGpsUnits(
        selected.gpsUnits.map((gps) => ({
          id: gps.wialonId,
          name: gps.name,
        }))
      );
    } else {
      setSelectedGpsUnits([]);
    }

    setEditDraftLineaText("");
    setEditDraftOperadorText("");
    setEditTransporteStep(0);
    setEditTransporteSlide("forward");
    setEditTransporteModalVisible(true);
  };

  const handleGpsUnitToggle = (unit) => {
    setSelectedGpsUnits((prev) => {
      const isSelected = prev.some((u) => u.id === unit.id);
      if (isSelected) {
        return prev.filter((u) => u.id !== unit.id);
      } else {
        return [...prev, unit];
      }
    });
  };

  // Filtrar GPS basado en búsqueda
  const filteredGpsUnits = units.filter(
    (unit) =>
      unit.name.toLowerCase().includes(gpsSearchTerm.toLowerCase()) ||
      unit.id.toString().includes(gpsSearchTerm)
  );

  // Función para seleccionar/deseleccionar todos los GPS filtrados
  const handleSelectAllFiltered = () => {
    const allFilteredSelected = filteredGpsUnits.every((unit) =>
      selectedGpsUnits.some((selected) => selected.id === unit.id)
    );

    if (allFilteredSelected) {
      // Deseleccionar todos los filtrados
      setSelectedGpsUnits((prev) =>
        prev.filter((selected) => !filteredGpsUnits.some((filtered) => filtered.id === selected.id))
      );
    } else {
      // Seleccionar todos los filtrados
      const newSelections = filteredGpsUnits.filter(
        (unit) => !selectedGpsUnits.some((selected) => selected.id === unit.id)
      );
      setSelectedGpsUnits((prev) => [...prev, ...newSelections]);
    }
  };

  //TRANSPORTES LOGIC
  const handleClose = () => setShowModal(false);
  const handleShow = () => setShowModal(true);
  const transporteDetailRef = React.useRef(null);
  const handleSelectTransporte = (transporte) => {
    setSelectedTransporte(transporte);
    // On mobile: scroll detail panel into view after state update
    if (window.innerWidth <= 576) {
      setTimeout(() => {
        transporteDetailRef.current?.scrollIntoView({behavior: "smooth", block: "start"});
      }, 50);
    }
  };

  const handleTransportEdit = async (e) => {
    e.preventDefault();

    if (!editedTransporte) return;

    // Validar teléfono antes de enviar
    if (editedTransporte.telefono && !validatePhoneNumber(editedTransporte.telefono)) {
      setPhoneError("El número de teléfono debe tener exactamente 10 dígitos seguidos");
      return;
    }

    // Ensure ID is properly updated before saving
    let updatedId = editedTransporte.id;

    if (editIsPlanDraft) {
      // Plan-originated transporte: keep the plan.transporte text as the ID
      updatedId = editedTransporte.originalId;
    } else if (idMethod === "automatic") {
      // FIXED: Extract existing numeric ID from original ID, don't generate new one
      // Original ID format: T001_PLACA or blank_timestamp
      let numericId;

      if (
        editedTransporte.originalId?.startsWith("T") &&
        editedTransporte.originalId.includes("_")
      ) {
        // Extract numeric part from existing ID (e.g., "001" from "T001_1243")
        const match = editedTransporte.originalId.match(/^T(\d+)_/);
        numericId = match ? match[1] : (transportes.length + 1).toString().padStart(3, "0");
      } else if (
        editedTransporte.originalId?.startsWith("blank_") ||
        editedTransporte.originalId?.startsWith("0_")
      ) {
        // For blank or temporary IDs, generate new numeric ID
        numericId = (transportes.length + 1).toString().padStart(3, "0");
      } else {
        // Fallback: use current length + 1
        numericId = (transportes.length + 1).toString().padStart(3, "0");
      }

      const tractoPlaca = editedTransporte?.tracto?.placa || "N/A";
      updatedId = `T${numericId}_${tractoPlaca}`;
    } else if (idMethod === "wialon" && selectedGpsUnits.length > 0) {
      // FIXED: Extract existing numeric ID from original ID, don't generate new one
      let numericId;

      if (
        editedTransporte.originalId?.startsWith("T") &&
        editedTransporte.originalId.includes("_")
      ) {
        // Extract numeric part from existing ID (e.g., "001" from "T001_1243")
        const match = editedTransporte.originalId.match(/^T(\d+)_/);
        numericId = match ? match[1] : (transportes.length + 1).toString().padStart(3, "0");
      } else if (
        editedTransporte.originalId?.startsWith("blank_") ||
        editedTransporte.originalId?.startsWith("0_")
      ) {
        // For blank or temporary IDs, generate new numeric ID
        numericId = (transportes.length + 1).toString().padStart(3, "0");
      } else {
        // Fallback: use current length + 1
        numericId = (transportes.length + 1).toString().padStart(3, "0");
      }

      const tractoPlaca = editedTransporte?.tracto?.placa || "N/A";
      updatedId = `T${numericId}_${tractoPlaca}`;
    }

    const updatedEditedTransporte = {
      ...editedTransporte,
      id: updatedId,
      internalId: editedTransporte.internalId || undefined,
      // _originalId lets the server locate this transporte when the display id changed
      _originalId: editedTransporte.originalId,
      gpsUnits: selectedGpsUnits.map((unit) => ({
        wialonId: String(unit.id),
        name: unit.name,
        data: {}, // Se llenará cuando se obtengan los datos
      })),
    };

    const updatedTransportes = bitacora.transportes.map((transporte) =>
      transporte.id === editedTransporte.originalId ? updatedEditedTransporte : transporte
    );

    try {
      const response = await fetch(`${baseUrl}/bitacora/${bitacora._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({transportes: updatedTransportes}),
      });

      if (!response.ok) {
        throw new Error(`Error al actualizar transporte: ${response.statusText}`);
      }

      const data = await response.json();
      setBitacora(data);

      // Check for draft values in edited transporte (skip for plan drafts — values already confirmed)
      if (!editIsPlanDraft && roleData?.crear_draft_transporte) {
        const lineaEnCatalog = lineasTransporte.some(
          (l) => l.nombre.toUpperCase() === editedTransporte.lineaTransporte?.toUpperCase()
        );
        const operadorEnCatalog = operadores.some(
          (o) => o.nombre.toUpperCase() === editedTransporte.operador?.toUpperCase()
        );
        const lineaEsDraft = !!editedTransporte.lineaTransporte && !lineaEnCatalog;
        const operadorEsDraft = !!editedTransporte.operador && !operadorEnCatalog;

        if (lineaEsDraft || operadorEsDraft) {
          try {
            // Carry the plan's transporte name if this came from a plan draft
            const planTransporte = bitacora.eventos?.[0]?.metadata?.transporte ?? null;
            await fetch(`${baseUrl}/drafts`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                bitacora_id: bitacora._id,
                bitacora_num_id: bitacora.bitacora_id,
                transporte_id: updatedEditedTransporte.id,
                transporte: planTransporte,
                cliente: bitacora.cliente,
                lineaTransporte: editedTransporte.lineaTransporte,
                lineaTransporte_es_draft: lineaEsDraft,
                operador: editedTransporte.operador,
                operador_es_draft: operadorEsDraft,
                telefono: editedTransporte.telefono ?? null,
                creado_por: `${user.firstName} ${user.lastName}`,
              }),
            });
            if (roleData?.aceptar_draft) fetchDrafts();
          } catch (err) {
            console.error("Error creating draft on edit:", err);
          }
        }
      }

      setEditTransporteModalVisible(false);
      setSelectedTransporte(null);
      setEditedTransporte(null);
      setGpsSearchTerm("");
      setEditTransporteStep(0);

      if (pendingRejectDraftId) {
        try {
          await fetch(`${baseUrl}/drafts/${pendingRejectDraftId}/reject`, {
            method: "PUT",
            credentials: "include",
          });
        } catch (err) {
          console.error("Error rejecting draft after edit:", err);
        }
        setPendingRejectDraftId(null);
        await fetchDrafts();
      }
    } catch (error) {
      console.error("Error al guardar transporte editado:", error);
      alert("No se pudo guardar el transporte. Intenta nuevamente.");
    }
  };

  useEffect(() => {
    if (selectedTransporte) {
      const updatedTransporte = bitacora.transportes.find((t) =>
        (t.internalId && selectedTransporte.internalId && t.internalId === selectedTransporte.internalId) || t.id === selectedTransporte.id
      );
      if (updatedTransporte) {
        setSelectedTransporte(updatedTransporte);
      }
    }
  }, [bitacora]); // Runs whenever bitacora updates

  const addTransporte = async (newTransporte, id) => {
    try {
      const response = await fetch(`${baseUrl}/bitacoras/${id}/transportes`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newTransporte),
      });

      if (!response.ok) {
        throw new Error("Failed to add transporte");
      }

      const updatedBitacora = await response.json();

      // Assuming the updatedBitacora contains the updated transportes array
      setTransportes(updatedBitacora.transportes);
      fetchBitacora();
    } catch (error) {
      console.error("Error adding transporte:", error);
    }
  };

  //TABS
  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
  };

  const [eventTypes, setEventTypes] = useState([]);
  const baseUrl = import.meta.env.VITE_BASE_URL;

  // Helper function to process bitacora data for edited_bitacora
  const processBitacoraForEdit = (bitacoraData) => {
    if (!bitacoraData) return bitacoraData;

    const processedData = {...bitacoraData};

    // Convert origen ID to nombre if it's an ID
    if (processedData.origen) {
      if (
        typeof processedData.origen === "string" &&
        processedData.origen.match(/^[0-9a-f]{24}$/i)
      ) {
        // It's an ID, find the nombre from origenes list
        const foundOrigen = origenes.find((origen) => origen._id === processedData.origen);
        if (foundOrigen) {
          processedData.origen = foundOrigen.nombre;
        }
      } else if (typeof processedData.origen === "object" && processedData.origen.nombre) {
        // It's already an object, use the nombre
        processedData.origen = processedData.origen.nombre;
      }
    }

    // Convert destino ID to nombre if it's an ID
    if (processedData.destino) {
      if (
        typeof processedData.destino === "string" &&
        processedData.destino.match(/^[0-9a-f]{24}$/i)
      ) {
        // It's an ID, find the nombre from destinos list
        const foundDestino = destinos.find((destino) => destino._id === processedData.destino);
        if (foundDestino) {
          processedData.destino = foundDestino.nombre;
        }
      } else if (typeof processedData.destino === "object" && processedData.destino.nombre) {
        // It's already an object, use the nombre
        processedData.destino = processedData.destino.nombre;
      }
    }

    return processedData;
  };

  const fetchClients = async () => {
    try {
      const response = await fetch(`${baseUrl}/clients`, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      } else {
        console.error("Failed to fetch clients:", response.statusText);
      }
    } catch (e) {
      console.error("Error fetching clients:", e);
    }
  };

  const fetchMonitoreos = async () => {
    try {
      const response = await fetch(`${baseUrl}/monitoreos`, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setMonitoreos(data);
      } else {
        console.error("Failed to fetch monitoreos:", response.statusText);
      }
    } catch (e) {
      console.error("Error fetching monitoreos:", e);
    }
  };

  const fetchOrigenes = async (cliente = null) => {
    try {
      let url = `${baseUrl}/origenes`;
      if (cliente && cliente !== "all") {
        url += `?cliente=${encodeURIComponent(cliente)}`;
      }

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setOrigenes(data);
      } else {
        console.error("Failed to fetch origenes:", response.statusText);
      }
    } catch (e) {
      console.error("Error fetching origenes:", e);
    }
  };

  const fetchDestinos = async (cliente = null) => {
    try {
      let url = `${baseUrl}/destinos`;
      if (cliente && cliente !== "all") {
        url += `?cliente=${encodeURIComponent(cliente)}`;
      }

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setDestinos(data);
      } else {
        console.error("Failed to fetch destinos:", response.statusText);
      }
    } catch (e) {
      console.error("Error fetching destinos:", e);
    }
  };

  const fetchOperadores = async (lineaTransporte = null) => {
    try {
      let url = `${baseUrl}/operadores`;
      if (lineaTransporte && lineaTransporte !== "all") {
        url += `?lineaTransporte=${encodeURIComponent(lineaTransporte)}`;
      }

      console.log("Fetching operadores for lineaTransporte:", lineaTransporte, "URL:", url);

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        console.log("Raw operadores response:", data);
        setOperadores(data);
        console.log("Operadores fetched and set:", data);
        console.log("Operadores count:", data.length);
      } else {
        console.error("Failed to fetch operadores:", response.statusText);
        // Clear operadores on error
        setOperadores([]);
      }
    } catch (e) {
      console.error("Error fetching operadores:", e);
      // Clear operadores on error
      setOperadores([]);
    }
  };

  // Fetch lineas de transporte filtered by client
  const fetchLineasTransporte = async (cliente) => {
    try {
      let url = `${baseUrl}/lineas-transporte`;
      if (cliente && cliente !== "all") {
        url += `?cliente=${encodeURIComponent(cliente)}`;
      }

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setLineasTransporte(data);
      } else {
        console.error("Failed to fetch lineas transporte:", response.statusText);
      }
    } catch (e) {
      console.error("Error fetching lineas transporte:", e);
    }
  };

  const fetchBitacora = async () => {
    try {
      const response = await fetch(`${baseUrl}/bitacora/${id}`, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();

        // Silently repair any evento copies whose internalId doesn't match their transporte
        fetch(`${baseUrl}/bitacora/${id}/repair-internalids`, {
          method: "POST",
          credentials: "include",
        }).then(async (r) => {
          if (r.ok) {
            const { repaired } = await r.json();
            if (repaired) {
              // Re-fetch so the UI sees the corrected internalIds
              const r2 = await fetch(`${baseUrl}/bitacora/${id}`, { credentials: "include" });
              if (r2.ok) {
                const fixed = await r2.json();
                setBitacora(fixed);
                setEditedBitacora(processBitacoraForEdit(fixed));
                setTransportes(fixed.transportes);
                setSelectedTransportes(fixed.transportes);
              }
            }
          }
        }).catch(() => {});

        setBitacora(data);
        setEditedBitacora(processBitacoraForEdit(data));
        setTransportes(data.transportes);
        setSelectedTransportes(data.transportes);

        setIsEventStarted(data.status === "iniciada");
        setFinishButtonDisabled(data.status === "finalizada" || data.status === "cerrada");
      } else {
        console.error("Failed to fetch bitácora:", response.statusText);
      }
    } catch (e) {
      console.error("Error fetching bitácora:", e);
    }
  };

  const fetchEventos = async () => {
    try {
      const response = await fetch(`${baseUrl}/bitacora/${id}`, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();

        setBitacora(data);
        setEventos(data.eventos);
        setEditedBitacora(processBitacoraForEdit(data));
        setTransportes(data.transportes);
        setSelectedTransportes(data.transportes);

        setIsEventStarted(data.status === "iniciada");
        setFinishButtonDisabled(data.status === "finalizada" || data.status === "cerrada");

        return data; // <-- ✅ Return updated bitacora
      } else {
        console.error("Failed to fetch bitácora:", response.statusText);
      }
    } catch (e) {
      console.error("Error fetching bitácora:", e);
    }
  };

  useEffect(() => {
    fetchEventos();
  }, []);

  // Update filtered data when bitacora is loaded
  useEffect(() => {
    if (bitacora && bitacora.cliente) {
      fetchOrigenes(bitacora.cliente);
      fetchDestinos(bitacora.cliente);
      fetchLineasTransporte(bitacora.cliente);
    }
  }, [bitacora]);

  // Update edited_bitacora when origenes and destinos are loaded
  useEffect(() => {
    if (bitacora && origenes.length > 0 && destinos.length > 0) {
      setEditedBitacora(processBitacoraForEdit(bitacora));
    }
  }, [origenes, destinos, bitacora]);

  useEffect(() => {
    const init = async () => {
      try {
        const data = await verifyToken(); // Ensure user is verified
        setUser(data);
        setInitialized(true); // Set initialization as complete
      } catch (e) {
        console.log("Error verifying token or fetching user:", e);
        navigate("/login");
      }
    };
    const fetchEventTypes = async () => {
      try {
        const response = await fetch(`${baseUrl}/event_types`, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setEventTypes(data);
        } else {
          console.error("Failed to fetch event types:", response.statusText);
        }
      } catch (e) {
        console.error("Error fetching event types:", e);
      }
    };

    fetchClients();
    fetchMonitoreos();
    fetchEventTypes();
    init();
  }, []);

  useEffect(() => {
    const fetchRolePermissions = async () => {
      if (!user) return; // Ensure user is available before fetching role data

      try {
        const response = await fetch(`${baseUrl}/roles/${user.role}`, {
          method: "GET",
          credentials: "include",
        });
        const data = await response.json();
        setRoleData(data);
      } catch (e) {
        console.log("Error fetching role permissions:", e);
      }
    };

    if (initialized) {
      fetchRolePermissions();
    }
  }, [initialized, user]);

  const handleFinish = async (latestBitacora = bitacora) => {
    const hasPendingDrafts = drafts.some((d) => d.status === "pendiente");
    if (hasPendingDrafts) {
      setShowDraftsModal(true);
      return;
    }
    if (latestBitacora.status === "iniciada" && areAllTransportesClosed(latestBitacora)) {
      try {
        const response = await fetch(`${baseUrl}/bitacora/${id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "cerrada",
            inicioMonitoreo: new Date().toISOString(),
          }),
          credentials: "include",
        });

        if (response.ok) {
          const updatedBitacora = await response.json();
          setBitacora(updatedBitacora);
          setIsEventStarted(true);
          setFinishButtonDisabled(false);
        } else {
          console.error("Failed to close bitácora:", response.statusText);
        }
      } catch (e) {
        console.error("Error closing bitácora:", e);
      }

      fetchBitacora(); // Keep this to refresh the state
    }
  };

  const fetchDrafts = async () => {
    if (!bitacora?._id) return;
    try {
      const res = await fetch(`${baseUrl}/drafts?bitacora_id=${bitacora._id}`, {
        credentials: "include",
      });
      if (res.ok) setDrafts(await res.json());
    } catch (e) {
      console.error("Error fetching drafts:", e);
    }
  };

  useEffect(() => {
    if (bitacora?._id && roleData?.aceptar_draft) fetchDrafts();
  }, [bitacora?._id, roleData]);

  useEffect(() => {
    const hasPending = drafts.some((d) => d.status === "pendiente");
    if (roleData?.aceptar_draft && bitacora?.draft_pendiente && hasPending && !draftModalDismissed) {
      setShowDraftsModal(true);
    }
  }, [drafts]);

  const handleDraftAction = async (draftId, action) => {
    try {
      await fetch(`${baseUrl}/drafts/${draftId}/${action}`, {
        method: "PUT",
        credentials: "include",
      });
      // Reset dismissed so any remaining pending drafts can surface after this action,
      // but close the modal first — it will reopen only if there are still pending drafts.
      setDraftModalDismissed(false);
      await fetchDrafts();
      await fetchBitacora();
    } catch (e) {
      console.error(`Error ${action} draft:`, e);
    }
  };

  useEffect(() => {
    fetchBitacora();
  }, []);

  // useEffect to handle lineaTransporte changes and update operadores
  useEffect(() => {
    if (
      isEditTransporteModalVisible &&
      editedTransporte?.lineaTransporte &&
      editedTransporte.lineaTransporte !== ""
    ) {
      console.log(
        "LineaTransporte changed, fetching operadores for:",
        editedTransporte.lineaTransporte
      );
      fetchOperadores(editedTransporte.lineaTransporte);
    } else if (
      isEditTransporteModalVisible &&
      (!editedTransporte?.lineaTransporte || editedTransporte.lineaTransporte === "")
    ) {
      console.log("No lineaTransporte selected, clearing operadores");
      setOperadores([]);
      // Also clear the selected operador
      setEditedTransporte((prev) => ({...prev, operador: ""}));
    }
  }, [editedTransporte?.lineaTransporte, isEditTransporteModalVisible]);

  // useEffect to validate operador when the operadores list is refreshed
  useEffect(() => {
    if (!isEditTransporteModalVisible) return;
    // Use functional updater to avoid stale closure on editedTransporte
    setEditedTransporte((prev) => {
      if (!prev?.lineaTransporte || !prev?.operador) return prev;
      const isOperadorValid = operadores.some((op) => op.nombre === prev.operador);
      if (!isOperadorValid) return { ...prev, operador: "" };
      return prev;
    });
  }, [operadores, isEditTransporteModalVisible]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Fecha inválida";

    const options = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    };
    return date.toLocaleString("es-ES", options);
  };

  if (!bitacora) {
    return (
      <div className="loading-container text-center py-5">
        <i className="fa fa-spinner fa-spin text-primary me-2" style={{fontSize: "24px"}}></i>
        <span className="text-muted">Cargando bitácora...</span>
      </div>
    );
  }


  const events = Array.isArray(bitacora.eventos) ? bitacora.eventos : [];

  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  // Helper function to get the correct value for origen/destino dropdown
  const getLocationValue = (location, locationList) => {
    if (!location || !locationList || locationList.length === 0) {
      console.log("getLocationValue: No location or locationList", {
        location,
        locationListLength: locationList?.length,
      });
      return "";
    }

    console.log("getLocationValue: Processing", {
      location,
      locationType: typeof location,
      locationListLength: locationList.length,
    });

    // If location is already an object with _id, stringify it
    if (typeof location === "object" && location._id) {
      // Ensure the location exists in the filtered list (same client)
      const existsInList = locationList.find((item) => item._id === location._id);
      if (existsInList) {
        console.log("getLocationValue: Found object in list", existsInList);
        return JSON.stringify(location);
      }
    }

    // If location is a string, check if it's a nombre (from edited_bitacora) or an ID
    if (typeof location === "string") {
      // First check if it's a nombre (not an ID)
      if (!location.match(/^[0-9a-f]{24}$/i)) {
        // It's a nombre, find the corresponding object
        let foundLocation = locationList.find((item) => item.nombre === location);

        if (foundLocation) {
          console.log("getLocationValue: Found location by nombre", foundLocation);
          return JSON.stringify(foundLocation);
        }
      } else {
        // It's an ID, find the full object
        let foundLocation = locationList.find((item) => item._id === location);

        // If not found, try to find in all origenes/destinos (not just filtered)
        if (!foundLocation) {
          console.log("getLocationValue: Not found in filtered list, searching in all locations");
          if (locationList === origenes.filter((origen) => origen.cliente === bitacora?.cliente)) {
            // This is for origenes
            foundLocation = origenes.find((item) => item._id === location);
          } else if (
            locationList === destinos.filter((destino) => destino.cliente === bitacora?.cliente)
          ) {
            // This is for destinos
            foundLocation = destinos.find((item) => item._id === location);
          }
        }

        if (foundLocation) {
          console.log("getLocationValue: Found location by ID", foundLocation);
          return JSON.stringify(foundLocation);
        } else {
          console.log("getLocationValue: Location ID not found anywhere", {
            locationId: location,
            filteredIds: locationList.map((item) => item._id),
            allOrigenesIds: origenes.map((item) => item._id),
            allDestinosIds: destinos.map((item) => item._id),
          });
        }
      }
    }

    console.log("getLocationValue: No match found, returning empty string");
    return "";
  };

  const handleEditChange = (e) => {
    const {name, value, type} = e.target;

    setBitacora((prev) => {
      let updates = {};

      if (type === "select-one") {
        updates[name] = value;

        // If client changes, clear origen and destino to avoid invalid selections
        if (name === "cliente") {
          updates.origen = null;
          updates.destino = null;
        }

        // If monitoreo changes to "Custodia fisica", initialize custodia object if it doesn't exist
        if (
          name === "monitoreo" &&
          (value === "Custodia fisica" ||
            value === "CUSTODIA FISICA" ||
            value?.toLowerCase() === "custodia fisica")
        ) {
          if (!prev.custodia) {
            updates.custodia = {
              custodio1_nombre: "",
              custodio1_telefono: "",
              custodio2_nombre: "",
              custodio2_telefono: "",
              placa: "",
              modelo: "",
              color: "",
              marca: "",
            };
          }
        }
      } else {
        const [mainKey, subKey] = name.split(".");

        if (subKey) {
          // Handle nested objects like custodia.custodio1_nombre
          updates[mainKey] = {
            ...prev[mainKey], // Asegurar que mainKey no sea undefined
            [subKey]: value,
          };
        } else {
          updates[name] = value;
        }
      }

      return {...prev, ...updates};
    });
  };

  // Stable match: internalId takes priority over id (supports legacy records without internalId)
  const transporteMatch = (a, b) =>
    (a.internalId && b.internalId && a.internalId === b.internalId) || a.id === b.id;

  const isTransporteUsedInEventos = (transporteId) => {
    const mainT = bitacora.transportes?.find((t) => t.id === transporteId);
    return bitacora.eventos.some((evento) =>
      evento.transportes.some((t) =>
        mainT ? transporteMatch(mainT, t) : t.id === transporteId
      )
    );
  };

  const isTransporteInEvento = isTransporteUsedInEventos(editedTransporte?.originalId);

  const areAllTransportesClosed = (bitacoraToCheck = bitacora) => {
    if (!bitacoraToCheck || !bitacoraToCheck.transportes || !bitacoraToCheck.eventos) return false;

    const cierreEventos = bitacoraToCheck.eventos.filter(
      (e) =>
        e.nombre === "Cierre de servicio" ||
        e.nombre === "CIERRE DE SERVICIO" ||
        e.nombre === "cierre de servicio"
    );
    const closedTransportes = cierreEventos.flatMap((e) => e.transportes);

    return bitacoraToCheck.transportes.every((t) =>
      closedTransportes.some((ct) => transporteMatch(t, ct))
    );
  };

  const handleEditSubmit = async (e, updatedBitacora) => {
    e.preventDefault();
    console.log("Submitting changes...");

    const submitBitacora = updatedBitacora ? updatedBitacora : bitacora;
    console.log(submitBitacora);
    try {
      const normalizeLocationText = (value) =>
        String(value ?? "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

      // Extract ObjectId from origen/destino if they are objects or names
      const getObjectId = (location, type) => {
        console.log("getObjectId called with:", location, "type:", typeof location);

        if (!location) return location;

        // If it's already a string ObjectId, return it
        if (typeof location === "string" && location.match(/^[0-9a-fA-F]{24}$/)) {
          console.log("Already an ObjectId:", location);
          return location; // Already an ObjectId
        }

        // If it's a JSON stringified object, parse it and extract _id
        if (typeof location === "string" && location.startsWith("{")) {
          try {
            const parsedLocation = JSON.parse(location);
            console.log("Parsed JSON location:", parsedLocation);
            if (parsedLocation && parsedLocation._id) {
              console.log("Extracted ObjectId from JSON:", parsedLocation._id);
              return parsedLocation._id;
            }
          } catch (e) {
            console.error("Error parsing location JSON:", e);
          }
        }

        // If it's an object with _id, extract it
        if (typeof location === "object" && location._id) {
          console.log("Extracted ObjectId from object:", location._id);
          return location._id;
        }

        // If it's a location name (not an ObjectId), find the corresponding ObjectId
        if (typeof location === "string" && !location.match(/^[0-9a-fA-F]{24}$/)) {
          console.log("Searching for location by name:", location);
          const targetValue = normalizeLocationText(location.split(",")[0]);
          const sourceList = type === "origen" ? origenes : destinos;
          const foundLocation = sourceList.find((item) => {
            const nombreMatch = normalizeLocationText(item.nombre) === targetValue;
            const labelMatch = normalizeLocationText(`${item.nombre}, ${item.estado}`) === normalizeLocationText(location);
            return nombreMatch || labelMatch;
          });

          if (foundLocation) {
            console.log(`Found ${type} by name:`, foundLocation._id);
            return foundLocation._id;
          }
        }

        console.log("Fallback to original value:", location);
        return location; // Fallback to original value
      };

      const minimalUpdate = {
        folio_servicio: submitBitacora.folio_servicio,
        cliente: submitBitacora.cliente,
        monitoreo: submitBitacora.monitoreo,
        origen: getObjectId(submitBitacora.origen, "origen"),
        destino: getObjectId(submitBitacora.destino, "destino"),
        // Include custodia data if it exists
        ...(submitBitacora.custodia && {custodia: submitBitacora.custodia}),
        // Only include eventos when called from event edit (updatedBitacora explicitly passed)
        ...(updatedBitacora && submitBitacora.eventos && {eventos: submitBitacora.eventos}),
      };

      console.log("minimalUpdate before uppercase conversion:", minimalUpdate);

      // Convert text fields to uppercase before sending
      // Exclude certain fields that should remain as-is
      const excludeFields = ["_id", "createdAt", "updatedAt", "origen", "destino", "eventos"];
      const uppercaseUpdate = convertToUpperCase(minimalUpdate, excludeFields);

      console.log("uppercaseUpdate after conversion:", uppercaseUpdate);

      const response = await fetch(`${baseUrl}/bitacora/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(uppercaseUpdate),

        credentials: "include",
      });

      if (response.ok) {
        const responseData = await response.json();
        setBitacora(responseData);

        // Generar auditorías por cambio individual
        await generateAuditoriasFromChanges({
          oldData: edited_bitacora,
          newData: submitBitacora,
          bitacoraId: bitacora.bitacora_id,
          user,
          seccion: "Bitácora",
        });

        setIsEdited(true);
        setEditModalVisible(false);
      } else {
        console.error("Failed to edit bitácora:", response.statusText);
      }
    } catch (e) {
      console.error("Error editing bitácora:", e);
    }

    try {
      const response = await fetch(`${baseUrl}/bitacora/${id}/edited`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({edited: true}),
        credentials: "include",
      });

      if (response.ok) {
        setBitacora((prev) => ({...prev, edited: true}));
        setIsEventStarted(true);
        setFinishButtonDisabled(false);
      } else {
        console.error("Failed to start bitácora:", response.statusText);
      }
    } catch (e) {
      console.error("Error starting bitácora:", e);
    }
  };

  return (
    <section id="bitacoraDetail">
      <div className="w-100 d-flex">
        <div className="sidebar-wrapper">
          <Sidebar />
        </div>
        <div className={`content-wrapper ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <PageHeader
            title={bitacora?.bitacora_id || "Detalle"}
            subtitle={bitacora?.bitacora_id || "Detalle"}
            onToggleSidebar={() => setIsMobileSidebarOpen(true)}>

            {roleData?.aceptar_draft && bitacora.draft_pendiente && (
              <button
                className="header-action-btn header-action-btn--warning position-relative"
                onClick={() => setShowDraftsModal(true)}
                title="Borradores pendientes de aprobación">
                <i className="fa-solid fa-file-pen"></i>
                {drafts.length > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                    style={{fontSize: "0.6rem"}}>
                    {drafts.length}
                  </span>
                )}
              </button>
            )}

            {activeTab === "detalles" && roleData?.bit_detalles?.update && (
              <button className="new-btn" onClick={() => {
                if (bitacora.monitoreo?.toLowerCase() === "custodia fisica" && !bitacora.custodia) {
                  setBitacora((prev) => ({
                    ...prev,
                    custodia: {
                      custodio1_nombre: "", custodio1_telefono: "",
                      custodio2_nombre: "", custodio2_telefono: "",
                      placa: "", modelo: "", color: "", marca: "",
                    },
                  }));
                }
                setEditModalVisible(true);
              }}>
                <i className="fa fa-edit"></i> Editar
              </button>
            )}
            {activeTab === "transportes" && roleData?.bit_transportes?.create && (
              <button className="new-btn" onClick={handleShow}>
                <i className="fa fa-plus"></i> Nuevo
              </button>
            )}
            {activeTab === "eventos" && roleData?.bit_eventos?.create && (
              <button
                className="new-btn"
                disabled={areAllTransportesClosed()}
                onClick={() => setModalOpen(true)}>
                <FontAwesomeIcon icon={faPlus} /> Nuevo
              </button>
            )}
          </PageHeader>

          <div className="content-area">
            {/* Tab Navigation */}
            <div className="modern-tabs">
              {roleData?.bit_detalles.read && (
                <button
                  className={`tab-button ${activeTab === "detalles" ? "active" : ""}`}
                  onClick={() => handleTabClick("detalles")}>
                  <span className="tab-title">Detalles</span>
                  <span className="tab-subtitle">ID: {bitacora.bitacora_id}</span>
                </button>
              )}

              {roleData?.bit_transportes.read && (
                <button
                  className={`tab-button ${activeTab === "transportes" ? "active" : ""}`}
                  onClick={() => handleTabClick("transportes")}>
                  <span className="tab-title">Transportes</span>
                  <span className="tab-subtitle">{bitacora.transportes.length} registrados</span>
                </button>
              )}

              {roleData?.bit_eventos.read && (
                <button
                  className={`tab-button ${activeTab === "eventos" ? "active" : ""}`}
                  onClick={() => handleTabClick("eventos")}>
                  <span className="tab-title">Eventos</span>
                  <span className="tab-subtitle">{bitacora.eventos.length} registrados</span>
                </button>
              )}
            </div>

            <div className="tab-content-modern">
              {/* Detalles Tab Content */}
              {roleData?.bit_detalles.read && (
                <div className={`tab-pane-modern ${activeTab === "detalles" ? "active" : ""}`}>
                  <div className="modern-card">
                    <div className="card-header-modern">
                      <h5 className="fw-bold mb-0">Información General</h5>
                    </div>
                    <div className="card-body-modern">
                      <div className="row">
                        <div className="col-md-6">
                          <div className="info-group mb-3">
                            <label className="info-label">Folio Servicio:</label>
                            <span className="info-value">{bitacora.folio_servicio}</span>
                          </div>
                          <div className="info-group mb-3">
                            <label className="info-label">No. Bitácora:</label>
                            <span className="info-value">{bitacora.bitacora_id}</span>
                          </div>
                          <div className="info-group mb-3">
                            <label className="info-label">Cliente:</label>
                            <span className="info-value">{bitacora.cliente}</span>
                          </div>
                          <div className="info-group mb-3">
                            <label className="info-label">Estatus:</label>
                            <CellBadge
                              label={bitacora.status ? (bitacora.status === "plan de embarque" ? "Embarque" : bitacora.status.charAt(0).toUpperCase() + bitacora.status.slice(1)) : ""}
                              variant={
                                bitacora.status === "nueva"      ? "blue"   :
                                bitacora.status === "validada"   ? "yellow" :
                                bitacora.status === "iniciada"   ? "green"  :
                                bitacora.status === "cerrada"    ? "red"    :
                                bitacora.status === "finalizada" ? "purple" : "gray"
                              }
                            />
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="info-group mb-3">
                            <label className="info-label">Tipo Monitoreo:</label>
                            <span className="info-value">{bitacora.monitoreo}</span>
                          </div>
                          <div className="info-group mb-3">
                            <label className="info-label">Origen:</label>
                            <span className="info-value">
                              {getLocationText(bitacora.origen, origenes)}
                            </span>
                          </div>
                          <div className="info-group mb-3">
                            <label className="info-label">Destino:</label>
                            <span className="info-value">
                              {getLocationText(bitacora.destino, destinos)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {bitacora.custodia && (
                        <div className="custodia-section">
                          <h6 className="fw-bold mb-3">Información Custodia Física</h6>
                          <div className="row">
                            <div className="col-md-6">
                              <div className="info-group mb-2">
                                <label className="info-label">Nombre Custodio 1:</label>
                                <span className="info-value">
                                  {bitacora.custodia.custodio1_nombre || "--"}
                                </span>
                              </div>
                              <div className="info-group mb-2">
                                <label className="info-label">Teléfono Custodio 1:</label>
                                <span className="info-value">
                                  {bitacora.custodia.custodio1_telefono || "--"}
                                </span>
                              </div>
                              <div className="info-group mb-2">
                                <label className="info-label">Nombre Custodio 2:</label>
                                <span className="info-value">
                                  {bitacora.custodia.custodio2_nombre || "--"}
                                </span>
                              </div>
                              <div className="info-group mb-2">
                                <label className="info-label">Teléfono Custodio 2:</label>
                                <span className="info-value">
                                  {bitacora.custodia.custodio2_telefono || "--"}
                                </span>
                              </div>
                            </div>

                            <div className="col-md-6">
                              <div className="info-group mb-2">
                                <label className="info-label">Placa:</label>
                                <span className="info-value">
                                  {bitacora.custodia.placa || "--"}
                                </span>
                              </div>
                              <div className="info-group mb-2">
                                <label className="info-label">Modelo:</label>
                                <span className="info-value">
                                  {bitacora.custodia.modelo || "--"}
                                </span>
                              </div>
                              <div className="info-group mb-2">
                                <label className="info-label">Color:</label>
                                <span className="info-value">
                                  {bitacora.custodia.color || "--"}
                                </span>
                              </div>
                              <div className="info-group mb-2">
                                <label className="info-label">Marca:</label>
                                <span className="info-value">
                                  {bitacora.custodia.marca || "--"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="monitoreo-section">
                        <h6 className="fw-bold mb-3">Información de Monitoreo</h6>
                        {bitacora.transportes.map((t) => {
                          const validacionEvento = bitacora.eventos.find(
                            (evento) =>
                              evento.nombre.toLowerCase() === "validación" &&
                              evento.transportes.some((tr) => transporteMatch(t, tr))
                          );
                          const inicioMonitoreo = validacionEvento
                            ? validacionEvento.transportes.find((tr) => transporteMatch(t, tr))
                                ?.inicioMonitoreo
                            : null;

                          const cierreEvento = bitacora.eventos.find(
                            (evento) =>
                              evento.nombre.toLowerCase() === "cierre de servicio" &&
                              evento.transportes.some((tr) => transporteMatch(t, tr))
                          );
                          const finalMonitoreo = cierreEvento
                            ? cierreEvento.transportes.find((tr) => transporteMatch(t, tr))?.finalMonitoreo
                            : null;

                          return (
                            <div
                              key={t.id}
                              className="transporte-monitoreo mb-3 p-3 bg-light rounded">
                              <h6 className="fw-semibold mb-2">{getTransporteLabel(t)}</h6>
                              {t.gpsUnits && t.gpsUnits.length > 0 && (
                                <div className="mb-2">
                                  <small className="text-muted">
                                    GPS asociados: {t.gpsUnits.map((gps) => gps.name).join(", ")}
                                  </small>
                                </div>
                              )}
                              <div className="row">
                                <div className="col-md-6">
                                  <div className="info-group mb-2">
                                    <label className="info-label">Inicio Monitoreo:</label>
                                    <span className="info-value">
                                      {inicioMonitoreo ? formatDate(inicioMonitoreo) : "--"}
                                    </span>
                                  </div>
                                </div>
                                <div className="col-md-6">
                                  <div className="info-group mb-2">
                                    <label className="info-label">Final Monitoreo:</label>
                                    <span className="info-value">
                                      {finalMonitoreo ? formatDate(finalMonitoreo) : "--"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Transportes Tab Content */}
              {roleData?.bit_transportes.read && (
                <div className={`tab-pane-modern ${activeTab === "transportes" ? "active" : ""}`}>
                  <div className="modern-card">
                    <div className="card-body-modern">
                      <div className="row" style={{margin: 0}}>
                        <div className="col-md-4" style={{padding: 0, borderRight: '1px solid #f0f1f5'}}>
                          <div className="transporte-list-header">
                            <span className="transporte-list-header__title">Lista de Transportes</span>
                            <span className="transporte-list-header__count">{bitacora.transportes.length}</span>
                          </div>
                          {roleData?.gps_id?.read && (
                            <div className="transporte-list">
                              {bitacora.transportes.length === 0 ? (
                                <div className="transporte-list-empty">
                                  <i className="fa-solid fa-truck"></i>
                                  <span>Sin transportes</span>
                                </div>
                              ) : (
                                bitacora.transportes.map((transporte, index) => {
                                  const isBeingEdited = editedTransporte && selectedTransporte &&
                                    transporteMatch(transporte, selectedTransporte);
                                  const liveTransporte = isBeingEdited
                                    ? { ...transporte, id: editedTransporte.id }
                                    : transporte;
                                  return (
                                    <div
                                      key={transporte.id}
                                      className={`transporte-item ${
                                        selectedTransporte?.id === transporte.id ? "active" : ""
                                      }`}
                                      onClick={() => handleSelectTransporte(transporte)}>
                                      <div className="transporte-item__left">
                                        <span className="transporte-item__index">{index + 1}</span>
                                        <div className="transporte-item__info">
                                          <span className="transporte-id">
                                            {getTransporteLabel(liveTransporte)}
                                          </span>
                                          {transporte.gpsUnits && transporte.gpsUnits.length > 0 && (
                                            <span className="transporte-item__gps">
                                              <i className="fa-solid fa-satellite-dish"></i>
                                              {transporte.gpsUnits.length} GPS
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <i className="fa-solid fa-chevron-right transporte-item__arrow"></i>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>

                        <div className="col-md-8" style={{padding: '0 0 0 16px'}}>
                          {selectedTransporte ? (
                            <div className="transporte-details" ref={transporteDetailRef}>
                              {roleData.bit_transportes.update && (
                                <button
                                  className="edit-transporte-btn"
                                  onClick={handleEditTransporte}
                                  title="Editar transporte">
                                  <i className="fa fa-pen"></i>
                                </button>
                              )}

                              <div className="row">
                                {roleData?.tracto?.read && (
                                  <div className="col-md-6">
                                    <div className="detail-section">
                                      <h6>Tracto</h6>
                                      <div className="info-group mb-2">
                                        <label className="info-label">Eco:</label>
                                        <span className="info-value">
                                          {selectedTransporte.tracto?.eco}
                                        </span>
                                      </div>
                                      <div className="info-group mb-2">
                                        <label className="info-label">Placa:</label>
                                        <span className="info-value">
                                          {selectedTransporte.tracto?.placa}
                                        </span>
                                      </div>
                                      <div className="info-group mb-2">
                                        <label className="info-label">Marca:</label>
                                        <span className="info-value">
                                          {selectedTransporte.tracto?.marca}
                                        </span>
                                      </div>
                                      <div className="info-group mb-2">
                                        <label className="info-label">Modelo:</label>
                                        <span className="info-value">
                                          {selectedTransporte.tracto?.modelo}
                                        </span>
                                      </div>
                                      <div className="info-group mb-2">
                                        <label className="info-label">Color:</label>
                                        <span className="info-value">
                                          {selectedTransporte.tracto?.color}
                                        </span>
                                      </div>
                                      <div className="info-group mb-2">
                                        <label className="info-label">Tipo:</label>
                                        <span className="info-value">
                                          {selectedTransporte.tracto?.tipo}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {roleData?.remolque?.read && (
                                  <div className="col-md-6">
                                    <div className="detail-section">
                                      <h6>Remolque</h6>
                                      <div className="info-group mb-2">
                                        <label className="info-label">Eco:</label>
                                        <span className="info-value">
                                          {selectedTransporte.remolque?.eco}
                                        </span>
                                      </div>
                                      <div className="info-group mb-2">
                                        <label className="info-label">Placa:</label>
                                        <span className="info-value">
                                          {selectedTransporte.remolque?.placa}
                                        </span>
                                      </div>
                                      <div className="info-group mb-2">
                                        <label className="info-label">Color:</label>
                                        <span className="info-value">
                                          {selectedTransporte.remolque?.color}
                                        </span>
                                      </div>
                                      <div className="info-group mb-2">
                                        <label className="info-label">Capacidad:</label>
                                        <span className="info-value">
                                          {selectedTransporte.remolque?.capacidad}
                                        </span>
                                      </div>
                                      <div className="info-group mb-2">
                                        <label className="info-label">Sello:</label>
                                        <span className="info-value">
                                          {selectedTransporte.remolque?.sello}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {roleData?.bit_transportes?.read && (
                                <div className="operador-section">
                                  <h6>Información del Operador</h6>
                                  <div className="row">
                                    <div className="col-md-4">
                                      <div className="info-group mb-2">
                                        <label className="info-label">Línea Transporte:</label>
                                        <span className="info-value">
                                          {selectedTransporte.lineaTransporte}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="col-md-4">
                                      <div className="info-group mb-2">
                                        <label className="info-label">Operador:</label>
                                        <span className="info-value">
                                          {selectedTransporte.operador}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="col-md-4">
                                      <div className="info-group mb-2">
                                        <label className="info-label">Teléfono:</label>
                                        <span className="info-value">
                                          {selectedTransporte.telefono}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* GPS Asociados - Compatible con versiones anteriores y nuevas */}
                                  {selectedTransporte.gpsUnits &&
                                  selectedTransporte.gpsUnits.length > 0 ? (
                                    <div className="gps-asociados-section">
                                      <h6>GPS Asociados</h6>
                                      <div className="row">
                                        <div className="col-12">
                                          <div className="info-group mb-2">
                                            <label className="info-label">IDs de GPS:</label>
                                            <div className="info-value">
                                              <div className="d-flex flex-wrap gap-2">
                                                {selectedTransporte.gpsUnits.map((gps, index) => (
                                                  <span key={index} className="gps-tag">
                                                    {gps.name} (ID: {gps.wialonId})
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              )}

                              {/* Información de GPS asociados */}
                              {selectedTransporte.gpsUnits &&
                                selectedTransporte.gpsUnits.length > 0 && (
                                  <div className="gps-section">
                                    <h6>GPS Asociados</h6>
                                    <div className="row">
                                      {selectedTransporte.gpsUnits.map((gps, index) => (
                                        <div key={index} className="col-md-6 mb-3">
                                          <div className="gps-card">
                                            <h6 className="gps-card__name">
                                              {gps.name}
                                            </h6>
                                            <div className="info-group mb-1">
                                              <label className="info-label small">ID Wialon:</label>
                                              <span className="info-value small">
                                                {gps.wialonId}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                            </div>
                          ) : (
                            <div className="empty-state">
                              <i
                                className="fa fa-truck text-muted mb-3"
                                style={{fontSize: "3rem"}}></i>
                              <p className="text-muted">
                                Seleccione un transporte de la lista para ver los detalles.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Eventos Tab Content */}
              {roleData?.bit_eventos.read && (
                <div className={`tab-pane-modern ${activeTab === "eventos" ? "active" : ""}`}>
                  <div className="eventos-container">
                    {eventos.length === 0 ? (
                      <div className="eventos-empty">
                        <i className="fa-regular fa-calendar-xmark"></i>
                        <p>No hay eventos registrados aún</p>
                      </div>
                    ) : (
                      eventos
                        .slice()
                        .reverse()
                        .map((event, index) => (
                          <EventCard
                            key={event._id || index}
                            event={event}
                            events={events}
                            bitacora={bitacora}
                            setBitacora={setBitacora}
                            setEventos={setEventos}
                            handleEditSubmit={handleEditSubmit}
                            roleData={roleData}
                          />
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <NewEventModal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        edited={edited}
        eventTypes={eventTypes}
        onEventAdded={async () => {
          const latest = await fetchEventos(); // Modify fetchEventos to return data
          await handleFinish(latest); // Pass it into handleFinish
          setModalOpen(false);
        }}
      />

      {editModalVisible && bitacora && (
        <ModalTemplate
          show={editModalVisible}
          title="Editar Bitácora"
          onClose={() => setEditModalVisible(false)}
          onSubmit={handleEditSubmit}>
          <TextInput
            label="Folio de servicio"
            name="folio_servicio"
            value={bitacora.folio_servicio || ""}
            onChange={handleEditChange}
            className="mb-3"
          />

          <TextInput
            label="No. Bitácora"
            name="bitacora_id"
            value={bitacora.bitacora_id || ""}
            onChange={handleEditChange}
            disabled
            className="mb-3"
          />

          <Select
            label="Cliente"
            value={bitacora.cliente || ""}
            onChange={(val) =>
              setBitacora((prev) => ({
                ...prev,
                cliente: val || "",
                origen: null,
                destino: null,
              }))
            }
            options={clients.map((cliente) => ({
              value: cliente.razon_social,
              label: cliente.razon_social,
            }))}
            placeholder="Selecciona una opción"
            className="mb-3"
            searchable
            clearable
          />

          <Select
            label="Tipo de Monitoreo"
            value={bitacora.monitoreo || ""}
            onChange={(val) => {
              setBitacora((prev) => {
                const updates = {monitoreo: val || ""};
                const isCustodia =
                  val === "Custodia fisica" ||
                  val === "CUSTODIA FISICA" ||
                  val?.toLowerCase() === "custodia fisica";
                if (isCustodia && !prev.custodia) {
                  updates.custodia = {
                    custodio1_nombre: "",
                    custodio1_telefono: "",
                    custodio2_nombre: "",
                    custodio2_telefono: "",
                    placa: "",
                    modelo: "",
                    color: "",
                    marca: "",
                  };
                }
                return {...prev, ...updates};
              });
            }}
            options={monitoreos.map((monitoreo) => ({
              value: monitoreo.tipoMonitoreo,
              label: monitoreo.tipoMonitoreo,
            }))}
            placeholder="Selecciona una opción"
            className="mb-3"
            searchable
            clearable
          />

          <Select
            label="Origen"
            value={getLocationValue(
              edited_bitacora.origen,
              origenes.filter((origen) => origen.cliente === bitacora?.cliente)
            )}
            onChange={(val) =>
              setBitacora((prev) => ({
                ...prev,
                origen: val ? JSON.parse(val) : null,
              }))
            }
            options={origenes
              .filter((origen) => origen.cliente === bitacora?.cliente)
              .map((origen) => ({
                value: JSON.stringify(origen),
                label: `${origen.nombre}, ${origen.estado}`,
              }))}
            placeholder="Selecciona una opción"
            className="mb-3"
            searchable
            clearable
          />

          <Select
            label="Destino"
            value={getLocationValue(
              edited_bitacora.destino,
              destinos.filter((destino) => destino.cliente === bitacora?.cliente)
            )}
            onChange={(val) =>
              setBitacora((prev) => ({
                ...prev,
                destino: val ? JSON.parse(val) : null,
              }))
            }
            options={destinos
              .filter((destino) => destino.cliente === bitacora?.cliente)
              .map((destino) => ({
                value: JSON.stringify(destino),
                label: `${destino.nombre}, ${destino.estado}`,
              }))}
            placeholder="Selecciona una opción"
            className="mb-3"
            searchable
            clearable
          />

          {/* Campos de Custodia Física - Solo para tipo "Custodia fisica" */}
          {(bitacora.monitoreo === "Custodia fisica" ||
            bitacora.monitoreo === "CUSTODIA FISICA" ||
            bitacora.monitoreo?.toLowerCase() === "custodia fisica") && (
            <>
              <hr className="my-4" />
              <h6 className="fw-bold mb-3">Información Custodia Física</h6>

              <div className="row">
                <div className="col-md-6">
                  <TextInput
                    label="Nombre Custodio 1"
                    name="custodia.custodio1_nombre"
                    value={bitacora.custodia?.custodio1_nombre || ""}
                    onChange={handleEditChange}
                    className="mb-3"
                  />

                  <TextInput
                    label="Teléfono Custodio 1"
                    name="custodia.custodio1_telefono"
                    value={bitacora.custodia?.custodio1_telefono || ""}
                    onChange={handleEditChange}
                    className="mb-3"
                  />

                  <TextInput
                    label="Nombre Custodio 2"
                    name="custodia.custodio2_nombre"
                    value={bitacora.custodia?.custodio2_nombre || ""}
                    onChange={handleEditChange}
                    className="mb-3"
                  />

                  <TextInput
                    label="Teléfono Custodio 2"
                    name="custodia.custodio2_telefono"
                    value={bitacora.custodia?.custodio2_telefono || ""}
                    onChange={handleEditChange}
                    className="mb-3"
                  />
                </div>

                <div className="col-md-6">
                  <TextInput
                    label="Placa"
                    name="custodia.placa"
                    value={bitacora.custodia?.placa || ""}
                    onChange={handleEditChange}
                    className="mb-3"
                  />

                  <TextInput
                    label="Modelo"
                    name="custodia.modelo"
                    value={bitacora.custodia?.modelo || ""}
                    onChange={handleEditChange}
                    className="mb-3"
                  />

                  <TextInput
                    label="Color"
                    name="custodia.color"
                    value={bitacora.custodia?.color || ""}
                    onChange={handleEditChange}
                    className="mb-3"
                  />

                  <TextInput
                    label="Marca"
                    name="custodia.marca"
                    value={bitacora.custodia?.marca || ""}
                    onChange={handleEditChange}
                    className="mb-3"
                  />
                </div>
              </div>
            </>
          )}
        </ModalTemplate>
      )}

      {/* EDIT TRANSPORTES */}
      {isEditTransporteModalVisible && editedTransporte && (() => {
        const EDIT_STEPS = [
          {key: "gps",      label: "GPS",      icon: "fa-solid fa-satellite-dish"},
          {key: "tracto",   label: "Tracto",   icon: "fa-solid fa-truck"},
          {key: "remolque", label: "Remolque", icon: "fa-solid fa-trailer"},
          {key: "operador", label: "Operador", icon: "fa-solid fa-user-tie"},
        ];
        const isLastEditStep = editTransporteStep === EDIT_STEPS.length - 1;
        const goEditNext = () => { setEditTransporteSlide("forward");  setEditTransporteStep((s) => s + 1); };
        const goEditPrev = () => { setEditTransporteSlide("backward"); setEditTransporteStep((s) => s - 1); };
        const currentKey = EDIT_STEPS[editTransporteStep]?.key;

        return (
        <ModalTemplate
          wide
          show={isEditTransporteModalVisible}
          title="Editar Transporte"
          onClose={() => setEditTransporteModalVisible(false)}
          onSubmit={(e) => e.preventDefault()}
          hideFooter>

          {/* Step indicator */}
          <div className="wizard-steps">
            {EDIT_STEPS.map((step, i) => (
              <React.Fragment key={step.key}>
                <div className={`wizard-step ${i === editTransporteStep ? "active" : ""} ${i < editTransporteStep ? "completed" : ""}`}>
                  <div className="wizard-step-circle">
                    {i < editTransporteStep ? <i className="fa-solid fa-check"></i> : <span>{i + 1}</span>}
                  </div>
                  <span className="wizard-step-label">{step.label}</span>
                </div>
                {i < EDIT_STEPS.length - 1 && (
                  <div className={`wizard-step-connector ${i < editTransporteStep ? "completed" : ""}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="wizard-numeric-indicator">
            Paso {editTransporteStep + 1} de {EDIT_STEPS.length} — {EDIT_STEPS[editTransporteStep]?.label}
          </div>

          {/* Step content */}
          <div key={`edit-step-${editTransporteStep}-${editTransporteSlide}`}
               className={`wizard-step-content slide-${editTransporteSlide}`}>

            {/* GPS step */}
            {currentKey === "gps" && (
              <div className="wizard-step-content">
                <div className="mb-3">
                  <span className="ptext__label">Método de identificación</span>
                  <div className="wizard-radio-group">
                    {[
                      {value: "automatic", label: "Automático", icon: "fa-solid fa-magic-wand-sparkles"},
                      {value: "wialon", label: "GPS ID", icon: "fa-solid fa-satellite-dish"},
                    ].map(({value, label, icon}) => (
                      <label key={value} className={`wizard-radio-card ${idMethod === value ? "selected" : ""}`}>
                        <input type="radio" name="idMethod" value={value} checked={idMethod === value} onChange={() => setIdMethod(value)} className="visually-hidden" />
                        <i className={icon}></i>
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {idMethod === "wialon" && (
                  <div className="unit-picker">
                    <div className="up-search">
                      <i className="fa fa-search up-search-icon"></i>
                      <input className="up-search-input" placeholder="Buscar por nombre o ID…" value={gpsSearchTerm} onChange={(e) => setGpsSearchTerm(e.target.value)} />
                      {gpsSearchTerm && (
                        <button type="button" className="up-search-clear" onClick={() => setGpsSearchTerm("")}>
                          <i className="fa fa-times"></i>
                        </button>
                      )}
                      <span className="up-count">{filteredGpsUnits.length} unidades</span>
                      {filteredGpsUnits.length > 0 && (
                        <button type="button" className="up-select-all" onClick={handleSelectAllFiltered}>
                          {filteredGpsUnits.every((unit) => selectedGpsUnits.some((selected) => selected.id === unit.id)) ? "Deseleccionar" : "Seleccionar todos"}
                        </button>
                      )}
                    </div>
                    <div className="up-list">
                      {units?.length === 0 ? (
                        <div className="up-empty"><i className="fa fa-spinner fa-spin"></i>Cargando unidades…</div>
                      ) : filteredGpsUnits.length === 0 ? (
                        <div className="up-empty"><i className="fa fa-search"></i>Sin resultados para &quot;{gpsSearchTerm}&quot;</div>
                      ) : (
                        filteredGpsUnits.map((unit) => {
                          const isSelected = selectedGpsUnits.some((u) => u.id === unit.id);
                          return (
                            <div key={unit.id} className={`up-item ${isSelected ? "selected" : ""}`} onClick={() => handleGpsUnitToggle(unit)}>
                              <div className="up-item-icon"><i className="fa-solid fa-satellite-dish"></i></div>
                              <div className="up-item-info">
                                <div className="up-item-name">{unit.name}</div>
                                <div className="up-item-id">ID: {unit.id}</div>
                              </div>
                              <div className="up-item-check"><i className="fa fa-check"></i></div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {selectedGpsUnits.length > 0 && (
                      <div className="up-floating-pill">
                        <span>{selectedGpsUnits.length} unidades seleccionadas</span>
                        <button type="button" className="up-pill-clear" onClick={() => setSelectedGpsUnits([])}>Limpiar</button>
                      </div>
                    )}
                  </div>
                )}

                {idMethod === "automatic" && (
                  <div className="mt-3">
                    <TextInput label="ID generado" value={(() => {
                      let numericId;
                      if (editedTransporte?.originalId?.startsWith("T") && editedTransporte.originalId.includes("_")) {
                        const match = editedTransporte.originalId.match(/^T(\d+)_/);
                        numericId = match ? match[1] : (transportes.length + 1).toString().padStart(3, "0");
                      } else {
                        numericId = (transportes.length + 1).toString().padStart(3, "0");
                      }
                      return `T${numericId}_${editedTransporte?.tracto?.placa || "N/A"}`;
                    })()} disabled />
                    <small className="text-muted d-block mt-1">
                      {(() => {
                        let numericId;
                        if (editedTransporte?.originalId?.startsWith("T") && editedTransporte.originalId.includes("_")) {
                          const match = editedTransporte.originalId.match(/^T(\d+)_/);
                          numericId = match ? match[1] : (transportes.length + 1).toString().padStart(3, "0");
                        } else {
                          numericId = (transportes.length + 1).toString().padStart(3, "0");
                        }
                        return `Formato: T${numericId}_${editedTransporte?.tracto?.placa || "N/A"}`;
                      })()}
                    </small>
                  </div>
                )}
              </div>
            )}

            {/* Tracto step */}
            {currentKey === "tracto" && (
              <div className="wizard-step-content">
                <div className="wizard-grid-2">
                {["eco", "placa", "marca", "modelo", "color", "tipo"].map((field) => (
                  <TextInput key={field} label={field.charAt(0).toUpperCase()+field.slice(1)} value={editedTransporte.tracto[field] || ""} onChange={(e) => {
                    const value = e.target.value;
                    setEditedTransporte((prev) => {
                      const updatedTracto = {...prev.tracto, [field]: value};
                      if (field === "eco" && idMethod === "automatic" && (prev.originalId?.startsWith("blank_") || prev.id?.startsWith("0_"))) {
                        const updatedId = `0_${(transportes.length + 1).toString().padStart(2, "0")}_${value || "N/A"}`;
                        return {...prev, id: updatedId, tracto: updatedTracto};
                      }
                      return {...prev, tracto: updatedTracto};
                    });
                  }} className="mb-3" placeholder={field.charAt(0).toUpperCase()+field.slice(1)} />
                ))}
                </div>
              </div>
            )}

            {/* Remolque step */}
            {currentKey === "remolque" && (
              <div className="wizard-step-content">
                <div className="wizard-grid-2">
                {["eco", "placa", "color", "capacidad", "sello"].map((field) => (
                  <TextInput key={field} label={field.charAt(0).toUpperCase()+field.slice(1)} value={editedTransporte.remolque[field] || ""} onChange={(e) => setEditedTransporte((prev) => ({...prev, remolque: {...prev.remolque, [field]: e.target.value}}))} className="mb-3" placeholder={field.charAt(0).toUpperCase()+field.slice(1)} />
                ))}
                </div>
              </div>
            )}

            {/* Operador step */}
            {currentKey === "operador" && (
              <div className="wizard-step-content">
                <Select label="Línea de transporte" value={editDraftLineaText ? "" : (editedTransporte.lineaTransporte || "")} onChange={(val) => {
                  setEditDraftLineaText("");
                  setOperadores([]);
                  setEditedTransporte((prev) => ({ ...prev, lineaTransporte: val || "", operador: "" }));
                }} options={lineasTransporte.map((linea) => ({value: linea.nombre, label: linea.nombre}))} placeholder="Selecciona una línea" searchable clearable className="mb-3" />
                {(roleData?.crear_draft_transporte || editDraftLineaText) && (
                  <TextInput placeholder="O escribe una línea nueva…" value={editDraftLineaText} onChange={(e) => {
                    const val = e.target.value;
                    setEditDraftLineaText(val);
                    setOperadores([]);
                    setEditedTransporte((prev) => ({ ...prev, lineaTransporte: val, operador: "" }));
                  }} className="mb-3" />
                )}
                <Select label="Operador" value={editDraftOperadorText ? "" : (editedTransporte.operador || "")} onChange={(val) => {
                  setEditDraftOperadorText("");
                  setEditedTransporte((prev) => ({ ...prev, operador: val || "" }));
                }} options={operadores.map((op) => ({value: op.nombre, label: op.nombre}))} placeholder={editedTransporte.lineaTransporte ? "Selecciona un operador" : "Selecciona una línea primero"} searchable clearable className="mb-3" disabled={!editedTransporte.lineaTransporte} />
                {(roleData?.crear_draft_transporte || editDraftOperadorText) && (
                  <TextInput placeholder="O escribe un operador nuevo…" value={editDraftOperadorText} onChange={(e) => {
                    const val = e.target.value;
                    setEditDraftOperadorText(val);
                    setEditedTransporte((prev) => ({ ...prev, operador: val }));
                  }} className="mb-3" />
                )}
                <TextInput label="Teléfono" value={editedTransporte.telefono || ""} onChange={(e) => {
                  const value = e.target.value;
                  if (value && !validatePhoneNumber(value)) {
                    setPhoneError("El número de teléfono debe tener exactamente 10 dígitos seguidos (ej: 1234567890)");
                  } else {
                    setPhoneError("");
                  }
                  setEditedTransporte((prev) => ({...prev, telefono: value}));
                }} placeholder="1234567890" className="mb-2" />
                {phoneError ? <small className="text-danger d-block mb-2">{phoneError}</small> : <small className="text-muted d-block mb-2">Exactamente 10 dígitos sin espacios</small>}
              </div>
            )}

          </div>{/* end step content wrapper */}

          {/* Wizard footer */}
          <div className="wizard-footer">
            <button type="button" className="btn btn-outline-secondary"
              onClick={editTransporteStep === 0 ? () => setEditTransporteModalVisible(false) : goEditPrev}>
              {editTransporteStep === 0
                ? <><i className="fa-solid fa-xmark me-1"></i>Cancelar</>
                : <><i className="fa-solid fa-arrow-left me-1"></i>Anterior</>}
            </button>
            {isLastEditStep ? (
              <button type="button" className="btn btn-success" onClick={handleTransportEdit}>
                <i className="fa-solid fa-check me-1"></i>Guardar
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={goEditNext}>
                Siguiente<i className="fa-solid fa-arrow-right ms-1"></i>
              </button>
            )}
          </div>

        </ModalTemplate>
        );
      })()}

      {/* CREATE TRANSPORTES */}
      <CreateTransporteModal
        show={showModal}
        handleClose={handleClose}
        addTransporte={addTransporte}
        transportes={transportes}
        bitacora={bitacora}
        units={units}
        onDraftCreated={fetchDrafts}
      />

      {/* DRAFTS MODAL */}
      {showDraftsModal && (
        <ModalTemplate
          show={showDraftsModal}
          title="Borradores pendientes de aprobación"
          onClose={() => { setShowDraftsModal(false); setDraftModalDismissed(true); }}
          hideFooter>
          {drafts.filter((d) => d.status === "pendiente").length === 0 ? (
            <p className="text-muted">No hay borradores pendientes.</p>
          ) : (
            <div className="d-flex flex-column gap-3">
              {drafts.filter((d) => d.status === "pendiente").map((draft) => {
                const isPlanDraft = !!draft.transporte;
                return (
                <div key={draft._id} className="border rounded p-3 bg-light">
                  {isPlanDraft ? (
                    // Plan draft — show confirmed values directly, no approval needed
                    <>
                      <div className="mb-1">
                        <small className="text-muted">Transporte:</small>{" "}
                        <strong>{draft.transporte}</strong>
                      </div>
                      {draft.lineaTransporte && (
                        <div className="mb-1">
                          <small className="text-muted">Línea de Transporte:</small>{" "}
                          <strong>{draft.lineaTransporte}</strong>
                        </div>
                      )}
                      {draft.operador && (
                        <div className="mb-1">
                          <small className="text-muted">Operador:</small>{" "}
                          <strong>{draft.operador}</strong>
                        </div>
                      )}
                      {draft.telefono && (
                        <div className="mb-1">
                          <small className="text-muted">Teléfono:</small>{" "}
                          <strong>{draft.telefono}</strong>
                        </div>
                      )}
                    </>
                  ) : (
                    // Regular draft — show pending approval fields
                    <>
                      {draft.lineaTransporte_es_draft && (
                        <div className="mb-1">
                          <small className="text-muted">Línea de Transporte (pendiente):</small>{" "}
                          <strong>{draft.lineaTransporte ?? <span className="text-muted fst-italic">Sin asignar</span>}</strong>
                        </div>
                      )}
                      {draft.operador_es_draft && (
                        <div className="mb-1">
                          <small className="text-muted">Operador (pendiente):</small>{" "}
                          <strong>{draft.operador ?? <span className="text-muted fst-italic">Sin asignar</span>}</strong>
                        </div>
                      )}
                      {draft.telefono && (
                        <div className="mb-1">
                          <small className="text-muted">Teléfono:</small>{" "}
                          <strong>{draft.telefono}</strong>
                        </div>
                      )}
                    </>
                  )}
                  <div className="mb-2">
                    <small className="text-muted">Creado por:</small> {draft.creado_por}
                  </div>
                  {(() => {
                    const openEdit = async () => {
                      // Match the draft to its transporte. The exact id can drift:
                      // a plan draft starts with transporte_id = plan name (e.g. "ESTAFETA"),
                      // but once the bitácora advances the transporte gets a real id
                      // (e.g. "T002_61BB7M"). Fall back to a name match, and finally to the
                      // sole transporte when there is only one, so "Completar registro" keeps working.
                      const transportes = bitacora.transportes || [];
                      const draftId = (draft.transporte_id || "").trim();
                      const draftName = (draft.transporte || "").trim().toLowerCase();
                      const transporte =
                        transportes.find((t) => t.id === draft.transporte_id)
                        || (draftId && transportes.find((t) => (t.id || "").trim() === draftId))
                        || (draftName && transportes.find((t) =>
                              (t.id || "").toLowerCase().includes(draftName)
                              || (t.lineaTransporte || "").trim().toLowerCase() === draftName))
                        || (transportes.length === 1 ? transportes[0] : null);
                      if (!transporte) {
                        console.error("No se encontró el transporte del borrador", {
                          draftId: draft._id,
                          transporte_id: draft.transporte_id,
                          ids: transportes.map((t) => t.id),
                        });
                        return;
                      }
                      setPendingRejectDraftId(draft._id);
                      setEditIsPlanDraft(isPlanDraft);
                      // Values for plan drafts come from the stored bitacora transporte
                      const lineaVal = transporte.lineaTransporte || draft.lineaTransporte || "";
                      const operadorVal = transporte.operador || draft.operador || "";
                      const telefonoVal = transporte.telefono || draft.telefono || "";
                      setEditedTransporte({
                        ...transporte,
                        tracto:          transporte.tracto   ?? {},
                        remolque:        transporte.remolque ?? {},
                        originalId:      transporte.id,
                        lineaTransporte: lineaVal,
                        operador:        operadorVal,
                        telefono:        telefonoVal,
                      });
                      setIdMethod(isPlanDraft ? "automatic" : (
                        transporte.gpsUnits?.length > 0 ? "wialon" : "automatic"
                      ));
                      // For plan drafts, pre-fill the text inputs with the confirmed values
                      if (isPlanDraft) {
                        setEditDraftLineaText(lineaVal);
                        setEditDraftOperadorText(operadorVal);
                        if (lineaVal) await fetchOperadores(lineaVal);
                        else setOperadores([]);
                      } else {
                        const lineaToFetch = transporte.lineaTransporte || (!draft.lineaTransporte_es_draft && draft.lineaTransporte);
                        if (lineaToFetch) await fetchOperadores(lineaToFetch);
                        else setOperadores([]);
                        setEditDraftLineaText(draft.lineaTransporte_es_draft ? (draft.lineaTransporte ?? "") : "");
                        setEditDraftOperadorText(draft.operador_es_draft ? (draft.operador ?? "") : "");
                      }
                      setSelectedGpsUnits(
                        transporte.gpsUnits?.map((g) => ({id: g.wialonId, name: g.name})) ?? []
                      );
                      setEditTransporteStep(0);
                      setEditTransporteSlide("forward");
                      setShowDraftsModal(false);
                      setEditTransporteModalVisible(true);
                    };
                    return (
                      <div className="d-flex gap-2">
                        {!isPlanDraft && (
                          <button
                            type="button"
                            className="draft-action-btn draft-action-btn--accept"
                            onClick={() => handleDraftAction(draft._id, "accept")}>
                            <i className="fa-solid fa-check"></i> Aceptar
                          </button>
                        )}
                        <button
                          type="button"
                          className="draft-action-btn draft-action-btn--edit"
                          onClick={openEdit}>
                          <i className="fa-solid fa-pen"></i>{" "}
                          {isPlanDraft ? "Completar registro" : "Editar"}
                        </button>
                      </div>
                    );
                  })()}
                </div>
                );
              })}
            </div>
          )}
        </ModalTemplate>
      )}
    </section>
  );
};

export default BitacoraDetailPage;
