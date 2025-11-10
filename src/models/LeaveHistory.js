import mongoose from 'mongoose';

const leaveHistorySchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leftAt: { type: Date, default: Date.now },
}, { timestamps: true });

leaveHistorySchema.index({ group: 1, user: 1, leftAt: -1 });

export default mongoose.model('LeaveHistory', leaveHistorySchema);
