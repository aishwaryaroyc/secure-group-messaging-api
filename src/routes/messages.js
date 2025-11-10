// src/routes/messages.js
// Purpose:
// --------
// Message-related routes including sending messages,
// fetching messages, and polling for new ones.
//
// Access Control:
//   - All message endpoints require auth (authRequired)
//   - Additional membership rules enforced in controller
//
// Features implemented:
//   - AES-128 encrypted message storage
//   - User can send message only if member of group
//   - User can list messages only in groups they belong to
//   - "pollEvents" simulates realtime updates

import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  sendMessage,
  listMessages,
  pollEvents
} from '../controllers/messageController.js';

const r = Router();

// All message operations require authentication
r.use(authRequired);

// Send an encrypted message to a group the user belongs to
r.post('/:groupId', sendMessage);

// List decrypted messages from a group (membership required)
r.get('/:groupId', listMessages);

// Poll for new messages since timestamp — simulates realtime
r.get('/:groupId/poll', pollEvents);

export default r;
