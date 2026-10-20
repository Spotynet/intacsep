import {useState} from "react";

const fmt = (id) => String(id || "").padStart(4, "0");

const InfoRow = ({label, value}) =>
  value ? (
    <div className="cl-card__info-row">
      <span className="cl-card__info-label">{label}</span>
      <span className="cl-card__info-value">{value}</span>
    </div>
  ) : null;

const ClientCard = ({client, roleData, onEdit, onDelete}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const contactName = [client.contacto?.nombres, client.contacto?.apellidos]
    .filter(Boolean).join(" ") || null;

  return (
    <div className={`cl-card${isExpanded ? " cl-card--open" : ""}`}>
      {/* ── Header (always visible, clickable) ── */}
      <div className="cl-card__header" onClick={() => setIsExpanded((v) => !v)}>
        <div className="cl-card__header-left">
          <span className="cl-card__id">#{fmt(client.ID_Cliente)}</span>
          <div className="cl-card__title-block">
            <span className="cl-card__name">{client.razon_social || "—"}</span>
            {client.RFC && <span className="cl-card__rfc">{client.RFC}</span>}
          </div>
        </div>
        <div className="cl-card__header-right" onClick={(e) => e.stopPropagation()}>
          {contactName && (
            <span className="cl-card__contact-chip">
              <i className="fa fa-user"></i>
              {contactName}
            </span>
          )}
          {client.ciudad && (
            <span className="cl-card__contact-chip">
              <i className="fa fa-map-marker-alt"></i>
              {client.ciudad}
            </span>
          )}
          <div className="cl-card__actions" onClick={(e) => e.stopPropagation()}>
            {roleData?.clientes?.update && (
              <button className="action-btn btn-primary" title="Editar"
                onClick={(e) => { e.stopPropagation(); onEdit(client); }}>
                <i className="fas fa-edit"></i>
              </button>
            )}
            {roleData?.clientes?.delete && (
              <button className="action-btn btn-danger" title="Eliminar"
                onClick={(e) => { e.stopPropagation(); onDelete(client); }}>
                <i className="fas fa-trash"></i>
              </button>
            )}
          </div>
          <button className="cl-card__chevron" tabIndex={-1}
            onClick={() => setIsExpanded((v) => !v)}>
            <i className={`fa fa-chevron-${isExpanded ? "up" : "down"}`}></i>
          </button>
        </div>
      </div>

      {/* ── Expandable body ── */}
      <div className={`cl-card__body${isExpanded ? " cl-card__body--open" : ""}`}>
        <div className="cl-card__sections">
          <div className="cl-card__section">
            <p className="cl-card__section-title">Información General</p>
            <div className="cl-card__info-grid">
              <InfoRow label="Razón Social" value={client.razon_social} />
              <InfoRow label="RFC" value={client.RFC} />
              <InfoRow label="Calle" value={client.calle} />
              <InfoRow label="Núm. Ext." value={client.num_ext} />
              <InfoRow label="Núm. Int." value={client.num_int} />
              <InfoRow label="Colonia" value={client.colonia} />
              <InfoRow label="Alcaldía" value={client.alcaldia} />
              <InfoRow label="Ciudad" value={client.ciudad} />
              <InfoRow label="Código Postal" value={client.codigo_postal} />
              <InfoRow label="Clave País" value={client.clave_pais} />
            </div>
          </div>
          <div className="cl-card__section">
            <p className="cl-card__section-title">Contacto</p>
            <div className="cl-card__info-grid">
              <InfoRow label="Nombre" value={contactName} />
              <InfoRow label="Email" value={client.contacto?.email} />
              <InfoRow label="Teléfono" value={client.contacto?.telefono} />
              <InfoRow label="País" value={client.contacto?.pais} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientCard;
