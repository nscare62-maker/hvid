# HVID - Quick Start Guide

## 🚀 Getting Started in 3 Steps

### Step 1: Install Dependencies
```bash
pip install -r requirements.txt
```

This installs:
- Flask (web framework)
- PyMySQL (MySQL connector)
- JWT (authentication)
- And other required packages

### Step 2: Initialize Database
```bash
python init_database.py
```

This will:
- Connect to MySQL at <MYSQL_HOST>:3306
- Create database `flask_db` tables
- Set up all required tables with proper relationships

### Step 3: Run the Application
```bash
python app.py
```

Or use the batch file:
```bash
run.bat
```

The application will start on: **http://localhost:3000**

---

## 🔐 Default Login Credentials

- **Phone Number**: +919962106567
- **OTP Code**: 123456
- **Username**: deva

---

## 🧪 Testing the Application

### 1. Test Database Connection
```bash
python test_db_connection.py
```

This verifies:
- MySQL server connectivity
- Database accessibility
- Tables existence
- Row counts

### 2. Access the Frontend
Open your browser and navigate to:
- Homepage: http://localhost:3000
- Login: http://localhost:3000/auth/login
- Dashboard: http://localhost:3000/dashboard

### 3. Test API Endpoints

#### Health Check
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "HVID is running"
}
```

#### Request OTP
```bash
curl -X POST http://localhost:3000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"+919962106567\"}"
```

#### Verify OTP & Get Token
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"+919962106567\", \"otp\": \"123456\"}"
```

Save the token from the response!

#### Get Current User (Authenticated)
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 📁 Project Structure

```
hvid_app/
├── app.py                    # Main application entry point
├── models.py                 # Database models (SQLAlchemy)
├── extensions.py             # Flask extensions (db, migrate)
├── init_database.py          # Database initialization script
├── test_db_connection.py     # Connection test utility
├── requirements.txt          # Python dependencies
├── .env                      # Environment variables
├── run.bat                   # Windows startup script
│
├── routes/                   # API endpoints
│   ├── auth.py              # Authentication (OTP, JWT)
│   ├── identity.py          # Identity management
│   ├── match.py             # Identity matching/search
│   ├── asset.py             # Asset verification (Instagram, Website)
│   ├── report.py            # Reporting system
│   ├── kyc.py               # KYC verification
│   └── security.py          # Security & recovery
│
├── services/                 # Business logic
│   ├── jwt_service.py       # JWT token generation/validation
│   ├── otp_service.py       # OTP generation/hashing
│   └── textbee_service.py   # SMS service integration
│
├── middleware/               # Request middleware
│   └── auth_required.py     # JWT authentication decorator
│
├── templates/                # HTML pages (Jinja2)
│   ├── index.html
│   ├── auth/
│   ├── dashboard/
│   └── admin/
│
└── static/                   # Frontend assets
    ├── css/
    └── js/
```

---

## 🗄️ Database Tables

The application uses 5 main tables:

1. **identities** - User accounts and identity records
2. **otp_sessions** - OTP verification sessions
3. **assets** - Instagram/Website ownership claims
4. **reports** - User-submitted reports
5. **kyc_submissions** - KYC document submissions

All tables have proper foreign key relationships and indexes.

---

## 🔄 Application Flow

### User Registration & Login
1. User enters phone number
2. System sends/displays OTP (default: 123456)
3. User verifies OTP
4. System creates/retrieves identity
5. JWT token issued (7-day validity)
6. User redirected to dashboard

### Identity Verification
1. User claims asset (Instagram or Website)
2. System generates verification code
3. User adds code to bio/meta tag
4. User clicks verify
5. System checks for code presence
6. Verification level increases
7. Trust signal updated

### Identity Search
1. Anyone enters phone/username
2. System hashes and looks up identity
3. Returns match status and trust signal
4. No private data exposed

---

## 🛠️ Configuration

### Environment Variables (.env)
```env
SECRET_KEY=hvid-secret-key-dev-2024-change-in-production
JWT_SECRET_KEY=hvid-jwt-secret-dev-2024-change-in-production
DATABASE_URL=mysql+pymysql://<MYSQL_USER>:<MYSQL_PASSWORD>@<MYSQL_HOST>:3306/<MYSQL_DATABASE>
TEXTBEE_API_KEY=your-api-key
TEXTBEE_DEVICE_ID=your-device-id
OTP_EXPIRY_MINUTES=10
MAX_OTP_ATTEMPTS=3
```

### Database Configuration
- **Host**: <MYSQL_HOST>
- **Port**: 3306
- **Database**: <MYSQL_DATABASE>
- **User**: <MYSQL_USER>
- **Password**: <MYSQL_PASSWORD>
- **Charset**: utf8mb4

---

## 🔍 Troubleshooting

### Database Connection Failed
```bash
# Test connection
python test_db_connection.py

# Check if MySQL is running
# Verify host IP and port
# Confirm credentials
```

### Tables Not Created
```bash
# Re-run initialization
python init_database.py
```

### Module Not Found Error
```bash
# Reinstall dependencies
pip install -r requirements.txt
```

### Port 3000 Already in Use
Edit `app.py` and change the port:
```python
app.run(host='0.0.0.0', port=3001, debug=True)
```

---

## 📚 Additional Resources

- **API Documentation**: See `API_FLOW.md`
- **Database Schema**: See `init_database.py`
- **Frontend Routes**: See `app.py` (line 90+)

---

## 🎯 Next Steps

1. ✅ Set up the database
2. ✅ Run the application
3. ✅ Test authentication flow
4. ✅ Create an identity
5. ✅ Claim and verify assets
6. ✅ Test identity matching

---

## 📞 Support

For issues or questions:
1. Check the logs in the terminal
2. Review `API_FLOW.md` for detailed endpoints
3. Test database connection with `test_db_connection.py`

---

## 🔒 Security Notes

- Default OTP (123456) is for development only
- Phone numbers are hashed with HMAC-SHA256
- JWT tokens expire after 7 days
- All passwords/secrets should be changed in production
- HTTPS should be enabled in production
- Rate limiting should be added for production use

---

## ✨ Features

✅ Phone-based authentication (OTP)  
✅ JWT token authentication  
✅ Identity management  
✅ Asset verification (Instagram, Website)  
✅ Trust signal system  
✅ Identity matching/search  
✅ Reporting system  
✅ KYC verification  
✅ Account recovery  
✅ Admin dashboard  

---

**Ready to go!** 🚀

Start with: `python init_database.py` then `python app.py`
