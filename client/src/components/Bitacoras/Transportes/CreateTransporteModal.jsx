import React, {useState, useEffect} from "react";
import {Form} from "react-bootstrap";
import {useAuth} from "../../../context/AuthContext";
import ModalTemplate from "../../../components/ModalTemplate";

const STEPS = [
  {key: "gps",      label: "GPS",      icon: "fa-solid fa-satellite-dish"},
  {key: "tracto",   label: "Tracto",   icon: "fa-solid fa-truck"},
  {key: "remolque", label: "Remolque", icon: "fa-solid fa-trailer"},
  {key: "operador", label: "Operador", icon: "fa-solid fa-user-tie"},
];

const CreateTransporteModal = ({show, handleClose, addTransporte, transportes, bitacora, units, onDraftCreated}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState("forward");
  const [transporteData, setTransporteData] = useState({
    tracto:  {eco: "", placa: "", marca: "", modelo: "", color: "", tipo: ""},
    remolque:{eco: "", placa: "", color: "", capacidad: "", sello: ""},
    lineaTransporte: "",
    operador: "",
    telefono: "",
    gpsUnits: [],
  });
  const [idMethod, setIdMethod] = useState("automatic");
  const [selectedGpsUnits, setSelectedGpsUnits] = useState([]);
  const [gpsSearchTerm, setGpsSearchTerm] = useState("");
  const [operadores, setOperadores] = useState([]);
  const [lineasTransporte, setLineasTransporte] = useState([]);
  const [roleData, setRoleData] = useState(null);
  const [phoneError, setPhoneError] = useState("");
  const [draftLineaText, setDraftLineaText] = useState("");
  const [draftOperadorText, setDraftOperadorText] = useState("");
  const {user, verifyToken, setUser} = useAuth();
  const baseUrl = import.meta.env.VITE_BASE_URL;

  // Reset wizard step when modal opens
  useEffect(() => {
    if (show) setCurrentStep(0);
  }, [show]);

  useEffect(() => {
    const init = async () => {
      try {
        const data = await verifyToken();
        setUser(data);
      } catch (e) {
        console.error("Error verifying token:", e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const fetchRolePermissions = async () => {
      try {
        const response = await fetch(`${baseUrl}/roles/${user.role}`, {method: "GET", credentials: "include"});
        const data = await response.json();
        setRoleData(data);
      } catch (e) {
        console.error("Error fetching role permissions:", e);
      }
    };
    fetchRolePermissions();
  }, [user]);

  useEffect(() => {
    if (bitacora?.cliente) fetchLineasTransporte(bitacora.cliente);
  }, [bitacora]);

  const fetchLineasTransporte = async (cliente) => {
    try {
      let url = `${baseUrl}/lineas-transporte`;
      if (cliente && cliente !== "all") url += `?cliente=${encodeURIComponent(cliente)}`;
      const response = await fetch(url, {method: "GET", credentials: "include"});
      if (response.ok) setLineasTransporte(await response.json());
    } catch (e) {
      console.error("Error fetching lineas transporte:", e);
    }
  };

  const fetchOperadores = async (lineaTransporte = null) => {
    try {
      let url = `${baseUrl}/operadores`;
      if (lineaTransporte && lineaTransporte !== "all")
        url += `?lineaTransporte=${encodeURIComponent(lineaTransporte)}`;
      const response = await fetch(url, {method: "GET", credentials: "include"});
      if (response.ok) setOperadores(await response.json());
      else setOperadores([]);
    } catch (e) {
      setOperadores([]);
    }
  };

  const validatePhoneNumber = (phone) => /^\d{10}$/.test(phone);

  const handleGpsUnitToggle = (unit) => {
    setSelectedGpsUnits((prev) =>
      prev.some((u) => u.id === unit.id)
        ? prev.filter((u) => u.id !== unit.id)
        : [...prev, unit]
    );
  };

  const generateTransporteId = () => {
    const numericId = (transportes.length + 1).toString().padStart(3, "0");
    return `T${numericId}_${transporteData.tracto.placa || "N/A"}`;
  };

  const filteredGpsUnits = units.filter(
    (unit) =>
      unit.name.toLowerCase().includes(gpsSearchTerm.toLowerCase()) ||
      unit.id.toString().includes(gpsSearchTerm)
  );

  const handleSelectAllFiltered = () => {
    const allSelected = filteredGpsUnits.every((unit) =>
      selectedGpsUnits.some((s) => s.id === unit.id)
    );
    if (allSelected) {
      setSelectedGpsUnits((prev) =>
        prev.filter((s) => !filteredGpsUnits.some((f) => f.id === s.id))
      );
    } else {
      const newSelections = filteredGpsUnits.filter(
        (unit) => !selectedGpsUnits.some((s) => s.id === unit.id)
      );
      setSelectedGpsUnits((prev) => [...prev, ...newSelections]);
    }
  };

  const handleChange = (e) => {
    const {name, value} = e.target;
    const [section, field] = name.split(".");
    if (name === "telefono") {
      setPhoneError(value && !validatePhoneNumber(value)
        ? "El número debe tener exactamente 10 dígitos"
        : "");
    }
    if (section && field) {
      setTransporteData((prev) => ({...prev, [section]: {...prev[section], [field]: value}}));
    } else {
      setTransporteData((prev) => ({...prev, [name]: value}));
    }
  };

  const doSave = async () => {
    if (transporteData.telefono && !validatePhoneNumber(transporteData.telefono)) {
      setPhoneError("El número debe tener exactamente 10 dígitos");
      return;
    }

    let newId;
    if (idMethod === "wialon") {
      if (selectedGpsUnits.length === 0) { alert("Seleccione al menos una unidad GPS."); return; }
      newId = generateTransporteId();
    } else {
      newId = generateTransporteId();
    }

    if (transportes.some((t) => t.id === newId)) {
      alert("El transporte ya existe. Por favor, seleccione otro.");
      return;
    }

    const newTransporte = {
      id: newId,
      ...transporteData,
      gpsUnits: selectedGpsUnits.map((unit) => ({wialonId: String(unit.id), name: unit.name, data: {}})),
    };

    if (roleData?.crear_draft_transporte) {
      const lineaEnCatalog = lineasTransporte.some(
        (l) => l.nombre.toUpperCase() === transporteData.lineaTransporte?.toUpperCase()
      );
      const operadorEnCatalog = operadores.some(
        (o) => o.nombre.toUpperCase() === transporteData.operador?.toUpperCase()
      );
      const lineaEsDraft = !!transporteData.lineaTransporte && !lineaEnCatalog;
      const operadorEsDraft = !!transporteData.operador && !operadorEnCatalog;
      if (lineaEsDraft || operadorEsDraft) {
        try {
          await fetch(`${baseUrl}/drafts`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            credentials: "include",
            body: JSON.stringify({
              bitacora_id: bitacora._id,
              bitacora_num_id: bitacora.bitacora_id,
              transporte_id: newId,
              cliente: bitacora.cliente,
              lineaTransporte: transporteData.lineaTransporte,
              lineaTransporte_es_draft: lineaEsDraft,
              operador: transporteData.operador,
              operador_es_draft: operadorEsDraft,
              creado_por: `${user.firstName} ${user.lastName}`,
            }),
          });
          if (onDraftCreated) onDraftCreated();
        } catch (err) {
          console.error("Error creating draft:", err);
        }
      }
    }

    addTransporte(newTransporte, bitacora._id);
    setTransporteData({
      tracto:  {eco: "", placa: "", marca: "", modelo: "", color: "", tipo: ""},
      remolque:{eco: "", placa: "", color: "", capacidad: "", sello: ""},
      lineaTransporte: "", operador: "", telefono: "", gpsUnits: [],
    });
    setSelectedGpsUnits([]);
    setGpsSearchTerm("");
    setDraftLineaText("");
    setDraftOperadorText("");
    handleClose();
  };

  const handleSubmitTransporte = (e) => { e.preventDefault(); };

  // ── Step content renderers ─────────────────────────────────────

  const renderStepGps = () => (
    <div className="wizard-step-content">
      <Form.Group className="mb-3">
        <Form.Label className="fw-semibold">Método de identificación</Form.Label>
        <div className="wizard-radio-group">
          {[
            {value: "automatic", label: "Automático",         icon: "fa-solid fa-magic-wand-sparkles"},
            {value: "wialon",    label: "GPS ID",             icon: "fa-solid fa-satellite-dish"},
          ].map(({value, label, icon}) => (
            <label key={value} className={`wizard-radio-card ${idMethod === value ? "selected" : ""}`}>
              <input type="radio" name="idMethod" value={value} checked={idMethod === value}
                onChange={() => setIdMethod(value)} className="visually-hidden" />
              <i className={icon}></i>
              <span>{label}</span>
            </label>
          ))}
        </div>
      </Form.Group>

      {idMethod === "wialon" && (
        <Form.Group className="mb-3">
          <Form.Label className="fw-semibold">Unidades GPS</Form.Label>
          <div className="input-group mb-2">
            <span className="input-group-text"><i className="fa fa-search"></i></span>
            <input type="text" className="form-control" placeholder="Buscar por nombre o ID…"
              value={gpsSearchTerm} onChange={(e) => setGpsSearchTerm(e.target.value)} />
            {gpsSearchTerm && (
              <button className="btn btn-outline-secondary" type="button" onClick={() => setGpsSearchTerm("")}>
                <i className="fa fa-times"></i>
              </button>
            )}
          </div>

          {filteredGpsUnits.length > 0 && (
            <div className="mb-2 d-flex justify-content-between align-items-center">
              <small className="text-muted">{filteredGpsUnits.length} unidades</small>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={handleSelectAllFiltered}>
                {filteredGpsUnits.every((u) => selectedGpsUnits.some((s) => s.id === u.id))
                  ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
            </div>
          )}

          <div className="gps-units-selection">
            {units.length === 0 ? (
              <div className="p-3 text-muted text-center">
                <i className="fa fa-spinner fa-spin me-2"></i>Cargando unidades…
              </div>
            ) : filteredGpsUnits.length === 0 ? (
              <div className="p-3 text-muted text-center">
                <i className="fa fa-search me-2"></i>Sin resultados para "{gpsSearchTerm}"
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {filteredGpsUnits.map((unit) => {
                  const isSelected = selectedGpsUnits.some((u) => u.id === unit.id);
                  return (
                    <div key={unit.id}
                      className={`list-group-item list-group-item-action d-flex align-items-center ${isSelected ? "active" : ""}`}
                      style={{cursor: "pointer", border: "none"}}
                      onClick={() => handleGpsUnitToggle(unit)}>
                      <input className="form-check-input me-3" type="checkbox" checked={isSelected}
                        onChange={() => handleGpsUnitToggle(unit)} onClick={(e) => e.stopPropagation()} />
                      <div className="flex-grow-1">
                        <div className="fw-semibold">{unit.name}</div>
                        <small className="text-muted">ID: {unit.id}</small>
                      </div>
                      {isSelected && <i className="fa fa-check-circle text-success"></i>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedGpsUnits.length > 0 && (
            <div className="mt-2 p-2 bg-light rounded">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <small className="text-muted"><strong>{selectedGpsUnits.length}</strong> seleccionados</small>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setSelectedGpsUnits([])}>
                  Limpiar
                </button>
              </div>
              <div className="d-flex flex-wrap gap-1">
                {selectedGpsUnits.map((unit) => (
                  <span key={unit.id} className="badge bg-primary" style={{fontSize: "0.75rem"}}>
                    {unit.name}
                    <button type="button" className="btn-close btn-close-white ms-1" style={{fontSize: "0.5rem"}}
                      onClick={(e) => {e.stopPropagation(); handleGpsUnitToggle(unit);}} />
                  </span>
                ))}
              </div>
            </div>
          )}
        </Form.Group>
      )}

      {idMethod === "automatic" && (
        <Form.Group className="mb-3">
          <Form.Label className="fw-semibold">ID generado</Form.Label>
          <Form.Control type="text" value={generateTransporteId()} disabled />
          <Form.Text className="text-muted">
            Formato: T{String(transportes.length + 1).padStart(3, "0")}_{transporteData.tracto.placa || "N/A"}
          </Form.Text>
        </Form.Group>
      )}
    </div>
  );

  const renderStepTracto = () => (
    <div className="wizard-step-content">
      <div className="wizard-grid-2">
        {["eco", "placa", "marca", "modelo", "color", "tipo"].map((field) => (
          <Form.Group key={field} className="mb-3">
            <Form.Label className="fw-semibold">{field.toUpperCase()} <span className="text-danger">*</span></Form.Label>
            <Form.Control type="text" name={`tracto.${field}`}
              value={transporteData.tracto[field]} onChange={handleChange}
              required={!!roleData?.tracto?.create} />
          </Form.Group>
        ))}
      </div>
    </div>
  );

  const renderStepRemolque = () => (
    <div className="wizard-step-content">
      <div className="wizard-grid-2">
        {["eco", "placa", "color", "capacidad", "sello"].map((field) => (
          <Form.Group key={field} className="mb-3">
            <Form.Label className="fw-semibold">{field.toUpperCase()} <span className="text-danger">*</span></Form.Label>
            <Form.Control type="text" name={`remolque.${field}`}
              value={transporteData.remolque[field]} onChange={handleChange}
              required={!!roleData?.remolque?.create} />
          </Form.Group>
        ))}
      </div>
    </div>
  );

  const renderStepOperador = () => (
    <div className="wizard-step-content">
      <Form.Group className="mb-3">
        <Form.Label className="fw-semibold">Línea de Transporte <span className="text-danger">*</span></Form.Label>
        <Form.Select name="lineaTransporte"
          value={draftLineaText ? "" : transporteData.lineaTransporte}
          onChange={async (e) => {
            const val = e.target.value;
            setDraftLineaText("");
            setDraftOperadorText("");
            setTransporteData((prev) => ({...prev, lineaTransporte: val, operador: ""}));
            setOperadores([]);
            if (val && val !== "all") fetchOperadores(val);
          }}
          required={!!roleData?.operador?.create && !draftLineaText}>
          <option value="">Selecciona una línea de transporte</option>
          {lineasTransporte.map((linea) => (
            <option key={linea._id} value={linea.nombre}>{linea.nombre}</option>
          ))}
        </Form.Select>
        {roleData?.crear_draft_transporte && (
          <Form.Control type="text" className="mt-2" value={draftLineaText}
            placeholder="O escribe una línea nueva…"
            onChange={async (e) => {
              const val = e.target.value;
              setDraftLineaText(val);
              setDraftOperadorText("");
              setTransporteData((prev) => ({...prev, lineaTransporte: val, operador: ""}));
              setOperadores([]);
              if (val) fetchOperadores(val);
            }} />
        )}
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="fw-semibold">Operador <span className="text-danger">*</span></Form.Label>
        <Form.Select name="operador"
          value={draftOperadorText ? "" : transporteData.operador}
          onChange={(e) => {
            setDraftOperadorText("");
            setTransporteData((prev) => ({...prev, operador: e.target.value}));
          }}
          required={!!roleData?.operador?.create && !draftOperadorText}
          disabled={!transporteData.lineaTransporte}>
          <option value="">
            {transporteData.lineaTransporte ? "Selecciona un operador" : "Selecciona una línea primero"}
          </option>
          {operadores.map((op) => (
            <option key={op._id} value={op.nombre}>{op.nombre}</option>
          ))}
        </Form.Select>
        {roleData?.crear_draft_transporte && (
          <Form.Control type="text" className="mt-2" value={draftOperadorText}
            placeholder="O escribe un operador nuevo…"
            onChange={(e) => {
              const val = e.target.value;
              setDraftOperadorText(val);
              setTransporteData((prev) => ({...prev, operador: val}));
            }} />
        )}
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label className="fw-semibold">Teléfono <span className="text-danger">*</span></Form.Label>
        <Form.Control type="text" name="telefono" value={transporteData.telefono}
          onChange={handleChange} required={!!roleData?.operador?.create} isInvalid={!!phoneError}
          placeholder="1234567890" />
        {phoneError
          ? <Form.Control.Feedback type="invalid">{phoneError}</Form.Control.Feedback>
          : <Form.Text className="text-muted">Exactamente 10 dígitos sin espacios</Form.Text>
        }
      </Form.Group>
    </div>
  );

  const stepContent = [renderStepGps, renderStepTracto, renderStepRemolque, renderStepOperador];
  const isLastStep = currentStep === STEPS.length - 1;

  const goNext = () => { setSlideDirection("forward");  setCurrentStep((s) => s + 1); };
  const goPrev = () => { setSlideDirection("backward"); setCurrentStep((s) => s - 1); };

  return (
    <ModalTemplate
      wide
      show={show}
      title="Crear Nuevo Transporte"
      onClose={handleClose}
      onSubmit={handleSubmitTransporte}
      hideFooter>

      {/* Step indicator */}
      <div className="wizard-steps">
        {STEPS.map((step, i) => (
          <React.Fragment key={step.key}>
            <div className={`wizard-step ${i === currentStep ? "active" : ""} ${i < currentStep ? "completed" : ""}`}>
              <div className="wizard-step-circle">
                {i < currentStep
                  ? <i className="fa-solid fa-check"></i>
                  : <span>{i + 1}</span>}
              </div>
              <span className="wizard-step-label">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`wizard-step-connector ${i < currentStep ? "completed" : ""}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Compact numeric indicator — visible only on mobile via CSS */}
      <div className="wizard-numeric-indicator">
        Paso {currentStep + 1} de {STEPS.length} — {STEPS[currentStep].label}
      </div>

      {/* Current step content — keyed so animation replays on each step change */}
      <div key={`step-${currentStep}-${slideDirection}`}
           className={`wizard-step-content slide-${slideDirection}`}>
        {stepContent[currentStep]()}
      </div>

      {/* Sticky navigation footer */}
      <div className="wizard-footer">
        <button type="button" className="btn btn-outline-secondary"
          onClick={currentStep === 0 ? handleClose : goPrev}>
          {currentStep === 0
            ? <><i className="fa-solid fa-xmark me-1"></i>Cancelar</>
            : <><i className="fa-solid fa-arrow-left me-1"></i>Anterior</>}
        </button>
        {isLastStep ? (
          <button type="button" className="btn btn-success" onClick={doSave}>
            <i className="fa-solid fa-check me-1"></i>Guardar
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={goNext}>
            Siguiente<i className="fa-solid fa-arrow-right ms-1"></i>
          </button>
        )}
      </div>
    </ModalTemplate>
  );
};

export default CreateTransporteModal;
