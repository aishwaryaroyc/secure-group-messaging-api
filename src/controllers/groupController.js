// src/controllers/groupController.js
// Purpose: Group lifecycle (create/list/join/leave/ban/approve/invite).
// Highlights:
// - Private groups: join via owner approval OR invite (owner-controlled).
// - Banishment: banned users must re-request; owner approval lifts the ban.
// - 48h cooldown: applies when a user leaves a private group before re-requesting.
// - Only pending join requests are listed (spec: "dedicated section").
// - Clean ObjectId guards to avoid Mongoose CastError leaks.

import { z } from 'zod';
import mongoose from 'mongoose';
import Group from '../models/Group.js';
import JoinRequest from '../models/JoinRequest.js';
import LeaveHistory from '../models/LeaveHistory.js';
import Invite from '../models/Invite.js';
import { generateRawToken, sha256 } from '../utils/token.js';

// If you created src/validators/groupSchemas.js, import it here:
import { groupCreateSchema } from '../validators/groupSchemas.js';
// If you created src/validators/inviteSchemas.js, import it here:
import { createInviteSchema } from '../validators/inviteSchemas.js';

const COOLDOWN_HOURS = 48;

// Capacity helper: 0 => unlimited, else hard cap.
function capacityOk(group) {
  return group.maxMembers === 0 || group.members.length < group.maxMembers;
}

// Throws 403 if user is banned; also ensures a pending JoinRequest exists for owner review.
async function ensureNotBanned(group, userId) {
  // Always compare as ObjectId to avoid mixed-type issues
  const uid = new mongoose.Types.ObjectId(userId);

  // If banned, ensure a PENDING join request exists (create or refresh).
  if (group.bannedUsers.some(u => u.toString() === uid.toString())) {
    await JoinRequest.findOneAndUpdate(
      { group: group._id, user: uid },           // unique pair
      { $set: { status: 'pending' } },           // ALWAYS set to pending (refresh)
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const err = new Error(
      'You are banned. A join request is now pending for owner approval.'
    );
    err.status = 403;
    throw err;
  }
}

// POST /groups
export async function createGroup(req, res, next) {
  try {
    const parsed = groupCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { name, type, maxMembers = 0, initialMemberIds = [] } = parsed.data;

    // Owner is always a member
    const ownerId = req.user.id;

    // De-dupe, remove owner if present
    const uniqueIds = [...new Set(initialMemberIds.filter(id => !!id && id !== ownerId))];

    // Validate ObjectId format for all initial members
    for (const id of uniqueIds) {
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: `Invalid userId in initialMemberIds: ${id}` });
      }
    }

    // Capacity check: owner(1) + requested initial members
    const total = 1 + uniqueIds.length;
    if (maxMembers !== 0 && total > maxMembers) {
      return res.status(400).json({ error: 'Too many initial members for this group capacity' });
    }

    // Create group with owner + initial members
    const group = await Group.create({
      name,
      type,
      owner: ownerId,
      members: [ownerId, ...uniqueIds],
      maxMembers,
      bannedUsers: [],
    });

    return res.status(201).json(group);
  } catch (err) {
    return next(err);
  }
}

// GET /groups/public
export async function listPublicGroups(req, res, next) {
  try {
    const groups = await Group.find({ type: 'open' }).select('-bannedUsers');
    return res.json(groups);
  } catch (err) {
    return next(err);
  }
}

// GET /groups/mine
export async function myGroups(req, res, next) {
  try {
    const uid = new mongoose.Types.ObjectId(req.user.id);
    const groups = await Group.find({ members: uid });
    return res.json(groups);
  } catch (err) {
    return next(err);
  }
}


// POST /groups/:groupId/join-open
export async function joinOpenGroup(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.groupId)) {
      return res.status(400).json({ error: 'Invalid groupId' });
    }
    const group = await Group.findById(req.params.groupId);
    if (!group || group.type !== 'open') {
      return res.status(404).json({ error: 'Group not found or not open' });
    }

    await ensureNotBanned(group, req.user.id);

    if (group.members.some(m => m.toString() === req.user.id)) {
      return res.json({ message: 'Already a member' });
    }
    if (!capacityOk(group)) {
      return res.status(400).json({ error: 'Group is full' });
    }

    group.members.push(req.user.id);
    await group.save();
    return res.json({ message: 'Joined' });
  } catch (err) {
    return next(err);
  }
}

// POST /groups/:groupId/request-join
export async function requestJoinPrivate(req, res, next) {
  try {
    const { groupId } = req.params;
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({ error: 'Invalid groupId' });
    }

    const group = await Group.findById(groupId);
    if (!group || group.type !== 'private') {
      return res.status(404).json({ error: 'Group not found or not private' });
    }

    const uid = new mongoose.Types.ObjectId(req.user.id);

    // Already a member (includes owner) -> no request needed.
    if (group.members.some(m => m.toString() === uid.toString())) {
      return res.status(200).json({ message: 'Already a member' });
    }

    // If banned, this will now ALWAYS create/refresh a pending request then 403
    await ensureNotBanned(group, uid);

    // 48h cooldown after leaving a private group
    const lastLeave = await LeaveHistory
      .findOne({ group: group._id, user: uid })
      .sort({ leftAt: -1 });

    if (lastLeave) {
      const hours = (Date.now() - lastLeave.leftAt.getTime()) / 36e5;
      if (hours < COOLDOWN_HOURS) {
        return res.status(400).json({
          error: `Cooldown active. Try after ${Math.ceil(COOLDOWN_HOURS - hours)} hours`,
        });
      }
    }

    // If a pending request already exists, just echo it back
    const existing = await JoinRequest.findOne({ group: group._id, user: uid });
    if (existing && existing.status === 'pending') {
      return res.json({ message: 'Join request already submitted', requestId: existing._id });
    }

    // Upsert (re-open previously declined -> pending)
    const jr = await JoinRequest.findOneAndUpdate(
      { group: group._id, user: uid },
      { $set: { status: 'pending' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ message: 'Join request submitted', requestId: jr._id });
  } catch (err) {
    return next(err);
  }
}

// GET /groups/:groupId/requests  (owner; PENDING ONLY)
export async function listJoinRequests(req, res, next) {
  try {
    const { groupId } = req.params;
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({ error: 'Invalid groupId' });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only owner' });
    }

    const requests = await JoinRequest.find({ group: group._id, status: 'pending' })
      .populate('user', 'email')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(requests);
  } catch (err) {
    return next(err);
  }
}

// POST /groups/requests/:requestId/decision  (owner: approve|decline)
// Purpose
// -------
// Owner reviews a PENDING join request and either:
//   - APPROVE: ensure capacity, atomically remove user from bannedUsers (if present)
//              and add them to members (idempotent).
//   - DECLINE: mark request declined.
// Notes
// -----
// - Uses ObjectId guard to avoid CastErrors.
// - Blocks re-decisions (only pending can be decided).
// - Uses $pull + $addToSet for robust, atomic membership updates.
export async function decideJoinRequest(req, res, next) {
  try {
    const { requestId } = req.params;

    // 1) Validate requestId format early (clean 400 instead of CastError)
    if (!mongoose.isValidObjectId(requestId)) {
      return res.status(400).json({ error: 'Invalid requestId' });
    }

    // 2) Validate body (decision ∈ {approve, decline})
    const parsed = z.object({ decision: z.enum(['approve', 'decline']) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid decision' });
    }
    const { decision } = parsed.data;

    // 3) Load join request + target group
    const jr = await JoinRequest.findById(requestId);
    if (!jr) return res.status(404).json({ error: 'Request not found' });

    const group = await Group.findById(jr.group);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Owner-only action
    if (group.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only owner' });
    }

    // 4) Only pending requests can be decided
    if (jr.status !== 'pending') {
      return res.status(409).json({ error: 'Request already resolved', status: jr.status });
    }

    // 5) Branch: approve | decline
    if (decision === 'approve') {
      // Capacity check (0 = unlimited; else members < maxMembers)
      if (!capacityOk(group)) {
        return res.status(400).json({ error: 'Group is full' });
      }

      // ✅ ATOMIC FIX:
      //   Unban (if present) + add to members (idempotent) using a single DB update.
      //   This avoids brittle in-memory .toString() comparisons on mixed types.
      await Group.updateOne(
        { _id: group._id },
        {
          $pull: { bannedUsers: jr.user },   // remove user from bannedUsers if present
          $addToSet: { members: jr.user }    // add user to members only if not already there
        }
      );

      // Mark request approved
      jr.status = 'approved';
      await jr.save();

      return res.json({ message: 'Decision recorded', status: jr.status });
    }

    // DECLINE
    jr.status = 'declined';
    await jr.save();
    return res.json({ message: 'Decision recorded', status: jr.status });

  } catch (err) {
    return next(err);
  }
}

// POST /groups/:groupId/leave
export async function leaveGroup(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.groupId)) {
      return res.status(400).json({ error: 'Invalid groupId' });
    }
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const idx = group.members.findIndex(m => m.toString() === req.user.id);
    if (idx === -1) return res.status(400).json({ error: 'Not a member' });
    if (group.owner.toString() === req.user.id) {
      return res.status(400).json({ error: 'Owner must transfer ownership before leaving' });
    }

    // Remove membership
    group.members.splice(idx, 1);
    await group.save();

    // Record cooldown only for private groups (48h re-request gate)
    if (group.type === 'private') {
      await LeaveHistory.create({ group: group._id, user: req.user.id });
    }

    return res.json({ message: 'Left group' });
  } catch (err) {
    return next(err);
  }
}

// POST /groups/:groupId/banish (owner)
export async function banishMember(req, res, next) {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    if (!mongoose.isValidObjectId(groupId)) return res.status(400).json({ error: 'Invalid groupId' });
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: 'Invalid userId' });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.owner.toString() !== req.user.id) return res.status(403).json({ error: 'Only owner' });
    if (userId === req.user.id) return res.status(400).json({ error: 'Owner cannot banish self' });

    const isMember = group.members.some(m => m.toString() === userId);
    const isBanned = group.bannedUsers.some(u => u.toString() === userId);

    if (isBanned) return res.status(200).json({ message: 'User is already banned' });
    if (!isMember && !isBanned) return res.status(400).json({ error: 'User is not a current member' });

    if (isMember) {
      group.members = group.members.filter(m => m.toString() !== userId);
    }

    group.bannedUsers.push(userId);
    await group.save();

    return res.json({ message: 'User banished' });
  } catch (err) {
    return next(err);
  }
}

// POST /groups/:groupId/transfer-ownership  (owner)
export async function transferOwnership(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.groupId)) {
      return res.status(400).json({ error: 'Invalid groupId' });
    }
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.owner.toString() !== req.user.id) return res.status(403).json({ error: 'Only owner' });

    const { newOwnerId } = req.body;
    if (!mongoose.isValidObjectId(newOwnerId)) {
      return res.status(400).json({ error: 'Invalid newOwnerId' });
    }
    if (!group.members.some(m => m.toString() === newOwnerId)) {
      return res.status(400).json({ error: 'New owner must be a member' });
    }

    group.owner = newOwnerId;
    await group.save();
    return res.json({ message: 'Ownership transferred' });
  } catch (err) {
    return next(err);
  }
}

// DELETE /groups/:groupId  (owner; only if sole member)
export async function deleteGroup(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.groupId)) {
      return res.status(400).json({ error: 'Invalid groupId' });
    }
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.owner.toString() !== req.user.id) return res.status(403).json({ error: 'Only owner' });

    if (group.members.length > 1) {
      return res.status(400).json({ error: 'Group can be deleted only if owner is sole member' });
    }

    await group.deleteOne();
    return res.json({ message: 'Group deleted' });
  } catch (err) {
    return next(err);
  }
}

/* ---------------------------
   INVITES
   - Owner creates tokenized invite (time/uses limited).
   - Any logged-in user can redeem unless banned or group full.
   - Optional policy: treat invite as owner override to cooldown.
   --------------------------- */

// POST /groups/:groupId/invites  (owner)
export async function createInvite(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.groupId)) {
      return res.status(400).json({ error: 'Invalid groupId' });
    }
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only owner can create invites' });
    }

    // Validate invite params (maxUses, expiresInMinutes).
    const parsed = createInviteSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid invite params', details: parsed.error.issues });
    }
    const { maxUses, expiresInMinutes } = parsed.data;
    const expiresAt = new Date(Date.now() + Math.max(1, +expiresInMinutes) * 60_000);

    // Create token (return raw once; store only hash).
    const rawToken = generateRawToken();
    const tokenHash = sha256(rawToken);

    const invite = await Invite.create({
      group: group._id,
      owner: req.user.id,
      tokenHash,
      maxUses: Math.max(1, +maxUses),
      uses: 0,
      expiresAt,
      disabled: false,
    });

    return res.status(201).json({
      message: 'Invite created',
      token: rawToken,      // show once to owner
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
    });
  } catch (err) {
    return next(err);
  }
}

// POST /groups/join-with-invite
export async function joinWithInvite(req, res, next) {
  try {
    const parsed = z.object({ token: z.string().min(1) }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Missing token' });
    const { token } = parsed.data;

    const tokenHash = sha256(token);
    const invite = await Invite.findOne({ tokenHash });
    if (!invite || invite.disabled) return res.status(400).json({ error: 'Invalid invite' });
    if (invite.expiresAt <= new Date()) return res.status(400).json({ error: 'Invite expired' });
    if (invite.uses >= invite.maxUses) return res.status(400).json({ error: 'Invite exhausted' });

    const group = await Group.findById(invite.group);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // If banned, cannot bypass owner approval with invite.
    if (group.bannedUsers.some(u => u.toString() === req.user.id)) {
      return res.status(403).json({ error: 'You are banned. Send a join request to the owner to rejoin.' });
    }

    // Capacity check.
    if (!capacityOk(group)) return res.status(400).json({ error: 'Group is full' });

    // Idempotent membership add.
    if (!group.members.some(m => m.toString() === req.user.id)) {
      group.members.push(req.user.id);
      await group.save();
    }

    // Consume invite; disable when spent.
    invite.uses += 1;
    if (invite.uses >= invite.maxUses) invite.disabled = true;
    await invite.save();

    return res.json({ message: 'Joined via invite', groupId: group._id });
  } catch (err) {
    return next(err);
  }
}
