# HVID Application - Complete API Flow & Architecture

## 🏗️ Application Architecture

### Technology Stack
- **Backend**: Flask (Python)
- **Database**: MySQL (via PyMySQL)
- **Authentication**: JWT (JSON Web Tokens)
- **OTP System**: Default OTP (123456) with TextBee SMS integration

### Database Schema
```
identities (Users/Identity Records)
├── id (VARCHAR 36, PK)
├── phone_hash (VARCHAR 256, UNIQUE)
├── phone_last4 (VARCHAR 4)
├── username (VARCHAR 64, UNIQUE)
├── identity_state (VARCHAR 32) - UNVERIFIED, VERIFIED, SUSPENDED, REVOKED
├── identity_type (VARCHAR 32) - PERSONAL, PROFESSIONAL, BUSINESS
├── verification_level (INT) - 0-5 scale
├── trust_signal (VARCHAR 32) - UNVERIFIED, BASIC, VERIFIED, HIGH, FLAGGED
├── tier (VARCHAR 16) - FREE, PREMIUM, ENTERPRISE
├── flag_count (INT)
├── is_active (BOOLEAN)
├── last_login_at (DATETIME)
├── created_at (DATETIME)
└── updated_at (DATETIME)

otp_sessions (OTP Verification Sessions)
├── id (VARCHAR 36, PK)
├── identity_id (VARCHAR 36, FK → identities)
├── phone_hash (VARCHAR 256)
├── otp_hash (VARCHAR 256)
├── otp_plain (VARCHAR 6) - Temporary, cleared after verification
├── purpose (VARCHAR 16) - LOGIN, SIGNUP
├── attempts (INT)
├── verified (BOOLEAN)
├── expires_at (DATETIME)
└── created_at (DATETIME)

assets (Social Media & Web Assets)
├── id (VARCHAR 36, PK)
├── identity_id (VARCHAR 36, FK → identities)
├── asset_type (VARCHAR 32) - INSTAGRAM, WEBSITE
├── value_hash (VARCHAR 256)
├── display_value (VARCHAR 256)
├── verification_code (VARCHAR 64)
├── verification_status (VARCHAR 32) - PENDING, VERIFIED, FAILED
├── ownership_strength (INT) - 0-3 scale
├── instructions (TEXT)
├── created_at (DATETIME)
└── updated_at (DATETIME)

reports (Identity Reports/Flags)
├── id (VARCHAR 36, PK)
├── reporter_identity_id (VARCHAR 36, FK → identities)
├── target_identity_id (VARCHAR 36, FK → identities)
├── target_asset_id (VARCHAR 36)
├── report_type (VARCHAR 64) - IMPERSONATION, FRAUD, HARASSMENT, etc.
├── description (TEXT)
├── evidence_urls (TEXT/JSON)
├── status (VARCHAR 32) - PENDING, UNDER_REVIEW, RESOLVED, DISMISSED
├── created_at (DATETIME)
└── updated_at (DATETIME)

kyc_submissions (KYC Verification)
├── id (VARCHAR 36, PK)
├── identity_id (VARCHAR 36, FK → identities)
├── document_type (VARCHAR 64) - PASSPORT, DRIVERS_LICENSE, NATIONAL_ID
├── document_urls (TEXT/JSON)
├── status (VARCHAR 32) - PENDING, APPROVED, REJECTED
├── redirect_url (VARCHAR 512)
├── created_at (DATETIME)
└── updated_at (DATETIME)
```

---

## 🔐 Authentication Flow

### 1. Request OTP
**Endpoint**: `POST /api/auth/request-otp`

**Request Body**:
```json
{
  "phone": "+919962106567"
}
```

**Response** (200 OK):
```json
{
  "message": "Enter the default OTP to continue.",
  "purpose": "LOGIN" // or "SIGNUP"
}
```

**Flow**:
1. Phone number is hashed for privacy
2. Existing unverified OTP sessions are deleted
3. New OTP session is created with default OTP (123456)
4. Purpose is determined: LOGIN (existing user) or SIGNUP (new user)

---

### 2. Verify OTP
**Endpoint**: `POST /api/auth/verify-otp`

**Request Body**:
```json
{
  "phone": "+919962106567",
  "otp": "123456"
}
```

**Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "identity_id": "550e8400-e29b-41d4-a716-446655440000",
  "identity_state": "UNVERIFIED",
  "verification_level": 0,
  "is_new": true
}
```

**Flow**:
1. Phone number is hashed and OTP session is retrieved
2. OTP is verified (must be 123456)
3. Identity is created if new user, or retrieved if existing
4. JWT token is generated with 7-day expiration
5. User's last_login_at is updated

---

### 3. Get Current User
**Endpoint**: `GET /api/auth/me`

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "identity_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "deva",
  "phone_last4": "6567",
  "identity_state": "UNVERIFIED",
  "identity_type": "PERSONAL",
  "verification_level": 0,
  "trust_signal": "UNVERIFIED",
  "tier": "FREE",
  "created_at": "2024-01-15T10:30:00",
  "last_login_at": "2024-01-16T14:22:00"
}
```

---

## 👤 Identity Management

### 4. Get Identity Details
**Endpoint**: `GET /api/identity/:identity_id`

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "deva",
  "status": "VERIFIED",
  "verificationLevel": 2,
  "identity_type": "PROFESSIONAL",
  "trust_signal": "VERIFIED",
  "tier": "FREE",
  "assets": [
    {
      "id": "asset-uuid-1",
      "type": "INSTAGRAM",
      "verificationStatus": "VERIFIED",
      "ownershipStrength": 2,
      "createdAt": "2024-01-15T10:30:00"
    }
  ],
  "created_at": "2024-01-15T10:30:00"
}
```

---

### 5. Update Identity Type
**Endpoint**: `PATCH /api/identity/:identity_id/type`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "type": "PROFESSIONAL" // PERSONAL, PROFESSIONAL, or BUSINESS
}
```

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "identity_type": "PROFESSIONAL",
  "trust_signal": "VERIFIED",
  "status": "VERIFIED"
}
```

---

### 6. Update Username
**Endpoint**: `PATCH /api/identity/:identity_id/username`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "username": "myusername"
}
```

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "myusername"
}
```

**Rules**:
- 3-32 characters
- Letters, numbers, _, ., - only
- Must be unique

---

## 🔍 Identity Matching

### 7. Check Match
**Endpoint**: `POST /api/match/check`

**Request Body**:
```json
{
  "type": "phone", // phone, identity_id, or username
  "value": "+919962106567",
  "query": "+919962106567" // alternative to value
}
```

**Response** (200 OK):
```json
{
  "result_type": "MATCH_CONFIRMED", // NO_MATCH, PARTIAL_MATCH, MATCH_CONFIRMED, UNDER_REVIEW
  "signal": "VERIFIED",
  "verification_level": 2,
  "identity_type": "PROFESSIONAL",
  "identity_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "deva"
}
```

**Match Types**:
- `NO_MATCH`: Identity not found
- `PARTIAL_MATCH`: Found but low verification (level 0-1)
- `MATCH_CONFIRMED`: High verification (level 3+)
- `UNDER_REVIEW`: Identity suspended

---

## 🎨 Asset Management (Instagram & Website)

### 8. Claim Asset
**Endpoint**: `POST /api/asset/claim`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "type": "instagram", // or "website"
  "value": "@myhandle" // or "example.com"
}
```

**Response** (201 Created):
```json
{
  "assetId": "asset-uuid-1",
  "type": "INSTAGRAM",
  "verificationStatus": "PENDING",
  "verificationCode": "hvid-abc123def456",
  "instructions": "Add the verification code to your Instagram bio, then click Verify."
}
```

---

### 9. Verify Instagram
**Endpoint**: `POST /api/asset/verify/instagram`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "assetId": "asset-uuid-1",
  "handle": "myhandle"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Instagram verified successfully."
}
```

**Flow**:
1. Fetches Instagram bio from public profile
2. Checks if verification code is present
3. Updates asset status to VERIFIED
4. Increases identity verification level

---

### 10. Verify Website
**Endpoint**: `POST /api/asset/verify/website`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "assetId": "asset-uuid-2",
  "domain": "example.com"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Website verified via meta tag.",
  "method": "meta" // or "dns"
}
```

**Verification Methods**:
1. **Meta Tag**: `<meta name="hvid-verification" content="hvid-abc123...">`
2. **DNS TXT**: `hvid=hvid-abc123...`

---

### 11. List Assets
**Endpoint**: `GET /api/asset/:identity_id`

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
[
  {
    "id": "asset-uuid-1",
    "type": "INSTAGRAM",
    "verificationStatus": "VERIFIED",
    "ownershipStrength": 2,
    "createdAt": "2024-01-15T10:30:00"
  },
  {
    "id": "asset-uuid-2",
    "type": "WEBSITE",
    "verificationStatus": "PENDING",
    "ownershipStrength": 0,
    "createdAt": "2024-01-15T11:00:00"
  }
]
```

---

## 🚨 Reporting System

### 12. Submit Report
**Endpoint**: `POST /api/report/submit`

**Request Body**:
```json
{
  "reporter_identity_id": "reporter-uuid",
  "target_identity_id": "target-uuid",
  "report_type": "IMPERSONATION", // FRAUD, HARASSMENT, FAKE_IDENTITY, SPAM, MISINFORMATION, OTHER
  "description": "This account is impersonating a public figure.",
  "evidence_urls": [
    "https://example.com/proof1.jpg",
    "https://example.com/proof2.jpg"
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "report_id": "report-uuid-1",
  "status": "PENDING"
}
```

---

## 🪪 KYC (Know Your Customer)

### 13. Start KYC
**Endpoint**: `POST /api/kyc/start`

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "kyc_id": "kyc-uuid-1",
  "status": "PENDING",
  "redirect_url": "/kyc/mock?id=kyc-uuid-1"
}
```

---

### 14. Submit KYC
**Endpoint**: `POST /api/kyc/submit`

**Request Body**:
```json
{
  "identity_id": "identity-uuid",
  "document_type": "PASSPORT", // DRIVERS_LICENSE, NATIONAL_ID, RESIDENCE_PERMIT
  "document_urls": [
    "https://storage.example.com/docs/passport_front.jpg",
    "https://storage.example.com/docs/passport_back.jpg"
  ]
}
```

**Response** (201 Created):
```json
{
  "kyc_id": "kyc-uuid-2",
  "status": "PENDING"
}
```

---

### 15. Get KYC Status
**Endpoint**: `GET /api/kyc/status?identityId=<uuid>`

**Response** (200 OK):
```json
{
  "kyc_id": "kyc-uuid-1",
  "status": "APPROVED",
  "document_type": "PASSPORT",
  "createdAt": "2024-01-15T10:30:00",
  "updatedAt": "2024-01-16T09:15:00"
}
```

---

## 🔒 Security & Recovery

### 16. Get Security Status
**Endpoint**: `GET /api/security/status/:identity_id`

**Response** (200 OK):
```json
{
  "status": "VERIFIED",
  "lastActivity": "2024-01-16T14:22:00",
  "flagCount": 0
}
```

---

### 17. Start Account Recovery
**Endpoint**: `POST /api/security/recover/start`

**Request Body**:
```json
{
  "identity_id": "identity-uuid"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Recovery process initiated. Follow the instructions sent to your phone."
}
```

---

### 18. Complete Account Recovery
**Endpoint**: `POST /api/security/recover/complete`

**Request Body**:
```json
{
  "identity_id": "identity-uuid"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Account recovery completed. You can now log in."
}
```

---

## 🏥 Health & Utility Endpoints

### 19. Health Check
**Endpoint**: `GET /api/health`

**Response** (200 OK):
```json
{
  "status": "ok",
  "message": "HVID is running"
}
```

---

### 20. Activity History (Stub)
**Endpoint**: `GET /api/internal/history/:identity_id`

**Response** (200 OK):
```json
{
  "events": [],
  "total": 0
}
```

---

### 21. Face Verification Status (Stub)
**Endpoint**: `GET /api/face/status`

**Response** (200 OK):
```json
{
  "status": "NOT_STARTED",
  "message": "Face verification not yet available"
}
```

---

## 📄 Frontend Routes (HTML Pages)

### Public Pages
- `/` - Homepage
- `/how-it-works` - How it works page
- `/for-businesses` - Business solutions
- `/for-individuals` - Individual solutions
- `/legal` - Legal information
- `/terms` - Terms of service
- `/trust-safety` - Trust and safety
- `/result` - Result page
- `/identity-type` - Identity type selection
- `/acceptable-use` - Acceptable use policy
- `/challenge` - Challenge page
- `/reports` - Reports page
- `/p` - Profile page

### Authentication
- `/auth/login` - Login page
- `/auth/signup` - Signup page

### Dashboard (Authenticated)
- `/dashboard` - Main dashboard
- `/dashboard/identity` - Identity management
- `/dashboard/linked-accounts` - Linked accounts
- `/dashboard/reports` - User reports
- `/dashboard/timeline` - Activity timeline
- `/dashboard/verification` - Verification status

### Admin (Authenticated + Admin)
- `/admin/challenges` - All challenges
- `/admin/challenge-detail` - Challenge details
- `/admin/reports` - All reports
- `/admin/report-detail` - Report details
- `/admin/identity-search` - Identity search
- `/admin/identity-detail` - Identity details
- `/admin/high-risk` - High-risk identities

---

## 🎯 Complete User Journey

### New User Registration
1. User visits `/auth/signup`
2. Enters phone number → `POST /api/auth/request-otp`
3. Enters OTP (123456) → `POST /api/auth/verify-otp`
4. Receives JWT token
5. Redirected to `/dashboard`
6. Can set username → `PATCH /api/identity/:id/username`
7. Can choose identity type → `PATCH /api/identity/:id/type`

### Identity Verification
1. User claims Instagram → `POST /api/asset/claim` with type="instagram"
2. Adds verification code to Instagram bio
3. Verifies ownership → `POST /api/asset/verify/instagram`
4. Verification level increases from 0 to 1
5. Trust signal changes from "UNVERIFIED" to "BASIC"

### Identity Check (Public)
1. Anyone visits `/result` or search page
2. Enters phone number → `POST /api/match/check`
3. Gets match result with trust signal and verification level
4. Can view public profile → `GET /api/identity/:id`

---

## 🔧 Setup & Deployment

### Initial Setup
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Test database connection
python test_db_connection.py

# 3. Initialize database tables
python init_database.py

# 4. Run application
python app.py
```

### Environment Variables (.env)
```
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
DATABASE_URL=mysql+pymysql://<MYSQL_USER>:<MYSQL_PASSWORD>@<MYSQL_HOST>:3306/<MYSQL_DATABASE>
TEXTBEE_API_KEY=your-textbee-key
TEXTBEE_DEVICE_ID=your-device-id
OTP_EXPIRY_MINUTES=10
MAX_OTP_ATTEMPTS=3
```

### Default Credentials
- **Phone**: +919962106567
- **OTP**: 123456
- **Username**: deva

---

## 🔐 Security Features

### Data Privacy
- Phone numbers are HMAC-SHA256 hashed (never stored in plain text)
- Only last 4 digits stored for display
- OTP codes hashed with HMAC-SHA256
- JWT tokens with 7-day expiration

### Authentication Flow
1. Phone-based authentication (no passwords)
2. OTP verification (default: 123456)
3. JWT Bearer token for API access
4. Token validation on protected routes

### Trust Signals
- **UNVERIFIED**: New account, no verification (level 0)
- **BASIC**: Basic verification complete (level 1)
- **VERIFIED**: Identity verified (level 2)
- **HIGH**: Highly verified with multiple assets (level 3+)
- **FLAGGED**: Suspended or reported identity

---

## 📊 Database Relationships

```
identities (1) ←→ (N) otp_sessions
identities (1) ←→ (N) assets
identities (1) ←→ (N) reports (as reporter)
identities (1) ←→ (N) reports (as target)
identities (1) ←→ (N) kyc_submissions
```

---

## 🚀 API Testing Examples

### Using cURL

**Request OTP**:
```bash
curl -X POST http://localhost:3000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919962106567"}'
```

**Verify OTP**:
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919962106567", "otp": "123456"}'
```

**Get Current User**:
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Check Identity Match**:
```bash
curl -X POST http://localhost:3000/api/match/check \
  -H "Content-Type: application/json" \
  -d '{"type": "phone", "value": "+919962106567"}'
```

---

## 📝 Notes

- All API endpoints return JSON
- Dates are in ISO 8601 format (UTC)
- UUIDs are version 4 (random)
- Database uses InnoDB engine with foreign keys
- CORS enabled for all `/api/*` routes
- Default OTP is 123456 (configurable)
- JWT tokens expire after 7 days
