# HVID - Quick Reference Card

## 🚀 Quick Start
```bash
python app.py                    # Start application
python test_api.py              # Test all APIs
python test_db_connection.py    # Check database
python seed_sample_data.py      # Create sample data
```

## 🔐 Test Accounts (OTP: 123456)

| Phone | Username | Level | Signal | Type |
|-------|----------|-------|--------|------|
| +919962106567 | deva | 2 | VERIFIED | PERSONAL |
| +919876543210 | testuser | 3 | HIGH | PROFESSIONAL |
| +919988776655 | businessuser | 4 | HIGH | BUSINESS |
| +919123456789 | newuser | 0 | UNVERIFIED | PERSONAL |
| +919555666777 | suspendeduser | 1 | FLAGGED | SUSPENDED |

## 🌐 Main URLs

| Page | URL |
|------|-----|
| Homepage | http://localhost:3000 |
| Login | http://localhost:3000/auth/login |
| Dashboard | http://localhost:3000/dashboard |
| Identity | http://localhost:3000/dashboard/identity |
| Verification | http://localhost:3000/dashboard/verification |
| Linked Accounts | http://localhost:3000/dashboard/linked-accounts |
| Timeline | http://localhost:3000/dashboard/timeline |
| Search | http://localhost:3000/result |

## 📡 API Endpoints

### Authentication
```
POST /api/auth/request-otp      # Request OTP
POST /api/auth/verify-otp       # Verify & get token
GET  /api/auth/me               # Current user (auth)
```

### Identity
```
GET    /api/identity/:id                # Get identity
PATCH  /api/identity/:id/type           # Update type
PATCH  /api/identity/:id/username       # Update username
```

### Assets
```
POST   /api/asset/claim                 # Claim asset
POST   /api/asset/verify/instagram      # Verify Instagram
POST   /api/asset/verify/website        # Verify website
GET    /api/asset/:identityId           # List assets
```

### Matching
```
POST   /api/match/check                 # Check identity
```

### KYC
```
POST   /api/kyc/start                   # Start KYC
POST   /api/kyc/submit                  # Submit docs
GET    /api/kyc/status                  # Get status
```

### Reports
```
POST   /api/report/submit               # Submit report
```

### Security
```
GET    /api/security/status/:id         # Security status
POST   /api/security/recover/start      # Start recovery
POST   /api/security/recover/complete   # Complete recovery
```

## 🗄️ Database Tables

| Table | Description | Sample Count |
|-------|-------------|--------------|
| identities | User accounts | 5 |
| assets | Instagram/Website | 6 |
| kyc_submissions | KYC docs | 4 |
| reports | User reports | 3 |
| otp_sessions | OTP sessions | 3 |

## 🔧 Configuration

### Database (MySQL)
```
Host: <MYSQL_HOST>
Port: 3306
Database: flask_db
User: <MYSQL_USER>
Password: <MYSQL_PASSWORD>
```

### Application
```
Port: 3000
Debug: True
Default OTP: 123456
JWT Expiry: 7 days
```

## 🎯 Verification Levels

| Level | Signal | Description |
|-------|--------|-------------|
| 0 | UNVERIFIED | New account |
| 1 | BASIC | Basic verification |
| 2 | VERIFIED | Identity verified |
| 3+ | HIGH | Highly verified |
| - | FLAGGED | Suspended/reported |

## 🏷️ Identity Types

- **PERSONAL** - Individual users
- **PROFESSIONAL** - Work/freelance accounts
- **BUSINESS** - Business entities

## 💎 Tiers

- **FREE** - Standard features
- **PREMIUM** - Advanced features
- **ENTERPRISE** - Full features

## 📊 Trust Signals

- 🟢 **HIGH** - Highly trusted (level 3+)
- 🔵 **VERIFIED** - Verified identity (level 2)
- 🟡 **BASIC** - Basic verification (level 1)
- ⚪ **UNVERIFIED** - No verification (level 0)
- 🔴 **FLAGGED** - Suspended/reported

## 🧪 Test Flow

1. **Login**: Use any test account with OTP 123456
2. **View Dashboard**: Check verification level
3. **Claim Asset**: Add Instagram or Website
4. **Start KYC**: Begin verification process
5. **Check Status**: View verification progress
6. **Search Identity**: Test matching system

## 📝 Sample Data

- ✅ 5 identities (all verification levels)
- ✅ 6 assets (verified & pending)
- ✅ 4 KYC submissions (approved & pending)
- ✅ 3 reports (different types)

## 🛠️ Troubleshooting

### App won't start
```bash
pip install -r requirements.txt
python test_db_connection.py
```

### 404 errors
- Check route matches `/dashboard/*` format
- Clear browser cache (Ctrl+F5)

### Database issues
```bash
python test_db_connection.py
python init_database.py
```

### No sample data
```bash
python seed_sample_data.py
```

## 📚 Documentation Files

- `README.md` - Complete overview
- `QUICKSTART.md` - Setup guide
- `API_FLOW.md` - Detailed API docs
- `TESTING_GUIDE.md` - Testing procedures
- `SETUP_COMPLETE.md` - Setup verification
- `ROUTING_FIXES.md` - Route corrections

## 🎯 Common Tasks

### Reset Everything
```bash
python init_database.py
python seed_sample_data.py
python app.py
```

### Test API
```bash
python test_api.py
```

### Check Status
```bash
python test_db_connection.py
```

---

**Application**: http://localhost:3000  
**Default OTP**: 123456  
**Status**: ✅ Running
