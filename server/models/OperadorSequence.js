import mongoose, { mongo } from "mongoose";

const sequenceSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});

const OperadorSequence = mongoose.model("OperadorSequence", sequenceSchema);
export default OperadorSequence;












