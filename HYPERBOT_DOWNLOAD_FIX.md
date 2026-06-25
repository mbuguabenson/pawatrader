# Fixing Hyperbot Iframe Download Issue

## Problem

The Hyperbot iframe is triggering downloads instead of displaying content. This happens when:

1. The external site serves files with incorrect `Content-Type` headers
2. The site redirects to a download endpoint
3. The response is being treated as a file download

## Solution Steps

### Step 1: Verify the External Site Configuration

Go to your Hyperbot project (`https://hyperbot-indol.vercel.app/`) and ensure:

1. **Check `vercel.json`** - Make sure it has:

```json
{
    "headers": [
        {
            "source": "/(.*)",
            "headers": [
                {
                    "key": "Content-Security-Policy",
                    "value": "frame-ancestors *"
                },
                {
                    "key": "Content-Type",
                    "value": "text/html; charset=utf-8"
                }
            ]
        }
    ]
}
```

2. **For Next.js projects**, check `next.config.js`:

```javascript
module.exports = {
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: 'frame-ancestors *',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: '', // Remove this header
                    },
                ],
            },
        ];
    },
};
```

### Step 2: Test the URL Directly

1. Open `https://hyperbot-indol.vercel.app/` directly in your browser
2. Check if it loads as a webpage (not a download)
3. If it downloads, the issue is in the Hyperbot project's configuration

### Step 3: Check Response Headers

1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate to SpeedBots > Hyperbot
4. Find the request to `hyperbot-indol.vercel.app`
5. Check Response Headers:
    - `Content-Type` should be `text/html` (not `application/octet-stream` or similar)
    - `X-Frame-Options` should NOT be `DENY` or `SAMEORIGIN`
    - `Content-Security-Policy` should include `frame-ancestors *`

### Step 4: Common Issues

#### Issue: Site is serving a file instead of HTML

**Fix**: Ensure your Hyperbot project's build output is HTML, not a downloadable file. Check your build configuration.

#### Issue: Redirect to download endpoint

**Fix**: Check if there are any redirects in your Hyperbot project that might be sending users to download endpoints.

#### Issue: Content-Type header is wrong

**Fix**: Add explicit `Content-Type: text/html` header in `vercel.json` (see Step 1).

### Step 5: Alternative Test

Try accessing the URL with a query parameter to see if it helps:

```
https://hyperbot-indol.vercel.app/?embed=true
```

Then update the iframe src in `src/pages/hyperbot/index.tsx` to include this parameter.

## Debugging Commands

Open browser console and check:

- Look for "✅ Iframe loaded successfully" message
- Check for any CORS or X-Frame-Options errors
- In Network tab, check the response headers of the iframe request

## Current Status

✅ **Main project configured**: Ready to display iframes  
❌ **Hyperbot project needs fix**: The external site is serving downloads instead of HTML

The issue is in the **Hyperbot Vercel project**, not this main project. You need to configure the Hyperbot project to serve HTML with proper headers.
