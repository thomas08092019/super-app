# API Reference - My Super App

Complete API documentation for backend endpoints.

## Base URL

```
http://localhost:8000
```

## Authentication

All protected endpoints require JWT authentication via Bearer token.

```bash
# Example header
Authorization: Bearer <your_jwt_token>
```

---

## Authentication Endpoints

### POST /auth/login

Login and receive JWT token.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@superapp.local",
    "role": "admin",
    "status": "active",
    "created_at": "2024-01-01T00:00:00"
  }
}
```

### POST /auth/register

Register new user (if enabled).

**Request Body:**
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123"
}
```

### POST /auth/forgot-password

Request password reset.

**Response:**
```json
{
  "message": "Contact Admin via Telegram",
  "status": "info"
}
```

---

## Admin Endpoints

### GET /admin/users

List all users (Admin only).

**Response:**
```json
[
  {
    "id": 1,
    "username": "admin",
    "email": "admin@superapp.local",
    "role": "admin",
    "status": "active",
    "created_at": "2024-01-01T00:00:00"
  }
]
```

### PATCH /admin/users/{user_id}/status

Update user status (Admin only).

**Request Body:**
```json
{
  "status": "banned"
}
```

### POST /admin/users/{user_id}/reset-password

Reset user password (Admin only).

**Request Body:**
```json
{
  "new_password": "newpassword123"
}
```

### DELETE /admin/users/{user_id}

Delete user account (Admin only).

---

## Telegram Endpoints

### POST /telegram/login/send-code

Send OTP code to phone.

**Request Body:**
```json
{
  "session_name": "my_session",
  "phone_number": "+1234567890",
  "api_id": "12345",
  "api_hash": "abcdef123456"
}
```

**Response:**
```json
{
  "success": true,
  "phone_code_hash": "abc123...",
  "message": "OTP sent successfully"
}
```

### POST /telegram/login/verify-code

Verify OTP code.

**Request Body:**
```json
{
  "session_name": "my_session",
  "code": "12345"
}
```

**Response:**
```json
{
  "success": true,
  "session_string": "encrypted_session_string",
  "requires_2fa": false
}
```

### POST /telegram/login/verify-2fa

Verify 2FA password.

**Request Body:**
```json
{
  "session_name": "my_session",
  "password": "my2fapassword"
}
```

### POST /telegram/sessions

Save Telegram session.

**Request Body:**
```json
{
  "session_name": "my_session",
  "phone_number": "+1234567890",
  "api_id": "12345",
  "api_hash": "abcdef123456",
  "session_string": "encrypted_session_string"
}
```

### GET /telegram/sessions

List all sessions.

**Response:**
```json
[
  {
    "id": 1,
    "session_name": "my_session",
    "phone_number": "+1234567890",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00"
  }
]
```

### DELETE /telegram/sessions/{session_id}

Delete session.

### GET /telegram/profile/{username_or_phone}

Lookup user profile (OSINT).

**Query Parameters:**
- `session_id`: Session ID to use

**Response:**
```json
{
  "user_id": 123456789,
  "username": "username",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890",
  "bio": "User bio",
  "dc_id": 2,
  "common_chats_count": 5
}
```

### GET /telegram/group/{group_link}

Lookup group info (OSINT).

**Query Parameters:**
- `session_id`: Session ID to use

**Response:**
```json
{
  "chat_id": -1001234567890,
  "title": "Group Name",
  "username": "groupname",
  "member_count": 1000,
  "description": "Group description",
  "is_verified": false
}
```

### WebSocket /telegram/ws/feed/{session_id}

Real-time message feed.

---

## AI Summary Endpoints

### POST /ai/summarize

Generate AI summary.

**Request Body:**
```json
{
  "session_id": 1,
  "chat_id": "-1001234567890",
  "start_time": "2024-01-01T00:00:00",
  "end_time": "2024-01-02T00:00:00"
}
```

**Response:**
```json
{
  "summary": "## Summary\n\nMain topics discussed...",
  "message_count": 150,
  "time_range": {
    "start": "2024-01-01T00:00:00",
    "end": "2024-01-02T00:00:00"
  }
}
```

---

## Downloader Endpoints

### POST /downloader/start

Start download task.

**Request Body:**
```json
{
  "session_id": 1,
  "chat_id": "-1001234567890",
  "start_time": "2024-01-01T00:00:00",
  "end_time": "2024-01-02T00:00:00",
  "media_types": ["photo", "video", "document"]
}
```

**Response:**
```json
{
  "id": 1,
  "task_id": "abc123-def456",
  "status": "pending",
  "chat_name": "Group Name",
  "total_files": 0,
  "downloaded_files": 0,
  "progress": 0,
  "created_at": "2024-01-01T00:00:00"
}
```

### GET /downloader/tasks

List download tasks.

### GET /downloader/tasks/{task_id}/status

Get task status.

**Response:**
```json
{
  "task_id": "abc123-def456",
  "status": "PROGRESS",
  "info": {
    "current": 5,
    "total": 10,
    "progress": 50,
    "status": "Downloading file 5 of 10..."
  }
}
```

### DELETE /downloader/tasks/{task_id}

Cancel task.

---

## Broadcaster Endpoints

### POST /broadcast/send

Start broadcast.

**Request Body:**
```json
{
  "session_id": 1,
  "message": "Hello everyone!",
  "target_chat_ids": ["-1001234567890", "-1009876543210"],
  "delay_min": 2,
  "delay_max": 5
}
```

**Response:**
```json
{
  "task_id": "xyz789-abc123",
  "total_targets": 2,
  "status": "pending"
}
```

### GET /broadcast/status/{task_id}

Get broadcast status.

**Response:**
```json
{
  "task_id": "xyz789-abc123",
  "status": "PROGRESS",
  "info": {
    "current": 1,
    "total": 2,
    "sent": 1,
    "failed": 0,
    "progress": 50,
    "status": "Sent to 1 of 2 targets..."
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Error message"
}
```

### 401 Unauthorized
```json
{
  "detail": "Could not validate credentials"
}
```

### 403 Forbidden
```json
{
  "detail": "Admin access required"
}
```

### 404 Not Found
```json
{
  "detail": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}
```

---

## Rate Limiting

No rate limiting is currently implemented. In production, consider adding:
- Request rate limiting per IP
- API key system for external access
- WebSocket connection limits

---

## Interactive Documentation

For interactive API testing, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

