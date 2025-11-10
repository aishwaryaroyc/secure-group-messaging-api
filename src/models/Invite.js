import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true }, // sha256(rawToken)
  maxUses: { type: Number, default: 1 },   // single-use by default
  uses: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true }, // ✅ removed index:true
  disabled: { type: Boolean, default: false },
}, { timestamps: true });

// TTL index: Atlas will auto-delete expired invite documents
inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Invite', inviteSchema);
