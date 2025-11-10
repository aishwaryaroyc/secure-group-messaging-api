// src/controllers/messageController.js
// Purpose: Send and retrieve AES-128-GCM encrypted messages per group.
// - Members-only access (owner or member).
// - sendMessage: validates text and stores encrypted payload.
// - listMessages: decrypts on read.
// - pollEvents: simple "simulated realtime" via polling.

import { z } from 'zod';
import Group from '../models/Group.js';
import Message from '../models/Message.js';
import { encryptMessage, decryptMessage } from '../utils/crypto.js';

// Keep message within reasonable bounds (storage/transport).
const sendSchema = z.object({
  text: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long'),
});

// POST /messages/:groupId
export async function sendMessage(req, res, next) {
  try {
    // Use safeParse -> clean 400 with friendly errors (no stack/Zod dump).
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }));
      return res.status(400).json({ error: 'Validation failed', errors });
    }
    const { text } = parsed.data;

    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Members-only check
    if (!group.members.some(m => m.toString() === req.user.id)) {
      return res.status(403).json({ error: 'Join group first' });
    }

    // Encrypt at write-time (AES-128-GCM).
    const payload = encryptMessage(text);
    const msg = await Message.create({ group: group._id, sender: req.user.id, payload });

    return res.status(201).json({ id: msg._id, createdAt: msg.createdAt });
  } catch (err) {
    return next(err);
  }
}

// GET /messages/:groupId
// GET /messages/:groupId
export async function listMessages(req, res, next) {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (!group.members.some(m => m.toString() === req.user.id)) {
      return res.status(403).json({ error: 'Join group first' });
    }

    const since = req.query.since ? new Date(req.query.since) : null;
    const filter = { group: group._id };
    if (since) filter.createdAt = { $gt: since };

    // Include minimal sender details so UI can show author
    const msgs = await Message.find(filter)
      .sort({ createdAt: 1 })
      .populate('sender', 'email')   // <— add other safe fields if you have them
      .lean();

    const out = msgs.map(m => ({
      id: m._id,
      sender: {
        _id: m.sender?._id ?? m.sender,
        email: m.sender?.email
      },
      createdAt: m.createdAt,
      text: decryptMessage(m.payload),
    }));

    return res.json(out);
  } catch (err) {
    return next(err);
  }
}

// GET /messages/:groupId/poll
// Simulated realtime: counts new messages since a timestamp.
export async function pollEvents(req, res, next) {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (!group.members.some(m => m.toString() === req.user.id)) {
      return res.status(403).json({ error: 'Join group first' });
    }

    const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 60_000);
    const msgs = await Message.find({ group: group._id, createdAt: { $gt: since } }).sort({ createdAt: 1 });

    return res.json({ newMessages: msgs.length, lastChecked: new Date().toISOString() });
  } catch (err) {
    return next(err);
  }
}
