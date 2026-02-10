# Simplest Method: Use Postman to Get Refresh Token

Since redirects keep failing, let's use Postman's OAuth2 helper:

---

## Step 1: Download Postman (if you don't have it)
https://www.postman.com/downloads/

---

## Step 2: Create OAuth2 Request in Postman

1. **Open Postman**
2. **Create a new request** (click "+" or "New")
3. **Go to "Authorization" tab**
4. **Select "OAuth 2.0"** from dropdown

---

## Step 3: Configure OAuth2 in Postman

Fill in these exact values:

```
Token Name: Zoho CRM Token
Grant Type: Authorization Code
Callback URL: https://oauth.pstmn.io/v1/callback
Auth URL: https://accounts.zoho.in/oauth/v2/auth
Access Token URL: https://accounts.zoho.in/oauth/v2/token
Client ID: [From API Console]
Client Secret: [From API Console]
Scope: ZohoCRM.modules.ALL
```

**CRITICAL**: For "Callback URL", use Postman's built-in:
```
https://oauth.pstmn.io/v1/callback
```

---

## Step 4: Add Callback URL to API Console

1. Go to API Console: https://api-console.zoho.in
2. Click "Sales Ops Web App"
3. Go to "Client Secret" tab
4. **Add this redirect URI**:
   ```
   https://oauth.pstmn.io/v1/callback
   ```
5. Click "Update"

---

## Step 5: Get Token in Postman

1. Scroll down in Postman
2. Click **"Get New Access Token"**
3. Zoho opens in browser → Click "Accept"
4. Postman shows the tokens!
5. **Copy the "Refresh Token"** 

Done! ✅

---

## Step 6: Add to Netlify

```
ZOHO_REFRESH_TOKEN = [From Postman]
ZOHO_CLIENT_ID = [From API Console]
ZOHO_CLIENT_SECRET = [From API Console]
ZOHO_REGION = in
```

---

## Why This Works:

- ✅ Postman handles all OAuth complexity
- ✅ Postman's redirect URL is whitelisted everywhere
- ✅ No manual URL parsing needed
- ✅ Visual interface - no command line

This is the industry-standard way to test OAuth! Should take 5 minutes.
