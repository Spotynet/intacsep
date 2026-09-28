import React, {useState, useEffect, useMemo, useRef} from "react";
import {useAuth} from "../../../context/AuthContext";
import ModalTemplate from "../../../components/ModalTemplate";
import TextInput from "../../../components/TextInput";
import {Select} from "../../../components/Select";
import Toast from "../../../components/Toast";
import {useToast} from "../../../hooks/useToast";
import {TRIGGER_LABELS, TRIGGER_COLORS, TRIGGER_ICONS} from "../../../utils/wialonNotifications";

const STEPS = [
  {key: "gps", label: "GPS", icon: "fa-solid fa-satellite-dish"},
  {key: "tracto", label: "Tracto", icon: "fa-solid fa-truck"},
  {key: "remolque", label: "Remolque", icon: "fa-solid fa-trailer"},
  {key: "operador", label: "Operador", icon: "fa-solid fa-user-tie"},
];

const FIELD_LABELS_TRACTO = {
  eco: "Eco",
  placa: "Placa",
  marca: "Marca",
  modelo: "Modelo",
  color: "Color",
  tipo: "Tipo",
};

const FIELD_LABELS_REMOLQUE = {
  eco: "Eco",
  placa: "Placa",
  color: "Color",
  capacidad: "Capacidad",
  sello: "Sello",
};

const notifKey = (n) => `${n.resourceId}_${n.notifId}`;

// Free-text hint used server side to rank canonical notification candidates.
const buildCatalogHint = (bitacora, transporteData) =>
  transporteData?.tracto?.eco || transporteData?.lineaTransporte || bitacora?.cliente || "";

const CreateTransporteModal = ({show, handleClose, addTransporte, transportes, bitacora, units, onDraftCreated}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState("forward");
  const [transporteData, setTransporteData] = useState({
    tracto: {eco: "", placa: "", marca: "", modelo: "", color: "", tipo: ""},
    remolque: {eco: "", placa: "", color: "", capacidad: "", sello: ""},
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
  const [notifCatalog, setNotifCatalog] = useState(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState("");
  const [notifQuery, setNotifQuery] = useState("");
  const [notifRetry, setNotifRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selectedLinked, setSelectedLinked] = useState({});
  const [selectedCanonical, setSelectedCanonical] = useState({});
  // Canonical types the user has switched off. A missing key means ON, so every
  // type starts enabled without depending on the async catalog. Turning one off
  // drops its pick: the row is inert until it is switched back on.
  const [disabledCanonical, setDisabledCanonical] = useState({});
  const {user, verifyToken, setUser} = useAuth();
  const {toasts, showToast, removeToast} = useToast();
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const hintRef = useRef("");
  const prevUnitIdsRef = useRef(null);
  // Every candidate ever offered in this modal, keyed by notifKey. The catalog
  // comes back without candidates while the search box is empty, but a choice
  // already made must keep rendering and reach the save payload.
  const candidatesSeenRef = useRef({});

  useEffect(() => {
    if (show) {
      setCurrentStep(0);
      setNotifCatalog(null);
      setNotifError("");
      setNotifLoading(false);
      setNotifQuery("");
      setNotifRetry(0);
      setSelectedLinked({});
      setSelectedCanonical({});
      setDisabledCanonical({});
      prevUnitIdsRef.current = null;
    }
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
      if (lineaTransporte && lineaTransporte !== "all") url += `?lineaTransporte=${encodeURIComponent(lineaTransporte)}`;
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
      prev.some((u) => u.id === unit.id) ? prev.filter((u) => u.id !== unit.id) : [...prev, unit]
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
    const allSelected = filteredGpsUnits.every((unit) => selectedGpsUnits.some((s) => s.id === unit.id));
    if (allSelected) {
      setSelectedGpsUnits((prev) => prev.filter((s) => !filteredGpsUnits.some((f) => f.id === s.id)));
    } else {
      const newSelections = filteredGpsUnits.filter((unit) => !selectedGpsUnits.some((s) => s.id === unit.id));
      setSelectedGpsUnits((prev) => [...prev, ...newSelections]);
    }
  };

  const selectedUnitIds = useMemo(
    () => selectedGpsUnits.map((u) => String(u.id)).sort(),
    [selectedGpsUnits]
  );
  const unitIdsKey = selectedUnitIds.join(",");

  const catalogHint = buildCatalogHint(bitacora, transporteData);

  useEffect(() => {
    hintRef.current = catalogHint;
  }, [catalogHint]);

  // Load the Wialon notification catalog for the selected GPS units
  useEffect(() => {
    if (!show || idMethod !== "wialon" || !unitIdsKey) {
      setNotifLoading(false);
      return undefined;
    }

    // The GPS selection drives which notifications are valid, so drop the stale
    // catalog as soon as it changes. A narrower search (q) keeps it on screen.
    const unitsChanged = prevUnitIdsRef.current !== unitIdsKey;
    if (unitsChanged) setNotifCatalog(null);
    setNotifLoading(true);

    let cancelled = false;
    const timer = setTimeout(async () => {
      setNotifError("");
      try {
        const hint = hintRef.current || "";
        // La búsqueda arranca con 2 caracteres: por debajo el servidor responde
        // en modo "lite" (solo grupos y contadores), sin el listado de opciones.
        const query = notifQuery.trim().length >= 2 ? notifQuery.trim() : "";
        const url =
          `${baseUrl}/wialon/notifications/catalog` +
          `?unitIds=${encodeURIComponent(unitIdsKey)}` +
          `&hint=${encodeURIComponent(hint)}` +
          `&q=${encodeURIComponent(query)}`;
        const response = await fetch(url, {method: "GET", credentials: "include"});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;

        (data.canonical || []).forEach((t) => {
          (t.candidates || []).forEach((c) => {
            candidatesSeenRef.current[notifKey(c)] = { ...c, triggerType: t.triggerType };
          });
        });

        prevUnitIdsRef.current = unitIdsKey;
        setNotifCatalog(data);

        // Selections are re-validated only when the GPS selection changes:
        // narrowing the search must never silently drop what the user picked.
        if (unitsChanged) {
          const validLinked = new Set((data.linked || []).map(notifKey));
          setSelectedLinked((prev) => {
            const next = {};
            Object.keys(prev).forEach((k) => {
              if (validLinked.has(k)) next[k] = true;
            });
            return next;
          });
          // A lite response carries no candidates, so re-validating against it
          // would drop every choice the user already made. Only a real search
          // answer may prune the canonical selections.
          if (!data.lite) {
            setSelectedCanonical((prev) => {
              const next = {};
              Object.entries(prev).forEach(([key, value]) => {
                if (!value) return;
                const type = (data.canonical || []).find((c) => c.key === key);
                if (type && type.candidates.some((c) => notifKey(c) === value)) next[key] = value;
              });
              return next;
            });
          }
        }
      } catch (e) {
        if (!cancelled) {
          setNotifCatalog(null);
          setNotifError("No fue posible cargar las notificaciones de Wialon.");
        }
      } finally {
        if (!cancelled) setNotifLoading(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [show, idMethod, unitIdsKey, notifQuery, notifRetry, baseUrl]);

  const missingUnits = useMemo(
    () => (notifCatalog?.units || []).filter((u) => !u.exists),
    [notifCatalog]
  );

  const toggleCanonical = (key) => {
    const willBeOff = !disabledCanonical[key];
    setDisabledCanonical((prev) => ({...prev, [key]: willBeOff}));
    if (willBeOff) {
      setSelectedCanonical((prev) => (prev[key] ? {...prev, [key]: ""} : prev));
    }
  };

  const selectedNotificaciones = useMemo(() => {
    const out = [];
    if (!notifCatalog) return out;
    (notifCatalog.linked || []).forEach((n) => {
      if (selectedLinked[notifKey(n)]) {
        out.push({
          resourceId: n.resourceId,
          notifId: n.notifId,
          name: n.name,
          triggerType: n.triggerType,
          kind: "vinculada",
        });
      }
    });
    (notifCatalog.canonical || []).forEach((t) => {
      // Switched off: never linked nor enabled in Wialon, regardless of a pick.
      if (disabledCanonical[t.key]) return;
      const value = selectedCanonical[t.key];
      if (!value) return;
      const candidate =
        t.candidates.find((c) => notifKey(c) === value) || candidatesSeenRef.current[value];
      if (candidate) {
        out.push({
          resourceId: candidate.resourceId,
          notifId: candidate.notifId,
          name: candidate.name,
          triggerType: candidate.triggerType || t.triggerType,
          kind: "canonica",
        });
      }
    });
    return out;
  }, [notifCatalog, selectedLinked, selectedCanonical, disabledCanonical]);

  const handleChange = (e) => {
    const {name, value} = e.target;
    const [section, field] = name.split(".");
    if (name === "telefono") {
      setPhoneError(value && !validatePhoneNumber(value) ? "El número debe tener exactamente 10 dígitos" : "");
    }
    if (section && field) {
      setTransporteData((prev) => ({...prev, [section]: {...prev[section], [field]: value}}));
    } else {
      setTransporteData((prev) => ({...prev, [name]: value}));
    }
  };

  const doSave = async () => {
    if (saving) return;
    if (transporteData.telefono && !validatePhoneNumber(transporteData.telefono)) {
      setPhoneError("El número debe tener exactamente 10 dígitos");
      return;
    }

    let newId;
    if (idMethod === "wialon") {
      if (selectedGpsUnits.length === 0) {
        alert("Seleccione al menos una unidad GPS.");
        return;
      }
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
      notificaciones: idMethod === "wialon" && selectedGpsUnits.length > 0 ? selectedNotificaciones : [],
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

    setSaving(true);
    const result = await addTransporte(newTransporte, bitacora._id);
    setSaving(false);
    if (result === null) {
      showToast("No se pudo guardar el transporte. Intenta nuevamente.", "error", 8000);
      return;
    }
    reportWialonSync(result?.wialonSync);

    setTransporteData({
      tracto: {eco: "", placa: "", marca: "", modelo: "", color: "", tipo: ""},
      remolque: {eco: "", placa: "", color: "", capacidad: "", sello: ""},
      lineaTransporte: "",
      operador: "",
      telefono: "",
      gpsUnits: [],
    });
    setSelectedGpsUnits([]);
    setGpsSearchTerm("");
    setDraftLineaText("");
    setDraftOperadorText("");
    setSelectedLinked({});
    setSelectedCanonical({});
    setDisabledCanonical({});
    handleClose();
  };

  const reportWialonSync = (sync) => {
    if (!sync) return;
    const {applied = [], failed = [], skippedUnits = []} = sync;

    if (failed.length > 0) {
      const reasons = [...new Set(failed.map((f) => f.error).filter(Boolean))];
      const detail = reasons.slice(0, 2).join("  ·  ") || "error desconocido";
      const more = reasons.length > 2 ? ` (+${reasons.length - 2} motivo(s) más)` : "";
      const ok = applied.length > 0 ? ` Sí se activaron ${applied.length}.` : "";
      showToast(`${failed.length} alerta(s) NO activadas: ${detail}${more}.${ok}`, "error", 15000);
    }
    if (applied.length > 0) {
      showToast(`${applied.length} notificación(es) activada(s) en Wialon.`, "success");
    }
    if (skippedUnits.length > 0) {
      showToast(
        `GPS no encontrado en Wialon: ${skippedUnits.join(", ")}. No se activaron alertas.`,
        "warning",
        8000
      );
    }
  };

  const handleSubmitTransporte = (e) => {
    e.preventDefault();
  };

  const renderNotifSection = () => {
    if (idMethod !== "wialon" || selectedGpsUnits.length === 0) return null;

    return (
      <div className="notif-picker">
        <div className="notif-picker__header">
          <i className="fa-solid fa-bell"></i>
          <div>
            <div className="notif-picker__title">Notificaciones a activar</div>
            <div className="notif-picker__subtitle">
              Alertas de Wialon que se vincularán y activarán para este transporte.
            </div>
          </div>
          {notifLoading && <i className="fa fa-spinner fa-spin ms-auto"></i>}
        </div>

        {notifError && (
          <div className="notif-picker__error">
            <i className="fa fa-triangle-exclamation"></i>
            <span>{notifError}</span>
            <button
              type="button"
              className="notif-retry"
              onClick={() => setNotifRetry((n) => n + 1)}
            >
              <i className="fa fa-rotate-right"></i> Reintentar
            </button>
          </div>
        )}

        {missingUnits.length > 0 && (
          <div className="notif-picker__warning">
            <i className="fa fa-triangle-exclamation"></i>
            <span>
              {missingUnits.map((u) => u.name || u.id).join(", ")}{" "}
              {missingUnits.length === 1 ? "no existe" : "no existen"} en Wialon: no{" "}
              {missingUnits.length === 1 ? "se le podrá" : "les podrán"} activar notificaciones.
            </span>
          </div>
        )}

        {notifLoading && !notifCatalog && !notifError && (
          <div className="notif-empty">
            <i className="fa fa-spinner fa-spin me-2"></i>Cargando notificaciones de Wialon…
          </div>
        )}

        {notifCatalog && !notifError && (
          <>
            <div className="notif-group">
              <div className="notif-group__title">
                Vinculadas a este GPS
                <span className="notif-group__count">{(notifCatalog.linked || []).length}</span>
              </div>
              {(notifCatalog.linked || []).length === 0 ? (
                <div className="notif-empty">Este GPS no tiene notificaciones vinculadas todavía.</div>
              ) : (
                <div className="notif-list">
                  {notifCatalog.linked.map((n) => {
                    const key = notifKey(n);
                    const checked = !!selectedLinked[key];
                    return (
                      <label key={key} className={`notif-item ${checked ? "selected" : ""}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedLinked((prev) => ({...prev, [key]: !prev[key]}))}
                        />
                        <span
                          className="notif-item__icon"
                          style={{background: TRIGGER_COLORS[n.triggerType] || "#94a3b8"}}
                        >
                          <i className={`fa-solid ${TRIGGER_ICONS[n.triggerType] || "fa-bell"}`}></i>
                        </span>
                        <span className="notif-item__body">
                          <span className="notif-item__name">{n.name}</span>
                          <span className="notif-item__meta">
                            {TRIGGER_LABELS[n.triggerType] || n.triggerType} ·{" "}
                            {n.enabled ? "activa" : "inactiva"} · {n.unitCount} unidad
                            {n.unitCount === 1 ? "" : "es"}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="notif-group">
              <div className="notif-group__title">
                Catálogo de alertas
                <div className="notif-group__search">
                  <i className="fa fa-magnifying-glass"></i>
                  <input
                    type="text"
                    value={notifQuery}
                    onChange={(e) => setNotifQuery(e.target.value)}
                    placeholder="Buscar por nombre (escribe 2+ letras)…"
                    aria-label="Buscar alerta"
                  />
                  {notifQuery && (
                    <button
                      type="button"
                      onClick={() => setNotifQuery("")}
                      aria-label="Limpiar búsqueda"
                    >
                      <i className="fa fa-xmark"></i>
                    </button>
                  )}
                </div>
              </div>
              <div className="notif-canonical">
                {(notifCatalog.canonical || []).map((t) => {
                  const isOff = !!disabledCanonical[t.key];
                  const value = selectedCanonical[t.key] || "";
                  const options = t.candidates.map((c) => ({
                    value: notifKey(c),
                    label: `${c.name}${c.unitCount > 0 ? ` · ${c.unitCount} u.` : ""}`,
                  }));
                  // While the search box is empty the catalog comes back without
                  // candidates: keep the option already picked on screen.
                  if (value && !options.some((o) => o.value === value)) {
                    const seen = candidatesSeenRef.current[value];
                    if (seen) options.push({ value, label: seen.name });
                  }
                  const emptyText =
                    t.total === 0
                      ? "Sin candidatas disponibles"
                      : notifQuery.trim().length < 2
                        ? "Escribe 2+ letras para buscar"
                        : "Sin resultados";
                  return (
                    <div key={t.key} className={`notif-canonical__row${isOff ? " is-off" : ""}`}>
                      <span className="notif-canonical__label">
                        <i className={`fa-solid ${TRIGGER_ICONS[t.triggerType] || "fa-bell"}`}></i>
                        {t.label}
                      </span>
                      <Select
                        options={options}
                        value={value}
                        onChange={(val) =>
                          setSelectedCanonical((prev) => ({...prev, [t.key]: val || ""}))
                        }
                        placeholder={
                          t.candidates.length > 0
                            ? `Elegir (${t.candidates.length}${
                                t.total > t.candidates.length ? ` de ${t.total}` : ""
                              })`
                            : t.total === 0
                              ? "Sin candidatas disponibles"
                              : notifQuery.trim().length >= 2
                                ? "Sin coincidencias"
                                : "Escribe 2+ letras para buscar"
                        }
                        // Typing here searches the same catalog as the section bar,
                        // so every dropdown filters to the text you typed.
                        onSearch={setNotifQuery}
                        loading={notifLoading}
                        emptyText={emptyText}
                        disabled={t.total === 0 || isOff}
                        searchable
                        clearable
                        className="notif-canonical__select"
                      />
                      <button
                        type="button"
                        className={`notif-power${isOff ? " is-off" : ""}`}
                        onClick={() => toggleCanonical(t.key)}
                        aria-pressed={!isOff}
                        aria-label={`${isOff ? "Activar" : "Desactivar"} ${t.label}`}
                        title={`${isOff ? "Activar" : "Desactivar"} ${t.label}`}
                      >
                        <i className="fa-solid fa-power-off"></i>
                        <span>{isOff ? "Off" : "On"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="notif-hint">
                <i className="fa fa-circle-info"></i>
                <span>
                  Al guardar se vinculan al GPS y se activan. Si Wialon rechaza alguna porque el
                  GPS no tiene acceso a ese recurso, se avisará con el motivo. Las unidades que ya
                  no pertenezcan a ninguna bitácora abierta se desvinculan automáticamente.
                </span>
              </div>
            </div>
          </>
        )}

        {selectedNotificaciones.length > 0 && (
          <div className="notif-pill">
            <i className="fa fa-bell"></i>
            {selectedNotificaciones.length} notificación
            {selectedNotificaciones.length === 1 ? "" : "es"} por activar
          </div>
        )}
      </div>
    );
  };

  const renderStepGps = () => (
    <div className="wizard-step-content">
      <div className="mb-3">
        <span className="ptext__label">Método de identificación</span>
        <div className="wizard-radio-group">
          {[
            {value: "automatic", label: "Automático", icon: "fa-solid fa-magic-wand-sparkles"},
            {value: "wialon", label: "GPS ID", icon: "fa-solid fa-satellite-dish"},
          ].map(({value, label, icon}) => (
            <label key={value} className={`wizard-radio-card ${idMethod === value ? "selected" : ""}`}>
              <input
                type="radio"
                name="idMethod"
                value={value}
                checked={idMethod === value}
                onChange={() => setIdMethod(value)}
                className="visually-hidden"
              />
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
            <input
              className="up-search-input"
              placeholder="Buscar por nombre o ID…"
              value={gpsSearchTerm}
              onChange={(e) => setGpsSearchTerm(e.target.value)}
            />
            {gpsSearchTerm && (
              <button type="button" className="up-search-clear" onClick={() => setGpsSearchTerm("")}>
                <i className="fa fa-times"></i>
              </button>
            )}
            <span className="up-count">{filteredGpsUnits.length} unidades</span>
            {filteredGpsUnits.length > 0 && (
              <button type="button" className="up-select-all" onClick={handleSelectAllFiltered}>
                {filteredGpsUnits.every((u) => selectedGpsUnits.some((s) => s.id === u.id))
                  ? "Deseleccionar"
                  : "Seleccionar todos"}
              </button>
            )}
          </div>

          <div className="up-list">
            {units.length === 0 ? (
              <div className="up-empty">
                <i className="fa fa-spinner fa-spin"></i>
                Cargando unidades…
              </div>
            ) : filteredGpsUnits.length === 0 ? (
              <div className="up-empty">
                <i className="fa fa-search"></i>
                Sin resultados para &quot;{gpsSearchTerm}&quot;
              </div>
            ) : (
              filteredGpsUnits.map((unit) => {
                const isSelected = selectedGpsUnits.some((u) => u.id === unit.id);
                return (
                  <div
                    key={unit.id}
                    className={`up-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleGpsUnitToggle(unit)}
                  >
                    <div className="up-item-icon">
                      <i className="fa-solid fa-satellite-dish"></i>
                    </div>
                    <div className="up-item-info">
                      <div className="up-item-name">{unit.name}</div>
                      <div className="up-item-id">ID: {unit.id}</div>
                    </div>
                    <div className="up-item-check">
                      <i className="fa fa-check"></i>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {selectedGpsUnits.length > 0 && (
            <div className="up-floating-pill">
              <span>{selectedGpsUnits.length} unidades seleccionadas</span>
              <button type="button" className="up-pill-clear" onClick={() => setSelectedGpsUnits([])}>
                Limpiar
              </button>
            </div>
          )}
        </div>
      )}

      {idMethod === "automatic" && (
        <div className="mt-3">
          <TextInput label="ID generado" value={generateTransporteId()} disabled />
          <small className="text-muted d-block mt-1">
            Formato: T{String(transportes.length + 1).padStart(3, "0")}_{transporteData.tracto.placa || "N/A"}
          </small>
        </div>
      )}

      {renderNotifSection()}
    </div>
  );

  const renderStepTracto = () => (
    <div className="wizard-step-content">
      <div className="wizard-grid-2">
        {["eco", "placa", "marca", "modelo", "color", "tipo"].map((field) => (
          <TextInput
            key={field}
            label={FIELD_LABELS_TRACTO[field]}
            name={`tracto.${field}`}
            value={transporteData.tracto[field]}
            onChange={handleChange}
            required={!!roleData?.tracto?.create}
            className="mb-3"
            placeholder={FIELD_LABELS_TRACTO[field]}
          />
        ))}
      </div>
    </div>
  );

  const renderStepRemolque = () => (
    <div className="wizard-step-content">
      <div className="wizard-grid-2">
        {["eco", "placa", "color", "capacidad", "sello"].map((field) => (
          <TextInput
            key={field}
            label={FIELD_LABELS_REMOLQUE[field]}
            name={`remolque.${field}`}
            value={transporteData.remolque[field]}
            onChange={handleChange}
            required={!!roleData?.remolque?.create}
            className="mb-3"
            placeholder={FIELD_LABELS_REMOLQUE[field]}
          />
        ))}
      </div>
    </div>
  );

  const renderStepOperador = () => (
    <div className="wizard-step-content">
      <Select
        label="Línea de transporte"
        value={draftLineaText ? "" : transporteData.lineaTransporte}
        onChange={(val) => {
          setDraftLineaText("");
          setDraftOperadorText("");
          setTransporteData((prev) => ({...prev, lineaTransporte: val || "", operador: ""}));
          setOperadores([]);
          if (val && val !== "all") fetchOperadores(val);
        }}
        options={lineasTransporte.map((linea) => ({value: linea.nombre, label: linea.nombre}))}
        placeholder="Selecciona una línea"
        searchable
        clearable
        className="mb-3"
      />
      {roleData?.crear_draft_transporte && (
        <TextInput
          placeholder="O escribe una línea nueva…"
          value={draftLineaText}
          onChange={(e) => {
            const val = e.target.value;
            setDraftLineaText(val);
            setDraftOperadorText("");
            setTransporteData((prev) => ({...prev, lineaTransporte: val, operador: ""}));
            setOperadores([]);
            if (val) fetchOperadores(val);
          }}
          className="mb-3"
        />
      )}

      <Select
        label="Operador"
        value={draftOperadorText ? "" : transporteData.operador}
        onChange={(val) => {
          setDraftOperadorText("");
          setTransporteData((prev) => ({...prev, operador: val || ""}));
        }}
        options={operadores.map((op) => ({value: op.nombre, label: op.nombre}))}
        placeholder={transporteData.lineaTransporte ? "Selecciona un operador" : "Selecciona una línea primero"}
        searchable
        clearable
        className="mb-3"
        disabled={!transporteData.lineaTransporte}
      />
      {roleData?.crear_draft_transporte && (
        <TextInput
          placeholder="O escribe un operador nuevo…"
          value={draftOperadorText}
          onChange={(e) => {
            const val = e.target.value;
            setDraftOperadorText(val);
            setTransporteData((prev) => ({...prev, operador: val}));
          }}
          className="mb-3"
        />
      )}

      <TextInput
        label="Teléfono"
        name="telefono"
        value={transporteData.telefono}
        onChange={handleChange}
        placeholder="1234567890"
        required={!!roleData?.operador?.create}
        className="mb-2"
      />
      {phoneError ? (
        <small className="text-danger d-block mb-2">{phoneError}</small>
      ) : (
        <small className="text-muted d-block mb-2">Exactamente 10 dígitos sin espacios</small>
      )}
    </div>
  );

  const stepContent = [renderStepGps, renderStepTracto, renderStepRemolque, renderStepOperador];
  const isLastStep = currentStep === STEPS.length - 1;

  const goNext = () => {
    setSlideDirection("forward");
    setCurrentStep((s) => s + 1);
  };
  const goPrev = () => {
    setSlideDirection("backward");
    setCurrentStep((s) => s - 1);
  };

  return (
    <>
    <ModalTemplate
      wide
      show={show}
      title="Crear Nuevo Transporte"
      onClose={handleClose}
      onSubmit={handleSubmitTransporte}
      hideFooter
    >
      <div className="wizard-steps">
        {STEPS.map((step, i) => (
          <React.Fragment key={step.key}>
            <div className={`wizard-step ${i === currentStep ? "active" : ""} ${i < currentStep ? "completed" : ""}`}>
              <div className="wizard-step-circle">
                {i < currentStep ? <i className="fa-solid fa-check"></i> : <span>{i + 1}</span>}
              </div>
              <span className="wizard-step-label">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`wizard-step-connector ${i < currentStep ? "completed" : ""}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="wizard-numeric-indicator">
        Paso {currentStep + 1} de {STEPS.length} — {STEPS[currentStep].label}
      </div>

      <div key={`step-${currentStep}-${slideDirection}`} className={`wizard-step-content slide-${slideDirection}`}>
        {stepContent[currentStep]()}
      </div>

      <div className="wizard-footer">
        <button
          type="button"
          className="btn btn-outline-secondary"
          disabled={saving}
          onClick={currentStep === 0 ? handleClose : goPrev}
        >
          {currentStep === 0 ? (
            <>
              <i className="fa-solid fa-xmark me-1"></i>Cancelar
            </>
          ) : (
            <>
              <i className="fa-solid fa-arrow-left me-1"></i>Anterior
            </>
          )}
        </button>
        {isLastStep ? (
          <button type="button" className="btn btn-success" onClick={doSave} disabled={saving}>
            {saving ? (
              <>
                <i className="fa fa-spinner fa-spin me-1"></i>Guardando y activando alertas…
              </>
            ) : (
              <>
                <i className="fa-solid fa-check me-1"></i>Guardar
              </>
            )}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={goNext}>
            Siguiente<i className="fa-solid fa-arrow-right ms-1"></i>
          </button>
        )}
      </div>
    </ModalTemplate>
    <Toast toasts={toasts} removeToast={removeToast} />
    </>
  );
};

export default CreateTransporteModal;
