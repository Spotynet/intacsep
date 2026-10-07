import mongoose from "mongoose";

const TransporteSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    internalId: { type: String, default: () => new mongoose.Types.ObjectId().toString(), index: true },
    remolque: {
      eco: String,
      placa: String,
      color: String,
      capacidad: String,
      sello: String,
    },
    tracto: {
      eco: String,
      placa: String,
      marca: String,
      modelo: String,
      color: String,
      tipo: String,
    },
    lineaTransporte: String,
    operador: String,
    telefono: String,
    inicioMonitoreo: { type: Date },
    finalMonitoreo: { type: Date },
    gpsUnits: [{
      wialonId: { type: String, required: true },
      name: { type: String },
    }],
    gpsData: [{
      wialonId: { type: String },
      name: { type: String },
      data: { type: Object }
    }],
    // Wialon notifications selected for this transporte (applied on creation)
    notificaciones: [{
      resourceId: { type: Number, required: true },
      notifId: { type: Number, required: true },
      name: { type: String, default: "" },
      triggerType: { type: String, default: "" },
      kind: { type: String, enum: ["vinculada", "canonica"], default: "vinculada" },
      appliedAt: { type: Date, default: Date.now },
    }],
    registro: {
      ubicacion: { type: String, default: "" },
      ultimo_posicionamiento: { type: String, default: "" },
      duracion: { type: String, default: "" },
      velocidad: { type: String, default: "" },
      coordenadas: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

const EventoSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    descripcion: { type: String, default: "" },
    registrado_por: { type: String, default: "Nombre Usuario" },
    frecuencia: { type: Number, default: 0 },
    isFrecuenciaMet: { type: Boolean, default: null },
    transportes: [TransporteSchema],
    // Structured extra data (used by "Plan de embarque" evento and similar)
    metadata: { type: Object, default: null },
    // Wialon auto-event linkage (Alertas tab Registrado match)
    wialonTriggeredAt: { type: Number, default: null },
    wialonResourceId: { type: Number, default: null },
    wialonNotifId: { type: Number, default: null },
    wialonUnitId: { type: String, default: null },
  },
  { timestamps: true }
);

const BitSchema = new mongoose.Schema(
  {
    bitacora_id: { type: String, required: true, unique: true },

    // ── Fields required for a full bitacora ──────────────────────
    // Made optional so a "plan de embarque" bitacora can be created
    // with partial data; remaining fields are filled by the next user.
    folio_servicio:  { type: String, default: "" },
    linea_transporte:{ type: String, default: "" },
    monitoreo:       { type: String, default: "" },
    enlace:          { type: String, default: "" },
    id_acceso:       { type: String, default: "" },
    contra_acceso:   { type: String, default: "" },
    operador:        { type: String, default: "" },
    telefono:        { type: String, default: "" },

    // ObjectId references stored as strings — validator allows empty
    destino: {
      type: String,
      default: "",
      validate: {
        validator: (v) => !v || /^[0-9a-fA-F]{24}$/.test(v),
        message: "El destino debe ser un ID válido (24 caracteres hexadecimales)",
      },
    },
    origen: {
      type: String,
      default: "",
      validate: {
        validator: (v) => !v || /^[0-9a-fA-F]{24}$/.test(v),
        message: "El origen debe ser un ID válido (24 caracteres hexadecimales)",
      },
    },

    cliente: { type: String, required: true },

    remolque: {
      eco: String, placa: String, color: String, capacidad: String, sello: String,
    },
    tracto: {
      eco: String, placa: String, marca: String, modelo: String, color: String, tipo: String,
    },
    custodia: {
      custodio1_nombre:  { type: String },
      custodio1_telefono:{ type: String },
      custodio2_nombre:  { type: String },
      custodio2_telefono:{ type: String },
      placa:  { type: String },
      modelo: { type: String },
      color:  { type: String },
      marca:  { type: String },
    },

    inicioMonitoreo: { type: Date },
    finalMonitoreo:  { type: Date },
    status: { type: String, default: "creada", required: true },
    transportes: [TransporteSchema],
    eventos:     [EventoSchema],
    edited:      { type: Boolean, required: true, default: false },
    edited_bitacora: Object,
    draft_pendiente: { type: Boolean, default: false },
    deleted:    { type: Boolean, default: false },
    deleted_at: { type: Date },
    deleted_by: { type: String },

    // ── Plan de embarque linkage ─────────────────────────────────
    fechaPlanEmbarque: { type: Date, default: null },
    planDeEmbarque_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlanDeEmbarque",
      default: null,
    },
  },
  { timestamps: true }
);

BitSchema.index({ deleted: 1, cliente: 1 });
BitSchema.index({ deleted: 1, status: 1 });
BitSchema.index({ deleted: 1, createdAt: -1 });
BitSchema.index({ deleted: 1, bitacora_id: -1 });
BitSchema.index({ deleted: 1, operador: 1, createdAt: -1 });
BitSchema.index({ deleted: 1, linea_transporte: 1, createdAt: -1 });
BitSchema.index({ "transportes.lineaTransporte": 1 });
BitSchema.index({ "transportes.operador": 1 });
BitSchema.index({ "eventos.nombre": 1 });

const Bitacora = mongoose.model("Bitacora", BitSchema);
export default Bitacora;
