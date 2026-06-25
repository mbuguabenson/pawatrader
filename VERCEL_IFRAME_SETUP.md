# Vercel Iframe Embedding Setup for Hyperbot

## Issue

The Hyperbot iframe is not loading and showing download prompts. This is because Vercel sites block iframe embedding by default for security.

## Solution: Configure Vercel Headers

You need to add a `vercel.json` file to your Hyperbot project (the one deployed at `https://hyperbot-indol.vercel.app/`) to allow iframe embedding.

### Step 1: Create `vercel.json` in your Hyperbot project root

```json
{
    "headers": [
        {
            "source": "/(.*)",
            "headers": [
                {
                    "key": "X-Frame-Options",
                    "value": "SAMEORIGIN"
                },
                {
                    "key": "Content-Security-Policy",
                    "value": "frame-ancestors 'self' https://*.vercel.app https://deriv-hunter-*.vercel.app https://your-main-domain.com"
                }
            ]
        }
    ]
}
```

**OR** to allow embedding from any domain (less secure but easier):

```json
{
    "headers": [
        {
            "source": "/(.*)",
            "headers": [
                {
                    "key": "X-Frame-Options",
                    "value": "ALLOWALL"
                }
            ]
        }
    ]
}
```

**Note:** `ALLOWALL` is not a standard value. The better approach is to **remove** the `X-Frame-Options` header entirely or set it to allow your main domain.

### Step 2: Better Solution - Remove X-Frame-Options

If your Hyperbot project doesn't explicitly set `X-Frame-Options`, Vercel might be adding it. To allow embedding:

```json
{
    "headers": [
        {
            "source": "/(.*)",
            "headers": [
                {
                    "key": "X-Frame-Options",
                    "value": ""
                },
                {
                    "key": "Content-Security-Policy",
                    "value": "frame-ancestors *"
                }
            ]
        }
    ]
}
```

### Step 3: Deploy the Changes

1. Add the `vercel.json` file to your Hyperbot project root
2. Commit and push to your repository
3. Vercel will automatically redeploy
4. The iframe should now work

## Alternative: Check Your Hyperbot Project

If your Hyperbot project is a React/Next.js app, you might also need to check:

1. **Next.js**: Add to `next.config.js`:

```javascript
module.exports = {
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN',
                    },
                ],
            },
        ];
    },
};
```

2. **React/Vite**: Check if there's a server configuration blocking iframes

## Testing

After deploying:

1. Open your main project
2. Navigate to SpeedBots > Hyperbot
3. The iframe should load properly
4. Check browser console (F12) for any errors

## Troubleshooting

- **Still showing white/blank**: Check browser console for CORS or X-Frame-Options errors
- **Still downloading**: The site might be serving a file instead of HTML - check the URL directly
- **CORS errors**: Make sure both sites use HTTPS
