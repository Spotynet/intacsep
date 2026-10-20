import {useState, useCallback, useRef} from "react";
import L from "leaflet";
import {useWialon} from "../../context/WialonProvider";

const fmtTime = (ts) => {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("es-MX", {dateStyle: "short", timeStyle: "short"});
};

const TrackHistoryPanel = ({unit, mapInstance, onClose}) => {
  const {session} = useWialon();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [loading, setLoading] = useState(false);
  const [trackInfo, setTrackInfo] = useState(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const trackLayerRef = useRef(null);
  const replayTimerRef = useRef(null);
  const replayMarkerRef = useRef(null);

  const loadTrack = useCallback(() => {
    if (!unit || !mapInstance || !session) return;

    const renderer = session.getRenderer();
    const layerName = `track_unit_${unit.getId()}_${Date.now()}`;

    const fromTs = Math.floor(new Date(fromDate).getTime() / 1000);
    const toTs = Math.floor(new Date(toDate).getTime() / 1000);

    if (toTs <= fromTs) return;

    setLoading(true);

    const params = {
      layerName,
      itemId: unit.getId(),
      timeFrom: fromTs,
      timeTo: toTs,
      tripDetector: 0,
      trackColor: "406366f1",
      trackWidth: 4,
      arrows: 1,
      points: 1,
      pointColor: "ff6366f1",
      annotations: 0,
    };

    renderer.createMessagesLayer(params, (code, layer) => {
      setLoading(false);
      if (code || !layer) return;

      // Remove old track layer
      if (trackLayerRef.current) {
        renderer.removeLayer(trackLayerRef.current, () => {});
        trackLayerRef.current = null;
      }

      trackLayerRef.current = layer;

      // Get bounds and fit
      const bounds = layer.getBounds();
      if (bounds && bounds.length === 4 && (bounds[0] || bounds[1] || bounds[2] || bounds[3])) {
        mapInstance.fitBounds(
          L.latLngBounds(L.latLng(bounds[0], bounds[1]), L.latLng(bounds[2], bounds[3])),
          {padding: [40, 40]}
        );
      }

      // Get messages for replay via server proxy
      const token = localStorage.getItem("wialonToken");
      const baseUrl = import.meta.env.VITE_BASE_URL;
      if (!token || !baseUrl) return;

      fetch(`${baseUrl}/wialon/proxy`, {
        method: "POST",
        headers: {"Content-Type": "application/json", "x-wialon-token": token},
        body: JSON.stringify({
          svc: "render/get_messages",
          params: {
            layerName,
            indexFrom: 0,
            indexTo: 1000,
            unitId: unit.getId(),
            calcSensors: "0",
          },
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error || !data.length) return;
          setTrackInfo({
            layer,
            layerName,
            messages: data,
            mileage: layer.getMileage?.() ?? 0,
            count: data.length,
          });
          setReplayIndex(0);
        })
        .catch(() => {});
    });
  }, [unit, mapInstance, fromDate, toDate]);

  const clearTrack = useCallback(() => {
    if (!session) return;
    const renderer = session.getRenderer();

    if (trackLayerRef.current) {
      renderer.removeLayer(trackLayerRef.current, () => {});
      trackLayerRef.current = null;
    }
    if (replayMarkerRef.current) {
      mapInstance?.removeLayer(replayMarkerRef.current);
      replayMarkerRef.current = null;
    }
    if (replayTimerRef.current) {
      clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setTrackInfo(null);
    setReplayIndex(0);
    setReplayPlaying(false);
  }, [mapInstance]);

  const startReplay = useCallback(() => {
    if (!trackInfo?.messages?.length || !mapInstance) return;

    setReplayPlaying(true);
    let idx = replayIndex;

    // Create replay marker
    if (!replayMarkerRef.current) {
      const icon = L.divIcon({
        className: "wialon-replay-marker",
        html: `<div style="
          width:16px;height:16px;border-radius:50%;
          background:#6366f1;border:3px solid #fff;
          box-shadow:0 0 12px rgba(99,102,241,0.6);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      replayMarkerRef.current = L.marker([0, 0], {icon}).addTo(mapInstance);
    }

    const msgs = trackInfo.messages;
    replayTimerRef.current = setInterval(() => {
      if (idx >= msgs.length) {
        clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
        setReplayPlaying(false);
        return;
      }

      const m = msgs[idx];
      const lat = m.y ?? m.pos?.y;
      const lng = m.x ?? m.pos?.x;
      if (lat && lng) {
        replayMarkerRef.current.setLatLng([lat, lng]);
        mapInstance.panTo([lat, lng]);
      }
      setReplayIndex(idx);
      idx++;
    }, 300);
  }, [trackInfo, mapInstance, replayIndex]);

  const stopReplay = useCallback(() => {
    if (replayTimerRef.current) {
      clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setReplayPlaying(false);
  }, []);

  const scrubReplay = useCallback(
    (idx) => {
      if (!trackInfo?.messages?.length || !mapInstance) return;
      const m = trackInfo.messages[idx];
      const lat = m.y ?? m.pos?.y;
      const lng = m.x ?? m.pos?.x;
      if (lat && lng) {
        if (replayMarkerRef.current) {
          replayMarkerRef.current.setLatLng([lat, lng]);
        }
        mapInstance.setView([lat, lng]);
      }
      setReplayIndex(idx);
    },
    [trackInfo, mapInstance]
  );

  if (!unit) return null;

  return (
    <div className="track-panel">
      <div className="track-panel__header">
        <div className="track-panel__title">
          <i className="fa fa-route"></i> Historial — {unit.getName()}
        </div>
        <button
          className="track-panel__btn"
          onClick={() => {
            clearTrack();
            onClose();
          }}>
          <i className="fa fa-times"></i>
        </button>
      </div>

      <div className="track-panel__body">
        <div className="track-panel__dates">
          <div className="track-panel__field">
            <label>Desde</label>
            <input
              type="datetime-local"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="track-panel__field">
            <label>Hasta</label>
            <input
              type="datetime-local"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <button
            className="track-panel__load-btn"
            onClick={loadTrack}
            disabled={loading}>
            {loading ? <i className="fa fa-spinner fa-spin"></i> : <i className="fa fa-search"></i>}
          </button>
          {trackInfo && (
            <button className="track-panel__clear-btn" onClick={clearTrack}>
              <i className="fa fa-trash"></i>
            </button>
          )}
        </div>

        {trackInfo && (
          <div className="track-panel__info">
            <div className="track-panel__stats">
              <span>
                <i className="fa fa-map-pin"></i> {trackInfo.count} puntos
              </span>
              <span>
                <i className="fa fa-road"></i>{" "}
                {trackInfo.mileage ? `${(trackInfo.mileage / 1000).toFixed(1)} km` : "—"}
              </span>
              <span>
                <i className="fa fa-clock"></i>{" "}
                {fmtTime(trackInfo.messages[0]?.t)} —{" "}
                {fmtTime(trackInfo.messages[trackInfo.messages.length - 1]?.t)}
              </span>
            </div>

            <div className="track-panel__replay">
              <button
                className="track-panel__play-btn"
                onClick={replayPlaying ? stopReplay : startReplay}>
                <i className={`fa fa-${replayPlaying ? "pause" : "play"}`}></i>
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(0, trackInfo.messages.length - 1)}
                value={replayIndex}
                onChange={(e) => scrubReplay(Number(e.target.value))}
                className="track-panel__scrubber"
              />
              <span className="track-panel__idx">
                {replayIndex + 1}/{trackInfo.count}
              </span>
            </div>

            {trackInfo.messages[replayIndex] && (
              <div className="track-panel__current">
                <span>{fmtTime(trackInfo.messages[replayIndex]?.t)}</span>
                <span>
                  Vel: {trackInfo.messages[replayIndex]?.s ?? trackInfo.messages[replayIndex]?.pos?.s ?? 0} km/h
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackHistoryPanel;
