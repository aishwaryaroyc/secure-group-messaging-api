import mongoose from 'mongoose';

const joinRequestSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

joinRequestSchema.index({ group: 1, user: 1 }, { unique: true });

export default mongoose.model('JoinRequest', joinRequestSchema);
