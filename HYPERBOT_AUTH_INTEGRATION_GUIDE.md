# Hyperbot Authentication Integration - Quick Start Guide

## Problem

The Hyperbot iframe shows "Please log in to place trades" even though you're logged into the main application.

## Solution

The main application is already sending auth tokens via `postMessage`. Your Hyperbot project needs to **listen for these messages** and use the tokens.

## Step 1: Add Message Listener to Your Hyperbot Project

Add this code to your main Hyperbot component (e.g., `App.jsx`, `Hyperbot.jsx`, or `index.jsx`):

```javascript
import { useEffect } from 'react';

// Add this inside your Hyperbot component
useEffect(() => {
    // Listen for auth tokens from parent window
    const handleMessage = event => {
        // Security: Optionally check event.origin
        // const allowedOrigins = ['https://deriv-hunter.vercel.app', 'https://your-domain.com'];
        // if (!allowedOrigins.includes(event.origin)) return;

        if (event.data && event.data.type === 'AUTH_TOKEN') {
            const { token, loginid } = event.data;

            if (token && loginid) {
                console.log('✅ Auth token received from parent window');

                // Store the token in localStorage
                localStorage.setItem('authToken', token);
                localStorage.setItem('active_loginid', loginid);

                // If you're using Deriv API, re-authorize with the new token
                // Example:
                // if (api && api.authorize) {
                //     api.authorize(token).then(({ authorize, error }) => {
                //         if (!error) {
                //             console.log('✅ Authorized with parent token');
                //             // Update your app state to reflect logged-in status
                //         }
                //     });
                // }

                // If you have a state management system, update it here
                // Example:
                // setAuthToken(token);
                // setLoginId(loginid);
                // setIsLoggedIn(true);
            }
        }
    };

    window.addEventListener('message', handleMessage);

    // Request auth token immediately on load (if embedded in iframe)
    if (window.parent && window.parent !== window) {
        console.log('📨 Requesting auth token from parent...');
        window.parent.postMessage({ type: 'REQUEST_AUTH' }, '*');
    }

    return () => {
        window.removeEventListener('message', handleMessage);
    };
}, []);
```

## Step 2: Update Your API Authorization

If your Hyperbot uses Deriv API, make sure it uses the token from localStorage:

```javascript
// Example: When initializing or authorizing API
const token = localStorage.getItem('authToken');
if (token) {
    api.authorize(token).then(({ authorize, error }) => {
        if (!error) {
            // User is logged in, update UI
            setIsLoggedIn(true);
        }
    });
}
```

## Step 3: Check for Token on Component Mount

When your Hyperbot component loads, check if a token already exists:

```javascript
useEffect(() => {
    const token = localStorage.getItem('authToken');
    const loginid = localStorage.getItem('active_loginid');

    if (token && loginid) {
        // User is already authenticated
        setIsLoggedIn(true);
        // Authorize API if needed
        if (api) {
            api.authorize(token);
        }
    } else {
        // No token yet, wait for postMessage
        setIsLoggedIn(false);
    }
}, []);
```

## Step 4: Handle Token Updates

The parent window sends tokens periodically and when login state changes. Make sure your app responds to these updates:

```javascript
useEffect(() => {
    const handleMessage = event => {
        if (event.data && event.data.type === 'AUTH_TOKEN') {
            const { token, loginid } = event.data;

            if (token && loginid) {
                // Update localStorage
                localStorage.setItem('authToken', token);
                localStorage.setItem('active_loginid', loginid);

                // Re-authorize API if token changed
                const currentToken = localStorage.getItem('authToken');
                if (currentToken !== token && api) {
                    api.authorize(token);
                }
            } else {
                // Token is null - user logged out
                localStorage.removeItem('authToken');
                localStorage.removeItem('active_loginid');
                setIsLoggedIn(false);
            }
        }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
}, []);
```

## Complete Example

Here's a complete example for a React component:

```javascript
import React, { useEffect, useState } from 'react';

function Hyperbot() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [api, setApi] = useState(null);

    useEffect(() => {
        // Initialize API (your existing code)
        // const derivApi = initializeDerivAPI();
        // setApi(derivApi);

        // Check for existing token
        const existingToken = localStorage.getItem('authToken');
        if (existingToken && api) {
            api.authorize(existingToken).then(({ authorize, error }) => {
                if (!error) {
                    setIsLoggedIn(true);
                }
            });
        }

        // Listen for auth tokens from parent
        const handleMessage = event => {
            if (event.data && event.data.type === 'AUTH_TOKEN') {
                const { token, loginid } = event.data;

                if (token && loginid) {
                    localStorage.setItem('authToken', token);
                    localStorage.setItem('active_loginid', loginid);

                    if (api) {
                        api.authorize(token).then(({ authorize, error }) => {
                            if (!error) {
                                setIsLoggedIn(true);
                                console.log('✅ Authenticated via parent token');
                            }
                        });
                    }
                }
            }
        };

        window.addEventListener('message', handleMessage);

        // Request token on load
        if (window.parent !== window) {
            window.parent.postMessage({ type: 'REQUEST_AUTH' }, '*');
        }

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [api]);

    return <div>{isLoggedIn ? <YourTradingInterface /> : <div>Waiting for authentication...</div>}</div>;
}
```

## Testing

1. Deploy your updated Hyperbot project
2. Open the main application and log in
3. Navigate to SpeedBots > Hyperbot
4. Open browser console (inspect the iframe)
5. You should see:
    - `📨 Requesting auth token from parent...`
    - `✅ Auth token received from parent window`
    - `✅ Authenticated via parent token`
6. The "Please log in" modal should disappear
7. You should be able to place trades

## Troubleshooting

- **Still seeing "Please log in"**: Check browser console for errors. Make sure the message listener is set up correctly.
- **Token is null**: Make sure you're logged into the main application first.
- **Trades not working**: Verify the token is being used correctly in your API authorization.
- **Console errors**: Check that `window.parent.postMessage` is only called when in an iframe.

## Security Note

For production, validate the `event.origin`:

```javascript
const allowedOrigins = ['https://deriv-hunter.vercel.app', 'https://your-production-domain.com'];

if (!allowedOrigins.includes(event.origin)) {
    console.warn('Rejected message from unauthorized origin:', event.origin);
    return;
}
```
