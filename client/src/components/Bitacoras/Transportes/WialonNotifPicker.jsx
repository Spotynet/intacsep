import {useEffect, useMemo, useRef, useState} from "react";
import {Select} from "../../Select";
import {TRIGGER_LABELS, TRIGGER_COLORS, TRIGGER_ICONS} from "../../../utils/wialonNotifications";

const notifKey = (n) => `${n.resourceId}_${n.notifId}`;

export const mergeNotificaciones = (existing, incoming) => {
  const base = Array.isArray(existing) ? existing : [];
  const extra = Array.isArray(incoming) ? incoming : [];
  const seen = new Set(base.map((n) => `${n.resourceId}_${n.notifId}`));
  const merged = [...base];
  for (const n of extra) {
    if (!n) continue;
    const key = `${n.resourceId}_${n.notifId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(n);
  }
  return merged;
};

export const reportWialonSync = (sync, showToast) => {
  if (!sync || !showToast) return;
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

const WialonNotifPicker = ({open, active, unitIds = [], hint = "", onChange}) => {
  const [notifCatalog, setNotifCatalog] = useState(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState("");
  const [notifQuery, setNotifQuery] = useState("");
  const [notifRetry, setNotifRetry] = useState(0);
  const [selectedLinked, setSelectedLinked] = useState({});
  const [selectedCanonical, setSelectedCanonical] = useState({});
  // Canonical types the user has switched off. A missing key means ON, so every
  // type starts enabled without depending on the async catalog. Turning one off
  // drops its pick: the row is inert until it is switched back on.
  const [disabledCanonical, setDisabledCanonical] = useState({});
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const hintRef = useRef("");
  const prevUnitIdsRef = useRef(null);
  const onChangeRef = useRef(onChange);
  // Every candidate ever offered in this modal, keyed by notifKey. The catalog
  // comes back without candidates while the search box is empty, but a choice
  // already made must keep rendering and reach the save payload.
  const candidatesSeenRef = useRef({});

  onChangeRef.current = onChange;
  const unitIdsKey = unitIds.join(",");

  useEffect(() => {
    hintRef.current = hint || "";
  }, [hint]);

  useEffect(() => {
    if (!open) return;
    setNotifCatalog(null);
    setNotifError("");
    setNotifLoading(false);
    setNotifQuery("");
    setNotifRetry(0);
    setSelectedLinked({});
    setSelectedCanonical({});
    setDisabledCanonical({});
    prevUnitIdsRef.current = null;
    candidatesSeenRef.current = {};
  }, [open]);

  useEffect(() => {
    if (!open || !active || !unitIdsKey) {
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
        const hintText = hintRef.current || "";
        // La búsqueda arranca con 2 caracteres: por debajo el servidor responde
        // en modo "lite" (solo grupos y contadores), sin el listado de opciones.
        const query = notifQuery.trim().length >= 2 ? notifQuery.trim() : "";
        const url =
          `${baseUrl}/wialon/notifications/catalog` +
          `?unitIds=${encodeURIComponent(unitIdsKey)}` +
          `&hint=${encodeURIComponent(hintText)}` +
          `&q=${encodeURIComponent(query)}`;
        const response = await fetch(url, {method: "GET", credentials: "include"});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;

        (data.canonical || []).forEach((t) => {
          (t.candidates || []).forEach((c) => {
            candidatesSeenRef.current[notifKey(c)] = {...c, triggerType: t.triggerType};
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
  }, [open, active, unitIdsKey, notifQuery, notifRetry, baseUrl]);

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
    if (!active || !notifCatalog) return out;
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
  }, [active, notifCatalog, selectedLinked, selectedCanonical, disabledCanonical]);

  useEffect(() => {
    onChangeRef.current?.(selectedNotificaciones);
  }, [selectedNotificaciones]);

  if (!active) return null;

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
          <button type="button" className="notif-retry" onClick={() => setNotifRetry((n) => n + 1)}>
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
                        <span className="notif-item__name" title={n.name}>{n.name}</span>
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
                  <button type="button" onClick={() => setNotifQuery("")} aria-label="Limpiar búsqueda">
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
                  if (seen) options.push({value, label: seen.name});
                }
                const emptyText =
                  t.total === 0
                    ? "Sin candidatas disponibles"
                    : notifQuery.trim().length < 2
                      ? "Escribe 2+ letras para buscar"
                      : "Sin resultados";
                return (
                  <div key={t.key} className={`notif-canonical__row${isOff ? " is-off" : ""}`}>
                    <span className="notif-canonical__label" title={t.label}>
                      <i className={`fa-solid ${TRIGGER_ICONS[t.triggerType] || "fa-bell"}`}></i>
                      <span className="notif-canonical__text">{t.label}</span>
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

export default WialonNotifPicker;
