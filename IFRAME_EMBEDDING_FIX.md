# Iframe Embedding Fix - White Page Issue

## Problem

The Hyperbot iframe is showing a white/blank page. This is because the **external Hyperbot site** (`https://hyperbot-indol.vercel.app`) is blocking iframe embedding.

## Solution

You need to configure the **Hyperbot Vercel project** (the separate project at `hyperbot-indol.vercel.app`) to allow iframe embedding.

### Step 1: Add `vercel.json` to Your Hyperbot Project

Go to your Hyperbot project repository (the one deployed at `https://hyperbot-indol.vercel.app/`) and create/update `vercel.json`:

```json
{
    "headers": [
        {
            "source": "/(.*)",
            "headers": [
                {
                    "key": "Content-Security-Policy",
                    "value": "frame-ancestors *"
                }
            ]
        }
    ]
}
```

**Important:** Do NOT set `X-Frame-Options` header, or if it exists, remove it. The `Content-Security-Policy` with `frame-ancestors *` is sufficient.

### Step 2: Deploy the Changes

1. Commit the `vercel.json` file to your Hyperbot project
2. Push to your repository
3. Vercel will automatically redeploy
4. Wait for deployment to complete

### Step 3: Test

1. Open your main project
2. Navigate to SpeedBots > Hyperbot
3. The iframe should now load properly
4. Check browser console (F12) - you should see "Iframe loaded: https://hyperbot-indol.vercel.app"

## Alternative: Test the URL Directly

1. Open `https://hyperbot-indol.vercel.app` directly in your browser
2. If it loads, the site is working
3. If it shows a white page there too, the issue is with the Hyperbot project itself, not iframe embedding

## Debugging

### Check Browser Console

Open browser DevTools (F12) and check:

- **Console tab**: Look for errors like "Refused to display in a frame" or "X-Frame-Options"
- **Network tab**: Check if the iframe request is being blocked (status 403 or X-Frame-Options header)

### Check Response Headers

1. Open DevTools > Network tab
2. Reload the page
3. Find the request to `hyperbot-indol.vercel.app`
4. Check Response Headers:
    - If you see `X-Frame-Options: DENY` or `X-Frame-Options: SAMEORIGIN` → The site is blocking embedding
    - If you see `Content-Security-Policy: frame-ancestors 'none'` → The site is blocking embedding
    - If you see `Content-Security-Policy: frame-ancestors *` → Embedding should work

## Current Status

✅ **Main project configured**: The `vercel.json` in this project allows iframe embedding  
❌ **Hyperbot project needs configuration**: The external Hyperbot site needs to allow embedding

## Quick Test

After configuring the Hyperbot project, test with this HTML:

```html
<!DOCTYPE html>
<html>
    <head>
        <title>Test Iframe</title>
    </head>
    <body>
        <iframe src="https://hyperbot-indol.vercel.app" width="100%" height="600px"></iframe>
    </body>
</html>
```

If this works, the iframe embedding is configured correctly.
