const http = require('http');
const { google } = require('googleapis');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.modify'];

function getCallbackRedirectAndPort() {
  const raw = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000';
  try {
    const u = new URL(raw);
    let port = u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 80);
    if (!Number.isFinite(port)) port = 3000;
    // Port 80/443 often in use or need root; use 3080 to avoid clashing with app on 3000
    if (port === 80 || port === 443) {
      console.log('Redirect URI is', raw, '- port', port, 'is not used to avoid conflicts.');
      console.log('Using http://localhost:3080 for this run.');
      console.log('Add "http://localhost:3080" to Authorized redirect URIs in Google Cloud Console,');
      console.log('and set GMAIL_REDIRECT_URI=http://localhost:3080 in .env for refresh-token.js.\n');
      return { redirectUri: 'http://localhost:3080', port: 3080 };
    }
    return { redirectUri: raw, port };
  } catch {
    return { redirectUri: 'http://localhost:3000', port: 3000 };
  }
}

async function getNewToken() {
  const { redirectUri, port } = getCallbackRedirectAndPort();

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'  // force consent so we get a refresh_token
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '', 'http://localhost');
    const code = url.searchParams.get('code');
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing code in callback. Close this tab and try again.');
      return;
    }
    try {
      const { credentials } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(credentials);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <h1>Success</h1>
        <p>You can close this tab and return to the terminal.</p>
        <p>Add this to your <code>.env</code> file:</p>
        <pre>GMAIL_REFRESH_TOKEN=${credentials.refresh_token || '(none - reuse existing)'}</pre>
      `);
      console.log('\n✅ Refresh token received!\n');
      console.log('Add this line to your .env file:');
      console.log('GMAIL_REFRESH_TOKEN=' + (credentials.refresh_token || ''));
      if (credentials.refresh_token) {
        console.log('\nThen run: node refresh-token.js');
      }
      server.close();
      process.exit(0);
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error exchanging code: ' + err.message);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('Port', port, 'is already in use. Set GMAIL_REDIRECT_URI=http://localhost:3080 (or another free port) in .env and add that URL in Google Cloud Console.');
    } else {
      console.error(err);
    }
    process.exit(1);
  });

  server.listen(port, () => {
    console.log('Listening on', redirectUri);
    console.log('Open this URL in your browser to authorize:\n');
    console.log(authUrl);
    console.log('');
    console.log('If you run this on a REMOTE server, the callback will hit YOUR machine, not the server.');
    console.log('Either: (1) On your laptop run:  ssh -L 3080:localhost:3080 user@SERVER  then open the URL and authorize;');
    console.log('       (2) Or use a tunnel (e.g. ngrok) and set GMAIL_REDIRECT_URI to the tunnel URL.');
    console.log('');
    const { exec } = require('child_process');
    const open = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(open + ' "' + authUrl + '"', () => {});
  });
}

async function exchangeCode(code, redirectUriOverride) {
  let redirectUri = redirectUriOverride || process.env.GMAIL_REDIRECT_URI || 'http://localhost:3080';
  if (!redirectUriOverride && (redirectUri === 'http://localhost' || redirectUri === 'https://localhost')) {
    redirectUri = 'http://localhost:3080'; // match the callback URL we use when avoiding port 80
  }
  if (redirectUriOverride) {
    console.log('Using redirect_uri:', redirectUri);
  }
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    redirectUri
  );
  const { credentials } = await oauth2Client.getToken(code);
  console.log('\n✅ Refresh token received!\n');
  console.log('Add this line to your .env file:');
  console.log('GMAIL_REFRESH_TOKEN=' + (credentials.refresh_token || ''));
  if (credentials.refresh_token) {
    console.log('\nThen run: node refresh-token.js');
  }
}

const codeArg = process.argv.find((a) => a.startsWith('--code='));
const codeValue = codeArg ? codeArg.replace(/^--code=/, '').trim() : null;
const redirectArg = process.argv.find((a) => a.startsWith('--redirect-uri='));
const redirectOverride = redirectArg ? redirectArg.replace(/^--redirect-uri=/, '').trim() : null;

if (codeValue) {
  exchangeCode(codeValue, redirectOverride).catch((err) => {
    console.error('Error exchanging code:', err.message);
    if (err.message.includes('redirect_uri') || err.message.includes('invalid_grant')) {
      console.log('\n• Use a fresh code (codes expire in ~10 min and are one-time use).');
      console.log('• Force redirect URI:  node get-new-token.js --code="YOUR_CODE" --redirect-uri=http://localhost:3080');
      console.log('• Set GMAIL_REDIRECT_URI=http://localhost:3080 in .env');
    }
    process.exit(1);
  });
} else {
  getNewToken().catch((err) => {
    console.error('Error:', err.message);
    if (err.message.includes('redirect_uri')) {
      console.log('\nEnsure GMAIL_REDIRECT_URI in .env matches an authorized redirect URI in Google Cloud Console.');
    }
    process.exit(1);
  });
}
