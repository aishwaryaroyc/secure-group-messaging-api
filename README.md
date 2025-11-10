# 📦 Secure Group Messaging API — Learning Yogi Assessment
![Node](https://img.shields.io/badge/node-20.x-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/express-4.x-black)
![MongoDB Atlas](https://img.shields.io/badge/mongodb%20atlas-connected-brightgreen?logo=mongodb)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)
![Render](https://img.shields.io/badge/deploy-Render-46E3B7?logo=render)

A lightweight, secure, scalable backend API for group-based messaging with encryption, invite-based private access, membership workflows, simulated realtime message polling, and JWT-based authentication.

This project is built using:

- **Node.js + Express**
- **MongoDB Atlas (Free Tier)**
- **Zod** for input validation
- **AES-128 encryption** for message payloads
- **JWT** for authentication
- **Swagger** API documentation
- **Polling-based realtime simulation**

---
**Live API:** https://secure-group-messaging-api.onrender.com  
**Docs:** https://secure-group-messaging-api.onrender.com/docs  
**Deployed on:** Render • **DB:** MongoDB Atlas (user: `appuser`, role: readWrite on `learning_yogi_chat`)

# 🚀 Features Overview

## ✅ Authentication
- User registration + login
- Password hashing via secure crypto-safe method
- JWT-based authentication (12h expiry)
- Validation for email & strong passwords

## ✅ Group Management
- Create open or private groups
- Owner becomes first member
- Optional initial member selection during creation
- maxMembers (capacity), with 0 = unlimited
- List open groups & groups user belongs to
- Join open groups immediately
- Request to join private groups
- Owner can approve/decline join requests
- 48-hour cooldown after leaving a private group
- Owner can banish members
- Banned members cannot bypass with invites
- Owner must transfer ownership before leaving
- Group deletion allowed only if owner is only member

## ✅ Invites
- Owner can generate limited-use, expiring invite tokens
- Token shown once (secure practice)
- Invite can join directly unless banned/full
- Validates expiration & max-uses

## ✅ Messaging
- AES-128-GCM encrypted messages stored in DB
- Only decrypted during read
- Sender info included
- List messages since timestamp
- Simulated realtime messaging using polling
- Message metadata: sender, timestamp, decrypted text

## ✅ Simulated Real-Time Polling
- `/messages/{groupId}/poll?since=<timestamp>`
- Returns count of new messages since timestamp
- Lightweight alternative to WebSockets

## ✅ Error Handling
- Structured error responses
- 400 validation errors
- 401 unauthorized
- 403 forbidden (banned, owner restrictions)
- 409 conflict (duplicate decisions)
- 404 not found

---

# ✅ Folder Structure

```
src/
  controllers/
    authController.js
    groupController.js
    messageController.js
  validators/
    userSchemas.js
    groupSchemas.js
    messageSchemas.js
    inviteSchemas.js
  middleware/
    auth.js
    error.js
  models/
    User.js
    Group.js
    Message.js
    JoinRequest.js
    Invite.js
    LeaveHistory.js
  utils/
    crypto.js
    token.js
  config/
    db.js
    logger.js
  routes/
    auth.js
    groups.js
    messages.js
  server.js
  seed.js
swagger.yaml
.env.example
README.md
```

---

# ✅ Environment Variables

Create a `.env` file:

```
PORT=4000
MONGO_URI=<your MongoDB Atlas connection string>
JWT_SECRET=<your_secret_here>
AES_128_KEY_BASE64=<16-byte AES key Base64 encoded>
LOG_LEVEL=debug
```

Generate AES key:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

---

# ✅ Installation & Setup

```
git clone <repo_url>
cd <project_folder>
npm install
```

Create `.env` file using the sample above.

Start server:

```
npm run dev
```

---

# ✅ Running Locally

- API runs at: `http://localhost:4000`
- Swagger Docs: `http://localhost:4000/api-docs` (if included)
- MongoDB Atlas cluster automatically connects via `MONGO_URI`

---

# ✅ Core API Endpoints Summary

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Register user |
| POST | /auth/login | Login, get JWT |

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /groups | Create group (owner auto-added) |
| GET | /groups/public | List open groups |
| GET | /groups/mine | List groups user belongs to |
| POST | /groups/{id}/join-open | Join open group |
| POST | /groups/{id}/request-join | Request join private group |
| GET | /groups/{id}/requests | Owner view pending requests |
| POST | /groups/requests/{rid}/decision | Owner approve/decline |
| POST | /groups/{id}/banish | Owner banishes member |
| POST | /groups/{id}/transfer | Transfer ownership |
| POST | /groups/{id}/leave | Leave group |
| DELETE | /groups/{id} | Delete empty group |

### Invites
| Method | Endpoint |
|--------|----------|
| POST | /groups/{id}/invites |

### Messages
| Method | Endpoint |
|--------|----------|
| POST | /messages/{id} | Send encrypted message |
| GET | /messages/{id} | List decrypted messages |
| GET | /messages/{id}/poll | Poll for new messages |

---

# ✅ Security Architecture

### 🔐 Passwords
Stored as salted hash — never plaintext.

### 🔐 Tokens
JWT signed using `JWT_SECRET`.

### 🔐 Encryption
- AES-128-GCM  
- Random initialization vector  
- Encrypted payload stored as `ciphertext.iv.authTag`

### 🔐 Authorization
- Owner-only actions enforced at controller level
- Banned users prevented from bypassing approval
- Capacity checks applied everywhere needed

---

# ✅ Real-Time Extension (Optional — Documented)

WebSockets not implemented (allowed by spec).

This can be extended using:

1. Socket.IO connection per group
2. Room = groupId
3. Message broadcast on `new-message` event
4. Offline buffering using Redis or in-memory queue
5. Polling → fallback when disconnected

Polling endpoint already prepared for incremental updates.

---

# ✅ Deployment (Recommended Setup)

### Deploy on Render:
1. Create new Web Service
2. Link GitHub repo
3. Set Environment Variables:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `AES_128_KEY_BASE64`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add “mongodb” as IP allowlist in Atlas (0.0.0.0/0)

---

# ✅ AI Tools Usage Declaration (Required by Assessment)

> AI-based tools (ChatGPT) were used to assist with code structure, documentation, and debugging.  
> All code was reviewed, validated, and tested manually by the developer.  
> No AI-generated code was used unchecked.  

---

# ✅ Known Limitations / Notes

- AES key rotation not implemented  
- No message deletion or editing  
- No unread counts per-user (only “newMessages” polling count)  
- WebSockets not implemented (optional per spec)  
- Invites are single-use part-wise secure—owner sees raw token only once  

---

# ✅ Future Improvements

- Replace polling with WebSocket pub/sub
- Add pagination for message history
- Avatar/username support beyond email
- Implement soft-delete for messages
- Add rate limiting on messaging

---

# ✅ License
MIT – for assessment usage only.
