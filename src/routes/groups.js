// src/routes/groups.js
// Purpose:
// --------
// Defines all group-related API endpoints.
// Access Control:
//   - All routes here require a valid JWT (authRequired middleware).
//   - Group ownership rules are enforced in the controller itself.
//
// Features Supported (per assessment spec):
//   - Create group (open/private)
//   - Join open group directly
//   - Request to join private group
//   - Owner can list pending join requests
//   - Owner decides (approve/decline)
//   - Leave group
//   - Owner can banish members
//   - Owner can transfer ownership
//   - Owner can delete group (only if sole member)
//   - Invite system: owner creates invite; members/others redeem invite

import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  createGroup,
  listPublicGroups,
  myGroups,
  joinOpenGroup,
  requestJoinPrivate,
  listJoinRequests,
  decideJoinRequest,
  leaveGroup,
  banishMember,
  transferOwnership,
  deleteGroup,
  createInvite,
  joinWithInvite
} from '../controllers/groupController.js';

const r = Router();

// All routes require authentication
r.use(authRequired);

// Create new group (owner becomes first member automatically)
r.post('/', createGroup);

// List all OPEN groups (joinable without approval)
r.get('/public', listPublicGroups);

// List groups the authenticated user is currently a member of
r.get('/mine', myGroups);

// Join an OPEN group directly (no approval needed)
r.post('/:groupId/join-open', joinOpenGroup);

// Request to join PRIVATE group (creates/updates join request)
r.post('/:groupId/request-join', requestJoinPrivate);

// Owner can view pending join requests for a target group
r.get('/:groupId/requests', listJoinRequests);

// Owner decides approval/decline for a given join request
r.post('/requests/:requestId/decision', decideJoinRequest);

// Member leaves group (owner cannot leave without transfer)
r.post('/:groupId/leave', leaveGroup);

// Owner banishes a member (member removed + added to banned list)
r.post('/:groupId/banish', banishMember);

// Owner transfers ownership to another member
r.post('/:groupId/transfer', transferOwnership);

// Owner deletes group (only if sole remaining member)
r.delete('/:groupId', deleteGroup);

// Owner creates a time-limited / use-limited invite
r.post('/:groupId/invites', createInvite);

// Any logged-in user redeems invite token if valid
r.post('/join-with-invite', joinWithInvite);

export default r;
