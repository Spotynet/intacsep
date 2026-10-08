import {useEffect, useMemo, useRef, useState} from "react";
import {Select} from "../../Select";
import ModalTemplate from "../../ModalTemplate";
import {
  TRIGGER_LABELS,
  TRIGGER_COLORS,
  TRIGGER_ICONS,
  getTriggerHint,
} from "../../../utils/wialonNotifications";

const explainLinked = (n) => {
  const type = TRIGGER_LABELS[n.triggerType] || n.triggerType || "Alerta";
  const state = n.enabled
    ? "Está encendida."
    : "Está apagada; se enciende al guardar el transporte.";
  const cover =
    n.unitCount === 1
      ? "Solo vigila este GPS."
      : `La misma alerta vigila ${n.unitCount} GPS, incluido este.`;
  return `${type}: ${getTriggerHint(n.triggerType)} ${state} ${cover}`;
};

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
  const linked = applied.filter((a) => a.action !== "unlink");
  const unlinked = applied.filter((a) => a.action === "unlink");

  if (failed.length > 0) {
    const reasons = [...new Set(failed.map((f) => f.error).filter(Boolean))];
    const detail = reasons.slice(0, 2).join("  ·  ") || "error desconocido";
    const more = reasons.length > 2 ? ` (+${reasons.length - 2} motivo(s) más)` : "";
    const ok =
      linked.length > 0
        ? ` Sí se activaron ${linked.length}.`
        : unlinked.length > 0
        ? ` Sí se desvincularon ${unlinked.length}.`
        : "";
    showToast(
      `${failed.length} alerta(s) con error: ${detail}${more}.${ok}`,
      "error",
      15000
    );
  }
  if (linked.length > 0) {
    showToast(`${linked.length} notificación(es) activada(s).`, "success");
  }
  if (unlinked.length > 0) {
    showToast(`${unlinked.length} notificación(es) desvinculada(s) del GPS.`, "success");
  }
  if (skippedUnits.length > 0) {
    showToast(
      `GPS no encontrado: ${skippedUnits.join(", ")}.`,
      "warning",
      8000
    );
  }
};

const WialonNotifPicker = ({open, active, unitIds = [], hint = "", onChange, showToast}) => {
  const [notifCatalog, setNotifCatalog] = useState(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState("");
  const [notifQuery, setNotifQuery] = useState("");
  const [notifRetry, setNotifRetry] = useState(0);
  const [selectedCanonical, setSelectedCanonical] = useState({});
  // Canonical types the user has switched off. A missing key means ON, so every
  // type starts enabled without depending on the async catalog. Turning one off
  // drops its pick: the row is inert until it is switched back on.
  const [disabledCanonical, setDisabledCanonical] = useState({});
  const [unlinkingKey, setUnlinkingKey] = useState(null);
  const [pendingUnlink, setPendingUnlink] = useState(null);
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
    setSelectedCanonical({});
    setDisabledCanonical({});
    setUnlinkingKey(null);
    setPendingUnlink(null);
    prevUnitIdsRef.current = null;
    candidatesSeenRef.current = {};
  }, [open]);

  // Reset search when the GPS selection changes so a previous filter does not
  // hide the default candidate list for the newly selected unit.
  useEffect(() => {
    if (!open || !active) return;
    if (prevUnitIdsRef.current == null) return;
    if (prevUnitIdsRef.current === unitIdsKey) return;
    setNotifQuery("");
    setSelectedCanonical({});
  }, [open, active, unitIdsKey]);

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
    const requestForUnits = unitIdsKey;
    const timer = setTimeout(async () => {
      setNotifError("");
      try {
        const hintText = hintRef.current || "";
        // Optional filter: with q empty the server still returns ranked options.
        const query = notifQuery.trim().length >= 2 ? notifQuery.trim() : "";
        const url =
          `${baseUrl}/wialon/notifications/catalog` +
          `?unitIds=${encodeURIComponent(requestForUnits)}` +
          `&hint=${encodeURIComponent(hintText)}` +
          `&q=${encodeURIComponent(query)}`;
        const response = await fetch(url, {method: "GET", credentials: "include"});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;

        (data.canonical || []).forEach((t) => {
          (Array.isArray(t.candidates) ? t.candidates : []).forEach((c) => {
            if (c?.resourceId == null || c?.notifId == null) return;
            candidatesSeenRef.current[notifKey(c)] = {...c, triggerType: t.triggerType};
          });
        });

        prevUnitIdsRef.current = requestForUnits;
        setNotifCatalog(data);

        // Drop picks that are no longer in the candidate list for this GPS.
        if (unitsChanged) {
          setSelectedCanonical((prev) => {
            const next = {};
            Object.entries(prev).forEach(([key, value]) => {
              if (!value) return;
              const type = (data.canonical || []).find((c) => c.key === key);
              const candidates = type?.candidates || [];
              const stillThere =
                candidates.some((c) => notifKey(c) === value) ||
                !!candidatesSeenRef.current[value];
              if (stillThere) next[key] = value;
            });
            return next;
          });
        }
      } catch (e) {
        if (!cancelled) {
          setNotifCatalog(null);
          setNotifError("No fue posible cargar las notificaciones.");
        }
      } finally {
        if (!cancelled) setNotifLoading(false);
      }
    }, unitsChanged ? 150 : 450);

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

  const requestUnlinkLinked = (n) => {
    if (!unitIds.map(String).filter(Boolean).length || unlinkingKey) return;
    setPendingUnlink({mode: "one", notif: n});
  };

  const requestUnlinkAllLinked = () => {
    const linked = notifCatalog?.linked || [];
    if (!linked.length || !unitIds.map(String).filter(Boolean).length || unlinkingKey) return;
    setPendingUnlink({mode: "all", count: linked.length});
  };

  const confirmUnlinkLinked = async (e) => {
    e?.preventDefault?.();
    if (!pendingUnlink || unlinkingKey) return;
    const ids = unitIds.map(String).filter(Boolean);
    const linked = notifCatalog?.linked || [];
    if (!ids.length) return;

    const selections =
      pendingUnlink.mode === "all"
        ? linked.map((n) => ({
            resourceId: Number(n.resourceId),
            notifId: Number(n.notifId),
            action: "unlink",
          }))
        : pendingUnlink.notif
          ? [
              {
                resourceId: Number(pendingUnlink.notif.resourceId),
                notifId: Number(pendingUnlink.notif.notifId),
                action: "unlink",
              },
            ]
          : [];
    if (!selections.length) return;

    const busyKey =
      pendingUnlink.mode === "all" ? "__all__" : notifKey(pendingUnlink.notif);
    setUnlinkingKey(busyKey);
    try {
      const response = await fetch(`${baseUrl}/wialon/notifications/apply`, {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({unitIds: ids, selections}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.message || `HTTP ${response.status}`);
      }
      reportWialonSync(data, showToast);
      setPendingUnlink(null);
      // Force catalog reload so the linked list reflects Wialon.
      prevUnitIdsRef.current = null;
      setNotifRetry((r) => r + 1);
    } catch (err) {
      showToast?.(err.message || "No se pudo desvincular la notificación", "error");
    } finally {
      setUnlinkingKey(null);
    }
  };

  const selectedNotificaciones = useMemo(() => {
    const out = [];
    if (!active || !notifCatalog) return out;
    // Remaining linked alerts stay on the transporte unless Desvincular removed them.
    (notifCatalog.linked || []).forEach((n) => {
      out.push({
        resourceId: n.resourceId,
        notifId: n.notifId,
        name: n.name,
        triggerType: n.triggerType,
        kind: "vinculada",
      });
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
  }, [active, notifCatalog, selectedCanonical, disabledCanonical]);

  useEffect(() => {
    onChangeRef.current?.(selectedNotificaciones);
  }, [selectedNotificaciones]);

  if (!active) return null;

  const linkedCount = (notifCatalog?.linked || []).length;
  const unlinkAllBusy = unlinkingKey === "__all__";
  const pendingBusy =
    pendingUnlink?.mode === "all"
      ? unlinkAllBusy
      : pendingUnlink?.notif
        ? unlinkingKey === notifKey(pendingUnlink.notif)
        : false;
  const pendingLabel = pendingUnlink?.notif?.name || "esta alerta";

  return (
    <>
    <div className="notif-picker">
      <div className="notif-picker__header">
        <i className="fa-solid fa-bell"></i>
        <div>
          <div className="notif-picker__title">Notificaciones a activar</div>
          <div className="notif-picker__subtitle">
            Alertas que se vincularán y activarán para este transporte.
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
            {missingUnits.length === 1 ? "no existe" : "no existen"} en el catálogo GPS: no{" "}
            {missingUnits.length === 1 ? "se le podrá" : "les podrán"} activar notificaciones.
          </span>
        </div>
      )}

      {notifLoading && !notifCatalog && !notifError && (
        <div className="notif-empty">
          <i className="fa fa-spinner fa-spin me-2"></i>Cargando notificaciones…
        </div>
      )}

      {notifCatalog && !notifError && (
        <>
          <div className="notif-group notif-group--linked">
            <div className="notif-group__title">
              <span className="notif-group__title-text">
                Vinculadas a este GPS
                <span className="notif-group__count">{linkedCount}</span>
              </span>
              {linkedCount > 0 && (
                <button
                  type="button"
                  className="notif-group__unlink-all"
                  disabled={!!unlinkingKey}
                  onClick={requestUnlinkAllLinked}
                >
                  {unlinkAllBusy ? "Desvinculando…" : "Desvincular todas"}
                </button>
              )}
            </div>
            <p className="notif-group__lead">
              Ya vinculadas. Se conservan en este transporte; Desvincular las quita del GPS ahora.
            </p>
            {linkedCount === 0 ? (
              <div className="notif-empty">Este GPS no tiene alertas vinculadas todavía.</div>
            ) : (
              <div className="linked-notif-list">
                {notifCatalog.linked.map((n) => {
                  const key = notifKey(n);
                  const busy = unlinkingKey === key || unlinkAllBusy;
                  const typeLabel = TRIGGER_LABELS[n.triggerType] || n.triggerType || "Alerta";
                  const detail = explainLinked(n);
                  const meta = [
                    typeLabel,
                    n.enabled ? "Encendida" : "Apagada",
                    n.unitCount === 1 ? "1 GPS" : `${n.unitCount} GPS`,
                  ].join(" · ");
                  return (
                    <div key={key} className="linked-notif" title={detail}>
                      <div className="linked-notif__row">
                        <span
                          className="linked-notif__icon"
                          style={{background: TRIGGER_COLORS[n.triggerType] || "#94a3b8"}}
                          aria-hidden="true"
                        >
                          <i className={`fa-solid ${TRIGGER_ICONS[n.triggerType] || "fa-bell"}`}></i>
                        </span>
                        <div className="linked-notif__body">
                          <div className="linked-notif__name">{n.name}</div>
                          <div className="linked-notif__meta">{meta}</div>
                        </div>
                        <button
                          type="button"
                          className="linked-notif__unlink"
                          disabled={busy || !!unlinkingKey}
                          onClick={() => requestUnlinkLinked(n)}
                          title="Quitar este GPS de la alerta"
                        >
                          {busy ? (
                            <i className="fa fa-spinner fa-spin" aria-hidden="true"></i>
                          ) : (
                            <i className="fa-solid fa-link-slash" aria-hidden="true"></i>
                          )}
                          <span>{busy ? "…" : "Desvincular"}</span>
                        </button>
                      </div>
                    </div>
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
                  placeholder="Filtrar por nombre…"
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
                const candidates = Array.isArray(t.candidates) ? t.candidates : [];
                const options = candidates.map((c) => ({
                  value: notifKey(c),
                  label: `${c.name || "Alerta"}${c.unitCount > 0 ? ` · ${c.unitCount} u.` : ""}`,
                }));
                // While the search box is empty the catalog comes back without
                // candidates: keep the option already picked on screen.
                if (value && !options.some((o) => o.value === value)) {
                  const seen = candidatesSeenRef.current[value];
                  if (seen) options.push({value, label: seen.name || "Alerta"});
                }
                const emptyText =
                  t.total === 0
                    ? "Sin candidatas disponibles"
                    : notifLoading
                      ? "Cargando…"
                      : notifQuery.trim().length >= 2
                        ? "Sin coincidencias"
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
                        candidates.length > 0
                          ? `Elegir (${candidates.length}${
                              t.total > candidates.length ? ` de ${t.total}` : ""
                            })`
                          : t.total === 0
                            ? "Sin candidatas disponibles"
                            : notifLoading
                              ? "Cargando alertas…"
                              : notifQuery.trim().length >= 2
                                ? "Sin coincidencias"
                                : "Sin candidatas disponibles"
                      }
                      // Typing here searches the same catalog as the section bar.
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
                Al guardar se vinculan al GPS y se activan. Si alguna se rechaza porque el
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

    <ModalTemplate
      show={!!pendingUnlink}
      elevated
      width={440}
      formId="unlink-linked-notif-form"
      title={pendingUnlink?.mode === "all" ? "Desvincular todas" : "Desvincular alerta"}
      onClose={() => {
        if (pendingBusy) return;
        setPendingUnlink(null);
      }}
      onSubmit={confirmUnlinkLinked}
      cancelText="Cancelar"
      submitText={
        pendingBusy
          ? "Desvinculando…"
          : pendingUnlink?.mode === "all"
            ? "Desvincular todas"
            : "Desvincular"
      }
      submitClass="btn btn-danger"
      submitDisabled={pendingBusy}
    >
      {pendingUnlink?.mode === "all" ? (
        <>
          <p>
            ¿Quitar este GPS de las <strong>{pendingUnlink.count}</strong> alertas
            vinculadas?
          </p>
          <p className="text-muted small mb-0">
            Se desvinculan ahora, antes de guardar el transporte. La lista quedará vacía.
          </p>
        </>
      ) : (
        <>
          <p>
            ¿Quitar este GPS de la alerta <strong>{pendingLabel}</strong>?
          </p>
          <p className="text-muted small mb-0">
            Se desvincula ahora, antes de guardar el transporte. La alerta se quita de la lista
            vinculada de este GPS.
          </p>
        </>
      )}
    </ModalTemplate>
    </>
  );
};

export default WialonNotifPicker;
