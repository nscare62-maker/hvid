# HVID - Hierarchical Verified Identity Database

A comprehensive identity verification and trust system built with Flask and MySQL.

## 🌟 Features

- **Phone-based Authentication** with OTP verification
- **JWT Token Authentication** for secure API access
- **Identity Management** with verification levels and trust signals
- **Asset Verification** for Instagram accounts and websites
- **Identity Matching** and public search functionality
- **Reporting System** for flagging suspicious identities
- **KYC Integration** for document verification
- **Account Security** with recovery mechanisms
- **Admin Dashboard** for managing identities and reports

## 🏗️ Architecture

### Technology Stack
- **Backend**: Flask 3.0 (Python)
- **Database**: MySQL 8.0+ with PyMySQL
- **Authentication**: JWT (PyJWT)
- **ORM**: SQLAlchemy with Flask-SQLAlchemy
- **SMS Service**: TextBee API integration

### Database Schema
- **identities**: User accounts and identity records
- **otp_sessions**: OTP verification sessions
- **assets**: Social media and website ownership claims
- **reports**: User-submitted reports and flags
- **kyc_submissions**: KYC document submissions

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- MySQL 8.0+
- pip (Python package manager)

### Installation

#### Option 1: Automated Setup (Windows)
```bash
setup_all.bat
```

#### Option 2: Manual Setup
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Test database connection
python test_db_connection.py

# 3. Initialize database
python init_database.py

# 4. Run application
python app.py
```

### Default Credentials
- **Phone**: +919962106567
- **OTP**: 123456
- **Username**: deva

## 📡 API Endpoints

### Authentication
- `POST /api/auth/request-otp` - Request OTP for phone number
- `POST /api/auth/verify-otp` - Verify OTP and get JWT token
- `GET /api/auth/me` - Get current user details (authenticated)

### Identity Management
- `GET /api/identity/:id` - Get identity details
- `PATCH /api/identity/:id/type` - Update identity type
- `PATCH /api/identity/:id/username` - Set username

### Identity Matching
- `POST /api/match/check` - Check if phone/identity exists

### Asset Management
- `POST /api/asset/claim` - Claim Instagram or website
- `POST /api/asset/verify/instagram` - Verify Instagram ownership
- `POST /api/asset/verify/website` - Verify website ownership
- `GET /api/asset/:identityId` - List assets for identity

### Reporting
- `POST /api/report/submit` - Submit identity report

### KYC
- `POST /api/kyc/start` - Start KYC process
- `POST /api/kyc/submit` - Submit KYC documents
- `GET /api/kyc/status` - Get KYC status

### Security
- `GET /api/security/status/:id` - Get security status
- `POST /api/security/recover/start` - Start account recovery
- `POST /api/security/recover/complete` - Complete recovery

### Utility
- `GET /api/health` - Health check endpoint

## 🌐 Frontend Routes

### Public Pages
- `/` - Homepage
- `/how-it-works` - Information page
- `/for-businesses` - Business solutions
- `/for-individuals` - Individual solutions
- `/legal` - Legal information
- `/terms` - Terms of service
- `/trust-safety` - Trust and safety

### Authentication
- `/auth/login` - Login page
- `/auth/signup` - Signup page

### Dashboard (Authenticated)
- `/dashboard` - Main dashboard
- `/dashboard/identity` - Identity management
- `/dashboard/linked-accounts` - Linked accounts
- `/dashboard/verification` - Verification status
- `/dashboard/reports` - User reports
- `/dashboard/timeline` - Activity timeline

### Admin (Admin Only)
- `/admin/challenges` - Challenge management
- `/admin/reports` - Report management
- `/admin/identity-search` - Identity search
- `/admin/high-risk` - High-risk identities

## 📖 Documentation

- **[Quick Start Guide](QUICKSTART.md)** - Get up and running in minutes
- **[API Flow Documentation](API_FLOW.md)** - Complete API reference with examples

## 🔧 Configuration

### Environment Variables (.env)
```env
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
DATABASE_URL=mysql+pymysql://<MYSQL_USER>:<MYSQL_PASSWORD>@<MYSQL_HOST>:3306/<MYSQL_DATABASE>
TEXTBEE_API_KEY=your-textbee-api-key
TEXTBEE_DEVICE_ID=your-textbee-device-id
OTP_EXPIRY_MINUTES=10
MAX_OTP_ATTEMPTS=3
```

### Database Configuration
Edit `init_database.py` to change database settings:
```python
DB_CONFIG = {
    'host': '<MYSQL_HOST>',
    'port': 3306,
    'user': '<MYSQL_USER>',
    'password': '<MYSQL_PASSWORD>',
    'database': '<MYSQL_DATABASE>',
    'charset': 'utf8mb4',
}
```

## 🔐 Security Features

### Data Privacy
- Phone numbers are hashed with HMAC-SHA256
- Only last 4 digits stored for display
- No plain text passwords (phone + OTP only)
- JWT tokens with configurable expiration

### Authentication Flow
1. User enters phone number
2. OTP sent/displayed (default: 123456)
3. User verifies OTP
4. JWT token issued (7 days validity)
5. Token required for protected endpoints

### Trust Signals
- **UNVERIFIED**: New account (level 0)
- **BASIC**: Basic verification (level 1)
- **VERIFIED**: Identity verified (level 2)
- **HIGH**: Highly verified (level 3+)
- **FLAGGED**: Suspended/reported

## 📊 Database Schema

### Identities Table
```sql
CREATE TABLE identities (
    id VARCHAR(36) PRIMARY KEY,
    phone_hash VARCHAR(256) UNIQUE NOT NULL,
    phone_last4 VARCHAR(4),
    username VARCHAR(64) UNIQUE,
    identity_state VARCHAR(32) DEFAULT 'UNVERIFIED',
    identity_type VARCHAR(32) DEFAULT 'PERSONAL',
    verification_level INT DEFAULT 0,
    trust_signal VARCHAR(32) DEFAULT 'UNVERIFIED',
    tier VARCHAR(16) DEFAULT 'FREE',
    flag_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

See `init_database.py` for complete schema.

## 🧪 Testing

### Test Database Connection
```bash
python test_db_connection.py
```

### Test API with cURL
```bash
# Health check
curl http://localhost:3000/api/health

# Request OTP
curl -X POST http://localhost:3000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919962106567"}'

# Verify OTP
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919962106567", "otp": "123456"}'

# Get user info (replace TOKEN)
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

## 📁 Project Structure

```
hvid_app/
├── app.py                    # Main application
├── models.py                 # Database models
├── extensions.py             # Flask extensions
├── init_database.py          # DB initialization
├── test_db_connection.py     # Connection test
├── requirements.txt          # Dependencies
├── .env                      # Configuration
├── routes/                   # API endpoints
│   ├── auth.py
│   ├── identity.py
│   ├── match.py
│   ├── asset.py
│   ├── report.py
│   ├── kyc.py
│   └── security.py
├── services/                 # Business logic
│   ├── jwt_service.py
│   ├── otp_service.py
│   └── textbee_service.py
├── middleware/               # Middleware
│   └── auth_required.py
├── templates/                # HTML templates
└── static/                   # CSS, JS, images
```

## 🔄 Application Flow

### Registration Flow
1. User visits `/auth/signup`
2. Enters phone number
3. Receives OTP (123456)
4. Verifies OTP
5. Identity created
6. JWT token issued
7. Redirected to dashboard

### Verification Flow
1. User claims asset (Instagram/Website)
2. Verification code generated
3. User adds code to bio/meta tag
4. User clicks verify
5. System validates ownership
6. Verification level increased
7. Trust signal updated

### Search Flow
1. Anyone enters phone/username
2. System looks up identity
3. Returns match status
4. Shows trust signal
5. No private data exposed

## 🐛 Troubleshooting

### Database Connection Failed
```bash
# Check MySQL is running
# Verify credentials in .env
# Test connection
python test_db_connection.py
```

### Module Not Found
```bash
pip install -r requirements.txt
```

### Port Already in Use
Edit `app.py` and change port:
```python
app.run(port=3001)  # Changed from 3000
```

### Tables Not Created
```bash
python init_database.py
```

## 🚀 Deployment

### Production Checklist
- [ ] Change SECRET_KEY and JWT_SECRET_KEY
- [ ] Set strong database password
- [ ] Enable HTTPS/SSL
- [ ] Configure TextBee SMS for real OTP
- [ ] Set up proper logging
- [ ] Add rate limiting
- [ ] Configure CORS properly
- [ ] Set up database backups
- [ ] Use production WSGI server (gunicorn/uwsgi)
- [ ] Set DEBUG=False

### Production Database
```env
DATABASE_URL=mysql+pymysql://user:password@host:port/database
```

### Running in Production
```bash
# Using gunicorn
gunicorn -w 4 -b 0.0.0.0:3000 app:app

# Using uwsgi
uwsgi --http :3000 --wsgi-file app.py --callable app --processes 4
```

## 📝 License

This project is proprietary. All rights reserved.

## 🤝 Contributing

This is a private project. For issues or questions, contact the development team.

## 📞 Support

For technical support:
1. Check documentation in `API_FLOW.md`
2. Review `QUICKSTART.md`
3. Test database with `test_db_connection.py`
4. Check application logs

## 🎯 Roadmap

- [ ] Face verification integration
- [ ] Multi-factor authentication
- [ ] Advanced fraud detection
- [ ] Blockchain integration for immutable records
- [ ] API rate limiting
- [ ] Webhooks for events
- [ ] Advanced analytics dashboard
- [ ] Email verification
- [ ] Social media linking (Twitter, LinkedIn, etc.)

## 📈 Version History

### v1.0.0 (Current)
- Initial release
- Phone authentication with OTP
- JWT token system
- Identity management
- Asset verification (Instagram, Website)
- Trust signal system
- Reporting functionality
- KYC integration
- Admin dashboard

---

**Built with ❤️ for secure identity verification**

For detailed API documentation, see [API_FLOW.md](API_FLOW.md)
