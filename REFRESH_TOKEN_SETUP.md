# Refresh token setup

Use your Google OAuth credentials JSON with `refresh-token.js` as follows.

## 1. Add credentials to `.env`

From your credentials JSON (`installed`), set in `.env`:

```env
GMAIL_CLIENT_ID=<client_id from your JSON>
GMAIL_CLIENT_SECRET=<client_secret from your JSON>
GMAIL_REDIRECT_URI=http://localhost:3000
GMAIL_REFRESH_TOKEN=
GMAIL_ADDRESS=your@gmail.com
```

**Redirect URI:** Your JSON has `"redirect_uris": ["http://localhost"]`. For the one-time “get new token” flow you need a callback server:

- Either add **http://localhost:3000** as an authorized redirect URI in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (Edit your OAuth 2.0 Client ID → Authorized redirect URIs) and set `GMAIL_REDIRECT_URI=http://localhost:3000` (recommended),  
- Or keep `GMAIL_REDIRECT_URI=http://localhost` and run the get-new-token script on port 80 (e.g. `sudo node get-new-token.js`).

## 2. Get a refresh token (one-time)

If you don’t have a refresh token yet:

**On a remote server (recommended – avoids invalid_grant):** Use SSH port forwarding so the server receives the callback.

1. On your **local machine**, forward port 3080 to the server:
   ```bash
   ssh -L 3080:localhost:3080 root@ubuntu-4gb-nbg1-1
   ```
2. Keep that SSH session open. In **another terminal**, SSH into the server and run:
   ```bash
   cd /opt/gmail-email-assistant && node get-new-token.js
   ```
3. On your **local machine**, open the printed auth URL in your browser (e.g. copy from the server terminal). Sign in with Google.
4. Google will redirect to `http://localhost:3080` on your machine; that port is forwarded to the server, so the server gets the code and exchanges it automatically, then prints the refresh token.
5. Add the printed `GMAIL_REFRESH_TOKEN=...` to `.env` on the server.

**Or run locally:** If you run the app on your laptop, just run `node get-new-token.js` and open the URL; the callback will hit the same machine.

## 3. Refresh the access token

Whenever you need to refresh the access token (or to test that the refresh token works):

```bash
node refresh-token.js
```

You should see “Token refreshed successfully!” and a short Gmail API test. The app uses this refresh token to obtain new access tokens automatically.
