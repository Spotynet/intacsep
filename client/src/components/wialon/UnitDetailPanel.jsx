import {useEffect, useState, useCallback} from "react";
import {useWialon} from "../../context/WialonProvider";

const NA = -348201.3876;

const fmtTime = (ts) => {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("es-MX", {dateStyle: "short", timeStyle: "short"});
};

const fmtTimeShort = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return `hace ${diffSec}s`;
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)}h`;
  return d.toLocaleString("es-MX", {dateStyle: "short", timeStyle: "short"});
};

const headingLabel = (c) => {
  if (c === 0) return "N";
  if (c === 90) return "E";
  if (c === 180) return "S";
  if (c === 270) return "O";
  return `${Math.round(c)}°`;
};

const UnitDetailPanel = ({unit, onClose, onShowTrack}) => {
  const {session} = useWialon();
  const [sensors, setSensors] = useState([]);
  const [address, setAddress] = useState("");

  const pos = unit?.getPosition?.();
  const msg = unit?.getLastMessage?.();
  const heading = pos?.c ?? 0;
  const speed = pos?.s ?? 0;
  const iconUrl = unit?.getIconUrl?.(64);
  const mileage = unit?.getMileageCounter?.();
  const engineHrs = unit?.getEngineHoursCounter?.();

  useEffect(() => {
    if (!unit) return;
    try {
      const s = unit.getSensors?.();
      if (s && msg) {
        const list = [];
        for (const key in s) {
          const sensor = s[key];
          if (sensor.t === "driver") continue;
          const val = unit.calculateSensorValue?.(sensor, msg);
          if (val === NA || val === undefined) continue;
          list.push({
            id: sensor.id,
            name: sensor.n,
            value: typeof val === "number" ? Number(val.toFixed(1)) : val,
            unit: sensor.m || "",
            type: sensor.t,
          });
        }
        setSensors(list);
      }
    } catch {
      setSensors([]);
    }
  }, [unit]);

  useEffect(() => {
    if (!pos || !session) return;
    try {
      const gisUrl = session.getBaseGisUrl("geocode");
      if (!gisUrl) return;
      window.wialon.util.Gis.getLocations([{lon: pos.x, lat: pos.y}], (code, data) => {
        if (!code && data?.[0]) {
          setAddress(data[0]);
        }
      });
    } catch {}
  }, [pos?.x, pos?.y, session]);

  if (!unit) return null;

  return (
    <div className="unit-detail-panel">
      <div className="unit-detail-panel__header">
        <div className="unit-detail-panel__header-left">
          {iconUrl && <img src={iconUrl} className="unit-detail-panel__icon" />}
          <div>
            <div className="unit-detail-panel__name">{unit.getName()}</div>
            <div className="unit-detail-panel__status">
              <span
                className="unit-detail-panel__dot"
                style={{background: speed > 0 ? "#22c55e" : "#6b7280"}}
              />
              {speed > 0 ? `${speed} km/h · ${headingLabel(heading)}` : "Detenido"} ·{" "}
              {fmtTimeShort(pos?.t)}
            </div>
          </div>
        </div>
        <div className="unit-detail-panel__header-right">
          {pos && (
            <button
              className="unit-detail-panel__btn"
              onClick={() => onShowTrack?.(unit)}
              title="Ver historial">
              <i className="fa fa-route"></i>
            </button>
          )}
          <button className="unit-detail-panel__btn" onClick={onClose} title="Cerrar">
            <i className="fa fa-times"></i>
          </button>
        </div>
      </div>

      {address && (
        <div className="unit-detail-panel__address">
          <i className="fa fa-map-marker-alt"></i> {address}
        </div>
      )}

      <div className="unit-detail-panel__body">
        <div className="unit-detail-panel__section">
          <div className="unit-detail-panel__section-title">Información</div>
          <div className="unit-detail-panel__grid">
            <span className="unit-detail-panel__label">Coordenadas</span>
            <span className="unit-detail-panel__value">
              {pos ? `${pos.y.toFixed(6)}, ${pos.x.toFixed(6)}` : "—"}
            </span>
            {pos?.z !== undefined && pos.z !== 0 && (
              <>
                <span className="unit-detail-panel__label">Altitud</span>
                <span className="unit-detail-panel__value">{pos.z} m</span>
              </>
            )}
            {pos?.sc !== undefined && (
              <>
                <span className="unit-detail-panel__label">Satélites</span>
                <span className="unit-detail-panel__value">{pos.sc}</span>
              </>
            )}
            <span className="unit-detail-panel__label">Rumbo</span>
            <span className="unit-detail-panel__value">{headingLabel(heading)}</span>
            <span className="unit-detail-panel__label">Última vez</span>
            <span className="unit-detail-panel__value">{fmtTime(pos?.t)}</span>
            {mileage !== undefined && (
              <>
                <span className="unit-detail-panel__label">Odómetro</span>
                <span className="unit-detail-panel__value">{Number(mileage.toFixed(1))} km</span>
              </>
            )}
            {engineHrs !== undefined && (
              <>
                <span className="unit-detail-panel__label">Horas motor</span>
                <span className="unit-detail-panel__value">
                  {Number(engineHrs.toFixed(1))} h
                </span>
              </>
            )}
          </div>
        </div>

        {sensors.length > 0 && (
          <div className="unit-detail-panel__section">
            <div className="unit-detail-panel__section-title">Sensores</div>
            <div className="unit-detail-panel__grid">
              {sensors.map((s) => (
                <span key={`l-${s.id}`} className="unit-detail-panel__label">
                  {s.name}
                </span>
              ))}
              {sensors.map((s) => (
                <span key={`v-${s.id}`} className="unit-detail-panel__value">
                  {s.value} {s.unit}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnitDetailPanel;
