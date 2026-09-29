import mongoose, { mongo } from "mongoose";

const sequenceSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});

const DestinoSequence = mongoose.model("DestinoSequence", sequenceSchema);
export default DestinoSequence;
