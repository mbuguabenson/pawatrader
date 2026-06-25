# Production-Ready OAuth 2.0 PKCE Authentication System

## Complete Implementation Guide

## 📋 Overview

This is a comprehensive OAuth 2.0 PKCE authentication system for trading platforms with:

- Modern admin onboarding wizard UI
- Automatic token refresh and session management
- Legacy App ID support for backward compatibility
- Enterprise-grade security features
- Production-ready backend architecture
- WebSocket trading session authentication
- Automatic environment configuration generation

## 🏗️ Architecture

### Frontend Architecture

```
Services/
├── AuthConfigManager.ts          # Configuration management & validation
├── TokenManager.ts               # Token lifecycle management
├── PKCEService.ts               # PKCE code generation (SHA256)
├── SessionManager.ts             # Secure session management
├── OAuthFlowService.ts          # Complete OAuth flow orchestration
├── ConfigurationGenerator.ts     # Environment config generation
└── backend-auth-endpoints.ts    # Backend endpoint documentation

Components/
├── OAuthOnboardingWizard.tsx     # Multi-step setup wizard
└── AuthStatusComponents.tsx      # Real-time status monitoring
```

### Backend Architecture

```
Endpoints:
├── POST /api/auth/token/refresh      # Token refresh with PKCE
├── POST /api/auth/session/validate   # Session validation
├── POST /api/auth/logout             # Logout & cleanup
├── GET  /api/auth/health             # Service health check
└── GET  /api/auth/config/generate    # Config export

Security Middleware:
├── PKCE Validation
├── Rate Limiting (Redis)
├── CSRF Protection
├── CSP Headers
├── Secure Cookies
└── WebSocket Auth Middleware
```

## 🚀 Quick Start

### 1. Initialize Configuration

```typescript
import AuthConfigManager from '@/services/auth/AuthConfigManager';

// Load from environment or storage
await AuthConfigManager.initialize();

// Or set manually
await AuthConfigManager.setConfig({
    siteUrl: 'https://trading-platform.com',
    clientId: 'your-client-id',
    authorizationUrl: 'https://auth.provider.com/oauth2/authorize',
    tokenUrl: 'https://auth.provider.com/oauth2/token',
    redirectUri: 'https://trading-platform.com/api/oauth/callback',
    scopes: ['read', 'trade', 'payments', 'trading_information'],
    enableLegacyMode: false,
    codeChallengMethod: 'S256',
});
```

### 2. Start OAuth Flow

```typescript
import OAuthFlowService from '@/services/auth/OAuthFlowService';

// Start authorization
await OAuthFlowService.startAuthorizationFlow({
    scope: 'read trade payments',
    prompt: 'login',
});

// Handle callback after redirect
const token = await OAuthFlowService.handleCallback({
    code: urlParams.code,
    state: urlParams.state,
});
```

### 3. Use Authentication in Components

```typescript
import { useOAuth } from '@/hooks/useOAuth';

function TradingDashboard() {
    const { isAuthenticated, getValidAccessToken, logout } = useOAuth();

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return <Dashboard />;
}
```

### 4. Monitor Authentication Status

```typescript
import {
    TokenStatusIndicator,
    SessionStatusBadge,
    AuthStatusDashboard
} from '@/components/auth/AuthStatusComponents';

function StatusBar() {
    return (
        <div>
            <TokenStatusIndicator showLabel={true} />
            <SessionStatusBadge />
            <AuthStatusDashboard />
        </div>
    );
}
```

## 🔐 Security Features

### PKCE (Proof Key for Public Clients)

- **SHA256 Code Challenge**: Cryptographically secure code generation
- **State Parameter**: CSRF protection with 10-minute expiry
- **Secure Storage**: Session storage for code verifier (not localStorage)

### Token Management

- **Automatic Refresh**: Tokens refreshed 5 minutes before expiry
- **Secure Storage**: HttpOnly, Secure, SameSite cookies
- **Encryption**: AES-256 encryption for stored sensitive data
- **Validation**: Real-time token expiry validation

### Session Management

- **Encrypted Storage**: Session data encrypted with unique key
- **Inactivity Timeout**: 30-minute automatic logout
- **Session Recovery**: Backup & restore capabilities
- **Activity Tracking**: Records last activity timestamp

### Backend Security

- **Rate Limiting**: Redis-based rate limiting (10 requests/minute per user)
- **CSRF Protection**: Token validation on all state-changing requests
- **CSP Headers**: Content Security Policy to prevent XSS
- **Secure Headers**: HSTS, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection

### Encryption

```
Token Storage: AES-256-CBC with random IV
Session Data: AES-256-CBC with unique encryption key
Configuration: CryptoJS encryption with secure key storage
```

## 🔄 Token Refresh Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. Token expiring soon?
       │ TokenManager.isTokenExpiringSoon()
       │
       ├─→ Yes
       │   │
       │   ├─→ Call OAuthFlowService.refreshAccessToken()
       │   │
       │   ├─→ POST /api/auth/token/refresh
       │   │   {refresh_token: "..."}
       │   │
       │   ├─→ Backend exchanges refresh token for new access token
       │   │
       │   └─→ TokenManager.storeToken(newToken)
       │       └─→ Schedule next refresh
       │
       └─→ No
           └─→ Use current token
```

## 🧙 Admin Onboarding Wizard

The multi-step wizard guides administrators through OAuth setup:

**Step 1: Site URL**

- Enter trading platform base URL
- Validates URL format

**Step 2: OAuth Credentials**

- Input OAuth Client ID
- From OAuth provider's developer portal

**Step 3: OAuth Endpoints**

- Authorization endpoint URL
- Token exchange endpoint URL

**Step 4: Redirect URI**

- OAuth callback URL
- Must match provider configuration

**Step 5: Trading Scopes**

- Select required permissions
- Options: read, trade, payments, trading_information, admin

**Step 6: Legacy Support** (Optional)

- Enable for backward compatibility
- Configure Legacy App ID

**Step 7: Review & Complete**

- Review all settings
- Generate environment variables
- Save configuration

## 📦 Environment Configuration

### Frontend Variables

```env
REACT_APP_SITE_URL=https://trading-platform.com
REACT_APP_OAUTH_CLIENT_ID=your-client-id
REACT_APP_OAUTH_AUTHORIZATION_URL=https://auth.provider.com/oauth2/authorize
REACT_APP_OAUTH_TOKEN_URL=https://auth.provider.com/oauth2/token
REACT_APP_OAUTH_REDIRECT_URI=https://trading-platform.com/api/oauth/callback
REACT_APP_OAUTH_SCOPES=read,trade,payments,trading_information
REACT_APP_LEGACY_APP_ID=
REACT_APP_ENABLE_LEGACY_MODE=false
```

### Backend Variables

```env
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-secret-keep-secure
OAUTH_TOKEN_URL=https://auth.provider.com/oauth2/token
OAUTH_REDIRECT_URI=https://trading-platform.com/api/oauth/callback
TOKEN_ENCRYPTION_KEY=your-encryption-key
REDIS_URL=redis://localhost:6379
SECURE_COOKIES=true
CSRF_PROTECTION=true
```

### Generate Configuration

```typescript
import ConfigurationGenerator from '@/services/auth/ConfigurationGenerator';

// Export as .env file
const envFile = ConfigurationGenerator.exportAsEnvFile(config);

// Export as JSON
const jsonConfig = ConfigurationGenerator.exportAsJSON(config);

// Export for Docker
const dockerEnv = ConfigurationGenerator.exportAsDockerEnv(config);

// Export for GitHub Secrets
const ghSecrets = ConfigurationGenerator.exportForGitHubSecrets(config);

// Export for Vercel
const vercelConfig = ConfigurationGenerator.exportForVercel(config);

// Export for AWS
const awsConfig = ConfigurationGenerator.exportForAWS(config);
```

## 🌐 WebSocket Trading Session Authentication

```typescript
// Client-side
const socket = io(TRADING_API_URL, {
    auth: {
        token: await OAuthFlowService.getValidAccessToken(),
    },
});

// Server-side
io.use(authenticateWebSocket);

function authenticateWebSocket(socket, next) {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error('Authentication error'));
    }

    // Validate token and extract user info
    const userId = extractUserIdFromToken(token);
    socket.userId = userId;

    next();
}
```

## 🔄 Session Recovery

```typescript
// Listen for session expiry
SessionManager.onSessionExpired(() => {
    console.log('Session expired, attempting recovery...');

    // Show recovery UI
    showSessionRecoveryDialog({
        onRecover: async () => {
            // Attempt to recover with refresh token
            await OAuthFlowService.refreshAccessToken();
        },
        onLogout: async () => {
            // Clear everything and redirect to login
            await OAuthFlowService.logout();
        },
    });
});
```

## 📊 Monitoring & Logging

### Connection Status

```typescript
import { ConnectionStatusDisplay } from '@/components/auth/AuthStatusComponents';

<ConnectionStatusDisplay
    isConnected={websocketConnected}
    isReconnecting={isReconnecting}
/>
```

### Token Expiry Monitoring

```typescript
TokenManager.onTokenExpired(() => {
    // Auto-refresh if possible
    if (TokenManager.getRefreshToken()) {
        OAuthFlowService.refreshAccessToken();
    }
});
```

### Health Check

```typescript
// Backend health check
const health = await fetch('/api/auth/health');
const status = await health.json();
// {
//   status: 'healthy',
//   oauth_provider: 'connected',
//   database: 'connected',
//   cache: 'connected'
// }
```

## 🛠️ Backend Implementation

### Express.js Example

```javascript
const express = require('express');
const redis = require('redis');

const app = express();
const client = redis.createClient({ url: process.env.REDIS_URL });

// Rate limiting middleware
const rateLimit = async (req, res, next) => {
    const userId = req.user?.id;
    const key = `rate_limit:token_refresh:${userId}`;
    const count = await client.incr(key);

    if (count === 1) {
        await client.expire(key, 60);
    }

    if (count > 10) {
        return res.status(429).json({
            error: 'rate_limited',
            error_description: 'Too many requests',
        });
    }

    next();
};

// Security headers
app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
});

// Token refresh endpoint
app.post('/api/auth/token/refresh', rateLimit, async (req, res) => {
    try {
        const { refresh_token } = req.body;

        // Exchange refresh token for new access token
        const response = await fetch(process.env.OAUTH_TOKEN_URL, {
            method: 'POST',
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: process.env.OAUTH_CLIENT_ID,
                client_secret: process.env.OAUTH_CLIENT_SECRET,
                refresh_token,
            }),
        });

        if (!response.ok) {
            return res.status(401).json({
                error: 'invalid_token',
                error_description: 'Refresh token expired',
            });
        }

        const token = await response.json();

        // Set secure HttpOnly cookie
        res.cookie('access_token', token.access_token, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: token.expires_in * 1000,
        });

        res.json(token);
    } catch (error) {
        res.status(500).json({
            error: 'server_error',
            error_description: error.message,
        });
    }
});

app.listen(3000);
```

## 🚢 Deployment Checklist

- [ ] Review and update all environment variables
- [ ] Configure OAuth provider settings
- [ ] Register redirect URI with OAuth provider
- [ ] Set up database for session storage
- [ ] Configure Redis for caching and rate limiting
- [ ] Enable HTTPS and SSL/TLS certificates
- [ ] Configure CORS origins
- [ ] Set up monitoring and error tracking (Sentry, Datadog)
- [ ] Test complete OAuth flow in staging
- [ ] Set up GitHub Secrets for CI/CD
- [ ] Configure automated backups
- [ ] Set up logging and monitoring
- [ ] Performance testing and load testing
- [ ] Security audit and penetration testing
- [ ] Deploy to production

## 📈 Performance Optimization

### Token Refresh Strategy

- Refresh 5 minutes before expiry (configurable)
- Parallel request queuing to prevent multiple refresh attempts
- Cached tokens in memory with localStorage backup

### Session Caching

- Redis-based session caching for faster validation
- 24-hour session TTL with 30-minute inactivity timeout
- Distributed session support for multi-server deployments

### Rate Limiting

- 10 refresh attempts per minute per user
- Distributed rate limiting via Redis
- Graceful degradation on rate limit

## 🔍 Troubleshooting

### Token Refresh Failing

```
Check:
1. Refresh token validity in TokenManager.getRefreshToken()
2. OAuth provider endpoint accessibility
3. Client ID and secret correctness
4. Network connectivity
5. Rate limiting status
```

### Session Expired Too Early

```
Check:
1. SESSION_INACTIVITY_TIMEOUT_MS configuration
2. Activity recording in SessionManager.recordActivity()
3. Browser storage availability
4. Cookie settings
```

### PKCE Validation Failing

```
Check:
1. State parameter matches in PKCEService.validateState()
2. Code verifier retrieval in PKCEService.getAndClearCodeVerifier()
3. Session storage availability
4. Browser security settings
```

## 📚 API Reference

### AuthConfigManager

- `initialize(config?)`: Initialize configuration
- `setConfig(config)`: Set and validate configuration
- `getConfig()`: Get non-sensitive configuration
- `getSensitiveConfig()`: Get full configuration
- `testConnections()`: Test endpoint connectivity
- `exportConfiguration()`: Export for deployment

### TokenManager

- `storeToken(response)`: Store token response
- `getAccessToken()`: Get current access token
- `getRefreshToken()`: Get refresh token
- `isTokenExpired()`: Check expiry status
- `isTokenExpiringSoon()`: Check if expiring in 5 minutes
- `getTimeUntilExpiry()`: Get time remaining (ms)
- `onTokenRefresh(listener)`: Register refresh listener
- `onTokenExpired(listener)`: Register expiry listener
- `clearTokens()`: Clear all tokens

### OAuthFlowService

- `startAuthorizationFlow(options)`: Start OAuth flow
- `handleCallback(params)`: Handle redirect callback
- `refreshAccessToken()`: Refresh expired token
- `getValidAccessToken()`: Get valid token (auto-refresh)
- `logout()`: Logout and cleanup
- `isAuthenticated()`: Check authentication status
- `getAuthStatus()`: Get detailed auth status

### SessionManager

- `createSession(data)`: Create new session
- `getSession()`: Get current session
- `isSessionValid()`: Validate session
- `recordActivity()`: Record user activity
- `refreshSession()`: Refresh session expiry
- `clearSession()`: Clear session
- `onSessionExpired(listener)`: Register expiry listener

## 🤝 Contributing

When extending this authentication system:

1. Maintain backward compatibility with legacy App ID support
2. Follow security best practices (OWASP Top 10)
3. Add comprehensive error handling
4. Test with various OAuth providers
5. Document configuration requirements
6. Update type definitions

## 📄 License

This authentication system is part of the dollarbot.site trading platform.

---

**Last Updated:** 2026-05-25  
**Status:** Production Ready  
**Version:** 1.0.0
