import {useEffect, useRef, useState, useCallback} from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import UnitDetailPanel from "./UnitDetailPanel";
import TrackHistoryPanel from "./TrackHistoryPanel";
import {useWialon} from "../../context/WialonProvider";

const THROTTLE_MS = 200;
const TRACE_MAX_POINTS = 100;

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

const NA = -348201.3876;

const WialonMap = ({searchTerm = ""}) => {
  const {session: wialonSession, loading: unitsLoading} = useWialon();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const sessionRef = useRef(null);
  const markersRef = useRef({});
  const tracesRef = useRef({});
  const geofenceLayerRef = useRef(null);

  const throttleTimers = useRef({});
  const moveendTimer = useRef(null);
  const mountIdRef = useRef(0);
  const prevUnitsJson = useRef("");
  const addressCache = useRef({});
  const selectedUnitId = useRef(null);

  const [status, setStatus] = useState("Inicializando...");
  const [unitCount, setUnitCount] = useState(0);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [units, setUnits] = useState([]);
  const [showDetail, setShowDetail] = useState(false);
  const [showTrack, setShowTrack] = useState(false);
  const [detailUnit, setDetailUnit] = useState(null);
  const [trackUnit, setTrackUnit] = useState(null);
  const [geofenceCount, setGeofenceCount] = useState(0);
  const searchRef = useRef(searchTerm);
  searchRef.current = searchTerm;

  // ── Geocoding ──────────────────────────────────────────────
  const getAddress = useCallback((lat, lng) => {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (addressCache.current[key] !== undefined) return addressCache.current[key];
    try {
      window.wialon.util.Gis.getLocations([{lon: lng, lat}], (code, data) => {
        if (!code && data?.[0]) {
          addressCache.current[key] = data[0];
        }
      });
    } catch {}
    return null;
  }, []);

  // ── Popup Builder ──────────────────────────────────────────
  const buildPopupHtml = useCallback(
    (unit) => {
      const pos = unit.getPosition?.();
      const msg = unit.getLastMessage?.();
      const heading = pos?.c ?? 0;
      const speed = pos?.s ?? 0;
      const iconUrl = unit.getIconUrl?.(48);
      const mileage = unit.getMileageCounter?.();
      const engineHrs = unit.getEngineHoursCounter?.();

      let sensorRows = "";
      try {
        const sensors = unit.getSensors?.();
        if (sensors && msg) {
          for (const key in sensors) {
            const s = sensors[key];
            if (s.t === "driver") continue;
            const val = unit.calculateSensorValue?.(s, msg);
            if (val === NA || val === undefined) continue;
            const display = typeof val === "number" ? Number(val.toFixed(1)) : val;
            sensorRows += `<div class="wialon-popup__label">${s.n}</div><div class="wialon-popup__value">${display} ${s.m || ""}</div>`;
          }
        }
      } catch {}

      const hLabel =
        heading === 0 ? "N" : heading === 90 ? "E" : heading === 180 ? "S" : heading === 270 ? "O" :
        `${Math.round(heading)}°`;

      const address = pos ? getAddress(pos.y, pos.x) : null;

      return `
        <div class="wialon-popup">
          <div class="wialon-popup__header">
            ${iconUrl ? `<img src="${iconUrl}" class="wialon-popup__icon" />` : ""}
            <div class="wialon-popup__title">
              <div class="wialon-popup__name">${unit.getName()}</div>
              <div class="wialon-popup__sub">${speed > 0 ? `En movimiento · ${speed} km/h` : "Detenido"}</div>
            </div>
            <div class="wialon-popup__heading-badge" style="background:${speed > 0 ? "#22c55e" : "#6b7280"}">
              ${hLabel}
            </div>
          </div>
          ${address ? `<div class="wialon-popup__address"><i class="fa fa-map-marker-alt"></i> ${address}</div>` : ""}
          <div class="wialon-popup__grid">
            <div class="wialon-popup__label">Última vez</div>
            <div class="wialon-popup__value">${fmtTime(pos?.t)}</div>
            ${pos ? `
              <div class="wialon-popup__label">Coordenadas</div>
              <div class="wialon-popup__value">${pos.y.toFixed(6)}, ${pos.x.toFixed(6)}</div>
            ` : ""}
            ${mileage !== undefined ? `
              <div class="wialon-popup__label">Odómetro</div>
              <div class="wialon-popup__value">${Number(mileage.toFixed(1))} km</div>
            ` : ""}
            ${engineHrs !== undefined ? `
              <div class="wialon-popup__label">Motor</div>
              <div class="wialon-popup__value">${Number(engineHrs.toFixed(1))} h</div>
            ` : ""}
            ${sensorRows}
          </div>
          <div class="wialon-popup__time">${fmtTimeShort(pos?.t)}</div>
        </div>
      `;
    },
    [getAddress]
  );

  // ── Icon Builder ───────────────────────────────────────────
  const createIcon = useCallback((unit) => {
    const pos = unit.getPosition?.();
    const speed = pos?.s ?? 0;
    const heading = pos?.c ?? 0;
    const color = speed > 0 ? "#22c55e" : "#6b7280";
    const iconUrl = unit.getIconUrl?.(32);

    if (iconUrl) {
      return L.divIcon({
        className: "wialon-unit-marker",
        html: `<img src="${iconUrl}" style="
          width:28px;height:28px;
          transform:rotate(${heading}deg);
          transition:transform .3s ease;
        " />`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });
    }

    return L.divIcon({
      className: "wialon-unit-marker",
      html: `<div style="
        width:28px;height:28px;border-radius:50%;
        background:${color};border:3px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,.3);
        display:flex;align-items:center;justify-content:center;
        transform:rotate(${heading}deg);
      "><span style="color:#fff;font-size:12px;font-weight:700;transform:rotate(-${heading}deg);">▲</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }, []);

  // ── Marker Factory (deferred popup) ────────────────────────
  const createMarker = useCallback(
    (unit) => {
      const pos = unit.getPosition?.();
      if (!pos) return null;
      const latlng = L.latLng(pos.y, pos.x);
      const icon = createIcon(unit);
      const marker = L.marker(latlng, {icon});
      marker._wialonUnit = unit;
      marker.bindPopup("", {maxWidth: 280, className: "wialon-popup-wrapper"});
      marker.on("popupopen", () => {
        marker.getPopup().setContent(buildPopupHtml(unit));
      });
      return marker;
    },
    [createIcon, buildPopupHtml]
  );

  // ── Sidebar sync ───────────────────────────────────────────
  const buildUnitsJson = useCallback((list) => {
    return list.map((u) => `${u.id}:${u.speed}:${u.pos?.y}:${u.pos?.x}`).join("|");
  }, []);

  const syncSidebar = useCallback(
    (sess) => {
      const items = sess.getItems("avl_unit") || [];
      const cur = searchRef.current.toLowerCase();
      const filtered = cur
        ? items.filter((u) => (u.getName?.() ?? "").toLowerCase().includes(cur))
        : items;

      const newList = filtered.map((u) => {
        const pos = u.getPosition?.();
        return {id: u.getId(), name: u.getName(), pos, speed: pos?.s ?? 0, lastMsg: pos?.t};
      });

      const json = buildUnitsJson(newList);
      if (json !== prevUnitsJson.current) {
        prevUnitsJson.current = json;
        setUnits(newList);
        setUnitCount(newList.length);
      }
      return filtered;
    },
    [buildUnitsJson]
  );

  // ── Live trace (trail polyline) ────────────────────────────
  const updateTrace = useCallback(
    (unit) => {
      const map = mapInstance.current;
      if (!map) return;
      const id = unit.getId();
      const pos = unit.getPosition?.();
      if (!pos) return;

      const latlng = L.latLng(pos.y, pos.x);

      if (!tracesRef.current[id]) {
        tracesRef.current[id] = L.polyline([], {
          color: "#6366f1",
          weight: 3,
          opacity: 0.5,
          dashArray: "4 4",
          smoothFactor: 1,
        }).addTo(map);
      }

      const line = tracesRef.current[id];
      const pts = line.getLatLngs();
      pts.push(latlng);

      if (pts.length > TRACE_MAX_POINTS) {
        pts.splice(0, pts.length - TRACE_MAX_POINTS);
      }
      line.setLatLngs(pts);
    },
    []
  );

  // ── Throttled marker update ────────────────────────────────
  const updateSingleMarker = useCallback(
    (unit) => {
      const id = unit.getId();
      if (throttleTimers.current[id]) return;
      throttleTimers.current[id] = true;

      const map = mapInstance.current;
      if (!map || !map.getContainer()) return;

      const pos = unit.getPosition?.();
      if (!pos) return;

      const latlng = L.latLng(pos.y, pos.x);
      const icon = createIcon(unit);

      if (markersRef.current[id]) {
        markersRef.current[id].setLatLng(latlng).setIcon(icon);
      } else {
        const marker = createMarker(unit);
        if (marker) {
          marker.addTo(map);
          markersRef.current[id] = marker;
        }
      }

      // Only trace the selected unit
      if (id === selectedUnitId.current) {
        updateTrace(unit);
      }

      setTimeout(() => {
        throttleTimers.current[id] = false;
      }, THROTTLE_MS);
    },
    [createIcon, createMarker, updateTrace]
  );

  // ── Full refresh ───────────────────────────────────────────
  const refreshAllMarkers = useCallback(
    (sess) => {
      const map = mapInstance.current;
      if (!map || !map.getContainer()) return;

      const filtered = syncSidebar(sess);
      const filteredIds = new Set(filtered.map((u) => u.getId()));
      const bounds = map.getBounds();
      const expanded = bounds.pad(0.2);

      filtered.forEach((unit) => {
        const pos = unit.getPosition?.();
        if (!pos) return;
        const id = unit.getId();
        const latlng = L.latLng(pos.y, pos.x);
        const icon = createIcon(unit);

        if (markersRef.current[id]) {
          markersRef.current[id].setLatLng(latlng).setIcon(icon);
        } else if (expanded.contains(latlng)) {
          const marker = createMarker(unit);
          if (marker) {
            marker.addTo(map);
            markersRef.current[id] = marker;
          }
        }
      });

      Object.keys(markersRef.current).forEach((id) => {
        if (!filteredIds.has(Number(id))) {
          map.removeLayer(markersRef.current[id]);
          delete markersRef.current[id];
        }
      });

      if (filtered.length > 0 && !map._wialonFitted) {
        const allBounds = filtered
          .filter((u) => u.pos)
          .map((u) => L.latLng(u.pos.y, u.pos.x));
        if (allBounds.length > 0) {
          map.fitBounds(L.latLngBounds(allBounds).pad(0.1));
          map._wialonFitted = true;
        }
      }
    },
    [syncSidebar, createIcon, createMarker]
  );

  // ── Viewport culling on map move ───────────────────────────
  const cullMarkers = useCallback(() => {
    const map = mapInstance.current;
    const sess = sessionRef.current;
    if (!map || !sess || !map._wialonFitted) return;

    const bounds = map.getBounds().pad(0.2);
    const items = sess.getItems("avl_unit") || [];
    const inView = new Set();

    items.forEach((unit) => {
      const pos = unit.getPosition?.();
      if (pos && bounds.contains(L.latLng(pos.y, pos.x))) {
        inView.add(unit.getId());
      }
    });

    Object.keys(markersRef.current).forEach((id) => {
      const numId = Number(id);
      if (inView.has(numId)) {
        if (!map.hasLayer(markersRef.current[id])) {
          markersRef.current[id].addTo(map);
        }
      } else if (numId !== selectedUnitId.current) {
        if (map.hasLayer(markersRef.current[id])) {
          map.removeLayer(markersRef.current[id]);
        }
      }
    });

    // Ensure selected unit is always on map
    if (selectedUnitId.current && markersRef.current[selectedUnitId.current]) {
      if (!map.hasLayer(markersRef.current[selectedUnitId.current])) {
        markersRef.current[selectedUnitId.current].addTo(map);
      }
    }
  }, []);

  // ── Search filter ──────────────────────────────────────────
  const applySearchFilter = useCallback(
    (sess) => {
      const items = sess.getItems("avl_unit") || [];
      const cur = searchRef.current.toLowerCase();

      syncSidebar(sess);

      items.forEach((unit) => {
        const id = unit.getId();
        const marker = markersRef.current[id];
        if (!marker) return;

        const name = (unit.getName?.() ?? "").toLowerCase();
        const matches = !cur || name.includes(cur);

        if (matches && !mapInstance.current?.hasLayer(marker)) {
          marker.addTo(mapInstance.current);
        } else if (!matches && mapInstance.current?.hasLayer(marker)) {
          mapInstance.current?.removeLayer(marker);
        }

        // Toggle trace visibility
        const trace = tracesRef.current[id];
        if (trace) {
          if (matches && !mapInstance.current?.hasLayer(trace)) trace.addTo(mapInstance.current);
          else if (!matches && mapInstance.current?.hasLayer(trace)) mapInstance.current?.removeLayer(trace);
        }
      });
    },
    [syncSidebar]
  );

  // ── Load geofences ─────────────────────────────────────────
  const loadGeofences = useCallback(async () => {
    try {
      const token = localStorage.getItem("wialonToken");
      const baseUrl = import.meta.env.VITE_BASE_URL;
      if (!token || !baseUrl) return;

      const res = await fetch(`${baseUrl}/wialon/geofences`, {
        headers: {"x-wialon-token": token},
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.zones?.length) return;

      const gLayer = L.layerGroup().addTo(mapInstance.current);
      geofenceLayerRef.current = gLayer;
      let count = 0;

      data.zones.forEach((z) => {
        const colorHex = z.color || "#6366f1";
        let layer;

        if (z.type === 3 && z.points.length === 1) {
          const center = L.latLng(z.points[0].y, z.points[0].x);
          layer = L.circle(center, {
            radius: z.width || 100,
            color: colorHex,
            fillColor: colorHex,
            fillOpacity: 0.12,
            weight: 2,
          });
        } else if (z.type === 1) {
          const pts = z.points.map((p) => L.latLng(p.y, p.x));
          layer = L.polyline(pts, {
            color: colorHex,
            weight: z.width || 3,
            opacity: 0.8,
          });
        } else {
          const pts = z.points.map((p) => L.latLng(p.y, p.x));
          layer = L.polygon(pts, {
            color: colorHex,
            fillColor: colorHex,
            fillOpacity: 0.12,
            weight: 2,
          });
        }

        if (layer) {
          layer.bindTooltip(z.name || "Zona", {sticky: true, className: "wialon-geofence-tooltip"});
          layer.addTo(gLayer);
          count++;
        }
      });

      setGeofenceCount(count);
    } catch {}
  }, []);

  // ── One-time session listeners (map init) ─────────────────
  const setupSessionListeners = useCallback((sess) => {
    const onPositionChanged = (evt) => {
      if (mountIdRef.current === 0) return;
      const unit = sess.getItem(evt.i);
      if (unit) {
        updateSingleMarker(unit);
        if (detailUnit?.getId?.() === evt.i) {
          setDetailUnit(sess.getItem(evt.i));
        }
      }
    };

    const onItemDeleted = (item) => {
      const id = item.getId?.();
      if (id && markersRef.current[id]) {
        mapInstance.current?.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
      if (id && tracesRef.current[id]) {
        mapInstance.current?.removeLayer(tracesRef.current[id]);
        delete tracesRef.current[id];
      }
    };

    sess.addListener("positionChanged", onPositionChanged);
    sess.addListener("itemDeleted", onItemDeleted);

    mapInstance.current.on("moveend", () => {
      if (moveendTimer.current) clearTimeout(moveendTimer.current);
      moveendTimer.current = setTimeout(cullMarkers, 150);
    });
  }, [updateSingleMarker, detailUnit, cullMarkers]);

  // ── Load initial data (units + geofences) ─────────────────
  const loadInitialData = useCallback(() => {
    const sess = sessionRef.current;
    if (!sess || !mapInstance.current) return;

    refreshAllMarkers(sess);

    const resFlags = window.wialon.item.Item.dataFlag.base | 0x1000;
    sess.updateDataFlags([{type: "type", data: "avl_resource", flags: resFlags, mode: 0}], (rCode) => {
      if (!rCode) loadGeofences();
    });
  }, [refreshAllMarkers, loadGeofences]);

  // ── Map init ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const id = ++mountIdRef.current;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: true,
      maxZoom: 17,
    }).setView([19.43, -99.13], 6);

    mapInstance.current = map;

    // Use the shared session from WialonProvider (already logged in)
    const sess = wialonSession || window.wialon.core.Session.getInstance();
    sessionRef.current = sess;

    const afterLogin = () => {
      if (mountIdRef.current !== id) return;
      if (!map.getContainer()) return;

      setStatus("Cargando mapa...");

      const gisUrl = sess.getBaseGisUrl("render");
      const userId = sess.getCurrUser()?.getId();

      if (!gisUrl || !userId) {
        setStatus("No se pudo obtener la URL del mapa.");
        return;
      }

      const wialonTiles = L.tileLayer(`${gisUrl}/gis_render/{x}_{y}_{z}/${userId}/tile.png`, {
        maxZoom: 17,
        minZoom: 2,
        zoomReverse: true,
        attribution: "© Gurtam",
      });

      const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      });

      const esriSatellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {maxZoom: 18, attribution: "Tiles © Esri"}
      );

      const esriLabels = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
        {maxZoom: 19, attribution: "© CARTO"}
      );

      const hybrid = L.layerGroup([esriSatellite, esriLabels]);

      wialonTiles.addTo(map);

      L.control
        .layers(
          {Gurtam: wialonTiles, OpenStreetMap: osm, Satélite: esriSatellite, Híbrido: hybrid},
          {},
          {position: "topright"}
        )
        .addTo(map);

      sess.loadLibrary("itemIcon");
      sess.loadLibrary("unitSensors");
      setupSessionListeners(sess);
      setStatus("");
    };

    // Session is already logged in by WialonProvider
    const user = sess.getCurrUser();
    if (user) {
      afterLogin();
    } else {
      // Fallback: if provider session isn't ready yet, wait and retry
      const checkInterval = setInterval(() => {
        if (sess.getCurrUser()) {
          clearInterval(checkInterval);
          afterLogin();
        }
      }, 500);
      // Stop checking after 10s
      setTimeout(() => clearInterval(checkInterval), 10000);
    }

    return () => {
      mountIdRef.current++;
      if (moveendTimer.current) clearTimeout(moveendTimer.current);
      throttleTimers.current = {};
      selectedUnitId.current = null;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      markersRef.current = {};
      tracesRef.current = {};
      geofenceLayerRef.current = null;
    };
  }, [wialonSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load units when provider finishes fetching ─────────────
  useEffect(() => {
    if (unitsLoading || !wialonSession) return;
    const sess = sessionRef.current;
    if (!sess || !mapInstance.current) return;
    loadInitialData();
  }, [unitsLoading, wialonSession, loadInitialData]);

  useEffect(() => {
    const sess = sessionRef.current;
    if (sess && mapInstance.current) {
      applySearchFilter(sess);
    }
  }, [searchTerm, applySearchFilter]);

  // ── Handlers ───────────────────────────────────────────────
  const handleSelectUnit = useCallback(
    (u) => {
      if (u.pos && mapInstance.current) {
        mapInstance.current.setView([u.pos.y, u.pos.x], 15);
        markersRef.current[u.id]?.openPopup();
        const sess = sessionRef.current;
        const fullUnit = sess?.getItem(u.id);
        selectedUnitId.current = u.id;
        setSelectedUnit(u);
        setDetailUnit(fullUnit || null);
        setShowDetail(true);
        // Start trace for this unit
        if (fullUnit) updateTrace(fullUnit);
      }
    },
    [updateTrace]
  );

  const handleCloseDetail = useCallback(() => {
    // Remove trace for previously selected unit
    const prevId = selectedUnitId.current;
    if (prevId && tracesRef.current[prevId]) {
      mapInstance.current?.removeLayer(tracesRef.current[prevId]);
      delete tracesRef.current[prevId];
    }
    selectedUnitId.current = null;
    setShowDetail(false);
    setDetailUnit(null);
  }, []);

  const handleShowTrack = useCallback(
    (unit) => {
      selectedUnitId.current = unit.getId?.();
      setTrackUnit(unit);
      setShowTrack(true);
      setShowDetail(false);
    },
    []
  );

  const handleCloseTrack = useCallback(() => {
    selectedUnitId.current = null;
    setShowTrack(false);
    setTrackUnit(null);
  }, []);

  return (
    <div className="wialon-map-wrapper">
      {status && (
        <div className="wialon-map-status">
          <i className="fa fa-spinner fa-spin"></i> {status}
        </div>
      )}
      <div ref={mapRef} className="wialon-map-container" />

      {/* Sidebar */}
      <div className="wialon-map-sidebar">
        <div className="wialon-map-sidebar__header">
          <span className="wialon-map-sidebar__title">
            Unidades <span className="wialon-map-sidebar__count">{unitCount}</span>
          </span>
          {geofenceCount > 0 && (
            <span className="wialon-map-sidebar__badge" title="Zonas geográficas">
              <i className="fa fa-draw-polygon"></i> {geofenceCount}
            </span>
          )}
        </div>
        <div className="wialon-map-sidebar__list">
          {units.length === 0 ? (
            <div className="wialon-map-sidebar__empty">Sin unidades</div>
          ) : (
            units.map((u) => (
              <div
                key={u.id}
                className={`wialon-map-sidebar__item${selectedUnit?.id === u.id ? " wialon-map-sidebar__item--active" : ""}`}
                onClick={() => handleSelectUnit(u)}>
                <span
                  className="wialon-map-sidebar__dot"
                  style={{background: u.speed > 0 ? "#22c55e" : "#6b7280"}}
                />
                <div className="wialon-map-sidebar__info">
                  <span className="wialon-map-sidebar__name">{u.name}</span>
                  <span className="wialon-map-sidebar__meta">
                    {u.speed > 0 ? `${u.speed} km/h` : "Detenido"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Unit Detail Panel */}
      {showDetail && detailUnit && (
        <UnitDetailPanel
          unit={detailUnit}
          onClose={handleCloseDetail}
          onShowTrack={handleShowTrack}
        />
      )}

      {/* Track History Panel */}
      {showTrack && trackUnit && (
        <TrackHistoryPanel
          unit={trackUnit}
          mapInstance={mapInstance.current}
          onClose={handleCloseTrack}
        />
      )}
    </div>
  );
};

export default WialonMap;
