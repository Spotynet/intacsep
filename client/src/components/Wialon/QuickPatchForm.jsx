import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../hooks/useToast";
import { useWialon } from "../../context/WialonProvider";
import { Select } from "../Select";
import { TextInput } from "../TextInput";
import { TextArea } from "../TextArea";
import { findBestEventMatch } from "../../utils/wialonUtils";

const formatDuration = (seconds) => {
  if (seconds < 60) return `Hace ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
};

const getAddressFromCoordinates = (lon, lat) => {
  return new Promise((resolve, reject) => {
    if (!lon || !lat) return reject("Invalid coordinates");
    if (!window.wialon?.util?.Gis?.getLocations) return reject("Wialon GIS not available");

    window.wialon.util.Gis.getLocations([{lon, lat}], (code, res) => {
      if (code === 0) resolve(res[0]);
      else reject("No se pudo obtener la dirección.");
    });
  });
};

export async function getGpsSnapshot(wialonId, getUnitById) {
  const unitObj = getUnitById(wialonId);
  if (!unitObj || typeof unitObj.getPosition !== "function") return null;

  const pos = unitObj.getPosition();
  if (!pos) return null;

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
    ultimo_posicionamiento: window.wialon?.util?.DateTime?.formatTime(pos.t) || "—",
    ubicacion,
  };
}

export async function enrichTransportWithGps(transporte, getUnitById) {
  if (!transporte) return null;
  const transporteCopy = {...transporte};

  let gpsData = [];
  if (!transporte.gpsUnits || transporte.gpsUnits.length === 0) {
    const formattedId = transporte.id?.split("_")[0];
    if (formattedId && formattedId !== "0" && formattedId !== "blank") {
      const data = await getGpsSnapshot(formattedId, getUnitById);
      if (data) gpsData = [{wialonId: formattedId, name: `GPS ${formattedId}`, data}];
    }
  } else {
    gpsData = await Promise.all(
      transporte.gpsUnits.map(async (gpsUnit) => ({
        wialonId: gpsUnit.wialonId,
        name: gpsUnit.name,
        data: (await getGpsSnapshot(gpsUnit.wialonId, getUnitById)) || {},
      }))
    );
  }

  if (gpsData.length === 0) {
    transporteCopy.registro = transporteCopy.registro || {
      ubicacion: "",
      duracion: "",
      ultimo_posicionamiento: "",
      velocidad: "",
      coordenadas: "",
    };
  } else {
    transporteCopy.gpsData = gpsData;
    transporteCopy.registro = gpsData[0].data || {};
  }

  return transporteCopy;
}

const QuickPatchForm = forwardRef(({ unit, eventTypes, onSuccess, onCancel }, ref) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { getUnitById } = useWialon();
  const baseUrl = import.meta.env.VITE_BASE_URL;

  const [loading, setLoading] = useState(false);
  const [bitacora, setBitacora] = useState(null);
  const [matchSource, setMatchSource] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    frecuencia: 0,
  });
  const [transportData, setTransportData] = useState(null);

  // Expose handleSubmit to parent
  useImperativeHandle(ref, () => ({
    submit: () => {
      // Use a custom event to trigger the form's onSubmit or just call handleSubmit
      const fakeEvent = { preventDefault: () => {} };
      return handleSubmit(fakeEvent);
    },
    isLoading: loading
  }));

  const getTransporteLabel = (transporte) => {
    const id = transporte.id || "";
    if (!id) return "Sin ID";
    if (id.startsWith("T") && id.includes("_")) return id;
    const parts = id.split("_");
    if (parts.length >= 3) return `${parts[1]} - ${parts[2]}`;
    if (parts.length === 2) return `${parts[0]} - ${parts[1]}`;
    return id;
  };

  const fetchBitacora = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/bitacora/${unit.bitacora_raw_id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setBitacora(data);
        
        // Find the specific transport
        const match = data.transportes.find(
          t => String(t.id) === String(unit.transporte_id) || t.placa === unit.placa
        );
        if (match) {
          setTransportData(match); // Set initial data, enrichment happens in another effect
        }
      }
    } catch (err) {
      console.error("Error fetching bitacora:", err);
    }
  }, [unit, baseUrl]);

  useEffect(() => {
    if (unit?.bitacora_raw_id) {
      fetchBitacora();
    }
  }, [unit, fetchBitacora]);

  // Dedicated effect for GPS enrichment
  useEffect(() => {
    let active = true;
    const runEnrichment = async () => {
      if (!transportData || transportData.gpsEnriched) return;
      
      const enriched = await enrichTransportWithGps(transportData, getUnitById);
      if (active && enriched && enriched.gpsData?.length > 0) {
        setTransportData({ ...enriched, gpsEnriched: true });
      }
    };
    
    runEnrichment();
    return () => { active = false; };
  }, [transportData, getUnitById]);

  // Autofill and Match Logic
  useEffect(() => {
    if (unit?.eventName && !formData.descripcion) {
      setFormData(prev => ({
        ...prev,
        descripcion: `Alerta Intacsep: ${unit.eventName}`
      }));
    }

    if (unit?.eventName && eventTypes.length > 0) {
      const bestMatch = findBestEventMatch(unit.eventName, eventTypes);
      
      if (bestMatch) {
        setFormData(prev => ({ ...prev, nombre: bestMatch.match.evento }));
        setMatchSource(bestMatch.source);
      } else {
        setMatchSource(null);
      }
    }
  }, [unit, eventTypes]);

  const handleSelectChange = (val) => {
    setFormData((prev) => ({ ...prev, nombre: val }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleManualRegistroChange = (field, value) => {
    setTransportData(prev => ({
      ...prev,
      registro: { ...prev.registro, [field]: value }
    }));
  };

  const handleGpsDataChange = (gpsIndex, field, value) => {
    setTransportData(prev => {
      const updatedGpsData = [...(prev.gpsData || [])];
      if (updatedGpsData[gpsIndex]) {
        updatedGpsData[gpsIndex] = {
          ...updatedGpsData[gpsIndex],
          data: { ...updatedGpsData[gpsIndex].data, [field]: value }
        };
      }
      return {
        ...prev,
        gpsData: updatedGpsData,
        registro: updatedGpsData[0]?.data || prev.registro
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre) {
      showToast("Seleccione un tipo de evento", "error");
      return;
    }

    setLoading(true);
    try {
      if (!bitacora || !transportData) throw new Error("Cargando datos de la bitácora...");

      const patchData = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        registrado_por: `${user.firstName} ${user.lastName}`,
        frecuencia: parseInt(formData.frecuencia) || 0,
        transportes: [transportData],
      };

      const res = await fetch(`${baseUrl}/bitacora/${unit.bitacora_raw_id}/event`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Error al guardar el evento");

      showToast("Evento registrado en bitácora", "success");
      
      // Reset form but keep unit info
      setFormData(prev => ({
        ...prev,
        nombre: "",
        frecuencia: 0
      }));

      if (onSuccess) onSuccess();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!unit?.bitacora_raw_id) {
    return (
      <div className="alert alert-warning">
        <i className="fa fa-exclamation-triangle me-2"></i>
        Esta unidad no tiene una bitácora activa vinculada.
      </div>
    );
  }

  const selectOptions = eventTypes.map(et => ({ value: et.evento, label: et.evento }));

  return (
    <div className="quick-patch-form animate__animated animate__fadeIn">
      {transportData && (
        <div className="mb-4 p-3 border rounded bg-light-subtle animate__animated animate__fadeIn">
          <div className="d-flex flex-column gap-2">
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              <span className="fw-bold" style={{ color: '#1e293b' }}>Bitácora No. :</span> {unit.bitacora_id || '—'}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              <span className="fw-bold" style={{ color: '#1e293b' }}>Transporte:</span> {getTransporteLabel(transportData)}
            </div>
            <div className="d-flex align-items-center gap-2" style={{ fontSize: '0.85rem', color: '#64748b' }}>
              <span className="fw-bold" style={{ color: '#1e293b' }}>Gps included:</span>
              <div className="d-flex flex-wrap gap-2">
                {transportData.gpsUnits && transportData.gpsUnits.length > 0 ? (
                  transportData.gpsUnits.map((gps, idx) => (
                    <span key={idx} className="badge bg-success-subtle text-success-emphasis" style={{ fontSize: '0.65rem', padding: '4px 8px' }}>
                      <i className="fa fa-satellite-dish me-1"></i> {gps.name}
                    </span>
                  ))
                ) : (
                  <span className="badge bg-warning-subtle text-warning-emphasis" style={{ fontSize: '0.65rem', padding: '4px 8px' }}>
                    Manual
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="row g-3">
          <div className="col-md-8">
            <Select
              label="TIPO DE EVENTO"
              options={selectOptions}
              value={formData.nombre}
              onChange={handleSelectChange}
              placeholder="Seleccionar..."
              clearable={false}
            />
            {matchSource && (
              <div className="mt-1 small text-info animate__animated animate__fadeIn">
                <i className="fa fa-magic me-1"></i> {matchSource}
              </div>
            )}
          </div>
          <div className="col-md-4">
            <TextInput
              label="FRECUENCIA (MIN)"
              type="number"
              name="frecuencia"
              value={formData.frecuencia}
              onChange={handleChange}
              min="0"
              placeholder="0"
            />
          </div>
        </div>

        <div className="mt-3 mb-4">
          <TextArea
            label="DESCRIPCIÓN / COMENTARIO"
            name="descripcion"
            rows={4}
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="Ingrese detalles del evento..."
            required
          />
        </div>

        {transportData && (
          <div className="unit-details-section mt-5 pt-4 border-top">
            <label className="pselect__label mb-3 fw-bold" style={{ fontSize: "0.85rem", letterSpacing: "0.5px" }}>
              DETALLE POR UNIDAD
            </label>
            <div className="modern-unit-card border rounded-3 overflow-hidden shadow-sm">
              <div className="modern-unit-card__header bg-light p-3 border-bottom d-flex justify-content-between align-items-center">
                <div className="fw-bold text-dark" style={{ fontSize: "0.95rem" }}>{getTransporteLabel(transportData)}</div>
                <span className={`badge ${!transportData.gpsUnits?.length ? "bg-warning-subtle text-warning-emphasis" : "bg-success-subtle text-success-emphasis"}`} style={{ fontSize: "0.7rem", padding: "4px 8px" }}>
                  {!transportData.gpsUnits?.length ? "Manual" : "GPS"}
                </span>
              </div>
              <div className="modern-unit-card__body p-4 bg-white">
                {transportData.gpsData && transportData.gpsData.length > 0 ? (
                  <div className="row g-4">
                    {transportData.gpsData.map((gps, idx) => (
                      <div key={idx} className="col-12 p-3 border rounded bg-light-subtle">
                        <div className="d-flex align-items-center mb-3 gap-2 fw-bold text-primary" style={{ fontSize: "0.85rem" }}>
                          <i className="fa fa-satellite-dish"></i>
                          {gps.name}
                        </div>
                        <div className="row g-3">
                          {["duracion", "ubicacion", "velocidad", "ultimo_posicionamiento", "coordenadas"].map(f => (
                            <div className="col-md-6" key={f}>
                              <label className="pselect__label mb-2 text-uppercase" style={{ fontSize: "0.7rem", color: "#6c757d" }}>{f.replace("_", " ")}</label>
                              <TextInput
                                className="ptext--sm"
                                value={gps.data?.[f] || ""}
                                onChange={(e) => handleGpsDataChange(idx, f, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="row g-3">
                    {["duracion", "ubicacion", "velocidad", "ultimo_posicionamiento", "coordenadas"].map(f => (
                      <div className="col-md-6" key={f}>
                        <label className="pselect__label mb-2 text-uppercase" style={{ fontSize: "0.7rem", color: "#6c757d" }}>{f.replace("_", " ")}</label>
                        <TextInput
                          className="ptext--sm"
                          value={transportData.registro?.[f] || ""}
                          onChange={(e) => handleManualRegistroChange(f, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
});

export default QuickPatchForm;
