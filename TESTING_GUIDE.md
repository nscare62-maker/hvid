# HVID Application - Complete Testing Guide

## 🎯 Overview

This guide helps you test all features and flows of the HVID application using the sample data we've created.

---

## 📊 Sample Data Available

We've created **5 test accounts** with different verification levels and statuses:

### 1. **deva** - Verified User ✅
- **Phone**: +919962106567
- **OTP**: 123456
- **Verification Level**: 2 (VERIFIED)
- **Trust Signal**: VERIFIED
- **Identity Type**: PERSONAL
- **Tier**: FREE
- **Assets**: 1 Instagram (@deva_official) - VERIFIED
- **KYC**: APPROVED (Passport)

### 2. **testuser** - High Trust Professional 🌟
- **Phone**: +919876543210
- **OTP**: 123456
- **Verification Level**: 3 (HIGH)
- **Trust Signal**: HIGH
- **Identity Type**: PROFESSIONAL
- **Tier**: PREMIUM
- **Assets**: 
  - Instagram (@testuser_pro) - VERIFIED
  - Website (testuser.com) - VERIFIED
- **KYC**: APPROVED (Driver's License)

### 3. **businessuser** - High Trust Business 🏢
- **Phone**: +919988776655
- **OTP**: 123456
- **Verification Level**: 4 (HIGH)
- **Trust Signal**: HIGH
- **Identity Type**: BUSINESS
- **Tier**: PREMIUM
- **Assets**:
  - Instagram (@businessofficial) - VERIFIED
  - Website (mybusiness.com) - VERIFIED
- **KYC**: APPROVED (National ID)

### 4. **newuser** - Unverified New User 🆕
- **Phone**: +919123456789
- **OTP**: 123456
- **Verification Level**: 0 (UNVERIFIED)
- **Trust Signal**: UNVERIFIED
- **Identity Type**: PERSONAL
- **Tier**: FREE
- **Assets**: 1 Instagram (@newuser_account) - PENDING
- **KYC**: PENDING

### 5. **suspendeduser** - Flagged/Suspended ⚠️
- **Phone**: +919555666777
- **OTP**: 123456
- **Verification Level**: 1 (FLAGGED)
- **Trust Signal**: FLAGGED
- **Identity State**: SUSPENDED
- **Tier**: FREE
- **Flag Count**: 3
- **Reports**: 3 reports filed against (IMPERSONATION, FRAUD, SPAM)

---

## 🧪 Testing Flows

### Flow 1: Authentication & Login ✅

#### Test New User Login
1. Navigate to: `http://localhost:3000/auth/login`
2. Enter phone: `+919123456789`
3. Click "Request OTP"
4. Enter OTP: `123456`
5. Click "Verify"
6. **Expected**: Redirected to dashboard with "Welcome newuser"

#### Test Existing User Login
1. Navigate to: `http://localhost:3000/auth/login`
2. Enter phone: `+919962106567`
3. Enter OTP: `123456`
4. **Expected**: Login successful, redirected to dashboard

---

### Flow 2: Dashboard Overview 📊

#### Test Dashboard Components
1. Login as any user
2. Navigate to: `http://localhost:3000/dashboard`
3. **Verify you see**:
   - ✅ User greeting with username
   - ✅ Verification level badge
   - ✅ Trust signal indicator
   - ✅ Quick actions panel
   - ✅ Recent activity (if any)
   - ✅ Verification prompts (if level < 3)

#### Test Different Verification Levels
1. **Login as deva** (Level 2): See "Complete verification" prompts
2. **Login as testuser** (Level 3): See premium features unlocked
3. **Login as newuser** (Level 0): See "Get started" onboarding

---

### Flow 3: Identity Verification Process 🔐

#### Test KYC Start
1. Login as **newuser**
2. Navigate to: `http://localhost:3000/dashboard/verification`
3. Click "Start KYC Verification"
4. **Expected**: 
   - KYC session created
   - Redirect URL provided
   - Status shows "PENDING"

#### Check KYC Status
1. As **newuser**, go to verification page
2. **Expected**: See "KYC Status: PENDING"
3. Login as **deva**
4. **Expected**: See "KYC Status: APPROVED" with document type

---

### Flow 4: Asset Verification (Instagram & Website) 🔗

#### Test Instagram Claim
1. Login as **newuser**
2. Navigate to: `http://localhost:3000/dashboard/linked-accounts`
3. Click "Claim Instagram Account"
4. Enter handle: `@mynewhandle`
5. Click "Claim"
6. **Expected**:
   - Asset created with status "PENDING"
   - Verification code displayed (e.g., hvid-abc123...)
   - Instructions shown: "Add code to bio"

#### Test Website Claim
1. Still as **newuser**, on linked accounts page
2. Click "Claim Website"
3. Enter domain: `mynewsite.com`
4. Click "Claim"
5. **Expected**:
   - Asset created with status "PENDING"
   - Verification code displayed
   - Instructions for meta tag or DNS TXT

#### View Verified Assets
1. Login as **testuser**
2. Navigate to: `http://localhost:3000/dashboard/linked-accounts`
3. **Expected**: See 2 verified assets:
   - ✅ @testuser_pro (Instagram) - VERIFIED
   - ✅ testuser.com (Website) - VERIFIED

---

### Flow 5: Identity Search & Matching 🔍

#### Test Phone Number Search
1. Open: `http://localhost:3000/result`
2. Enter phone: `+919876543210`
3. Click "Check Identity"
4. **Expected**:
   - Result Type: MATCH_CONFIRMED
   - Signal: HIGH
   - Verification Level: 3
   - Username: testuser
   - Identity Type: PROFESSIONAL

#### Test Username Search
1. On result page
2. Enter username: `businessuser`
3. Click "Check Identity"
4. **Expected**:
   - Match found
   - High trust signal
   - Level 4 verification

#### Test Unverified User
1. Search for: `+919123456789` (newuser)
2. **Expected**:
   - Result Type: PARTIAL_MATCH
   - Signal: UNVERIFIED
   - Level: 0

#### Test Suspended User
1. Search for: `+919555666777` (suspendeduser)
2. **Expected**:
   - Result Type: UNDER_REVIEW
   - Signal: FLAGGED
   - State: SUSPENDED

---

### Flow 6: Reporting System 🚨

#### Submit a Report
1. Login as **deva**
2. Find identity to report (e.g., through search)
3. Click "Report This Identity"
4. Select report type: "SPAM"
5. Add description: "Sending unwanted messages"
6. Click "Submit Report"
7. **Expected**:
   - Report ID generated
   - Status: PENDING
   - Confirmation message shown

#### View Existing Reports
1. Login as **testuser**
2. Check: Has filed 1 report against suspendeduser
3. **Expected**: See report listed with status

---

### Flow 7: Identity Management 👤

#### Test Username Update
1. Login as **newuser**
2. Navigate to: `http://localhost:3000/dashboard/identity`
3. Click "Edit Username"
4. Enter new username: `newuser_updated`
5. Click "Save"
6. **Expected**:
   - Username updated successfully
   - Displayed throughout app

#### Test Identity Type Change
1. Still as **newuser**
2. On identity page, click "Change Identity Type"
3. Select: "PROFESSIONAL"
4. **Expected**:
   - Identity type updated
   - Trust signal recalculated
   - Professional features unlocked

---

### Flow 8: Security & Recovery 🔒

#### Check Security Status
1. Login as **deva**
2. Navigate to: `http://localhost:3000/dashboard`
3. Look for security indicators
4. **Expected**:
   - Last activity timestamp
   - Flag count: 0
   - Status: VERIFIED

#### Test Account Recovery (Suspended User)
1. Login as **suspendeduser**
2. **Expected**: See warning/notice about suspension
3. Click "Start Recovery"
4. **Expected**: Recovery process initiated

---

### Flow 9: Tier System & Upgrades 📈

#### Test Free Tier
1. Login as **newuser**
2. **Expected**: See "FREE" tier badge
3. Click "Upgrade"
4. **Expected**: Prompted to complete verification

#### Test Premium Tier
1. Login as **testuser**
2. **Expected**: See "PREMIUM" tier badge
3. **Expected**: Access to advanced features

---

### Flow 10: Admin Features 👨‍💼

#### View All Identities (Admin)
1. Navigate to: `http://localhost:3000/admin/identity-search`
2. Search for any user
3. **Expected**: See detailed identity information

#### View Reports (Admin)
1. Navigate to: `http://localhost:3000/admin/reports`
2. **Expected**: See all 3 reports filed
3. Click on a report to view details

#### View High-Risk Identities (Admin)
1. Navigate to: `http://localhost:3000/admin/high-risk`
2. **Expected**: See **suspendeduser** listed
3. See flag count: 3

---

## 🔬 API Testing

### Test with cURL

#### 1. Request OTP
```bash
curl -X POST http://localhost:3000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

#### 2. Verify OTP & Get Token
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "otp": "123456"}'
```
Save the token from response!

#### 3. Get Current User
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### 4. Check Identity Match
```bash
curl -X POST http://localhost:3000/api/match/check \
  -H "Content-Type: application/json" \
  -d '{"type": "username", "value": "testuser"}'
```

#### 5. Get Identity Details
```bash
curl -X GET http://localhost:3000/api/identity/IDENTITY_ID_HERE
```

#### 6. List Assets
```bash
curl -X GET http://localhost:3000/api/asset/IDENTITY_ID_HERE \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## ✅ Feature Checklist

Use this checklist to verify all features work:

### Authentication
- [ ] Login with phone + OTP
- [ ] Token generation
- [ ] Token validation
- [ ] Logout

### Identity Management
- [ ] View identity details
- [ ] Update username
- [ ] Change identity type
- [ ] View trust signal
- [ ] View verification level

### Asset Management
- [ ] Claim Instagram account
- [ ] Claim website
- [ ] View verification code
- [ ] See verification instructions
- [ ] List all assets
- [ ] View asset status

### Verification
- [ ] Start KYC process
- [ ] View KYC status
- [ ] See verification level
- [ ] Trust signal updates

### Search & Matching
- [ ] Search by phone number
- [ ] Search by username
- [ ] Search by identity ID
- [ ] View public profile
- [ ] See trust indicators

### Reporting
- [ ] Submit report
- [ ] View report status
- [ ] Select report type
- [ ] Add evidence

### Security
- [ ] View security status
- [ ] Check last activity
- [ ] Flag count display
- [ ] Account recovery

### Dashboard
- [ ] View overview
- [ ] See verification prompts
- [ ] Quick actions
- [ ] Navigation

### Admin Features
- [ ] Identity search
- [ ] View reports
- [ ] High-risk identities
- [ ] Report details

---

## 🐛 Known Issues to Test

1. **Verification Code Display**: Should be unique per user
2. **Asset Verification**: Backend validation (Instagram/Website fetching)
3. **Phone Number Formats**: Should accept various formats (+91, +1, etc.)
4. **Token Expiration**: Should show error after 7 days
5. **Suspended User Access**: Should show limited features

---

## 📝 Test Scenarios

### Scenario 1: New User Onboarding
1. Register as new user
2. See onboarding prompts
3. Set username
4. Choose identity type
5. View "Get started" tasks

### Scenario 2: Complete Verification Journey
1. Start as unverified (newuser)
2. Claim Instagram account
3. "Verify" Instagram (note: actual verification needs real bio)
4. Start KYC process
5. Watch verification level increase

### Scenario 3: High Trust User Experience
1. Login as testuser (Level 3)
2. View premium features
3. See verified badges
4. Access all functionality

### Scenario 4: Flagged User Flow
1. Login as suspendeduser
2. See suspension notice
3. Limited functionality
4. Start recovery process

### Scenario 5: Identity Search
1. Search for verified user
2. View trust indicators
3. See verification level
4. Check assets (if public)

---

## 🎭 Different User Perspectives

### As a New User (newuser)
- Focus on onboarding
- Complete first verification
- Learn the system

### As a Verified User (deva)
- Standard functionality
- Asset management
- Regular features

### As a Professional (testuser)
- Premium features
- Multiple assets
- High trust interactions

### As a Business (businessuser)
- Business-specific features
- Multiple verified assets
- Highest trust level

### As a Flagged User (suspendeduser)
- Restricted access
- Recovery options
- Appeal process

---

## 🚀 Quick Start Testing

### Run All Tests
```bash
# Start the application
python app.py

# In another terminal, run API tests
python test_api.py

# Test database
python test_db_connection.py
```

### Reset and Reseed Data
```bash
# Reinitialize database
python init_database.py

# Reseed sample data
python seed_sample_data.py
```

---

## 📊 Expected Results Summary

| User | Level | Signal | Assets | KYC | Reports |
|------|-------|--------|--------|-----|---------|
| deva | 2 | VERIFIED | 1 ✓ | ✓ APPROVED | 0 |
| testuser | 3 | HIGH | 2 ✓ | ✓ APPROVED | 1 filed |
| businessuser | 4 | HIGH | 2 ✓ | ✓ APPROVED | 1 filed |
| newuser | 0 | UNVERIFIED | 1 ⏳ | ⏳ PENDING | 0 |
| suspendeduser | 1 | FLAGGED | 0 | - | 3 against |

---

## 🎯 Success Criteria

All features should work without errors:
- ✅ No 404 errors on navigation
- ✅ All buttons functional
- ✅ Data displays correctly
- ✅ API responses valid
- ✅ Database updates persist
- ✅ Authentication works
- ✅ Routing is correct

---

## 📞 Need Help?

If you encounter issues:
1. Check application logs in terminal
2. Run `python test_api.py`
3. Check database: `python test_db_connection.py`
4. Verify sample data: Look for 5 identities, 6 assets, 4 KYC, 3 reports

---

**Happy Testing! 🎉**

All sample data is ready to test every feature and flow in the HVID application.
