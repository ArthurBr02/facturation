#!/usr/bin/env node
// One-time script to obtain a Google OAuth2 refresh token for Drive access.
//
// Prerequisites:
//   1. Google Cloud Console → project → Enable "Google Drive API"
//   2. APIs & Services → Credentials → Create OAuth client ID → type "Desktop app"
//      (or "Web application" with http://localhost:4321/callback as Authorized redirect URI)
//   3. Copy Client ID and Client Secret below
//
// Usage:
//   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy node back/scripts/get-drive-token.mjs
//
// The script opens a browser auth URL, catches the callback on localhost:4321,
// then prints the refresh token to add to .env.
import { google } from 'googleapis';
import http from 'node:http';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET env vars.');
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:4321/callback';

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive'],
  prompt: 'consent', // forces Google to return a refresh_token
});

console.log('\n=== Google Drive OAuth2 Setup ===\n');
console.log('Open this URL in your browser:\n');
console.log(authUrl);
console.log('\nWaiting for Google to redirect to localhost:4321 …\n');

// Spin up a temporary HTTP server to catch the OAuth2 callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:4321');
  if (url.pathname !== '/callback') { res.end(); return; }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h2>Erreur : ${error}</h2><p>Ferme cette fenêtre.</p>`);
    server.close();
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2.getToken(code);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>✅ Autorisé !</h2><p>Tu peux fermer cette fenêtre et revenir au terminal.</p>');
    server.close();

    console.log('\n=== Ajoute ces lignes dans ton .env ===\n');
    console.log(`GOOGLE_CLIENT_ID=${clientId}`);
    console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\nPuis rebuild : docker compose up -d --build api\n');
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h2>Erreur token</h2><pre>${err.message}</pre>`);
    server.close();
    console.error('Erreur lors de l\'échange du code :', err.message);
    process.exit(1);
  }
});

server.listen(4321, 'localhost', () => {});
