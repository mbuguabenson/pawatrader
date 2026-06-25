# OAuth 2.0 PKCE Authentication System - Complete Documentation

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Key Features](#key-features)
5. [File Structure](#file-structure)
6. [Installation](#installation)
7. [Usage Guide](#usage-guide)
8. [API Reference](#api-reference)
9. [Security Considerations](#security-considerations)
10. [Troubleshooting](#troubleshooting)
11. [Deployment](#deployment)

---

## 📊 Overview

This is a **production-ready OAuth 2.0 PKCE authentication system** designed specifically for trading platforms. It includes:

- ✅ **OAuth 2.0 Authorization Code Flow** with PKCE (SHA256 code challenge)
- ✅ **Automatic Token Refresh** with intelligent scheduling
- ✅ **Secure Session Management** with encryption and inactivity timeout
- ✅ **Legacy App ID Support** for backward compatibility
- ✅ **Admin Configuration Wizard** for zero-config setup
- ✅ **Real-time Status Monitoring** with WebSocket support
- ✅ **Enterprise Security** (rate limiting, CSRF protection, CSP headers)
- ✅ **Multiple Deployment Options** (Vercel, AWS, Docker, GitHub Actions)

---

## 🏗️ Architecture

### Frontend Stack

- **React 18** with TypeScript
- **Tailwind CSS** for UI
- **Lucide Icons** for interface elements
- **Service Architecture** for separation of concerns

### Core Services

```
┌─────────────────────────────────────────────────────┐
│                   Application Layer                  │
├─────────────────────────────────────────────────────┤
│   Components (UI) ← Hooks (useOAuth, etc.)          │
├─────────────────────────────────────────────────────┤
│         Service Layer (Business Logic)               │
│  ┌─────────────┬──────────────┬─────────────────┐   │
│  │   OAuth     │   Token      │    Session      │   │
│  │ FlowService │   Manager    │    Manager      │   │
│  └─────────────┴──────────────┴─────────────────┘   │
├─────────────────────────────────────────────────────┤
│   Utilities Layer                                    │
│  ┌──────────────┬──────────────┬────────────────┐   │
│  │  PKCE        │  Config      │  Encryption    │   │
│  │  Service     │  Manager     │  Utils         │   │
│  └──────────────┴──────────────┴────────────────┘   │
├─────────────────────────────────────────────────────┤
│         Storage Layer (localStorage, sessionStorage) │
└─────────────────────────────────────────────────────┘
```

### Backend Stack

- **Node.js** with Express.js or Fastify
- **PostgreSQL** for persistent storage
- **Redis** for caching and rate limiting
- **WebSockets** for real-time authentication

---

## 🚀 Quick Start

### Step 1: Import and Initialize

```typescript
import AuthConfigManager from '@/services/auth/AuthConfigManager';
import OAuthFlowService from '@/services/auth/OAuthFlowService';

// Initialize OAuth configuration
await AuthConfigManager.initialize({
    siteUrl: 'https://trading-platform.com',
    clientId: 'your-client-id',
    authorizationUrl: 'https://auth.provider.com/oauth2/authorize',
    tokenUrl: 'https://auth.provider.com/oauth2/token',
    redirectUri: 'https://trading-platform.com/api/oauth/callback',
    scopes: ['read', 'trade', 'payments'],
});
```

### Step 2: Start Authentication

```typescript
// Start OAuth flow
await OAuthFlowService.startAuthorizationFlow({
    prompt: 'login',
});

// Handle callback after redirect
const token = await OAuthFlowService.handleCallback({
    code: urlParams.code,
    state: urlParams.state,
});
```

### Step 3: Use in React Components

```typescript
import { useOAuth } from '@/hooks/useOAuth';

function MyComponent() {
    const { isAuthenticated, logout, getValidAccessToken } = useOAuth();

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return <Dashboard />;
}
```

### Step 4: Monitor Status

```typescript
import { AuthStatusDashboard } from '@/components/auth/AuthStatusComponents';

function StatusBar() {
    return <AuthStatusDashboard />;
}
```

---

## 🔐 Key Features

### 1. PKCE (Proof Key for Public Clients)

- **SHA256 Code Challenge**: Cryptographically secure
- **State Parameter**: CSRF protection with expiry
- **Session Storage**: Secure verifier storage

### 2. Token Lifecycle Management

```
Token Lifecycle:
├─ Store: storeToken(response)
├─ Retrieve: getAccessToken()
├─ Validate: isTokenExpired()
├─ Refresh: refreshAccessToken()
└─ Clear: clearTokens()
```

### 3. Automatic Token Refresh

- Refreshes **5 minutes before expiry**
- **Prevents multiple simultaneous refreshes**
- **Automatic on app startup** if token exists

### 4. Session Recovery

- **Encrypted session storage**
- **Inactivity timeout** (30 minutes default)
- **Manual recovery** option on expiry

### 5. Admin Configuration

- **Step-by-step wizard** for OAuth setup
- **Endpoint validation** and testing
- **Automatic .env generation**
- **Multiple deployment formats**

---

## 📁 File Structure

```
src/
├── services/auth/
│   ├── AuthConfigManager.ts           # Configuration management
│   ├── TokenManager.ts                # Token lifecycle
│   ├── PKCEService.ts                # PKCE implementation
│   ├── SessionManager.ts              # Session management
│   ├── OAuthFlowService.ts           # OAuth orchestration
│   ├── ConfigurationGenerator.ts      # Config export
│   └── backend-auth-endpoints.ts     # Backend docs
│
├── components/auth/
│   ├── OAuthOnboardingWizard.tsx      # Setup wizard
│   └── AuthStatusComponents.tsx       # Status UI
│
├── hooks/
│   └── useOAuth.ts                   # React hooks
│
├── types/
│   └── oauth-types.ts                # Type definitions
│
├── examples/
│   └── OAuthImplementationExamples.tsx # Example implementations
│
└── public/
    └── [OAuth callback HTML]

Configuration Files:
├── OAUTH_PKCE_IMPLEMENTATION.md       # Implementation guide
├── OAUTH.md                          # OAuth overview
└── DEPLOYMENT_GUIDE.md               # Deployment instructions
```

---

## 📦 Installation

### 1. Add Required Dependencies

```bash
npm install --save \
  crypto-js \
  lucide-react \
  clsx \
  js-cookie
```

### 2. Copy Service Files

All service files are located in `src/services/auth/`. They are already integrated into your project.

### 3. Setup Environment Variables

```env
# Frontend
REACT_APP_SITE_URL=https://trading-platform.com
REACT_APP_OAUTH_CLIENT_ID=your-client-id
REACT_APP_OAUTH_AUTHORIZATION_URL=https://auth.provider.com/oauth2/authorize
REACT_APP_OAUTH_TOKEN_URL=https://auth.provider.com/oauth2/token
REACT_APP_OAUTH_REDIRECT_URI=https://trading-platform.com/api/oauth/callback
REACT_APP_OAUTH_SCOPES=read,trade,payments,trading_information

# Backend
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-secret
OAUTH_TOKEN_URL=https://auth.provider.com/oauth2/token
```

### 4. Create OAuth Callback Page

```typescript
// pages/oauth-callback.tsx
import { OAuthCallbackPage } from '@/examples/OAuthImplementationExamples';

export default OAuthCallbackPage;
```

---

## 🎯 Usage Guide

### Basic Login Flow

```typescript
import { useOAuth } from '@/hooks/useOAuth';

function LoginComponent() {
    const { login, isLoading, error } = useOAuth();

    return (
        <button onClick={() => login({ prompt: 'login' })}>
            {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
    );
}
```

### Protected Routes

```typescript
import { ProtectedRoute } from '@/examples/OAuthImplementationExamples';

<Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route
        path="/dashboard"
        element={
            <ProtectedRoute>
                <TradingDashboard />
            </ProtectedRoute>
        }
    />
</Routes>
```

### Authenticated API Calls

```typescript
import { useOAuthAPI } from '@/hooks/useOAuth';

function MyComponent() {
    const { fetchAuthenticated } = useOAuthAPI();

    async function fetchUserData() {
        const response = await fetchAuthenticated('/api/user/data');
        const data = await response.json();
        return data;
    }

    return (
        <button onClick={fetchUserData}>
            Load Data
        </button>
    );
}
```

### Token Status Monitoring

```typescript
import { useTokenStatus } from '@/hooks/useOAuth';

function TokenStatus() {
    const { isExpiringSoon, timeUntilExpiry } = useTokenStatus();

    return (
        <div>
            {isExpiringSoon && (
                <p>Token expires in {Math.round(timeUntilExpiry / 60000)}m</p>
            )}
        </div>
    );
}
```

### Session Recovery

```typescript
import { useOAuth } from '@/hooks/useOAuth';
import { SessionRecoveryUI } from '@/components/auth/AuthStatusComponents';

function MyComponent() {
    const { recoverSession, logout } = useOAuth();

    return (
        <SessionRecoveryUI
            onRecover={() => recoverSession()}
            onLogout={() => logout()}
        />
    );
}
```

### Admin Configuration Wizard

```typescript
import { OAuthOnboardingWizard } from '@/components/auth/OAuthOnboardingWizard';

function AdminPage() {
    return (
        <OAuthOnboardingWizard
            onComplete={async () => {
                console.log('Configuration complete');
            }}
        />
    );
}
```

---

## 📚 API Reference

### AuthConfigManager

```typescript
// Initialize from environment or storage
await AuthConfigManager.initialize(config?);

// Set configuration
await AuthConfigManager.setConfig(config);

// Get configuration
AuthConfigManager.getConfig();
AuthConfigManager.getSensitiveConfig();

// Test endpoints
const result = await AuthConfigManager.testConnections();

// Export
AuthConfigManager.exportConfiguration();

// Clear
AuthConfigManager.clearConfig();
```

### TokenManager

```typescript
// Store and retrieve
TokenManager.storeToken(response);
TokenManager.getAccessToken();
TokenManager.getRefreshToken();

// Check status
TokenManager.isTokenExpired();
TokenManager.isTokenExpiringSoon();
TokenManager.getTimeUntilExpiry();

// Listeners
TokenManager.onTokenRefresh(listener);
TokenManager.onTokenExpired(listener);

// Cleanup
TokenManager.clearTokens();
```

### OAuthFlowService

```typescript
// OAuth flow
await OAuthFlowService.startAuthorizationFlow(options);
await OAuthFlowService.handleCallback(params);

// Token management
await OAuthFlowService.refreshAccessToken();
await OAuthFlowService.getValidAccessToken();

// Session
await OAuthFlowService.logout();
OAuthFlowService.isAuthenticated();
OAuthFlowService.getAuthStatus();
```

### SessionManager

```typescript
// Session lifecycle
SessionManager.createSession(data);
SessionManager.getSession();
SessionManager.isSessionValid();

// Activity
SessionManager.recordActivity();
SessionManager.refreshSession();

// Cleanup
SessionManager.clearSession();

// Listeners
SessionManager.onSessionExpired(listener);
```

---

## 🔒 Security Considerations

### Best Practices

1. **NEVER expose client secrets in frontend code**
    - Keep `OAUTH_CLIENT_SECRET` server-side only

2. **Always use HTTPS in production**
    - Set `NODE_ENV=production` for secure cookies

3. **Validate redirect URIs strictly**
    - Must match exactly what's registered with OAuth provider

4. **Use strong encryption keys**
    - Generate 32-character random keys

5. **Implement rate limiting**
    - Default: 10 refresh attempts per minute per user

6. **Monitor for suspicious activity**
    - Log all auth events
    - Alert on repeated failures

### Security Headers

```
Content-Security-Policy: default-src 'self'; connect-src https://auth.provider.com
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000
X-XSS-Protection: 1; mode=block
```

---

## 🔧 Troubleshooting

### Issue: Token refresh failing

**Solution:**

```typescript
// Check if refresh token exists
const refreshToken = TokenManager.getRefreshToken();
if (!refreshToken) {
    // Need to re-authenticate
    await OAuthFlowService.startAuthorizationFlow();
}

// Check token validity
const isExpired = TokenManager.isTokenExpired();
console.log('Token expired:', isExpired);
```

### Issue: Session expired too early

**Solution:**

```typescript
// Check inactivity timeout
const metadata = SessionManager.getSessionMetadata();
console.log('Inactivity:', metadata.inactivityDuration);

// Record activity manually if needed
SessionManager.recordActivity();

// Extend session
SessionManager.refreshSession();
```

### Issue: OAuth callback not working

**Solution:**

```typescript
// Verify redirect URI matches
const config = AuthConfigManager.getSensitiveConfig();
console.log('Redirect URI:', config?.redirectUri);

// Check state parameter
const state = PKCEService.getAndClearState();
console.log('State valid:', state !== null);

// Validate code verifier
const verifier = PKCEService.getAndClearCodeVerifier();
console.log('Verifier found:', verifier !== null);
```

---

## 🚀 Deployment

### Environment Configuration Generation

```typescript
import ConfigurationGenerator from '@/services/auth/ConfigurationGenerator';

// Export as .env
const envFile = ConfigurationGenerator.exportAsEnvFile(config);

// Export for GitHub Secrets
const secrets = ConfigurationGenerator.exportForGitHubSecrets(config);

// Export for Vercel
const vercelConfig = ConfigurationGenerator.exportForVercel(config);

// Export for AWS
const awsConfig = ConfigurationGenerator.exportForAWS(config);
```

### Docker Deployment

```dockerfile
FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV NODE_ENV=production
ENV HTTPS_ENABLED=true

RUN npm run build

CMD ["npm", "start"]
```

### GitHub Actions Example

```yaml
name: Deploy OAuth System

on:
    push:
        branches: [main]

env:
    REACT_APP_OAUTH_CLIENT_ID: ${{ secrets.OAUTH_CLIENT_ID }}
    OAUTH_CLIENT_SECRET: ${{ secrets.OAUTH_CLIENT_SECRET }}

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v2
            - uses: actions/setup-node@v2
            - run: npm install
            - run: npm run build
            - run: npm run deploy
```

---

## 📞 Support

For issues or questions:

1. Check [OAUTH_PKCE_IMPLEMENTATION.md](./OAUTH_PKCE_IMPLEMENTATION.md) for detailed guide
2. Review [OAUTH.md](./OAUTH.md) for OAuth overview
3. Consult [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for deployment help

---

## 📄 License

Part of dollarbot.site trading platform.

**Created:** May 25, 2026  
**Status:** Production Ready  
**Version:** 1.0.0
