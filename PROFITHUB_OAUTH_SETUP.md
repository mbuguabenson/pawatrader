# ProfitHub.co.ke OAuth Setup Guide

## Current Issue

You're getting this error when trying to login on `www.profithub.co.ke`:

```
error=invalid_request&error_description=The+request+is+missing+a+required+parameter...
The 'redirect_uri' parameter does not match any of the OAuth 2.0 Client's pre-registered redirect urls.
```

## Why This Happens

The system is currently configured to use the **Brixxie OAuth app** (CLIENT_ID: `33EmTMY5M3NMHve0SU8tY`) which is registered with Deriv for `brixxie-theta.vercel.app`. When you access the app on `www.profithub.co.ke`, the redirect_uri doesn't match because:

1. **Wrong CLIENT_ID**: Using Brixxie's CLIENT_ID instead of ProfitHub's
2. **Unregistered Redirect URI**: `https://www.profithub.co.ke/callback` isn't registered with the Deriv OAuth app

## Solution: Register ProfitHub with Deriv OAuth

You need to create a NEW OAuth app with Deriv for the ProfitHub domain.

### Step 1: Create OAuth App with Deriv

1. Go to https://api.deriv.com/apps
2. Click "Add New App"
3. Fill in the form:
   - **App Name**: ProfitHub Trading Bot
   - **App Description**: Automated trading bot for ProfitHub
   - **Redirect URI**: Add `https://www.profithub.co.ke/callback`
   - **App Type**: Web
4. Click "Create"
5. You'll receive:
   - **CLIENT_ID**: Copy this value
   - **APP_ID**: Note this if provided

### Step 2: Configure Environment Variables

Set these environment variables in your production deployment (e.g., Vercel, netlify, or your server):

```bash
# For www.profithub.co.ke OAuth app
PROFITHUB_CLIENT_ID=<paste_your_new_client_id_here>
PROFITHUB_APP_ID=<paste_your_app_id_or_use_default>
PROFITHUB_REDIRECT_URI=https://www.profithub.co.ke/callback
```

**Where to set these:**

**For Vercel Deployment:**
1. Go to your Vercel project dashboard
2. Settings → Environment Variables
3. Add each variable above
4. Redeploy your application

**For Local Development (.env):**
```bash
# .env.local (for development)
PROFITHUB_CLIENT_ID=your_profithub_client_id
PROFITHUB_APP_ID=80058
PROFITHUB_REDIRECT_URI=https://www.profithub.co.ke/callback
```

**For Netlify:**
1. Site settings → Build & Deploy → Environment
2. Add the variables
3. Trigger a redeploy

### Step 3: Verify Configuration

The domain configuration in code (`src/components/shared/utils/config/config.ts`) now includes:

```typescript
'www.profithub.co.ke': {
    clientId: process.env.PROFITHUB_CLIENT_ID || 'YOUR_PROFITHUB_CLIENT_ID',
    appId: process.env.PROFITHUB_APP_ID || '80058',
    redirectUri: process.env.PROFITHUB_REDIRECT_URI || 'https://www.profithub.co.ke/callback',
    botsFolder: 'brixxie',
    includeLegacyAppIdInOAuth: true,
}
```

Once environment variables are set, the system will:
1. Use the correct CLIENT_ID for www.profithub.co.ke
2. Send the correct redirect_uri to Deriv OAuth
3. Deriv will recognize and accept the request

### Step 4: Test Login

1. Clear your browser cache and cookies
2. Navigate to `https://www.profithub.co.ke/`
3. Click "Login" or "Sign Up"
4. You should be redirected to Deriv OAuth without errors

## Redirect URI Variations

If you get errors, the redirect_uri must match **exactly** what's registered with Deriv. Common variations to try:

- `https://www.profithub.co.ke/callback` ← **Recommended**
- `https://www.profithub.co.ke/` (without /callback)
- `https://profithub.co.ke/callback` (without www)

Once you register one, use that exact URI in your environment variables.

## Staging vs Production

**For Staging (localhost/dev):**
```bash
CLIENT_ID=33EmTMY5M3NMHve0SU8tY  # Use Brixxie CLIENT_ID for testing
REDIRECT_URI=http://localhost:8080/callback
```

**For Production (www.profithub.co.ke):**
```bash
PROFITHUB_CLIENT_ID=<your_profithub_client_id>
PROFITHUB_REDIRECT_URI=https://www.profithub.co.ke/callback
```

## Debugging

### Test what CLIENT_ID is being used:

Open browser console on `https://www.profithub.co.ke/` and run:

```javascript
// Check the domain config
fetch('/__DOMAIN_CONFIG__').then(r => r.json()).then(console.log);

// Or check from the error URL
const errorUrl = new URL(window.location.href);
console.log('Current hostname:', window.location.hostname);
console.log('OAuth error:', errorUrl.searchParams.get('error_description'));
```

### Verify environment variables are set:

Check Vercel/Netlify logs to confirm variables are loaded:

```bash
# In your deployment logs, you should see:
NODE_ENV=production
PROFITHUB_CLIENT_ID=<not_shown_in_logs_for_security>
```

## Common Errors

### Error: "invalid_request - redirect_uri does not match"

**Causes:**
1. Redirect URI not registered with Deriv OAuth app
2. Environment variables not set or redeployed
3. Protocol mismatch (http vs https)
4. Domain mismatch (www vs non-www)

**Solution:**
1. Verify redirect_uri is registered in Deriv OAuth app dashboard
2. Confirm environment variables are set and deployment is live
3. Ensure HTTPS for production
4. Use exact domain registered with Deriv

### Error: "invalid_client - Client authentication failed"

**Cause:** Wrong CLIENT_ID

**Solution:**
1. Double-check PROFITHUB_CLIENT_ID is correct
2. Verify you're using ProfitHub's CLIENT_ID, not Brixxie's

### Error: "invalid_grant - The provided authorization code is invalid"

**Cause:** Code verifier mismatch (PKCE issue)

**Solution:**
1. Clear browser sessionStorage
2. Clear browser cache
3. Try in incognito/private mode
4. Try a different browser

## Configuration Files Reference

**Domain Config Location:**
- [src/components/shared/utils/config/config.ts](src/components/shared/utils/config/config.ts) (Lines 35-55)

**Brand Config Location:**
- [brand.config.json](brand.config.json) - Contains domain and OAuth URLs

**Callback Handler:**
- [api/token.ts](api/token.ts) - Backend token exchange endpoint

## Next Steps

1. ✅ Register `https://www.profithub.co.ke/callback` with Deriv OAuth
2. ✅ Get your PROFITHUB_CLIENT_ID from Deriv
3. ✅ Set environment variables in production
4. ✅ Redeploy the application
5. ✅ Test login flow

Once complete, users can log in via `https://www.profithub.co.ke/`

## Support

- **Deriv OAuth Docs**: https://api.deriv.com
- **PKCE Reference**: [OAUTH_PKCE_IMPLEMENTATION_GUIDE.md](OAUTH_PKCE_IMPLEMENTATION_GUIDE.md)
- **API Implementation**: [NEW_APP_API_SUMMARY.md](NEW_APP_API_SUMMARY.md)
