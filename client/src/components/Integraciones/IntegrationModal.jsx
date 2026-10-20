import React, { useState, useEffect } from "react";
import ModalTemplate from "../ModalTemplate";
import { fetchClients, upsertVehicleMappings, fetchVehicleMappings, testInbound, flushWialon } from "../../utils/api";

const PAYLOAD_EXAMPLE = {
  ident: "123456789012345",
  position: {
    hdop: 10,
    speed: 10,
    altitude: 10.0,
    latitude: 10.0,
    direction: 10,
    longitude: 10.0,
    satellites: 10,
  },
};

const buildCurl = (url, token) =>
  `curl -X POST "${url}" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(PAYLOAD_EXAMPLE, null, 0)}'`;

const IntegrationModal = ({ show, onClose, onSubmit, integration, editing }) => {
  const [formData, setFormData] = useState({
    name: "",
    type: "inbound-rest",
    provider: "generic-rest",
    apiKey: "",
    clientId: "",
    status: "active",
  });

  const [vehicles, setVehicles] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activating, setActivar] = useState(false);
  const [scanning, setScanning] = useState({});
  const [wialonUnits, setWialonUnits] = useState([]);
  const [loadingWialonUnits, setLoadingWialonUnits] = useState(false);
  const [syncingStatus, setSyncingStatus] = useState(false);

  const handleScanPlate = async (index, file) => {
    if (!file) return;
    setScanning(prev => ({ ...prev, [index]: true }));
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`${baseUrl}/plates/test-scan`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && data.plate) {
        handleVehicleChange(index, "placa", data.plate.toUpperCase());
      } else {
        alert("No se pudo detectar la placa: " + (data.message || ""));
      }
    } catch (e) {
      alert("Error en el escaneo: " + e.message);
    } finally {
      setScanning(prev => ({ ...prev, [index]: false }));
    }
  };

  const createdIntegration = useState(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [flushLoading, setFlushLoading] = useState(false);
  const [testIdent, setTestIdent] = useState("");
  const [wialonStatus, setWialonStatus] = useState(null);

  const baseUrl = import.meta.env.VITE_BASE_URL;

  useEffect(() => {
    if (show) {
      loadClients();
      setCreatedIntegration(null);
      setCopyFeedback("");
      setTestResult(null);
      setTestIdent("");
      setWialonStatus(null);
      if (editing && integration) {
        setFormData({
          name: integration.name || "",
          type: integration.type || "inbound-rest",
          provider: integration.provider || "generic-rest",
          apiKey: integration.apiKey || "",
          clientId: integration.clientId?._id || integration.clientId || "",
          status: integration.status || "active",
        });
        loadVehicles(integration._id);
        fetchWialonStatus(integration._id);
        fetchWialonUnits(integration._id);
      } else {
        setFormData({
          name: "",
          type: "inbound-rest",
          provider: "generic-rest",
          apiKey: "",
          clientId: "",
          status: "active",
        });
        setVehicles([]);
      }
    }
  }, [show, editing, integration]);

  const fetchWialonStatus = async (id) => {
    try {
      const res = await fetch(`${baseUrl}/integrations/${id}/wialon-status`, { credentials: "include" });
      if (res.ok) setWialonStatus(await res.json());
    } catch (e) {
      console.error("Error fetching Wialon status:", e);
    }
  };

  const fetchWialonUnits = async (id) => {
    try {
      setLoadingWialonUnits(true);
      const res = await fetch(`${baseUrl}/integrations/${id}/wialon-units`, { credentials: "include" });
      if (res.ok) setWialonUnits(await res.json());
    } catch (e) {
      console.error("Error fetching Wialon units:", e);
    } finally {
      setLoadingWialonUnits(false);
    }
  };

  const handleSyncStatus = async () => {
    if (!editing || !integration?._id) return;
    try {
      setSyncingStatus(true);
      const res = await fetch(`${baseUrl}/integrations/${integration._id}/sync-status`, {
        method: "POST",
        credentials: "include"
      });
      const data = await res.json();
      if (data.success) {
        alert(`Sincronización completada. Se actualizaron ${data.updated} vehículos.`);
        loadVehicles(integration._id);
      }
    } catch (e) {
      console.error("Error syncing status:", e);
    } finally {
      setSyncingStatus(false);
    }
  };

  const loadClients = async () => {
    try {
      const data = await fetchClients();
      setClients(data);
    } catch (e) {
      console.error("Error loading clients:", e);
    }
  };

  const loadVehicles = async (id) => {
    try {
      setLoading(true);
      const data = await fetchVehicleMappings(id);
      setVehicles(data);
    } catch (e) {
      console.error("Error loading vehicles:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleVehicleChange = (index, field, value) => {
    const updatedVehicles = [...vehicles];
    updatedVehicles[index] = { ...updatedVehicles[index], [field]: value };
    setVehicles(updatedVehicles);
  };

  const addVehicleRow = () => {
    setVehicles([...vehicles, { imei: "", economico: "", placa: "", providerIdent: "", status: "pending" }]);
  };

  const removeVehicleRow = (index) => {
    setVehicles(vehicles.filter((_, i) => i !== index));
  };

  const handleSaveAll = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const savedIntegration = await onSubmit(formData);

      const integrationId = editing ? integration._id : savedIntegration._id;
      if (integrationId && vehicles.length > 0) {
        await upsertVehicleMappings(integrationId, vehicles);
      }

      // For new inbound-rest integrations, show generated credentials.
      // The inboundToken is only ever returned on this create response, so this
      // is the user's one chance to copy/share it from the UI.
      if (!editing && savedIntegration?.type === "inbound-rest" && savedIntegration?.inboundToken) {
        setCreatedIntegration(savedIntegration);
      } else {
        onClose();
      }
    } catch (e) {
      console.error("Error saving integration:", e);
      alert("Error al guardar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateWialon = async () => {
    if (!editing || !integration?._id) return;
    try {
      setActivar(true);
      const response = await fetch(`${baseUrl}/integrations/${integration._id}/activate-wialon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const result = await response.json();
      alert(result.success ? "Activación completada" : "Error en activación");
      loadVehicles(integration._id);
    } catch (e) {
      console.error("Error activating units:", e);
      alert("Error: " + e.message);
    } finally {
      setActivar(false);
    }
  };

  const handleTestInbound = async () => {
    if (!editing || !integration?._id) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const body = testIdent ? { ident: testIdent } : {};
      const result = await testInbound(integration._id, body);
      setTestResult(result);
      loadVehicles(integration._id);
      fetchWialonStatus(integration._id);
    } catch (e) {
      console.error("Error testing inbound:", e);
      setTestResult({ status: "ERROR", reason: [e.message] });
    } finally {
      setTestLoading(false);
    }
  };

  const handleFlushWialon = async () => {
    if (!editing || !integration?._id) return;
    setFlushLoading(true);
    try {
      const result = await flushWialon(integration._id);
      const summary = `Pushed: ${result.pushed ?? 0} · Failed: ${result.failed ?? 0} · Skipped: ${result.skipped ?? 0}`;
      alert(`Envío a Wialon completado.\n${summary}`);
      fetchWialonStatus(integration._id);
    } catch (e) {
      console.error("Error flushing to Wialon:", e);
      alert("Error: " + e.message);
    } finally {
      setFlushLoading(false);
    }
  };

  // Build inbound URL with priority: backend-derived URL > inboundKey + baseUrl > placeholder.
  const getInboundUrl = (src) => {
    const obj = src || integration;
    if (obj?.derivedInboundUrl) return obj.derivedInboundUrl;
    if (!obj?.inboundKey) return "Se generará al guardar";
    return `${baseUrl.replace(/\/api\/?$/, "")}/inbound/${obj.inboundKey}`;
  };

  const copyToClipboard = async (text, feedback = "Copiado") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(feedback);
      setTimeout(() => setCopyFeedback(""), 1800);
    } catch (e) {
      console.error("Clipboard error:", e);
      alert("No se pudo copiar al portapapeles. Copia manualmente.");
    }
  };

  // ----- Success view: shown after creating a new inbound-rest integration -----
  if (createdIntegration) {
    const url = getInboundUrl(createdIntegration);
    const token = createdIntegration.inboundToken;
    const curl = buildCurl(url, token);

    return (
      <ModalTemplate
        show={show}
        title="Integración creada"
        onClose={onClose}
        onSubmit={(e) => { e.preventDefault(); onClose(); }}
        hideFooter
        size="lg"
      >
        <div className="alert alert-success py-2">
          <i className="fas fa-check-circle me-2"></i>
          La integración <strong>{createdIntegration.name}</strong> se creó correctamente.
          Guarda estos datos: el <strong>token secreto solo se mostrará ahora</strong>.
        </div>

        <div className="bg-light p-3 rounded mb-3 border">
          <h6 className="mb-3">Configuración para el Proveedor</h6>

          <div className="mb-3">
            <small className="text-muted d-block mb-1">Inbound URL</small>
            <div className="d-flex gap-2 align-items-center">
              <code className="flex-grow-1 user-select-all p-2 bg-white border rounded">{url}</code>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => copyToClipboard(url, "URL copiada")}>
                <i className="fas fa-copy"></i>
              </button>
            </div>
          </div>

          <div className="mb-3">
            <small className="text-muted d-block mb-1">Authorization header</small>
            <div className="d-flex gap-2 align-items-center">
              <code className="flex-grow-1 user-select-all p-2 bg-white border rounded">Bearer {token}</code>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => copyToClipboard(`Bearer ${token}`, "Header copiado")}>
                <i className="fas fa-copy"></i>
              </button>
            </div>
          </div>

          <div className="mb-3">
            <small className="text-muted d-block mb-1">Payload esperado (JSON)</small>
            <pre className="bg-white border rounded p-2 mb-0" style={{ fontSize: "0.8rem" }}>
{`{
  "ident": "<id-del-dispositivo>",
  "position": {
    "hdop": <int 0-25>,
    "speed": <int km/h>,
    "altitude": <float m>,
    "latitude": <float decimal>,
    "direction": <int grados>,
    "longitude": <float decimal>,
    "satellites": <int>
  }
}`}
            </pre>
          </div>

          <div>
            <small className="text-muted d-block mb-1">Ejemplo de prueba (curl)</small>
            <pre className="bg-white border rounded p-2 mb-2" style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>{curl}</pre>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => copyToClipboard(curl, "Curl copiado")}>
              <i className="fas fa-copy me-1"></i> Copiar ejemplo de curl
            </button>
            {copyFeedback && <span className="ms-2 text-success small">{copyFeedback}</span>}
          </div>
        </div>

        <div className="d-flex justify-content-end">
          <button type="button" className="btn btn-success" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </ModalTemplate>
    );
  }

  // ----- Default view: create / edit form -----
  const inboundUrl = getInboundUrl();
  const inboundCurl = (formData.type === "inbound-rest" && editing && integration?.inboundToken)
    ? buildCurl(inboundUrl, integration.inboundToken)
    : null;

  return (
    <ModalTemplate
      show={show}
      title={editing ? "Gestionar Integración" : "Nueva Integración"}
      onClose={onClose}
      onSubmit={handleSaveAll}
      size="lg"
    >
      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor="name" className="form-label">Nombre de la Integración</label>
          <input type="text" className="form-control" id="name" value={formData.name} onChange={handleChange} required />
        </div>
        <div className="col-md-6 mb-3">
          <label htmlFor="type" className="form-label">Tipo de Integración</label>
          <select id="type" className="form-select" value={formData.type} onChange={handleChange} required>
            <option value="inbound-rest">Inbound REST (Webhook)</option>
            <option value="direct-api">API Directo (Pull)</option>
          </select>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor="provider" className="form-label">Proveedor</label>
          <select id="provider" className="form-select" value={formData.provider} onChange={handleChange} required>
            <option value="generic-rest">Generic REST</option>
            <option value="samsara">Samsara</option>
          </select>
        </div>
        <div className="col-md-6 mb-3">
          <label htmlFor="clientId" className="form-label">Cliente Asociado</label>
          <select id="clientId" className="form-select" value={formData.clientId} onChange={handleChange}>
            <option value="">Seleccione un cliente</option>
            {clients.map((c) => (
              <option key={c._id} value={c._id}>{c.razon_social || c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor="status" className="form-label">Estado</label>
          <select id="status" className="form-select" value={formData.status} onChange={handleChange} required>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
        {(formData.type === "direct-samsara" || formData.type === "direct-api") && (
          <div className="col-md-6 mb-3">
            <label htmlFor="apiKey" className="form-label">API Key / Token Proveedor</label>
            <input type="password" className="form-control" id="apiKey" value={formData.apiKey} onChange={handleChange} required />
          </div>
        )}
      </div>

      {formData.type === "inbound-rest" && !editing && (
        <div className="alert alert-info py-2 small mb-3">
          <i className="fas fa-info-circle me-1"></i>
          La <strong>URL inbound</strong> y el <strong>token Bearer</strong> se generan automáticamente al guardar.
          El token se mostrará una sola vez al crear la integración.
        </div>
      )}

      {formData.type === "inbound-rest" && editing && (
        <div className="bg-light p-3 rounded mb-3 border">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="m-0">Configuración para el Proveedor</h6>
            {inboundCurl && (
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => copyToClipboard(inboundCurl, "Curl copiado")}
              >
                <i className="fas fa-copy me-1"></i> Copiar ejemplo de curl
              </button>
            )}
          </div>

          <div className="mb-2">
            <small className="text-muted d-block">Inbound URL:</small>
            <code className="user-select-all">{inboundUrl}</code>
          </div>
          <div className="mb-2">
            <small className="text-muted d-block">Secret Token (Bearer):</small>
            <code className="user-select-all">{integration.inboundToken || "N/A"}</code>
          </div>
          <div>
            <small className="text-muted d-block">Payload esperado:</small>
            <code className="user-select-all small">
              {`{ ident: string, position: { hdop, speed, altitude, latitude, direction, longitude, satellites } }`}
            </code>
          </div>
          {copyFeedback && <div className="mt-2 small text-success">{copyFeedback}</div>}

          <hr className="my-3" />

          <div>
            <small className="text-muted d-block mb-1">Probar inbound (no requiere Postman)</small>
            <div className="d-flex gap-2 align-items-center mb-3">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="ident (opcional, usa TEST-IDENT por defecto)"
                value={testIdent}
                onChange={(e) => setTestIdent(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-info btn-sm text-white"
                onClick={handleTestInbound}
                disabled={testLoading}
              >
                <i className="fas fa-paper-plane me-1"></i>
                {testLoading ? "Enviando..." : "Probar inbound"}
              </button>
              <button
                type="button"
                className="btn btn-warning btn-sm"
                onClick={handleFlushWialon}
                disabled={flushLoading}
                title="Empuja mensajes pendientes a Wialon ahora"
              >
                <i className="fas fa-cloud-upload-alt me-1"></i>
                {flushLoading ? "Enviando..." : "Forzar envío"}
              </button>
            </div>

            {wialonStatus && (
              <div className="d-flex gap-3 mb-3 p-2 bg-white border rounded small">
                <div className="text-center">
                  <div className="fw-bold text-primary">{wialonStatus.pending}</div>
                  <div className="text-muted" style={{fontSize: '0.7rem'}}>Pendientes</div>
                </div>
                <div className="text-center">
                  <div className="fw-bold text-success">{wialonStatus.pushed}</div>
                  <div className="text-muted" style={{fontSize: '0.7rem'}}>Enviados</div>
                </div>
                <div className="text-center">
                  <div className="fw-bold text-danger">{wialonStatus.failed}</div>
                  <div className="text-muted" style={{fontSize: '0.7rem'}}>Fallidos</div>
                </div>
                {wialonStatus.failed > 0 && wialonStatus.details?.find(d => d._id === 'failed')?.lastError && (
                  <div className="ms-auto text-danger" title={wialonStatus.details.find(d => d._id === 'failed').lastError}>
                    <i className="fas fa-exclamation-triangle"></i>
                  </div>
                )}
              </div>
            )}

            {testResult && (
              <pre
                className={`mt-2 mb-0 p-2 border rounded ${testResult.status === "OK" ? "bg-success-subtle" : "bg-danger-subtle"}`}
                style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap" }}
              >
                {JSON.stringify(testResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      <hr />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="m-0">Mapeo de Vehículos</h5>
        <div className="d-flex align-items-center gap-3">
          {editing && wialonUnits.length > 0 && (
            <div className="d-flex align-items-center gap-2 text-muted small">
              <i className="fas fa-sync-alt"></i>
              <span>Wialon: <strong>{wialonUnits.length}</strong></span>
              <button 
                type="button" 
                className="btn btn-link btn-sm p-0 text-decoration-none" 
                onClick={handleSyncStatus}
                disabled={syncingStatus}
                title="Sincronizar estados con Wialon"
              >
                {syncingStatus ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync-alt"></i>}
              </button>
            </div>
          )}
          {editing && (
            <button 
              type="button" 
              className="btn btn-primary btn-sm" 
              onClick={handleActivateWialon}
              disabled={activating || loading}
            >
              {activating ? "Activando..." : "Activar en Wialon"}
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={addVehicleRow}>
            <i className="fas fa-plus"></i> Añadir Fila
          </button>
        </div>
      </div>

      <div className="table-responsive" style={{ maxHeight: "300px" }}>
        <table className="table table-sm table-bordered align-middle">
          <thead className="table-light sticky-top">
            <tr className="text-center">
              <th>IMEI</th>
              <th>Económico</th>
              <th>Placa</th>
              <th>Ident Proveedor</th>
              <th>Estado</th>
              <th>Último inbound</th>
              <th style={{ width: "40px" }}></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v, index) => (
              <tr key={index}>
                <td><input type="text" className="form-control form-control-sm" value={v.imei} onChange={(e) => handleVehicleChange(index, "imei", e.target.value)} required /></td>
                <td><input type="text" className="form-control form-control-sm" value={v.economico} onChange={(e) => handleVehicleChange(index, "economico", e.target.value)} required /></td>
                <td>
                  <div className="input-group input-group-sm">
                    <input 
                      type="text" 
                      className="form-control" 
                      value={v.placa} 
                      onChange={(e) => handleVehicleChange(index, "placa", e.target.value)} 
                      required 
                    />
                    <label className="btn btn-outline-secondary" title="Escanear Placa">
                      <i className={`fas ${scanning[index] ? 'fa-spinner fa-spin' : 'fa-camera'}`}></i>
                      <input type="file" hidden accept="image/*" onChange={(e) => handleScanPlate(index, e.target.files[0])} />
                    </label>
                  </div>
                </td>
                <td><input type="text" className="form-control form-control-sm" value={v.providerIdent} onChange={(e) => handleVehicleChange(index, "providerIdent", e.target.value)} placeholder="Opcional" /></td>
                <td className="text-center">
                  <span className={`badge ${
                    v.status === 'linkedToWialon' ? 'bg-success' : 
                    v.status === 'receiving' ? 'bg-info' : 
                    v.status === 'error' ? 'bg-danger' : 'bg-warning text-dark'
                  }`}>
                    {v.status === 'linkedToWialon' ? 'En Wialon' : 
                     v.status === 'receiving' ? 'Recibiendo' : 
                     v.status === 'error' ? 'Error' : 'Pendiente'}
                  </span>
                </td>
                <td className="text-center small">
                  {v.lastInboundAt
                    ? new Date(v.lastInboundAt).toLocaleString()
                    : <span className="text-muted">—</span>}
                </td>
                <td>
                  <button type="button" className="btn btn-link text-danger p-0" onClick={() => removeVehicleRow(index)}>
                    <i className="fas fa-times"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {loading && <div className="text-center mt-2"><div className="spinner-border spinner-border-sm" role="status"></div></div>}
    </ModalTemplate>
  );
};

export default IntegrationModal;
