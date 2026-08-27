import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../hooks/useToast";

const QuickPatchForm = ({ unit, eventTypes, onSuccess, onCancel }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const baseUrl = import.meta.env.VITE_BASE_URL;

  const [loading, setLoading] = useState(false);
  const [bitacora, setBitacora] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    frecuencia: 0,
  });

  useEffect(() => {
    if (unit?.bitacora_raw_id) {
      fetchBitacora();
    }
  }, [unit]);

  // Autofill description with event name from Wialon if not already set
  useEffect(() => {
    if (unit?.eventName && !formData.descripcion) {
      setFormData(prev => ({
        ...prev,
        descripcion: `Alerta Wialon: ${unit.eventName}`
      }));
    }
  }, [unit]);

  const fetchBitacora = async () => {
    try {
      const res = await fetch(`${baseUrl}/bitacora/${unit.bitacora_raw_id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setBitacora(data);
      }
    } catch (err) {
      console.error("Error fetching bitacora:", err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre) {
      showToast("Seleccione un tipo de evento", "error");
      return;
    }

    setLoading(true);
    try {
      if (!bitacora) throw new Error("Cargando datos de la bitácora...");

      const transporteMatch = bitacora.transportes.find(
        t => String(t.id) === String(unit.transporte_id) || t.placa === unit.placa
      );

      if (!transporteMatch) {
        throw new Error("No se encontró el transporte en la bitácora");
      }

      const patchData = {
        nombre: formData.nombre,
        descripcion: formData.descripcion,
        registrado_por: `${user.firstName} ${user.lastName}`,
        frecuencia: parseInt(formData.frecuencia) || 0,
        transportes: [transporteMatch],
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

  return (
    <div className="quick-patch-form animate__animated animate__fadeIn">
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label fw-bold small text-muted">TIPO DE EVENTO</label>
          <select
            name="nombre"
            className="form-select border-primary"
            value={formData.nombre}
            onChange={handleChange}
            required
            style={{ borderRadius: "8px" }}
          >
            <option value="">Seleccionar...</option>
            {eventTypes.map((et) => (
              <option key={et._id} value={et.evento}>
                {et.evento}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold small text-muted">DESCRIPCIÓN / COMENTARIO</label>
          <textarea
            name="descripcion"
            className="form-control"
            rows="5"
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="Ingrese detalles del evento..."
            required
            style={{ borderRadius: "8px", resize: "none" }}
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-bold small text-muted">FRECUENCIA (MINUTOS)</label>
          <div className="input-group">
            <span className="input-group-text bg-white"><i className="fa fa-clock text-muted"></i></span>
            <input
              type="number"
              name="frecuencia"
              className="form-control"
              value={formData.frecuencia}
              onChange={handleChange}
              min="0"
              style={{ borderRadius: "0 8px 8px 0" }}
            />
          </div>
          <div className="form-text small">Próximo seguimiento en minutos (0 = sin seguimiento).</div>
        </div>

        <div className="d-grid gap-2 mt-4">
          <button 
            type="submit" 
            className="btn btn-primary fw-bold" 
            disabled={loading}
            style={{ borderRadius: "8px", padding: "10px" }}
          >
            {loading ? (
              <><i className="fa fa-spinner fa-spin me-2"></i>Guardando...</>
            ) : (
              <><i className="fa fa-paper-plane me-2"></i>Registrar en Bitácora</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuickPatchForm;
