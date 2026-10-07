# KYC Verification "Please Sign In" Error - Fix Summary

## Problem
When clicking "Start KYC Verification" button, users were seeing the error:
**"Please sign in to start verification"**

Even though they were already logged in and authenticated.

## Root Cause
There was an **inconsistency in property naming** across the frontend codebase:

1. **Backend API response** (`/api/auth/verify-otp`) returns: `identity_id`
2. **Frontend auth.js** was storing session with: `identityId` (camelCase)
3. **verification-flow.js** was looking for: `identity_id` (snake_case)
4. **Mismatch**: When verification-flow.js tried to read `session().identity_id`, it got `null` because the session only had `identityId`

## Files Fixed

### 1. `static/js/auth.js`
**Changed**: `loginWithToken()` function now stores BOTH property names for backward compatibility:
```javascript
const session = {
  identity_id:       identityId,  // Backend returns identity_id
  identityId:        identityId,  // Keep both for compatibility
  hvid:              identityId,
  // ... rest of session data
};
```

### 2. `static/js/verification-flow.js`
**Changed**: `identityId()` helper now checks for BOTH property names:
```javascript
const identityId = () => {
  const s = session();
  return s.identity_id || s.identityId || null;
};
```

### 3. `static/js/auth-context.js`
**Changed**: `_sync()` function now checks for BOTH property names:
```javascript
try {
  const sess  = window.Auth && Auth.getSession();
  _identityId = (sess && (sess.identity_id || sess.identityId)) || null;
} catch (_) {}
```

### 4. `static/js/signal-status.js`
**Changed**: `identityId()` helper now checks for BOTH property names:
```javascript
const identityId = () => {
  const s = session();
  return s.identity_id || s.identityId || null;
};
```

## Testing Instructions

1. **Clear browser storage** (to remove any old sessions with mismatched property names):
   - Open DevTools → Application → Local Storage → Clear All

2. **Login flow**:
   - Go to http://localhost:3000/auth/login
   - Enter phone: `+919962106567`
   - Enter OTP: `123456`
   - Click "Verify Code"
   - Should redirect to dashboard

3. **Test KYC Verification**:
   - Go to Dashboard → Verification page
   - Click "Start KYC Verification" button
   - Should now show "Starting..." and redirect (not the "Please sign in" error)

4. **Verify session data**:
   - Open DevTools → Console
   - Type: `JSON.parse(localStorage.getItem('hvid_session'))`
   - Should see BOTH `identity_id` and `identityId` properties with the same UUID value

## Why This Fix Works

The fix implements a **fail-safe approach** by:
1. **Storing both property names** when creating a session (auth.js)
2. **Checking both property names** when reading from session (all files)
3. **Maintaining backward compatibility** with existing sessions

This ensures:
- New logins work correctly with both property names
- Old sessions (if any exist) still work by checking both names
- All parts of the codebase can access identity_id regardless of which property name they expect

## Prevention

To prevent similar issues in the future:
- **Standardize on one naming convention** across frontend and backend
- **Add TypeScript** for type safety and catch property name mismatches at compile time
- **Add integration tests** that verify the full login → verification flow
