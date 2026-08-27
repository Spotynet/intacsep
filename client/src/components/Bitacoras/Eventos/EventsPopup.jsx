import React, {useEffect, useState} from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";

const EventsPopup = ({bitacora, onClose, origenes, destinos}) => {
  const [eventTypes, setEventTypes] = useState([]);
  const baseUrl = import.meta.env.VITE_BASE_URL;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const res = await axios.get(`${baseUrl}/event_types`, {withCredentials: true});
        setEventTypes(res.data);
      } catch (err) {
        console.error("Error fetching event types:", err);
      }
    };
    fetchEventTypes();
  }, []);

  const eventosOrdenados = [...(bitacora.eventos || [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const getSemaforoColor = (evento) => {
    if (evento.nombre === "Cierre de servicio") return "black";
    if (evento.isFrecuenciaMet === true) return "#51FF4E";
    if (evento.isFrecuenciaMet === false) return "#F82929";

    const freqMs = evento.frecuencia * 60000;
    const elapsed = Date.now() - new Date(evento.createdAt).getTime();

    if (elapsed < freqMs * 0.75) return "#51FF4E";
    if (elapsed < freqMs) return "#ECEC27";
    return "#F82929";
  };

  const formatFecha = (date) =>
    new Date(date).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });

  const getCalificacionForEvent = (nombre) => {
    const found = eventTypes.find((et) => et.evento === nombre);
    return found?.calificacion ?? null;
  };

  const calculatePromedioCalificacion = () => {
    const calificaciones = bitacora.eventos
      ?.map((evt) => getCalificacionForEvent(evt.nombre))
      .filter((val) => typeof val === "number");

    if (!calificaciones.length) return "-";
    const sum = calificaciones.reduce((a, b) => a + b, 0);
    const avg = sum / calificaciones.length;
    return parseFloat(avg.toFixed(2)); // returns a number rounded to 2 decimals
  };

  const promedioCalificacion = calculatePromedioCalificacion();

  const exportToPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    const formattedNow = now.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    const title = `Tracking Monitoreo - Bitácora ${bitacora.bitacora_id}`;
    const pageWidth = doc.internal.pageSize.getWidth();
    const textWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - textWidth) / 2, 20);

    doc.setFontSize(12);
    const leftCol = [
      ["Folio Servicio:", bitacora.folio_servicio],
      ["No. Bitácora:", bitacora.bitacora_id],
      ["Cliente:", bitacora.cliente],
      ["Estatus:", bitacora.status],
      ["Fecha Consulta:", formatFecha(now)],
    ];

    const rightCol = [
      ["Tipo Monitoreo:", bitacora.monitoreo],
      ["Origen:", bitacora.origen || "No especificado"],
      ["Destino:", bitacora.destino || "No especificado"],
      ["Calificación: ", promedioCalificacion],
    ];

    const startY = 30;
    const lineHeight = 8;
    const leftX = 14;
    const rightX = pageWidth / 2 + 5;

    leftCol.forEach(([label, value], i) => {
      const y = startY + i * lineHeight;
      doc.setFont("helvetica", "bold");
      doc.text(label, leftX, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(value), leftX + doc.getTextWidth(label) + 2, y);
    });

    rightCol.forEach(([label, value], i) => {
      const y = startY + i * lineHeight;
      doc.setFont("helvetica", "bold");
      doc.text(label, rightX, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(value), rightX + doc.getTextWidth(label) + 2, y);
    });

    const tableStartY = startY + Math.max(leftCol.length, rightCol.length) * lineHeight + 10;

    doc.autoTable({
      startY: tableStartY,
      head: [["Semáforo", "Evento", "Frecuencia", "Transporte", "Fecha/Hora", "Calificación"]],
      body: eventosOrdenados.map((evt) => [
        "",
        evt.nombre,
        evt.frecuencia ? `${evt.frecuencia} min` : "-",
        evt.transportes
          ?.map((t) => {
            const parts = t.id.split("_");
            return parts.length >= 3 ? `${parts[1]} - ${parts[2]}` : t.id;
          })
          .join(" | ") || "-",
        formatFecha(evt.createdAt),
        getCalificacionForEvent(evt.nombre) ?? "-",
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 3,
        valign: "middle",
      },
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {fillColor: [245, 245, 245]},
      margin: {top: 10, left: 14, right: 14},
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.1,

      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const evt = eventosOrdenados[data.row.index];
          const color = getSemaforoColor(evt);
          const x = data.cell.x + data.cell.width / 2;
          const y = data.cell.y + data.cell.height / 2;
          doc.setFillColor(color);
          doc.circle(x, y, 3, "F");
        }
      },
    });

    doc.save(`bitacora_${bitacora.bitacora_id}_eventos_${formattedNow.replace(/\//g, "-")}.pdf`);
  };

  return (
    <div className="frecuencia-popup-backdrop" onClick={onClose}>
      <div className="frecuencia-popup-content" onClick={(e) => e.stopPropagation()}>
        <div className="frecuencia-popup-header">
          <h3>Tracking de Monitoreo</h3>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="info-grid">
          <div>
            <strong>Folio Servicio:</strong> {bitacora.folio_servicio}
          </div>
          <div>
            <strong>Tipo Monitoreo:</strong> {bitacora.monitoreo}
          </div>
          <div>
            <strong>No. Bitácora:</strong> {bitacora.bitacora_id}
          </div>
          <div>
            <strong>Origen:</strong> {bitacora.origen || "No especificado"}
          </div>
          <div>
            <strong>Cliente:</strong> {bitacora.cliente}
          </div>
          <div>
            <strong>Destino:</strong> {bitacora.destino || "No especificado"}
          </div>
          <div>
            <strong>Estatus:</strong> {bitacora.status}
          </div>
          <div>
            <strong>Calificación Promedio:</strong> <span>{promedioCalificacion}</span>
          </div>
          <div>
            <strong>Creado:</strong> {formatFecha(bitacora.createdAt)}
          </div>
          <div>
            <strong>Fecha Consulta:</strong> {formatFecha(new Date())}
          </div>
        </div>

        <table className="eventos-table mt-3">
          <thead>
            <tr>
              <th>Semáforo</th>
              <th>Frecuencia</th>
              <th>Evento</th>
              <th>Transporte</th>
              <th>Fecha/Hora</th>
              <th>Calificación</th>
            </tr>
          </thead>
          <tbody>
            {eventosOrdenados.map((evt, idx) => {
              const calificacion = getCalificacionForEvent(evt.nombre);
              return (
                <tr key={idx}>
                  <td>
                    <span
                      className="circle"
                      style={{
                        backgroundColor: getSemaforoColor(evt),
                      }}></span>
                  </td>
                  <td>{evt.frecuencia ? `${evt.frecuencia} min` : "-"}</td>
                  <td>{evt.nombre}</td>
                  <td>
                    {evt.transportes
                      ?.map((t) => {
                        const parts = t.id.split("_");
                        const label = parts.length >= 3 ? `${parts[1]} - ${parts[2]}` : t.id;
                        return label;
                      })
                      .join(" | ") || "-"}
                  </td>
                  <td>{formatFecha(evt.createdAt)}</td>
                  <td>{calificacion ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="frecuencia-popup-footer">
          <button className="btn btn-sm btn-primary" onClick={exportToPDF}>
            <i className="fa fa-download me-1"></i> Exportar PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventsPopup;
