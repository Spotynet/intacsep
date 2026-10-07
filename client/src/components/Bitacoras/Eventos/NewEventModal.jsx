import React, {useEffect, useMemo, useState} from "react";
import {useAuth} from "../../../context/AuthContext";
import {useWialon} from "../../../context/WialonProvider";
import {useParams} from "react-router-dom";
import ModalTemplate from "../../ModalTemplate";
import {Select} from "../../Select";
import TextInput from "../../TextInput";
import TextArea from "../../TextArea";
import WialonMap from "../../wialon/WialonMap";

const getTransporteLabel = (transporte) => {
  const id = transporte.id || "";
  if (!id) return "Sin ID";
  if (id.startsWith("T") && id.includes("_")) return id;
  const parts = id.split("_");
  if (parts.length >= 3) return `${parts[1]} - ${parts[2]}`;
  if (parts.length === 2) return `${parts[0]} - ${parts[1]}`;
  return id;
};

// Match by internalId when both have it, fall back to display id
const tMatch = (a, b) =>
  (a.internalId && b.internalId && a.internalId === b.internalId) || a.id === b.id;

const isManualTransporte = (t) => !t.gpsUnits || t.gpsUnits.length === 0;

const NewEventModal = ({show, onClose, edited, eventTypes, onEventAdded, bitacoraId: propBitacoraId, initialTransporteId}) => {
  const [bitacora, setBitacora] = useState(null);
  const {id: paramsId} = useParams();
  const id = propBitacoraId || paramsId;
  const {verifyToken, user, setUser} = useAuth();
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const [selectedTransportes, setSelectedTransportes] = useState([]);
  const [transportes, setTransportes] = useState([]);
  const {getUnitById} = useWialon();
  const [openTransportId, setOpenTransportId] = useState(null);

  const toggleCollapse = (id) => {
    setOpenTransportId(openTransportId === id ? null : id);
  };

  const [newEvent, setNewEvent] = useState({
    nombre: "",
    descripcion: "",
    frecuencia: 0,
    registrado_por: `${user?.firstName} ${user?.lastName}`,
    transportes: [],
  });

  useEffect(() => {
    const init = async () => {
      try {
        const userData = await verifyToken();
        setUser(userData);
        if (id) await fetchBitacora();
      } catch (error) {
        console.error("Token verification or Bitacora fetch failed:", error);
      }
    };

    init();
  }, [id]);

  useEffect(() => {
    if (show && id) fetchBitacora();
  }, [show, id]);

  const fetchBitacora = async () => {
    try {
      const response = await fetch(`${baseUrl}/bitacora/${id}`, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        let targetBitacora = null;
        let targetTransportes = [];

        if (edited) {
          targetBitacora = data.edited_bitacora;
          targetTransportes = data.edited_bitacora.transportes;
        } else if (!edited && data.edited_bitacora) {
          targetBitacora = data;
          targetTransportes = data.transportes;
        } else {
          targetBitacora = data;
          targetTransportes = data.transportes;
        }

        setBitacora(targetBitacora);
        setTransportes(targetTransportes);

        // Pre-select unit if provided and available
        if (initialTransporteId) {
          const match = targetTransportes.find(t => String(t.id) === String(initialTransporteId));
          if (match) {
            // Need to set bitacora first so handleCheckboxChange finds it
            // We use a slight delay or pass the bitacora directly to the function
            setTimeout(() => {
               handleCheckboxChange({ target: { value: String(match.id), checked: true } }, targetBitacora);
               setOpenTransportId(match.id);
            }, 100);
          }
        }
      } else {
        console.error("Failed to fetch bitácora:", response.statusText);
      }
    } catch (e) {
      console.error("Error fetching bitácora:", e);
    }
  };

  // Función para formatear el tiempo transcurrido en "X time ago"
  const formatDuration = (seconds) => {
    if (seconds < 60) return `Hace ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days}d`;
  };

  // Función asincrónica para obtener la dirección a partir de las coordenadas
  const getAddressFromCoordinates = (lon, lat) => {
    return new Promise((resolve, reject) => {
      if (!lon || !lat) return reject("Invalid coordinates");

      window.wialon.util.Gis.getLocations([{lon, lat}], (code, res) => {
        if (code === 0) resolve(res[0]);
        else reject("No se pudo obtener la dirección.");
      });
    });
  };

  const getUnitInfo = async (wialonId) => {
    const unit = getUnitById(wialonId);

    if (!unit || typeof unit.getPosition !== "function") {
      console.warn("⚠️ Unidad no disponible en sesión.");
      return null;
    }

    const pos = unit.getPosition();
    if (!pos) {
      console.warn("⚠️ Posición no encontrada.");
      return null;
    }

    let ubicacion = "";
    try {
      const address = await getAddressFromCoordinates(pos.x, pos.y);
      ubicacion = Array.isArray(address) ? address.join(", ") : address;
    } catch (e) {
      console.warn("⚠️ Dirección no encontrada:", e);
    }

    return {
      duracion: formatDuration(Math.floor(Date.now() / 1000) - pos.t),
      velocidad: pos.s,
      coordenadas: `${pos.y}, ${pos.x}`,
      ultimo_posicionamiento: window.wialon.util.DateTime.formatTime(pos.t),
      ubicacion,
    };
  };

  const getMultipleGpsData = async (transporte) => {
    // Compatibilidad con versiones anteriores
    if (!transporte.gpsUnits || transporte.gpsUnits.length === 0) {
      // Transporte antiguo - usar el ID original
      const formattedId = transporte.id.split("_")[0];
      if (formattedId === "0" || formattedId === "blank") {
        return []; // Transporte manual
      }

      const data = await getUnitInfo(formattedId);
      return data
        ? [
            {
              wialonId: formattedId,
              name: `GPS ${formattedId}`,
              data: data,
            },
          ]
        : [];
    }

    // Transporte nuevo con múltiples GPS
    const gpsDataPromises = transporte.gpsUnits.map(async (gpsUnit) => {
      const data = await getUnitInfo(gpsUnit.wialonId);
      return {
        wialonId: gpsUnit.wialonId,
        name: gpsUnit.name,
        data: data || {},
      };
    });

    return await Promise.all(gpsDataPromises);
  };

  const handleCheckboxChange = async (e, manualBitacora = null) => {
    const {value, checked} = e.target;
    const transporteId = value;

    const targetBitacora = manualBitacora || bitacora;
    if (!targetBitacora) return;

    const transporteToAdd = targetBitacora.transportes.find(
      (transporte) => String(transporte.id) === transporteId
    );

    if (!transporteToAdd) return;

    // Crear una copia del transporte para modificar
    const transporteCopy = {...transporteToAdd};

    // Verificar si es transporte manual (sin GPS)
    const isManual =
      transporteId.startsWith("blank_") ||
      (transporteId.startsWith("T") &&
        (!transporteCopy.gpsUnits || transporteCopy.gpsUnits.length === 0));

    if (isManual) {
      // Transporte manual - datos estáticos
      transporteCopy.registro = {
        ubicacion: "",
        duracion: "",
        ultimo_posicionamiento: "",
        velocidad: "",
        coordenadas: "",
      };
    } else {
      // Transporte con GPS - obtener datos de múltiples GPS
      const gpsData = await getMultipleGpsData(transporteCopy);

      if (gpsData.length === 0) {
        console.log("⚠️ No se pudo obtener datos de GPS. Activando modo manual.");
        transporteCopy.registro = {
          ubicacion: "",
          duracion: "",
          ultimo_posicionamiento: "",
          velocidad: "",
          coordenadas: "",
        };
      } else {
        // Guardar datos de múltiples GPS
        transporteCopy.gpsData = gpsData;
        // Para compatibilidad, usar datos del primer GPS como registro principal
        transporteCopy.registro = gpsData[0].data || {};
      }
    }

    // Update transportes in newEvent
    let updatedTransportes = [...newEvent.transportes];

    if (checked) {
      if (!updatedTransportes.some((t) => tMatch(t, transporteCopy))) {
        updatedTransportes.push(transporteCopy);
      }
    } else {
      updatedTransportes = updatedTransportes.filter((t) => !tMatch(t, transporteCopy));
    }

    setNewEvent((prev) => ({
      ...prev,
      transportes: updatedTransportes,
    }));
  };

  const handleSelectChange = (val) => {
    // Auto-set and disable frecuencia if event is Cierre de servicio
    if (val?.toLowerCase() === "cierre de servicio") {
      setNewEvent((prev) => ({...prev, nombre: val, frecuencia: 0}));
    } else {
      setNewEvent((prev) => ({...prev, nombre: val}));
    }
  };

  const filteredEventOptions = React.useMemo(() => {
    if (!newEvent.transportes.length || !bitacora) return [];

    // Filtrar eventos con nombre "Validación"
    const eventosValidacion =
      bitacora?.eventos.filter((evento) => evento.nombre.toLowerCase() === "validación") || [];

    // Filtrar eventos con nombre "Inicio de recorrido"
    const eventosInicioRecorrido =
      bitacora?.eventos.filter((evento) => evento.nombre.toLowerCase() === "inicio de recorrido") ||
      [];

    // Filtrar eventos con nombre "Arribo a destino"
    const eventosArriboDestino =
      bitacora?.eventos.filter((evento) => evento.nombre.toLowerCase() === "arribo a destino") ||
      [];

    // Build a matcher that checks id OR internalId so renamed transportes stay linked
    const transporteInSet = (eventoTransportes, candidate) =>
      eventoTransportes.some((et) => {
        if (candidate.internalId && et.internalId && candidate.internalId === et.internalId) return true;
        return et.id?.toLowerCase() === candidate.id?.toLowerCase();
      });

    const allTransportesInEvento = (candidatos, eventoList) =>
      candidatos.every((c) =>
        eventoList.some((ev) => transporteInSet(ev.transportes, c))
      );

    // Verificar si TODOS los selectedTransportes están en eventos de "Validación"
    const allSelectedTransportesInValidacion = allTransportesInEvento(
      newEvent.transportes, eventosValidacion
    );

    // Verificar si TODOS los selectedTransportes están en eventos de "Inicio de recorrido"
    const allSelectedTransportesInInicioRecorrido = allTransportesInEvento(
      newEvent.transportes, eventosInicioRecorrido
    );

    // Verificar si TODOS los selectedTransportes están en eventos de "Arribo a destino"
    const allSelectedTransportesInArriboDestino = allTransportesInEvento(
      newEvent.transportes, eventosArriboDestino
    );

    let finalTypes = [];

    if (allSelectedTransportesInValidacion) {
      if (allSelectedTransportesInInicioRecorrido) {
        // Si todos los transportes están en "Validación" y "Inicio de recorrido"
        finalTypes = eventTypes.filter(
          (eventType) =>
            allSelectedTransportesInArriboDestino ||
            eventType.evento.toLowerCase() !== "cierre de servicio"
        );
      } else {
        // Si todos los transportes están en "Validación" pero no en "Inicio de recorrido", mostrar solo "Inicio de recorrido"
        const inicioRecorridoEventType = eventTypes.find(
          (et) => et.evento.toLowerCase() === "inicio de recorrido"
        );
        if (inicioRecorridoEventType) {
          finalTypes = [inicioRecorridoEventType];
        } else {
          finalTypes = [{_id: 'temp-ir', evento: 'Inicio de recorrido'}];
        }
      }
    } else {
      // Si algún transporte no está en "Validación", solo permitir "Validación"
      const validacionEventType = eventTypes.find(
        (et) => et.evento.toLowerCase() === "validación"
      );
      if (validacionEventType) {
        finalTypes = [validacionEventType];
      } else {
        finalTypes = [{_id: 'temp-val', evento: 'Validación'}];
      }
    }

    return finalTypes.map(et => ({ value: et.evento, label: et.evento }));
  }, [newEvent.transportes, bitacora, eventTypes]);

  const handleChange = (e) => {
    const {name, value} = e.target;

    // Auto-set and disable frecuencia if event is Cierre de servicio
    if (name === "nombre" && value.toLowerCase() === "cierre de servicio") {
      setNewEvent((prev) => ({...prev, [name]: value, frecuencia: 0}));
    } else {
      setNewEvent((prev) => ({...prev, [name]: value}));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newEvent.transportes?.length === 0 || !newEvent.transportes) {
      alert("Favor de seleccionar un transporte.");
      return;
    }

    const isValidacion = newEvent.nombre.toLowerCase() === "validación";
    const isCierreDeServicio = newEvent.nombre.toLowerCase() === "cierre de servicio";
    const currentDate = new Date().toISOString();

    console.log(newEvent);

    const updatedTransportes = newEvent.transportes.map((transporte) => ({
      ...transporte,
      inicioMonitoreo: isValidacion ? currentDate : transporte.inicioMonitoreo,
      finalMonitoreo: isCierreDeServicio ? currentDate : transporte.finalMonitoreo,
    }));

    console.log(
      "🚀 Enviando datos al backend:",
      JSON.stringify(
        {
          nombre: newEvent.nombre,
          descripcion: newEvent.descripcion,
          registrado_por: `${user.firstName} ${user.lastName}`,
          frecuencia: newEvent.frecuencia,
          transportes: updatedTransportes,
        },
        null,
        2
      )
    );

    if (bitacora.status === "nueva" && newEvent.nombre.toLowerCase() === "validación") {
      try {
        const response = await fetch(`${baseUrl}/bitacora/${id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "validada",
            inicioMonitoreo: new Date().toISOString(), // Set the start time
          }),
          credentials: "include",
        });
        if (response.ok) {
          const updatedBitacora = await response.json();
          setBitacora(updatedBitacora);
        } else {
          console.error("Failed to start bitácora:", response.statusText);
        }
      } catch (e) {
        console.error("Error starting bitácora:", e);
      }
    }

    if (bitacora.status === "validada" && newEvent.nombre.toLowerCase() === "inicio de recorrido") {
      try {
        const response = await fetch(`${baseUrl}/bitacora/${id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "iniciada",
            inicioMonitoreo: new Date().toISOString(), // Set the start time
          }),
          credentials: "include",
        });
        if (response.ok) {
          const updatedBitacora = await response.json();
          setBitacora(updatedBitacora);
        } else {
          console.error("Failed to start bitácora:", response.statusText);
        }
      } catch (e) {
        console.error("Error starting bitácora:", e);
      }
    }

    const eventosArriboDestino =
      bitacora?.eventos.filter((evento) => evento.nombre.toLowerCase() === "arribo a destino") ||
      [];

    const transporteMatchesEvento = (candidate, eventoTransportes) =>
      eventoTransportes.some((et) => {
        if (candidate.internalId && et.internalId && candidate.internalId === et.internalId) return true;
        return et.id === candidate.id;
      });

    const allTransportesInArriboDestino = bitacora.transportes.every((t) =>
      eventosArriboDestino.some((ev) => transporteMatchesEvento(t, ev.transportes))
    );

    try {
      console.log(newEvent);

      const response = await fetch(`${baseUrl}/bitacora/${id}/event`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          nombre: newEvent.nombre,
          descripcion: newEvent.descripcion,
          registrado_por: `${user.firstName} ${user.lastName}`,
          frecuencia: newEvent.frecuencia,
          transportes: updatedTransportes,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        console.error("Error en respuesta del servidor:", response.statusText);
        return;
      }

      const updatedBitacora = await response.json();
      console.log("✅ Evento guardado en la DB:", updatedBitacora);
      setBitacora(updatedBitacora);
      setNewEvent({
        nombre: "",
        descripcion: "",
        frecuencia: 0,
        registrado_por: `${user?.firstName} ${user?.lastName}`,
        transportes: [],
      });
      onEventAdded();
    } catch (e) {
      console.error("Error en handleSubmit:", e);
    }
  };

  const handleManualRegistroChange = (transporteInternalId, field, value) => {
    setNewEvent((prev) => {
      const updatedTransportes = prev.transportes.map((t) => {
        if (t.internalId ? t.internalId === transporteInternalId : t.id === transporteInternalId) {
          return {
            ...t,
            registro: {
              ...t.registro,
              [field]: value,
            },
          };
        }
        return t;
      });

      return {
        ...prev,
        transportes: updatedTransportes,
      };
    });
  };

  const handleGpsDataChange = (transporteInternalId, gpsIndex, field, value) => {
    setNewEvent((prev) => {
      const updatedTransportes = prev.transportes.map((t) => {
        if (t.internalId ? t.internalId === transporteInternalId : t.id === transporteInternalId) {
          const updatedGpsData = [...(t.gpsData || [])];
          if (updatedGpsData[gpsIndex]) {
            updatedGpsData[gpsIndex] = {
              ...updatedGpsData[gpsIndex],
              data: {
                ...updatedGpsData[gpsIndex].data,
                [field]: value,
              },
            };
          }

          return {
            ...t,
            gpsData: updatedGpsData,
            // También actualizar el registro principal con el primer GPS
            registro: updatedGpsData[0]?.data || t.registro,
          };
        }
        return t;
      });

      return {
        ...prev,
        transportes: updatedTransportes,
      };
    });
  };

  let allSelectedTransportesInArriboDestino = false;

  // Map scopes to selected transportes' GPS; falls back to all bitácora GPS.
  const mapUnitIds = useMemo(() => {
    const source =
      newEvent.transportes?.length > 0
        ? newEvent.transportes
        : bitacora?.transportes || [];
    const ids = [];
    const seen = new Set();
    for (const t of source) {
      for (const g of t.gpsUnits || []) {
        if (g?.wialonId == null) continue;
        const id = String(g.wialonId).trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }, [newEvent.transportes, bitacora?.transportes]);

  return (
    <ModalTemplate
      show={show}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Crear Nuevo Evento"
      extraWide
      className="split-view-modal new-event-modal--with-map"
    >
      <div className="new-event-modal-split">
        <div className="new-event-modal-split__form new-event-modal">
          <div className="mb-4">
            <label className="pselect__label">Transportes vinculados</label>
            <div className="transport-grid">
              {bitacora?.transportes
                ?.filter((transporte) => {
                  const cierreEventos =
                    bitacora?.eventos?.filter(
                      (evento) => evento.nombre.toLowerCase() === "cierre de servicio"
                    ) || [];
                  return !cierreEventos.some((ev) =>
                    ev.transportes.some((t) => tMatch(t, transporte))
                  );
                })
                .map((transporte) => {
                  const isSelected = newEvent.transportes.some((t) => tMatch(t, transporte));
                  return (
                    <div
                      className={`transportes-checkbox ${isSelected ? "checked" : ""}`}
                      key={transporte.internalId || transporte.id}
                      onClick={() => handleCheckboxChange({ 
                        target: { 
                          value: String(transporte.id), 
                          checked: !isSelected 
                        } 
                      })}
                    >
                      <div className={`pselect__checkbox ${isSelected ? "pselect__checkbox--checked" : ""}`}>
                        {isSelected && <i className="fa fa-check"></i>}
                      </div>
                      <span className="ms-2">
                        {`${getTransporteLabel(transporte)}${transporte.tracto?.eco ? ` - ${transporte.tracto.eco}` : ""}`}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="row">
            <div className="col-md-7 mb-4">
              <Select
                label="Tipo de Evento"
                options={filteredEventOptions}
                value={newEvent.nombre}
                onChange={handleSelectChange}
                placeholder="Seleccionar..."
                disabled={newEvent.transportes.length === 0}
              />
              {newEvent.transportes.length === 0 && (
                <div className="mt-1 small text-muted">
                  Selecciona al menos un transporte para ver los eventos disponibles.
                </div>
              )}
            </div>

            <div className="col-md-5 mb-4">
              <TextInput
                label="Frecuencia (min)"
                type="number"
                name="frecuencia"
                value={newEvent.frecuencia}
                onChange={handleChange}
                disabled={newEvent.nombre.toLowerCase() === "cierre de servicio"}
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <TextArea
              label="Descripción / Comentario"
              name="descripcion"
              value={newEvent.descripcion}
              onChange={handleChange}
              rows={3}
              placeholder="Detalles del evento..."
              required
            />
          </div>

          <div className="mb-4">
            <TextInput
              label="Fecha de registro"
              value={new Date().toLocaleString("es-MX", {hour12: false, dateStyle: "medium", timeStyle: "short"})}
              disabled
            />
          </div>

          {newEvent.transportes.length > 0 && (
            <>
              <hr className="my-4" />
              <div className="mb-3">
                <label className="pselect__label">Detalle por unidad</label>
                {newEvent.transportes?.map((t) => {
                  const tKey = t.internalId || t.id;
                  const isManual = isManualTransporte(t);
                  return (
                    <div key={tKey} className="modern-unit-card mb-3">
                      <div
                        className="modern-unit-card__header"
                        onClick={() => toggleCollapse(tKey)}
                      >
                        <div className="fw-bold text-dark">{getTransporteLabel(t)}</div>
                        <div className="d-flex align-items-center gap-2">
                          <span className={`badge ${isManual ? "bg-warning-subtle text-warning-emphasis" : "bg-success-subtle text-success-emphasis"}`}>
                            {isManual ? "Manual" : "GPS"}
                          </span>
                          <i className={`fa fa-chevron-${openTransportId === tKey ? "up" : "down"} ms-2 text-muted small`}></i>
                        </div>
                      </div>

                      {openTransportId === tKey && (
                        <div className="modern-unit-card__body p-3">
                          {t.gpsData && t.gpsData.length > 0 ? (
                            <div className="row g-3">
                              {t.gpsData.map((gps, index) => (
                                <div key={index} className="col-12 p-3 border rounded bg-white">
                                  <div className="d-flex align-items-center mb-3 gap-2">
                                    <i className="fa fa-satellite-dish text-primary"></i>
                                    <h6 className="fw-bold mb-0 small">
                                      {gps.name} (ID: {gps.wialonId})
                                    </h6>
                                  </div>
                                  <div className="row g-2">
                                    {[
                                      "duracion",
                                      "ubicacion",
                                      "velocidad",
                                      "ultimo_posicionamiento",
                                      "coordenadas",
                                    ].map((field) => (
                                      <div className="col-md-6" key={field}>
                                        <TextInput
                                          label={field.replace("_", " ")}
                                          value={gps.data?.[field] || ""}
                                          onChange={(e) => handleGpsDataChange(tKey, index, field, e.target.value)}
                                          className="mb-2"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="row g-2">
                              {[
                                "duracion",
                                "ubicacion",
                                "velocidad",
                                "ultimo_posicionamiento",
                                "coordenadas",
                              ].map((field) => (
                                <div className="col-md-6" key={field}>
                                  <TextInput
                                    label={`${field.replace("_", " ")}${isManual ? " *" : ""}`}
                                    value={t.registro?.[field] || ""}
                                    onChange={(e) => handleManualRegistroChange(tKey, field, e.target.value)}
                                    required={isManual}
                                    className="mb-2"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="new-event-modal-split__map">
          <div className="new-event-modal-split__map-label">
            Mapa Wialon
            {mapUnitIds.length > 0
              ? ` · ${mapUnitIds.length} GPS`
              : ""}
          </div>
          {mapUnitIds.length > 0 ? (
            <WialonMap
              unitIds={mapUnitIds}
              className="wialon-map-wrapper--embedded"
            />
          ) : (
            <div className="new-event-modal-split__map-empty">
              <i className="fa fa-map-marked-alt"></i>
              <p>Selecciona un transporte con GPS para verlo en el mapa.</p>
            </div>
          )}
        </div>
      </div>
    </ModalTemplate>
  );
};

export default NewEventModal;
