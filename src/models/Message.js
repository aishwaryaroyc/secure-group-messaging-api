import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  payload: { type: String, required: true }, // base64(iv|tag|ciphertext)
  createdAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);
