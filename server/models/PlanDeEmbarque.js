import mongoose from "mongoose";

const PlanDeEmbarqueSchema = new mongoose.Schema(
  {
    tipoViaje:   { type: String, required: true },
    carrierMove: { type: String, required: true },
    cliente: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    destino: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Destino",
      required: true,
    },
    citaCarga:   { type: Date, required: true },
    horaSalida:  { type: Date, required: true },
    citaEntrega: { type: Date, required: true },
    transporte:  { type: String, required: true },
    tipoUnidad:  { type: String, enum: ["1.5", "3.5", "TH", "TR"], required: false },
  },
  { timestamps: true }
);

const PlanDeEmbarque = mongoose.model("PlanDeEmbarque", PlanDeEmbarqueSchema);
export default PlanDeEmbarque;
